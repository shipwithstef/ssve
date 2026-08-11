#!/usr/bin/env bash
# Hard-block Stop closeouts that delegate runtime verification to the user or
# substitute V0 bundle-grep evidence for browser-visible runtime verification.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SVC_REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

if truthy "${SVC_VERIFICATION_GUARD_DISABLE:-false}"; then
  exit 0
fi

INPUT="$(cat || true)"
if [[ -z "$INPUT" ]]; then
  exit 0
fi

OUTPUT=""
if ! OUTPUT="$(printf '%s' "$INPUT" | node "$REPO_ROOT/scripts/verification-stop-guard.mjs" 2>&1)"; then
  echo "svc verification guard: fail-open after scanner error: $OUTPUT" >&2
  exit 0
fi

# WI-487 (F-003/AC-487-7): the block emission from verification-stop-guard.mjs is
# a Stop-class {decision:"block"} payload. ADDITIVE contract: when it blocks, ALSO
# emit the canonical 5-field actionable-denial envelope + a durable receipt (so a
# stderr-swallowing host recovers the diagnostic), while KEEPING the EXACT prior
# host-visible output — the {decision:"block"} + WI-id JSON on stdout AND exit 0
# (the Stop {decision:block} contract; validators run the hook expecting exit 0).
# A non-block advisory passes through unchanged.
if [[ -n "$OUTPUT" ]]; then
  if printf '%s' "$OUTPUT" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
    if [ -f "$REPO_ROOT/hooks/lib/emit-denial.sh" ]; then
      # shellcheck source=hooks/lib/emit-denial.sh
      . "$REPO_ROOT/hooks/lib/emit-denial.sh"
      svc_emit_denial \
        "svc-verification-delegation-guard" \
        "SVC-VERIFICATION-DELEGATION-BLOCK" \
        "closeout blocked by AP-31 / V-ladder: behavioral verification delegated to the user or bundle-grep substituted for runtime evidence. $(printf '%s' "$OUTPUT" | tr '\n' ' ' | head -c 900)" \
        "Stop closeout of a browser-visible WI without cited runtime evidence" \
        "Capture and cite V1/V2/V3 runtime evidence (live DOM / screenshot / Playwright), or log a legitimate V2-exhaustion before any V3 handoff. Never delegate behavioral verification to the user. See AP-31 / V-ladder."
    fi
    printf '%s\n' "$OUTPUT"
    exit 0
  fi
  printf '%s\n' "$OUTPUT"
fi
