#!/usr/bin/env bash
# Tier 1: post-deployment validation requests must remain hard evidence constraints.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

require_fixed() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: post-deploy evidence lock ==="

# User-project path: the short entry must carry the live-proof constraint into routing.
ENTRY="$REPO_ROOT/skills/route-workflow/SKILL.md"
require_fixed "$ENTRY" "add the risk flag \`deploy-affecting\`" "entry forwards post-deploy proof to compilation as deploy-affecting"
require_fixed "$ENTRY" "post_deploy_proof" "entry records the requested live proof"
require_fixed "$ENTRY" "only after deployment against the live URL" "entry requires after-deploy proof target"
require_fixed "$ENTRY" "Local or staging evidence is supporting only" "entry marks local evidence supporting only"
require_fixed "$ENTRY" "was not run" "entry requires an honest not-run closeout"

require_fixed "$REPO_ROOT/skills/route-workflow/references/intent-normalization.md" \
  "post dpeloyemnt" \
  "typo normalization preserves post-deployment intent"
require_fixed "$REPO_ROOT/skills/route-workflow/references/intent-normalization.md" \
  "pre-deploy local evidence can only be supporting" \
  "normalization marks local evidence insufficient"
require_fixed "$REPO_ROOT/skills/route-workflow/references/framework-and-host-route.md" \
  "## Post-Deployment Evidence Lock" \
  "route-workflow has post-deployment evidence lock"
require_fixed "$REPO_ROOT/skills/route-workflow/references/framework-and-host-route.md" \
  "Run the named proof after deployment against the deployed production/live URL." \
  "route-workflow requires after-deploy proof target"
require_fixed "$REPO_ROOT/skills/route-workflow/references/framework-and-host-route.md" \
  "local deployment and validation rules override generic assumptions" \
  "route-workflow respects project-local deployment rules"
require_fixed "$REPO_ROOT/skills/route-workflow/references/framework-and-host-route.md" \
  "Post-deployment proof honored" \
  "route-workflow self-verify covers post-deploy proof"
require_fixed "$REPO_ROOT/skills/base44-environment/SKILL.md" \
  "PLAYWRIGHT_BASE_URL=https://example-marketplace.app" \
  "Base44 flow gives production E2E target example"
require_fixed "$REPO_ROOT/skills/base44-environment/SKILL.md" \
  "cannot satisfy a post-deploy validation request." \
  "Base44 flow rejects local substitute evidence"
require_fixed "$REPO_ROOT/skills/onboard-repo/SKILL.md" \
  "This repo is svc-onboarded: respect the local AGENTS.md/CLAUDE.md deployment, test, and route-workflow rules" \
  "onboard-repo injects baseline svc operating contract"
require_fixed "$REPO_ROOT/CLAUDE.md" \
  "Bootstrap rule for onboarded projects" \
  "CLAUDE bootstrap rule present"
require_fixed "$REPO_ROOT/AGENTS.md" \
  "Bootstrap rule for onboarded projects" \
  "AGENTS bootstrap rule present"

echo ""
echo "post-deploy evidence lock: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
