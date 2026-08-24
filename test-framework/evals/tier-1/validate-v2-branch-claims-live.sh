#!/usr/bin/env bash
# WI-562 V-2: REAL dispatch-worker branch-claim behavior — live-owner fast-exit
# with branch_busy summary, stale-claim steal (death proof), slash-safe hashing.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
check() { local label="$1"; shift; if "$@" >"$TMP/out" 2>&1; then echo "  ✓ $label"; pass=$((pass+1)); else echo "  ✗ $label"; cat "$TMP/out"; fail=$((fail+1)); fi; }

echo "=== Tier 1: V-2 dispatch-worker branch claims ==="

FIX="$TMP/fix"
git -C "$TMP" init --quiet "$FIX"
git -C "$FIX" config user.email t@i; git -C "$FIX" config user.name t
mkdir -p "$FIX/src" "$FIX/.svc/dispatch"
echo x >"$FIX/f.txt"
(cd "$FIX" && env -u GIT_DIR -u GIT_WORK_TREE git add -A && env -u GIT_DIR -u GIT_WORK_TREE git commit --quiet -m base)

FAKEBIN="$TMP/fakebin"; mkdir -p "$FAKEBIN"
printf '#!/usr/bin/env bash\necho done\n' >"$FAKEBIN/claude"
chmod +x "$FAKEBIN/claude"

SLASH_BRANCH="feature/wi-900/some-slice"
CLAIM_DIR="$FIX/.git/svc-wave-branch-claims"

check "first worker with claim completes" \
  bash -c "cd '$FIX' && PATH='$FAKEBIN':\$PATH SVC_WORKER_WI=WI-901 SVC_HARNESS=claude SVC_SKIP_WORKER_QUALITY=1 SVC_WORKER_MUTATION=false SVC_WORKER_BRANCH_CLAIM='$SLASH_BRANCH' bash '$ROOT/scripts/dispatch-worker.sh' 'payload' >/dev/null 2>&1"

if [[ -z "$(ls -A "$CLAIM_DIR" 2>/dev/null)" ]]; then
  check "claim released via EXIT trap after success" true
else
  check "claim released via EXIT trap after success" false
fi

CLAIM_HASH="$(printf '%s' "$SLASH_BRANCH" | sha256sum | cut -d' ' -f1)"
mkdir -p "$CLAIM_DIR/$CLAIM_HASH"
printf '%s\n%s\n%s\n%s\n' "$$" "$(hostname)" "" "$(date -u +%FT%TZ)" >"$CLAIM_DIR/$CLAIM_HASH/owner"
OUT2="$(cd "$FIX" && PATH="$FAKEBIN:$PATH" SVC_WORKER_WI=WI-901 SVC_HARNESS=claude SVC_SKIP_WORKER_QUALITY=1 SVC_WORKER_MUTATION=false SVC_WORKER_BRANCH_CLAIM="$SLASH_BRANCH" bash "$ROOT/scripts/dispatch-worker.sh" 'payload' 2>/dev/null || true)"
if grep -q "^status: branch_busy" <<<"$OUT2"; then
  check "live owner gives immediate branch_busy summary (no wait)" true
else
  check "live owner gives immediate branch_busy summary (no wait)" false
fi
[[ -f "$CLAIM_DIR/$CLAIM_HASH/owner" ]] && check "busy path leaves live owner's claim intact" true || check "busy path leaves live owner's claim intact" false

printf '%s\n%s\n%s\n%s\n' "4194999" "$(hostname)" "99999" "$(date -u +%FT%TZ)" >"$CLAIM_DIR/$CLAIM_HASH/owner"
OUT3="$(cd "$FIX" && PATH="$FAKEBIN:$PATH" SVC_WORKER_WI=WI-901 SVC_HARNESS=claude SVC_SKIP_WORKER_QUALITY=1 SVC_WORKER_MUTATION=false SVC_WORKER_BRANCH_CLAIM="$SLASH_BRANCH" bash "$ROOT/scripts/dispatch-worker.sh" 'payload' 2>/dev/null || true)"
if ! grep -q "^status: branch_busy" <<<"$OUT3"; then
  check "dead-owner stale claim stolen (death proof) and work proceeds" true
else
  check "dead-owner stale claim stolen (death proof) and work proceeds" false
fi

echo "validate-v2-branch-claims-live: $pass passed, $fail failed"
[[ $fail -eq 0 ]]
