#!/bin/bash
# Tier-1 validator for WI-306 provider/source/saved-outcome evidence.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

expect_pass() {
  local file="$1"
  local label="$2"
  if node "$REPO_ROOT/scripts/validate-provider-fidelity-evidence.mjs" --evidence "$file" >/dev/null 2>&1; then
    pass "$label"
  else
    node "$REPO_ROOT/scripts/validate-provider-fidelity-evidence.mjs" --evidence "$file" || true
    fail "$label"
  fi
}

expect_fail() {
  local file="$1"
  local label="$2"
  if node "$REPO_ROOT/scripts/validate-provider-fidelity-evidence.mjs" --evidence "$file" >/dev/null 2>&1; then
    fail "$label"
  else
    pass "$label"
  fi
}

echo "=== Tier 1: Provider Fidelity Evidence ==="

node --check "$REPO_ROOT/scripts/validate-provider-fidelity-evidence.mjs" >/dev/null
pass "validator syntax valid"

cat > "$TMP/good-image.md" <<'MD'
# Provider Fidelity Evidence

| Field | Value |
|---|---|
| provider_requested | Base44 main AI integration |
| primary_provider | Base44 main AI integration |
| provider_used | Base44 main AI integration |
| primary_capability | image |
| fallback_policy | forbidden-unless-user-approved |
| source_evidence_required | true |
| image_source | `.svc/provider/WI-233/base44-image-generation.json` |
| fallback_used | false |
| fallback_user_approved | false |
| saved_state_verified | PASS - generated image visible after save and return |
| semantic_relevance_result | PASS - image matches requested campaign subject |
| visual_quality_result | PASS - visual review accepted |
| final | PASS |
MD
expect_pass "$TMP/good-image.md" "primary provider image evidence passes"

cat > "$TMP/groq-legitimate.md" <<'MD'
# Provider Fidelity Evidence

provider_requested: Groq AI
primary_provider: Groq AI
provider_used: Groq AI
primary_capability: image
fallback_policy: forbidden-unless-user-approved
source_evidence_required: true
image_source: groq_svg_uploaded
fallback_used: false
fallback_user_approved: false
saved_state_verified: PASS - generated image visible after save and return
semantic_relevance_result: PASS
visual_quality_result: PASS
final: PASS
MD
expect_pass "$TMP/groq-legitimate.md" "project-specific Groq token is not a framework-global fallback"

cat > "$TMP/fallback-signals.json" <<'JSON'
{
  "fallback_source_patterns": ["\\bgroq_svg_uploaded\\b"]
}
JSON
if node "$REPO_ROOT/scripts/validate-provider-fidelity-evidence.mjs" \
  --evidence "$TMP/groq-legitimate.md" \
  --fallback-signals "$TMP/fallback-signals.json" >/dev/null 2>&1; then
  fail "project-local fallback signal config rejects configured Groq substitute"
else
  pass "project-local fallback signal config rejects configured Groq substitute"
fi

cat > "$TMP/wi233-fallback.md" <<'MD'
# Provider Fidelity Evidence

provider_requested: Base44 main AI integration
primary_provider: Base44 main AI integration
provider_used: groq_svg_uploaded
primary_capability: image
fallback_policy: forbidden-unless-user-approved
source_evidence_required: true
image_source: groq_svg_uploaded
fallback_used: true
fallback_user_approved: false
saved_state_verified: partial
semantic_relevance_result: PASS
visual_quality_result: PASS
final: PASS
MD
expect_fail "$TMP/wi233-fallback.md" "Example Marketplace WI-233 wrong-provider fallback fixture fails"

cat > "$TMP/draft-only.md" <<'MD'
# Provider Fidelity Evidence

provider_requested: OpenAI image generation
primary_provider: OpenAI image generation
provider_used: OpenAI image generation
primary_capability: image
fallback_policy: forbidden-unless-user-approved
source_evidence_required: true
image_source: provider-output-123
fallback_used: false
fallback_user_approved: false
saved_state_verified: partial draft only
semantic_relevance_result: PASS
visual_quality_result: PASS
final: PASS
MD
expect_fail "$TMP/draft-only.md" "draft-only saved outcome fails"

cat > "$TMP/approved-degraded.md" <<'MD'
# Provider Fidelity Evidence

provider_requested: Base44 main AI integration
primary_provider: Base44 main AI integration
provider_used: equivalent fallback provider
primary_capability: image
fallback_policy: allowed-degraded
source_evidence_required: true
image_source: equivalent fallback provider output
fallback_used: true
fallback_user_approved: true
saved_state_verified: PASS - generated image visible after save and return
semantic_relevance_result: PASS
visual_quality_result: PASS
final: PASS
MD
expect_pass "$TMP/approved-degraded.md" "explicitly approved degraded fallback passes"

grep -q "fallback-signals" "$REPO_ROOT/scripts/validate-provider-fidelity-evidence.mjs" && pass "validator accepts project-local fallback signal config" || fail "validator accepts project-local fallback signal config"
grep -q "provider_fidelity" "$REPO_ROOT/scripts/compile-delivery-graph.mjs" && pass "compiler declares provider_fidelity family" || fail "compiler declares provider_fidelity family"
grep -q "provider_fidelity" "$REPO_ROOT/scripts/validate-delivery-graph.mjs" && pass "delivery graph validator checks provider_fidelity family" || fail "delivery graph validator checks provider_fidelity family"
grep -q "PROVIDER_FIDELITY_EVIDENCE" "$REPO_ROOT/skills/review-gate/SKILL.md" && pass "review-gate documents provider fidelity gate" || fail "review-gate documents provider fidelity gate"

echo
echo "provider fidelity evidence: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
