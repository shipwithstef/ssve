#!/usr/bin/env bash
# test-framework/evals/tier-1/validate-ingest-report-structure.sh
# Tier-1 validator: ingest-guide report structure validator exists and works.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
VALIDATOR="${REPO_ROOT}/skills/ingest-guide/scripts/validate-ingest-report.mjs"

failures=0

# 1. Validator script exists and is executable-ish (has node shebang or is .mjs)
if [ ! -f "$VALIDATOR" ]; then
  echo "FAIL: validator not found: $VALIDATOR"
  exit 1
fi

# 2. Smoke: missing --report should fail
if node "$VALIDATOR" 2>/dev/null; then
  echo "FAIL: validator should exit 1 when --report is missing"
  failures=$((failures + 1))
else
  echo "PASS: validator exits 1 on missing --report"
fi

# 3. Smoke: non-existent report should fail
if node "$VALIDATOR" --report /nonexistent/report.md 2>/dev/null; then
  echo "FAIL: validator should exit 1 when report does not exist"
  failures=$((failures + 1))
else
  echo "PASS: validator exits 1 on missing report file"
fi

# 4. Smoke: valid minimal report should pass
TMP_REPORT="$(mktemp /tmp/ingest-test-XXXXXX.md)"
trap "rm -f '$TMP_REPORT'" EXIT

cat > "$TMP_REPORT" << 'EOF'
# Ingest Report: test-source

**Date:** 2026-05-05
**Source label:** test-source
**Content length:** 10 lines / ~50 tokens
**Research sub-agent used:** gemini-cli

## Pasted Content (summary)

A test guide about testing.

## Upstream Fetch

- **Upstream URL:** https://example.com
- **Fetch status:** ok
- **Excerpt or failure reason:** Found test content.

## Extracted Claims

1. Claim one about testing.
2. Claim two about validation.

## Catalog Cross-Check

| # | Claim | Tag | Matched skill(s) | Delta worth borrowing |
|---|-------|-----|------------------|------------------------|
| 1 | Claim one | catalog-novel | — | — |
| 2 | Claim two | catalog-novel | — | — |

## Addon Dedup Check

- **Source signature:** example.com
- **EXTERNAL_ADDONS.md hit:** no
- **blend-registry.json hit:** no
- **Addon tag:** n/a

## Claim Classification

| # | Claim | Class | Evidence / Reference |
|---|-------|-------|---------------------|
| 1 | Claim one | new | No prior reference |
| 2 | Claim two | new | No prior reference |

## Benefit Framing

### Product project benefit
- Claim one: could help with testing.

### svc framework benefit
- Claim one: could improve validators.

## Project Fit

| # | Claim | applicable_projects | project_fit_strength | Rationale |
|---|-------|---------------------|----------------------|-----------|
| 1 | Claim one | ["testproj"] | strong | Direct fit |
| 2 | Claim two | [] | none | No current project |

## Decision Matrix

| # | Catalog | Knowledge | Project-fit | Default routing | Override (and why) |
|---|---------|-----------|-------------|-----------------|--------------------|
| 1 | catalog-novel | new | strong | promote | — |
| 2 | catalog-novel | new | none | store | — |

## Validation Rubric

| # | Claim | Signal (1-5) | Novelty (1-5) | Actionability (1-5) | Source credibility (1-5) | Aggregate |
|---|-------|--------------|---------------|---------------------|--------------------------|-----------|
| 1 | Claim one | 4 | 5 | 4 | 3 | 16 |
| 2 | Claim two | 3 | 4 | 3 | 3 | 13 |

## Routing Decisions

| # | Claim | Decision | Destination / Next Step |
|---|-------|----------|-------------------------|
| 1 | Claim one | promote | create-skill brief |
| 2 | Claim two | store | references/knowledge/test/ |

## Summary

- Claims extracted: 2
- already-known: 0, new: 2, contradicts-known: 0
- catalog: strong 0, partial 0, novel 2
- addon: n/a
- project-fit: strong 1, weak 0, none 1
- upstream-fetch: ok
- discard: 0, store: 1, blend-or-link: 0, promote: 1
- experiments pending: 2
EOF

if node "$VALIDATOR" --report "$TMP_REPORT" >/dev/null 2>&1; then
  echo "PASS: validator exits 0 on well-formed report"
else
  echo "FAIL: validator should exit 0 on well-formed report"
  node "$VALIDATOR" --report "$TMP_REPORT" || true
  failures=$((failures + 1))
fi

# 5. Smoke: report missing a required section should fail
TMP_BAD="$(mktemp /tmp/ingest-bad-XXXXXX.md)"
trap "rm -f '$TMP_BAD' '$TMP_REPORT'" EXIT

cat > "$TMP_BAD" << 'EOF'
# Ingest Report: bad-source

## Extracted Claims

1. Only claim.

## Catalog Cross-Check

| # | Claim | Tag | Matched skill(s) | Delta worth borrowing |
|---|-------|-----|------------------|------------------------|
| 1 | Only claim | catalog-novel | — | — |

## Claim Classification

| # | Claim | Class | Evidence / Reference |
|---|-------|-------|---------------------|
| 1 | Only claim | new | — |

## Benefit Framing

### Product project benefit
- Only claim: test.

### svc framework benefit
- Only claim: test.

## Project Fit

| # | Claim | applicable_projects | project_fit_strength | Rationale |
|---|-------|---------------------|----------------------|-----------|
| 1 | Only claim | [] | none | — |

## Decision Matrix

| # | Catalog | Knowledge | Project-fit | Default routing | Override (and why) |
|---|---------|-----------|-------------|-----------------|--------------------|
| 1 | catalog-novel | new | none | store | — |

## Validation Rubric

| # | Claim | Signal (1-5) | Novelty (1-5) | Actionability (1-5) | Source credibility (1-5) | Aggregate |
|---|-------|--------------|---------------|---------------------|--------------------------|-----------|
| 1 | Only claim | 3 | 3 | 3 | 3 | 12 |

## Routing Decisions

| # | Claim | Decision | Destination / Next Step |
|---|-------|----------|-------------------------|
| 1 | Only claim | store | references/knowledge/test/ |

## Summary

- Claims extracted: 1
EOF

if node "$VALIDATOR" --report "$TMP_BAD" >/dev/null 2>&1; then
  echo "FAIL: validator should exit 1 on report missing required sections (Upstream Fetch, Addon Dedup)"
  failures=$((failures + 1))
else
  echo "PASS: validator exits 1 on incomplete report"
fi

if [ "$failures" -eq 0 ]; then
  echo "All ingest-report-structure checks passed."
  exit 0
else
  echo "FAILURES: $failures"
  exit 1
fi
