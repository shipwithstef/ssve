#!/usr/bin/env bash
# Tier 1: completion-guard pressure contract (WI-183 → WI-399 A6 supersession).
#
# History:
#   WI-183: the guard must not silently age out — agents were escaping with
#     actionable work remaining. Contract then: block forever.
#   WI-399 A6 (2026-06-10, user-authorized capability audit R3): block-forever
#     wedges sessions on STALE state — the guard printed 5/3 and kept
#     hard-blocking, and pressured sessions to execute FOREIGN-claimed WIs
#     (learning completion-guard-foreign-claim-resolution, c8, fired 2x).
#
# Reconciled contract (this validator asserts BOTH concerns):
#   1. The first SVC_COMPLETION_MAX attempts BLOCK (WI-183: lazy-agent
#      pressure intact).
#   2. Attempt MAX+1 downgrades to a LOUD advisory on stderr + exit 0
#      (WI-399 A6: no infinite wedge; the user decides).
#   3. A WI claimed by a DIFFERENT live session (host-session-shaped id,
#      fresh claim) downgrades to advisory instead of pressuring a dual-claim
#      (WI-352 crosstalk class).
#   4. FAIL_OPEN stays explicit.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-task-completion-guard.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

mkdir -p "$TMP_DIR/.svc"
cat > "$TMP_DIR/.svc/lane-tasks-WI-max.json" <<'JSON'
{
  "wi": "WI-max",
  "lane": "bugfix",
  "tasks": [
    {"id": 1, "skill": "diagnose-bug", "subject": "diagnose", "status": "pending", "blocked_by": []}
  ]
}
JSON

SESSION_ID="0123456789abcdef0123456789abcdef-fixture-$$"
INPUT="$TMP_DIR/stop-input.json"
printf '{"session_id":"%s"}' "$SESSION_ID" > "$INPUT"

echo "=== Tier 1: completion guard pressure contract (WI-183 + WI-399 A6) ==="

blocked=0
advisory_at_4=""
for attempt in 1 2 3 4; do
  out_file="$TMP_DIR/attempt-$attempt.out"
  err_file="$TMP_DIR/attempt-$attempt.err"
  (
    cd "$TMP_DIR"
    SVC_COMPLETION_MAX=3 bash "$HOOK" < "$INPUT"
  ) > "$out_file" 2> "$err_file" || true
  if grep -q '"decision":"block"' "$out_file"; then
    blocked=$((blocked + 1))
  elif [[ "$attempt" -eq 4 ]]; then
    advisory_at_4="$(cat "$err_file")"
  fi
done

if [[ "$blocked" -eq 3 ]]; then
  pass "first 3 stop attempts block while actionable work remains (WI-183 concern intact)"
else
  fail "expected exactly 3 blocking attempts, got $blocked"
fi

if [[ -n "$advisory_at_4" ]] && echo "$advisory_at_4" | grep -q "advisory (cap 3 reached"; then
  pass "attempt 4 downgrades to a LOUD advisory instead of an infinite wedge (WI-399 A6)"
else
  fail "attempt 4 did not produce the cap advisory (got: $(head -c 120 "$TMP_DIR/attempt-4.err" 2>/dev/null))"
fi

# --- foreign-claim downgrade (fresh counter via new session id) -------------
SESSION_B="fedcba9876543210fedcba9876543210-fixture-$$"
printf '{"session_id":"%s"}' "$SESSION_B" > "$INPUT"
mkdir -p "$TMP_DIR/.svc/claims"
printf '{"wi":"WI-max","session":"019f616a-0000-7000-8000-000000000099","renewed_at":"%s","ttl_hours":24}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$TMP_DIR/.svc/claims/WI-max.claim.json"
foreign_out="$TMP_DIR/foreign.out"
foreign_err="$TMP_DIR/foreign.err"
(
  cd "$TMP_DIR"
  SVC_COMPLETION_MAX=3 bash "$HOOK" < "$INPUT"
) > "$foreign_out" 2> "$foreign_err" || true
if ! grep -q '"decision":"block"' "$foreign_out" && grep -q "DIFFERENT live session" "$foreign_err"; then
  pass "fresh foreign-session claim downgrades pressure to advisory (no dual-claim)"
else
  fail "foreign-claim case did not downgrade (out: $(head -c 80 "$foreign_out"))"
fi

# unattributable claim (no host-session-shaped id) keeps pressure
SESSION_C="aaaabbbbccccddddaaaabbbbccccdddd-fixture-$$"
printf '{"session_id":"%s"}' "$SESSION_C" > "$INPUT"
printf '{"wi":"WI-max","claimed_by":"claude-fable-5","lane":"bugfix"}' \
  > "$TMP_DIR/.svc/claims/WI-max.claim.json"
unattr_out="$TMP_DIR/unattr.out"
(
  cd "$TMP_DIR"
  SVC_COMPLETION_MAX=3 bash "$HOOK" < "$INPUT"
) > "$unattr_out" 2>/dev/null || true
if grep -q '"decision":"block"' "$unattr_out"; then
  pass "unattributable claim keeps pressure (negative fixture — gate still bites)"
else
  fail "unattributable claim unexpectedly downgraded"
fi

# --- explicit fail-open still works ------------------------------------------
fail_open_out="$TMP_DIR/fail-open.out"
(
  cd "$TMP_DIR"
  SVC_COMPLETION_FAIL_OPEN=true bash "$HOOK" < "$INPUT"
) > "$fail_open_out" 2>&1 || true
if ! grep -q '"decision":"block"' "$fail_open_out"; then
  pass "explicit SVC_COMPLETION_FAIL_OPEN=true bypasses the block"
else
  fail "fail-open override still emitted a block"
fi

echo ""
echo "completion guard pressure contract: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
