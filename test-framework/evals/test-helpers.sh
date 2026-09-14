#!/usr/bin/env bash
# Shared test helpers for svc evals.
# Inspired by obra/superpowers test-helpers.sh.
#
# Source this file in test scripts:
#   source "$(dirname "$0")/../test-helpers.sh"

# Run Claude Code headless with a prompt and capture output.
# Pipes the prompt via stdin to avoid CLI arg parsing issues
# (e.g., prompts containing --- being interpreted as flags).
# Usage: run_claude "prompt text" [timeout_seconds] [output_format]
#   output_format: "text" (default) or "stream-json"
run_claude() {
  local prompt="$1"
  local timeout="${2:-120}"
  local format="${3:-text}"
  local output_file
  output_file=$(mktemp)

  local format_args=(--output-format "$format")
  # stream-json requires --verbose in Claude CLI
  if [[ "$format" == "stream-json" ]]; then
    format_args+=(--verbose)
  fi

  if echo "$prompt" | timeout "$timeout" claude -p \
      "${format_args[@]}" \
      > "$output_file" 2>&1; then
    cat "$output_file"
    rm -f "$output_file"
    return 0
  else
    local exit_code=$?
    cat "$output_file"
    rm -f "$output_file"
    return $exit_code
  fi
}

# Check if output contains a pattern (grep -E).
# Usage: assert_contains "output" "pattern" "test name"
assert_contains() {
  local output="$1"
  local pattern="$2"
  local test_name="${3:-unnamed test}"

  if echo "$output" | grep -qE "$pattern"; then
    echo "  [PASS] $test_name"
    return 0
  else
    echo "  [FAIL] $test_name"
    echo "    expected to find: $pattern"
    return 1
  fi
}

# Check if output does NOT contain a pattern.
# Usage: assert_not_contains "output" "pattern" "test name"
assert_not_contains() {
  local output="$1"
  local pattern="$2"
  local test_name="${3:-unnamed test}"

  if echo "$output" | grep -qE "$pattern"; then
    echo "  [FAIL] $test_name"
    echo "    did not expect to find: $pattern"
    return 1
  else
    echo "  [PASS] $test_name"
    return 0
  fi
}

# Check that pattern A appears before pattern B in output.
# Usage: assert_order "output" "pattern_a" "pattern_b" "test name"
assert_order() {
  local output="$1"
  local pattern_a="$2"
  local pattern_b="$3"
  local test_name="${4:-unnamed test}"

  local line_a line_b
  line_a=$(echo "$output" | grep -nE "$pattern_a" | head -1 | cut -d: -f1)
  line_b=$(echo "$output" | grep -nE "$pattern_b" | head -1 | cut -d: -f1)

  if [[ -z "$line_a" ]]; then
    echo "  [FAIL] $test_name: pattern A not found: $pattern_a"
    return 1
  fi
  if [[ -z "$line_b" ]]; then
    echo "  [FAIL] $test_name: pattern B not found: $pattern_b"
    return 1
  fi
  if [[ "$line_a" -lt "$line_b" ]]; then
    echo "  [PASS] $test_name (A at line $line_a, B at line $line_b)"
    return 0
  else
    echo "  [FAIL] $test_name: expected '$pattern_a' (line $line_a) before '$pattern_b' (line $line_b)"
    return 1
  fi
}

# Check that pattern matches exactly N times.
# Usage: assert_count "output" "pattern" expected_count "test name"
assert_count() {
  local output="$1"
  local pattern="$2"
  local expected="$3"
  local test_name="${4:-unnamed test}"

  local actual
  actual=$(echo "$output" | grep -cE "$pattern" || echo "0")

  if [[ "$actual" -eq "$expected" ]]; then
    echo "  [PASS] $test_name (found $actual)"
    return 0
  else
    echo "  [FAIL] $test_name: expected $expected, found $actual"
    return 1
  fi
}

# Check that a file exists.
# Usage: assert_file_exists "path" "test name"
assert_file_exists() {
  local path="$1"
  local test_name="${2:-file exists: $path}"

  if [[ -f "$path" ]]; then
    echo "  [PASS] $test_name"
    return 0
  else
    echo "  [FAIL] $test_name: $path not found"
    return 1
  fi
}

# Check that a file contains a pattern.
# Usage: assert_file_contains "path" "pattern" "test name"
assert_file_contains() {
  local path="$1"
  local pattern="$2"
  local test_name="${3:-file contains: $pattern}"

  if [[ ! -f "$path" ]]; then
    echo "  [FAIL] $test_name: file $path not found"
    return 1
  fi
  if grep -qE "$pattern" "$path"; then
    echo "  [PASS] $test_name"
    return 0
  else
    echo "  [FAIL] $test_name: '$pattern' not found in $path"
    return 1
  fi
}

# Check that a glob pattern matches at least one file.
# Usage: assert_glob_matches "pattern" "test name"
assert_glob_matches() {
  local pattern="$1"
  local test_name="${2:-glob matches: $pattern}"

  if compgen -G "$pattern" >/dev/null 2>&1; then
    echo "  [PASS] $test_name"
    return 0
  else
    echo "  [FAIL] $test_name: no files match $pattern"
    return 1
  fi
}

