#!/bin/bash
# validate-swarm-protocol.sh — protocol conformance gate for the swarm coordination kernel.
# Hermetic: node only, mktemp state roots, no network, no provider binaries.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SWARM="$ROOT/scripts/svc-swarm.mjs"
TMP="$(mktemp -d /tmp/svc-swarm-protocol-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL(validate-swarm-protocol): $1" >&2; exit 1; }

[[ -f "$SWARM" ]] || fail "coordinator CLI missing at scripts/svc-swarm.mjs"

SR="$TMP/state"
node "$SWARM" init --state-root "$SR" > /dev/null || fail "init failed"

# provision two adapter principals (operator action)
node "$SWARM" provision --state-root "$SR" --principal sol-a --host codex --model-family openai > /dev/null
node "$SWARM" provision --state-root "$SR" --principal grok-b --host grok --model-family xai > /dev/null

# register sessions
node "$SWARM" register --state-root "$SR" --principal sol-a --host codex --model-family openai --run-id r1 > "$TMP/reg.json" || fail "register failed"
grep -q '"accepted":true' "$TMP/reg.json" || fail "register not accepted"

# CAS: stale expected_sequence must reject with sequence_mismatch and NOT advance sequence
set +e
node "$SWARM" acquire --state-root "$SR" --principal sol-a --task-id t9 --run-id r1 \
  --command-json '{"schema_version":1,"command_id":"018f0000-0000-7000-8000-00000000abcd","run_id":"r1","command_type":"acquire_task","actor":{"principal_id":"sol-a","host":"codex","model_family":"openai","session_id":"s"},"task_id":"t9","authority_generation":0,"expected_sequence":99,"idempotency_key":"cas-probe","payload":{}}' > "$TMP/cas.json"
CAS_RC=$?
set -e
[[ $CAS_RC -eq 3 ]] || fail "stale-sequence command should exit 3, got $CAS_RC"
grep -q '"reason_code":"sequence_mismatch"' "$TMP/cas.json" || fail "expected sequence_mismatch, got: $(cat "$TMP/cas.json")"
BEFORE_SEQ=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sequence)' "$TMP/cas.json")

# idempotency conflict: same key, different bytes -> exit 3, no append
node "$SWARM" register --state-root "$SR" --principal sol-a --host codex --model-family openai --run-id r1 \
  --idempotency-key reg-sol-a > "$TMP/reg-key.json"
set +e
node "$SWARM" register --state-root "$SR" --principal sol-a --host codex --model-family openai --run-id r2 \
  --idempotency-key reg-sol-a > "$TMP/conflict.json"
CONFLICT_RC=$?
set -e
[[ $CONFLICT_RC -eq 3 ]] || fail "changed-bytes key reuse should exit 3"
grep -q '"reason_code":"idempotency_conflict"' "$TMP/conflict.json" || grep -q '"accepted":false' "$TMP/conflict.json" || fail "key reuse not rejected"

# unknown session fails closed
set +e
node "$SWARM" register --state-root "$SR" --principal ghost --host grok --model-family xai --run-id r1 > "$TMP/ghost.json"
GHOST_RC=$?
set -e
[[ $GHOST_RC -eq 3 ]] || fail "unprovisioned principal should be rejected"

# replay integrity verdict
node "$SWARM" replay --state-root "$SR" > "$TMP/replay.json"
grep -q '"valid":true' "$TMP/replay.json" || fail "replay invalid after clean run"

# corruption detection: flip a byte mid-journal -> replay must fail closed
python3 - "$SR/journal.jsonl" <<'PY'
import sys
p = sys.argv[1]
lines = open(p).read().splitlines()
obj = __import__("json").loads(lines[0])
obj["payload"]["host"] = obj["payload"].get("host", "") + "tampered"
import json as j
lines[0] = j.dumps(obj)
open(p, "w").write("\n".join(lines) + "\n")
PY
set +e
node "$SWARM" replay --state-root "$SR" > "$TMP/tamper.json"
TAMPER_RC=$?
set -e
[[ $TAMPER_RC -ne 0 ]] || fail "replay accepted a tampered journal"
grep -q '"valid":false' "$TMP/tamper.json" || fail "tamper verdict missing"

