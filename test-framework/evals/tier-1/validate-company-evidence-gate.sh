#!/usr/bin/env bash
# Tier-1 (WI-414): the company-operating-fleet evidence gate must Default-FAIL ungrounded
# decision cards. Proves company-state.mjs append-decision refuses a card with no resolvable
# evidence, accepts a grounded one and an explicit owner-ask, and that `grade` flags a bypass.
#
# Tier-1 promotion note (rules/tier-1-promotion.md):
#   validator_path: test-framework/evals/tier-1/validate-company-evidence-gate.sh
#   failure_class: ungrounded/fabricated decision cards reaching the owner queue (false-green)
#   promotion_signal: #2 — failure class documented in rules/no-fabrication.md + claims-discipline
#       doctrine; this gate is the mechanical enforcement of propose-only grounding (doctrine §5/§6).
#   expected_runtime_budget: <2s hermetic (mktemp + ~6 node calls, no network/LLM); SKIPs instantly
#       when scripts/company-state.mjs is absent (off-branch), so zero cost on main.
#   why_tier_2_or_targeted_is_insufficient: the gate IS a safety rail; a silent regression would let
#       an autonomous brain file unbacked decisions — must run on every lint, like the other rail checks.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/company-state.mjs"
T="$(mktemp -d)/co"
fail=0
chk() { if [ "$1" = "$2" ]; then echo "  ok: $3"; else echo "  FAIL: $3 (rc=$1 want $2)"; fail=1; fi; }

if [ ! -f "$SCRIPT" ]; then echo "SKIP: $SCRIPT not present (fleet not on this branch)"; exit 0; fi

node "$SCRIPT" scaffold --state-dir "$T" --name evalco >/dev/null 2>&1 || { echo "FAIL: scaffold"; exit 1; }

node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"financial-analyst","title":"ungrounded","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve"}' >/dev/null 2>&1
chk $? 1 "ungrounded card is refused (Default-FAIL)"

node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"financial-analyst","title":"grounded","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["state.md"]}' >/dev/null 2>&1
chk $? 0 "grounded card (real file) is accepted"

node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"financial-analyst","title":"owner-ask","door":"two-way","recommendation":"owner supplies","cost_of_delay":"low","ask":"pick","evidence":["<TBD: need real figure from owner>"]}' >/dev/null 2>&1
chk $? 0 "explicit owner-ask (<TBD> + ask:pick) is accepted"

node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"growth-lead","title":"fakepath","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["nope/imaginary.md"]}' >/dev/null 2>&1
chk $? 1 "nonexistent-evidence card is refused"

# Hardening cases (WI-414 self-review): the gate must NOT ground on any path that merely exists.
node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"growth-lead","title":"abs-sys-path","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["/etc/hostname"]}' >/dev/null 2>&1
chk $? 1 "absolute system path (/etc/hostname) is refused"

node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"growth-lead","title":"traversal","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["../../../../etc/passwd"]}' >/dev/null 2>&1
chk $? 1 "path-traversal escape (../../../etc/passwd) is refused"

node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"growth-lead","title":"dir-not-file","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["reviews"]}' >/dev/null 2>&1
chk $? 1 "a directory (reviews/) is refused (must be a real file)"

node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"growth-lead","title":"empty-ev","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["","metric: "]}' >/dev/null 2>&1
chk $? 1 "empty / whitespace evidence is refused"

# Codex-review (PR #78) regressions: symlink escape, fabricated metric, forged score stamp.
ln -s /etc/hostname "$T/escape-link" 2>/dev/null
node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"market-intel","title":"sym","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["escape-link"]}' >/dev/null 2>&1
chk $? 1 "symlink escaping the company dirs is refused (realpath containment)"

printf '%s\n' '{"ts":"t","metric":"fakem","value":9,"source":"not-a-real-file"}' >> "$T/metrics.jsonl"
node "$SCRIPT" append-decision --state-dir "$T" --card \
  '{"proposed_by":"market-intel","title":"fakem","door":"two-way","recommendation":"x","cost_of_delay":"med","ask":"approve","evidence":["metric:fakem"]}' >/dev/null 2>&1
