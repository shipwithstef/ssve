#!/usr/bin/env bash
# Pre-commit guard for exact, current execute-changeset dispatch evidence.
# The historical staged-src activation boundary is intentionally preserved.
set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[[ -n "$REPO_ROOT" ]] || { echo "svc-dispatch-guard: not in a git repo" >&2; exit 2; }
cd "$REPO_ROOT" || exit 2

STAGED_SRC="$(git diff --cached --name-only 2>/dev/null | grep -E '^src/' | head -5 || true)"
[[ -n "$STAGED_SRC" ]] || exit 0

FRAMEWORK_SCRIPT="$(realpath "${BASH_SOURCE[0]}")"
FRAMEWORK_ROOT="$(cd "$(dirname "$FRAMEWORK_SCRIPT")/.." && pwd)"
HELPER="$FRAMEWORK_ROOT/scripts/resolve-execute-dispatch.mjs"
[[ -r "$HELPER" ]] || { echo "svc-dispatch-guard: shared dispatch helper is unavailable: $HELPER" >&2; exit 2; }

ACTIVE_LOG_COUNT="$(find docs/plans -type f -name review-log.yaml ! -path '*/done/*' 2>/dev/null | wc -l | tr -d ' ')"
[[ "$ACTIVE_LOG_COUNT" != "0" ]] || exit 0

WI_CANDIDATES=()
while IFS= read -r manifest; do
  [[ -n "$manifest" ]] || continue
  if binding="$(node "$HELPER" bind-plan --repo "$REPO_ROOT" --manifest "$manifest" 2>/dev/null)"; then
    wi="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).wi)' "$binding")"
    if [[ ! " ${WI_CANDIDATES[*]} " =~ " $wi " ]]; then WI_CANDIDATES+=("$wi"); fi
  fi
done < <(find docs/plans -type f \( -name manifest.md -o -name plan.md \) ! -path '*/done/*' 2>/dev/null | sort)

if [[ ${#WI_CANDIDATES[@]} -ne 1 ]]; then
  echo "svc-dispatch-guard: BLOCKED: cannot derive exactly one active WI for staged src/ changes (found ${#WI_CANDIDATES[@]}: ${WI_CANDIDATES[*]:-none})" >&2
  exit 1
fi

WI_ID="${WI_CANDIDATES[0]}"
VERIFY_ARGS=(verify-receipt --repo "$REPO_ROOT" --wi "$WI_ID" --max-age-seconds "${SVC_EXECUTE_DISPATCH_MAX_AGE_SECONDS:-21600}")
if [[ -n "${SVC_DISPATCH_POLICY:-}" ]]; then VERIFY_ARGS+=(--policy "$SVC_DISPATCH_POLICY"); fi
if [[ -n "${SVC_HOST:-}" ]]; then VERIFY_ARGS+=(--orchestrator "$SVC_HOST"); fi
if [[ -n "${SVC_EXECUTE_DISPATCH_OVERRIDE_FILE:-}" ]]; then VERIFY_ARGS+=(--allow-override-file "$SVC_EXECUTE_DISPATCH_OVERRIDE_FILE"); fi

VERIFY_ERR="$(mktemp)"
if verified="$(node "$HELPER" "${VERIFY_ARGS[@]}" 2>"$VERIFY_ERR")"; then
  rm -f "$VERIFY_ERR"
  echo "svc-dispatch-guard: exact current execute dispatch verified for $WI_ID" >&2
  exit 0
fi

detail="$(tr '\n' ' ' <"$VERIFY_ERR")"
rm -f "$VERIFY_ERR"
echo "svc-dispatch-guard: BLOCKED: no exact current execute dispatch evidence for $WI_ID" >&2
echo "svc-dispatch-guard: $detail" >&2
echo "svc-dispatch-guard: staged src files: $(printf '%s\n' "$STAGED_SRC" | tr '\n' ' ')" >&2
exit 1
