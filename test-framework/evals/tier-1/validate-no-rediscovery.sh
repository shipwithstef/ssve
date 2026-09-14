#!/usr/bin/env bash
# Tier 1: Knowledge Spine — no-rediscovery enforcement
#
# Scans .svc/knowledge-recall.jsonl for any (skill, topic) pair recalled
# >3 times within 24h. Such pairs are candidates for promotion to _shared/
# or pinning into the caller's context.
#
# Phase A behavior (WI-SPINE-001): WARN — print findings, exit 0.
# Phase E behavior (WI-SPINE-005): BLOCK — exit 1 on any finding.
#
# Source: proposals/done/2026-04-30-infra-project-support.md § 3.2 + § 8
#         WI-SPINE-001 deliverable 5
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="$REPO_ROOT/.svc/knowledge-recall.jsonl"
THRESHOLD="${SVC_REDISCOVERY_THRESHOLD:-3}"
WINDOW_HOURS="${SVC_REDISCOVERY_WINDOW_HOURS:-24}"
PHASE="${SVC_SPINE_PHASE:-A}"   # A=warn, E=block

if [[ ! -f "$LOG" ]]; then
  echo "validate-no-rediscovery: no recall log yet (.svc/knowledge-recall.jsonl absent) — OK"
  exit 0
fi

# Compute cutoff timestamp (now - WINDOW_HOURS)
NOW_EPOCH=$(date -u +%s)
CUTOFF_EPOCH=$((NOW_EPOCH - WINDOW_HOURS * 3600))

# Aggregate (skill, topic) pairs within window
findings=$(node -e "
  const fs = require('fs');
  const lines = fs.readFileSync('$LOG', 'utf8').trim().split('\n').filter(Boolean);
  const cutoff = $CUTOFF_EPOCH * 1000;
  const counts = new Map();
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry.ts || !entry.skill) continue;
    const ts = new Date(entry.ts).getTime();
    if (isNaN(ts) || ts < cutoff) continue;
    const topics = entry.topics_requested || (entry.topic ? [entry.topic] : []);
    for (const topic of topics) {
      const key = entry.skill + '::' + topic;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const findings = [];
  for (const [key, n] of counts) {
    if (n > $THRESHOLD) {
      const [skill, topic] = key.split('::');
      findings.push({ skill, topic, count: n });
    }
  }
  if (findings.length === 0) {
    console.log('OK');
  } else {
    findings.forEach(f => console.log(\`REDISCOVERY  \${f.skill}  \${f.topic}  count=\${f.count}\`));
  }
")

if [[ "$findings" == "OK" ]]; then
  echo "validate-no-rediscovery: no rediscovery within ${WINDOW_HOURS}h window (threshold=${THRESHOLD}) — OK"
  exit 0
fi

echo "validate-no-rediscovery: rediscovery detected within ${WINDOW_HOURS}h window:"
echo "$findings"
echo ""
echo "Action: promote frequently-recalled (skill, topic) pairs to _shared/ or pin into caller context."

if [[ "$PHASE" == "E" ]]; then
  exit 1
fi
echo "(Phase $PHASE — warning only; flips to blocking in Phase E per WI-SPINE-005)"
exit 0
