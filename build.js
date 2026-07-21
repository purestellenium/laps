// Writes commit.json with the SHA of the commit being deployed.
// On Vercel, VERCEL_GIT_COMMIT_SHA is the exact deployed commit; locally we
// fall back to the current git HEAD so the footer works in dev too.
const fs = require("fs");
const { execSync } = require("child_process");

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