chk $? 1 "a fabricated metric (source not a real file) does not ground"

FF=$(mktemp)
printf '%s\n' '{"id":"D-2026-06-22-900","ts":"t","proposed_by":"growth-lead","title":"forged","door":"two-way","recommendation":"x","cost_of_delay":"low","ask":"fyi","status":"pending","evidence":["nope.md"],"evidence_gate":"passed"}' > "$FF"
node "$SCRIPT" score --state-dir "$T" --file "$FF" --all --min 99 >/dev/null 2>&1
chk $? 2 "score re-checks the gate — a forged evidence_gate:passed stamp does not score high"

TQ=$(mktemp)
printf '%s\n' '{"id":"D-2026-06-22-901","ts":"t","proposed_by":"financial-analyst","title":"punt","door":"two-way","recommendation":"owner supplies the figure","cost_of_delay":"low","ask":"pick","status":"pending","evidence":["<TBD: need cash balance from owner>"],"evidence_gate":"owner-ask"}' > "$TQ"
node "$SCRIPT" score --state-dir "$T" --file "$TQ" --all --min 80 >/dev/null 2>&1
chk $? 2 "owner-ask-only (<TBD>) queue is a punt — does not score board-grade"

# empty queue must FAIL the board-grade gate — no decisions = failed job, doctrine §6.3 (Codex round 3)
TE=$(mktemp -d)/empty; node "$SCRIPT" scaffold --state-dir "$TE" --name e >/dev/null 2>&1
node "$SCRIPT" score --state-dir "$TE" >/dev/null 2>&1
chk $? 2 "empty queue fails score (no decisions = failed job)"
node "$SCRIPT" preflight --state-dir "$TE" >/dev/null 2>&1
chk $? 2 "empty queue BLOCKS preflight (no decisions = failed job)"

node "$SCRIPT" append-decision --state-dir "$T" --allow-ungrounded --card \
  '{"proposed_by":"growth-lead","title":"forced","door":"two-way","recommendation":"x","cost_of_delay":"low","ask":"fyi"}' >/dev/null 2>&1
chk $? 0 "sanctioned --allow-ungrounded override is accepted"

# grade must still flag the bypassed card as NEEDS_WORK (a bypass cannot hide)
node "$SCRIPT" grade --state-dir "$T" 2>&1 | grep -q "NEEDS_WORK.*forced"
chk $? 0 "grade flags the bypassed card NEEDS_WORK"

# WI-415 scoreboard: runs on the queue, and enforces a high threshold (the mixed queue is not perfect)
node "$SCRIPT" score --state-dir "$T" --min 1 >/dev/null 2>&1
chk $? 0 "score command runs on the queue"
node "$SCRIPT" score --state-dir "$T" --min 99 >/dev/null 2>&1
chk $? 2 "score enforces threshold (mixed queue scores below 99)"

# WI-415 cadence pre-flight: BLOCKS the mixed queue (it has a bypassed/NEEDS_WORK card)
node "$SCRIPT" preflight --state-dir "$T" >/dev/null 2>&1
chk $? 2 "preflight BLOCKS a queue with a NEEDS_WORK card"
# a clean grounded-only queue must PASS preflight
TC=$(mktemp -d)/co; node "$SCRIPT" scaffold --state-dir "$TC" --name clean >/dev/null 2>&1
node "$SCRIPT" append-decision --state-dir "$TC" --card '{"proposed_by":"financial-analyst","title":"grounded one-way","door":"one-way","recommendation":"do X","cost_of_delay":"high","ask":"approve","confidence":0.8,"evidence":["state.md"]}' >/dev/null 2>&1
node "$SCRIPT" preflight --state-dir "$TC" >/dev/null 2>&1
chk $? 0 "preflight PASSES a clean grounded queue"

if [ "$fail" = 0 ]; then echo "PASS: company evidence gate (WI-414)"; exit 0; else echo "FAIL: company evidence gate (WI-414)"; exit 1; fi
