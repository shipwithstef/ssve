# Framework Improvement: Journey Tag Promotion at close-WI

**Status:** IMPLEMENTED (2026-04-17)

## Evidence

- **Source:** User-reported + WI-069 post-mortem (Example Marketplace, 2026-04-17)
- **Finding:** 463 `[SPEC]` tags accumulated across 20+ WI closures without ever being promoted to `[LIVE]`. WI-069 required a dedicated 3-task chore to do the promotion retroactively.
- **Severity:** medium — creates trust drift between journey corpus ("nothing confirmed") and E2E corpus ("most journeys pass")
- **Root symptom:** close-WI step in Lane 4 (both forward and retroactive), Lane 5, and Lane 6 had no journey tag promotion obligation. Lanes 5 and 6 didn't even have an explicit close-WI step.

## Diagnosis

- **Root cause:** The close-WI step was written as an admin chore (update INDEX, WI file, project-state, learnings) without coupling it to the evidence already gathered in `write-e2e` / `test-journeys`. Journey files are the "what works today" reference but were never updated as a byproduct of lane completion.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No — new finding from WI-069 session.

## Implementation

- **Route:** Direct SKILL.md edit (`route-workflow/SKILL.md`)
- **Files changed:**
  - `route-workflow/SKILL.md` — 5 targeted edits:
    1. Lane 4 step 8 (forward) — added journey promotion conditional
    2. Lane 4 step 8 (retroactive table) — added journey promotion conditional
    3. Lane 5 — added missing close-WI step (step 6) with journey promotion
    4. Lane 6 — added missing close-WI step (step 11) with journey promotion
    5. Task graph example close-WI description — updated to include journey promotion

**Promotion rule encoded in SKILL.md:**
> If `write-e2e` or `test-journeys` ran in this lane and produced passing evidence for scenarios documented in `docs/specs/journeys/J*.feature.md`, promote verified ACs from `[SPEC]` → `[LIVE]` in those files. Run `node scripts/check-journey-tags.ts` (if it exists) after promotion. Skip if the WI has no journey-level scenario coverage or is doc-only with no runtime verification.

## Replay Verification

- **Replay target:** Qualitative — next WI that runs `write-e2e` and closes via close-WI step should include journey promotion without a separate chore WI.
- **Result:** PASS (design intent clear in SKILL.md; no test-framework replay available for doc-level contracts)
- **Linter:** `scripts/check-journey-tags.ts` added to Example Marketplace as a per-project tool to surface tag counts; referenced in close-WI contract.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry — WI-069 revealed close-WI step missing journey promotion across Lane 4/5/6
- **Known Gaps:** None to move (was new finding)
- **Decisions:** Journey promotion is CONDITIONAL (skip for doc-only WIs with no runtime verification)
- **Capabilities:** No new capability added; existing capability (close-WI) extended
