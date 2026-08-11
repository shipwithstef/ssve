#!/usr/bin/env bash
# Tier 2 (Kimi): Run integration scenarios via kimi --print --yolo -p.
#
# COST ESTIMATE (billed to your Kimi CLI subscription):
#   ~50K input tokens + ~20K output tokens per scenario
#   At Kimi k2.6 rates: approximately $0.15-0.30 USD per scenario
#
# TIME: ~2-4 minutes per scenario
#
# Usage:
#   ./run-tier2-kimi.sh                    # run all scenarios
#   ./run-tier2-kimi.sh diagnose-bug-typo  # run single scenario
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"
RESULTS_DIR="$REPO_ROOT/test-framework/evals/results/tier-2-kimi/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

source "$SCRIPT_DIR/../test-helpers.sh"

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

run_scenario() {
  local scenario_file="$1"
  local scenario_name
  scenario_name="$(basename "$scenario_file" .md)"
  local pass=0
  local fail=0

  echo "--- Scenario: $scenario_name ---"

  # Create workspace from fixture or scratch
  local work_dir
  if grep -q "bugfix-todo" "$scenario_file"; then
    work_dir=$(mktemp -d "/tmp/svc-eval-${scenario_name}-XXXXXX")
    cp -r "$REPO_ROOT/test-framework/fixtures/bugfix-todo/"* "$work_dir/"
    cp -r "$REPO_ROOT/test-framework/fixtures/bugfix-todo/.git" "$work_dir/" 2>/dev/null || true
    cp -r "$REPO_ROOT/test-framework/fixtures/bugfix-todo/.svc" "$work_dir/" 2>/dev/null || true
  else
    work_dir=$(create_test_project "svc-eval-${scenario_name}")
  fi
  trap 'cleanup_test_project "$work_dir"' RETURN

  echo "  Workspace: $work_dir"

  # Extract prompt from scenario (between ``` block under ## Prompt or ## Invocation)
  local prompt
  prompt=$(awk '
    /^#{1,4} (Prompt|Invocation)/ { in_section=1; next }
    in_section && /^## / && !/^#{1,4} (Prompt|Invocation)/ { exit }
    in_section && /^```$/ && started { exit }
    in_section && started { print }
    in_section && /^```/ { started=1 }
  ' "$scenario_file")

  if [[ -z "$prompt" ]]; then
    echo "  SKIP: could not extract prompt from $scenario_file"
    TOTAL_SKIP=$((TOTAL_SKIP + 1))
    return
  fi

  # Run kimi --print --yolo -p (pipe via stdin, capture full trace)
  echo "  Running kimi --print --yolo..."
  local output_file="$RESULTS_DIR/${scenario_name}-output.txt"

  if ! (cd "$work_dir" && echo "$prompt" | timeout 240 kimi --print --yolo --input-format text > "$output_file" 2>&1); then
    echo "  WARN: kimi exited non-zero or timed out, checking outputs anyway"
  fi

  echo "  Output saved: $output_file ($(wc -c < "$output_file") bytes)"

  # Check assertions
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
    if (/^- \[ \]/) print
  }' "$scenario_file")

  while IFS= read -r check; do
    [[ -z "$check" ]] && continue

    local grep_terms
    grep_terms=$(echo "$check" | grep -oP '"[^"]*"' | tr -d '"' || true)

    if [[ -z "$grep_terms" ]]; then
      echo "    SKIP: could not parse check: $(echo "$check" | head -c 80)"
      continue
    fi

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

  # --- Bash assertion checks (## Assertions section) ---
  local bash_assertions
  bash_assertions=$(awk '/^## Assertions$/{flag=1; next} /^## [^#]/{flag=0} flag && /^[0-9]+\./{print}' "$scenario_file")

  while IFS= read -r assertion; do
    [[ -z "$assertion" ]] && continue
    local cmd
    cmd=$(echo "$assertion" | sed -n 's/.*`\([^`]*\)`.*/\1/p')
    [[ -z "$cmd" ]] && continue

    if (cd "$work_dir" && eval "$cmd" >/dev/null 2>&1); then
      echo "  [PASS] $assertion"
      pass=$((pass + 1))
    else
      echo "  [FAIL] $assertion"
      fail=$((fail + 1))
    fi
  done <<< "$bash_assertions"

  echo "  Result: $pass passed, $fail failed"
  echo "$scenario_name: $pass passed, $fail failed" > "$RESULTS_DIR/${scenario_name}.txt"

  TOTAL_PASS=$((TOTAL_PASS + pass))
  TOTAL_FAIL=$((TOTAL_FAIL + fail))
}

echo "=== Tier 2 (Kimi): Integration Scenarios ==="
echo "  Results dir: $RESULTS_DIR"
echo ""

# Allow running a single scenario
if [[ $# -ge 1 ]]; then
  SCENARIO_NAME="$1"
  SCENARIO_FILE="$SCENARIOS_DIR/${SCENARIO_NAME}.md"
  if [[ ! -f "$SCENARIO_FILE" ]]; then
    echo "ERROR: Scenario not found: $SCENARIO_FILE"
    exit 1
  fi
  run_scenario "$SCENARIO_FILE"
else
  for scenario in "$SCENARIOS_DIR"/*.md; do
    [[ ! -f "$scenario" ]] && continue
    run_scenario "$scenario"
    echo ""
  done
fi

echo "=== Tier 2 (Kimi) Summary ==="
echo "  $TOTAL_PASS passed, $TOTAL_FAIL failed, $TOTAL_SKIP skipped"

cat > "$RESULTS_DIR/summary.txt" <<EOF
Tier 2 (Kimi) Integration Scenarios
Run: $(date -Iseconds)
Passed: $TOTAL_PASS
Failed: $TOTAL_FAIL
Skipped: $TOTAL_SKIP
EOF

if [[ $TOTAL_FAIL -gt 0 ]]; then
  exit 1
else
  exit 0
fi
