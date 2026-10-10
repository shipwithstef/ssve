// git-query.mjs — per-process memo for read-only `git rev-parse` location queries.
//
// One PreToolUse decision asks git for the same --show-toplevel / --git-common-dir
// answers dozens of times across libraries (measured: 44 identical spawns, ~60% of
// the dispatcher's wall time). The memo is OFF unless a short-lived hook process
// calls enableGitQueryMemo(), so tests and long-running scripts that recreate
// repositories at the same path never see a stale answer. Only successful results
// are cached; a failing query throws every time, exactly like execFileSync.
// clearGitQueryMemo() must run after anything in the same process creates or
// removes a worktree. gitWorktreeList() additionally revalidates against the
// mtime of <common-dir>/worktrees, which changes whenever a worktree is added or
// pruned, and is only for callers that read the "worktree <path>" lines.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MEMOIZED = new Set(["--show-toplevel", "--git-common-dir"]);
const memo = new Map();
let enabled = false;

export function enableGitQueryMemo() { enabled = true; }
export function clearGitQueryMemo() { memo.clear(); }

// Same contract as execFileSync("git", ["-C", dir, "rev-parse", flag], options).
export function gitRevParse(dir, flag, options = { encoding: "utf8" }) {
  if (!MEMOIZED.has(flag)) throw new Error(`gitRevParse: unsupported flag ${flag}`);
  const key = `${dir}\0${flag}`;
  if (enabled && memo.has(key)) return memo.get(key);
  const value = execFileSync("git", ["-C", dir, "rev-parse", flag], { encoding: "utf8", ...options });
  if (enabled) memo.set(key, value);
  return value;
}

function worktreesStamp(dir) {
  const common = gitRevParse(dir, "--git-common-dir").trim();
  try { return fs.statSync(path.join(path.resolve(dir, common), "worktrees")).mtimeMs; } catch { return -1; }
}

// Same contract as execFileSync("git", ["-C", dir, "worktree", "list", "--porcelain"], options).
export function gitWorktreeList(dir, options = { encoding: "utf8" }) {
  const run = () => execFileSync("git", ["-C", dir, "worktree", "list", "--porcelain"], { encoding: "utf8", ...options });
  if (!enabled) return run();
  const key = `${dir}\0worktree-list`;
  const stamp = worktreesStamp(dir);
  const hit = memo.get(key);
  if (hit && hit.stamp === stamp) return hit.value;
  const value = run();
  memo.set(key, { stamp, value });
  return value;
}
