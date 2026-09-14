#!/usr/bin/env bash
# validate-review-round-cap.sh — WI-491: the bounded review loop is mechanically enforced.
# Promotion note: validator_path=this; failure_class=unbounded-adversarial-review-loop;
# promotion_signal=WI-486 looped 9 rounds (0 Critical, 6 persistent High) before the cap existed;
# expected runtime <1s hermetic; tier-2 insufficient because the loop wastes real reviewer calls on
# every complex plan and the fix must be guarded on every lint.
# Covers the numeric CLI API AND the fail-closed --log parser (WI-491 review EXEC-001..004):
# missing/duplicate/malformed fields, un-enumerated dispositions, prose-escalation spoofing, and
# escalated-Critical blocking must all be rejected.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CHECK="$ROOT/scripts/check-review-round-cap.mjs"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
ok()  { printf '  ✓ %s\n' "$1"; PASS=$((PASS+1)); }
bad() { printf '  ✗ %s\n' "$1"; FAIL=$((FAIL+1)); }

# rc of a check invocation (never aborts under set -e).
rc_of() { "$@" >/dev/null 2>&1 && echo 0 || echo $?; }

echo "=== Tier 1: bounded review-round cap (WI-491) ==="

test -f "$CHECK" && ok "enforcement script exists" || bad "enforcement script missing"
node --check "$CHECK" 2>/dev/null && ok "enforcement script parses" || bad "enforcement script syntax error"

# Fixed log dispositions are syntactically valid; admission still requires the
# candidate-bound bounded-exit verifier. Critical/cap failures remain below.
cat > "$TMP/fixed.yaml" <<'EOF'
rounds_run: 3
unresolved_critical: 0
remaining_high: 1
bounded_exit:
  disposition: fixed
  residual_highs:
    - H-1
EOF
[ "$(rc_of node "$CHECK" --log "$TMP/fixed.yaml")" = 0 ] && ok "fixed High log supported" || bad "fixed High log rejected"

# ---------- Numeric CLI API ----------
# HARD cap: any run past 3 rounds is a violation REGARDLESS of later disposition (the WI-486 9-round bug).
[ "$(rc_of node "$CHECK" --rounds 9 --remaining-high 6 --dispositioned-high 6 --unresolved-critical 0)" = 1 ] \
  && ok "9-round loop rejected even when dispositioned (HARD cap — the WI-486 bug)" || bad "9-round loop NOT rejected"
[ "$(rc_of node "$CHECK" --rounds 4 --remaining-high 0 --dispositioned-high 0 --unresolved-critical 0)" = 1 ] \
  && ok "4th round rejected (hard cap is exactly 3)" || bad "4th round NOT rejected"
# Boundary: rounds 0/1/3 with nothing outstanding pass.
for r in 0 1 3; do
  [ "$(rc_of node "$CHECK" --rounds $r --remaining-high 0 --dispositioned-high 0 --unresolved-critical 0)" = 0 ] \
    && ok "rounds=$r clean state passes (boundary)" || bad "rounds=$r clean state wrongly rejected"
done
# Within cap AND every High dispositioned MUST pass.
[ "$(rc_of node "$CHECK" --rounds 3 --remaining-high 6 --dispositioned-high 6 --unresolved-critical 0)" = 0 ] \
  && ok "3 rounds, every remaining High dispositioned passes" || bad "compliant bounded exit wrongly rejected"
# Un-dispositioned High -> violation.
[ "$(rc_of node "$CHECK" --rounds 3 --remaining-high 6 --dispositioned-high 2 --unresolved-critical 0)" = 1 ] \
  && ok "un-dispositioned High rejected within the cap" || bad "un-dispositioned High NOT rejected"
# Unresolved Critical without escalation -> violation (exit 1).
[ "$(rc_of node "$CHECK" --rounds 3 --remaining-high 0 --dispositioned-high 0 --unresolved-critical 1 --escalated false)" = 1 ] \
  && ok "unresolved Critical w/o escalation rejected (never auto-accepted)" || bad "unresolved Critical w/o escalation NOT rejected"
# EXEC-002: escalated unresolved Critical must BLOCK (exit 3), never promote (exit 0).
CRIT_RC="$(rc_of node "$CHECK" --rounds 3 --remaining-high 0 --dispositioned-high 0 --unresolved-critical 1 --escalated true)"
[ "$CRIT_RC" = 3 ] && ok "escalated Critical HALTS with blocking exit 3 (BRL-03: Criticals never promote)" \
  || bad "escalated Critical did not block with exit 3 (got rc=$CRIT_RC)"
