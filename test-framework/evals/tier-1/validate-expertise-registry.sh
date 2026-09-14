#!/usr/bin/env bash
# Tier-1: the EXPERTISE REGISTRY spine (WI-431). The single table (skills-manifest.json expertiseRegistry)
# that ties each SME agent -> its domain knowledge bank, currency, memory, and stages. `expertise.mjs check`
# enforces parity with each agent's frontmatter declaration (drift fails, like sync-native --check).
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1
EX="scripts/expertise.mjs"
pass=0; fail=0
ok(){ pass=$((pass+1)); echo "  ✓ $1"; }
no(){ fail=$((fail+1)); echo "  ✗ $1"; }

# 1. the real registry is in parity (every domain: agent has a matching row, every row's bank exists)
node "$EX" check >/dev/null 2>&1 && ok "expertise.mjs check: live registry↔frontmatter parity holds" || no "live parity check FAILED"

# 2. the registry exists in the manifest with at least the reference agent
node -e "const m=require('./skills-manifest.json'); const e=(m.expertiseRegistry&&m.expertiseRegistry.entries)||[]; process.exit(e.some(r=>r.agent==='financial-analyst')?0:1)" && ok "expertiseRegistry registers financial-analyst (the reference SME)" || no "no financial-analyst row"

# 3. NEGATIVE — an agent that declares domain: with NO registry row → check fails (orphan agent)
TR="$(mktemp -d)"; mkdir -p "$TR/agents"
printf -- '---\nname: orphan\ndomain: nowhere\nexpertise:\n  knowledge: k/\n  currency: domain\n  memory_kind: ledger\n  memory_role: orphan\n---\nb\n' > "$TR/agents/orphan.md"
printf '{"expertiseRegistry":{"entries":[]}}\n' > "$TR/skills-manifest.json"
node "$EX" check --repo "$TR" >/dev/null 2>&1 && no "orphan SME agent (no registry row) passed" || ok "orphan SME agent (domain: but no row) → check fails"

# 4. NEGATIVE — a registry row whose knowledge bank has no CAPABILITIES.md → check fails
TR2="$(mktemp -d)"; mkdir -p "$TR2/agents"
printf -- '---\nname: orphan\ndomain: d\nexpertise:\n  knowledge: missing-bank/\n  currency: domain\n  memory_kind: ledger\n  memory_role: orphan\n---\nb\n' > "$TR2/agents/orphan.md"
printf '{"expertiseRegistry":{"entries":[{"agent":"orphan","domain":"d","knowledge":"missing-bank/","currency":"domain","memory_role":"orphan","memory_kind":"ledger","stages":[]}]}}\n' > "$TR2/skills-manifest.json"
node "$EX" check --repo "$TR2" >/dev/null 2>&1 && no "registry row with missing knowledge bank passed" || ok "registry row pointing at a missing knowledge bank → check fails"

# 5. NEGATIVE — a row whose declared domain disagrees with the agent's frontmatter → check fails
TR3="$(mktemp -d)"; mkdir -p "$TR3/agents/k"
printf 'x\n' > "$TR3/agents/k/CAPABILITIES.md"
printf -- '---\nname: orphan\ndomain: REAL\nexpertise:\n  knowledge: agents/k/\n  currency: domain\n  memory_kind: ledger\n  memory_role: orphan\n---\nb\n' > "$TR3/agents/orphan.md"
printf '{"expertiseRegistry":{"entries":[{"agent":"orphan","domain":"WRONG","knowledge":"agents/k/","currency":"domain","memory_role":"orphan","memory_kind":"ledger","stages":[]}]}}\n' > "$TR3/skills-manifest.json"
node "$EX" check --repo "$TR3" >/dev/null 2>&1 && no "domain mismatch passed" || ok "registry↔frontmatter domain mismatch → check fails"

# 6. NEGATIVE (Codex r1) — duplicate registry rows for one agent → check fails (a dup could hide a bad row)
TR4="$(mktemp -d)"; mkdir -p "$TR4/agents/k"; printf 'x\n' > "$TR4/agents/k/CAPABILITIES.md"
printf -- '---\nname: dup\ndomain: d\nexpertise:\n  knowledge: agents/k/\n  currency: domain\n  memory_kind: ledger\n  memory_role: dup\n---\nb\n' > "$TR4/agents/dup.md"
printf '{"expertiseRegistry":{"entries":[{"agent":"dup","domain":"d","knowledge":"agents/k/","currency":"domain","memory_role":"dup","memory_kind":"ledger"},{"agent":"dup","domain":"d","knowledge":"agents/k/","currency":"domain","memory_role":"dup","memory_kind":"ledger"}]}}\n' > "$TR4/skills-manifest.json"
node "$EX" check --repo "$TR4" >/dev/null 2>&1 && no "duplicate registry rows passed" || ok "duplicate registry rows → check fails"

echo ""
echo "expertise-registry: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
