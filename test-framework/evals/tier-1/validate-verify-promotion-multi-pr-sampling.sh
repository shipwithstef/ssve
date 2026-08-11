#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/verification-sampling.mjs"
VERIFY="$REPO_ROOT/skills/verify-promotion/SKILL.md"
WI="$REPO_ROOT/docs/specs/work-items/WI-200.md"

pass=0
fail=0

ok() {
  echo "  PASS - $1"
  pass=$((pass + 1))
}

bad() {
  echo "  FAIL - $1"
  fail=$((fail + 1))
}

contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qE "$pattern" "$file"; then
    ok "$label"
  else
    bad "$label"
  fi
}

echo "=== Tier 1: verify-promotion multi-PR sampling ==="

node --check "$HELPER" >/dev/null && ok "sampling helper syntax valid" || bad "sampling helper syntax valid"

sample_a="$(node "$HELPER" PR-08 PR-01 PR-05 PR-02 PR-03 PR-04 PR-07 PR-06)"
sample_b="$(node "$HELPER" PR-06 PR-07 PR-04 PR-03 PR-02 PR-05 PR-01 PR-08)"

if [[ "$sample_a" == "$sample_b" ]]; then
  ok "sampling is deterministic independent of input order"
else
  bad "sampling is deterministic independent of input order"
fi

node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(0, "utf8"));
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(data.campaign_size === 8, "campaign_size");
assert(data.sample_size === 3, "ceil(N/3) with first/middle/last minimum");
assert(data.selected.some((r) => r.reason === "first" && r.index === 0), "first selected");
assert(data.selected.some((r) => r.reason === "middle"), "middle selected");
assert(data.selected.some((r) => r.reason === "last" && r.index === 7), "last selected");
assert(data.summary_requirements.every_pr_lists_verification_tier === true, "tier summary requirement");
assert(data.summary_requirements.sampled_prs_require_v1_or_v2_evidence === true, "sample evidence requirement");
' <<<"$sample_a" && ok "sample JSON enforces WI-200 invariants" || bad "sample JSON enforces WI-200 invariants"

sample_24="$(seq -f 'PR-%02g' 1 24 | node "$HELPER")"
node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(0, "utf8"));
if (data.sample_size !== 8) throw new Error(`expected 8 samples, got ${data.sample_size}`);
' <<<"$sample_24" && ok "24-item campaign samples N/3 = 8" || bad "24-item campaign samples N/3 = 8"

contains "$VERIFY" "Multi-PR Campaign Sampling" "verify-promotion documents campaign sampling"
contains "$VERIFY" "node scripts/verification-sampling\\.mjs" "verify-promotion invokes deterministic helper"
contains "$VERIFY" "ceil\\(N/3\\)" "verify-promotion names N/3 rule"
contains "$VERIFY" "first/middle/last" "verify-promotion requires first/middle/last minimum"
contains "$VERIFY" "verification_tier" "verify-promotion requires tier per campaign item"
contains "$VERIFY" "sampled: true\\|false" "verify-promotion requires sampled flag per item"
contains "$VERIFY" "V0 bundle-grep is insufficient" "sampled browser-visible items cannot close at V0"
contains "$WI" "verification-sampling\\.mjs" "WI-200 closeout cites sampling helper"

if [[ "$fail" -gt 0 ]]; then
  echo
  echo "verify-promotion multi-PR sampling: $pass passed, $fail failed"
  exit 1
fi

echo
echo "verify-promotion multi-PR sampling: $pass passed, $fail failed"
