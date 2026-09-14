#!/usr/bin/env bash
# Tier 1: Validate input/output contracts across skills.
# Checks: input paths use valid patterns, output paths don't conflict,
# status transitions are valid lifecycle values.
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"

PASS=0
FAIL=0
ERRORS=""

VALID_STATUSES="ACTIVE DRAFT UX-REVIEWED DESIGNED BASELINED CHANGE-SET-APPROVED PROMOTED VERIFIED"
VALID_INPUT_PATH_PATTERN='^(docs/|references/|company-state/|REPO_MODES|test-framework/|DESIGN|package\.json|tsconfig\.json|e2e/|src/|base44/|\.agents/|~/\.svc/|~/\.claude/|~/\.codex/|~/\.base44/|~/\.config/opencode/|FRAMEWORK-STATE|proposals/|skills-manifest|DOCTRINE|EXTERNAL_ADDONS|CONTRIBUTING|\.svc/|rules/|\()'
PLACEHOLDER_PATH_PATTERN='[<*]'
OUTPUT_SKIP_PATTERN='[*<(]'

# Collect all output paths to detect conflicts
declare -A OUTPUT_PATHS  # path -> skill that produces it

# Known shared output paths (multiple skills intentionally produce these)
KNOWN_SHARED_OUTPUTS=(
  "docs/specs/work-items/INDEX.md"   # onboard-repo and sync-work-items both manage this
  "docs/specs/research-log.md"       # discover-skills and research both append to this
  "company-state/decisions-pending.jsonl" # company fleet roles intentionally append to one owner-review queue
)

SKILLS=$(node -e "
  const m = require('$MANIFEST');
  m.includedSkills.forEach(s => console.log(s));
")

for skill in $SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ ! -f "$SKILL_FILE" ]] && continue

  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

  # Validate input paths use recognized patterns
  while IFS= read -r ipath; do
    [[ -z "$ipath" ]] && continue
    # Allow known path patterns
    if [[ ! "$ipath" =~ $VALID_INPUT_PATH_PATTERN ]]; then
      ERRORS+="  FAIL: $skill — input path '$ipath' doesn't match expected patterns\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi

    # L2 substantive: framework-level paths (references/*, DOCTRINE.md, etc.) must exist in repo
    if [[ "$ipath" =~ ^references/ && ! "$ipath" =~ $PLACEHOLDER_PATH_PATTERN ]]; then
      if [[ ! -f "$REPO_ROOT/$ipath" ]]; then
        ERRORS+="  FAIL: $skill — input path '$ipath' does not exist in repo\n"
        FAIL=$((FAIL + 1))
      else
        PASS=$((PASS + 1))
      fi
    fi
  done < <(grep -oP 'path:\s*"\K[^"]*' <<<"$FRONTMATTER" || true)

  # Validate output status values
  OUTPUT_STATUSES=$(grep -oP 'status:\s*(\S+)' <<<"$FRONTMATTER" | sed 's/status:\s*//' || true)
  for status in $OUTPUT_STATUSES; do
    if [[ " $VALID_STATUSES " != *" $status "* ]]; then
      ERRORS+="  FAIL: $skill — invalid output status: $status (valid: $VALID_STATUSES)\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  done

  # Collect output paths for conflict detection (ONLY from produces: subsection)
  # awk script: find the 'produces:' line inside 'outputs:', and print lines until another key starts
  PRODUCES_BLOCK=$(awk '
    /outputs:/ { in_outputs=1; next }
    in_outputs && /produces:/ { in_produces=1; next }
    in_produces && /^[ ]{2}[a-z]/ { in_produces=0; in_outputs=1 } # another subsection in outputs (e.g. updates:)
    in_outputs && /^[a-z]/ { in_outputs=0; in_produces=0 } # another section starts (e.g. chain:)
    in_produces { print }
  ' <<<"$FRONTMATTER")

  while IFS= read -r opath; do
    [[ -z "$opath" ]] && continue
    # Skip glob patterns (contain * or <) or pseudo-paths in parens
    if [[ "$opath" =~ $OUTPUT_SKIP_PATTERN ]]; then
      PASS=$((PASS + 1))
      continue
    fi
    if [[ -n "${OUTPUT_PATHS[$opath]:-}" ]]; then
      existing="${OUTPUT_PATHS[$opath]}"
      if [[ "$existing" != "$skill" ]]; then
        is_known=false
        for known in "${KNOWN_SHARED_OUTPUTS[@]}"; do
          [[ "$opath" == "$known" ]] && is_known=true && break
        done
        if $is_known; then
          PASS=$((PASS + 1))
        else
          ERRORS+="  FAIL: output path '$opath' produced by both '$existing' and '$skill'\n"
          FAIL=$((FAIL + 1))
        fi
      fi
    else
      OUTPUT_PATHS["$opath"]="$skill"
      PASS=$((PASS + 1))
    fi
  done < <(grep -oP 'path:\s*"\K[^"]*' <<<"$PRODUCES_BLOCK" || true)
done

echo "=== Tier 1: Contract Validation ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — all contracts valid"
  exit 0
fi
