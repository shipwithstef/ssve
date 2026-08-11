#!/usr/bin/env bash
# Compatibility policy view for the canonical external-review launcher.
# This adapter performs no availability probe and never invokes a paid model.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

detect_orchestrator() {
  if [[ -n "${SVC_HOST:-}" ]]; then printf '%s\n' "$SVC_HOST"; return; fi
  local detected
  detected="$(bash "$SCRIPT_DIR/detect-host.sh" 2>/dev/null || true)"
  case "$detected" in claude|codex) printf '%s\n' "$detected"; return ;; esac
  printf '%s\n' claude
}

ORCHESTRATOR="$(detect_orchestrator)"
case "$ORCHESTRATOR" in
  claude|codex)
    exec node "$SCRIPT_DIR/run-external-review.mjs" --policy-status --orchestrator "$ORCHESTRATOR"
    ;;
  *)
    printf 'resolve-adversarial-reviewer: unsupported orchestrator %q; canonical external review supports claude and codex only\n' "$ORCHESTRATOR" >&2
    exit 1
    ;;
esac
