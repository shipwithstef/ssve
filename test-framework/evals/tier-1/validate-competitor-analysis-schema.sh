#!/usr/bin/env bash
# Tier-1: validate competitor-analysis.data.json conforms to schema + reject
# legacy "consolidation only" headers in companion .md (COMP-05, COMP-07).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
source "$REPO_ROOT/test-framework/evals/tier-1/lib/sdkg-validator.sh"

# Always validate the canonical example fixture in svc itself
sdkg_validate competitor-analysis "$REPO_ROOT/references/schemas/competitor-analysis.example.json"

# If a project-level analyze-competitors.md exists in current dir, check both:
# (a) companion .data.json conforms; (b) .md does NOT contain banned legacy patterns
PROJECT_MD="$REPO_ROOT/docs/specs/analyze-competitors.md"
PROJECT_DATA="$REPO_ROOT/docs/specs/analyze-competitors.data.json"
if [ -f "$PROJECT_MD" ]; then
  sdkg_reject_legacy_consolidation "$PROJECT_MD"
  if [ -f "$PROJECT_DATA" ]; then
    sdkg_validate competitor-analysis "$PROJECT_DATA"
  else
    # 30-day grace window per AC COMP-04: existing .md without companion .data.json
    # is WARN, not FAIL. After grace, becomes FAIL.
    echo "WARN: $PROJECT_MD exists without companion analyze-competitors.data.json" >&2
  fi
fi

echo "PASS: validate-competitor-analysis-schema"
