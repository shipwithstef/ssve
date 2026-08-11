#!/usr/bin/env bash
# test-framework/evals/tier-1/validate-auto-learning-promote-replay.sh
#
# End-to-end replay fixture for WI-343 tranche 2a.
# Proves the full loop: synthetic correction-after-failure session →
# hook captures to gitignored audit log → promote runs in --accept-all
# mode → tracked file receives the entry → re-run is a no-op (dedup).
#
# This is the regression test that locks in tranche 1's capture
# behavior + tranche 2a's promotion behavior together. Future tranches
# that change either component must keep this fixture green.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  fi
}

echo "=== Tier 1: Auto-Learning Promote Replay (end-to-end loop) ==="

# Set up a synthetic repo with a correction-after-failure pattern.
FIX="$TMP/repo"
mkdir -p "$FIX"
git -C "$FIX" init -q
git -C "$FIX" config user.email test@example.com
git -C "$FIX" config user.name "Test User"
mkdir -p "$FIX/references" "$FIX/docs/learnings" "$FIX/.svc"

# Bootstrap the destination tracked file with one pre-existing entry so we
# can verify the appender + dedup against pre-existing content.
printf '{"date":"2026-04-01","skill":"test","type":"baseline","key":"pre-existing","insight":"A pre-existing learning that proves promote does not duplicate.","confidence":7}\n' > "$FIX/references/framework-learnings.jsonl"

printf 'one\n' > "$FIX/file.txt"
git -C "$FIX" add .
git -C "$FIX" commit -qm "initial"
BASE="$(git -C "$FIX" rev-parse HEAD)"
git -C "$FIX" branch -M main
git -C "$FIX" checkout -qb feature-fixture
printf 'two\n' > "$FIX/file.txt"
git -C "$FIX" add file.txt
git -C "$FIX" commit -qm "feat: first attempt at fixture work"
printf 'three\n' > "$FIX/file.txt"
git -C "$FIX" add file.txt
git -C "$FIX" commit -qm "fix(WI-343): restore correct fixture content after first attempt missed edge case"

# Phase 1: hook captures the correction to the gitignored audit log
check "phase 1: hook captures correction-after-failure to audit log" bash -c '
  SVC_AUTO_LEARN_ROOT="$0" \
  SVC_AUTO_LEARN_BASE="$1" \
  SVC_AUTO_LEARN_TIMEOUT_MS=1000 \
  node "$2/hooks/svc-auto-capture-learnings.mjs" --trigger stop
' "$FIX" "$BASE" "$ROOT"

check "phase 1: audit log exists with at least one entry" bash -c '
  [[ -f "$0/.svc/auto-learnings.jsonl" ]] && [[ $(wc -l < "$0/.svc/auto-learnings.jsonl") -ge 1 ]]
' "$FIX"

check "phase 1: tracked file unchanged (still has baseline only)" bash -c '
  [[ $(wc -l < "$0/references/framework-learnings.jsonl") -eq 1 ]] && \
    grep -q "pre-existing" "$0/references/framework-learnings.jsonl"
' "$FIX"

# Phase 2: promote in --accept-all mode runs the explicit promotion
check "phase 2: promote --accept-all writes captured entries to tracked file" bash -c '
  cd "$0" && node "$1/scripts/promote-auto-learnings.mjs" --accept-all
' "$FIX" "$ROOT"

check "phase 2: tracked file gained the correction entry" bash -c '
  grep -q "correction-after-failure" "$0/references/framework-learnings.jsonl"
' "$FIX"

check "phase 2: tracked file still has baseline (append, not overwrite)" bash -c '
  grep -q "pre-existing" "$0/references/framework-learnings.jsonl"
' "$FIX"

