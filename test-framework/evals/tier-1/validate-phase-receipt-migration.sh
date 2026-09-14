#!/usr/bin/env bash
# Tier-1 validator: Phase B/C phase-receipt migration coverage.
# Origin: WI-211, WI-223.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
SKILLS=(diagnose-bug test-journeys write-journeys verify-promotion execute-changeset write-vision analyze-domain analyze-competitors refresh-competitors catalog-domain-capabilities build-personas validate-feature capture-idea audit-ac sync-spec-code define-code-style write-e2e analyze-marketing route-workflow onboard-repo sync-work-items list-work-items discover-skills svc-advisor research discuss-phase ingest-guide ingest-guide-batch capability-registry capability-concierge honest-diagnosis write-spec design-ux design-ui design-logo design-tech explore-solutions explore-ux plan-changeset review-gate audit-implementation land-changeset extract-bootstrap review-cross-model review-plan benchmark-landing track-visuals review-security manage-learnings test-framework audit-session-execution evolve-framework blend-external blend-private wsl2-audio mine-builder find-opportunity stage-revenue create-skill quick-fix improve-framework teach-project plan-capabilities reverse-engineer audit-coverage platform-operating-architect base44-environment roadmap-evaluation monetization-architecture assess-market-readiness evaluate-rule manage-finops strategic-decision launch-knowledge generate-visuals landing-page recall-stack-knowledge plan-blast-radius track-topology-diff)

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

required_phase_count() {
  local skill="$1"
  sed -n '/^phases:/,/^inputs:/p' "skills/$skill/SKILL.md" \
    | grep -c 'required_for_completion: true' || true
}

echo "=== Tier 1: phase-receipt Phase B/C migration ==="

for skill in "${SKILLS[@]}"; do
  if grep -q '^phases:' "skills/$skill/SKILL.md"; then
    pass "$skill declares phases frontmatter"
  else
    fail "$skill declares phases frontmatter"
  fi

  count="$(required_phase_count "$skill")"
  if [[ "$count" -ge 3 ]]; then
    pass "$skill declares required completion phases ($count)"
  else
    fail "$skill declares at least 3 required completion phases"
  fi

  if grep -q 'record-phase .svc/lane-tasks-<WI>.json' "skills/$skill/SKILL.md"; then
    pass "$skill documents record-phase emission"
  else
    fail "$skill documents record-phase emission"
  fi
done

if grep -Fq 'record-phase' scripts/task-graph.mjs \
  && grep -Fq 'writeJsonAtomic' scripts/task-graph.mjs \
  && grep -Fq 'phases_executed.push' scripts/task-graph.mjs; then
  pass "task-graph record-phase uses atomic state writer"
else
  fail "task-graph record-phase uses atomic state writer"
fi

if grep -Fq 'PHASE_B_ENFORCE_AFTER' test-framework/evals/tier-1/validate-skill-receipt-shape.sh \
  && grep -Fq 'MIGRATED_SKILLS="diagnose-bug test-journeys write-journeys verify-promotion execute-changeset write-vision analyze-domain analyze-competitors refresh-competitors catalog-domain-capabilities build-personas validate-feature capture-idea audit-ac sync-spec-code define-code-style write-e2e analyze-marketing route-workflow onboard-repo sync-work-items list-work-items discover-skills svc-advisor research discuss-phase ingest-guide ingest-guide-batch capability-registry capability-concierge honest-diagnosis write-spec design-ux design-ui design-logo design-tech explore-solutions explore-ux plan-changeset review-gate audit-implementation land-changeset extract-bootstrap review-cross-model review-plan benchmark-landing track-visuals review-security manage-learnings test-framework audit-session-execution evolve-framework blend-external blend-private wsl2-audio mine-builder find-opportunity stage-revenue create-skill quick-fix improve-framework teach-project plan-capabilities reverse-engineer audit-coverage platform-operating-architect base44-environment roadmap-evaluation monetization-architecture assess-market-readiness evaluate-rule manage-finops strategic-decision launch-knowledge generate-visuals landing-page recall-stack-knowledge plan-blast-radius track-topology-diff"' test-framework/evals/tier-1/validate-skill-receipt-shape.sh \
  && grep -Fq 'missing required phase receipt' test-framework/evals/tier-1/validate-skill-receipt-shape.sh; then
  pass "receipt-shape validator enforces migrated required phases"
else
  fail "receipt-shape validator enforces migrated required phases"
fi

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
cat > "$TMP_ROOT/phase-good.json" <<'JSON'
{
  "wi": "WI-FIXTURE-PHASE-GOOD",
  "lane": "framework",
  "created": "2026-05-10T16:01:00Z",
  "status": "in_progress",
  "tasks": [
    {
      "id": 1,
      "subject": "Record phase fixture",
      "status": "in_progress",
      "metadata": { "skill": "diagnose-bug" },
      "skill_receipt": {
        "skill": "diagnose-bug",
        "loaded_at": "2026-05-10T16:01:00Z",
        "loaded_via": "fixture"
      }
    }
  ]
}
JSON

if node scripts/task-graph.mjs record-phase "$TMP_ROOT/phase-good.json" 1 P1-Inputs --evidence command_output:.svc/phase.log >/dev/null \
  && jq -e '.tasks[0].skill_receipt.phases_executed[0].id == "P1-Inputs"' "$TMP_ROOT/phase-good.json" >/dev/null; then
  pass "record-phase appends phases_executed evidence"
else
  fail "record-phase appends phases_executed evidence"
fi

