#!/usr/bin/env bash
# Hard-block VERIFIED WI edits when the Pillar Revisit Audit is incomplete.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SVC_REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

INPUT="$(cat || true)"

# Pass the payload to node via STDIN, never as an env var: envp counts toward
# ARG_MAX just like argv, so a large Edit payload (full file content) trips
# `Argument list too long` (E2BIG) and, under `set -e`, hard-aborts the hook.
# The -e script is fixed and tiny (never trips ARG_MAX); `2>/dev/null || true`
# guarantees this extraction can never abort the hook on any node failure.
FILE_PATH="$(
  printf '%s' "$INPUT" | node -e '
let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw || "{}");
    const toolInput = payload.tool_input || payload.toolInput || payload;
    process.stdout.write(toolInput.file_path || toolInput.path || "");
  } catch {
    process.stdout.write("");
  }
});' 2>/dev/null || true
)"

if [[ ! "$FILE_PATH" =~ docs/specs/work-items/WI-.*\.md$ ]]; then
  exit 0
fi

# WI-487 (F-003/AC-487-7): run the pillar audit; on a would-be block, emit an
# ACTIONABLE denial ({hook_id,reason_code,cause,operation,recovery} + durable
# receipt) via the shared helper instead of an anonymous `exit 1`, then hard-block
# with exit 2 (the canonical svc hard-block contract). A durable receipt gives
# stderr-swallowing hosts the diagnostic. Fail-open only if the helper is absent.
# Capture verify output + its EXACT exit code. The `if` form is required under
# `set -euo pipefail`: a bare failing assignment would abort the script (exit 1)
# BEFORE the actionable denial can be emitted; the if-condition consumes the
# failure so we reach the emitDenial path.
if PILLARS_OUT="$(node "$REPO_ROOT/scripts/verify-wi-pillars.mjs" "$FILE_PATH" 2>&1)"; then
  PILLARS_RC=0
else
  PILLARS_RC=$?
fi
PILLARS_OUT="$(printf '%s' "$PILLARS_OUT" | head -40)"
if [ "$PILLARS_RC" -eq 0 ]; then
  [ -n "$PILLARS_OUT" ] && printf '%s\n' "$PILLARS_OUT"
  exit 0
fi
if [ -f "$REPO_ROOT/hooks/lib/emit-denial.sh" ]; then
  # shellcheck source=hooks/lib/emit-denial.sh
  . "$REPO_ROOT/hooks/lib/emit-denial.sh"
  # resolved_command_path is per-file so distinct WI files never dedup each other
  # (dedup must suppress OUTPUT only for the SAME file repeated — AC-487-8).
  svc_emit_denial \
    "svc-wi-pillars-check" \
    "SVC-WI-PILLARS-BLOCK" \
    "${PILLARS_OUT:-Pillar Revisit Audit is incomplete for $FILE_PATH}" \
    "edit of a VERIFIED work item ($FILE_PATH)" \
    "Complete the Pillar Revisit Audit in the WI before marking it VERIFIED; re-run scripts/verify-wi-pillars.mjs $FILE_PATH until it passes." \
    "$FILE_PATH"
else
  printf '%s\n' "$PILLARS_OUT" >&2
fi
exit 2
