#!/bin/bash
# hooks/grok/svc-grok-task-completion-guard.sh
#
# Adapter wrapper for svc-task-completion-guard.sh on Grok Build CLI.
# Reads JSON from stdin (Grok Stop event) and forwards to the completion guard.
# Translates decision output into Grok-compatible exit codes:
#   - If guard blocks -> exit 2 (hard block in Grok)
#   - If guard allows -> exit 0

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [[ "$HOOK_DIR" == */grok ]]; then
  SCRIPT_DIR="$(cd "$HOOK_DIR/../.." && pwd)"
else
  SCRIPT_DIR="$(cd "$HOOK_DIR/.." && pwd)/skills"
fi

PAYLOAD=$(cat 2>/dev/null || echo "{}")

CWD=$(echo "$PAYLOAD" | node -e "
try {
  const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  console.log(d.cwd || '');
} catch {
  console.log('');
}
" 2>/dev/null || echo "")

TARGET_DIR="${CWD:-$PWD}"

OUTPUT=$(cd "$TARGET_DIR" && printf '%s' "$PAYLOAD" | bash "$SCRIPT_DIR/hooks/svc-task-completion-guard.sh" 2>/dev/null || true)

if [ -n "$OUTPUT" ]; then
  echo "$OUTPUT"
fi

if echo "$OUTPUT" | grep -q '"decision"\s*:\s*"block"'; then
  REASON=$(echo "$OUTPUT" | node -e '
    try {
      const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
      console.log(d.reason || "Stop blocked by svc completion guard.");
    } catch (e) {
      console.log("Stop blocked by svc completion guard.");
    }
  ' 2>/dev/null || echo "Stop blocked by svc completion guard.")
  echo "$REASON" >&2
  exit 2
fi

exit 0
