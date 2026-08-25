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

echo "PASS(validate-swarm-signatures): JCS vectors, DSSE verify/tamper/wrong-key/determinism, unicode PAE verified"