[ "$CRIT_RC" != 0 ] && ok "escalated Critical never returns success exit 0" || bad "escalated Critical wrongly returned exit 0"
# EXEC-001: malformed numeric args fail closed as usage error (exit 2), never bypass via NaN.
[ "$(rc_of node "$CHECK" --rounds notanumber --remaining-high 0 --unresolved-critical 0)" = 2 ] \
  && ok "malformed --rounds fails closed (exit 2, no NaN bypass)" || bad "malformed --rounds did NOT fail closed"

# ---------- Fail-closed --log parser (EXEC-001) ----------
mklog() { printf '%s\n' "$1" > "$TMP/log.yaml"; }

# Valid: rounds_run 3, remaining_high 2 enumerated in bounded_exit -> pass.
cat > "$TMP/valid.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 2
  bounded_exit:
    disposition: accept-with-justification
    residual_highs:
      - "execution-time risk A"
      - "execution-time risk B"
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/valid.yaml")" = 0 ] \
  && ok "valid log (rounds_run:3 + enumerated bounded_exit) passes" || bad "compliant log wrongly rejected"

# Missing rounds_run -> fail closed.
cat > "$TMP/f1.yaml" <<'YAML'
review_log:
  unresolved_critical: 0
  remaining_high: 0
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f1.yaml")" = 1 ] && ok "missing rounds_run fails closed" || bad "missing rounds_run NOT rejected"

# Duplicate rounds_run -> fail closed.
cat > "$TMP/f2.yaml" <<'YAML'
review_log:
  rounds_run: 2
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 0
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f2.yaml")" = 1 ] && ok "duplicate rounds_run fails closed" || bad "duplicate rounds_run NOT rejected"

# rounds_run > 3 in a log -> violation.
cat > "$TMP/f3.yaml" <<'YAML'
review_log:
  rounds_run: 9
  unresolved_critical: 0
  remaining_high: 0
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f3.yaml")" = 1 ] && ok "log rounds_run:9 rejected (hard cap)" || bad "log rounds_run:9 NOT rejected"

# remaining_high > 0 but no bounded_exit -> violation.
cat > "$TMP/f4.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 3
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f4.yaml")" = 1 ] && ok "remaining High without bounded_exit rejected" || bad "missing bounded_exit NOT rejected"

# bounded_exit present but residual_highs shorter than remaining_high -> violation.
cat > "$TMP/f5.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 3
  bounded_exit:
    disposition: accept-with-justification
    residual_highs:
      - "only one enumerated"
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f5.yaml")" = 1 ] && ok "under-enumerated residual_highs rejected (no bounded_exit blanket credit)" || bad "under-enumerated residual_highs NOT rejected"

# empty bounded_exit residual list with remaining_high>0 -> violation.
cat > "$TMP/f6.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 2
  bounded_exit:
    disposition: accept-with-justification
    residual_highs: []
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f6.yaml")" = 1 ] && ok "empty residual_highs rejected" || bad "empty residual_highs NOT rejected"

# unresolved Critical with negated escalation PROSE (no exact terminal_state) -> violation, not credit.
cat > "$TMP/f7.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 1
  remaining_high: 0
  note: "the author did not escalate to owner this round"
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f7.yaml")" = 1 ] && ok "prose escalation does NOT credit an unresolved Critical (fail closed)" || bad "prose escalation wrongly credited Critical"

# unresolved Critical WITH exact terminal_state -> HALT (exit 3, blocking).
cat > "$TMP/f8.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 1
  remaining_high: 0
  terminal_state: ESCALATED_TO_USER
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f8.yaml")" = 3 ] && ok "log escalated Critical HALTS with blocking exit 3" || bad "log escalated Critical did not block with exit 3"

# EXEC-005: a fabricated rounds_run cannot mask a completed 4th round record.
cat > "$TMP/f9.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 0
  round_1: {reviewer: x}
  round_2: {reviewer: x}
  round_3: {reviewer: x}
  round_4: {reviewer: x}
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f9.yaml")" = 1 ] && ok "declared rounds_run:3 with a round_4 record is rejected (EXEC-005)" || bad "round_4 record slipped past a rounds_run:3 counter"

