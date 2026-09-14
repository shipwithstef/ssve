#!/usr/bin/env bash
# Tier-1: validate every line of .svc/pipeline-decisions.jsonl conforms to
# references/pipeline-decisions-schema.json (minimal fields + patterns).
set -euo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="$REPO_ROOT/.svc/pipeline-decisions.jsonl"

if [ ! -f "$LOG" ]; then
  echo "  (no .svc/pipeline-decisions.jsonl — skipping)"
  echo "validate-pipeline-decisions-schema: 0 passed, 0 failed (no log)"
  exit 0
fi

node -e "
const fs = require('fs');
const text = fs.readFileSync('$LOG', 'utf8');
const lines = text.split('\n');
let pass = 0, fail = 0;
const errs = [];
const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
// WI-FW-HOOKS-SAFETY-01: align with the canonical namespaced WI grammar in
  // hooks/lib/wi-id.mjs (single source of truth) — numeric and namespaced ids.
  const wiRe = /^WI-[A-Z0-9]+(?:-[A-Z0-9]+)*\$/;
const kinds = new Set(['mechanical','taste','user']);
lines.forEach((line, idx) => {
  if (!line.trim()) return;
  let obj;
  try { obj = JSON.parse(line); } catch (e) {
    errs.push(\`line \${idx+1}: invalid JSON\`); fail++; return;
  }
  // Accept either 'ts' (canonical) or 'timestamp' (legacy)
  const tsField = obj.ts || obj.timestamp;
  if (typeof tsField !== 'string' || !isoRe.test(tsField)) {
    errs.push(\`line \${idx+1}: missing/invalid ts/timestamp\`); fail++; return;
  }
  if (obj.kind === 'waiver') {
    if (typeof obj.waiver_type !== 'string' || obj.waiver_type.length < 1) {
      errs.push(\`line \${idx+1}: missing/invalid waiver_type\`); fail++; return;
    }
    if (typeof obj.subject !== 'string' || obj.subject.length < 1) {
      errs.push(\`line \${idx+1}: missing/invalid subject\`); fail++; return;
    }
    if (typeof obj.author !== 'string' || obj.author.length < 1) {
      errs.push(\`line \${idx+1}: missing/invalid author\`); fail++; return;
    }
    pass++;
    return;
  }
  if (typeof obj.skill !== 'string' || obj.skill.length < 1) {
    errs.push(\`line \${idx+1}: missing/invalid skill\`); fail++; return;
  }
  // Accept 'decision' (canonical) or 'decision_type' (legacy capture-idea writer)
  const decField = obj.decision || obj.decision_type;
  if (typeof decField !== 'string' || decField.length < 1) {
    errs.push(\`line \${idx+1}: missing/invalid decision\`); fail++; return;
  }
  if (obj.wi !== undefined && !wiRe.test(obj.wi)) {
    errs.push(\`line \${idx+1}: invalid wi pattern\`); fail++; return;
  }
  if (obj.kind !== undefined && !kinds.has(obj.kind)) {
    errs.push(\`line \${idx+1}: invalid kind\`); fail++; return;
  }
  pass++;
});
errs.slice(0, 5).forEach(e => console.log('  ✗ ' + e));
console.log(\`validate-pipeline-decisions-schema: \${pass} passed, \${fail} failed\`);
process.exit(fail === 0 ? 0 : 1);
"
