#!/bin/bash
# Tier 3 (Kimi): LLM-as-judge evaluation for Kimi tier-2 outputs.
# Sends Kimi scenario output + judge prompt to the framework's [REVIEW] model
# and parses the JSON score.
#
# COST ESTIMATE (billed to your CLI subscription):
#   ~15K input tokens + ~3K output tokens per dimension judged
#   3 dimensions × 2 scenarios = ~108K tokens total
#   At Kimi k2.6 rates: approximately $0.15–0.30 USD per full run
#   At Claude Sonnet rates: approximately $0.50–0.80 USD per full run
#   (varies by output length)
#
# TIME: ~1–2 minutes total for 6 judgments (3 dims × 2 scenarios)
#
# Usage: ./run-tier3-kimi.sh <tier2-results-dir> [judge-model]
#   tier2-results-dir: path to tier-2-kimi results (e.g., ../results/tier-2-kimi/20260421-120000)
#   judge-model: claude|kimi|auto (default: auto — uses current host)
#
# Example:
#   ./run-tier3-kimi.sh ../results/tier-2-kimi/20260421-120000

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JUDGE_DIR="$SCRIPT_DIR/judge-prompts"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/../results/tier-3-kimi/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

source "$SCRIPT_DIR/../test-helpers.sh"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tier2-results-dir> [judge-model]"
  echo "  judge-model: claude | kimi | auto (default: auto)"
  exit 1
fi

TIER2_DIR="$1"
JUDGE_MODEL="${2:-auto}"

if [[ ! -d "$TIER2_DIR" ]]; then
  echo "ERROR: Tier 2 results directory not found: $TIER2_DIR"
  exit 1
fi

# Auto-detect judge model
if [[ "$JUDGE_MODEL" == "auto" ]]; then
  if command -v kimi &>/dev/null; then
    JUDGE_MODEL="kimi"
  elif command -v claude &>/dev/null; then
    JUDGE_MODEL="claude"
  else
    echo "ERROR: No judge model available. Install kimi or claude CLI."
    exit 1
  fi
fi

run_judge() {
  local prompt="$1"
  if [[ "$JUDGE_MODEL" == "kimi" ]]; then
    run_kimi "$prompt" 180 text
  else
    run_claude "$prompt" 180 text
  fi
}

TOTAL_SCENARIOS=0
TOTAL_PASS=0
TOTAL_FAIL=0

# Judge all scenario outputs in the tier-2 results dir
for output_file in "$TIER2_DIR"/*-output.txt; do
  [[ ! -f "$output_file" ]] && continue

  scenario_name="$(basename "$output_file" -output.txt)"
  echo "=== Judging: $scenario_name ==="

  SKILL_OUTPUT=$(cat "$output_file")

  # Run all three dimensions
  for dimension in completeness actionability consistency; do
    JUDGE_PROMPT_FILE="$JUDGE_DIR/${dimension}.md"
    if [[ ! -f "$JUDGE_PROMPT_FILE" ]]; then
      echo "  SKIP: judge prompt not found: $dimension"
      continue
    fi

    JUDGE_PROMPT=$(cat "$JUDGE_PROMPT_FILE")

    EVAL_PROMPT="$JUDGE_PROMPT

---

## Skill Output to Evaluate

Scenario: $scenario_name
Produced by: Kimi Code CLI

\`\`\`
$SKILL_OUTPUT
\`\`\`"

    echo "  Dimension: $dimension"
    JUDGE_OUTPUT=$(run_judge "$EVAL_PROMPT" 2>/dev/null || true)

    RESULT_FILE="$RESULTS_DIR/${scenario_name}-${dimension}.json"

    # Extract JSON from output
    JSON_RESULT=$(echo "$JUDGE_OUTPUT" | grep -Pzo '\{[^{}]*"dimension"[^{}]*\}' | tr '\0' '\n' 2>/dev/null || true)

    if [[ -z "$JSON_RESULT" ]]; then
      JSON_RESULT=$(echo "$JUDGE_OUTPUT" | sed -n '/^{/,/^}/p' 2>/dev/null || true)
    fi

    if [[ -n "$JSON_RESULT" ]]; then
      echo "$JSON_RESULT" > "$RESULT_FILE"
      SCORE=$(echo "$JSON_RESULT" | grep -oP '"score":\s*\K[0-9]+' || echo "?")
      REASONING=$(echo "$JSON_RESULT" | grep -oP '"reasoning":\s*"\K[^"]*' || echo "Could not parse")
      echo "    Score: $SCORE/10"
      echo "    Reasoning: $REASONING"

      if [[ "$SCORE" != "?" && "$SCORE" -ge 7 ]]; then
        TOTAL_PASS=$((TOTAL_PASS + 1))
      else
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
      fi
    else
      echo "    WARN: Could not parse JSON"
      echo "$JUDGE_OUTPUT" > "$RESULTS_DIR/${scenario_name}-${dimension}.raw"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  done

  TOTAL_SCENARIOS=$((TOTAL_SCENARIOS + 1))
  echo ""
done

echo "=== Kimi Tier 3 Summary ==="
echo "Scenarios judged: $TOTAL_SCENARIOS"
echo "Dimensions passed (≥7/10): $TOTAL_PASS"
echo "Dimensions failed (<7/10): $TOTAL_FAIL"
echo "Results: $RESULTS_DIR"

if [[ $TOTAL_FAIL -gt 0 ]]; then
  exit 1
fi