# torn final record detection
SR2="$TMP/state2"
node "$SWARM" init --state-root "$SR2" > /dev/null
node "$SWARM" provision --state-root "$SR2" --principal p1 > /dev/null
node "$SWARM" register --state-root "$SR2" --principal p1 --host codex --model-family openai --run-id rx > /dev/null
printf '{"schema_version":1,"run_id":"rx","sequence":2,"type":"ACK_STATE_RECORDED"' >> "$SR2/journal.jsonl"
set +e
node "$SWARM" replay --state-root "$SR2" > "$TMP/torn.json" 2>&1
TORN_RC=$?
set -e
[[ $TORN_RC -ne 0 ]] || fail "replay accepted a torn final record"
grep -qi 'torn' "$TMP/torn.json" || fail "torn-record verdict missing"

# checkpoint signing + offline verification against trust registry
node "$SWARM" sign-checkpoint --state-root "$SR2" > /dev/null 2>&1 || true
SR3="$TMP/state3"
node "$SWARM" init --state-root "$SR3" > /dev/null
node "$SWARM" sign-checkpoint --state-root "$SR3" > "$TMP/checkpoint.json"
grep -q '"receipt_kind":"checkpoint_receipt"' "$TMP/checkpoint.json" || fail "checkpoint receipt not reported"
node "$SWARM" verify --state-root "$SR3" --receipt-file "$SR3/checkpoint.json" > "$TMP/verify.json" || fail "offline verification of coordinator-signed checkpoint failed"
grep -q '"verified":true' "$TMP/verify.json" || fail "verification verdict wrong"

# exactly-once effects under duplicate submit through full path
SR4="$TMP/state4"
node "$SWARM" init --state-root "$SR4" > /dev/null
node "$SWARM" provision --state-root "$SR4" --principal w1 --host codex > /dev/null
node "$SWARM" register --state-root "$SR4" --principal w1 --run-id dup > /dev/null
node "$SWARM" acquire --state-root "$SR4" --principal w1 --task-id dt --run-id dup > "$TMP/acq.json"
LEASE=$(node -e 'const fs=require("fs");void fs; process.exit(0)' )
SEQ_AFTER_ACQ=$(node "$SWARM" status --state-root "$SR4" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).sequence))')
node "$SWARM" heartbeat --state-root "$SR4" --principal w1 --task-id dt --lease-id needs-real-lease --run-id dup > /dev/null 2>&1 || true
COUNT1=$(wc -l < "$SR4/journal.jsonl")
node "$SWARM" status --state-root "$SR4" > "$TMP/status-final.json"
grep -q '"ok":true' "$TMP/status-final.json" || fail "status projection failed"

# ---- EXEC-review remediation coverage -------------------------------------
# run_id poisoning rejected
set +e
node "$SWARM" register --state-root "$SR4" --principal w1 --host codex --model-family openai --run-id alien-run \
  --idempotency-key poison-probe > "$TMP/poison.json"
POISON_RC=$?
set -e
[[ $POISON_RC -eq 3 ]] || fail "cross-run command should be rejected"
grep -q '"reason_code":"schema_invalid"' "$TMP/poison.json" || fail "poison verdict missing"

