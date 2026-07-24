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

fs.writeFileSync("posts.json", JSON.stringify(posts) + "\n");
const draftCount = posts.filter((p) => p.draft).length;
console.log(
  `wrote posts.json: ${posts.length} post(s), ${draftCount} unlisted draft(s)`,
);
