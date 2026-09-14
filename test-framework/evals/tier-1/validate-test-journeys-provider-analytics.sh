#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/test-journeys/SKILL.md"

pass=0
fail=0

ok() {
  echo "  PASS - $1"
  pass=$((pass + 1))
}

bad() {
  echo "  FAIL - $1"
  fail=$((fail + 1))
}

contains() {
  local pattern="$1"
  local label="$2"
  if grep -qE "$pattern" "$SKILL"; then
    ok "$label"
  else
    bad "$label"
  fi
}

echo "=== Tier 1: test-journeys provider analytics gate ==="

contains "Provider-Visible Analytics And Replay Gate" "skill has provider analytics/replay section"
contains "HH_E2E_RUN|E2E_POSTHOG_RUN_ID|e2e_run_id" "skill requires unique run marker"
contains "before the app initializes" "skill requires marker/bootstrap before app init"
contains "consent-gated|Analytics consent" "skill handles consent-gated analytics"
contains "Query the provider by exact run marker" "skill requires exact provider lookup"
contains "Do not rely on \"latest event\"" "skill rejects latest-event polling"
contains "prohibited PII" "skill requires prohibited PII checks"
contains "replay/session record" "skill requires replay/session verification when in scope"
contains "traffic_type=e2e" "skill requires identifiable test traffic marker"
contains "PROVIDER_ANALYTICS_EVIDENCE.md" "skill requires durable provider analytics evidence artifact"
contains "provider_visible=true" "summary must declare provider-visible status"
contains "Do NOT claim.*Playwright/browser pass" "skill rejects browser-only provider-visible claims"

echo
echo "test-journeys provider analytics gate: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
