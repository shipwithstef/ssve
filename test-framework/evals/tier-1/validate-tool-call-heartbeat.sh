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

// EXTREV-EXEC-004: expired or unreadable expiry is never resurrected by renewal
const leaseFileOf2 = (repoIdX, wiX) => path.join(stateRoot, "leases", crypto.createHash("sha256").update(`${repoIdX}\0${wiX}`).digest("hex") + ".json");
const rebootstrap = () => auth.bootstrapController({ stateRoot, repoId, wi: "WI-T04B", worktreeRoot: worktree, principal: a, ttlMs: 60_000 });
{
  const l = rebootstrap();
  const p = leaseFileOf2(repoId, "WI-T04B");
  fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), expires_at: new Date(Date.now() - 1_000).toISOString() }));
  const before = fs.readFileSync(p, "utf8");
  const result = auth.renewControllerIfCurrent({
    stateRoot, repoId, wi: "WI-T04B", worktreeRoot: worktree,
    principal: a, leaseId: l.lease_id, generation: l.generation,
  });
  assert.equal(result.status, "not_renewable", "expired-active lease is not renewed");
  assert.match(result.reason || "", /expired/);
  assert.equal(before, fs.readFileSync(p, "utf8"), "expired lease bytes unchanged");
}
{
  const l = auth.bootstrapController({ stateRoot, repoId, wi: "WI-T04C", worktreeRoot: worktree, principal: a, ttlMs: 60_000 });
  const p = leaseFileOf2(repoId, "WI-T04C");
  fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), expires_at: "not-a-timestamp" }));
  const before = fs.readFileSync(p, "utf8");
  const result = auth.renewControllerIfCurrent({
    stateRoot, repoId, wi: "WI-T04C", worktreeRoot: worktree,
    principal: a, leaseId: l.lease_id, generation: l.generation,
  });
  // EXTREV-EXEC-004: an unreadable expiry refuses as not_renewable before any
  // write — renewal can never guess its way past a corrupt expiry.
  assert.equal(result.status, "not_renewable", "malformed expiry is refused");
  assert.match(result.reason || "", /malformed/);
  assert.equal(before, fs.readFileSync(p, "utf8"), "corrupt-expiry lease bytes unchanged");
}
console.log(`ok - ${9} authority-store renewal checks`);
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
// EXTREV-EXEC-001: real host shapes — the receipt stores the digest of the
// exact execution input, and the PostToolUse payload ECHOES that input as
// tool_input; the heartbeat recomputes the digest itself.
const COMMAND = `node -e "process.stdout.write('authorized-mutation')"`;
const { canonicalOriginalDigest } = receiptsMod;
const digest = canonicalOriginalDigest(COMMAND);
receiptsMod.writeToolCallReceipt({
  session_id: sid, tool_use_id: tuid, host: "codex", original_digest: digest,
  classification: "mutation",
  lease: { repo_id: repoId, wi: "WI-HB", worktree_root: worktree, principal, lease_id: lease.lease_id, generation: lease.generation },
  env: process.env,
});

let r = drive({ session_id: sid, tool_use_id: tuid, host: "codex", tool_input: { command: COMMAND }, tool_response: { success: true } });
assert.equal(r.status, 0);
if (!/renewed/.test(r.stdout + "")) console.error("DRIVE_DEBUG stdout:", r.stdout, "stderr:", r.stderr);
assert.match(r.stdout + "", /renewed/, "successful correlated call renews the due lease");
const after = JSON.parse(fs.readFileSync(dueLeasePath, "utf8"));
assert.equal(after.lease_id, lease.lease_id, "heartbeat renews the same lease id");
assert.equal(after.generation, lease.generation, "heartbeat does not change generation");
assert.ok(Date.parse(after.expires_at) > Date.parse(lease.expires_at));

