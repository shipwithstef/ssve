#!/usr/bin/env bash
# Tier 1: ensure every legacy-unverified knowledge domain has a backfill owner,
# due date, and retirement rule.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
QUEUE="$REPO_ROOT/references/knowledge/domains/legacy-backfill-queue.json"
PROVENANCE="$REPO_ROOT/test-framework/evals/tier-1/validate-knowledge-domain-provenance.sh"
RECALL="$REPO_ROOT/skills/recall-stack-knowledge/SKILL.md"

PASS=0
FAIL=0

pass() { echo "  PASS - $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL - $1"; FAIL=$((FAIL + 1)); }

echo "=== Tier 1: knowledge legacy backfill queue ==="

if node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$QUEUE"; then
  pass "legacy backfill queue is valid JSON"
else
  fail "legacy backfill queue is invalid JSON"
fi

warn_domains="$($PROVENANCE | sed -n 's/^  WARN: \([^ ]*\) .*/\1/p' | sort)"
queue_domains="$(node -e '
const q = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const item of q.domains || []) {
  if (item.status === "legacy-unverified") console.log(item.domain);
}
' "$QUEUE" | sort)"

if [[ "$warn_domains" == "$queue_domains" ]]; then
  pass "queue covers every legacy-unverified provenance warning"
else
  fail "queue does not match legacy warnings"
  echo "WARN domains:"
  echo "$warn_domains"
  echo "QUEUE domains:"
  echo "$queue_domains"
fi

if node -e '
const q = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const ok = (q.domains || []).every((item) =>
  item.owner && /^\d{4}-\d{2}-\d{2}$/.test(item.due || "") &&
  item.status === "legacy-unverified" && item.action === "backfill-or-retire"
);
process.exit(ok ? 0 : 1);
' "$QUEUE"; then
  pass "each queued domain has owner, due date, status, and action"
else
  fail "one or more queued domains are missing owner/due/status/action"
fi

if node -e '
const q = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const rules = q.retirement_rules || [];
const text = rules.join("\n");
process.exit(rules.length >= 3 && /backfill/i.test(text) && /retired/i.test(text) && /legacy-unverified/i.test(text) ? 0 : 1);
' "$QUEUE"; then
  pass "queue defines backfill and retirement rules"
else
  fail "queue retirement rules are incomplete"
fi

if grep -Fq "legacy-unverified" "$RECALL" \
  && grep -Fq "legacy-backfill-queue.json" "$RECALL"; then
  pass "recall-stack-knowledge labels queued domains in recall output"
else
  fail "recall-stack-knowledge does not document legacy-unverified output"
fi

if grep -Fq "legacy-backfill-queue.json" "$REPO_ROOT/docs/specs/work-items/WI-177.md"; then
  pass "WI-177 closeout cites the backfill queue"
else
  fail "WI-177 closeout does not cite the backfill queue"
fi

echo ""
echo "knowledge legacy backfill queue: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
