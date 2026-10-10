#!/usr/bin/env node
/**
 * count-hook-git.mjs — count git subprocesses in one pre-edit decision.
 *
 *   node scripts/count-hook-git.mjs [--json]
 *
 * Runs the pretool dispatcher once on an Edit in a throwaway governed repository, with a
 * `git` shim first on PATH that logs each call before running the real git. Prints the
 * call count and the decision, so the claim "73 → 23 git spawns" stays checkable.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function countGitCalls() {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "svc-git-count-")));
  try {
    const repo = path.join(tmp, "repo"), home = path.join(tmp, "home"), shim = path.join(tmp, "bin"), log = path.join(tmp, "git.log");
    for (const d of [path.join(repo, ".svc"), path.join(repo, "src"), home, shim]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(repo, "src", "a.ts"), "export const a = 1;\n");
    execFileSync("git", ["init", "-q", repo]);
    execFileSync("git", ["-C", repo, "-c", "user.email=c@c", "-c", "user.name=c", "add", "-A"]);
    execFileSync("git", ["-C", repo, "-c", "user.email=c@c", "-c", "user.name=c", "commit", "-q", "-m", "c"]);
    const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    fs.writeFileSync(path.join(shim, "git"), `#!/bin/sh\necho "$*" >> '${log}'\nexec '${realGit}' "$@"\n`, { mode: 0o755 });
    const payload = { session_id: "count", hook_event_name: "PreToolUse", cwd: repo, tool_name: "Edit", tool_input: { file_path: path.join(repo, "src", "a.ts"), old_string: "1", new_string: "2" } };
    const env = { ...process.env, HOME: home, SVC_HOST: "claude", PATH: `${shim}${path.delimiter}${process.env.PATH}` };
    delete env.SVC_HOOK_MODE;
    const r = spawnSync(process.execPath, [path.join(ROOT, "hooks", "codex", "svc-codex-pretool-dispatcher.mjs")], { cwd: repo, env, input: JSON.stringify(payload), encoding: "utf8", timeout: 60000 });
    const calls = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
    let decision = "none";
    try { decision = JSON.parse(r.stdout.trim().split("\n").at(-1)).hookSpecificOutput?.permissionDecision || "none"; } catch {}
    return { git_calls: calls.length, decision };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

if (isMain(import.meta.url)) {
  const r = countGitCalls();
  process.stdout.write(process.argv.includes("--json") ? JSON.stringify(r) + "\n" : `git calls in one pre-edit decision: ${r.git_calls} (decision: ${r.decision})\n`);
}
