import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { marked } from "marked";

function resolveSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

const sha = resolveSha();
fs.writeFileSync("commit.json", JSON.stringify({ sha }) + "\n");
console.log("wrote commit.json:", sha);

const WORDS_PER_MINUTE = 200;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

const CALLOUT_TYPES = ["note", "tip", "important", "warning", "caution"];
const CALLOUT_RE = new RegExp(
  `^\\[!(${CALLOUT_TYPES.join("|")})\\]\\s*\\n`,
  "i",
);

marked.use({
  renderer: {
    blockquote(token) {
      const match = token.text.match(CALLOUT_RE);
      if (!match) return false; // not a callout, fall back to the default renderer
      const type = match[1].toLowerCase();
      const bodyMarkdown = token.text.slice(match[0].length);
      const bodyHtml = this.parser.parse(marked.lexer(bodyMarkdown));
      return `<div class="callout callout-${type}">\n<p class="callout-label">${type}</p>\n${bodyHtml}</div>\n`;
    },
  },
});

const CAPTION_CLASS = "img-caption";
const CAPTION_IMG_RE = new RegExp(
  `<img([^>]*\\bclass="[^"]*\\b${CAPTION_CLASS}\\b[^"]*"[^>]*)>`,
  "g",
);

function wrapCaptionedImages(html) {
  return html.replace(CAPTION_IMG_RE, (_match, attrs) => {
    const altMatch = attrs.match(/\balt="([^"]*)"/);
    const alt = altMatch ? altMatch[1] : "";
    const caption = alt ? `<figcaption>${alt}</figcaption>` : "";
    return `<figure class="img-figure"><img${attrs}>${caption}</figure>`;
  });
}

function parseFrontmatter(block) {
  const fields = {};
  for (const line of block.split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fields;
}

function estimateReadingMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const SITE_URL = "https://stelle.codes";
const FALLBACK_IMAGE = `${SITE_URL}/stelle-stationary.png`;
const DESCRIPTION_WORD_LIMIT = 200;

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractDescription(html) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ");
  if (words.length <= DESCRIPTION_WORD_LIMIT) return text;
  return words.slice(0, DESCRIPTION_WORD_LIMIT).join(" ") + "...";
}

function extractFirstImage(html) {
  const match = html.match(/<img[^>]*\ssrc="([^"]+)"/);
  if (!match) return FALLBACK_IMAGE;
  const src = match[1];
  return src.startsWith("http") ? src : `${SITE_URL}${src}`;
}

// social/chat link-preview crawlers don't run JS, so they can't see anything
// the SPA renders client-side from the #blog/<slug> hash. each post gets its
// own static stub page instead, with real meta tags baked in at build time,
// that redirects a human visitor into the SPA — blog links point here (see
// app.js) so copying/sharing a link grabs this URL instead of the bare hash.
function writeBlogStub(post) {
  const title = escapeHtml(post.title);
  // extractDescription pulls from post.html, which marked already
  // HTML-escaped when it was rendered — escaping it again here would
  // double-encode entities (e.g. "&#39;" becoming "&amp;#39;")
  const description = extractDescription(post.html);
  const image = extractFirstImage(post.html);
  const hashUrl = `/#blog/${post.slug}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title} · stelle.codes</title>
    <meta name="description" content="${description}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="stelle.codes" />
    <meta property="og:url" content="${SITE_URL}/blog/${post.slug}.html" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />

    <meta http-equiv="refresh" content="0; url=${hashUrl}" />
    <script>location.replace(${JSON.stringify(hashUrl)});</script>
  </head>
  <body>
    <p>Redirecting to <a href="${hashUrl}">${title}</a>&hellip;</p>
  </body>
</html>
`;

  fs.mkdirSync("blog", { recursive: true });
  fs.writeFileSync(path.join("blog", `${post.slug}.html`), html);
}

const postsDir = "posts";
const postFiles = fs.existsSync(postsDir)
  ? fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"))
  : [];

const posts = postFiles.map((filename) => {
  const raw = fs
    .readFileSync(path.join(postsDir, filename), "utf8")
    .replace(/\r\n/g, "\n");
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`${filename}: missing --- frontmatter block`);
  }
  const [, frontmatterBlock, body] = match;
  const { title, date, draft } = parseFrontmatter(frontmatterBlock);

  const html = wrapCaptionedImages(
    marked.parse(body).replace(/src="images\//g, 'src="/posts/images/'),
  );

  return {
    slug: filename.replace(/\.md$/, ""),
    title,
    date,
    draft: draft === "true",
    readingMinutes: estimateReadingMinutes(html),
    html,
  };
});

posts.sort((a, b) => (a.date < b.date ? 1 : -1));
posts.forEach(writeBlogStub);

fs.writeFileSync("posts.json", JSON.stringify(posts) + "\n");
const draftCount = posts.filter((p) => p.draft).length;
console.log(
  `wrote posts.json: ${posts.length} post(s), ${draftCount} unlisted draft(s)`,
);
console.log(`wrote ${posts.length} blog/*.html preview stub(s)`);
