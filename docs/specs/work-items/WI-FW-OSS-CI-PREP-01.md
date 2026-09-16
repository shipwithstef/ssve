# WI-FW-OSS-CI-PREP-01: Prepare dormant free GitHub Actions checks for public-repository activation

**Type:** enabler
**Status:** in-progress
**Severity:** high
**Filed:** 2026-09-16
**Source:** owner-authorized parallel Cursor work
**Lane:** framework
**Related:** WI-569, WI-FW-OSS-READINESS-01
**Tech design:** `docs/specs/tech/WI-FW-OSS-CI-PREP-01.md`

## Goal

Prepare dormant free GitHub Actions checks for public-repository activation.
Independent Cursor controller; actual implementation authorized. Hosted
activation and public visibility remain unauthorized.

## Affected Files

- `docs/ci/workflows/ssve-checks.yml`
- `docs/ci/workflows/dependabot.yml`
- `docs/ci/ACTIVATION.md`
- `scripts/ci/run-free-checks.sh`
- `test-framework/tests/oss-ci-workflow.test.mjs`
- `docs/specs/work-items/WI-FW-OSS-CI-PREP-01.md`
- `docs/specs/tech/WI-FW-OSS-CI-PREP-01.md`
- `docs/plans/WI-FW-OSS-CI-PREP-01/historical-coverage.md`
- `docs/plans/WI-FW-OSS-CI-PREP-01/evidence/pin-verification.json`

## Acceptance Criteria

| ID | Condition | Proof |
|---|---|---|
| AC-OSS-CI-01 | Templates live under `docs/ci/workflows/` and are not installed at `.github/workflows` while private. | Contract test + `gh api .../actions/workflows` total_count=0. |
| AC-OSS-CI-02 | Workflow covers `pull_request` and `push` to `main` (forks and docs-only included after activation). No `pull_request_target`. | YAML contract test. |
| AC-OSS-CI-03 | Read-only permissions, checkout `persist-credentials: false`, SHA-pinned actions, no dependency cache. | YAML + pin verification. |
| AC-OSS-CI-04 | Free Tier-1 suite + manifest linter; `EVALS=1` refused; paid tiers not enabled by `EVALS=0`. | Wrapper refuse test + `run-all-evals.sh` gate quote. |
| AC-OSS-CI-05 | One stable required-check name (`SSVE Required`) fails on skipped/cancelled/failed/missing prerequisite results. | Aggregator bash probe in contract test. |
| AC-OSS-CI-06 | Activation checklist records exact post-publication steps and marks hosted proof pending. No unlimited-free guarantee. | `docs/ci/ACTIVATION.md`. |
| AC-OSS-CI-07 | Sibling hook/validator/`FRAMEWORK-STATE` failures are not hidden. | Wrapper runs the real evals script; no `\|\| true`. |

## Constraints

No sibling worktree edits or main checkout mutation. Keep SSVE private and
hosted CI inactive. Root integrates worker results sequentially. Do not edit
INDEX.md, README.md, `.gitignore`, core runtime hooks, the four failing
Tier-1 validators, `fixture-home.sh`, or `scripts/audit-framework-docs.mjs`.
