#!/bin/bash
# validate-capture-idea-from-proposal.sh — Tier-1 validator for WI-073.
#
# Exercises skills/capture-idea/scripts/{parse-proposal,emit-wis}.mjs against 3 fixtures
# covering AC-01.1..AC-01.3, AC-02.1..AC-02.3, AC-04.1..AC-04.5, plus the
# 4-case idempotency matrix and self-exclusion.
#
# Exit 0 on all PASS; exit 1 on any FAIL.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

PARSE="$REPO_ROOT/skills/capture-idea/scripts/parse-proposal.mjs"
EMIT="$REPO_ROOT/skills/capture-idea/scripts/emit-wis.mjs"
FIX_PHASED="$REPO_ROOT/skills/capture-idea/references/tests/fixture-proposal-phased.md"
FIX_MONO="$REPO_ROOT/skills/capture-idea/references/tests/fixture-monolithic.md"
FIX_INHERIT="$REPO_ROOT/skills/capture-idea/references/tests/fixture-leaf-ac-inherited.md"

PASS=0
FAIL=0
FAILS=()

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); FAILS+=("$1"); echo "  ✗ $1"; }

echo "=== Tier 1: capture-idea --from-proposal Validation ==="

# --- Preflight ------------------------------------------------------------
node --check "$PARSE" 2>/dev/null && pass "parse-proposal.mjs syntax ok" || fail "parse-proposal.mjs syntax error"
node --check "$EMIT"  2>/dev/null && pass "emit-wis.mjs syntax ok"       || fail "emit-wis.mjs syntax error"

for f in "$FIX_PHASED" "$FIX_MONO" "$FIX_INHERIT"; do
  [ -r "$f" ] && pass "fixture present: $(basename $f)" || fail "fixture missing: $(basename $f)"
done

# --- Determinism (AC-04 invariant) ---------------------------------------
TMP1=$(mktemp)
TMP2=$(mktemp)
node "$PARSE" "$FIX_PHASED" > "$TMP1" 2>/dev/null
node "$PARSE" "$FIX_PHASED" > "$TMP2" 2>/dev/null
if diff -q "$TMP1" "$TMP2" >/dev/null; then pass "parser deterministic across 2 runs"; else fail "parser non-deterministic"; fi
rm -f "$TMP1" "$TMP2"

# --- Leaf count (AC-04.1/04.2, AC-01.1) ----------------------------------
PHASED_LEAVES=$(node "$PARSE" "$FIX_PHASED" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["metadata"]["leaf_count"])')
[ "$PHASED_LEAVES" = "3" ] && pass "phased fixture → 3 leaves (AC-01.1)" || fail "phased fixture → expected 3 leaves, got $PHASED_LEAVES"

# --- Monolithic (AC-01.3) ------------------------------------------------
MONO_MODE=$(node "$PARSE" "$FIX_MONO" 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["metadata"]["monolithic"])')
MONO_LEAVES=$(node "$PARSE" "$FIX_MONO" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["metadata"]["leaf_count"])')
[ "$MONO_MODE" = "True" ] && [ "$MONO_LEAVES" = "1" ] && pass "monolithic fixture → 1 WI (AC-01.3)" || fail "monolithic detection failed (monolithic=$MONO_MODE leaves=$MONO_LEAVES)"

# --- Inheritance (AC-04.3) -----------------------------------------------
INHERIT_CHECK=$(node "$PARSE" "$FIX_INHERIT" 2>/dev/null | python3 -c '
import json,sys
d = json.load(sys.stdin)
p0 = next(p for p in d["phases"] if p["id"] == "Phase 0")
l01 = next(l for l in p0["leaves"] if l["id"] == "P0.1")
print("YES" if l01["blocks"].get("acs_inherited_from") == "Phase 0" else "NO")')
[ "$INHERIT_CHECK" = "YES" ] && pass "AC inheritance fires for P0.1 (AC-04.3)" || fail "AC inheritance did not fire on P0.1"

# --- Dry-run emit field assertions (AC-01.2) -----------------------------
PROPOSAL_FIXTURE_DIR=$(mktemp -d)
cp "$FIX_PHASED" "$PROPOSAL_FIXTURE_DIR/proposal.md"
DRYRUN=$(node "$EMIT" "$PROPOSAL_FIXTURE_DIR/proposal.md" --dry-run --wi-dir "$PROPOSAL_FIXTURE_DIR/wis" --decisions-log "$PROPOSAL_FIXTURE_DIR/decisions.jsonl" 2>/dev/null)
EMITTED_COUNT=$(echo "$DRYRUN" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["emitted"]))')
[ "$EMITTED_COUNT" = "3" ] && pass "dry-run emits 3 WIs from phased fixture" || fail "dry-run emitted $EMITTED_COUNT WIs (expected 3)"

