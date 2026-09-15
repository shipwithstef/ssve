#!/usr/bin/env bash
# Tier 1: Validate cross-host task-graph and svc-on-svc framework-management contracts.
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"
ROUTER="$REPO_ROOT/skills/route-workflow/SKILL.md"
FRAMEWORK_POLICY_REF="$REPO_ROOT/skills/route-workflow/references/framework-policy.md"
PROJECT_STATE_REF="$REPO_ROOT/skills/route-workflow/references/project-state.md"
AUTORUN_REF="$REPO_ROOT/skills/route-workflow/references/autorun-orchestrator.md"
TASK_PROTOCOL_REF="$REPO_ROOT/skills/route-workflow/references/task-graph-protocol.md"
ROUTING_RULES_REF="$REPO_ROOT/skills/route-workflow/references/routing-rules.md"
DECISION_LOG_REF="$REPO_ROOT/skills/route-workflow/references/decision-log.md"
IMPROVE="$REPO_ROOT/skills/improve-framework/SKILL.md"
ONBOARD="$REPO_ROOT/skills/onboard-repo/SKILL.md"
AUDIT_COVERAGE="$REPO_ROOT/skills/audit-coverage/SKILL.md"
AUDIT_SESSION="$REPO_ROOT/skills/audit-session-execution/SKILL.md"
EXECUTE="$REPO_ROOT/skills/execute-changeset/SKILL.md"
HOOK="$REPO_ROOT/hooks/svc-task-completion-guard.sh"
HOOKS_JSON="$REPO_ROOT/hooks/hooks.json"
TASK_GRAPH_HELPER="$REPO_ROOT/scripts/task-graph.mjs"
PIPELINE_LOG_HELPER="$REPO_ROOT/scripts/pipeline-log.mjs"
CODEX_HOST="$REPO_ROOT/provision/hosts/codex.json"
CLAUDE_HOST="$REPO_ROOT/provision/hosts/claude.json"
KIMI_HOST="$REPO_ROOT/provision/hosts/kimi.json"
GEMINI_HOST="$REPO_ROOT/provision/hosts/gemini.json"
TASK_CHAINING_REF="$REPO_ROOT/references/task-graph-chaining-protocol.md"
INFRA_DETAIL="$REPO_ROOT/references/knowledge/svc/details/infrastructure.md"
VERIFY_CONTRACT="$REPO_ROOT/scripts/verify-skill-contract.mjs"
CONTRACT_FIXTURES="$REPO_ROOT/test-framework/fixtures/contract-validation"

PASS=0
FAIL=0
ERRORS=""

require_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    PASS=$((PASS + 1))
  else
    ERRORS+="  FAIL: $label missing in $(basename "$file")\n"
    FAIL=$((FAIL + 1))
  fi
}

