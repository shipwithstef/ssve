#!/bin/bash
# validate-swarm-host-parity.sh — host neutrality: the same golden command sequence
# from different actor hosts yields identical canonical transitions and verdicts,
# and every command-union enum value maps to exactly one CLI verb.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SWARM="$ROOT/scripts/svc-swarm.mjs"
TMP="$(mktemp -d /tmp/svc-swarm-parity-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL(validate-swarm-host-parity): $1" >&2; exit 1; }

run_golden() {
  local HOST_LABEL="$1" SR="$2"
  node "$SWARM" init --state-root "$SR" > /dev/null
  node "$SWARM" provision --state-root "$SR" --principal w1 --host "$HOST_LABEL" > /dev/null
  node "$SWARM" register --state-root "$SR" --principal w1 --host "$HOST_LABEL" --model-family fam --run-id g1 > /dev/null
  node "$SWARM" acquire --state-root "$SR" --principal w1 --task-id t1 --run-id g1 > /dev/null
  node "$SWARM" ack --state-root "$SR" --principal w1 --run-id g1 > /dev/null
}

# golden scenario under two different host labels
run_golden codex "$TMP/as-codex"
run_golden grok "$TMP/as-grok"

canonical_transitions() {
  node -e '
    const fs = require("fs");
    const events = fs.readFileSync(process.argv[1], "utf8").trim().split("\n").map(JSON.parse);
    const canonical = events.map(e => ({ sequence: e.sequence, type: e.type, authority_generation: e.authority_generation }));
    console.log(JSON.stringify(canonical));
  ' "$1"
}

T_CODEX=$(canonical_transitions "$TMP/as-codex/journal.jsonl")
T_GROK=$(canonical_transitions "$TMP/as-grok/journal.jsonl")
[[ "$T_CODEX" == "$T_GROK" ]] || fail "canonical transitions diverged across hosts: $T_CODEX vs $T_GROK"

# verdicts identical: both journals replay valid with same sequence
S1=$(node "$SWARM" status --state-root "$TMP/as-codex")
S2=$(node "$SWARM" status --state-root "$TMP/as-grok")
[[ "$S1" == "$S2" ]] || fail "status projections diverged across hosts"

# verb coverage: every command-union enum value maps to exactly one CLI verb
node --input-type=module - <<'JS' || fail "verb-coverage assertion failed"
import fs from "node:fs";
const schema = JSON.parse(fs.readFileSync("schemas/swarm-command-v1.schema.json", "utf8"));
const cli = fs.readFileSync("scripts/svc-swarm.mjs", "utf8");
const verbMapMatch = cli.match(/const verbMap = \{([\s\S]*?)\};/);
if (!verbMapMatch) process.exit(1);
const mappedCommands = [...verbMapMatch[1].matchAll(/:\s*"([a-z_]+)"/g)].map(m => m[1]);
const enumCommands = schema.properties.command_type.enum;
const missing = enumCommands.filter(cmd => !mappedCommands.includes(cmd));
const unknown = mappedCommands.filter(cmd => !enumCommands.includes(cmd));
if (missing.length) { console.error("commands without CLI verb:", missing.join(",")); process.exit(1); }
if (unknown.length) { console.error("CLI verbs without schema command:", unknown.join(",")); process.exit(1); }
process.exit(0);
JS

echo "PASS(validate-swarm-host-parity): identical canonical transitions + verdicts across host labels; verb coverage complete (${#T_CODEX} bytes of transition evidence)"
