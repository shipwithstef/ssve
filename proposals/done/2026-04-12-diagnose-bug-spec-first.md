# Framework Improvement: diagnose-bug spec/journey anchor before code exploration

**Status:** IMPLEMENTED (2026-04-12)

## Evidence

- **Source:** User-reported during WI-034 improve-framework follow-up (Example Marketplace, 2026-04-12)
- **Finding:** `diagnose-bug` spawned an Explore subagent as the first act — before reading the project's journeys, specs, or ACs. The journey/spec is on disk, costs ~2K tokens, and defines the expected behavior from the product perspective. The code exploration that replaced it cost 50K-200K tokens and answered the wrong question ("what does the code do?") instead of the right one ("does the code match what the spec requires?").
- **Severity:** high — systematic. Every diagnose-bug invocation on an onboarded project has this defect. The spec-first principle is the foundation of the svc framework's product-thinking approach. A skill that bypasses it produces code-centric diagnoses instead of product-anchored ones.

## Diagnosis

- **Root cause:** `Inputs` section listed "relevant specs or journeys, **if they exist**" — making spec reading optional. No mandatory step existed between task graph setup and code exploration. Step 2 (Define expected behavior) listed "current shipped behavior before regression" as the primary source and spec/journeys as second, inverted from the product-first principle.
- **Category:** missing capability — the skill lacked a product-context anchor step
- **Already in FRAMEWORK-STATE.md?** No

## Implementation

- **Route:** Direct SKILL.md edit
- **Files changed:** `diagnose-bug/SKILL.md`
  1. **Inputs section** — reordered to explicit numbered sequence: WI file → journeys/ACs → repro evidence → code (last). Removed "if they exist" qualifier.
  2. **NEW Step 0.5** — "Spec/Journey/AC Anchor — MANDATORY BEFORE ANY CODE EXPLORATION" inserted between Step 0 (task graph) and Step 1 (reproduce). Four sub-steps: (1) find/read relevant journey, (2) find/read relevant ACs, (3) answer four product questions (persona, goal, spec says what?, code defect vs spec gap?), (4) classify explicitly. Includes rationale: "~2K tokens vs 50K–200K for unanchored explore."
  3. **Step 2 (Define expected behavior)** — reordered priority: spec/journey first (from Step 0.5), then user-visible contract, then pre-regression behavior, then stakeholder intent. Added "Do not derive expected behavior from the current broken code."

## Replay Verification

- **Replay target:** Manual — next diagnose-bug invocation on an onboarded project with specs
- **Contract:** Agent must read journey/AC before any code file or Explore delegation. Expected behavior in Step 2 must cite a spec/AC verbatim, not derive from code.
- **Result:** MANUAL PENDING

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry
- **Decisions:** "diagnose-bug reads spec/journey/AC before any code exploration — this is a hard ordering gate on onboarded projects, not a suggestion"
- **Capabilities:** No new capabilities; behavioral gate added