require_contains "$FRAMEWORK_POLICY_REF" "## Framework Self-Management Policy (svc-on-svc)" "framework self-management policy section"
require_contains "$FRAMEWORK_POLICY_REF" "| Known framework gap, pending proposal, replay failure, or implementation-ready framework finding | \`improve-framework\` |" "known framework gap route"
require_contains "$FRAMEWORK_POLICY_REF" "| Broken framework behavior or regression in an existing contract | \`diagnose-bug\` |" "framework regression route"
require_contains "$FRAMEWORK_POLICY_REF" "| New framework capability or deliberate framework behavior change | \`write-spec\` |" "framework capability route"
require_contains "$FRAMEWORK_POLICY_REF" "**\`explore-solutions\` is mandatory** for svc-on-svc work" "explore-solutions escalation rule"
require_contains "$TASK_PROTOCOL_REF" "Write \`.svc/lane-tasks-<WI>.json\` with \`node scripts/task-graph.mjs init .svc/lane-tasks-<WI>.json --wi <WI> --lane <lane>\`. The helper blocks graph creation if the matching session-contract entry is missing, stale, or bound to a different WI. The lane-tasks file is the cross-host source of truth for status, skip reasons, and resume." "lane-tasks source-of-truth rule"
require_contains "$TASK_PROTOCOL_REF" "This file is the **cross-host source of truth** for task state." "cross-host source-of-truth declaration"
require_contains "$PROJECT_STATE_REF" "docs/specs/router-context.md" "router-context contract"
require_contains "$PROJECT_STATE_REF" "docs/specs/agent-topology.md" "agent-topology contract"
require_contains "$PROJECT_STATE_REF" "## Current Focus" "project-state current focus template"
require_contains "$AUTORUN_REF" "Cross-session unattended continuation is not assumed unless" "autorun continuation honesty"
require_contains "$TASK_PROTOCOL_REF" "Do NOT reference or invoke a \`loop\` skill unless a verified" "no fake loop skill rule"
require_contains "$TASK_PROTOCOL_REF" "**Current Focus sync (MANDATORY if \`docs/specs/project-state.md\` exists):**" "lane-entry current focus sync"
require_contains "$TASK_PROTOCOL_REF" "**Resume invariant:** if \`lane-tasks-<WI>.json\` and \`project-state.md\`" "resume current focus repair rule"
require_contains "$TASK_PROTOCOL_REF" "If the graph has **no actionable tasks** (\`pending\` or \`in_progress\`) and the WI file is already \`VERIFIED\`, return a closed-state summary and stop." "named-WI closed-state resume short-circuit"
require_contains "$TASK_PROTOCOL_REF" "Persisted task-graph timestamps are audit-grade wall-clock evidence." "task-graph timestamp provenance rule"
require_contains "$TASK_PROTOCOL_REF" "For top-level task status changes, use \`node scripts/task-graph.mjs set-status" "task-graph helper status rule"
require_contains "$TASK_PROTOCOL_REF" "**Kimi CLI:**" "route-workflow Kimi host mechanics"
require_contains "$TASK_PROTOCOL_REF" "node scripts/task-graph.mjs load-skill" "route-workflow skill-load receipt rule"
require_contains "$TASK_PROTOCOL_REF" "derives top-level graph \`status\` from child tasks" "route-workflow graph-status derivation rule"
require_contains "$ROUTING_RULES_REF" "repo override > project-local platform rule > generic platform heuristic > global fallback" "routing precedence rule"
require_contains "$TASK_PROTOCOL_REF" "**Run the repo-contract scan in precedence order.**" "pre-flight repo-contract scan heading"
require_contains "$TASK_PROTOCOL_REF" "AGENTS.md" "pre-flight AGENTS scan"
require_contains "$TASK_PROTOCOL_REF" "platform/runtime config" "pre-flight platform scan"
require_contains "$TASK_PROTOCOL_REF" "### Optional Claude Stop Hook: Completion Guard" "optional stop hook heading"
require_contains "$TASK_PROTOCOL_REF" "Not required for correctness." "optional hook correctness clause"
require_contains "$TASK_PROTOCOL_REF" "Claude Stop hook enforcement is optional acceleration, not a correctness dependency." "level-A optional hook clause"
require_contains "$DECISION_LOG_REF" ".svc/pipeline-decisions.jsonl" "mandatory decision log path"

require_contains "$IMPROVE" "**svc-on-svc routing rules:**" "improve-framework svc-on-svc rules"
require_contains "$IMPROVE" "If the framework behavior is broken or regressed, route to \`diagnose-bug\` first" "improve-framework diagnose-bug rule"
require_contains "$IMPROVE" "If the framework is gaining a new capability, route to \`write-spec\`" "improve-framework write-spec rule"
require_contains "$IMPROVE" "After \`design-tech\`, run \`explore-solutions\` whenever the framework change introduces a hard-to-reverse architecture decision" "improve-framework explore-solutions rule"

