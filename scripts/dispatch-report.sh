#!/bin/bash
# scripts/dispatch-report.sh [jsonl-path] [--since <date>]
#
# Reads .svc/dispatch-log.jsonl (or a path given as $1) and emits a summary
# table: dispatches per model, total tokens, total duration, cost estimate.
#
# Cost estimates use rough public pricing (2026-04):
#   claude-opus-4-7       : $15 / M in  + $75 / M out  -> ~$45 / M avg
#   claude-sonnet-4-6     : $3  / M in  + $15 / M out  -> ~$9  / M avg
#   claude-haiku-4-5      : $0.80 / M in + $4 / M out  -> ~$2.4 / M avg
#   xiaomi/mimo-v2-pro    : token-plan flat-rate (approx $0.50 / 1M avg)
#   xiaomi/mimo-v2-omni   : token-plan flat-rate (approx $0.50 / 1M avg)
#   codex-cli (GPT-5)     : approx $5 / M avg
#   gemini-2.x pro        : approx $5 / M avg
#
# These are INFORMATIONAL ceilings — the framework has no live API billing
# feed. Use as order-of-magnitude guidance, not accounting.
#
# Usage:
#   bash scripts/dispatch-report.sh
#   bash scripts/dispatch-report.sh .svc/dispatch-log.jsonl --since 2026-04-20
set -u

JSONL="${1:-.svc/dispatch-log.jsonl}"
SINCE=""
for arg in "$@"; do
  if [ "$arg" = "--since" ]; then SINCE_FLAG=1; continue; fi
  if [ "${SINCE_FLAG:-0}" = "1" ]; then SINCE="$arg"; SINCE_FLAG=0; fi
done

[ -r "$JSONL" ] || { echo "dispatch log not found: $JSONL" >&2; echo "Run dispatch-log.sh to populate." >&2; exit 2; }

python3 <<PY
import json, sys
from collections import defaultdict
from datetime import datetime

COST_PER_M = {
    "claude-opus-4-7":      45.00,
    "claude-sonnet-4-6":     9.00,
    "claude-haiku-4-5":      2.40,
    "claude-haiku-4-5-20251001": 2.40,
    "xiaomi/mimo-v2-pro":    0.50,
    "xiaomi/mimo-v2-omni":   0.50,
    "mimo/mimo-v2-pro":      0.50,
    "mimo/mimo-v2-omni":     0.50,
    "gpt-5":                 5.00,
    "gemini-2":              5.00,
}

since = "$SINCE"
stats = defaultdict(lambda: {"n": 0, "tokens": 0, "dur_ms": 0, "failed": 0})
total_n = total_tokens = total_dur = 0

for line in open("$JSONL"):
    line = line.strip()
    if not line: continue
    try:
        e = json.loads(line)
    except:
        continue
    if since and e.get("ts","") < since:
        continue
    m = e.get("model","unknown")
    s = stats[m]
    s["n"] += 1
    tok = e.get("approx_tokens") or 0
    s["tokens"] += tok
    s["dur_ms"] += e.get("duration_ms") or 0
    if e.get("exit_code") not in (0, None):
        s["failed"] += 1
    total_n += 1
    total_tokens += tok
    total_dur += e.get("duration_ms") or 0

print(f"# svc dispatch report")
print(f"Source: $JSONL  |  Since: {since or 'ALL'}  |  Dispatches: {total_n}")
print(f"")
print(f"| model | dispatches | failed | avg tokens | total tokens | total wall (s) | est cost |")
print(f"|---|---|---|---|---|---|---|")
for m, s in sorted(stats.items(), key=lambda x: -x[1]["n"]):
    avg_tok = (s["tokens"] // s["n"]) if s["n"] else 0
    cost = 0.0
    for k, v in COST_PER_M.items():
        if k in m:
            cost = s["tokens"] / 1_000_000 * v
            break
    print(f"| {m} | {s['n']} | {s['failed']} | {avg_tok:,} | {s['tokens']:,} | {s['dur_ms']/1000:.1f} | \${cost:.4f} |")

print(f"")
print(f"**Total tokens (all models):** {total_tokens:,}")
print(f"**Total wall time:** {total_dur/1000:.1f}s")
print(f"")
print(f"_Note: token counts are best-effort, parsed from subprocess output. Cost estimates are informational — not billing-grade._")
PY
