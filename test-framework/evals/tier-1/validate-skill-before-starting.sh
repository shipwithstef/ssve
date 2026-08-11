#!/usr/bin/env bash
# Tier 1: Validate that every SKILL.md authored on or after 2026-04-28 has a
# "## Before Starting" section. Skills authored before that date are exempt
# (advisory mode). Skills with no detectable creation date are also exempt.
#
# Source rationale: WI-135 (coreyhaines blend v1.9.0).
# Both YAML frontmatter `created:` and markdown `**Created:** YYYY-MM-DD`
# header formats are accepted (per simulation-report finding in WI-135 manifest).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"
MANIFEST="$REPO_ROOT/skills-manifest.json"
CUTOFF="2026-04-28"
SHARED_CONTRACT="$REPO_ROOT/_shared/before-starting.md"
CONVENTIONS="$REPO_ROOT/references/skill-conventions.md"
ROUTE_WORKFLOW="$REPO_ROOT/skills/route-workflow/SKILL.md"
CONTEXT_REGISTRY="$REPO_ROOT/references/context-loading-registry.json"
CONTEXT_MAP="$(mktemp)"
trap 'rm -f "$CONTEXT_MAP"' EXIT

PASS=0
FAIL=0
ADVISORY=0
ERRORS=""
ADVICE=""

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qiE "$pattern" "$file"; then
    PASS=$((PASS + 1))
  else
    ERRORS+="  FAIL: $label missing pattern '$pattern' in ${file#$REPO_ROOT/}\n"
    FAIL=$((FAIL + 1))
  fi
}

require_pattern "$SHARED_CONTRACT" "complete relevant context" "Before Starting shared contract"
require_pattern "$SHARED_CONTRACT" "spec-index\\.json" "Before Starting shared contract"
require_pattern "$SHARED_CONTRACT" "dependency|dependencies" "Before Starting shared contract"
require_pattern "$SHARED_CONTRACT" "not read every|Do not read every" "Before Starting shared contract"
require_pattern "$SHARED_CONTRACT" "not stop at the minimum|do not stop at the minimum" "Before Starting shared contract"
require_pattern "$CONVENTIONS" "bounded context plan" "Skill conventions"
require_pattern "$ROUTE_WORKFLOW" "bounded context plan" "route-workflow Before Starting"

if node <<'NODE' > "$CONTEXT_MAP"
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync("skills-manifest.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("references/context-loading-registry.json", "utf8"));
const included = new Set(manifest.includedSkills || []);
const coverage = new Map();
const errors = [];

if (!Array.isArray(registry.families) || registry.families.length === 0) {
  errors.push("context-loading registry must contain at least one family");
} else {
  for (const family of registry.families) {
    if (!family.id) errors.push("context-loading family missing id");
    for (const field of ["start_from", "dependency_expansion", "stop_condition"]) {
      if (!family[field] || (Array.isArray(family[field]) && family[field].length === 0)) {
        errors.push(`context-loading family ${family.id || "(unknown)"} missing ${field}`);
      }
    }
    for (const skill of family.skills || []) {
      if (!included.has(skill)) errors.push(`context-loading registry names non-included skill: ${skill}`);
      const current = coverage.get(skill) || [];
      current.push(family.id || "(unknown)");
      coverage.set(skill, current);
    }
  }
}

for (const skill of included) {
  const families = coverage.get(skill) || [];
  if (families.length === 0) errors.push(`context-loading registry missing included skill: ${skill}`);
  if (families.length > 1) errors.push(`context-loading registry covers ${skill} more than once: ${families.join(", ")}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

for (const [skill, families] of coverage.entries()) {
  console.log(`${skill}:${families[0]}`);
}
NODE
then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: context-loading registry is invalid\n"
  FAIL=$((FAIL + 1))
fi

SKILLS=$(node -e "
  const m = require('$MANIFEST');
  m.includedSkills.forEach(s => console.log(s));
" 2>/dev/null || ls -d "$REPO_ROOT"/*/SKILL.md 2>/dev/null | xargs -I{} dirname {} | xargs -n1 basename)

extract_created() {
  local file="$1"
  # Try YAML frontmatter first: `created: YYYY-MM-DD` (with or without quotes)
  local fm_created
  fm_created=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$file" \
    | grep -E '^created:' \
    | head -1 \
    | sed -E 's/^created:[[:space:]]*"?([0-9]{4}-[0-9]{2}-[0-9]{2})"?.*/\1/')
  if [[ -n "$fm_created" ]]; then
    echo "$fm_created"
    return
  fi
  # Try markdown header: `**Created:** YYYY-MM-DD`
  local md_created
  md_created=$(grep -m1 -E '^\*\*Created:\*\*' "$file" 2>/dev/null \
    | sed -E 's/.*\*\*Created:\*\*[[:space:]]*([0-9]{4}-[0-9]{2}-[0-9]{2}).*/\1/')
  if [[ -n "$md_created" && "$md_created" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "$md_created"
    return
  fi
  echo ""
}

for skill in $SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ ! -f "$SKILL_FILE" ]] && continue

  HAS_SECTION=0
  if grep -qE '^#{2,3} Before Starting' "$SKILL_FILE"; then
    HAS_SECTION=1
  fi

  CREATED="$(extract_created "$SKILL_FILE")"

  if [[ -n "$CREATED" && "$CREATED" > "$CUTOFF" || "$CREATED" == "$CUTOFF" ]]; then
    # Post-cutoff skills: section is mandatory
    if [[ $HAS_SECTION -eq 1 ]]; then
      PASS=$((PASS + 1))
    else
      ERRORS+="  FAIL: $skill — created $CREATED (>= $CUTOFF) but missing '## Before Starting' section\n"
      FAIL=$((FAIL + 1))
    fi
  else
    # Pre-cutoff skills or no detectable date: family registry coverage is
    # blocking; missing direct sections are no longer naked advisory debt.
    if [[ $HAS_SECTION -eq 0 ]]; then
      if grep -q "^${skill}:" "$CONTEXT_MAP"; then
        PASS=$((PASS + 1))
      else
        ADVICE+="  ADVISORY: $skill — missing '## Before Starting' section and no family context-loading coverage\n"
        ADVISORY=$((ADVISORY + 1))
      fi
    else
      PASS=$((PASS + 1))
    fi
  fi
done

echo "validate-skill-before-starting: $PASS passed, $FAIL failed, $ADVISORY advisory"
if [[ $ADVISORY -gt 0 ]]; then
  echo -e "$ADVICE"
fi

if [[ $FAIL -gt 0 ]]; then
  echo "FAIL: $FAIL skill(s) authored on/after $CUTOFF lack '## Before Starting' section"
  echo -e "$ERRORS"
  exit 1
fi
exit 0