# --- Full-emit round-trip + AC-01.2 field check --------------------------
rm -rf "$PROPOSAL_FIXTURE_DIR"
PROPOSAL_FIXTURE_DIR=$(mktemp -d)
mkdir "$PROPOSAL_FIXTURE_DIR/proposals"
cp "$FIX_PHASED" "$PROPOSAL_FIXTURE_DIR/proposals/proposal.md"
cd "$PROPOSAL_FIXTURE_DIR"
node "$EMIT" "proposals/proposal.md" --wi-dir "wis" --decisions-log "decisions.jsonl" > /dev/null 2>&1
cd - > /dev/null

# Each emitted WI must have: Type, Status DRAFT, Severity, Filed date, Source with §, Lane, Goal (single authoritative section, WI-100), Non-Goals, AC, File Impact
EMIT_OK=0
for wi in "$PROPOSAL_FIXTURE_DIR/wis"/WI-*.md; do
  grep -q "^\*\*Type:\*\*"        "$wi" || { fail "missing Type in $(basename $wi)"; continue; }
  grep -q "^\*\*Status:\*\* DRAFT" "$wi" || { fail "missing Status:DRAFT in $(basename $wi)"; continue; }
  grep -q "^\*\*Severity:\*\*"    "$wi" || { fail "missing Severity in $(basename $wi)"; continue; }
  grep -qE "^\*\*Filed:\*\* [0-9]{4}-[0-9]{2}-[0-9]{2}" "$wi" || { fail "missing ISO Filed date in $(basename $wi)"; continue; }
  grep -qE "^\*\*Source:\*\* .* § P[0-9]+\.[0-9]+" "$wi" || { fail "missing Source with leaf anchor in $(basename $wi)"; continue; }
  grep -q "^\*\*Lane:\*\* framework" "$wi" || { fail "missing Lane:framework in $(basename $wi)"; continue; }
  grep -q "^## Goal$"               "$wi" || { fail "missing ## Goal in $(basename $wi)"; continue; }
  # Per WI-100, the redundant `## Goals` heading was removed — `## Goal` is now
  # the single authoritative section and pulls content from blocks.goals.
  grep -q "^## Non-Goals$"          "$wi" || { fail "missing ## Non-Goals in $(basename $wi)"; continue; }
  grep -q "^## Acceptance Criteria$" "$wi" || { fail "missing ## AC in $(basename $wi)"; continue; }
  grep -q "^## File Impact$"        "$wi" || { fail "missing ## File Impact in $(basename $wi)"; continue; }
  EMIT_OK=$((EMIT_OK+1))
done
[ "$EMIT_OK" = "3" ] && pass "all 3 emitted WIs have every required field (AC-01.2)" || fail "only $EMIT_OK/3 WIs had all fields"

# Archive check (AC-02.1, AC-02.2)
[ -f "$PROPOSAL_FIXTURE_DIR/proposals/done/proposal.md" ] && pass "proposal moved to proposals/done/ (AC-02.1)" || fail "proposal not moved to done/"
grep -q "^\*\*Promoted to:\*\*" "$PROPOSAL_FIXTURE_DIR/proposals/done/proposal.md" && pass "Promoted-to trailer appended (AC-02.2)" || fail "trailer missing"

# Decision log (AC-02.3)
[ -f "$PROPOSAL_FIXTURE_DIR/decisions.jsonl" ] && grep -q '"mode":"from-proposal"' "$PROPOSAL_FIXTURE_DIR/decisions.jsonl" && pass "decision log entry appended (AC-02.3)" || fail "decision log entry missing"

# --- Idempotency case A: re-run is no-op ---------------------------------
cd "$PROPOSAL_FIXTURE_DIR"
node "$EMIT" "proposals/done/proposal.md" --wi-dir "wis" --decisions-log "decisions.jsonl" > /dev/null 2>&1
cd - > /dev/null
WI_COUNT_BEFORE=3
WI_COUNT_AFTER=$(ls "$PROPOSAL_FIXTURE_DIR/wis"/WI-*.md 2>/dev/null | wc -l)
[ "$WI_COUNT_AFTER" = "$WI_COUNT_BEFORE" ] && pass "idempotency case A: no duplicate WIs on re-run" || fail "idempotency broken: $WI_COUNT_BEFORE → $WI_COUNT_AFTER"