require_contains "$ONBOARD" "docs/specs/router-context.md" "onboard-repo router-context output"
require_contains "$ONBOARD" "docs/specs/agent-topology.md" "onboard-repo agent-topology output"
require_contains "$AUDIT_COVERAGE" "| 17 | Router context | \`docs/specs/router-context.md\` |" "audit-coverage router-context catalog row"
require_contains "$AUDIT_COVERAGE" "| 18 | Agent topology | \`docs/specs/agent-topology.md\` |" "audit-coverage agent-topology catalog row"
require_contains "$EXECUTE" "### Step 0c: Delegation Contract Check" "execute-changeset delegation contract step"
require_contains "$EXECUTE" "Default to single-agent unless the manifest's task structure makes the split obviously safe and cheap." "execute-changeset conservative default"
require_contains "$AUDIT_SESSION" "### 4.5 Resolve host-side trace evidence before calling it unavailable" "audit-session host-trace section"
require_contains "$AUDIT_SESSION" "~/.codex/history.jsonl" "audit-session codex history search"
require_contains "$AUDIT_SESSION" "~/.claude/sessions/*.json" "audit-session claude session search"
require_contains "$AUDIT_SESSION" "Transcript status: auto-discovered" "audit-session transcript status contract"
require_contains "$AUDIT_SESSION" "Final narrative is anchored to the latest artifact" "audit-session latest-artifact self-verify"
require_contains "$TASK_PROTOCOL_REF" "If the graph has **no actionable tasks** (\`pending\` or \`in_progress\`) and the WI file is already \`VERIFIED\`, return a closed-state summary and stop." "task-graph closed-state hard return"
require_contains "$REPO_ROOT/skills/validate-feature/SKILL.md" "node scripts/task-graph.mjs init .svc/lane-tasks-<WI>.json --wi <WI-###> --lane feature" "validate-feature task-graph init rule"
require_contains "$REPO_ROOT/skills/validate-feature/SKILL.md" "node scripts/task-graph.mjs set-status .svc/lane-tasks-<WI>.json {T} completed" "validate-feature task-graph set-status rule"
require_contains "$REPO_ROOT/skills/diagnose-bug/SKILL.md" "node scripts/task-graph.mjs init .svc/lane-tasks-<WI>.json --wi <WI-###> --lane bugfix" "diagnose-bug task-graph init rule"
require_contains "$REPO_ROOT/skills/diagnose-bug/SKILL.md" "Close-out uses the latest evidence" "diagnose-bug latest-artifact self-verify"
require_contains "$REPO_ROOT/skills/test-journeys/SKILL.md" "Close-out uses the latest runtime artifact" "test-journeys latest-artifact self-verify"
require_contains "$REPO_ROOT/skills/write-e2e/SKILL.md" "Close-out summary matches the latest artifact" "write-e2e latest-artifact self-verify"
require_contains "$REPO_ROOT/skills/track-visuals/SKILL.md" "Declared track-visuals artifact family emitted" "track-visuals artifact-family self-verify"
require_contains "$REPO_ROOT/skills/track-visuals/SKILL.md" "visual-review-closeout" "track-visuals review close-out validator"
require_contains "$REPO_ROOT/skills/test-journeys/SKILL.md" "allowed next skills derived from the routing table" "test-journeys allowed-next summary rule"
require_contains "$REPO_ROOT/skills/test-journeys/SKILL.md" "review-gate is not an allowed" "test-journeys disallow review-gate direct next"
require_contains "$REPO_ROOT/references/anti-patterns.md" "Stronger evidence of AP-26" "AP-26 output-family evidence rule"
require_contains "$TASK_CHAINING_REF" "Kimi" "task-graph chaining Kimi host note"

if grep -Fq 'skill: "loop"' "$ROUTER"; then
  ERRORS+="  FAIL: route-workflow still references nonexistent loop skill invocation\n"
  FAIL=$((FAIL + 1))
else
  PASS=$((PASS + 1))
fi

if [[ -f "$HOOK" ]]; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: optional Claude completion hook script missing: hooks/svc-task-completion-guard.sh\n"
  FAIL=$((FAIL + 1))
fi

require_contains "$HOOK" "Actionable means tasks in \`pending\` or \`in_progress\`" "completion guard actionable-task rule"
require_contains "$HOOK" "Blocked but not stop-blocking" "completion guard blocked-task allowance"
require_contains "$HOOK" "AUDIT TRAIL IS MANDATORY. You cannot close this WI until the routing decision and reasoning are logged." "completion guard decision enforcement"
require_contains "$HOOKS_JSON" "\"Stop\"" "hooks.json stop hook installation"
require_contains "$HOOKS_JSON" "optional completion guard" "hooks.json optional completion guard wording"
require_contains "$HOOKS_JSON" "Ensure Node.js and Bash are available" "hooks.json Bash prerequisite wording"
require_contains "$HOOKS_JSON" 'bash hooks/svc-task-completion-guard.sh' "hooks.json stdin-preserving stop-hook command"

if grep -Fq 'printf '\''%s'\'' | bash hooks/svc-task-completion-guard.sh' "$HOOKS_JSON"; then
  ERRORS+="  FAIL: hooks.json still discards Stop hook stdin before task completion guard\n"
  FAIL=$((FAIL + 1))
else
  PASS=$((PASS + 1))
fi

