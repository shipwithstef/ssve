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

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  if ! NODE_BIN="$(command -v node)"; then
    echo "REFUSE: node not on PATH after setup-node" >&2
    exit 2
  fi
  if ! command -v rg >/dev/null 2>&1; then
    echo "Installing system dependency: ripgrep..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq ripgrep
  fi
  git fetch origin "+refs/notes/*:refs/notes/*" 2>/dev/null || echo "notes unreadable or absent"
  if git rev-parse --verify origin/main >/dev/null 2>&1 && ! git rev-parse --verify refs/heads/main >/dev/null 2>&1; then
    git branch main origin/main || true
  fi
else
  NODE_BIN="${NODE_BIN:-/usr/bin/node}"
  if [[ ! -x "$NODE_BIN" ]]; then
    echo "REFUSE: local free checks require executable ${NODE_BIN}" >&2
    exit 2
  fi
fi

echo "ssve-free-checks: node=${NODE_BIN} ($("${NODE_BIN}" --version)) EVALS=${EVALS}"

"${NODE_BIN}" scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh
