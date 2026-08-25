#!/usr/bin/env bash
# WI-FW-HOOKS-SAFETY-01 T04/AC-4/AC-5: bounded lease continuity + replay-safe
# post-tool correlation. Hermetic (temp dirs, no network, no LLM).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODULE="$ROOT/hooks/lib/authority-store.mjs"
RECEIPTS="$ROOT/hooks/lib/tool-call-receipt.mjs"
HEARTBEAT="$ROOT/hooks/codex/svc-codex-posttool-heartbeat.mjs"
for f in "$MODULE" "$RECEIPTS" "$HEARTBEAT"; do
  [[ -f "$f" ]] || { echo "T04-RED: missing $f"; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf 'ok - %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL - %s\n' "$1"; }

node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [root, tmp] = process.argv.slice(2);
process.env.NODE_ENV = "test";
const auth = await import(pathToFileURL(path.join(root, "hooks/lib/authority-store.mjs")));

const stateRoot = path.join(tmp, "authority");
const worktree = path.join(tmp, "worktree");
fs.mkdirSync(worktree, { recursive: true });
execFileSync("git", ["-C", worktree, "init", "-q"]);
execFileSync("git", ["-C", worktree, "config", "user.name", "fixture"]);
execFileSync("git", ["-C", worktree, "config", "user.email", "fixture@example.test"]);
fs.writeFileSync(path.join(worktree, "README.md"), "fixture\n");
execFileSync("git", ["-C", worktree, "add", "README.md"]);
execFileSync("git", ["-C", worktree, "commit", "-qm", "fixture"]);
const repoId = auth.repositoryId(worktree);
const a = auth.principalId({ host: "codex", session_id: "session-a" });
const b = auth.principalId({ host: "codex", session_id: "session-b" });

// exact renewal preserves lease id + generation and advances expiry only
const lease = auth.bootstrapController({ stateRoot, repoId, wi: "WI-T04", worktreeRoot: worktree, principal: a, ttlMs: 24 * 3_600_000 });
assert.equal(auth.renewalDue(lease), false, "fresh long lease is not due");
const soonExpiring = { ...lease, expires_at: new Date(Date.now() + 4 * 60_000).toISOString(), renewed_at: new Date(Date.now() - 10 * 60_000).toISOString() };
assert.equal(auth.renewalDue(soonExpiring), true, "lease inside the safety window is due");
assert.equal(auth.renewalDue(soonExpiring, { timeoutMs: 600_000 }), true, "tool timeout raises the threshold");
const rateLimited = { ...soonExpiring, renewed_at: new Date().toISOString() };
assert.equal(auth.renewalDue(rateLimited), false, "min interval rate-limits non-urgent renewal writes");
const emergency = { ...rateLimited, expires_at: new Date(Date.now() + 30_000).toISOString() };
assert.equal(auth.renewalDue(emergency), true, "emergency remaining life bypasses the limiter");

const renewed = auth.renewControllerIfCurrent({
  stateRoot, repoId, wi: "WI-T04", worktreeRoot: worktree,
  principal: a, leaseId: lease.lease_id, generation: lease.generation,
});
assert.equal(renewed.status, "renewed");
assert.equal(renewed.lease.lease_id, lease.lease_id, "renewal preserves the lease id");
assert.equal(renewed.lease.generation, lease.generation, "renewal preserves the generation");
assert.ok(Date.parse(renewed.lease.expires_at) > Date.parse(lease.expires_at), "expiry advances");

// stale decisions write nothing: wrong principal / generation / lease id / released
for (const [label, args] of [
  ["foreign principal", { principal: b }],
  ["old generation", { generation: lease.generation + 5 }],
  ["wrong lease id", { leaseId: "not-the-current-lease" }],
]) {
  const leaseFileOf = (repoIdX, wiX) => path.join(stateRoot, "leases", crypto.createHash("sha256").update(`${repoIdX}\0${wiX}`).digest("hex") + ".json");
  const before = fs.readFileSync(leaseFileOf(repoId, "WI-T04"), "utf8");
  const result = auth.renewControllerIfCurrent({
    stateRoot, repoId, wi: "WI-T04", worktreeRoot: worktree,
    principal: a, leaseId: lease.lease_id, generation: lease.generation, ...args,
  });
  assert.equal(result.status, "stale_decision", `${label} yields typed stale_decision`);
  const after = fs.readFileSync(leaseFileOf(repoId, "WI-T04"), "utf8");
  assert.equal(before, after, `${label} writes nothing`);
}

// released authority is never renewable
auth.releaseController({ stateRoot, repoId, wi: "WI-T04", principal: a });
const released = auth.renewControllerIfCurrent({
  stateRoot, repoId, wi: "WI-T04", worktreeRoot: worktree,
  principal: a, leaseId: lease.lease_id, generation: lease.generation,
});
assert.equal(released.status, "not_renewable");
console.log(`ok - ${7} authority-store renewal checks`);
NODE
[[ $? -eq 0 ]] && ok "authority-store: exact renewal, thresholds, stale no-write, non-renewable release" || bad "authority-store renewal suite"

# --- heartbeat adapter: success/replay/expiry/mismatch/generation handover ----
node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const [root, tmp] = process.argv.slice(2);
process.env.NODE_ENV = "test";
const crypto2 = await import("node:crypto");
const receiptsMod = await import(pathToFileURL(path.join(root, "hooks/lib/tool-call-receipt.mjs")));
const auth = await import(pathToFileURL(path.join(root, "hooks/lib/authority-store.mjs")));
const runtime = path.join(tmp, "hb-runtime"); fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
process.env.SVC_RUNTIME_DIR = runtime;

