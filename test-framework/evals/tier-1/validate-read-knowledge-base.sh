#!/usr/bin/env bash
# Tier-1 (WI-142): Verify readKnowledgeBase is exported from structured-gate-engine.mjs
# and returns correct shape against the _test-fixture competitor.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

cd "$REPO_ROOT"

# 1. Import check — function must be exported
if ! grep -q "export function readKnowledgeBase" scripts/lib/structured-gate-engine.mjs; then
  echo "FAIL: readKnowledgeBase is not exported from structured-gate-engine.mjs" >&2
  exit 1
fi

# 2. Runtime check against test fixture
RESULT=$(node -e "
import { readKnowledgeBase } from './scripts/lib/structured-gate-engine.mjs';
const r = readKnowledgeBase(['_test-fixture/acme-corp'], 'earn-mechanism', { repoRoot: '.' });
console.log(JSON.stringify(r));
")

FOUND=$(echo "$RESULT" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.competitors.length);")
GAP=$(echo "$RESULT" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.knowledge_gap.detected);")
SLUG=$(echo "$RESULT" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.competitors[0]?.slug);")

if [ "$FOUND" -ne 1 ]; then
  echo "FAIL: Expected 1 competitor from _test-fixture/acme-corp, got $FOUND" >&2
  exit 1
fi

if [ "$GAP" != "false" ]; then
  echo "FAIL: Expected no knowledge gap for fixture with all files present, got $GAP" >&2
  exit 1
fi

if [ "$SLUG" != "_test-fixture/acme-corp" ]; then
  echo "FAIL: Expected slug '_test-fixture/acme-corp', got '$SLUG'" >&2
  exit 1
fi

# 3. Missing-topic check — should return partial data + knowledge_gap
RESULT_GAP=$(node -e "
import { readKnowledgeBase } from './scripts/lib/structured-gate-engine.mjs';
const r = readKnowledgeBase(['_test-fixture/acme-corp'], 'nonexistent-topic', { repoRoot: '.', logGaps: false });
console.log(JSON.stringify(r));
")

GAP2=$(echo "$RESULT_GAP" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.knowledge_gap.detected);")
PARTIAL=$(echo "$RESULT_GAP" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.competitors.length);")

if [ "$GAP2" != "true" ]; then
  echo "FAIL: Expected knowledge gap for missing topic, got $GAP2" >&2
  exit 1
fi

if [ "$PARTIAL" -ne 1 ]; then
  echo "FAIL: Expected partial data (1 competitor) even with missing topic, got $PARTIAL" >&2
  exit 1
fi

# 4. Path-traversal rejection (WI-145) — slug containing `..` must be reported
# as missing, not read from outside the knowledge-base directory.
RESULT_TRAVERSAL=$(node -e "
import { readKnowledgeBase } from './scripts/lib/structured-gate-engine.mjs';
const r = readKnowledgeBase(['../../../etc'], null, { repoRoot: '.', logGaps: false });
console.log(JSON.stringify(r));
")
TRAV_FOUND=$(echo "$RESULT_TRAVERSAL" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.competitors.length);")
TRAV_MISSING=$(echo "$RESULT_TRAVERSAL" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.knowledge_gap.missing.join(','));")
if [ "$TRAV_FOUND" -ne 0 ]; then
  echo "FAIL: Path-traversal slug ('../../../etc') should yield 0 competitors, got $TRAV_FOUND" >&2
  exit 1
fi
if [ "$TRAV_MISSING" != "directory:../../../etc" ]; then
  echo "FAIL: Expected missing='directory:../../../etc', got '$TRAV_MISSING'" >&2
  exit 1
fi

# 5. Topic-traversal rejection (WI-145) — topic name containing `..` or `/`
# must NOT be read; must be reported as invalid-name.
RESULT_TTRAV=$(node -e "
import { readKnowledgeBase } from './scripts/lib/structured-gate-engine.mjs';
const r = readKnowledgeBase(['_test-fixture/acme-corp'], '../../README', { repoRoot: '.', logGaps: false });
console.log(JSON.stringify(r));
")
TTRAV_TOPIC=$(echo "$RESULT_TTRAV" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.competitors[0]?.topic ?? 'undefined');")
TTRAV_MISSING=$(echo "$RESULT_TTRAV" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.knowledge_gap.missing.join(','));")
if [ "$TTRAV_TOPIC" != "undefined" ]; then
  echo "FAIL: Path-traversal topic should not be read; got topic content" >&2
  exit 1
fi
if ! echo "$TTRAV_MISSING" | grep -q "invalid-name"; then
  echo "FAIL: Expected 'invalid-name' marker in missing for traversal topic, got '$TTRAV_MISSING'" >&2
  exit 1
fi

# 6. Truncation flag (WI-145) — fixture is small so truncated must be false.
TRUNC=$(echo "$RESULT" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.competitors[0]?.capabilities_truncated);")
if [ "$TRUNC" != "false" ]; then
  echo "FAIL: capabilities_truncated for small fixture should be false, got '$TRUNC'" >&2
  exit 1
fi

echo "PASS: validate-read-knowledge-base"