# --- Self-exclusion (AC-01.1 amendment) ----------------------------------
TMPDIR2=$(mktemp -d)
mkdir "$TMPDIR2/proposals" "$TMPDIR2/wis"
cp "$FIX_PHASED" "$TMPDIR2/proposals/proposal.md"
# Pre-create a WI whose Source matches leaf P0.1 of the fixture
cat > "$TMPDIR2/wis/WI-999.md" <<'WIEOF'
# WI-999: preexisting

**Type:** feature
**Status:** DRAFT
**Source:** proposals/proposal.md § P0.1

WIEOF
cd "$TMPDIR2"
node "$EMIT" "proposals/proposal.md" --wi-dir "wis" --decisions-log "decisions.jsonl" > emit.out 2>&1
cd - > /dev/null
# Expect 2 emitted (P0.2, P1.1) + skipped entry for P0.1
SKIPPED=$(python3 -c 'import json; d=json.load(open("'"$TMPDIR2"'/emit.out")); print(len(d.get("skipped",[])))' 2>/dev/null || echo 0)
EMITTED_NEW=$(ls "$TMPDIR2/wis"/WI-*.md 2>/dev/null | wc -l)
# WI-999 pre-exists + 2 new = 3 total
if [ "$SKIPPED" = "1" ] && [ "$EMITTED_NEW" = "3" ]; then pass "self-exclusion: P0.1 skipped, 2 new WIs emitted"; else fail "self-exclusion broken (skipped=$SKIPPED, total=$EMITTED_NEW)"; fi

rm -rf "$PROPOSAL_FIXTURE_DIR" "$TMPDIR2"

# --- Atomic WI allocation (WI-098) --------------------------------------
# If another process reserved WI-001.md between nextWiNumber() and write, the
# emitter must skip that number and land on WI-002.md, not clobber WI-001.md.
TMPDIR3=$(mktemp -d)
mkdir -p "$TMPDIR3/proposals" "$TMPDIR3/wis"
cp "$FIX_MONO" "$TMPDIR3/proposals/proposal.md"
# Simulate a concurrent reservation of WI-001.md with distinctive content.
echo "PRE-EXISTING RESERVATION — should not be clobbered" > "$TMPDIR3/wis/WI-001.md"
cd "$TMPDIR3"
node "$EMIT" "proposals/proposal.md" --wi-dir "wis" --decisions-log "decisions.jsonl" > /dev/null 2>&1
cd - > /dev/null
if grep -q "PRE-EXISTING RESERVATION" "$TMPDIR3/wis/WI-001.md" 2>/dev/null; then
  if [ -f "$TMPDIR3/wis/WI-002.md" ] && grep -q "^# WI-002" "$TMPDIR3/wis/WI-002.md"; then
    pass "atomic allocation: pre-existing WI-001 preserved, new work at WI-002 (WI-098)"
  else
    fail "atomic allocation: WI-001 preserved but new work did not land at WI-002"
  fi
else
  fail "atomic allocation: pre-existing WI-001.md was clobbered (parallel-session collision)"
fi
rm -rf "$TMPDIR3"

# --- Self-exclusion via basename match (WI-081 duplicate guard) ---------
# Pre-existing WI's Source references proposals/foo.md (no § anchor for
# monolithic). A parallel re-capture from proposals/done/foo.md must match on
# basename and not emit a duplicate. This reproduces the WI-081 scenario.
TMPDIR4=$(mktemp -d)
mkdir -p "$TMPDIR4/proposals" "$TMPDIR4/wis"
# Place a fresh copy under proposals/ (the 'already-promoted' short-circuit
# triggers on done/ path, so put the file in proposals/ to force the
# basename-match path to fire).
cp "$FIX_MONO" "$TMPDIR4/proposals/already-merged.md"
cat > "$TMPDIR4/wis/WI-500.md" <<'WIEOF'
# WI-500: already handled

**Type:** feature
**Status:** VERIFIED
**Source:** proposals/done/already-merged.md
WIEOF
cd "$TMPDIR4"
node "$EMIT" "proposals/already-merged.md" --wi-dir "wis" --decisions-log "decisions.jsonl" > emit.out 2>&1
cd - > /dev/null
NEW_COUNT=$(ls "$TMPDIR4/wis" | grep -c '^WI-')
if [ "$NEW_COUNT" = "1" ] && grep -q "already handled" "$TMPDIR4/wis/WI-500.md"; then
  pass "self-exclusion: basename match prevents duplicate after proposals/→done/ move (WI-081 guard)"
else
  fail "self-exclusion: basename-match guard failed (new files=$NEW_COUNT)"
fi
rm -rf "$TMPDIR4"

# --- Summary -------------------------------------------------------------
echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  for e in "${FAILS[@]}"; do echo "    - $e"; done
  exit 1
fi
