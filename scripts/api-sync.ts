// Copies the backend's OpenAPI file into this repo and records which backend commit it came from.
// `BACKEND_REPO` defaults to the sibling checkout `../minder-pass`; set it to use another (a worktree).
import { execSync } from "node:child_process";
import { copyFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(process.env.BACKEND_REPO ?? "../minder-pass");
copyFileSync(resolve(repo, "openapi.json"), resolve("api/openapi.json"));
const commit = execSync("git rev-parse --short HEAD", { cwd: repo })
  .toString()
  .trim();
const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repo })
  .toString()
  .trim();
const dirty = execSync("git status --porcelain -- openapi.json app", {
  cwd: repo,
})
  .toString()
  .trim()
  ? " (uncommitted changes)"
  : "";
writeFileSync(resolve("api/SOURCE"), `backend ${branch} @ ${commit}${dirty}\n`);
console.log(`api/openapi.json from ${repo} (${branch} @ ${commit}${dirty})`);
