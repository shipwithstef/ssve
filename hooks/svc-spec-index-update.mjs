#!/usr/bin/env node
/**
 * svc-spec-index-update — PostToolUse hook
 *
 * Triggers incremental spec-index rebuild when an Edit/Write touches docs/specs/.
 * Best-effort: never blocks. Skips silently if the builder script or repo root
 * isn't found. Honors `rules/host-capability-research.md` — degrades gracefully
 * on hosts where stdin payload is missing or shaped differently.
 *
 * Source: proposals/done/2026-04-30-infra-project-support.md § 3.2 (Spine: spec-index)
 *         WI-SPINE-001 deliverable 3
 */

// Optional: a bundle without the counter simply does not count.
const { failOpen, failOpenAt } = await import("./lib/fail-open.mjs").catch(() => ({ failOpen() {}, failOpenAt() {} }));
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveOperationScope } from "./lib/operation-scope.mjs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function findRepoRoot(start) {
  let cur = start;
  for (let i = 0; i < 20; i++) {
    if (existsSync(resolve(cur, ".git")) || existsSync(resolve(cur, ".svc"))) return cur;
    const parent = resolve(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

(async () => {
  const raw = readStdin();
  if (!raw) process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    failOpen("svc-spec-index-update", error);
    process.exit(0);
  }
  if (typeof payload?.cwd === "string") failOpenAt({ cwd: payload.cwd });

  // Claude Code PostToolUse payload shape: { tool_input: { file_path }, ... }
  // Defensive: handle multiple shapes across hosts.
  const filePath =
    payload?.tool_input?.file_path ||
    payload?.tool_input?.path ||
    payload?.input?.file_path ||
    payload?.params?.file_path ||
    null;

  if (!filePath) process.exit(0);
  if (!filePath.includes("docs/specs/")) process.exit(0);
  if (!filePath.endsWith(".md")) process.exit(0);

  const host = String(payload.host || process.env.SVC_HOST ||
    (process.env.CLAUDE_PROJECT_DIR ? "claude" : (process.env.CODEX_SESSION_ID ? "codex" : ""))).toLowerCase();
  let operationRoot = process.cwd();
  if (host === "codex") {
    const scope = resolveOperationScope({ ...payload, host: "codex" }, { host: "codex", env: process.env });
    if (!scope.ok) process.exit(0);
    operationRoot = scope.operation_repository?.worktree_root || scope.operation_cwd || operationRoot;
  }
  const repoRoot = findRepoRoot(operationRoot);
  if (!repoRoot) process.exit(0);

  const builder = resolve(repoRoot, "scripts/build-spec-index.mjs");
  if (!existsSync(builder)) process.exit(0);

  // Best-effort incremental update. Suppress all output unless it errors.
  failOpenAt({ root: repoRoot });
  const built = spawnSync("node", [builder, "--incremental", filePath], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 5000
  });
  // A spawn error (including the timeout), a signal or a non-zero exit means the index
  // was not updated; the hook still allows the edit, so it is counted.
  if (built.error || built.signal || built.status !== 0) {
    failOpen("svc-spec-index-update", built.error || { name: built.signal ? `Signal${built.signal}` : `Exit${built.status}` });
  }

  process.exit(0);
})().catch((error) => { failOpen("svc-spec-index-update", error); process.exit(0); });
