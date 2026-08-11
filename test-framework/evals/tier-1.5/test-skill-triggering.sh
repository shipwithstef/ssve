#!/usr/bin/env bash
# Tier 1.5: Skill Triggering Tests
#
# Tests whether Claude recommends the correct svc skill from a naive
# prompt. Unlike obra/superpowers (installed as plugins), svc skills
# are local SKILL.md files — they aren't auto-discovered. So we test whether
# Claude, given knowledge of the skill manifest, correctly identifies which
# skill to use.
#
# Each test: ~60s, ~10K tokens.
# Requires: claude CLI
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

PROMPTS_DIR="$SCRIPT_DIR/prompts/triggering"

PASS=0
FAIL=0

# Detect available LLM runner
if command -v kimi &>/dev/null; then
  RUNNER_NAME="kimi"
elif command -v claude &>/dev/null; then
  RUNNER_NAME="claude"
else
  echo "ERROR: No LLM CLI found (kimi or claude required)"
  exit 1
fi

# Build a manifest context block for the prompt
MANIFEST_CONTEXT=$(cat <<'EOF'
You are a svc routing assistant. Given a user request, identify which svc skill should handle it.

Available skills and their purposes:
- write-vision: Create/refine product vision documents
- build-personas: Create user personas from vision
- validate-feature: Discover, validate, and prioritize features
- write-spec: Define feature requirements with user stories and ACs
- audit-ac: Audit spec ACs for quality and completeness
- sync-spec-code: Detect drift between specs and code
- define-code-style: Generate/audit code style contracts
- write-journeys: Create user journey maps and Gherkin scenarios
- design-ux: Create UX screen flows and states
- design-ui: Create UI component specs and design tokens
- design-tech: Create technical architecture design
- plan-changeset: Produce implementation manifests with task graphs
- execute-changeset: Execute implementation tasks with TDD
- review-gate: Multi-pass code review
- land-changeset: Squash-merge reviewed branch to main
- verify-promotion: Post-merge verification
- diagnose-bug: Triage and scope bug fixes
- onboard-repo: Convert existing repos to svc structure
- sync-work-items: Track work items across iterations
- analyze-domain: Build domain knowledge profiles
- analyze-competitors: Analyze competitor products
- research: On-demand research for APIs, libraries, patterns. Full analysis mode for URLs/repos.
- write-e2e: Generate E2E tests from journey scenarios
- mine-builder: Mine builder profile (finances, skills, social, tools, history)
- find-opportunity: Find fastest revenue path matched to builder
- stage-revenue: Break big ideas into revenue stages
- improve-framework: Self-improvement loop for the svc framework
- test-framework: Test and benchmark the svc pipeline
- evolve-framework: Diagnose framework gaps and propose improvements
- blend-external: Analyze external repos and propose patterns to take
- teach-project: Teach builder what was built and how to manage it
- quick-fix: Fast lane for trivial changes (3 or fewer files)
- create-skill: Create new skills with eval infrastructure
- plan-capabilities: Recommend MCPs, skills, and tools for a project type

Respond with ONLY the skill name (e.g., "diagnose-bug"). No explanation.

NOTE on trigger testing methodology: the most valuable negative test cases are
"near-misses" — queries that share keywords with a skill but should NOT trigger it.
Example: "extract chart from Excel as PNG" should NOT trigger a PDF skill even though
both involve document processing. Obvious non-matches ("write fibonacci") are worthless.
EOF
)

test_routing() {
  local expected_skill="$1"
  local prompt_file="$2"
  local user_prompt
  user_prompt=$(cat "$prompt_file")

  echo "--- Routing test: $expected_skill ---"
  echo "  Prompt: $(head -c 80 "$prompt_file")..."

  local full_prompt="${MANIFEST_CONTEXT}

User request: ${user_prompt}"

  local output
  output=$(run_claude "$full_prompt" 60 "stream-json") || true

  if [[ "$RUNNER_NAME" == "kimi" ]]; then
    # Kimi does not use Claude's Skill tool format. Fallback: check if output
    # mentions the expected skill name (indicates correct routing awareness).
    if echo "$output" | grep -qi "$expected_skill"; then
      echo "  [PASS] Output mentions $expected_skill"
      PASS=$((PASS + 1))
    else
      echo "  [FAIL] Output does not mention $expected_skill"
      FAIL=$((FAIL + 1))
      echo "    Raw output (first 200 chars): $(echo "$output" | head -c 200)"
    fi
  else
    # Primary check: actual Skill tool invocation (Claude format)
    if assert_skill_triggered "$output" "$expected_skill" "Triggers $expected_skill via Skill tool"; then
      PASS=$((PASS + 1))
    else
      FAIL=$((FAIL + 1))
      echo "    Raw output (first 200 chars): $(echo "$output" | head -c 200)"
    fi

    # Secondary check: no premature tool use before Skill invocation
    if assert_no_premature_tools "$output" "No tools before Skill for $expected_skill"; then
      PASS=$((PASS + 1))
    else
      FAIL=$((FAIL + 1))
    fi
  fi
  echo ""
}

SINGLE_SKILL="${SINGLE_SKILL:-}"

if [[ -n "$SINGLE_SKILL" ]]; then
  echo "=== Tier 1.5: Skill Triggering ($SINGLE_SKILL only) ==="
else
  echo "=== Tier 1.5: Skill Triggering (Routing) Tests ==="
fi
echo "  Prompts dir: $PROMPTS_DIR"
echo ""

for prompt_file in "$PROMPTS_DIR"/*.txt; do
  [[ ! -f "$prompt_file" ]] && continue
  expected_skill="$(basename "$prompt_file" .txt)"
  if [[ -n "$SINGLE_SKILL" && "$expected_skill" != "$SINGLE_SKILL" ]]; then
    continue
  fi
  test_routing "$expected_skill" "$prompt_file"
done

report_results "Skill Triggering" $PASS $FAIL
