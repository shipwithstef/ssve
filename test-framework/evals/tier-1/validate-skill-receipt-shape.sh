#!/usr/bin/env bash
# Tier 1: validate the shape of phase-receipt extension fields on
# .svc/lane-tasks-*.json task entries.
#
# Schema source of truth: references/phase-receipts.md
# WI: WI-213 Phase D (required phase receipts enforce completion)
#
# Legacy shape behavior:
#   - Reads every .svc/lane-tasks-*.json in the repo + the two fixture files.
#   - For each task with a `skill_receipt`, validates the OPTIONAL extension
#     fields (phases_executed, evidence_level, target_class) for shape only.
#   - Receipts WITHOUT extension fields are perfectly valid and produce no output.
#   - Receipts WITH malformed extension fields produce ADVISORY lines unless
#     they also miss required completion phases.
#
# Phase D behavior:
#   - Migrated skills fail closed for task graphs created after
#     PHASE_B_ENFORCE_AFTER when required_for_completion phases are
#     missing from completed task receipts.
#   - Older historical task graphs remain compatible. Phase C completed all
#     first-party skill migrations, so the former "unmigrated skill" self-test
#     now uses a pre-enforcement historical graph instead.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ADVISORY=0
FAIL=0
PROCESSED=0
PHASE_B_ENFORCE_AFTER="${PHASE_B_ENFORCE_AFTER:-2026-05-10T16:00:00Z}"
MIGRATED_SKILLS="diagnose-bug test-journeys write-journeys verify-promotion execute-changeset write-vision analyze-domain analyze-competitors refresh-competitors catalog-domain-capabilities build-personas validate-feature capture-idea audit-ac sync-spec-code define-code-style write-e2e analyze-marketing route-workflow onboard-repo sync-work-items list-work-items discover-skills svc-advisor research discuss-phase ingest-guide ingest-guide-batch capability-registry capability-concierge honest-diagnosis write-spec design-ux design-ui design-logo design-tech explore-solutions explore-ux plan-changeset review-gate audit-implementation land-changeset extract-bootstrap review-cross-model review-plan benchmark-landing track-visuals review-security manage-learnings test-framework audit-session-execution evolve-framework blend-external blend-private wsl2-audio mine-builder find-opportunity stage-revenue create-skill quick-fix improve-framework teach-project plan-capabilities reverse-engineer audit-coverage platform-operating-architect base44-environment roadmap-evaluation monetization-architecture assess-market-readiness evaluate-rule manage-finops strategic-decision launch-knowledge generate-visuals landing-page recall-stack-knowledge plan-blast-radius track-topology-diff"

