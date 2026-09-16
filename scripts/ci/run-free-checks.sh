#!/usr/bin/env bash
# Free-tier SSVE checks for local use and, after activation, GitHub Actions.
# Not hosted proof. Never enables paid eval tiers.
set -euo pipefail

if [[ "${EVALS:-0}" == "1" ]]; then
  echo "REFUSE: EVALS=1 enables paid LLM tiers (1.5/2/3). Free checks require EVALS!=1." >&2
  exit 2
fi
export EVALS=0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -n "${NODE_BIN:-}" ]]; then
  if [[ ! -x "$NODE_BIN" ]]; then
    echo "REFUSE: NODE_BIN is set but not executable: ${NODE_BIN}" >&2
    exit 2
  fi
elif ! NODE_BIN="$(command -v node)"; then
  echo "REFUSE: node not on PATH" >&2
  exit 2
fi

echo "ssve-free-checks: node=${NODE_BIN} ($("${NODE_BIN}" --version)) EVALS=${EVALS}"

"${NODE_BIN}" scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh
