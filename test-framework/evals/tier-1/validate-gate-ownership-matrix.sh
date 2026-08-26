#!/usr/bin/env bash
# validate-gate-ownership-matrix.sh — E2 reviewGates.enforced_by vs skill self-labels.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0
pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: gate ownership matrix ==="

scan_tree() {
  node --input-type=module - "$1" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'skills-manifest.json'), 'utf8'));
const gates = manifest.reviewGates || {};
const owners = new Map();
for (const [gateId, gate] of Object.entries(gates)) {
  const num = gateId.replace(/^G/, '');
  for (const skill of gate.enforced_by || []) {
    if (!owners.has(num)) owners.set(num, new Set());
    owners.get(num).add(skill);
  }
}
const patterns = [
  { re: /It is the G(\d) gate in the chain/gi, label: 'It is the G<n> gate in the chain' },
  { re: /Mandatory G(\d) gate/gi, label: 'Mandatory G<n> gate' },
  { re: /enforces the G(\d) checkpoint/gi, label: 'enforces the G<n> checkpoint' },
  // Grok exec R6 F-003: narrow parenthetical form `skill` (G<n>) — exact-digit
  // closing paren so "(G5-enforcing gate)" never matches.
  // Sol exec R7 F-001: capture groups are (referencedSkill, gateDigit); the
  // CLAIMANT is the referenced skill (match[1]), validated against the gate's
  // owners — never the enclosing directory name.
  { re: /`(review-exec|review-plan|land-changeset|verify-promotion)` \(G(\d)\)/gi, label: '`skill` (G<n>)', group: 2, claimGroup: 1 },
];
const skillsDir = path.join(root, 'skills');
for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skill = entry.name;
  const skillPath = path.join(skillsDir, skill, 'SKILL.md');
  if (!fs.existsSync(skillPath)) continue;
  const text = fs.readFileSync(skillPath, 'utf8');
  for (const { re, label, group, claimGroup } of patterns) {
    for (const match of text.matchAll(re)) {
      const gateNum = match[group || 1];
      const claimant = claimGroup ? match[claimGroup] : skill;
      const allowed = owners.get(gateNum) || new Set();
      if (!allowed.has(claimant)) {
        console.log(`FAIL\t${skill} claims ${claimant} owns G${gateNum} via ${label} but enforced_by is ${[...allowed].join(',') || 'none'}`);
      }
    }
  }
}
console.log('PASS\tgate ownership matrix scan complete');
NODE
}

gate_checks=$(scan_tree "$ROOT")

while IFS=$'\t' read -r status msg; do
  [ -z "$status" ] && continue
  if [ "$status" = PASS ]; then pass "$msg"; else fail "$msg"; fi
done <<< "$gate_checks"

# Sol exec R7 F-001 fixtures: synthetic tree proves cross-skill-reference
# semantics — an owner's self-reference passes, a foreign skill attributing
# gate ownership to a skill it does not own is rejected.
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT
mkdir -p "$fixture_root/skills/review-exec" "$fixture_root/skills/align-feature"
cat > "$fixture_root/skills-manifest.json" <<'JSON'
{ "reviewGates": { "G5": { "enforced_by": ["review-exec", "audit-implementation"] }, "G6": { "enforced_by": ["land-changeset"] } } }
JSON
printf '# Owner\n\nEnforces the chain via `review-exec` (G5).\n' > "$fixture_root/skills/review-exec/SKILL.md"
printf '# Foreign\n\nWrongly attributes `review-exec` (G6); G6 belongs to land-changeset.\n' > "$fixture_root/skills/align-feature/SKILL.md"
fixture_checks=$(scan_tree "$fixture_root")
fixture_fail_total=$(grep -c '^FAIL' <<<"$fixture_checks" || true)
if [ "$fixture_fail_total" -eq 1 ] \
  && grep -q '^FAIL	align-feature claims review-exec owns G6' <<<"$fixture_checks" \
  && ! grep -q '^FAIL	review-exec' <<<"$fixture_checks"; then
  pass "cross-skill-reference fixtures: owner self-reference accepted, wrong-gate attribution rejected"
else
  fail "cross-skill-reference fixtures did not behave as specified (fails=$fixture_fail_total)"
fi

echo ""
echo "validate-gate-ownership-matrix: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
