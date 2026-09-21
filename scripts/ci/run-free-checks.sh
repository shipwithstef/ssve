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
    git branch main origin/main
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
LOG="$(mktemp)"; trap 'rm -f "$LOG"' EXIT
STATUS=0
bash test-framework/evals/run-all-evals.sh >"$LOG" 2>&1 || STATUS=$?
"${NODE_BIN}" --input-type=module - "$LOG" "$STATUS" <<'NODE'
import fs from "node:fs";
const lines = fs.readFileSync(process.argv[2], "utf8").replace(/\x1b\[[0-9;]*m/g, "").split("\n");
const failures = [];
for (let i = 0; i < lines.length; i++) {
  if (/^\s*(FAIL|TIMEOUT):\s+validate-[^ ]+/.test(lines[i])) {
    let start = i;
    while (start > 0 && !/^\s*Running validate-/.test(lines[start])) start--;
    failures.push(lines.slice(Math.max(start, i - 65), i + 1).join("\n"));
  }
}
console.log(`DIAGNOSTIC: unchanged full-suite exit=${process.argv[3]}; named failures=${failures.length}`);
for (const block of failures) console.log(block);
console.log(lines.slice(-20).join("\n"));
NODE
exit "$STATUS"
