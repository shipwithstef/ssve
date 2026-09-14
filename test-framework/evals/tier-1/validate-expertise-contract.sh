#!/usr/bin/env bash
# Tier-1: the SME-agent EXPERTISE CONTRACT (WI-430). Proves an agent composes all four expertise layers at
# run-start (training + current-knowledge[staleness-checked] + experience + heuristics) via expertise.mjs preload.
# Static, no LLM, <5s. Reference agent: financial-analyst.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1
EX="scripts/expertise.mjs"; AG="financial-analyst"; DOM="references/knowledge/domains/startup-saas-finance"
pass=0; fail=0
ok(){ pass=$((pass+1)); echo "  ✓ $1"; }
no(){ fail=$((fail+1)); echo "  ✗ $1"; }

# 1. the domain knowledge bank exists (L2 source) with a .version (currency anchor)
[ -f "$DOM/CAPABILITIES.md" ] && ok "domain bank CAPABILITIES.md exists (L2)" || no "no CAPABILITIES.md"
[ -f "$DOM/.version" ] && ok "domain bank .version exists (currency anchor)" || no "no .version"

# 2. the agent DECLARES the contract (domain + expertise block + Step-0 preload line)
grep -q "^domain: startup-saas-finance" "agents/$AG.md" && ok "agent declares domain:" || no "no domain: declaration"
grep -q "memory_role: financial-analyst" "agents/$AG.md" && ok "agent declares expertise.memory_role" || no "no expertise block"
grep -q "expertise.mjs preload" "agents/$AG.md" && ok "agent has the Step-0 expertise-preload instruction" || no "no preload step in prompt"

# 3. preload composes ALL FOUR layers (headers present in one run)
OUT="$(node "$EX" preload --agent "$AG" 2>&1)"
echo "$OUT" | grep -q "L1 TRAINING"            && ok "preload prints L1 (training)"           || no "missing L1"
echo "$OUT" | grep -q "L2 CURRENT KNOWLEDGE"   && ok "preload prints L2 (current knowledge)"  || no "missing L2"
echo "$OUT" | grep -q "L3/L4 EXPERIENCE"        && ok "preload prints L3/L4 (experience+heuristics)" || no "missing L3/L4"
echo "$OUT" | grep -q "Survival core"           && ok "preload loads the actual CAPABILITIES.md body" || no "L2 body not loaded"

# 4. staleness verdict — back-dated .version → STALE; today-dated → FRESH (negative control)
echo "$OUT" | grep -q "\[STALE\]" && ok "back-dated .version yields [STALE] + refresh directive" || no "STALE verdict did not fire"
TMP="$(mktemp)"; cp "$DOM/.version" "$TMP"
printf '%s (test)\n' "$(date -u +%Y-%m-%d)" > "$DOM/.version"
node "$EX" preload --agent "$AG" 2>&1 | grep -q "\[FRESH\]" && ok "today-dated .version yields [FRESH] (negative control)" || no "FRESH negative control failed"
cp "$TMP" "$DOM/.version"   # restore the intentionally-stale version

# 5. an agent WITHOUT a domain: declaration is refused (the contract is opt-in + explicit)
node "$EX" preload --agent plan-reviewer 2>/dev/null && no "preload accepted a non-SME agent" || ok "preload refuses an agent with no domain: declaration"

# 6. REAL L3/L4 composition (Codex HIGH-1): a recorded outcome actually appears, not just the header
T6="$(mktemp -d)/co"; node scripts/company-state.mjs scaffold --state-dir "$T6" --name t >/dev/null 2>&1
node scripts/company-state.mjs append-decision --state-dir "$T6" --card '{"proposed_by":"financial-analyst","title":"cut burn","door":"two-way","recommendation":"trim spend","cost_of_delay":"high","ask":"approve","evidence":["state.md"]}' >/dev/null 2>&1
FID="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('$T6/decisions-pending.jsonl','utf8').trim().split('\n')[0]).id)")"
node scripts/company-state.mjs resolve --state-dir "$T6" --id "$FID" --verdict approved >/dev/null 2>&1
node scripts/company-state.mjs record-outcome --state-dir "$T6" --id "$FID" --result "burn cut 20pct runway plus3mo" --worked true >/dev/null 2>&1
node "$EX" preload --agent "$AG" --state-dir "$T6" 2>&1 | grep -q "burn cut 20pct" && ok "preload composes REAL L3/L4 (recorded outcome appears, not just a header)" || no "L3/L4 did not load the real outcome"

# 7. honest reporting (Codex HIGH-1): PARTIAL exit(3) when --state-dir is given but the role ledger dir is absent
node "$EX" preload --agent "$AG" --state-dir "$(mktemp -d)" >/dev/null 2>&1; [ "$?" = "3" ] && ok "unavailable L3/L4 reports PARTIAL (exit 3 — no overclaim of full composition)" || no "did not report PARTIAL on unavailable L3/L4"

# 8. fail-CLOSED on an incomplete contract (Codex MED-2, the fanout trap): domain: declared but no expertise block
TR="$(mktemp -d)"; mkdir -p "$TR/agents"; printf -- '---\nname: broken\ndomain: nowhere\n---\nbody\n' > "$TR/agents/broken.md"
node "$EX" preload --agent broken --repo "$TR" >/dev/null 2>&1 && no "incomplete SME contract passed (fail-OPEN)" || ok "incomplete SME contract is refused (fail-CLOSED)"

# 8b. enum-validation (Codex r2): a typo'd memory_kind / currency is refused, not silently fallen-through
TR2="$(mktemp -d)"; mkdir -p "$TR2/agents/k/d"; printf 'x\n' > "$TR2/agents/k/d/CAPABILITIES.md"
printf -- '---\nname: typo\ndomain: d\nexpertise:\n  knowledge: agents/k/d/\n  currency: domain\n  memory_kind: ledgr\n  memory_role: typo\n---\nb\n' > "$TR2/agents/typo.md"
node "$EX" preload --agent typo --repo "$TR2" >/dev/null 2>&1 && no "typo'd memory_kind accepted (fall-through trap)" || ok "typo'd memory_kind is refused (enum-validated, fail-closed)"

# 9. future-dated .version → STALE (Codex MED-3): a bad/clock-skewed stamp must NOT read FRESH
B9="$(mktemp)"; cp "$DOM/.version" "$B9"; printf '2099-01-01 (test)\n' > "$DOM/.version"
node "$EX" preload --agent "$AG" 2>&1 | grep -q "FUTURE-dated" && ok "future-dated .version → [STALE] (not FRESH)" || no "future date read as fresh"
cp "$B9" "$DOM/.version"

# 17. the contract spans BOTH memory kinds (WI-433): the researcher uses memory_kind:source-heuristics
RO="$(node "$EX" preload --agent researcher 2>&1)"
echo "$RO" | grep -q "memory_kind=source-heuristics" && echo "$RO" | grep -qE "trusted source-heuristics \\(confidence .7\\): [1-9]" && ok "researcher preload composes REAL source-heuristics (>=1 loaded from the global file; contract spans both kinds)" || no "researcher source-heuristics did not load real heuristics"

echo ""
echo "expertise-contract: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
