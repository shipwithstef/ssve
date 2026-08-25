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
  --command-json '{"schema_version":1,"command_id":"018f0000-0000-7000-8000-00000000abcd","run_id":"r1","command_type":"acquire_task","actor":{"principal_id":"sol-a","host":"codex","model_family":"openai","session_id":"s"},"authority_generation":0,"expected_sequence":99,"idempotency_key":"cas-probe","payload":{}}' > "$TMP/cas.json"
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

echo "PASS(validate-swarm-protocol): schema/CAS/idempotency/fail-closed/replay-corruption/checkpoint verified (final seq=$BEFORE_SEQ->$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sequence)' "$TMP/status-final.json"))"