# EXEC-005: declared counter must equal the number of actual round_N records.
cat > "$TMP/f10.yaml" <<'YAML'
review_log:
  rounds_run: 2
  unresolved_critical: 0
  remaining_high: 0
  round_1: {reviewer: x}
  round_2: {reviewer: x}
  round_3: {reviewer: x}
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f10.yaml")" = 1 ] && ok "rounds_run disagreeing with round_N record count is rejected (EXEC-005)" || bad "counter/record mismatch NOT rejected"

# EXEC-005: a round still marked PENDING cannot certify a terminal pass.
cat > "$TMP/f11.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 0
  round_1: {reviewer: x}
  round_2: {reviewer: x}
  round_3:
    reviewer: x
    status: PENDING
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f11.yaml")" = 1 ] && ok "a PENDING round record is rejected (EXEC-005)" || bad "PENDING round wrongly certified"

# EXEC-005: a consistent 3-round record with matching counter passes.
cat > "$TMP/f12.yaml" <<'YAML'
review_log:
  rounds_run: 3
  unresolved_critical: 0
  remaining_high: 0
  round_1: {reviewer: x}
  round_2: {reviewer: x}
  round_3: {reviewer: x}
YAML
[ "$(rc_of node "$CHECK" --log "$TMP/f12.yaml")" = 0 ] && ok "consistent 3-round record (counter == records) passes" || bad "consistent 3-round record wrongly rejected"

# EXEC-006: review-exec must NOT re-execute/re-plan an unresolved Critical past the cap.
grep -q "terminal_state: ESCALATED_TO_USER" "$ROOT/skills/review-exec/SKILL.md" && ok "review-exec Failure Modes escalates unresolved Critical (exit 3), not re-loop" || bad "review-exec missing exit-3 escalation in Failure Modes"

# ---------- Contract normalization (EXEC-003) ----------
grep -q "HARD 3-round cap" "$ROOT/references/plan-review-protocol.md" && ok "plan-review-protocol documents the 3-round cap" || bad "protocol missing the cap"
grep -q "3-round cap" "$ROOT/skills/review-cross-model/SKILL.md" && ok "review-cross-model documents the cap" || bad "review-cross-model missing the cap"
# Obsolete "loop until High disappears" language must be gone from review-cross-model.
if grep -qiE "No High findings remaining|CONVERGED at Medium max|all Medium or lower" "$ROOT/skills/review-cross-model/SKILL.md"; then
  bad "review-cross-model still carries obsolete 'High must disappear / Medium max' convergence language"
else ok "review-cross-model free of obsolete High-must-disappear language"; fi
# The protocol must not tie bounded_exit to '>3' (a 4th round is forbidden).
if grep -qE "bounded_exit.*when >3|record .*when >3" "$ROOT/references/plan-review-protocol.md"; then
  bad "protocol still ties bounded_exit to rounds_run>3 (forbidden 4th round)"
else ok "protocol records bounded_exit at rounds_run==3, not >3"; fi

# One discovery batch can contain parallel reviewers; follow-ups cannot restart it.
for variant in good restart unrelated missing duplicate; do
  cat > "$TMP/branch-$variant.yaml" <<'YAML'
rounds_run: 2
self_review_passes: 1
unresolved_critical: 0
remaining_high: 0
discovery_batches: 1
unlinked_followup_findings: 0
YAML
  case "$variant" in
    restart) sed -i 's/discovery_batches: 1/discovery_batches: 2/' "$TMP/branch-$variant.yaml" ;;
    unrelated) sed -i 's/unlinked_followup_findings: 0/unlinked_followup_findings: 1/' "$TMP/branch-$variant.yaml" ;;
    missing) sed -i '/discovery_batches:/d' "$TMP/branch-$variant.yaml" ;;
    duplicate) echo 'discovery_batches: 1' >> "$TMP/branch-$variant.yaml" ;;
  esac
  expected=1
  [[ "$variant" == good ]] && expected=0
  [ "$(rc_of node "$CHECK" --branch-once --log "$TMP/branch-$variant.yaml")" = "$expected" ] && ok "branch-once $variant" || bad "branch-once $variant"
done
[ "$(rc_of node "$CHECK" --branch-once --rounds 1)" = 2 ] && ok "branch-once requires recorded lineage" || bad "branch-once silently accepts numeric-only counters"

printf '\n  %s passed, %s failed\n' "$PASS" "$FAIL"
test "$FAIL" -eq 0
