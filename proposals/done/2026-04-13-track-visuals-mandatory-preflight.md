# Framework Improvement: track-visuals mandatory pre-flight step

**Status:** IMPLEMENTED 2026-04-13

## Evidence

- **Source:** Live session failure — Example Marketplace WI-032 dark mode audit
- **Finding:** `track-visuals/SKILL.md:76` — baseline mode opens directly with "Step 1: Build the screen inventory". Source B (journey transition states) is prose inside Step 1. No mandatory numbered step forces reading the WI spec, feature spec, or journeys before building the inventory.
- **Contrast:** `diagnose-bug/SKILL.md:250` — `### 0.5. Spec/Journey/AC Anchor — MANDATORY BEFORE ANY CODE EXPLORATION` with explicit cost note ("costs ~2K tokens; skipping goes straight to code costs 50K–200K").
- **Severity:** High — agents default to Source A (page listing) and never reach Source B. In the live failure, 11 transition states were missed (6 modals, 2 toasts, 2 form states, 1 nav component) because there was no gate before inventory building.

## Diagnosis

- **Root cause:** Source B was added to Step 1 as prose in a prior fix (2026-04-13 visual coverage proposal). But prose inside a step is skippable — agents complete Step 1 by listing pages without reaching the "when journey docs exist, capture both sources" clause.
- **Category:** Fragility — the right information exists but lacks enforcement
- **Already in FRAMEWORK-STATE.md?** No — the prior fix addressed Source B's existence; this addresses its enforceability.

## Implementation

- **Route:** Direct SKILL.md edits (two files)
- **Files changed:**
  1. `track-visuals/SKILL.md` — inserted `**Step 0: WI/Feature Impact Scan — MANDATORY BEFORE BUILDING INVENTORY**` before Step 1 in baseline mode. Step 0 requires: read WI spec → read feature spec → mine journeys → check E2E → map shared components → log pre-flight checklist. Added self-verify check #7.
  2. `route-workflow/SKILL.md` — added WI context anchor requirement to track-visuals task descriptions in mandatory-step validation (step 5). A task without `WI: <WI-ID>` and feature spec path is incomplete.

## Replay Verification

- **Replay target:** When track-visuals is invoked for a WI with a feature spec and journey docs, the agent must produce a pre-flight checklist log BEFORE the first screenshot.
- **Result:** MANUAL — confirmed by structure: Step 0 now appears before Step 1 with MANDATORY header and explicit cost note mirroring diagnose-bug:250.
- **Self-verify check #7** enforces this going forward: "Pre-flight checklist exists in output before first screenshot."

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry for this gap
- **Known Gaps:** No existing entry to move — this was new
- **Capabilities:** No new capability added — existing Source B is now enforced
