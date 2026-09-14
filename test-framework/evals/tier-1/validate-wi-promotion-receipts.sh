#!/usr/bin/env bash
# test-framework/evals/tier-1/validate-wi-promotion-receipts.sh
#
# Tier-1 validator for WI-341 tranche 2a.
#
# Hard contract: every post-cutoff actionable WI in docs/specs/work-items/
# DONE.md has a receipt in .svc/promotion-receipts/<WI-id>.json that
# schema-validates and carries an acceptable decision.
#
# Acceptable decisions for an actionable WI receipt:
#   - "accepted"      — the gate ran and approved
#   - "grandfathered" — WI promoted before the enforced_after cutoff
#   - "accepted" + bootstrap:true — WI implements the gate itself
#
# Refusal logic for this validator:
#   - schema violation in any receipt = FAIL
#   - any post-cutoff actionable WI in DONE.md missing a receipt = FAIL
#
# Pre-cutoff WIs need NO receipt (they predate the gate). Validator
# resolves the cutoff from the WI-341 bootstrap receipt at runtime, so
# the test stays self-correcting if the cutoff date is later revised.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  fi
}

echo "=== Tier 1: WI Promotion Receipts ==="

check "validator script exists" test -f "$ROOT/scripts/validate-wi-promotion.mjs"
check "validator script has valid syntax" node --check "$ROOT/scripts/validate-wi-promotion.mjs"
check "schema file exists" test -f "$ROOT/references/schemas/promotion-receipt.schema.json"
check "receipts directory exists" test -d "$ROOT/.svc/promotion-receipts"

check "WI-341 bootstrap receipt present" test -f "$ROOT/.svc/promotion-receipts/WI-341.json"
check "WI-343 grandfathered receipt present" test -f "$ROOT/.svc/promotion-receipts/WI-343.json"

