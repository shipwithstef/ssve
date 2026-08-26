#!/bin/bash
# validate-swarm-signatures.sh — JCS vectors, DSSE verify/tamper/wrong-key rejection,
# two-stage receipt binding, and trust-registry key policy (expiry/revocation).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d /tmp/svc-swarm-sig-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL(validate-swarm-signatures): $1" >&2; exit 1; }

node --check "$ROOT/scripts/lib/swarm-canonical-json.mjs" || fail "canonical-json syntax"
node --check "$ROOT/scripts/lib/swarm-signing.mjs" || fail "signing syntax"

# 1. JCS conformance vectors (byte stability under key permutation)
node --input-type=module - "$TMP" <<'JS' || fail "JCS vector failure"
import fs from "node:fs";
{
  const m = await import(new URL("file://" + process.cwd() + "/scripts/lib/swarm-canonical-json.mjs").href);
  const result = m.runVectors();
  if (!result.ok) { console.error(result.failures.join("; ")); process.exit(1); }
  // explicit byte-stability probe: deep key reordering
  const a = { z: { y: 2, a: [3, 1] }, b: "x" };
  const b = { b: "x", z: { a: [3, 1], y: 2 } };
  if (m.jcs(a) !== m.jcs(b)) process.exit(1);
  // canonical digest stability
  if (m.canonicalDigest(a) !== m.canonicalDigest(b)) process.exit(1);
  fs.writeFileSync(process.argv[2] + "/jcs-ok", "1");
  process.exit(0);
}
JS
[[ -f "$TMP/jcs-ok" ]] || fail "JCS vectors did not pass"

# 2. DSSE envelope: verify, byte-flip tamper, wrong-key, PAE byte-length property
node --input-type=module - "$TMP" <<'JS' || fail "DSSE behavior failure"
import fs from "node:fs";
const signing = await import(new URL("file://" + process.cwd() + "/scripts/lib/swarm-signing.mjs").href);
const kp = signing.generateKeyPair();
const other = signing.generateKeyPair();
const payload = {
  schema_version: 1, receipt_kind: "acceptance_receipt", verdict: "ACCEPTED",
  run_id: "r", actor_principal: "p", signer_principal: "svc-swarm-coordinator",
  authority_generation: 0, coordinator_epoch: 1, sequence_before: 1, sequence_after: 2,
  reason_code: "ok", issued_at: "2026-08-25T00:00:00.000Z",
};
const env = signing.signReceipt(kp.private_key, payload);
const ok = signing.verifyEnvelope(kp.public_key, env);
if (!ok.verified) process.exit(1);
// non-ASCII payload must sign/verify across byte-length PAE
const unicode = signing.signReceipt(kp.private_key, { msg: "é漢字\u0001" });
if (!signing.verifyEnvelope(kp.public_key, unicode).verified) process.exit(1);
// byte flip rejected
const tampered = JSON.parse(JSON.stringify(env));
const buf = Buffer.from(tampered.payload, "base64"); buf[buf.length - 1] ^= 0x01; tampered.payload = buf.toString("base64");
if (signing.verifyEnvelope(kp.public_key, tampered).verified) process.exit(1);
// wrong key rejected
if (signing.verifyEnvelope(other.public_key, env).verified) process.exit(1);
// determinism: same payload + same key -> identical signature bytes
const again = signing.signReceipt(kp.private_key, payload);
if (again.signatures[0].sig !== env.signatures[0].sig) process.exit(1);
fs.writeFileSync(process.argv[2] + "/dsse-ok", "1");
process.exit(0);
JS
[[ -f "$TMP/dsse-ok" ]] || fail "DSSE checks did not pass"

