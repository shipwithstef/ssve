#!/usr/bin/env bash
# Tier 1: end-to-end session mode must not stop on permission-seeking trailers.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAIL=0

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

run_stop() {
  local dir="$1"
  local message="$2"
  (
    cd "$dir"
    printf '{"session_id":"e2e-%s","last_assistant_message":%s}\n' \
      "$(date +%s%N)" \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$message")" |
      bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh"
  )
}

mkdir -p "$TMP_DIR/end-to-end/.svc" "$TMP_DIR/neutral/.svc"
cat > "$TMP_DIR/end-to-end/.svc/session-contract.jsonl" <<'EOF'
{"ts":"2026-05-10T12:00:00Z","bound_to":"framework-evolution","execution_mode":"end_to_end","request":"continue until done","wi":null,"skill":"route-workflow","guard_override_count":0}
EOF

cat > "$TMP_DIR/neutral/.svc/session-contract.jsonl" <<'EOF'
{"ts":"2026-05-10T12:00:00Z","bound_to":"framework-evolution","request":"single task","wi":null,"skill":"route-workflow","guard_override_count":0}
EOF

BLOCK_OUT="$(run_stop "$TMP_DIR/end-to-end" "Validation found the next gap. If you want, I can continue with it." || true)"
if ! grep -q '"decision":"block"' <<<"$BLOCK_OUT"; then
  fail "end_to_end mode did not block permission-seeking trailer"
fi

ALLOW_OUT="$(run_stop "$TMP_DIR/end-to-end" "Validation found the next gap. Continuing with the next fix now." || true)"
if grep -q '"decision":"block"' <<<"$ALLOW_OUT"; then
  fail "end_to_end mode blocked an action-oriented continuation"
fi

NEUTRAL_OUT="$(run_stop "$TMP_DIR/neutral" "If you want, I can continue with it." || true)"
if grep -q '"decision":"block"' <<<"$NEUTRAL_OUT"; then
  fail "neutral session mode should not enforce end_to_end trailer rules"
fi

if [[ $FAIL -gt 0 ]]; then
  echo "=== Tier 1: End-to-End Stop Hook ==="
  echo "  FAIL - $FAIL checks failed"
  exit 1
fi

echo "=== Tier 1: End-to-End Stop Hook ==="
echo "  PASS - end_to_end sessions block permission-seeking stop trailers"