# In stream-json output, check that a specific skill was invoked.
# Usage: assert_skill_triggered "json_output" "skill-name" "test name"
assert_skill_triggered() {
  local output="$1"
  local skill_name="$2"
  local test_name="${3:-skill triggered: $skill_name}"

  # Match "skill":"name" or "skill":"namespace:name"
  local pattern="\"skill\":\"([^\"]*:)?${skill_name}\""
  if echo "$output" | grep -q '"name":"Skill"' && echo "$output" | grep -qE "$pattern"; then
    echo "  [PASS] $test_name"
    return 0
  else
    echo "  [FAIL] $test_name"
    echo "    skills triggered:"
    echo "$output" | grep -o '"skill":"[^"]*"' 2>/dev/null | sort -u | sed 's/^/      /' || echo "      (none)"
    return 1
  fi
}

# In stream-json output, check that no tools were invoked before the Skill tool.
# (Catches the failure mode where Claude starts working before loading the skill.)
# Usage: assert_no_premature_tools "json_output" "test name"
assert_no_premature_tools() {
  local output="$1"
  local test_name="${2:-no premature tool invocations}"

  local first_skill_line
  first_skill_line=$(echo "$output" | grep -n '"name":"Skill"' | head -1 | cut -d: -f1)

  if [[ -z "$first_skill_line" ]]; then
    echo "  [FAIL] $test_name: no Skill invocation found at all"
    return 1
  fi

  # Check for tool_use before the first Skill invocation (excluding TodoWrite/TaskCreate)
  local premature
  premature=$(echo "$output" | head -n "$first_skill_line" | \
    grep '"type":"tool_use"' | \
    grep -v '"name":"Skill"' | \
    grep -v '"name":"TodoWrite"' | \
    grep -v '"name":"TaskCreate"' || true)

  if [[ -n "$premature" ]]; then
    echo "  [FAIL] $test_name: tools invoked before Skill:"
    echo "$premature" | grep -o '"name":"[^"]*"' | head -5 | sed 's/^/      /'
    return 1
  else
    echo "  [PASS] $test_name"
    return 0
  fi
}

# Create a temporary test project with git init and optional fixtures.
# Returns the project path. Caller must clean up with cleanup_test_project.
# Usage: project_dir=$(create_test_project "project-name")
create_test_project() {
  local name="${1:-svc-test}"
  local project_dir
  project_dir=$(mktemp -d "/tmp/${name}-XXXXXX")

  cd "$project_dir"
  git init -q
  git config user.email "contact-55f59e33e8@example.invalid"
  git config user.name "svc-test"

  mkdir -p docs/specs/personas docs/specs/features docs/specs/journeys \
           docs/specs/ux docs/specs/ui docs/plans

  echo "$project_dir"
}

# Clean up a test project created by create_test_project.
# Usage: cleanup_test_project "$project_dir"
cleanup_test_project() {
  local project_dir="$1"
  if [[ -d "$project_dir" && "$project_dir" == /tmp/* ]]; then
    rm -rf "$project_dir"
  fi
}

# Copy svc example fixtures into a test project.
# Usage: copy_todo_api_fixtures "$project_dir" "$repo_root"
copy_todo_api_fixtures() {
  local project_dir="$1"
  local repo_root="$2"

  cp -r "$repo_root/examples/todo-api/docs/"* "$project_dir/docs/" 2>/dev/null || true
}

# Track test pass/fail counts. Call at end of test file.
# Usage:
#   PASS=0; FAIL=0
#   assert_contains ... && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
#   ...
#   report_results "$test_suite_name" $PASS $FAIL
report_results() {
  local suite="$1"
  local pass="$2"
  local fail="$3"

  echo ""
  echo "=== $suite: $pass passed, $fail failed ==="
  if [[ $fail -gt 0 ]]; then
    return 1
  fi
  return 0
}

# Export all functions for use in subshells
# Usage: run_kimi "prompt text" [timeout_seconds] [output_format]
#   output_format: "text" (default) or "stream-json"
run_kimi() {
  local prompt="$1"
  local timeout="${2:-180}"
  local format="${3:-text}"
  local output_file
  output_file=$(mktemp)

  local format_args=(--output-format "$format")
  if [[ "$format" == "stream-json" ]]; then
    format_args+=(--verbose)
  fi

  # Pipe prompt via stdin to avoid CLI arg parsing issues with long prompts
  # NOTE: --final-message-only is intentionally omitted to preserve full
  # session trace (thinking steps, tool calls) for tier-3 judge and audit.
  if echo "$prompt" | timeout "$timeout" kimi --print --yolo \
      --input-format text \
      > "$output_file" 2>&1; then
    cat "$output_file"
    rm -f "$output_file"
    return 0
  else
    local exit_code=$?
    cat "$output_file"
    rm -f "$output_file"
    return $exit_code
  fi
}

export -f run_claude run_kimi assert_contains assert_not_contains assert_order assert_count
export -f assert_file_exists assert_file_contains assert_glob_matches
export -f assert_skill_triggered assert_no_premature_tools
export -f create_test_project cleanup_test_project copy_todo_api_fixtures
export -f report_results