if [[ -f "$TASK_GRAPH_HELPER" ]]; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: task graph helper missing: scripts/task-graph.mjs\n"
  FAIL=$((FAIL + 1))
fi

if [[ -f "$PIPELINE_LOG_HELPER" ]]; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: pipeline log helper missing: scripts/pipeline-log.mjs\n"
  FAIL=$((FAIL + 1))
fi

if [[ -f "$VERIFY_CONTRACT" ]]; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: contract validator missing: scripts/verify-skill-contract.mjs\n"
  FAIL=$((FAIL + 1))
fi

require_contains "$CLAUDE_HOST" "\"builder_profile_path\": \"~/.svc/builder-profile.md\"" "claude host builder profile path"
require_contains "$CODEX_HOST" "\"builder_profile_path\": \"~/.svc/builder-profile.md\"" "codex host builder profile path"
require_contains "$CODEX_HOST" "\"plugins\": true" "codex plugins capability"
require_contains "$CODEX_HOST" "\"mcp\": true" "codex mcp capability"
require_contains "$CODEX_HOST" "\"commands\": true" "codex commands capability"
require_contains "$CODEX_HOST" "\"agents\": true" "codex agents capability"
require_contains "$CLAUDE_HOST" "\"task_graph\"" "claude task-graph contract block"
require_contains "$CODEX_HOST" "\"task_graph\"" "codex task-graph contract block"
require_contains "$GEMINI_HOST" "\"task_graph\"" "gemini task-graph contract block"
require_contains "$KIMI_HOST" "\"task_graph\"" "kimi task-graph contract block"
require_contains "$KIMI_HOST" "\"TaskList\", \"TaskOutput\"" "kimi native task read tools"
require_contains "$KIMI_HOST" "\"background_tasks\": true" "kimi background task capability"
require_contains "$INFRA_DETAIL" "Nine provisioned hosts supported: claude, kimi, codex, gemini, opencode, mimo-code, antigravity, cursor, and grok." "infrastructure host support detail"

SKILLS=$(node -e "
  const m = require('$MANIFEST');
  m.includedSkills.forEach(s => console.log(s));
")

for skill in $SKILLS; do
  [[ "$skill" == "route-workflow" ]] && continue
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ ! -f "$SKILL_FILE" ]] && continue

  require_contains "$SKILL_FILE" "source of truth: \`.svc/lane-tasks-<WI>.json\`" "$skill task-graph heading"
  require_contains "$SKILL_FILE" "Read and update \`.svc/lane-tasks-<WI>.json\` first; it is the cross-host source of truth for task status, skip reasons, and resume" "$skill lane-tasks source-of-truth line"
  require_contains "$SKILL_FILE" "mirror only the active step in \`update_plan\`" "$skill Codex update_plan mirror line"
done

if grep -rn "Kimi: file-only (no native task API)" "$REPO_ROOT" --include="SKILL.md" >/dev/null 2>&1; then
  ERRORS+="  FAIL: stale Kimi file-only boilerplate still present in skill corpus\n"
  FAIL=$((FAIL + 1))
else
  PASS=$((PASS + 1))
fi

if node "$VERIFY_CONTRACT" artifact-family track-visuals --root "$CONTRACT_FIXTURES/track-visuals" >/dev/null 2>&1; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: contract validator artifact-family replay failed for track-visuals fixture\n"
  FAIL=$((FAIL + 1))
fi

if node "$VERIFY_CONTRACT" visual-review-closeout --report "$CONTRACT_FIXTURES/track-visuals/.svc/visuals/WI-000/review-dark-mode-2026-04-22.md" --screenshots-dir "$CONTRACT_FIXTURES/track-visuals/.svc/visuals/WI-000/current-state" >/dev/null 2>&1; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: contract validator visual-review-closeout replay failed\n"
  FAIL=$((FAIL + 1))
fi

if node "$VERIFY_CONTRACT" test-journeys-closeout --summary "$CONTRACT_FIXTURES/test-journeys/SUMMARY.md" --scenarios "$CONTRACT_FIXTURES/test-journeys/scenarios.json" --next diagnose-bug --next write-e2e >/dev/null 2>&1; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: contract validator test-journeys-closeout replay failed\n"
  FAIL=$((FAIL + 1))
fi

echo "=== Tier 1: Framework Self-Management Validation ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — framework self-management contracts valid"
  exit 0
fi
