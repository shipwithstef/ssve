# Framework Improvement: diagnose-bug spec-as-navigation-tool + match/drift/gap classification

**Status:** IMPLEMENTED (2026-04-12)

## Evidence

- **Source:** User-reported during improve-framework second iteration on WI-034 gap (Example Marketplace, 2026-04-12)
- **Finding:** Step 0.5 (added in previous improvement) told agents to read the spec for expected behavior but stopped there. It did not tell agents to USE the spec as a navigation tool to derive a targeted file reading list. As a result, agents still delegated to broad Explore subagents after reading the spec — using the spec only for "what should happen" but not for "where to look." The same ~50K-200K token cost remained.
- **Severity:** high — the previous fix was incomplete. The spec-first principle is only half-implemented without the navigation step.

## Diagnosis

- **Root cause:** Step 0.5 ended at "classify: code defect or spec gap?" without any instruction to derive a targeted reading list from the spec. The spec names the feature area, persona flow, and often the specific pages/components — enough to build a 2-4 file reading list without any exploration. This step was missing entirely.
- **Secondary root cause:** No match/drift/gap classification framework existed for what the agent finds when it reads targeted files. Without this vocabulary, agents don't know how to describe what they find or what to do with it.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No

## Implementation

- **Route:** Direct SKILL.md edit
- **Files changed:** `diagnose-bug/SKILL.md`
  1. **Step 0.5 sub-step 4** — now instructs: derive a targeted code reading list from the spec. "From the journey steps, identify which pages/components handle this flow. From the AC, identify which fields/actions/boundaries are asserted. Write a reading list of 2-4 specific files. Do NOT launch a broad Explore subagent."
  2. **Step 0.5 sub-step 5 (NEW)** — match/drift/gap classification table: Match (spec says X, code does X → bug elsewhere), Drift (spec says X, code does Y → root cause candidate), Gap (spec doesn't describe this → spec gap). Includes note on secondary findings during code read → document but don't pivot.
  3. **Step 0.5 sub-step 6** — renamed "Classify" to now cover code defect / spec drift / spec gap (three categories, not two). Spec drift explicitly included.
  4. **"What Not To Do" section** — two new bullets: "Do not launch a broad Explore subagent before reading the spec" and "Do not derive expected behavior from the broken code."

## Replay Verification

- **Replay target:** Manual — next diagnose-bug invocation on an onboarded project
- **Contract:** After reading spec (Step 0.5), agent must write a 2-4 file reading list derived from spec component names. Code reads must be targeted Read/Grep calls, not Explore subagent delegation. Finding must be classified as match/drift/gap.
- **Result:** MANUAL PENDING

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry
- **Decisions:** "The spec is both the expected-behavior source AND the navigation map to targeted code. Explore delegation before spec-derived file list is an anti-pattern. match/drift/gap is the canonical finding vocabulary."
- **Capabilities:** No new capabilities; spec-as-navigation pattern added to diagnose-bug
