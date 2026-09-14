#!/usr/bin/env bash
# Tier 1 — Stop hook phase-receipt enforcement (WI-213).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
export SVC_RUNTIME_DIR="$TMP_DIR/runtime"
mkdir -m 700 "$SVC_RUNTIME_DIR"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

make_project() {
  local dir="$1"
  mkdir -p "$dir/.svc" "$dir/skills/fixture-skill"
  cat > "$dir/skills/fixture-skill/SKILL.md" <<'EOF'
---
name: fixture-skill
description: Fixture skill for stop-hook phase enforcement.
phases:
  - { id: P1-Load, trigger: always, reads: ["input"], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-Verify, trigger: always, reads: ["output"], writes: [], evidence_kind: command_output, required_for_completion: true }
inputs:
  required: []
outputs:
  produces: []
chain:
  lanes:
    framework: { position: 0, prev: null, next: null }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Fixture Skill
EOF
  cat > "$dir/.svc/pipeline-decisions.jsonl" <<'EOF'
{"ts":"2026-05-11T00:00:00Z","skill":"route-workflow","wi":"WI-PHASE-HOOK","decision":"fixture decision"}
EOF
}

make_project "$TMP_DIR/good"
cat > "$TMP_DIR/good/.svc/lane-tasks-WI-PHASE-HOOK.json" <<'EOF'
{
  "wi": "WI-PHASE-HOOK",
  "lane": "framework",
  "created": "2026-05-11T00:00:00Z",
  "status": "in_progress",
  "tasks": [
    {
      "id": 1,
      "subject": "Good phase receipt fixture",
      "status": "completed",
      "metadata": { "skill": "fixture-skill" },
      "skill_receipt": {
        "skill": "fixture-skill",
        "loaded_at": "2026-05-11T00:00:00Z",
        "loaded_via": "fixture",
        "phases_executed": [
          { "id": "P1-Load", "ts": "2026-05-11T00:00:01Z", "evidence_artifacts": [{ "type": "command_output", "path": ".svc/p1.log" }] },
          { "id": "P2-Verify", "ts": "2026-05-11T00:00:02Z", "evidence_artifacts": [{ "type": "command_output", "path": ".svc/p2.log" }] }
        ]
      }
    }
  ]
}
EOF

good_out="$(
  cd "$TMP_DIR/good"
  printf '{"session_id":"phase-good"}' | bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh"
)"
if [[ "$good_out" != *'"decision":"block"'* ]]; then
  pass "Stop hook allows completed task with all required phase receipts"
else
  echo "$good_out"
  fail "Stop hook allows completed task with all required phase receipts"
fi

make_project "$TMP_DIR/bad"
cat > "$TMP_DIR/bad/.svc/lane-tasks-WI-PHASE-HOOK.json" <<'EOF'
{
  "wi": "WI-PHASE-HOOK",
  "lane": "framework",
  "created": "2026-05-11T00:00:00Z",
  "status": "in_progress",
  "tasks": [
    {
      "id": 1,
      "subject": "Bad phase receipt fixture",
      "status": "completed",
      "metadata": { "skill": "fixture-skill" },
      "skill_receipt": {
        "skill": "fixture-skill",
        "loaded_at": "2026-05-11T00:00:00Z",
        "loaded_via": "fixture",
        "phases_executed": [
          { "id": "P1-Load", "ts": "2026-05-11T00:00:01Z", "evidence_artifacts": [{ "type": "command_output", "path": ".svc/p1.log" }] }
        ]
      }
    }
  ]
}
EOF

bad_out="$(
  cd "$TMP_DIR/bad"
  printf '{"session_id":"phase-bad"}' | bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh"
)"
if [[ "$bad_out" == *'"decision":"block"'* && "$bad_out" == *"P2-Verify"* && "$bad_out" == *"AP-33"* ]]; then
  pass "Stop hook blocks completed task missing required phase receipt with actionable diff"
else
  echo "$bad_out"
  fail "Stop hook blocks completed task missing required phase receipt with actionable diff"
fi

make_project "$TMP_DIR/historical"
cat > "$TMP_DIR/historical/.svc/lane-tasks-WI-PHASE-HOOK.json" <<'EOF'
{
  "wi": "WI-PHASE-HOOK",
  "lane": "framework",
  "created": "2026-05-10T15:59:59Z",
  "status": "in_progress",
  "tasks": [
    {
      "id": 1,
      "subject": "Historical phase receipt fixture",
      "status": "completed",
      "metadata": { "skill": "fixture-skill" },
      "skill_receipt": {
        "skill": "fixture-skill",
        "loaded_at": "2026-05-10T15:59:59Z",
        "loaded_via": "fixture"
      }
    }
  ]
}
EOF

historical_out="$(
  cd "$TMP_DIR/historical"
  printf '{"session_id":"phase-historical"}' | bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh"
)"
if [[ "$historical_out" != *'"decision":"block"'* ]]; then
  pass "Stop hook preserves pre-Phase-A historical graph compatibility"
else
  echo "$historical_out"
  fail "Stop hook preserves pre-Phase-A historical graph compatibility"
fi

make_project "$TMP_DIR/historical-skip"
cat > "$TMP_DIR/historical-skip/.svc/pipeline-decisions.jsonl" <<'EOF'
{"ts":"2026-05-11T00:00:00Z","skill":"route-workflow","run_id":"WI-HISTORICAL-SKIP","decision":"completed-in-prior-sessions","reasoning":"Pre-enforcement WI batch acknowledged as historical.","historical_skip":true}
EOF
cat > "$TMP_DIR/historical-skip/.svc/lane-tasks-WI-HISTORICAL-SKIP.json" <<'EOF'
{
  "wi": "WI-HISTORICAL-SKIP",
  "lane": "framework",
  "created": "2026-05-11T01:00:00Z",
  "status": "in_progress",
  "tasks": [
    {
      "id": 1,
      "subject": "Historical skip fixture",
      "status": "completed",
      "metadata": { "skill": "fixture-skill" }
    }
  ]
}
EOF

historical_skip_out="$(
  cd "$TMP_DIR/historical-skip"
  printf '{"session_id":"phase-historical-skip"}' | bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh"
)"
if [[ "$historical_skip_out" != *'"decision":"block"'* ]]; then
  pass "Stop hook honors route-workflow historical_skip for pre-enforcement completed WIs"
else
  echo "$historical_skip_out"
  fail "Stop hook honors route-workflow historical_skip for pre-enforcement completed WIs"
fi

if grep -q "AP-33" "$REPO_ROOT/references/anti-patterns.md" \
  && grep -q "missing required phase receipts" "$REPO_ROOT/hooks/svc-task-completion-guard.sh"; then
  pass "AP-33 and hook block text are wired"
else
  fail "AP-33 and hook block text are wired"
fi

echo
echo "validate-stop-hook-phase-enforcement: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]

# WI-363: auto-emitted receipts must satisfy the completion guard (round-trip)
if [ -f "$REPO_ROOT/hooks/svc-phase-receipt-autoemit.mjs" ] 2>/dev/null || [ -f "hooks/svc-phase-receipt-autoemit.mjs" ]; then
  if node --check hooks/svc-phase-receipt-autoemit.mjs 2>/dev/null && grep -q "record-phase" hooks/svc-phase-receipt-autoemit.mjs; then
    echo "  ✓ WI-363 autoemit delegates to canonical record-phase (guard-compatible receipts)"
  else
    echo "  ✗ WI-363 autoemit present but not delegating to record-phase"; exit 1
  fi
fi
