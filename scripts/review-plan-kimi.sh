#!/bin/bash
# scripts/review-plan-kimi.sh <plan-manifest-md>
# Tier-2 (or Tier-3) adversarial review via Kimi Code CLI.
#
# Works as:
#   - Primary Tier-2 when running kimi-native profile (no Codex/Claude available)
#   - Fallback Tier-2 when Codex and Claude are both absent
#   - Tier-3 tie-break when Tier-2 was Codex or Claude (cross-family distance)
#
# Output: YAML findings block per references/plan-review-protocol.md.
#
# Exit codes (WI-075 contract):
#   0 — reviewer completed and emitted findings block
#   1 — kimi invocation failed (tool error)
#   2 — reviewer completed but findings block is missing or malformed
#   3 — kimi not on PATH (orchestrator should fall back)
set -eu

PLAN="${1:-}"
if [ -z "$PLAN" ] || [ ! -r "$PLAN" ]; then
  echo "usage: review-plan-kimi.sh <plan-manifest-md>" >&2
  exit 2
fi

command -v kimi >/dev/null 2>&1 || {
  echo "kimi not on PATH — orchestrator should fall back to next available reviewer" >&2
  exit 3
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PROTOCOL_REF="$REPO_ROOT/references/plan-review-protocol.md"

# Build scope-locked prompt with the full plan embedded
PROMPT=$(cat <<EOF
OUTPUT-FIRST PROTOCOL (CRITICAL — read this first):

You MUST begin your response with the YAML findings block. No preamble,
no exploration, no commentary before the YAML. If you need to read files
beyond the plan, do it AFTER emitting your initial findings block — then
append a SECOND findings block if new evidence changes your verdict.

This is a hard behavioral constraint. Reviewers that start writing files,
running shell commands, or otherwise exhaust their turn without emitting
a findings block have VIOLATED the review contract. Findings FIRST.

READ-ONLY CONTRACT: this review is read-only. Do NOT create, edit, move,
or delete any files. Do NOT run any command that mutates the filesystem.
Any such action invalidates the review.

---

You are an adversarial plan reviewer. You are NOT the plan author — your job is to find flaws, missing determinism, and unreachable assumptions.

SCOPE LOCK (hard rule, violation = invalid review):
  Files you MAY read: $PLAN, and any file explicitly listed in the plan's files_touched / new_files / edited_files / touches block.
  You may NOT glob the repo, grep across directories, or explore filesystem beyond what the plan itself names as input/output.

FOCUS DIMENSIONS (include lane compliance per WI-075):
  (a) AC-to-task coverage gaps
  (b) Scope-boundary leaks (files touched outside the declared set)
  (c) Rollback adequacy
  (d) Determinism rubric (below)
  (e) Idempotency / re-run safety
  (f) Execute-risk (what will actually break)
  (g) Lane compliance: for the declared lane, list every mandatory upstream
      skill (evolve-framework, improve-framework, write-spec, plan-changeset,
      etc.). For each, confirm the plan shows it as either completed (cite
      artifact) or skipped-with-justification (cite pipeline-decisions.jsonl).
      An unnamed mandatory lane skill is a REJECT finding.

PROTOCOL:
  Follow the Finding format + Determinism Rubric in this file:
  $PROTOCOL_REF

YOUR OUTPUT MUST BE:
  - Only a YAML block matching the "Finding format" schema in the protocol.
  - No preamble, no commentary outside the YAML.
  - If zero findings, emit: rubric_score: 10 / rubric_failures: [] / findings: []
  - Every finding must have: id, claim, severity, analysis (multi-line), evidence (at least one concrete check), proposed_fix.

For explicit inline mode, score these same ten dimensions as solution readiness: (1) exact resolvable or declared future files; (2) complete consequential behavior and interfaces, not authored code; (3) appropriate executable proof and outcomes; (4) meaningful action/authority limits; (5) exact write scope; (6) recovery path; (7) correct dependencies; (8) observable success; (9) original AC/UX/technical trace; (10) no unresolved consequential choice. Reversible local details are allowed. v4 release identities may use the validated existing-adapter producer form. Keep integer rubric_score 0–10 and concrete findings. For dispatch/absent mode, retain the complete-code/command packet rubric below.

DETERMINISM RUBRIC — score each 0 or 1:
  1. Every file path absolute + resolvable
  2. Every change content-complete (actual code or diff, not vague descriptions)
  3. Every validation command specified + expected exit code named
  4. Every forbidden action enumerated
  5. Scope boundary explicit (files executor may / may-not touch)
  6. Rollback path defined if execution fails mid-way
  7. Dependencies between tasks correct + non-cyclic
  8. Success criteria measurable (observable fact, not "it works")
  9. Plan traces to ACs / spec (no scope creep)
  10. No variables for executor to guess ("decide later" / "figure out" absent)

PLAN TO REVIEW:
$(cat "$PLAN")
EOF
)

# Kimi one-shot with thinking ON (reviewer needs deep analysis)
# --yolo skips interactive confirmation; --print outputs to stdout
# Capture output for tail-parse per WI-075 contract.
OUTPUT_FILE=$(mktemp)
set +e
kimi --print --yolo -p "$PROMPT" 2>&1 | tee "$OUTPUT_FILE"
EXIT=${PIPESTATUS[0]}
set -e

if [ $EXIT -ne 0 ]; then
  rm -f "$OUTPUT_FILE"
  exit 1
fi

# Tail-parse: require a findings block in the output.
if grep -qE '^(findings:|rubric_score:|```yaml)' "$OUTPUT_FILE"; then
  rm -f "$OUTPUT_FILE"
  exit 0
else
  echo "" >&2
  echo "review-plan-kimi: ERROR — reviewer did not emit a findings block." >&2
  echo "  Output saved to: $OUTPUT_FILE" >&2
  echo "  Exit code 2 per WI-075 contract (findings missing)." >&2
  exit 2
fi