function drive(payload, env = {}) {
  return spawnSync(process.execPath, [path.join(root, "hooks/codex/svc-codex-posttool-heartbeat.mjs")], {
    input: JSON.stringify(payload), encoding: "utf8",
    env: { ...process.env, SVC_RUNTIME_DIR: runtime, ...env },
  });
}

// controller lease to correlate against
const worktree = path.join(tmp, "wt-hb");
fs.mkdirSync(worktree, { recursive: true });
execFileSync("git", ["-C", worktree, "init", "-q"]);
const repoId = auth.repositoryId(worktree);
const principal = auth.principalId({ host: "codex", session_id: "session-hb" });
const hbStateRoot = auth.authorityStateRoot(worktree, process.env);
const lease = auth.bootstrapController({ stateRoot: hbStateRoot, repoId, wi: "WI-HB", worktreeRoot: worktree, principal: auth.principalId({ host: "codex", session_id: "session-hb" }), ttlMs: 30_000 });
// make it due so a successful heartbeat actually renews
const dueLeaseKey = crypto2.createHash("sha256").update(`${repoId}\0WI-HB`).digest("hex");
const dueLeasePath = path.join(hbStateRoot, "leases", `${dueLeaseKey}.json`);
fs.writeFileSync(dueLeasePath, JSON.stringify({ ...JSON.parse(fs.readFileSync(dueLeasePath, "utf8")), expires_at: new Date(Date.now() + 10_000).toISOString(), renewed_at: new Date(Date.now() - 10 * 60_000).toISOString() }));

const sid = "session-hb";
const tuid = "tool-use-1";
const digest = "sha256:" + "a".repeat(64);
receiptsMod.writeToolCallReceipt({
  session_id: sid, tool_use_id: tuid, host: "codex", original_digest: digest,
  classification: "mutation",
  lease: { repo_id: repoId, wi: "WI-HB", worktree_root: worktree, principal, lease_id: lease.lease_id, generation: lease.generation },
  env: process.env,
});

let r = drive({ session_id: sid, tool_use_id: tuid, host: "codex", original_digest: digest, tool_response: { success: true } });
assert.equal(r.status, 0);
if (!/renewed/.test(r.stdout + "")) console.error("DRIVE_DEBUG stdout:", r.stdout, "stderr:", r.stderr, "receipt:", fs.existsSync(receiptsMod.receiptsRoot(process.env)) ? "exists" : "none");
assert.match(r.stdout + "", /renewed/, "successful correlated call renews the due lease");
const after = JSON.parse(fs.readFileSync(dueLeasePath, "utf8"));
assert.equal(after.lease_id, lease.lease_id, "heartbeat renews the same lease id");
assert.equal(after.generation, lease.generation, "heartbeat does not change generation");
assert.ok(Date.parse(after.expires_at) > Date.parse(lease.expires_at));

// replay: second identical success is a no-op — receipt was one-time
r = drive({ session_id: sid, tool_use_id: tuid, host: "codex", original_digest: digest, tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \(receipt_(missing|replayed)\)/, "replay is a typed no-op");

// mismatched digest / unknown receipt: no-op, never authorization
receiptsMod.writeToolCallReceipt({ session_id: sid, tool_use_id: "t2", host: "codex", original_digest: "sha256:" + "b".repeat(64), env: process.env });
r = drive({ session_id: sid, tool_use_id: "t2", host: "codex", original_digest: "sha256:" + "c".repeat(64), tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \(digest_mismatch\)/);

r = drive({ session_id: sid, tool_use_id: "never-seen", host: "codex", original_digest: digest, tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \(receipt_missing\)/);

// failed calls extend nothing even with a valid live receipt
receiptsMod.writeToolCallReceipt({ session_id: sid, tool_use_id: "t3", host: "codex", original_digest: digest, env: process.env });
const preFail = JSON.parse(fs.readFileSync(dueLeasePath, "utf8"));
r = drive({ session_id: sid, tool_use_id: "t3", host: "codex", original_digest: digest, tool_response: { success: false, error: "boom" } });
assert.doesNotMatch(r.stdout + "", /renewed/);
const postFail = JSON.parse(fs.readFileSync(dueLeasePath, "utf8"));
assert.equal(preFail.backend_revision, postFail.backend_revision, "failed call does not extend authority");

// generation handover invalidates stale pre receipts for renewal
receiptsMod.writeToolCallReceipt({
  session_id: sid, tool_use_id: "t4", host: "codex", original_digest: digest,
  lease: { repo_id: repoId, wi: "WI-HB", worktree_root: worktree, principal, lease_id: lease.lease_id, generation: lease.generation },
  env: process.env,
});
auth.takeoverController({ stateRoot: hbStateRoot, repoId, wi: "WI-HB", principal: auth.principalId({ host: "codex", session_id: "session-other" }), expectedPrincipal: principal, expectedGeneration: lease.generation, reason: "handover drill", ttlMs: 300_000 });
r = drive({ session_id: sid, tool_use_id: "t4", host: "codex", original_digest: digest, tool_response: { success: true } });
if (!/no-op \((stale_decision|not_renewable|not due or not current)\)/.test(r.stdout + "")) console.error("TAKEOVER_DEBUG stdout:", r.stdout, "stderr:", r.stderr);
assert.match(r.stdout + "", /no-op \((stale_decision|not_renewable|not due or not current)\)/, "stale-generation receipt cannot renew after takeover");

console.log("ok - heartbeat adapter correlation suite");
NODE
[[ $? -eq 0 ]] && ok "post-tool heartbeat: renew-once, replay/digest/generation no-ops, failure never extends" || bad "heartbeat adapter suite"

printf '\nT04 lease continuity + correlation: %s passed, %s failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
