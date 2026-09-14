#!/usr/bin/env bash
# Tier 1: stop-quality baseline-aware blocking semantics (WI-399 A8).
#
# Promotion note (rules/tier-1-promotion.md):
#   validator_path: test-framework/evals/tier-1/validate-stop-quality-baseline.sh
#   failure_class: Stop-path hostage — svc-stop-quality --check exit-1 blocked
#     session end on ANY project type error, including pre-existing debt
#     (capability audit R9, docs/analysis/claude-capability-restriction-audit-2026-06-09.md)
#   promotion_signal: #3 — protects a hot-path hook (hooks/svc-stop-quality.js,
#     Stop event on every session) per rules/plan-changeset-trigger.md
#   expected_runtime_budget: <2s (hermetic — canned checker output, no tsc/pyright)
#   why_tier_2_or_targeted_is_insufficient: a regression here wedges EVERY
#     session's Stop in any repo with legacy type debt; must be caught at lint time.
#
# Tests hooks/lib/stop-quality-baseline.mjs (the pure semantics the hook uses).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: stop-quality baseline semantics (WI-399 A8) ==="

[ -f hooks/lib/stop-quality-baseline.mjs ] || { echo "  FAIL: hooks/lib/stop-quality-baseline.mjs missing"; exit 1; }
grep -q "stop-quality-baseline.mjs" hooks/svc-stop-quality.js \
  && pass "hook imports the baseline lib" \
  || fail "hooks/svc-stop-quality.js does not use the baseline lib"

node --input-type=module -e '
import { extractErrorFingerprints, splitNewErrors } from "./hooks/lib/stop-quality-baseline.mjs";
const assert = (cond, msg) => { if (!cond) { console.error("ASSERT FAIL: " + msg); process.exit(1); } };

const tscOut = ["[TypeScript] Type errors found:\nsrc/a.ts(12,5): error TS2304: Cannot find name x.\nsrc/b.ts(3,1): error TS2322: Type mismatch.\nsome non-error context line"];
const fps = extractErrorFingerprints(tscOut);
assert(fps.length === 4, "extracts all 4 non-empty lines of the error block, got " + fps.length);

// 1. First check (no baseline): pre-existing errors do NOT produce newErrors
const first = splitNewErrors(fps, null);
assert(first.baselineMissing === true, "missing baseline flagged");
assert(first.newErrors.length === 0, "no-baseline run never blocks");
assert(first.preExisting.length === fps.length, "all current recorded as pre-existing");

// 2. Same errors vs recorded baseline: still no new
const second = splitNewErrors(fps, fps);
assert(second.newErrors.length === 0, "unchanged errors do not block");
assert(second.preExisting.length === fps.length, "pre-existing preserved");

// 3. NEW error appears: blocks on exactly the new one (negative fixture —
//    the gate still catches its true target)
const withNew = [...fps, "src/c.ts(1,1): error TS1005: brand new"].sort();
const third = splitNewErrors(withNew, fps);
assert(third.newErrors.length === 1, "exactly the new error blocks");
assert(third.newErrors[0].includes("TS1005"), "the right error is flagged");

// 4. Whitespace-variant of a baseline line is NOT new (normalization)
const wsVariant = extractErrorFingerprints(["src/a.ts(12,5):   error TS2304:  Cannot find name x."]);
const fourth = splitNewErrors(wsVariant, fps);
assert(fourth.newErrors.length === 0, "whitespace variants normalize to baseline");

// 5. Empty checker output: nothing to block
assert(extractErrorFingerprints([]).length === 0, "empty outputs yield no fingerprints");
console.log("all baseline-semantics assertions passed");
' && pass "baseline semantics: first-check records, new-error blocks, pre-existing passes" \
  || fail "baseline semantics assertions failed"

echo "stop-quality baseline: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
