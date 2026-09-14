#!/usr/bin/env bash
# Tier 1: mandatory-chain stage-context isolation (WI-380).
#
# Proves the segmentation splits at the 3 human_checkpoint seams (AC1), the
# review-exec P4 kickback ladder is an explicit + deterministic state machine
# (AC2), and the stage-receipt verification is FAIL-CLOSED — a missing receipt
# HALTS, never silently continues (AC3). Hermetic; no network/LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
echo "=== Tier 1: Stage-Context Isolation (WI-380) ==="

SS="scripts/stage-segment.mjs"
[ -s "$SS" ] && pass "stage-segment present" || fail "stage-segment missing"
node --check "$SS" 2>/dev/null && pass "stage-segment parses" || fail "stage-segment syntax error"
node -e 'JSON.parse(require("fs").readFileSync("schemas/stage-summary.schema.json","utf8"))' 2>/dev/null && pass "stage-summary schema valid JSON" || fail "schema not valid JSON"
[ -s "references/stage-context-isolation.md" ] && pass "isolation protocol present" || fail "protocol missing"

# ---- AC1 + AC2: segmentation + kickback ladder (pure) -----------------------
node --input-type=module -e '
import { SEGMENTS, nextStageAction } from "./scripts/stage-segment.mjs";
let rc=0; const ok=(c,m)=>{if(!c){console.log("  ✗ "+m);rc=1;}};
ok(SEGMENTS.length>=3, "AC1: ≥3 segments");
ok(SEGMENTS.map(s=>s.checkpoint_after).join(",")==="plan-changeset,execute-changeset,land-changeset", "AC1: split at the 3 human_checkpoint seams");
ok(nextStageAction([]).action==="pass", "ladder: no findings → pass");
ok(nextStageAction([{severity:"MEDIUM"}]).action==="pass", "ladder: only MEDIUM → pass");
ok(nextStageAction([{severity:"HIGH",size_lines:10}]).action==="patch", "ladder: HIGH ≤20 → patch");
ok(nextStageAction([{severity:"HIGH",size_lines:30}]).action==="re-execute", "ladder: >20 lines → re-execute");
ok(nextStageAction([{severity:"CRITICAL",structural:true}]).action==="re-execute", "ladder: structural → re-execute");
ok(nextStageAction([{severity:"HIGH",cause:"plan"}]).action==="re-plan", "ladder: plan-flaw → re-plan");
ok(nextStageAction([{severity:"HIGH",size_lines:5}],3).action==="re-execute", "ladder: patch cap(3) → forced re-execute");
ok(nextStageAction([{severity:"HIGH",size_lines:5}],1).next_iteration===2, "ladder: patch increments iteration");
// deterministic
ok(JSON.stringify(nextStageAction([{severity:"HIGH",size_lines:5}],1))===JSON.stringify(nextStageAction([{severity:"HIGH",size_lines:5}],1)), "ladder deterministic");
process.exit(rc);
' && pass "AC1 segmentation + AC2 kickback ladder (deterministic state machine)" || fail "segmentation/ladder wrong"

# ---- AC3: stage-receipt verification is FAIL-CLOSED -------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q; git -C "$TMP" config user.email contact-0a7bb000f7@example.invalid; git -C "$TMP" config user.name t
printf 'x\n' > "$TMP/a.txt"; git -C "$TMP" add -A >/dev/null 2>&1; git -C "$TMP" commit -qm c >/dev/null 2>&1
SHA="$(git -C "$TMP" rev-parse HEAD)"
# no receipt note on this sha → verify must FAIL-CLOSED (non-zero)
node "$SS" verify-receipt --sha "$SHA" --type exec-record --root "$TMP" >/dev/null 2>&1 && fail "AC3: missing receipt passed (must fail-closed)" || pass "AC3: missing stage receipt → non-zero (segment HALTS, never silent-continue)"
# add a receipt note → verify passes
printf '{"exec-record":{"receipt_type":"exec-record"}}' | git -C "$TMP" notes --ref=svc-receipts add -f -F - "$SHA" >/dev/null 2>&1
node "$SS" verify-receipt --sha "$SHA" --type exec-record --root "$TMP" >/dev/null 2>&1 && pass "AC3: present stage receipt → exit 0 (orchestration verifies the SHA, never re-emits)" || fail "AC3: present receipt not verified"
node "$SS" verify-receipt --sha "$SHA" --type review-exec --root "$TMP" >/dev/null 2>&1 && fail "AC3: wrong type passed" || pass "AC3: a DIFFERENT required receipt type still missing → fail-closed"

# ---- Gemini G6: kickback ladder fails CLOSED on malformed/unknown input -----
node --input-type=module -e '
import { nextStageAction } from "./scripts/stage-segment.mjs";
let rc=0; const ok=(c,m)=>{if(!c){console.log("  ✗ "+m);rc=1;}};
ok(nextStageAction(null).action==="re-execute", "G6#1: non-array findings (null) → fail-closed re-execute, not pass");
ok(nextStageAction({severity:"HIGH"}).action==="re-execute", "G6#1: object findings → fail-closed");
ok(nextStageAction([{severity:"FATAL"}]).action!=="pass", "G6#2: unknown severity FATAL → NOT pass (escalated)");
ok(nextStageAction([{severity:"CRITCAL"}]).action!=="pass", "G6#2: typo severity CRITCAL → NOT pass");
ok(nextStageAction([{severity:"INFO"}]).action==="pass", "G6#2: a real INFO finding still → pass (no over-escalation)");
ok(nextStageAction([]).action==="pass", "empty findings → pass (no over-escalation)");
process.exit(rc);
' && pass "G6 #1/#2: kickback fails-closed on non-array + unknown severity (no blocking finding can pass)" || fail "G6 fail-closed regression"

# G6#3: verifyStageReceipt uses execFileSync (no shell) — a repoRoot with shell
# metachars must NOT be evaluated; it just fails-closed as a bad path.
node "$SS" verify-receipt --sha HEAD --type exec-record --root '$(touch /tmp/svc-injection-probe)' >/dev/null 2>&1 || true
[ ! -f /tmp/svc-injection-probe ] && pass "G6#3: shell metachars in --root are NOT evaluated (execFileSync, no injection)" || { fail "G6#3: shell injection executed"; rm -f /tmp/svc-injection-probe; }

# ---- the S5 policy reversal is RECORDED (this WI's Tier-0 precondition) ------
grep -q "isolated/parallel transport\|S5 policy reversal" references/workflow-fanout-protocol.md && pass "S5 parallel-transport reversal recorded in workflow-fanout-protocol.md" || fail "policy reversal not recorded in protocol"

echo "stage-isolation: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
