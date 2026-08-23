#!/usr/bin/env bash
# Canonical execute-changeset preflight adapter.
# Identity, review-state, override, and tuple authority live in the shared
# helper; this shell only transports the public positional interface.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${1:-}"
WI_ID="${2:-}"
shift $(( $# >= 2 ? 2 : $# ))

if [[ -z "$REPO_ROOT" || -z "$WI_ID" ]]; then
  echo "usage: execute-dispatch-preflight.sh <project-repo-root> <wi-id> [--allow-override-file <path>]" >&2
  exit 2
fi

ARGS=(preflight --repo "$REPO_ROOT" --wi "$WI_ID")
if [[ -n "${SVC_DISPATCH_POLICY:-}" ]]; then ARGS+=(--policy "$SVC_DISPATCH_POLICY"); fi
if [[ -n "${SVC_DISPATCH_MODE:-}" ]]; then ARGS+=(--mode "$SVC_DISPATCH_MODE"); fi
if [[ -n "${SVC_HOST:-}" ]]; then ARGS+=(--orchestrator "$SVC_HOST"); fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-override-file)
      [[ $# -ge 2 ]] || { echo "preflight: --allow-override-file requires a path" >&2; exit 2; }
      ARGS+=(--allow-override-file "$2")
      shift 2
      ;;
    *)
      echo "preflight: unsupported argument $1" >&2
      exit 2
      ;;
  esac
done

exec node "$SCRIPT_DIR/resolve-execute-dispatch.mjs" "${ARGS[@]}"
