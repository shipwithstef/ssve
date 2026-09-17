#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseHookInput, hookContext, authorityPath, readJson, bindingFor } from "./lib/codex-hook-context.mjs";
import { isClaimStale } from "../lib/wi-claim.mjs";
import { WI_ID_RE } from "../lib/wi-id.mjs";

function allow() { process.stdout.write("{}\n"); }

function claimIsProvablyStale(claim) {
  if (!claim || typeof claim !== "object") return false;
  const started = Date.parse(claim.started_at);
  if (!Number.isFinite(started)) return false;
  return isClaimStale(claim);
}

function claimPathFor(repoRoot, target) {
  const configured = process.env.SVC_CODEX_CLAIMS_DIR;
  if (!configured) return path.join(repoRoot, ".svc", "claims", `${target}.claim.json`);
  const claimsDir = path.resolve(configured);
  if (!claimsDir.startsWith(`${repoRoot}${path.sep}`) && process.env.SVC_CODEX_TEST_MODE !== "1") throw new Error("claims directory escapes repository");
  return path.join(claimsDir, `${target}.claim.json`);
}

const raw = fs.readFileSync(0, "utf8");
const payload = parseHookInput(raw);
let ctx;
try { ctx = hookContext(payload); } catch { allow(); process.exit(0); }
if (!ctx.repo_root || !ctx.session_id || !ctx.turn_id || !ctx.session_dir) { allow(); process.exit(0); }
const authority = readJson(authorityPath(ctx));
const ttlMs = Math.max(1, Number(process.env.SVC_CODEX_AUTHORITY_TTL_MIN || 1440)) * 60_000;
const authorityTime = Date.parse(authority?.recorded_at);
if (!authority || authority.session_id !== ctx.session_id || authority.turn_id !== ctx.turn_id || authority.cwd !== ctx.cwd || authority.repo_root !== ctx.repo_root || !Number.isFinite(authorityTime) || Date.now() - authorityTime > ttlMs) { allow(); process.exit(0); }
if (!new Set(["continue", "resume", "end_to_end"]).has(authority.continuation_intent)) { allow(); process.exit(0); }
const governanceWorktree = authority.governance_worktree || ctx.governance_worktree || ctx.repo_root;
try {
  if (fs.realpathSync(governanceWorktree) !== fs.realpathSync(authority.governance_worktree || governanceWorktree)) { allow(); process.exit(0); }
  // A lifecycle authority record may only be consumed against the same exact
  // authoritative child binding currently visible to Stop.  The recorded child
  // path is advisory state, never a standalone mutation authority.
  if (authority.governance_worktree &&
      (!ctx.governance_worktree || fs.realpathSync(ctx.governance_worktree) !== fs.realpathSync(authority.governance_worktree))) {
    allow(); process.exit(0);
  }
} catch { allow(); process.exit(0); }
const binding = bindingFor(ctx.repo_root, ctx.session_id, ctx.turn_id, process.env);
const target = authority.explicit_wi || ((binding && Date.parse(binding.ts || binding.timestamp || 0) >= Date.parse(authority.recorded_at)) ? binding.wi : "");
if (!WI_ID_RE.test(String(target || ""))) { allow(); process.exit(0); }
try {
  const claimPath = claimPathFor(governanceWorktree, target);
  if (fs.existsSync(claimPath)) {
    const claim = JSON.parse(fs.readFileSync(claimPath, "utf8"));
    const owner = String(claim.session_token || claim.session || claim.session_id || "");
    const hasValidStart = Number.isFinite(Date.parse(claim.started_at));
    // An undecidable or unknown claim is protected. Stop may continue only
    // through a valid fresh same-session claim or a provably stale claim.
    if (!owner || !hasValidStart || (owner !== ctx.session_id && !claimIsProvablyStale(claim))) { allow(); process.exit(0); }
  }
} catch { allow(); process.exit(0); }
if (binding) {
  if (binding.repo_root && path.resolve(binding.repo_root) !== path.resolve(ctx.repo_root)) { allow(); process.exit(0); }
  if (binding.worktree && path.resolve(binding.worktree) !== path.resolve(governanceWorktree)) { allow(); process.exit(0); }
}
// WI-498 (G6-F006): the completion-guard SHELL SCRIPT is an executable resolved
// from THIS hook's own install dir (self-located), never from ctx.repo_root — a
// consumer-planted hooks/svc-task-completion-guard.sh would otherwise be bash-exec'd
// (ACE). The test-mode override remains for hermetic fixtures.
const guard = process.env.SVC_CODEX_TEST_MODE === "1" && process.env.SVC_CODEX_COMPLETION_GUARD
  ? path.resolve(process.env.SVC_CODEX_COMPLETION_GUARD)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "svc-task-completion-guard.sh");
const result = spawnSync("bash", [guard], { cwd: governanceWorktree, input: raw, encoding: "utf8", env: { ...process.env, SVC_WORKER_WI: target, CODEX_SESSION_ID: ctx.session_id, SVC_GOVERNANCE_WORKTREE: governanceWorktree } });
if (result.status !== 0 || !result.stdout?.trim()) { allow(); process.exit(0); }
try {
  const output = JSON.parse(result.stdout.trim());
  const text = JSON.stringify(output);
  if (!text.includes(target) && output.decision === "block") { allow(); process.exit(0); }
  process.stdout.write(`${JSON.stringify(output)}\n`);
} catch { allow(); }