// replay: second identical success is a no-op — receipt was claimed once
r = drive({ session_id: sid, tool_use_id: tuid, host: "codex", tool_input: { command: COMMAND }, tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \(receipt_(missing|replayed)\)/, "replay is a typed no-op");

// mismatched execution input: echoed command differing from the authorized
// bytes can never correlate
receiptsMod.writeToolCallReceipt({ session_id: sid, tool_use_id: "t2", host: "codex", original_digest: canonicalOriginalDigest("echo a"), classification: "mutation", env: process.env });
r = drive({ session_id: sid, tool_use_id: "t2", host: "codex", tool_input: { command: "echo b" }, tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \(digest_mismatch\)/);

// EXTREV-EXEC-001: a mutation receipt with NO echoable input cannot skip the
// digest proof — absent digests are rejected, not ignored
receiptsMod.writeToolCallReceipt({ session_id: sid, tool_use_id: "t2b", host: "codex", original_digest: canonicalOriginalDigest("echo c"), classification: "mutation", env: process.env });
r = drive({ session_id: sid, tool_use_id: "t2b", host: "codex", tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \((digest_mismatch|digest_required)\)/);

r = drive({ session_id: sid, tool_use_id: "never-seen", host: "codex", tool_input: { command: COMMAND }, tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \(receipt_missing\)/);

// failed calls extend nothing AND invalidate their receipt (EXTREV-EXEC-002):
// a later forged success for the same identifiers finds nothing to consume
receiptsMod.writeToolCallReceipt({ session_id: sid, tool_use_id: "t3", host: "codex", original_digest: canonicalOriginalDigest(COMMAND), classification: "mutation",
  lease: { repo_id: repoId, wi: "WI-HB", worktree_root: worktree, principal, lease_id: lease.lease_id, generation: lease.generation }, env: process.env });
const preFail = JSON.parse(fs.readFileSync(dueLeasePath, "utf8"));
r = drive({ session_id: sid, tool_use_id: "t3", host: "codex", tool_input: { command: COMMAND }, tool_response: { success: false, error: "boom" } });
assert.doesNotMatch(r.stdout + "", /renewed/);
const postFail = JSON.parse(fs.readFileSync(dueLeasePath, "utf8"));
assert.equal(preFail.backend_revision, postFail.backend_revision, "failed call does not extend authority");
r = drive({ session_id: sid, tool_use_id: "t3", host: "codex", tool_input: { command: COMMAND }, tool_response: { success: true } });
assert.match(r.stdout + "", /no-op \(receipt_missing\)/, "failure invalidated the receipt for any later success");

// concurrent consumers of one live receipt: exactly one wins (claim-by-rename).
// EXTREV-EXEC-015: consumers must genuinely OVERLAP — both processes are
// spawned unwaited and synchronize on a shared start barrier file before
// touching the receipt.
receiptsMod.writeToolCallReceipt({ session_id: sid, tool_use_id: "t5", host: "codex", original_digest: canonicalOriginalDigest(COMMAND), classification: "mutation",
  lease: { repo_id: repoId, wi: "WI-HB", worktree_root: worktree, principal, lease_id: lease.lease_id, generation: lease.generation }, env: process.env });
{
  const { spawn } = await import("node:child_process");
  const barrier = path.join(runtime, "start-barrier");
  const payloadJson = JSON.stringify({ session_id: sid, tool_use_id: "t5", host: "codex", tool_input: { command: COMMAND }, tool_response: { success: true } });
  const outs = [0, 1].map((i) => new Promise((resolve) => {
    const child = spawn(process.execPath, [
      "-e",
      `
      const fs = require("fs");
      const barrier = process.argv[1], out = process.argv[2];
      // spin until the barrier file appears (both racers are now alive)
      while (!fs.existsSync(barrier)) {}
      let raw = "";
      process.stdin.on("data", (d) => (raw += d));
      process.stdin.on("end", () => {
        const req = JSON.parse(raw);
        import(process.argv[3]).then(async (hb) => {
          const payload = req;
          const digest = hb.canonicalOriginalDigest(payload.tool_input.command);
          const consumed = hb.consumeToolCallReceipt({
            session_id: payload.session_id, tool_use_id: payload.tool_use_id,
            host: payload.host, original_digest: digest, env: process.env,
          });
          fs.writeFileSync(out, JSON.stringify({ ok: consumed.ok, reason: consumed.reason || null }));
        });
      });
      `,
      barrier,
      path.join(runtime, `race-out-${i}.json`),
      path.join(root, "hooks/lib/tool-call-receipt.mjs"),
    ], { env: { ...process.env, SVC_RUNTIME_DIR: runtime } });
    child.stdin.write(payloadJson);
    child.stdin.end();
    child.on("close", () => resolve());
  }));
  fs.writeFileSync(barrier, "go");
  await Promise.all(outs);
  const results = [0, 1].map((i) => JSON.parse(fs.readFileSync(path.join(runtime, `race-out-${i}.json`), "utf8")));
  assert.equal(results.filter((r) => r.ok === true).length, 1, `exactly one overlapping consumer wins (${JSON.stringify(results)})`);
}

// generation handover invalidates stale pre receipts for renewal
receiptsMod.writeToolCallReceipt({
  session_id: sid, tool_use_id: "t4", host: "codex", original_digest: canonicalOriginalDigest(COMMAND), classification: "mutation",
  lease: { repo_id: repoId, wi: "WI-HB", worktree_root: worktree, principal, lease_id: lease.lease_id, generation: lease.generation },
  env: process.env,
});
auth.takeoverController({ stateRoot: hbStateRoot, repoId, wi: "WI-HB", principal: auth.principalId({ host: "codex", session_id: "session-other" }), expectedPrincipal: principal, expectedGeneration: lease.generation, reason: "handover drill", ttlMs: 300_000 });
r = drive({ session_id: sid, tool_use_id: "t4", host: "codex", tool_input: { command: COMMAND }, tool_response: { success: true } });
if (!/no-op \((stale_decision|not_renewable|not due or not current)\)/.test(r.stdout + "")) console.error("TAKEOVER_DEBUG stdout:", r.stdout, "stderr:", r.stderr);
assert.match(r.stdout + "", /no-op \((stale_decision|not_renewable|not due or not current)\)/, "stale-generation receipt cannot renew after takeover");

console.log("ok - heartbeat adapter correlation suite");
NODE
[[ $? -eq 0 ]] && ok "post-tool heartbeat: renew-once, replay/digest/generation no-ops, failure never extends" || bad "heartbeat adapter suite"

printf '\nT04 lease continuity + correlation: %s passed, %s failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
