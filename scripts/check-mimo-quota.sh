#!/bin/bash
# scripts/check-mimo-quota.sh
#
# Pings MiMo Pro endpoint with a minimal request. Reports availability so
# execute-changeset can decide MiMo vs Sonnet-fallback routing.
#
# Exit codes:
#   0  — MiMo Pro quota available (use it)
#   1  — MiMo Pro quota exhausted / service unreachable (fallback to Sonnet)
#   2  — required credentials missing (configuration error, fallback to Sonnet
#         but log clearly so user knows to fix)
#
# Stdout (single line):
#   USE_MIMO_PRO       — MiMo Pro ready
#   USE_SONNET         — fallback (any reason)
#   (plus a reason on stderr for humans)
#
# Source of truth for MiMo creds: per-project .env.local or global env vars.
# Required: MIMO_API_KEY, ANTHROPIC_BASE_URL (defaults to token-plan-ams)
set -u

: "${MIMO_API_KEY:=}"
: "${ANTHROPIC_BASE_URL:=https://token-plan-ams.xiaomimimo.com/anthropic}"

if [ -z "$MIMO_API_KEY" ]; then
  echo "check-mimo-quota: MIMO_API_KEY not set — cannot probe MiMo, falling back to Sonnet" >&2
  echo "USE_SONNET"
  exit 2
fi

# Minimal probe — 10 tokens max, 8s hard ceiling
PROBE_RESPONSE=$(timeout 8 curl -sS -w "\n%{http_code}" \
  -X POST "${ANTHROPIC_BASE_URL}/v1/messages" \
  -H "x-api-key: $MIMO_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"xiaomi/mimo-v2-pro","max_tokens":5,"messages":[{"role":"user","content":"ok"}]}' \
  2>/dev/null) || {
  echo "check-mimo-quota: MiMo probe timed out / network error, falling back to Sonnet" >&2
  echo "USE_SONNET"
  exit 1
}

HTTP_CODE=$(echo "$PROBE_RESPONSE" | tail -1)
BODY=$(echo "$PROBE_RESPONSE" | head -n -1)

case "$HTTP_CODE" in
  200)
    echo "check-mimo-quota: MiMo Pro 200 OK — quota available" >&2
    echo "USE_MIMO_PRO"
    exit 0
    ;;
  429)
    echo "check-mimo-quota: MiMo Pro 429 (rate-limited / quota exhausted), falling back to Sonnet" >&2
    echo "USE_SONNET"
    exit 1
    ;;
  402|403)
    echo "check-mimo-quota: MiMo Pro $HTTP_CODE (billing / auth denied), falling back to Sonnet" >&2
    echo "USE_SONNET"
    exit 1
    ;;
  5*)
    echo "check-mimo-quota: MiMo Pro $HTTP_CODE (server error), falling back to Sonnet" >&2
    echo "USE_SONNET"
    exit 1
    ;;
  *)
    echo "check-mimo-quota: MiMo Pro unexpected status $HTTP_CODE — response: $(echo "$BODY" | head -c 200)" >&2
    echo "USE_SONNET"
    exit 1
    ;;
esac
