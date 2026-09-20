#!/usr/bin/env bash
# Free-tier SSVE checks for local use and GitHub Actions; never enables paid tiers.
set -euo pipefail

if [[ "${EVALS:-0}" == "1" ]]; then
  echo "REFUSE: EVALS=1 enables paid LLM tiers (1.5/2/3). Free checks require EVALS!=1." >&2
  exit 2
fi
export EVALS=0

NODE_BIN="${NODE_BIN:-node}"
if ! NODE_BIN="$(command -v "$NODE_BIN")" || [[ ! -f "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "REFUSE: free checks require an executable Node runtime (set NODE_BIN or add node to PATH)" >&2
  exit 2
fi
NODE_BIN="$(cd "$(dirname "$NODE_BIN")" && pwd)/$(basename "$NODE_BIN")"
if ! NODE_VERSION="$("$NODE_BIN" --version)" || [[ ! "$NODE_VERSION" =~ ^v([0-9]+)\.[0-9]+\.[0-9]+([+-].*)?$ ]]; then
  echo "REFUSE: selected runtime did not report a valid Node version" >&2
  exit 2
fi
if (( 10#${BASH_REMATCH[1]} < 22 )); then
  echo "REFUSE: Node >=22 is required; selected ${NODE_VERSION}" >&2
  exit 2
fi

# Give every descendant the selected runtime, including overrides not named node.
RUNTIME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ssve-node-XXXXXX")"
trap 'rm -rf -- "$RUNTIME_DIR"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
ln -s "$NODE_BIN" "$RUNTIME_DIR/node"
export NODE_BIN
export PATH="${RUNTIME_DIR}:${PATH}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  if ! command -v rg >/dev/null 2>&1; then
    echo "Installing system dependency: ripgrep..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq ripgrep
  fi
  git fetch origin "+refs/notes/*:refs/notes/*" 2>/dev/null || echo "notes unreadable or absent"
  if git rev-parse --verify origin/main >/dev/null 2>&1 && ! git rev-parse --verify refs/heads/main >/dev/null 2>&1; then
    git branch main origin/main
  fi
fi

echo "ssve-free-checks: node=${NODE_BIN} (${NODE_VERSION}) EVALS=${EVALS}"
"${NODE_BIN}" scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh
