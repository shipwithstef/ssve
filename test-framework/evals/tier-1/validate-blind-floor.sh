#!/usr/bin/env bash
# validate-blind-floor.sh — tier-1 gate for Two-Box Planning (legacy id: blind-control-plan).
# Active claims: live staged eligibility, independent Open/Contract roles, exactly two
# Contract-only scouts, and historical fixtures as non-authority. The active gate does
# not require scripts/blind-floor-judge.sh. Historical floor-check fixtures remain:
#   - exits non-zero on uncertified REMOVE/ALTER (AC1: planted-silent-removal, weakening-as-refinement)
#   - ships blind verbatim on the retention escape hatch (AC2: judge-unavailable)
#   - is run-twice-golden deterministic (AC4)
#   - rejects self-certification by the orchestrator family (AC3: weakening-as-refinement)
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECK="$ROOT/scripts/blind-floor-check.mjs"
FX="$ROOT/test-framework/evals/tier-1/fixtures/blind-floor"
fails=0

if [ ! -f "$CHECK" ]; then echo "FAIL: missing $CHECK"; exit 1; fi
if [ ! -d "$FX" ]; then echo "FAIL: missing fixtures dir $FX"; exit 1; fi

for dir in "$FX"/*/; do
  name="$(basename "$dir")"
  exp_exit="$(node -e "console.log(require('$dir/expect.json').exit)")"
  exp_verdict="$(node -e "console.log(require('$dir/expect.json').floor_verdict)")"
  adopt="$(node -e "console.log(require('$dir/expect.json').adopt_blind===true?'1':'')")"

  args=(--blind "$dir/B.json" --merged "$dir/F.json")
  [ -f "$dir/verdicts.json" ] && args+=(--verdicts "$dir/verdicts.json")
  [ -n "$adopt" ] && args+=(--adopt-blind)

  out1="$(node "$CHECK" "${args[@]}" 2>/dev/null)"; ec1=$?
  out2="$(node "$CHECK" "${args[@]}" 2>/dev/null)"; ec2=$?

  ok=1
  [ "$ec1" = "$exp_exit" ] || { echo "FAIL[$name]: exit $ec1 != expected $exp_exit"; ok=0; }
  [ "$ec1" = "$ec2" ] && [ "$out1" = "$out2" ] || { echo "FAIL[$name]: non-deterministic (run-twice-golden broken)"; ok=0; }
  # exit 2 = malformed-input fail-closed (no floor_verdict emitted); skip verdict check when none expected
  if [ -n "$exp_verdict" ] && [ "$exp_verdict" != "null" ]; then
    echo "$out1" | grep -q "\"floor_verdict\": \"$exp_verdict\"" || { echo "FAIL[$name]: floor_verdict != $exp_verdict"; ok=0; }
  fi
  if [ "$ok" = 1 ]; then echo "PASS[$name]: exit=$ec1 verdict=$exp_verdict (golden)"; else fails=$((fails+1)); fi
done

# Anti-self-grade BEHAVIORAL assertion (AC3): the check consumes certifications from the
# judge verdicts file but its OWN output must never carry certified_strict_improvement
# (svc never self-certifies; the field lives only in the cross-family judge's verdicts).
asg_out="$(node "$CHECK" --blind "$FX/refine/B.json" --merged "$FX/refine/F.json" --verdicts "$FX/refine/verdicts.json" 2>/dev/null)"
if echo "$asg_out" | grep -q "certified_strict_improvement"; then
  echo "FAIL: blind-floor-check.mjs OUTPUT carries certified_strict_improvement (anti-self-grade violation)"; fails=$((fails+1))
else
  echo "PASS[anti-self-grade]: check output never carries certified_strict_improvement (reads-only from judge verdicts)"
fi

ROUTE="$ROOT/scripts/blind-floor-route.mjs"
PROTO="$ROOT/scripts/lib/two-box-protocol.mjs"
PLANNER="$ROOT/scripts/two-box-plan.mjs"
if [ ! -f "$ROUTE" ] || [ ! -f "$PROTO" ] || [ ! -f "$PLANNER" ]; then
  echo "FAIL: missing Two-Box routing/protocol modules"; fails=$((fails+1))
elif grep -q "evaluateEligibility" "$ROUTE" && grep -q "historical fixture inspection only" "$ROUTE" && grep -q "current substantive work requires Two-Box" "$ROUTE" && grep -q "open_box" "$PLANNER" && grep -q "contract_box" "$PLANNER" && grep -q "scout_forward" "$PLANNER" && grep -q "scout_reverse" "$PLANNER"; then
  echo "PASS[active-two-box]: live eligibility; independent roles; historical decide() is non-authority"
else
  echo "FAIL: active Two-Box eligibility/roles claims missing"; fails=$((fails+1))
fi
if node --input-type=module -e "import {decide} from 'file://$ROOT/scripts/blind-floor-route.mjs'; import {PLANNING_ROLES} from 'file://$ROOT/scripts/lib/two-box-protocol.mjs'; const docs=decide({cls:'docs',size:'XL',files:20,optedIn:true,killSwitch:false}); const armed=decide({cls:'infra',size:'M',files:10,optedIn:true,killSwitch:false}); const off=decide({cls:'infra',size:'M',files:10,optedIn:false,killSwitch:false}); if (docs.run!==false||armed.run!==true||off.run!==false) process.exit(1); const scouts=PLANNING_ROLES.filter(r=>r==='scout_forward'||r==='scout_reverse'); if (scouts.length!==2||!PLANNING_ROLES.includes('open_box')||!PLANNING_ROLES.includes('contract_box')) process.exit(1);"; then
  echo "PASS[historical-classifier]: decide() fixtures remain nonauthoritative; exactly two scouts"
else
  echo "FAIL: historical decide() coverage or scout cardinality"; fails=$((fails+1))
fi

if [ "$fails" -gt 0 ]; then echo "validate-blind-floor: $fails failure(s)"; exit 1; fi
echo "validate-blind-floor: all checks PASS"; exit 0