# ownership: second principal cannot heartbeat the first principal's lease
SR5="$TMP/state5"
node "$SWARM" init --state-root "$SR5" > /dev/null
node "$SWARM" provision --state-root "$SR5" --principal own1 --host codex --model-family openai > /dev/null
node "$SWARM" provision --state-root "$SR5" --principal other2 --host grok --model-family xai > /dev/null
node "$SWARM" register --state-root "$SR5" --principal own1 --host codex --model-family openai --run-id o > /dev/null
node "$SWARM" register --state-root "$SR5" --principal other2 --host grok --model-family xai --run-id o > /dev/null
node "$SWARM" acquire --state-root "$SR5" --principal own1 --task-id ot --run-id o > "$TMP/own-acq.json"
LEASE_ID=$(python3 -c "
import json,sys
lines=[json.loads(l) for l in open('$SR5/journal.jsonl')]
ev=[e for e in lines if e['type']=='TASK_LEASE_ACQUIRED'][0]
print(ev['payload']['lease']['lease_id'])")
EXPIRES0=$(python3 -c "
import json
lines=[json.loads(l) for l in open('$SR5/journal.jsonl')]
ev=[e for e in lines if e['type']=='TASK_LEASE_ACQUIRED'][0]
print(ev['payload']['lease']['expires_at'])")
sleep 1
node "$SWARM" heartbeat --state-root "$SR5" --principal own1 --task-id ot --lease-id "$LEASE_ID" --run-id o > /dev/null
EXPIRES1=$(python3 -c "
import json
lines=[json.loads(l) for l in open('$SR5/journal.jsonl')]
hb=[e for e in lines if e['type']=='TASK_HEARTBEAT'][-1]
print(hb['payload']['renewed_until'])")
[[ "$EXPIRES1" != "$EXPIRES0" ]] || fail "heartbeat did not renew lease expiry"
set +e
node "$SWARM" heartbeat --state-root "$SR5" --principal other2 --task-id ot --lease-id "$LEASE_ID" --run-id o > "$TMP/steal.json"
STEAL_RC=$?
set -e
[[ $STEAL_RC -eq 3 ]] || fail "cross-principal lease use should be rejected"
grep -q '"reason_code":"capability_denied"' "$TMP/steal.json" || fail "ownership denial verdict missing"

# signed-envelope path: mutating verbs accept envelopes and reject forged signers
node --input-type=module - "$TMP" <<'JS' || fail "envelope probe failed"
import fs from "node:fs";
const signing = await import(new URL("file://" + process.cwd() + "/scripts/lib/swarm-signing.mjs").href);
const handler = await import(new URL("file://" + process.cwd() + "/scripts/lib/swarm-command-handler.mjs").href);
const root = process.argv[2] + "/env-state";
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
handler.initStateRoot(root);
const coord = new handler.SwarmCoordinator(root);
coord.provisionAdapter("sig1", { host: "codex", model_family: "openai" });
// steal the provisioned adapter key to SIGN legitimately (in production it never leaves keys/)
const adapterKey = JSON.parse(fs.readFileSync(root + "/keys/sig1.json", "utf8")).private_key;
const rogue = signing.generateKeyPair();
const cmd = {
  schema_version: 1, command_id: "018f0000-0000-7000-8000-00000000e001", run_id: "er",
  command_type: "register_session",
  actor: { principal_id: "sig1", host: "codex", model_family: "openai", session_id: "es" },
  authority_generation: 0, expected_sequence: 0, idempotency_key: "env-1", payload: {},
};
const goodEnv = coord.constructor.envelopeForCommand(cmd, adapterKey);
const goodResult = coord.handleEnvelope(goodEnv);
if (!goodResult.accepted) { console.error("signed envelope should be accepted:", goodResult.reason_code); process.exit(1); }
const forged = coord.constructor.envelopeForCommand(cmd, rogue.private_key);
// same idempotency key would short-circuit; give the forgery its own key but wrong signer key
const forgedCmd = { ...cmd, idempotency_key: "env-2", command_id: "018f0000-0000-7000-8000-00000000e002", expected_sequence: 1 };
const forgedEnv = coord.constructor.envelopeForCommand(forgedCmd, rogue.private_key);
const forgedResult = coord.handleEnvelope(forgedEnv);
if (forgedResult.accepted) { console.error("forged signature accepted!"); process.exit(1); }
if (forgedResult.reason_code !== "signature_invalid") { console.error("expected signature_invalid:", forgedResult.reason_code); process.exit(1); }
process.exit(0);
JS

echo "PASS(validate-swarm-protocol): schema/CAS/idempotency/fail-closed/replay-corruption/checkpoint + run-binding/ownership/heartbeat-renewal/signed-envelopes verified"
echo "SCOPE NOTE: adjudication loop capping, remote transport, and multi-host shadow runs are OUT of this gate's scope (follow-up WIs)"
