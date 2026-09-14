# Autopilot S1 Analysis: TrendLearner

**Date:** 2026-04-03
**Model:** claude-opus-4-6
**Scenario:** Greenfield AI learning trend app with 3 deployment modes
**Skills executed:** 19/19
**Total tokens:** ~438K
**Total duration:** ~52 minutes

## Executive Summary

All 19 svc skills were executed on a greenfield scenario. The pipeline produced 28 artifacts spanning vision, personas, feature specs, UX design, UI design, technical design, change sets, verification plans, and marketing context. Every skill-to-skill boundary (11/11 glue checks) passed. The cascade discovery mechanism (C6) performed strongly, automatically identifying 5 enablers and 6 integrations from a single Feature spec.

## Skill Coverage: 19/19

| # | Skill | Status | Key Output |
|---|-------|--------|-----------|
| 1 | write-vision | REAL | 12-section canonical vision |
| 2 | build-personas | REAL | 4 personas (P1-P4) + index |
| 3 | route-workflow | REAL | Routing confirmed |
| 4 | validate-feature | REAL | Feature Ship Brief |
| 5 | write-spec | REAL | 2 specs, 36 ACs, 9 stories |
| 6 | audit-ac | REAL | Audit clean, 0 untestable ACs |
| 7 | write-journeys | REAL | J1 journey, 75% AC coverage |
| 8 | design-ux | REAL | 7 screens, 5 flows |
| 9 | design-ui | REAL | Design system + 10 component specs |
| 10 | design-tech | REAL | 21 components, 8 tables, 17 APIs |
| 11 | review-gate | REAL | G4 PASS, 5 findings |
| 12 | plan-changeset | REAL | 41-file manifest + TypeScript types |
| 13 | land-changeset | SIMULATED | Interface tested, no codebase |
| 14 | verify-promotion | SIMULATED | Interface tested |
| 15 | sync-spec-code | SIMULATED | Annotations format verified |
| 16 | test-journeys | SIMULATED | No live server |
| 17 | write-e2e | SIMULATED | 26 test cases outlined |
| 18 | analyze-marketing | REAL | 11 insights, 3 narratives |
| 19 | test-framework | REAL | This analysis |

**13 REAL / 5 SIMULATED / 1 META** -- Simulated skills require a real codebase + server to fully test.

## Glue Boundary Coverage: 11/11

All 11 skill-to-skill handoffs verified. No broken references, no format mismatches, no missing cross-references.

## Doctrine Claim Verification

| Claim | Status | Strength |
|-------|--------|----------|
| C1: Progressive narrowing | SUPPORTED | Qualitative only (single run) |
| C2: Spec-as-index | PARTIALLY SUPPORTED | Greenfield -- no existing code to index |
| C3: Cache optimization | NOT TESTABLE | No API-level cache telemetry |
| C4: Review catches more | SUPPORTED | G4 found non-trivial issues |
| C5: Checkpoints prevent drift | PARTIALLY SUPPORTED | Consistency evidence, no comparative |
| C6: Cascade discovery | STRONGLY SUPPORTED | 5 enablers + 6 integrations discovered |
| C7: Worktree isolation | NOT TESTED | Single feature scenario |

## Gaps Found

### Gap 1: Simulated Skills (13-17)
- **Category:** Skill gap (structural)
- **Impact:** 5 skills cannot be fully tested without a real codebase + running server
- **Root cause:** S1 is greenfield -- no code exists to promote/verify against
- **Fix needed:** An iteration scenario (S3) with existing code, or extend S1 to actually generate and run the code
- **Severity:** Medium -- the INTERFACES work, but the BEHAVIOR is untested

### Gap 2: No variance measurement for C1
- **Category:** Doctrine gap
- **Impact:** The core claim (progressive narrowing reduces variance) has only qualitative support
- **Fix needed:** Run S1 twice more and measure pairwise diff between outputs
- **Severity:** Medium -- claim is plausible but not statistically supported

### Gap 3: C3 (cache optimization) is untestable locally
- **Category:** Doctrine gap (structural)
- **Impact:** Cannot verify cache hit claims without API-level telemetry
- **Fix needed:** Either use API directly with token reporting, or flag claim as theoretical
- **Severity:** Low -- the loading order discipline is sound regardless of cache measurement

### Gap 4: C7 (worktree isolation) untested
- **Category:** Doctrine gap
- **Impact:** Cross-feature contamination claim has no evidence
- **Fix needed:** Run two features in parallel worktrees (S3 or a new scenario)
- **Severity:** Medium -- important claim with no evidence

## Raw Baseline Comparison

| Metric | Raw | Serious Vibe Coding | Ratio |
|--------|-----|-----------|-------|
| Tokens | ~5K | ~438K | 87x |
| ACs | 0 | 36 | inf |
| Stories | 0 | 9 | inf |
| Personas | 0 | 4 | inf |
| Cascade discovery | 0 | 5 enablers | inf |
| Edge cases | ~2 | 24+ | 12x |
| Test plan | 0 | 26 cases | inf |
| Marketing readiness | 0 | 11 insights | inf |

The 87x token overhead produces dramatically more structured, traceable, testable output. Whether the overhead is justified depends on the project's fix-cycle costs.

## Recommendations for Next Scenario

1. **Run S3 (iteration scenario)** -- Add feature to existing todo-api. This exercises:
   - Skills 13-17 for real (actual codebase, actual server)
   - C2 (spec-as-index with existing code)
   - C7 (worktree isolation)
   - Convert mode (not just bootstrap)

2. **Run S1 twice more** -- To get variance data for C1

3. **Run S4 (adversarial)** -- "Make it faster and better" tests whether validate-feature correctly asks clarifying questions instead of proceeding blindly
