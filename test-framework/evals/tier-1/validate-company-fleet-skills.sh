#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

skills=(cos growth-lead fin-analyst product-lead market-intel counsel security-ops customer-cs revops comms tax-auditor privacy-dpo infra-sre procurement growth-eng)
pass=0
fail=0
ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1" >&2; fail=$((fail + 1)); }

for skill in "${skills[@]}"; do
  file="skills/$skill/SKILL.md"
  if [[ -f "$file" ]] && grep -q "^name: $skill$" "$file" && grep -q '^chain:$' "$file" && grep -q '^  terminal: true$' "$file" && grep -q '^  self_verify: true$' "$file" && grep -q '^  human_checkpoint: true$' "$file"; then ok "$skill frontmatter"; else bad "$skill frontmatter"; fi
  if grep -q '^\*\*Announce at start:' "$file" && grep -q '^## Self-Verify$' "$file" && grep -q '^## Pipeline Continuation$' "$file" && grep -q '^Live evidence: not-applicable (no visible artifact).$' "$file"; then ok "$skill operational sections"; else bad "$skill operational sections"; fi
  if grep -Eqi 'never .*(send|pay|publish|deploy|sign|purchase|contact|launch|change|edit|file|transfer|rotate|activate|mutate)' "$file"; then ok "$skill proposer-only boundary"; else bad "$skill proposer-only boundary"; fi
  scenario="test-framework/evals/tier-2/scenarios/$skill-eval.md"
  if [[ -f "$scenario" ]] && grep -q "\`$skill\`" "$scenario" && grep -q 'proposer-only' "$scenario" && grep -q 'Adjacent negative' "$scenario"; then ok "$skill Tier-2 scenario"; else bad "$skill Tier-2 scenario"; fi
done

node --input-type=module - "${skills[@]}" <<'NODE'
import fs from "node:fs";
const skills = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync("skills-manifest.json", "utf8"));
for (const skill of skills) {
  if (!manifest.includedSkills.includes(skill)) throw new Error(`${skill} missing from includedSkills`);
  if (!manifest.corePackForRouting.includes(skill)) throw new Error(`${skill} missing from corePackForRouting`);
}
NODE
ok "all fleet skills registered in included and routing surfaces"

selected="$(SVC_TIER2_VALIDATE_SELECTION_ONLY=1 bash test-framework/evals/tier-2/run-tier2.sh cos-eval growth-lead-eval)"
if [[ "$selected" == $'cos-eval\ngrowth-lead-eval' ]]; then ok "Tier-2 runner preserves exact selection order"; else bad "Tier-2 runner preserves exact selection order"; fi
all_selected="$(SVC_TIER2_VALIDATE_SELECTION_ONLY=1 bash test-framework/evals/tier-2/run-tier2.sh)"
if grep -qx 'cos-eval' <<< "$all_selected" && grep -qx 'write-spec-greenfield' <<< "$all_selected"; then ok "Tier-2 runner preserves legacy no-argument all-scenarios mode"; else bad "Tier-2 runner preserves legacy no-argument all-scenarios mode"; fi
if SVC_TIER2_VALIDATE_SELECTION_ONLY=1 bash test-framework/evals/tier-2/run-tier2.sh unknown-fleet-eval >/dev/null 2>&1; then bad "Tier-2 runner rejects unknown scenarios"; else ok "Tier-2 runner rejects unknown scenarios"; fi
if SVC_TIER2_VALIDATE_SELECTION_ONLY=1 bash test-framework/evals/tier-2/run-tier2.sh cos-eval cos-eval >/dev/null 2>&1; then bad "Tier-2 runner rejects duplicates"; else ok "Tier-2 runner rejects duplicates"; fi

echo "company fleet skills: $pass passed, $fail failed"
test "$fail" -eq 0
