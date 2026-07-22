// Writes commit.json with the SHA of the commit being deployed.
// On Vercel, VERCEL_GIT_COMMIT_SHA is the exact deployed commit; locally we
// fall back to the current git HEAD so the footer works in dev too.
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

// Parses every posts/*.md file (---frontmatter--- + markdown body) into
// posts.json: [{ slug, title, date, readingMinutes, html }], newest first.
// Dropping a new .md file in posts/ is the entire authoring workflow — this
// is the only place that needs to know how a post is structured.
const WORDS_PER_MINUTE = 200;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function parseFrontmatter(block) {
  const fields = {};
  for (const line of block.split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fields;
}

// Approximates reading time from the rendered HTML rather than the raw
// markdown, so link/image syntax and URLs don't inflate the word count.
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
  // normalize CRLF -> LF so the frontmatter regex works regardless of the
  // authoring OS's line endings
  const raw = fs
    .readFileSync(path.join(postsDir, filename), "utf8")
    .replace(/\r\n/g, "\n");
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`${filename}: missing --- frontmatter block`);
  }
  const [, frontmatterBlock, body] = match;
  const { title, date } = parseFrontmatter(frontmatterBlock);

  // posts reference images as "images/foo.png" (relative to the post file);
  // rewrite those to the actual served path once rendered to HTML.
  const html = marked
    .parse(body)
    .replace(/src="images\//g, 'src="/posts/images/');

  return {
    slug: filename.replace(/\.md$/, ""),
    title,
    date,
    readingMinutes: estimateReadingMinutes(html),
    html,
  };
});

posts.sort((a, b) => (a.date < b.date ? 1 : -1));

fs.writeFileSync("posts.json", JSON.stringify(posts) + "\n");
console.log(`wrote posts.json: ${posts.length} post(s)`);
