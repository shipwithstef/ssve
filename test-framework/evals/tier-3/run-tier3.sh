#!/usr/bin/env bash
# Tier 3: LLM-as-judge evaluation.
# Sends skill output + judge prompt to claude -p and parses the JSON score.
#
# COST ESTIMATE (billed to your Claude Code subscription):
#   ~15K input tokens + ~3K output tokens per judgment
#   At Claude Sonnet rates: approximately $0.25–0.40 USD per judgment
#   (varies by artifact size and output length)
#
# TIME: ~30–60 seconds per judgment
#
# Usage: ./run-tier3.sh <skill-output-file> <judge-dimension> [prior-phases-dir]
#   skill-output-file: path to the artifact to evaluate
#   judge-dimension: completeness | consistency | actionability
#   prior-phases-dir: (optional) directory with prior phase artifacts for consistency judging
#
# Example:
#   ./run-tier3.sh /tmp/workspace/docs/specs/features/bookmarks.md completeness
#   ./run-tier3.sh /tmp/workspace/docs/plans/manifest.md consistency /tmp/workspace/docs/specs
#   ./run-tier3.sh /tmp/workspace/docs/specs/features/bookmarks.md actionability
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JUDGE_DIR="$SCRIPT_DIR/judge-prompts"
RESULTS_DIR="$SCRIPT_DIR/../results/tier-3/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"
MIN_SCORE="${SVC_TIER3_MIN_SCORE:-7}"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <skill-output-file> <dimension> [prior-phases-dir]"
  echo "  dimension: completeness | consistency | actionability"
  exit 1
fi

SKILL_OUTPUT_FILE="$1"
DIMENSION="$2"
PRIOR_DIR="${3:-}"

JUDGE_PROMPT_FILE="$JUDGE_DIR/${DIMENSION}.md"

if [[ ! -f "$JUDGE_PROMPT_FILE" ]]; then
  echo "ERROR: Judge prompt not found: $JUDGE_PROMPT_FILE"
  echo "  Available: completeness, consistency, actionability"
  exit 1
fi

if [[ ! -f "$SKILL_OUTPUT_FILE" ]]; then
  echo "ERROR: Skill output file not found: $SKILL_OUTPUT_FILE"
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo "ERROR: claude CLI not found."
  exit 1
fi

# Build the evaluation prompt
JUDGE_PROMPT=$(cat "$JUDGE_PROMPT_FILE")
SKILL_OUTPUT=$(cat "$SKILL_OUTPUT_FILE")

EVAL_PROMPT="$JUDGE_PROMPT

---

## Skill Output to Evaluate

\`\`\`
$SKILL_OUTPUT
\`\`\`"

# Add prior phase context for consistency dimension
if [[ "$DIMENSION" == "consistency" && -n "$PRIOR_DIR" && -d "$PRIOR_DIR" ]]; then
  PRIOR_CONTEXT=""
  for f in "$PRIOR_DIR"/*.md "$PRIOR_DIR"/**/*.md; do
    [[ ! -f "$f" ]] && continue
    PRIOR_CONTEXT+="
### $(basename "$f")
\`\`\`
$(head -100 "$f")
\`\`\`
"
  done

  EVAL_PROMPT+="

---

## Prior Phase Outputs

$PRIOR_CONTEXT"
fi

# Run judge
echo "=== Tier 3: $DIMENSION judgment ==="
echo "  Evaluating: $SKILL_OUTPUT_FILE"

RESULT_FILE="$RESULTS_DIR/${DIMENSION}-$(basename "$SKILL_OUTPUT_FILE" .md).json"

JUDGE_OUTPUT=$(claude -p "$EVAL_PROMPT" --output-format text 2>&1) || true

# Try to extract JSON from the output
JSON_RESULT=$(echo "$JUDGE_OUTPUT" | grep -Pzo '\{[^{}]*"dimension"[^{}]*\}' | tr '\0' '\n' || true)

if [[ -z "$JSON_RESULT" ]]; then
  # Fallback: try to find any JSON block
  JSON_RESULT=$(echo "$JUDGE_OUTPUT" | sed -n '/^{/,/^}/p' || true)
fi

if [[ -n "$JSON_RESULT" ]]; then
  echo "$JSON_RESULT" > "$RESULT_FILE"

  # Parse and display score
  SCORE=$(echo "$JSON_RESULT" | grep -oP '"score":\s*\K[0-9]+' || echo "?")
  REASONING=$(echo "$JSON_RESULT" | grep -oP '"reasoning":\s*"\K[^"]*' || echo "Could not parse reasoning")

  echo "  Score: $SCORE/10"
  echo "  Reasoning: $REASONING"
  echo "  Full result: $RESULT_FILE"
  if [[ "$SCORE" == "?" || "$SCORE" -lt "$MIN_SCORE" ]]; then
    echo "  FAIL: score below minimum ${MIN_SCORE}/10"
    exit 1
  fi
else
  echo "  WARN: Could not parse JSON from judge output"
  echo "$JUDGE_OUTPUT" > "$RESULT_FILE.raw"
  echo "  Raw output saved: $RESULT_FILE.raw"
  exit 1
fi

echo ""
echo "=== Tier 3 Complete ==="
