#!/usr/bin/env bash
# Tier 1: locked-agent resolution + declaration discipline (WI-399 B1).
#
# Promotion note (rules/tier-1-promotion.md):
#   validator_path: test-framework/evals/tier-1/validate-locked-agents.sh
#   failure_class: improvised-subagent-prompts — the WI-380/382 protocols
#     mandated per-stage subagents and review lenses but no agent definitions
#     existed; every run would improvise the prompts, violating the
#     locked-agent policy (WI-372) and the WI-399 §Subagent design constraints
#     (capability audit flow addendum, 2026-06-10).
#   promotion_signal: #2 (locked-agent policy is an active documented rule) +
#     #3 (protects the chain dispatch protocol — regression silently degrades
#     every stage-isolated/station run to non-deterministic prompts).
#   expected_runtime_budget: <3s (file greps, one node sync --check)
#   why_tier_2_or_targeted_is_insufficient: drift between protocol references
#     and agent files is silent until a dispatch fails mid-chain; must be
#     caught at lint time.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: locked agents (WI-399 B1) ==="

# 1. Every svc-* agent name referenced in the two dispatch protocols resolves
#    to a canonical source AND a synced native file.
REFS="references/stage-context-isolation.md references/parallel-review-station.md"
NAMES=$(grep -ohE '`svc-(stage|lens|journey|state)[a-z-]*`' $REFS | tr -d '\`' | sort -u)
[ -n "$NAMES" ] || { fail "no locked agent names referenced in the dispatch protocols"; exit 1; }
for n in $NAMES; do
  if [ -f "agents/$n.md" ] && [ -f ".claude/agents/$n.md" ]; then
    pass "$n resolves (canonical + synced)"
  else
    fail "$n referenced in protocols but missing agents/$n.md or .claude/agents/$n.md"
  fi
done

# 2. Every canonical svc-* agent declares model + tools + lock_class +
#    cognitive_label explicitly (WI-399 §constraints: inherit forbidden).
#    Company operating fleet (WI-403..408) added — no shared prefix, listed explicitly.
for f in agents/svc-*.md agents/ad-*.md agents/researcher.md \
         agents/chief-of-staff.md agents/financial-analyst.md agents/growth-lead.md \
         agents/market-intel.md agents/product-lead.md agents/counsel.md agents/security-ops.md \
         agents/customer-success.md agents/revops.md agents/comms.md agents/data-collection.md agents/people-ops.md; do  # all fleet role-agents (WI-403..426)
  [ -f "$f" ] || continue
  base=$(basename "$f" .md)
  # scope: only LOCKED (synced) agents — agents/ also hosts non-Claude prompt
  # artifacts (e.g. svc-kimi-executor-prompt) outside the lock discipline
  [ -f ".claude/agents/$base.md" ] || continue
  ok=1
  for key in "model:" "tools:" "lock_class:" "cognitive_label:"; do
    grep -q "^$key" "$f" || { fail "$base missing explicit '$key'"; ok=0; }
  done
  if grep -q "^model:.*inherit" "$f"; then fail "$base uses model:inherit (forbidden)"; ok=0; fi
  [ "$ok" = 1 ] && pass "$base declares model/tools/lock_class/label explicitly"
done

# 3. Class discipline on the SYNCED output — generalized (derive class from lock_class, not a
#    hardcoded lens list, so a NEW reviewer/executor agent is covered automatically; WI-414 review).
#    3a: EVERY locked agent must forbid nested spawns (Task/Agent never grantable — WI-399).
#    3b: reviewer-class agents must carry no mutation tools (Write/Edit/Bash).
for f in agents/*.md; do
  base=$(basename "$f" .md)
  s=".claude/agents/$base.md"
  [ -f "$s" ] || continue                                  # only synced/locked agents
  cls=$(grep -m1 '^lock_class:' "$f" 2>/dev/null | sed 's/^lock_class:[[:space:]]*//' | tr -d '"' || true)
  cls=${cls:-reviewer}                                     # default fail-closed to reviewer (no lock_class → reviewer)
  disline=$(grep -E "^disallowedTools:" "$s" 2>/dev/null || true)
  if echo "$disline" | grep -q "Task" && echo "$disline" | grep -q "Agent"; then :; else
    fail "$base: synced disallowedTools missing Task/Agent (nested-spawn lock)"; continue; fi
  if [ "$cls" = "reviewer" ]; then
    if grep -E "^tools:" "$s" | grep -qE "Write|Edit|Bash"; then
      fail "$base (reviewer class) carries mutation tools in synced output"
    else
      pass "$base reviewer-class: read-only + spawn-locked"
    fi
  else
    pass "$base ($cls): spawn-locked"
  fi
done

# 4. Sync is drift-free (generated files match canonical sources).
if node scripts/sync-native-agents.mjs --check >/dev/null 2>&1; then
  pass "sync-native-agents --check: no drift"
else
  fail "sync drift — run: node scripts/sync-native-agents.mjs"
fi

echo "locked agents: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
