#!/usr/bin/env bash
# validate-kimi-detached-runner.sh — Tier 1 static + smoke validation for
# the detached Kimi runner (WI-125).
#
# COST: $0 — does not invoke kimi. Smoke-launches the runner with a stub
# kimi binary on PATH so it returns immediately.
#
# Checks:
#   1. scripts/run-kimi-detached.sh exists and is executable.
#   2. scripts/kimi-job-status.sh exists and is executable.
#   3. scripts/kimi-job-cleanup.sh exists and is executable.
#   4. references/kimi-detached-pattern.md exists.
#   5. references/model-routing.md contains KIMI_DETACHED_CAPS block.
#   6. run-kimi-detached.sh --help exits non-zero (usage) and documents flags.
#   7. Smoke launch with stub kimi: returns valid JSON in <2s.
#   8. Job registry append works (line added).
#   9. kimi-job-status.sh reports `done` for the smoke job within 5s.
#  10. KIMI_DETACHED_HARD_CAP truncates a caller-requested oversize cap.
#
# Exit 0: all pass.  Exit 1: any failure.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ERRORS=0
TMP_DIR="$(mktemp -d)"
STUB_BIN="$TMP_DIR/bin"
mkdir -p "$STUB_BIN"

cleanup() {
  rm -rf "$TMP_DIR"
  # Remove smoke job artifacts (only the ones we created)
  if [ -n "${SMOKE_JOB_ID:-}" ]; then
    rm -f "/tmp/svc-kimi-jobs/${SMOKE_JOB_ID}".* 2>/dev/null || true
  fi
}
trap cleanup EXIT

fail() { echo "  ✗ $1"; ERRORS=$((ERRORS + 1)); }
pass() { echo "  ✓ $1"; }

# Stub kimi: reads stdin, exits 0 immediately.
cat > "$STUB_BIN/kimi" <<'EOS'
#!/usr/bin/env bash
cat >/dev/null || true
echo "stub kimi response"
exit 0
EOS
chmod +x "$STUB_BIN/kimi"

RUNNER="$REPO_ROOT/scripts/run-kimi-detached.sh"
STATUS="$REPO_ROOT/scripts/kimi-job-status.sh"
CLEAN="$REPO_ROOT/scripts/kimi-job-cleanup.sh"
DOC="$REPO_ROOT/references/kimi-detached-pattern.md"
ROUTING="$REPO_ROOT/references/model-routing.md"

echo "=== validate-kimi-detached-runner ==="

# 1
if [ -x "$RUNNER" ]; then pass "runner exists+exec"; else fail "runner missing or not exec: $RUNNER"; fi
# 2
if [ -x "$STATUS" ]; then pass "status script exists+exec"; else fail "status script missing or not exec"; fi
# 3
if [ -x "$CLEAN" ]; then pass "cleanup script exists+exec"; else fail "cleanup script missing or not exec"; fi
# 4
if [ -r "$DOC" ]; then pass "pattern doc exists"; else fail "pattern doc missing: $DOC"; fi
# 5
if grep -q 'KIMI_DETACHED_CAPS_BEGIN' "$ROUTING" && grep -q 'KIMI_DETACHED_CAPS_END' "$ROUTING"; then
  pass "model-routing.md has KIMI_DETACHED_CAPS block"
else
  fail "KIMI_DETACHED_CAPS markers missing in $ROUTING"
fi
# 6
HELP_OUT="$("$RUNNER" --help 2>&1 || true)"
if printf '%s' "$HELP_OUT" | grep -q -- '--skill' && printf '%s' "$HELP_OUT" | grep -q -- '--prompt-file'; then
  pass "--help documents flags"
else
  fail "--help did not surface --skill / --prompt-file"
fi

# 7-9 smoke launch
PROMPT_FILE="$TMP_DIR/prompt.txt"
echo "smoke" > "$PROMPT_FILE"

START=$(date +%s%N)
RESP="$(PATH="$STUB_BIN:$PATH" "$RUNNER" --skill validate-smoke --prompt-file "$PROMPT_FILE" --max-seconds 30 2>&1)"
END=$(date +%s%N)
ELAPSED_MS=$(( (END - START) / 1000000 ))

if [ "$ELAPSED_MS" -lt 2000 ]; then
  pass "smoke launch returned in ${ELAPSED_MS}ms (<2s)"
else
  fail "smoke launch took ${ELAPSED_MS}ms (>=2s)"
fi

SMOKE_JOB_ID="$(printf '%s' "$RESP" | sed -n 's/.*"job_id":"\([^"]*\)".*/\1/p')"
if [ -n "$SMOKE_JOB_ID" ]; then
  pass "smoke launch returned job_id=$SMOKE_JOB_ID"
else
  fail "smoke launch did not return job_id. Output: $RESP"
fi

# 8 registry append
if [ -r /tmp/svc-kimi-jobs/index.jsonl ] && grep -q "$SMOKE_JOB_ID" /tmp/svc-kimi-jobs/index.jsonl; then
  pass "registry appended"
else
  fail "registry missing job entry for $SMOKE_JOB_ID"
fi

# 9 wait up to 5s for done state (stub returns immediately)
DONE=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  STATUS_OUT="$(PATH="$STUB_BIN:$PATH" "$STATUS" "$SMOKE_JOB_ID" 2>&1 || true)"
  STATE="$(printf '%s' "$STATUS_OUT" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')"
  if [ "$STATE" = "done" ]; then DONE=1; break; fi
  sleep 0.5
done
if [ "$DONE" = "1" ]; then
  pass "kimi-job-status reports done within 5s"
else
  fail "kimi-job-status did not reach done. Last: $STATUS_OUT"
fi

# 10 hard-cap truncation
RESP2="$(KIMI_DETACHED_HARD_CAP=600 PATH="$STUB_BIN:$PATH" "$RUNNER" \
          --skill validate-smoke --prompt-file "$PROMPT_FILE" --max-seconds 9999 2>&1)"
JOB2="$(printf '%s' "$RESP2" | sed -n 's/.*"job_id":"\([^"]*\)".*/\1/p')"
CAP2="$(printf '%s' "$RESP2" | sed -n 's/.*"max_seconds":\([0-9]*\).*/\1/p')"
if [ "$CAP2" = "600" ]; then
  pass "KIMI_DETACHED_HARD_CAP truncated 9999→600"
else
  fail "hard cap not enforced: got max_seconds=$CAP2 (expected 600). Output: $RESP2"
fi
[ -n "$JOB2" ] && rm -f "/tmp/svc-kimi-jobs/${JOB2}".* 2>/dev/null || true

echo
if [ "$ERRORS" -eq 0 ]; then
  echo "=== PASS ==="
  exit 0
else
  echo "=== FAIL: $ERRORS error(s) ==="
  exit 1
fi
