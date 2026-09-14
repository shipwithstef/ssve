# Framework Improvement: test-journeys completeness, WI routing, cohesive storage, viewport staging

**Status:** IMPLEMENTED (2026-04-14)

## Evidence
- **Source:** user-reported failure + evolve-framework proposal `proposals/2026-04-14-test-journeys-completeness-and-wi-routing.md`
- **Finding:** test-journeys allowed efficiency skips (3 J08 scenarios skipped without follow-up), did not create WI files for HIGH findings (F2 live-UI bug had no WI), did not enforce desktop-first viewport staging (mobile deferred silently), and stored evidence at `docs/specs/features/test-evidence/` disconnected from track-visuals' `.svc/visuals/<WI>/` canonical path
- **Severity:** P0 (F-01 + F-02), P1 (F-03 + F-04)

## Diagnosis
- **Root cause:** test-journeys/SKILL.md Routing Rules (lines 338-345) only routed to other skills abstractly; Step 3 evidence layout was soft-scoped ("when track-visuals is active"); viewport coverage was single-pass; no scenario inventory gate
- **Category:** drift (storage) + missing capability (WI creation, skip contract, viewport staging)
- **Already in FRAMEWORK-STATE.md?** No. Prior entries covered track-visuals viewport-sequential (2026-04-13) and S0/S1/S2 tier classifier (2026-04-14), but test-journeys did not adopt either contract.

## Implementation
- **Route:** direct SKILL.md edit (isolated skill surgery)
- **Files changed:** `test-journeys/SKILL.md`
- **Changes landed:**
  1. **Step 0.5 Scenario Inventory** — mandatory `scenarios.json` with three-state skip contract (`executed | skipped-infeasible | skipped-user-approved`); efficiency skips forbidden.
  2. **Step 4.5 Open Work Items for Defects** — mandatory WI files for every HIGH/CRITICAL finding, MEDIUM default-create, LOW rolled into `WI-auto-minor-findings`; infeasible scenarios route to `write-e2e` WI.
  3. **Step 3 cohesive storage** — `.svc/visuals/<WI>/<JourneyID>-step<N>-<state>-<viewport>.png` is now the canonical (not opt-in) path; `test-evidence/` holds only SUMMARY + metadata + symlinks; AC ✅ must cite screenshot filepath.
  4. **Viewport staging replaced** — single-pass desktop+mobile became three-stage (Stage 1 desktop mandatory, Stage 2 mobile only after Stage 1 clean, Stage 3 tablet conditional). `viewport_stage` recorded in SUMMARY.md.
  5. **Routing Rules updated** — every routing entry produces a WI, added `diagnose-bug` + `write-e2e-with-provisioning` routes.
  6. **Self-Verify expanded** from 3 to 7 checks (scenario inventory terminal, WI count matches HIGH/CRITICAL, visual-AC screenshot citation, viewport stage recorded).
  7. **Guardrails expanded** with #7 (no efficiency skips) and #8 (no off-path screenshot storage).

## Replay Verification
- **Replay target:** the 2026-04-14 Example Marketplace J04+J08 run would have been blocked at:
  - Step 0.5 (no `scenarios.json` for 3 efficiency-skipped J08 scenarios)
  - Step 4.5 (no WI for F2 HIGH live-UI bug, no WI for F3 spec drift)
  - Viewport stage check (claimed complete with desktop-only)
  - Guardrail #8 (screenshots at `docs/specs/features/test-evidence/` outside canonical path)
- **Result:** PASS (qualitative — the four gates now fail any run matching today's pattern)
- **Evidence:** test-journeys/SKILL.md lines for Step 0.5, Step 4.5, Step 3 storage paragraph, Stage 1/2/3 viewport section, Self-Verify checks 4-7, Guardrails 7-8

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry for 2026-04-14 (this record)
- **Known Gaps:** none to move — these gaps were surfaced in the same session that fixed them
- **Decisions:** lock `.svc/visuals/<WI>/` as the canonical screenshot path for BOTH track-visuals AND test-journeys; lock desktop-first staging for test-journeys (mirrors track-visuals 2026-04-13)
- **Capabilities:** svc/CAPABILITIES.md — test-journeys now has a WI creation capability; the journey QA pipeline now produces first-class work items, closing the gstack parity gap noted in the evolution proposal.
