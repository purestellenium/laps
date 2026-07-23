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

let skippedDrafts = 0;

const posts = postFiles
  .map((filename) => {
    const raw = fs
      .readFileSync(path.join(postsDir, filename), "utf8")
      .replace(/\r\n/g, "\n");
    const match = raw.match(FRONTMATTER_RE);
    if (!match) {
      throw new Error(`${filename}: missing --- frontmatter block`);
    }
    const [, frontmatterBlock, body] = match;
    const { title, date, draft } = parseFrontmatter(frontmatterBlock);

    if (draft === "true") {
      skippedDrafts++;
      return null;
    }

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
  })
  .filter(Boolean);

posts.sort((a, b) => (a.date < b.date ? 1 : -1));

fs.writeFileSync("posts.json", JSON.stringify(posts) + "\n");
console.log(
  `wrote posts.json: ${posts.length} post(s), ${skippedDrafts} draft(s) skipped`,
);