cat > "$TMP_ROOT/missing-phase.json" <<'JSON'
{
  "wi": "WI-FIXTURE-MISSING-PHASE",
  "lane": "framework",
  "created": "2026-05-10T16:01:00Z",
  "status": "completed",
  "tasks": [
    {
      "id": 1,
      "subject": "Missing migrated phase fixture",
      "status": "completed",
      "metadata": { "skill": "diagnose-bug" },
      "skill_receipt": {
        "skill": "diagnose-bug",
        "loaded_at": "2026-05-10T16:01:00Z",
        "loaded_via": "fixture"
      },
      "completed_at": "2026-05-10T16:02:00Z"
    }
  ]
}
JSON

if SVC_RECEIPT_SHAPE_ONLY_FILE="$TMP_ROOT/missing-phase.json" SVC_RECEIPT_SHAPE_SKIP_SELFTEST=1 \
  bash test-framework/evals/tier-1/validate-skill-receipt-shape.sh >/dev/null 2>&1; then
  fail "receipt-shape validator rejects migrated missing-phase fixture"
else
  pass "receipt-shape validator rejects migrated missing-phase fixture"
fi

cat > "$TMP_ROOT/historical-phase.json" <<'JSON'
{
  "wi": "WI-FIXTURE-HISTORICAL-PHASE",
  "lane": "framework",
  "created": "2026-05-10T15:59:59Z",
  "status": "completed",
  "tasks": [
    {
      "id": 1,
      "subject": "Historical missing phase fixture",
      "status": "completed",
      "metadata": { "skill": "route-workflow" },
      "skill_receipt": {
        "skill": "route-workflow",
        "loaded_at": "2026-05-10T16:01:00Z",
        "loaded_via": "fixture"
      },
      "completed_at": "2026-05-10T16:02:00Z"
    }
  ]
}
JSON

if SVC_RECEIPT_SHAPE_ONLY_FILE="$TMP_ROOT/historical-phase.json" SVC_RECEIPT_SHAPE_SKIP_SELFTEST=1 \
  bash test-framework/evals/tier-1/validate-skill-receipt-shape.sh >/dev/null 2>&1; then
  pass "receipt-shape validator preserves advisory mode for historical graphs"
else
  fail "receipt-shape validator preserves advisory mode for historical graphs"
fi

for scenario in \
  test-framework/evals/tier-2/scenarios/diagnose-bug-typo.md \
  test-framework/evals/tier-2/scenarios/test-journeys-runtime.md \
  test-framework/evals/tier-2/scenarios/write-journeys-generate.md \
  test-framework/evals/tier-2/scenarios/verify-promotion-check.md \
  test-framework/evals/tier-2/scenarios/execute-changeset-fix.md \
  test-framework/evals/tier-2/scenarios/write-vision-create.md \
  test-framework/evals/tier-2/scenarios/write-spec-greenfield.md \
  test-framework/evals/tier-2/scenarios/plan-changeset-manifest.md \
  test-framework/evals/tier-2/scenarios/design-ux-flow.md \
  test-framework/evals/tier-2/scenarios/design-ui-visual.md \
  test-framework/evals/tier-2/scenarios/design-tech-architecture.md \
  test-framework/evals/tier-2/scenarios/review-gate-code.md \
  test-framework/evals/tier-2/scenarios/audit-implementation-code.md \
  test-framework/evals/tier-2/scenarios/land-changeset-merge.md \
  test-framework/evals/tier-2/scenarios/catalog-domain-capabilities-eval.md \
  test-framework/evals/tier-2/scenarios/build-personas-auto.md \
  test-framework/evals/tier-2/scenarios/explore-solutions-challenge.md \
  test-framework/evals/tier-2/scenarios/validate-feature-validate.md \
  test-framework/evals/tier-2/scenarios/capture-idea-eval.md \
  test-framework/evals/tier-2/scenarios/write-e2e-spec.md \
  test-framework/evals/tier-2/scenarios/research-api.md \
  test-framework/evals/tier-2/scenarios/audit-session-execution-eval.md \
  test-framework/evals/tier-2/scenarios/mine-builder-eval.md \
  test-framework/evals/tier-2/scenarios/platform-operating-architect-eval.md \
  test-framework/evals/tier-2/scenarios/evaluate-rule-probe.md \
  test-framework/evals/tier-2/scenarios/evaluate-rule-worth.md \
  test-framework/evals/tier-2/scenarios/manage-finops-eval.md \
  test-framework/evals/tier-2/scenarios/find-opportunity-eval.md \
  test-framework/evals/tier-2/scenarios/stage-revenue-eval.md \
  test-framework/evals/tier-2/scenarios/create-skill-template.md \
  test-framework/evals/tier-2/scenarios/framework-self-improve-eval.md \
  test-framework/evals/tier-2/scenarios/improve-framework-gap.md \
  test-framework/evals/tier-2/scenarios-kimi/kimi-route-workflow-eval.md \
  test-framework/evals/tier-2/scenarios/onboard-repo-convert.md \
  test-framework/evals/tier-2/scenarios/onboard-repo-mapping.md
do
  if grep -q 'jq ' "$scenario" && grep -q 'phases_executed' "$scenario"; then
    pass "$(basename "$scenario") has jq phase-receipt assertion"
  else
    fail "$(basename "$scenario") has jq phase-receipt assertion"
  fi
done

echo
echo "phase-receipt Phase B/C migration: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi

# WI-363: the autoemit hook ships alongside migrated skills and is wired
if [ -f "hooks/svc-phase-receipt-autoemit.mjs" ]; then
  grep -q "svc-phase-receipt-autoemit" scripts/wire-hooks.mjs && echo "  ✓ WI-363 autoemit wired in claude emission" || { echo "  ✗ autoemit exists but unwired"; exit 1; }
fi
