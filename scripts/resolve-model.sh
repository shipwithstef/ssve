#!/bin/bash
# scripts/resolve-model.sh — Resolve a cognitive label through owner dispatch policy.
#
# Usage:
#   bash scripts/resolve-model.sh <cognitive_label>
#   bash scripts/resolve-model.sh <cognitive_label> --json
#   bash scripts/resolve-model.sh <cognitive_label> --harness-only
#   bash scripts/resolve-model.sh <cognitive_label> --thinking
#   bash scripts/resolve-model.sh <cognitive_label> --invocation
#
# Cognitive labels: STRAT, PLAN, EXEC, REVIEW, SENSE, DISC, PASS

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="${1:-}"
FORMAT="${2:-}"

if [ -z "$LABEL" ]; then
  echo "Usage: bash scripts/resolve-model.sh <STRAT|PLAN|EXEC|REVIEW|SENSE|DISC|PASS> [--json|--harness-only|--thinking|--effort|--invocation]" >&2
  exit 2
fi

HOST="$(bash "$SCRIPT_DIR/detect-host.sh")"
if [ "$HOST" = "unknown" ]; then
  HOST="${SVC_HOST:-unknown}"
fi
if [ "$HOST" = "unknown" ]; then
  echo "Error: could not detect orchestrator host and SVC_HOST is not set" >&2
  exit 1
fi

FORMAT_ARG=""
if [ -n "$FORMAT" ]; then
  FORMAT_ARG="--format $FORMAT"
fi

# shellcheck disable=SC2086
node "$SCRIPT_DIR/resolve-dispatch.mjs" model --label "$LABEL" --orchestrator "$HOST" $FORMAT_ARG || exit 1
