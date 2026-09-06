#!/usr/bin/env bash
# Tier 1 exercises decision-log recency with a fixed clock. An old checkout is
# not a failing software test. Operational check: --live [decision-log.jsonl].
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

check_recency() {
  node --input-type=module - "$1" "$2" <<'NODE'
import fs from 'node:fs';
const [file, nowText] = process.argv.slice(2);
let text;
try { text = fs.readFileSync(file, 'utf8'); }
catch (error) { if (error.code === 'ENOENT') { console.log('No decision log yet'); process.exit(0); } throw error; }
const lines = text.split(/\r?\n/).filter(line => line.trim());
if (!lines.length) { console.log('No decisions yet'); process.exit(0); }
try {
  const event = JSON.parse(lines.at(-1));
  const timestamp = Date.parse(event.ts || event.timestamp);
  const now = Date.parse(nowText);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) throw new Error('invalid timestamp');
  const age = now - timestamp;
  if (age > 24 * 3600000) { console.error('Decision log is older than 24 hours'); process.exitCode = 1; }
  else console.log('Decision log is within 24 hours');
} catch (error) { console.error(`Invalid decision-log entry: ${error.message}`); process.exitCode = 1; }
NODE
}

if [[ "${1:-}" == --live && $# -le 2 ]]; then
  check_recency "${2:-$REPO_ROOT/.svc/pipeline-decisions.jsonl}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit "$?"
elif [[ $# -gt 0 ]]; then
  echo 'usage: validate-pipeline-decisions-recent.sh [--live [decision-log.jsonl]]' >&2
  exit 2
fi

fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT
now='2026-09-06T12:00:00Z'
probe() {
  local name="$1" expected="$2" rc
  check_recency "$fixture/decisions.jsonl" "$now" > "$fixture/result" 2>&1 && rc=0 || rc=$?
  if [[ "$rc" -ne "$expected" ]]; then cat "$fixture/result"; echo "FAIL: $name (exit $rc, expected $expected)"; exit 1; fi
  echo "PASS: $name"
}
probe missing 0
: > "$fixture/decisions.jsonl"
probe empty 0
printf '%s\n' '{"ts":"2026-09-06T11:00:00Z"}' > "$fixture/decisions.jsonl"
probe fresh 0
printf '%s\n' '{"timestamp":"2026-09-05T15:00:00+03:00"}' > "$fixture/decisions.jsonl"
probe 'legacy timestamp at exact 24h boundary, with timezone offset' 0
printf '%s\n' '{"ts":"2026-09-05T11:59:59Z"}' > "$fixture/decisions.jsonl"
probe stale 1
printf '%s\n' '{"ts":"bad"}' > "$fixture/decisions.jsonl"
probe 'invalid timestamp' 1
printf '%s\n' 'invalid json' > "$fixture/decisions.jsonl"
probe 'malformed entry' 1
