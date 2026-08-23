#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

node <<'NODE'
const manifest=require('./skills-manifest.json');
if (!manifest.includedSkills.includes('quick-fix')) throw new Error('compatibility skill disappeared from includedSkills');
if (manifest.corePackForRouting.includes('quick-fix')) throw new Error('quick-fix remains in corePackForRouting');
NODE

for file in README.md KIMI.md GEMINI.md ANTIGRAVITY.md skills/route-workflow/references/routing-rules.md; do
  if grep -Eq 'Fast lane for trivial|Quick trivial fix.*quick-fix|^- `quick-fix`$' "$file"; then
    echo "quick-fix remains a live routing recommendation in $file" >&2
    exit 1
  fi
done

printf '%s  %s\n' \
  0ca265a390b1d088aae4c84a1c5695320b24587cb79be404c01e341921500e0c scripts/quick-fix-eligibility.mjs \
  6d4dc7dafe8752d6569025df1c5457524ae9178b3beb1f3d636ecec208e30143 scripts/classify-change-risk.mjs \
  cf549b9e572acfc21e066c5defc82bb2eb7db14661e6e46a336b32f660f74e32 hooks/git/pre-commit.d/20-quick-fix-eligibility | sha256sum -c -

grep -q '^  DEPRECATED (retired as a lane)' skills/quick-fix/SKILL.md
echo 'PASS: quick-fix is compatibility-only and detector bytes are unchanged'