# Codex PR #126 review MEDIUM: promoted rows must be transformed to the
# tracked-learning-file shape (date/skill/type/key/...) not raw candidate
# shape (schema_version/captured_at/candidate_target/trigger/...) so that
# hooks/svc-learning-preload.mjs reading l.type does not show "undefined".
check "phase 2: promoted row has learning-file shape, not candidate shape" bash -c '
  set -euo pipefail
  # Find the line we just added (skip the baseline pre-existing entry).
  line=$(grep -v "pre-existing" "$0/references/framework-learnings.jsonl" | head -1)
  [[ -n "$line" ]] || { echo "no promoted line found"; exit 1; }
  node -e "
    const row = JSON.parse(process.argv[1]);
    const required = [\"date\", \"skill\", \"type\", \"key\", \"insight\", \"confidence\", \"source\"];
    for (const k of required) {
      if (!(k in row)) { console.error(\"missing learning-file key: \" + k); process.exit(1); }
    }
    // Forbidden audit-candidate-only fields:
    for (const k of [\"schema_version\", \"captured_at\", \"candidate_target\", \"trigger\", \"session_id\", \"signal\"]) {
      if (k in row) { console.error(\"unexpected candidate-shape key in promoted row: \" + k); process.exit(1); }
    }
    if (!row.type || row.type === \"undefined\") { console.error(\"type field is empty/undefined\"); process.exit(1); }
    if (!row.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(row.date)) { console.error(\"date field is not YYYY-MM-DD: \" + row.date); process.exit(1); }
  " "$line"
' "$FIX"

check "phase 2: audit log drained of promoted entries" bash -c '
  ! grep -q "correction-after-failure" "$0/.svc/auto-learnings.jsonl" 2>/dev/null || \
    [[ ! -s "$0/.svc/auto-learnings.jsonl" ]]
' "$FIX"

# Phase 3: re-run hook + promote — should be a no-op (dedup works across runs)
check "phase 3: re-running hook does not re-capture promoted entry" bash -c '
  SVC_AUTO_LEARN_ROOT="$0" \
  SVC_AUTO_LEARN_BASE="$1" \
  SVC_AUTO_LEARN_TIMEOUT_MS=1000 \
  node "$2/hooks/svc-auto-capture-learnings.mjs" --trigger stop
  # The hook should dedup against framework-learnings.jsonl and produce no
  # new audit-log entries.
  [[ ! -f "$0/.svc/auto-learnings.jsonl" ]] || [[ $(wc -l < "$0/.svc/auto-learnings.jsonl") -eq 0 ]]
' "$FIX" "$BASE" "$ROOT"

check "phase 3: tracked file unchanged after re-run" bash -c '
  [[ $(wc -l < "$0/references/framework-learnings.jsonl") -eq 2 ]]
' "$FIX"

# Phase 4: dry-run mode emits plan without writing
DRY_FIX="$TMP/dry"
cp -r "$FIX" "$DRY_FIX"
# Inject a fresh candidate so dry-run has something to plan
printf '{"schema_version":1,"captured_at":"2026-05-12T16:00:00Z","signal":"correction-after-failure","key":"correction-dryrun-test","insight":"Synthetic candidate for dry-run replay. Pattern: dry-run mode should print plan but not modify any file.","confidence":6,"source":"replay fixture phase 4","session_id":"dry@test@0","candidate_target":"framework-learnings","trigger":"stop"}\n' > "$DRY_FIX/.svc/auto-learnings.jsonl"

check "phase 4: dry-run does not modify tracked files" bash -c '
  cd "$0" && node "$1/scripts/promote-auto-learnings.mjs" --dry-run >/dev/null
  [[ $(wc -l < "$0/references/framework-learnings.jsonl") -eq 2 ]]
' "$DRY_FIX" "$ROOT"

check "phase 4: dry-run leaves audit log intact" bash -c '
  [[ $(wc -l < "$0/.svc/auto-learnings.jsonl") -eq 1 ]] && \
    grep -q "correction-dryrun-test" "$0/.svc/auto-learnings.jsonl"
' "$DRY_FIX"

# Phase 5: filter mode only acts on matching signal
FILTER_FIX="$TMP/filter"
cp -r "$FIX" "$FILTER_FIX"
printf '{"schema_version":1,"captured_at":"2026-05-12T16:00:00Z","signal":"correction-after-failure","key":"correction-filter-a","insight":"Synthetic A for filter test - should be promoted when filter matches correction-after-failure.","confidence":6,"source":"replay fixture phase 5a","session_id":"filter@test@0","candidate_target":"framework-learnings","trigger":"stop"}
{"schema_version":1,"captured_at":"2026-05-12T16:00:00Z","signal":"recursive-failure-observation","key":"recursive-filter-b","insight":"Synthetic B for filter test - should remain in audit log when filter is correction-after-failure.","confidence":7,"source":"replay fixture phase 5b","session_id":"filter@test@0","candidate_target":"framework-learnings","trigger":"stop"}' > "$FILTER_FIX/.svc/auto-learnings.jsonl"

check "phase 5: filter promotes only matching signal" bash -c '
  cd "$0" && node "$1/scripts/promote-auto-learnings.mjs" --accept-all --filter correction-after-failure >/dev/null
  grep -q "correction-filter-a" "$0/references/framework-learnings.jsonl"
' "$FILTER_FIX" "$ROOT"

check "phase 5: filter leaves non-matching signal in audit log" bash -c '
  grep -q "recursive-filter-b" "$0/.svc/auto-learnings.jsonl"
' "$FILTER_FIX"

check "phase 5: filter did not promote non-matching signal" bash -c '
  ! grep -q "recursive-filter-b" "$0/references/framework-learnings.jsonl"
' "$FILTER_FIX"

# Phase 6: data-loss regression + user-memory routing (tranche 2b).
# Two candidates share signal+key but have different candidate_target. The
# framework-target lands in the tracked JSONL; the user-memory target lands
# in the resolver-resolved directory. Both must be removed from the audit
# log via object-reference identity (not signal|key tuple identity, which
# was the Codex PR #126 HIGH finding).
DLOSS_FIX="$TMP/dataloss"
cp -r "$FIX" "$DLOSS_FIX"
# Reset tracked file to baseline-only so the framework-target candidate
# is not dedup-blocked by the prior phase-2/3 promotion.
printf '{"date":"2026-04-01","skill":"test","type":"baseline","key":"pre-existing","insight":"A pre-existing learning that proves promote does not duplicate.","confidence":7}\n' > "$DLOSS_FIX/references/framework-learnings.jsonl"
printf '{"schema_version":1,"captured_at":"2026-05-12T16:00:00Z","signal":"correction-after-failure","key":"shared-signal-key-test","insight":"Synthetic A with target framework-learnings - should promote to tracked file.","confidence":6,"source":"replay phase 6a","session_id":"dloss@test@0","candidate_target":"framework-learnings","trigger":"stop"}
{"schema_version":1,"captured_at":"2026-05-12T16:00:00Z","signal":"correction-after-failure","key":"shared-signal-key-test","insight":"Synthetic B with same signal+key but target user-memory - should now route to the user-memory directory (tranche 2b).","confidence":6,"source":"replay phase 6b","session_id":"dloss@test@0","candidate_target":"user-memory","trigger":"stop"}' > "$DLOSS_FIX/.svc/auto-learnings.jsonl"

# Isolate the user-memory write by pointing HOME at a temp dir so the
# resolver doesn't touch the real ~/.claude/projects/... layout. The
# resolver's slug is derived from process.cwd() inside the fixture repo.
DLOSS_HOME="$TMP/dataloss-home"
mkdir -p "$DLOSS_HOME"

check "phase 6: promote with same-signal-key candidates routed differently" bash -c '
  cd "$0" && HOME="$2" SVC_HOST=claude node "$1/scripts/promote-auto-learnings.mjs" --accept-all >/dev/null
' "$DLOSS_FIX" "$ROOT" "$DLOSS_HOME"

check "phase 6: framework-target candidate promoted to tracked file" bash -c '
  grep -q "Synthetic A with target framework-learnings" "$0/references/framework-learnings.jsonl"
' "$DLOSS_FIX"

check "phase 6: user-memory candidate promoted to resolver-resolved directory" bash -c '
  find "$0/.claude/projects" -type f -name "feedback_shared_signal_key_test.md" | grep -q .
' "$DLOSS_HOME"

check "phase 6: user-memory MEMORY.md index updated with pointer" bash -c '
  find "$0/.claude/projects" -type f -name "MEMORY.md" -exec grep -l "shared-signal-key-test" {} \; | grep -q .
' "$DLOSS_HOME"

check "phase 6: audit log fully drained (both candidates promoted)" bash -c '
  [[ ! -s "$0/.svc/auto-learnings.jsonl" ]] || [[ $(wc -l < "$0/.svc/auto-learnings.jsonl") -eq 0 ]]
' "$DLOSS_FIX"

# Re-run dedup behavior: re-stage the user-memory candidate; verify it is
# blocked as "already present" because the memory file exists.
printf '{"schema_version":1,"captured_at":"2026-05-12T16:00:00Z","signal":"correction-after-failure","key":"shared-signal-key-test","insight":"Synthetic B re-staged - second run must be blocked by file-exists dedup.","confidence":6,"source":"replay phase 6c","session_id":"dloss@test@1","candidate_target":"user-memory","trigger":"stop"}' > "$DLOSS_FIX/.svc/auto-learnings.jsonl"

check "phase 6: re-run blocks user-memory candidate already present on disk" bash -c '
  cd "$0" && HOME="$2" SVC_HOST=claude node "$1/scripts/promote-auto-learnings.mjs" --accept-all 2>&1 | grep -q "already present"
' "$DLOSS_FIX" "$ROOT" "$DLOSS_HOME"

echo ""
echo "auto-learning promote replay: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