advise() {
  echo "  ADVISORY: $1"
  ADVISORY=$((ADVISORY + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

is_migrated_skill() {
  local skill="$1"
  [[ " $MIGRATED_SKILLS " == *" $skill "* ]]
}

required_phases_for_skill() {
  local skill="$1"
  local skill_file="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ -f "$skill_file" ]] || return 0
  sed -n '/^phases:/,/^inputs:/p' "$skill_file" \
    | awk '/required_for_completion: true/ {
        line=$0
        sub(/^.*id: */, "", line)
        sub(/[}, ].*$/, "", line)
        if (line != "") print line
      }'
}

phase_b_enforcement_active_for_file() {
  local file="$1"
  local created
  created=$(jq -r '.created // ""' "$file")
  [[ -n "$created" && "$created" > "$PHASE_B_ENFORCE_AFTER" ]]
}

# Allowed value sets (kept in sync with references/phase-receipts.md §3)
ALLOWED_EVIDENCE_LEVEL='^(V0|V1|V2|V3)$'
ALLOWED_TARGET_CLASS='^(browser-visible|api|data-only|infra)$'
ALLOWED_ARTIFACT_TYPE='^(file|command_output|screenshot|live_dom)$'
ALLOWED_PHASE_ID='^P[0-9]+(\.[0-9]+)?-[A-Za-z][A-Za-z0-9-]*$'

# Validate one .svc/lane-tasks-*.json file. Per-task; cite file:task_id on findings.
validate_file() {
  local file="$1"
  local rel="${file#$REPO_ROOT/}"
  PROCESSED=$((PROCESSED + 1))

  if ! jq empty "$file" 2>/dev/null; then
    advise "$rel — invalid JSON; skipping shape check"
    return
  fi

  local task_count
  task_count=$(jq '.tasks | length' "$file")
  for ((i=0; i<task_count; i++)); do
    local task_id
    task_id=$(jq -r ".tasks[$i].id" "$file")

    # Skip tasks with no skill_receipt at all — that's the legitimate baseline.
    local has_receipt
    has_receipt=$(jq -r ".tasks[$i].skill_receipt | type" "$file")
    [[ "$has_receipt" == "null" ]] && continue

    local skill
    skill=$(jq -r ".tasks[$i].skill_receipt.skill // .tasks[$i].metadata.skill // \"\"" "$file")

    # --- evidence_level shape ---
    local ev
    ev=$(jq -r ".tasks[$i].skill_receipt.evidence_level // \"\"" "$file")
    if [[ -n "$ev" ]] && ! [[ "$ev" =~ $ALLOWED_EVIDENCE_LEVEL ]]; then
      advise "$rel:task=$task_id — evidence_level '$ev' is not in {V0,V1,V2,V3}"
    fi

    # --- target_class shape ---
    local tc
    tc=$(jq -r ".tasks[$i].skill_receipt.target_class // \"\"" "$file")
    if [[ -n "$tc" ]] && ! [[ "$tc" =~ $ALLOWED_TARGET_CLASS ]]; then
      advise "$rel:task=$task_id — target_class '$tc' is not in {browser-visible,api,data-only,infra}"
    fi

    # --- evidence_level + target_class cross-check (the WI-199 cell) ---
    if [[ "$ev" == "V0" && "$tc" == "browser-visible" ]]; then
      advise "$rel:task=$task_id — evidence_level=V0 with target_class=browser-visible is INSUFFICIENT (Phase D will block; see WI-199)"
    fi

    # --- phases_executed shape ---
    local pe_type
    pe_type=$(jq -r ".tasks[$i].skill_receipt.phases_executed | type" "$file")
    if [[ "$pe_type" == "null" ]]; then
      if [[ "$(jq -r ".tasks[$i].status" "$file")" == "completed" ]] \
        && phase_b_enforcement_active_for_file "$file" \
        && is_migrated_skill "$skill"; then
        while IFS= read -r required_phase; do
          [[ -z "$required_phase" ]] && continue
          fail "$rel:task=$task_id — migrated skill $skill missing required phase receipt $required_phase"
        done < <(required_phases_for_skill "$skill")
      fi
      continue
    fi
    if [[ "$pe_type" != "array" ]]; then
      advise "$rel:task=$task_id — phases_executed must be an array (got $pe_type)"
      continue
    fi

    local pe_len
    pe_len=$(jq -r ".tasks[$i].skill_receipt.phases_executed | length" "$file")
    for ((j=0; j<pe_len; j++)); do
      local phase_id phase_ts artifacts_type artifacts_len
      phase_id=$(jq -r ".tasks[$i].skill_receipt.phases_executed[$j].id // \"\"" "$file")
      phase_ts=$(jq -r ".tasks[$i].skill_receipt.phases_executed[$j].ts // \"\"" "$file")
      artifacts_type=$(jq -r ".tasks[$i].skill_receipt.phases_executed[$j].evidence_artifacts | type" "$file")

      if ! [[ "$phase_id" =~ $ALLOWED_PHASE_ID ]]; then
        advise "$rel:task=$task_id phases_executed[$j].id — '$phase_id' does not match P<n>-Name pattern"
      fi
      if [[ -z "$phase_ts" ]]; then
        advise "$rel:task=$task_id phases_executed[$j].ts — missing ISO 8601 timestamp"
      fi
      if [[ "$artifacts_type" != "array" ]]; then
        advise "$rel:task=$task_id phases_executed[$j].evidence_artifacts — must be an array (got $artifacts_type)"
        continue
      fi
      artifacts_len=$(jq -r ".tasks[$i].skill_receipt.phases_executed[$j].evidence_artifacts | length" "$file")
      for ((k=0; k<artifacts_len; k++)); do
        local atype apath
        atype=$(jq -r ".tasks[$i].skill_receipt.phases_executed[$j].evidence_artifacts[$k].type // \"\"" "$file")
        apath=$(jq -r ".tasks[$i].skill_receipt.phases_executed[$j].evidence_artifacts[$k].path // \"\"" "$file")
        if ! [[ "$atype" =~ $ALLOWED_ARTIFACT_TYPE ]]; then
          advise "$rel:task=$task_id phases_executed[$j].evidence_artifacts[$k].type — '$atype' is not in {file,command_output,screenshot,live_dom}"
        fi
        if [[ -z "$apath" ]]; then
          advise "$rel:task=$task_id phases_executed[$j].evidence_artifacts[$k].path — empty"
        fi
      done
    done

    if [[ "$(jq -r ".tasks[$i].status" "$file")" == "completed" ]] \
      && phase_b_enforcement_active_for_file "$file" \
      && is_migrated_skill "$skill"; then
      local phase_ids
      phase_ids=$(jq -r ".tasks[$i].skill_receipt.phases_executed | if type == \"array\" then .[]?.id // empty else empty end" "$file")
      while IFS= read -r required_phase; do
        [[ -z "$required_phase" ]] && continue
        if ! grep -qxF "$required_phase" <<<"$phase_ids"; then
          fail "$rel:task=$task_id — migrated skill $skill missing required phase receipt $required_phase"
        fi
      done < <(required_phases_for_skill "$skill")
    fi
  done
}

echo "=== Tier 1: Skill Receipt Shape (WI-213 Phase D — enforcing) ==="

if [[ -n "${SVC_RECEIPT_SHAPE_ONLY_FILE:-}" ]]; then
  validate_file "$SVC_RECEIPT_SHAPE_ONLY_FILE"
  if [[ $FAIL -gt 0 ]]; then
    exit 1
  fi
  exit 0
fi

# Live repo files
shopt -s nullglob
for f in "$REPO_ROOT/.svc/lane-tasks-"*.json; do
  validate_file "$f"
done
shopt -u nullglob

# Fixtures (positive + negative paths). Processed BEFORE the self-test snapshot
# so the counter reflects only one pass per file.
FIXTURE_DIR="$REPO_ROOT/test-framework/evals/tier-1/fixtures/skill-receipt-shape"
ADVISORY_BEFORE_FIXTURES=$ADVISORY
if [[ -d "$FIXTURE_DIR" ]]; then
  for f in "$FIXTURE_DIR"/*.json; do
    validate_file "$f"
  done
fi

# Self-test: the negative fixture is EXPECTED to produce findings. If processing
# fixtures didn't increase the counter by >=3, the validator regressed
# (false-negative). Surface as meta-advisory; still exit 0 in Phase A.
FIXTURE_FINDINGS=$((ADVISORY - ADVISORY_BEFORE_FIXTURES))
if [[ -f "$FIXTURE_DIR/bad.json" && $FIXTURE_FINDINGS -lt 3 ]]; then
  echo "  META-ADVISORY: bad fixture produced fewer than 3 findings ($FIXTURE_FINDINGS); validator may have regressed"
fi

if [[ "${SVC_RECEIPT_SHAPE_SKIP_SELFTEST:-0}" != "1" ]]; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT
  missing_fixture="$tmp_dir/migrated-missing.json"
  historical_fixture="$tmp_dir/historical-missing.json"
  cat > "$missing_fixture" <<JSON
{
  "wi": "WI-FIXTURE-MIGRATED-MISSING",
  "lane": "framework",
  "created": "2026-05-10T16:01:00Z",
  "status": "completed",
  "tasks": [
    {
      "id": 1,
      "subject": "Migrated skill missing phases",
      "status": "completed",
      "metadata": { "skill": "diagnose-bug" },
      "skill_receipt": {
        "skill": "diagnose-bug",
        "loaded_at": "2026-05-10T16:01:00Z",
        "loaded_via": "self-test"
      },
      "completed_at": "2026-05-10T16:02:00Z"
    }
  ]
}
JSON
  if SVC_RECEIPT_SHAPE_ONLY_FILE="$missing_fixture" SVC_RECEIPT_SHAPE_SKIP_SELFTEST=1 bash "$0" >/dev/null 2>&1; then
    echo "  META-ADVISORY: migrated missing-phase self-test unexpectedly passed"
  else
    echo "  SELF-TEST: migrated missing-phase fixture fails as expected"
  fi

  cat > "$historical_fixture" <<JSON
{
  "wi": "WI-FIXTURE-HISTORICAL-MISSING",
  "lane": "framework",
  "created": "2026-05-10T15:59:59Z",
  "status": "completed",
  "tasks": [
    {
      "id": 1,
      "subject": "Historical graph without phases remains allowed",
      "status": "completed",
      "metadata": { "skill": "route-workflow" },
      "skill_receipt": {
        "skill": "route-workflow",
        "loaded_at": "2026-05-10T16:01:00Z",
        "loaded_via": "self-test"
      },
      "completed_at": "2026-05-10T16:02:00Z"
    }
  ]
}
JSON
  if SVC_RECEIPT_SHAPE_ONLY_FILE="$historical_fixture" SVC_RECEIPT_SHAPE_SKIP_SELFTEST=1 bash "$0" >/dev/null 2>&1; then
    echo "  SELF-TEST: historical missing-phase fixture passes as expected"
  else
    echo "  META-ADVISORY: historical missing-phase fixture unexpectedly failed"
  fi
fi

echo "  Files processed: $PROCESSED"
echo "  Advisory findings: $ADVISORY"
echo "  Phase D failures: $FAIL"
if [[ $FAIL -gt 0 ]]; then
  echo "  FAIL — completed skill receipts are missing required phase entries"
elif [[ $ADVISORY -eq 0 ]]; then
  echo "  PASS — all receipts conform to shape (or have no extension fields)"
else
  echo "  PASS WITH ADVISORY — legacy shape findings remain advisory; required phases are enforced"
fi

exit $((FAIL > 0 ? 1 : 0))
