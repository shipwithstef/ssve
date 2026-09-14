#!/usr/bin/env bash
# Tier 2: Run integration scenarios via claude -p.
# Each scenario .md is parsed for Setup, Prompt, and Expected Outputs.
# Creates a proper git-initialized workspace per scenario, runs the prompt,
# checks assertions using the shared test-helpers library.
#
# COST ESTIMATE (billed to your Claude Code subscription):
#   ~50K input tokens + ~20K output tokens per scenario
#   At Claude Sonnet rates: approximately $0.60–1.00 USD per scenario
#   (varies by scenario complexity and output length)
#
# TIME: ~2–4 minutes per scenario
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"
RESULTS_DIR="${SVC_TIER2_RESULTS_DIR:-$REPO_ROOT/test-framework/evals/results/tier-2/$(date +%Y%m%d-%H%M%S)}"
if [[ "$RESULTS_DIR" != /* ]]; then
  RESULTS_DIR="$PWD/${RESULTS_DIR#./}"
fi

declare -a SELECTED_SCENARIOS=()
declare -A SEEN_SCENARIOS=()
if [[ "$#" -eq 0 ]]; then
  while IFS= read -r scenario_file; do
    SELECTED_SCENARIOS+=("$(basename "$scenario_file" .md)")
  done < <(find "$SCENARIOS_DIR" -maxdepth 1 -type f -name '*.md' -print | sort)
fi
for scenario_name in "$@"; do
  if [[ ! "$scenario_name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || [[ ! -f "$SCENARIOS_DIR/$scenario_name.md" ]]; then
    echo "ERROR: unknown scenario: $scenario_name" >&2
    exit 2
  fi
  if [[ -n "${SEEN_SCENARIOS[$scenario_name]:-}" ]]; then
    echo "ERROR: duplicate scenario: $scenario_name" >&2
    exit 2
  fi
  SEEN_SCENARIOS[$scenario_name]=1
  SELECTED_SCENARIOS+=("$scenario_name")
done

if [[ "${SVC_TIER2_VALIDATE_SELECTION_ONLY:-0}" == "1" ]]; then
  printf '%s\n' "${SELECTED_SCENARIOS[@]}"
  exit 0
fi

mkdir -p "$RESULTS_DIR"

source "$SCRIPT_DIR/../test-helpers.sh"

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

# Check claude CLI is available
if ! command -v claude &>/dev/null; then
  echo "ERROR: claude CLI not found. Install it or add to PATH."
  exit 1
fi

run_scenario() {
  local scenario_file="$1"
  local scenario_name
  scenario_name="$(basename "$scenario_file" .md)"
  local result_file="$RESULTS_DIR/${scenario_name}.txt"
  local json_log="$RESULTS_DIR/${scenario_name}-stream.json"
  local pass=0
  local fail=0

  echo "--- Scenario: $scenario_name ---"

  # Create a proper git-initialized project (obra scaffold pattern)
  local work_dir
  work_dir=$(create_test_project "svc-eval-${scenario_name}")
  trap 'cleanup_test_project "$work_dir"' RETURN

  echo "  Workspace: $work_dir"

  # Copy repo-level markdown for context
  cp "$REPO_ROOT"/*.md "$work_dir/" 2>/dev/null || true

  # Exercise the branch source under test, not a potentially stale global
  # install. Scenario files name one skill under `## Skill Under Test`; expose
  # that exact contract through Claude's project-local skill directory.
  local skill_under_test
  skill_under_test=$(awk '
    /^## Skill Under Test/ { in_section=1; next }
    in_section && /^## / { exit }
    in_section && /`[^`]+`/ { match($0, /`[^`]+`/); print substr($0, RSTART + 1, RLENGTH - 2); exit }
  ' "$scenario_file")
  if [[ -n "$skill_under_test" && -f "$REPO_ROOT/skills/$skill_under_test/SKILL.md" ]]; then
    mkdir -p "$work_dir/.claude/skills"
    cp -R "$REPO_ROOT/$skill_under_test" "$work_dir/.claude/skills/$skill_under_test"
  fi

  # Copy fixtures based on scenario setup section
  if grep -q "examples/todo-api" "$scenario_file"; then
    copy_todo_api_fixtures "$work_dir" "$REPO_ROOT"
  fi

  # write-journeys must prove generation from an empty journey directory, not
  # pass because the todo-api fixture already carries J01.
  if [[ "$scenario_name" == "write-journeys-generate" ]]; then
    rm -rf "$work_dir/docs/specs/journeys"
    mkdir -p "$work_dir/docs/specs/journeys"
  fi

  # Initial commit so the workspace has clean git state
  (cd "$work_dir" && git add -A && git commit -q -m "scaffold" 2>/dev/null) || true

  # Extract prompt from scenario (between ``` block under ## Prompt)
  local prompt
  prompt=$(awk '
    /^#{1,4} Prompt/ { in_section=1; next }
    in_section && /^## / { exit }
    in_section && /^```$/ && started { exit }
    in_section && started { print }
    in_section && /^```/ { started=1 }
  ' "$scenario_file")

  if [[ -z "$prompt" ]]; then
    echo "  SKIP: could not extract prompt from $scenario_file"
    TOTAL_SKIP=$((TOTAL_SKIP + 1))
    printf 'verdict=fail\nscenario=%s\nreason=missing-prompt\n' "$scenario_name" > "$result_file"
    printf '{"scenario":"%s","verdict":"fail","reason":"missing-prompt"}\n' "$scenario_name" > "$json_log"
    return
  fi

  # Run claude -p with both text output and stream-json log
  echo "  Running claude -p..."
  local output_file="$RESULTS_DIR/${scenario_name}-output.txt"
  # Run once for content checks; the structured stream file records the bounded
  # runner result so callers can audit selection and verdict without parsing prose.
  if ! (cd "$work_dir" && run_claude "$prompt" 300 text > "$output_file" 2>&1); then
    echo "  WARN: claude -p exited non-zero, checking outputs anyway"
  fi

  # Check expected outputs using test-helpers assertions
  echo "  Checking assertions..."

  # --- File existence checks ---
  local file_checks
  file_checks=$(awk '/^### File Exists/,/^### /{
    if (/^- /) print
  }' "$scenario_file")

  while IFS= read -r check; do
    [[ -z "$check" ]] && continue
    local pattern
    pattern=$(echo "$check" | grep -oP '`[^`]+`' | head -1 | tr -d '`')
    [[ -z "$pattern" ]] && continue

    if assert_glob_matches "$work_dir/$pattern" "file exists: $pattern"; then
      pass=$((pass + 1))
    else
      fail=$((fail + 1))
    fi
  done <<< "$file_checks"

  # --- Content checks ([ ] checkboxes in scenario) ---
  local content_checks
  content_checks=$(awk '/^### Content Checks/,/^## /{
    if (/^\- \[ \]/) print
  }' "$scenario_file")

  while IFS= read -r check; do
    [[ -z "$check" ]] && continue

    # Extract grep patterns from quoted terms in the check description
    local grep_terms
    grep_terms=$(echo "$check" | grep -oP '"[^"]*"' | tr -d '"' || true)

    if [[ -z "$grep_terms" ]]; then
      echo "    SKIP: could not parse check: $(echo "$check" | head -c 80)"
      continue
    fi

    # Check if any of the quoted terms appear in workspace docs
    local found=false
    while IFS= read -r term; do
      [[ -z "$term" ]] && continue
      if grep -rqi "$term" "$work_dir/docs/" 2>/dev/null; then
        found=true
        break
      fi
    done <<< "$grep_terms"

    local short_check
    short_check=$(echo "$check" | sed 's/^- \[ \] //' | head -c 80)
    if $found; then
      echo "  [PASS] $short_check"
      pass=$((pass + 1))
    else
      echo "  [FAIL] $short_check"
      fail=$((fail + 1))
    fi
  done <<< "$content_checks"

  # --- Process checks (structured, scenario-authored) ---
  if grep -q "^### Process Checks" "$scenario_file"; then
    if node "$REPO_ROOT/scripts/tier2-process-assertions.mjs" "$scenario_file" "$work_dir" "$output_file"; then
      pass=$((pass + 1))
    else
      fail=$((fail + 1))
    fi
  fi

  echo "  Result: $pass passed, $fail failed"
  if [[ "$fail" -eq 0 ]]; then
    printf 'verdict=pass\nscenario=%s\npassed=%s\nfailed=0\nskipped=0\n' "$scenario_name" "$pass" > "$result_file"
    printf '{"scenario":"%s","verdict":"pass","passed":%s,"failed":0,"skipped":0}\n' "$scenario_name" "$pass" > "$json_log"
  else
    printf 'verdict=fail\nscenario=%s\npassed=%s\nfailed=%s\nskipped=0\n' "$scenario_name" "$pass" "$fail" > "$result_file"
    printf '{"scenario":"%s","verdict":"fail","passed":%s,"failed":%s,"skipped":0}\n' "$scenario_name" "$pass" "$fail" > "$json_log"
  fi

  TOTAL_PASS=$((TOTAL_PASS + pass))
  TOTAL_FAIL=$((TOTAL_FAIL + fail))
}

echo "=== Tier 2: Integration Scenarios ==="
echo "  Scenarios dir: $SCENARIOS_DIR"
echo ""

for scenario_name in "${SELECTED_SCENARIOS[@]}"; do
  run_scenario "$SCENARIOS_DIR/$scenario_name.md"
  echo ""
done

echo "=== Tier 2 Summary ==="
echo "  $TOTAL_PASS passed, $TOTAL_FAIL failed, $TOTAL_SKIP skipped"

# Write summary
cat > "$RESULTS_DIR/summary.txt" <<EOF
Tier 2 Integration Scenarios
Run: $(date -Iseconds)
Passed: $TOTAL_PASS
Failed: $TOTAL_FAIL
Skipped: $TOTAL_SKIP
EOF

if [[ $TOTAL_FAIL -gt 0 || $TOTAL_SKIP -gt 0 ]]; then
  exit 1
else
  exit 0
fi
