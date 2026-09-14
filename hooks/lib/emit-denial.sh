# emit-denial.sh — WI-487 (F-003/AC-487-7) bash actionable-denial helper.
#
# Source this from any bash blocking hook and call `svc_emit_denial` at the
# block point. It prints the IDENTICAL 5-field machine denial envelope
# ({hook_id,reason_code,cause,operation,recovery}) that the JS hooks emit AND
# writes a durable per-session denial receipt — by shelling `node` into the
# canonical hooks/lib/hook-denial.mjs `emitDenial` (single source of truth; this
# helper owns NO copy of the envelope/receipt logic).
#
# The CALLER decides the exit code after calling this (2 for a hard block, or a
# Stop-class hook may also print its {decision:"block"} stdout then exit).
#
# Usage:
#   source "$REPO_ROOT/hooks/lib/emit-denial.sh"
#   svc_emit_denial <hook_id> <reason_code> <cause> <operation> <recovery> [resolved_command_path]
#   exit 2
#
# Resolution of the emitter: $SVC_EMIT_DENIAL_HD, else $REPO_ROOT/hooks/lib/hook-denial.mjs.
# Session id: $SVC_SESSION_ID, else $CLAUDE_SESSION_ID, else empty.
svc_emit_denial() {
  local hook_id="$1" reason_code="$2" cause="$3" operation="$4" recovery="$5" cmd_path="${6:-}"
  local hd="${SVC_EMIT_DENIAL_HD:-${REPO_ROOT:-}/hooks/lib/hook-denial.mjs}"
  if [ -f "$hd" ] && command -v node >/dev/null 2>&1; then
    _SVC_ED_HD="$hd" _SVC_ED_HID="$hook_id" _SVC_ED_RC="$reason_code" \
    _SVC_ED_CAUSE="$cause" _SVC_ED_OP="$operation" _SVC_ED_REC="$recovery" \
    _SVC_ED_PATH="$cmd_path" _SVC_ED_SESSION="${SVC_SESSION_ID:-${CLAUDE_SESSION_ID:-}}" \
    node --input-type=module -e '
import path from "node:path";
import { pathToFileURL } from "node:url";
const hd = await import(pathToFileURL(process.env._SVC_ED_HD).href);
hd.emitDenial({
  hook_id: process.env._SVC_ED_HID,
  reason_code: process.env._SVC_ED_RC,
  cause: (process.env._SVC_ED_CAUSE || "").slice(0, 1200),
  operation: process.env._SVC_ED_OP,
  recovery: process.env._SVC_ED_REC,
  resolved_command_path: process.env._SVC_ED_PATH || "",
  session_id: process.env._SVC_ED_SESSION || "",
});
' 1>&2 || true
    # emitDenial writes the machine envelope + short message to process.stderr
    # (fd 2); redirecting node stdout to stderr guarantees nothing leaks onto
    # the hook's stdout (which a Stop-class caller uses for {decision:"block"}).
  else
    # Fail-closed diagnostic: node/emitter absent — still print the 5-field
    # envelope to stderr so no block is ever anonymous (no receipt possible here).
    printf '{"svc_denial":true,"hook_id":"%s","reason_code":"%s","cause":"%s","operation":"%s","recovery":"%s"}\n' \
      "$hook_id" "$reason_code" "$cause" "$operation" "$recovery" >&2
  fi
}