# key-policy enforcement (EXEC-R2-003): expired / not-yet-valid / revoked keys and
# wrong-purpose envelopes must fail closed against live commands.
node --input-type=module - "$TMP" <<'JS' || fail "key-policy probe failed"
import fs from "node:fs";
const handler = await import(new URL("file://" + process.cwd() + "/scripts/lib/swarm-command-handler.mjs").href);
const root = process.argv[2] + "/keystate";
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
handler.initStateRoot(root);
const coord = new handler.SwarmCoordinator(root, { worktreeRoot: null });
coord.provisionAdapter("expired1", { host: "codex", expiresAt: new Date(Date.now() - 3600_000).toISOString() });
coord.provisionAdapter("future1", { host: "grok" });
// backdate valid_from to the future for the not-yet-valid case
{
  const registry = coord.registry();
  registry.keys.find(k => k.principal_id === "future1").valid_from = new Date(Date.now() + 3600_000).toISOString();
  coord.signAndPersistRegistry(registry);
}
const mk = (principal, type, seq, extra = {}) => ({
  schema_version: 1,
  command_id: "018f0000-0000-7000-8000-" + String(seq).padStart(12, "0"),
  run_id: "kr", command_type: type, task_id: null,
  actor: { principal_id: principal, host: "codex", model_family: "fam", session_id: "s" },
  authority_generation: 0, expected_sequence: seq, idempotency_key: `kp-${principal}-${seq}`,
  payload: extra,
});
const keyOf = (p) => JSON.parse(fs.readFileSync(root + "/keys/" + p + ".json", "utf8")).private_key;
const env1 = coord.constructor.envelopeForCommand(mk("expired1", "register_session", 0), keyOf("expired1"));
const r1 = coord.handleEnvelope(env1);
if (r1.accepted) process.exit(1);
if (r1.reason_code !== "key_expired") { console.error("want key_expired got", r1.reason_code); process.exit(1); }
const env2 = coord.constructor.envelopeForCommand(mk("future1", "register_session", 0), keyOf("future1"));
const r2 = coord.handleEnvelope(env2);
if (r2.reason_code !== "key_not_valid") { console.error("want key_not_valid got", r2.reason_code); process.exit(1); }
// revoked key: register a fresh principal, then revoke before next command
coord.provisionAdapter("victim", { host: "cursor" });
const victimReg = mk("victim", "register_session", 0);
victimReg.actor.host = "cursor"; // claim matches its own pin
if (!coord.handleEnvelope(coord.constructor.envelopeForCommand(victimReg, keyOf("victim"))).accepted) process.exit(1);
coord.revoke("victim", 2);
const afterRevoke = coord.constructor.envelopeForCommand(
  { ...mk("victim", "ack_state", 2, { acknowledged_through: 2 }), idempotency_key: "kp-victim-ack" }, keyOf("victim"));
const r3 = coord.handleEnvelope(afterRevoke);
if (r3.reason_code !== "key_revoked") { console.error("want key_revoked got", r3.receipt?.payload?.reason_code ?? r3.reason_code); process.exit(1); }
// operator-pinned identity: row pins host=cursor; a codex claim must be refused
coord.provisionAdapter("pinned", { host: "cursor" });
const pinCmd = mk("pinned", "register_session", 1);
pinCmd.actor.host = "codex";
pinCmd.idempotency_key = "kp-pinned-1";
const r4 = coord.handleEnvelope(coord.constructor.envelopeForCommand(pinCmd, keyOf("pinned")));
if (r4.reason_code !== "actor_binding_mismatch") { console.error("want actor_binding_mismatch got", r4.reason_code); process.exit(1); }
process.exit(0);
JS

# EXEC-R4-003 boundary: a key revoked_at_sequence=N cannot author EVENT N.
node --input-type=module - "$TMP" <<'JS' || fail "revocation boundary probe failed"
import fs from "node:fs";
const handler = await import(new URL("file://" + process.cwd() + "/scripts/lib/swarm-command-handler.mjs").href);
const root = process.argv[2] + "/boundarystate";
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
handler.initStateRoot(root);
const coord = new handler.SwarmCoordinator(root);
coord.provisionAdapter("bw", { host: "codex" });
const key = JSON.parse(fs.readFileSync(root + "/keys/bw.json", "utf8")).private_key;
let n = 0;
const mk = (type, seq, extra = {}) => ({
  schema_version: 1, command_id: "018f0000-0000-7000-8000-" + String(++n).padStart(12, "0"),
  run_id: "br", command_type: type, task_id: null,
  actor: { principal_id: "bw", host: "codex", model_family: "fam", session_id: "bs" },
  authority_generation: 0, expected_sequence: seq, idempotency_key: `bk-${n}`, payload: extra,
});
if (!coord.handleEnvelope(coord.constructor.envelopeForCommand(mk("register_session", 0), key)).accepted) process.exit(1);
coord.revoke("bw", 2); // next event would be sequence 2
const atBoundary = coord.handleEnvelope(coord.constructor.envelopeForCommand(
  mk("ack_state", 1, { acknowledged_through: 1 }), key));
// proposed event sequence = state.sequence + 1 = 2 >= revoked_at_sequence -> denied
if (atBoundary.reason_code !== "key_revoked") { console.error("want key_revoked at boundary got", atBoundary.reason_code); process.exit(1); }
process.exit(0);
JS

echo "PASS(validate-swarm-signatures): JCS vectors, DSSE verify/tamper/wrong-key/determinism, unicode PAE, key-policy expiry/validity-window/revocation/binding/boundary verified"
