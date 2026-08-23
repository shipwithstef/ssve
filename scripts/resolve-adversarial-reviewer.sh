#!/usr/bin/env bash
# Compatibility policy view for the canonical external-review launcher.
# This adapter performs no availability probe and never invokes a paid model.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

detect_orchestrator() {
  if [[ -n "${SVC_HOST:-}" ]]; then printf '%s\n' "$SVC_HOST"; return; fi
  if [[ -n "${CODEX_THREAD_ID:-}" || -n "${CODEX_HOME:-}" || -n "${CODEX_CLI:-}" ]]; then
    printf '%s\n' codex
    return
  fi
  local detected
  detected="$(bash "$SCRIPT_DIR/detect-host.sh" 2>/dev/null || true)"
  if [[ "$detected" != "unknown" && -n "$detected" ]]; then
    printf '%s\n' "$detected"
    return
  fi
  printf '%s\n' claude
}

policy_schema_version() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf '%s\n' "missing"
    return 0
  fi
  node -e 'const fs=require("fs");try{const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(d?.schema_version ?? "unknown"));}catch{process.stdout.write("invalid");}' "$file"
}

ORCHESTRATOR="$(detect_orchestrator)"
POLICY_PATH="${SVC_DISPATCH_POLICY:-${SVC_REVIEWER_POLICY:-$HOME/.svc/dispatch-policy.json}}"
POLICY_SCHEMA="$(policy_schema_version "$POLICY_PATH")"
case "$ORCHESTRATOR" in
  agy)
    printf 'resolve-adversarial-reviewer: AGY is reviewer transport only and cannot orchestrate review routing\n' >&2
    exit 1
    ;;
  claude|codex|grok|cursor|gemini|kimi|opencode|antigravity|mimo-code)
    if [[ "$POLICY_SCHEMA" == "1" || "$POLICY_SCHEMA" == "2" ]]; then
      exec node "$SCRIPT_DIR/run-external-review.mjs" --policy-status --orchestrator "$ORCHESTRATOR" --reviewer-config "$POLICY_PATH" --reviewer-phase plan
    fi
    exec node "$SCRIPT_DIR/resolve-dispatch.mjs" policy-status --orchestrator "$ORCHESTRATOR" --phase plan --config "$POLICY_PATH"
    ;;
  *)
    printf 'resolve-adversarial-reviewer: unsupported orchestrator %q\n' "$ORCHESTRATOR" >&2
    exit 1
    ;;
esac
