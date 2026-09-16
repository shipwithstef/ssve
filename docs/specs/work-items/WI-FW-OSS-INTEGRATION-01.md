# WI-FW-OSS-INTEGRATION-01: Finish reviewed open-source candidate integration

**Type:** integration
**Status:** in-progress
**Severity:** high
**Filed:** 2026-09-16
**Source:** owner requested another Cursor run to finish remaining work
**Lane:** framework
**Related:** WI-FW-OSS-READINESS-01, WI-FW-TIER1-REPAIR-01, WI-FW-OSS-CI-PREP-01

## Goal

Resolve the remaining timing-sensitive test failure, integrate the privacy/test/CI candidates, complete required independent review and normal merge, and accurately disposition remaining history exposure. Keep the repository private and CI dormant.

## Affected Files

- Source/doc paths in the three frozen candidate manifests under the integration run inputs.json
- `test-framework/tests/two-box-plan.test.mjs`
- `test-framework/evals/tier-1/lib/fixture-home.sh`
- `docs/plans/WI-FW-OSS-INTEGRATION-01/`
- `docs/specs/work-items/INDEX.md`
- `docs/specs/work-items/WI-FW-OSS-INTEGRATION-01.md`

## Affected Specs

- `docs/specs/work-items/WI-FW-OSS-READINESS-01.md`
- `docs/specs/work-items/WI-FW-TIER1-REPAIR-01.md`
- `docs/specs/work-items/WI-FW-OSS-CI-PREP-01.md`

## Acceptance Criteria

- **AC-OSS-INT-1:** Original four repaired checks and a meaningful timing regression pass; one matching full free Tier-1 run is green before release.
- **AC-OSS-INT-2:** Dormant CI and public privacy candidate integrate without losing original provenance, real execution evidence, or unrelated owner changes.
- **AC-OSS-INT-3:** Required independent reviews and exact-SHA receipts are genuine; reviewed candidate is merged via the canonical PR workflow and verified.
- **AC-OSS-INT-4:** CI remains inactive and SSVE remains private. Verified old backups remain private and untouched; remaining historical exposure is explicitly disposed, not silently declared resolved.

## Constraints

Reuse prepared inputs; no repeat of paid Two-Box LIVE experiments or blanket history rewrite. Preserve all source worktrees and owner main edits. Ordinary required review and merge are authorized; public visibility and hosted activation are not. Keep root updated with durable progress and exact blockers.
