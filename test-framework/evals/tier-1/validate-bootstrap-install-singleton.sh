#!/usr/bin/env bash
# Tier-1: BOOTSTRAP_INSTALL waiver used at most once in repo history.
# Promotion note: single-use waiver abuse compromises chain installation.

set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

DECISIONS=".svc/pipeline-decisions.jsonl"
if [[ ! -f "$DECISIONS" ]]; then
  echo "PASS: no decisions log yet"
  exit 0
fi

COUNT="$(grep -c 'BOOTSTRAP_INSTALL' "$DECISIONS" 2>/dev/null)"
COUNT="${COUNT:-0}"
if [[ "$COUNT" -le 1 ]]; then
  echo "PASS: BOOTSTRAP_INSTALL count = $COUNT"
  exit 0
fi
echo "FAIL: BOOTSTRAP_INSTALL used $COUNT times; single-use only"
exit 1