check "WI-341 receipt is the bootstrap" bash -c '
  node -e "
    const r = JSON.parse(require(\"fs\").readFileSync(\"$0/.svc/promotion-receipts/WI-341.json\", \"utf8\"));
    if (r.bootstrap !== true) throw new Error(\"WI-341 receipt not flagged bootstrap=true\");
    if (r.decision !== \"accepted\" && r.decision !== \"bound-to-proposal\") throw new Error(\"WI-341 receipt decision must be accepted or bound-to-proposal, got \" + r.decision);
  "
' "$ROOT"

check "WI-343 receipt is grandfathered" bash -c '
  node -e "
    const r = JSON.parse(require(\"fs\").readFileSync(\"$0/.svc/promotion-receipts/WI-343.json\", \"utf8\"));
    if (r.grandfathered !== true) throw new Error(\"WI-343 receipt not flagged grandfathered=true\");
    if (r.decision !== \"grandfathered\") throw new Error(\"WI-343 receipt decision must be grandfathered, got \" + r.decision);
  "
' "$ROOT"

check "all receipts validate (--strict)" bash -c '
  cd "$0" && node scripts/validate-wi-promotion.mjs --strict
' "$ROOT"

# Negative fixtures — prove the validator rejects malformed receipts.
FIX="$TMP/fix-bad-receipts"
mkdir -p "$FIX/.svc/promotion-receipts" "$FIX/references/schemas" "$FIX/docs/specs/work-items" "$FIX/scripts"
cp "$ROOT/references/schemas/promotion-receipt.schema.json" "$FIX/references/schemas/"
# Copy validator (not symlink — fileURLToPath resolves symlinks, so a symlink
# would resolve the script's REPO_ROOT to the real repo and miss the fixture).
cp "$ROOT/scripts/validate-wi-promotion.mjs" "$FIX/scripts/"
# Empty DONE.md (no actionable WIs in the fixture, so missing-receipt logic
# stays out of the way for these schema-only assertions).
printf '# Closed Work Items\n\n| ID | Status | Closed | Subject |\n|----|--------|--------|---------|\n' > "$FIX/docs/specs/work-items/DONE.md"

# Receipt missing required key (no checks block).
printf '{"schema_version":1,"wi_id":"WI-999","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"proposals/x.md","decision":"accepted","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-999.json"
check "validator rejects receipt missing required key" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"

# Receipt with grandfathered=true but decision=accepted (illegal combination).
printf '{"schema_version":1,"wi_id":"WI-998","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":true,"bootstrap":false,"source_proposal":"proposals/x.md","checks":{"concrete_contract":"pass","severity_taxonomy":{"rated":"low","justification":"x"},"host_agnostic":{"result":"pass"},"concerns_wired":[],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"accepted","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-998.json"
# Drop the bad-missing one so only this conflict remains
rm -f "$FIX/.svc/promotion-receipts/WI-999.json"
check "validator rejects grandfathered=true with decision!=grandfathered" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"

# Receipt with bootstrap=true but decision=refused (illegal).
printf '{"schema_version":1,"wi_id":"WI-997","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":true,"source_proposal":"proposals/x.md","checks":{"concrete_contract":"pass","severity_taxonomy":{"rated":"low","justification":"x"},"host_agnostic":{"result":"pass"},"concerns_wired":[],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"refused","refusal_reason":"forced for fixture purposes","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-997.json"
rm -f "$FIX/.svc/promotion-receipts/WI-998.json"
check "validator rejects bootstrap=true with decision=refused" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"

# Receipt with decision=refused but missing refusal_reason.
printf '{"schema_version":1,"wi_id":"WI-996","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"proposals/x.md","checks":{"concrete_contract":"fail","severity_taxonomy":{"rated":"low","justification":"valid"},"host_agnostic":{"result":"pass"},"concerns_wired":[],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"refused","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-996.json"
rm -f "$FIX/.svc/promotion-receipts/WI-997.json"
check "validator rejects decision=refused without refusal_reason" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"

# PR #130 review HIGH negative-fixture coverage — empty checks, bad
# promoted_at, bad source_proposal, bad concerns_wired, short reviewer,
# short justification. Each existed in the prior validator but was NOT
# enforced; reviewer's manual probes confirmed false-pass.
rm -f "$FIX/.svc/promotion-receipts/WI-996.json"

printf '{"schema_version":1,"wi_id":"WI-995","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"proposals/x.md","checks":{},"decision":"accepted","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-995.json"
check "validator rejects empty checks block (PR #130 review HIGH probe)" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"
rm -f "$FIX/.svc/promotion-receipts/WI-995.json"

printf '{"schema_version":1,"wi_id":"WI-994","promoted_at":"not-a-date","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"proposals/x.md","checks":{"concrete_contract":"pass","severity_taxonomy":{"rated":"low","justification":"valid"},"host_agnostic":{"result":"pass"},"concerns_wired":[],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"accepted","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-994.json"
check "validator rejects malformed promoted_at" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"
rm -f "$FIX/.svc/promotion-receipts/WI-994.json"

printf '{"schema_version":1,"wi_id":"WI-993","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"not-a-proposal-path","checks":{"concrete_contract":"pass","severity_taxonomy":{"rated":"low","justification":"valid"},"host_agnostic":{"result":"pass"},"concerns_wired":[],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"accepted","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-993.json"
check "validator rejects source_proposal not matching ^proposals/.+\\.md$" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"
rm -f "$FIX/.svc/promotion-receipts/WI-993.json"

printf '{"schema_version":1,"wi_id":"WI-992","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"proposals/x.md","checks":{"concrete_contract":"pass","severity_taxonomy":{"rated":"low","justification":"valid"},"host_agnostic":{"result":"pass"},"concerns_wired":["not-a-concern-path"],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"accepted","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-992.json"
check "validator rejects concerns_wired item not matching ^concerns/.+\\.md$" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"
rm -f "$FIX/.svc/promotion-receipts/WI-992.json"

printf '{"schema_version":1,"wi_id":"WI-991","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"proposals/x.md","checks":{"concrete_contract":"pass","severity_taxonomy":{"rated":"low","justification":"valid"},"host_agnostic":{"result":"pass"},"concerns_wired":[],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"accepted","reviewer":"x"}\n' > "$FIX/.svc/promotion-receipts/WI-991.json"
check "validator rejects reviewer shorter than 3 chars" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"
rm -f "$FIX/.svc/promotion-receipts/WI-991.json"

printf '{"schema_version":1,"wi_id":"WI-990","promoted_at":"2026-05-13T00:00:00Z","enforced_after":"2026-05-13","grandfathered":false,"bootstrap":false,"source_proposal":"proposals/x.md","checks":{"concrete_contract":"pass","severity_taxonomy":{"rated":"low","justification":"x"},"host_agnostic":{"result":"pass"},"concerns_wired":[],"tier1_promotion_note":"n/a","capability_freshness":{"result":"pass"},"plan_changeset_class":"docs","lane":"framework"},"decision":"accepted","reviewer":"test@svc"}\n' > "$FIX/.svc/promotion-receipts/WI-990.json"
check "validator rejects severity_taxonomy.justification shorter than 5 chars" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$FIX"
rm -f "$FIX/.svc/promotion-receipts/WI-990.json"

# PR #130 review MEDIUM — targeted --wi mode must fail when receipt absent.
check "targeted --wi <ID> fails when the requested receipt is missing" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs --wi WI-989 --strict >/dev/null 2>&1
' "$ROOT"

check "targeted --wi <ID> passes when the requested receipt exists and is valid" bash -c '
  cd "$0" && node scripts/validate-wi-promotion.mjs --wi WI-341 --strict >/dev/null 2>&1
' "$ROOT"

check "targeted --wi <ID> on a grandfathered receipt passes" bash -c '
  cd "$0" && node scripts/validate-wi-promotion.mjs --wi WI-343 --strict >/dev/null 2>&1
' "$ROOT"

# Strict mode: missing receipt for a post-cutoff actionable WI must fail.
STRICT_FIX="$TMP/fix-missing-receipt"
mkdir -p "$STRICT_FIX/.svc/promotion-receipts" "$STRICT_FIX/references/schemas" "$STRICT_FIX/docs/specs/work-items" "$STRICT_FIX/scripts"
cp "$ROOT/references/schemas/promotion-receipt.schema.json" "$STRICT_FIX/references/schemas/"
cp "$ROOT/scripts/validate-wi-promotion.mjs" "$STRICT_FIX/scripts/"
# Bootstrap receipt to anchor the cutoff at 2026-05-13.
cp "$ROOT/.svc/promotion-receipts/WI-341.json" "$STRICT_FIX/.svc/promotion-receipts/"
# DONE.md with a post-cutoff actionable WI that has no receipt.
printf '# Closed Work Items\n\n| ID | Status | Closed | Subject |\n|----|--------|--------|---------|\n| [WI-500](WI-500.md) | verified | 2026-05-14 | Synthetic post-cutoff WI with no receipt |\n' > "$STRICT_FIX/docs/specs/work-items/DONE.md"
check "strict mode fails when post-cutoff actionable WI has no receipt" bash -c '
  cd "$0" && ! node scripts/validate-wi-promotion.mjs --strict >/dev/null 2>&1
' "$STRICT_FIX"

check "non-strict mode passes when post-cutoff actionable WI has no receipt" bash -c '
  cd "$0" && node scripts/validate-wi-promotion.mjs >/dev/null 2>&1
' "$STRICT_FIX"

echo ""
echo "WI promotion receipts: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
