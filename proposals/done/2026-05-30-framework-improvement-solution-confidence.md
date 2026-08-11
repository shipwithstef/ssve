# Framework Improvement — 2026-05-30 — Solution Confidence Protocol

**Status:** IMPLEMENTED

## Evidence

- **Source:** Example Marketplace WI-326 interaction.
- **Finding:** The framework had pieces of the right behavior (`design-tech`,
  `explore-solutions`, `research`, `manage-finops`, `strategic-decision`) but no
  explicit trigger that says: "before plan, automatically build a
  confidence-grade picture of current state, world standard, cost/cache
  constraints, UX, alternatives, suggestion triage, and the selected solution."
- **Severity:** HIGH for planning quality. Without this protocol, a vague user ask
  can jump to a plausible implementation path without proving the current design
  is actually wrong, what was deliberate, or which alternative is best.

## Diagnosis

- **Root cause:** Route-workflow treated "best solution / be sure / all cards on
  the table" as generic design or strategic-decision language, not an automatic
  confidence mode with mandatory evidence shape.
- **Category:** framework capability / routing and design-contract gap.
- **Already in FRAMEWORK-STATE.md?** Partially. The framework had search-before-
  building, design alternatives, solution exploration, and cost gates, but no
  unified confidence protocol that composes them before `plan-changeset`.

## Implementation

- **Route:** quick framework contract patch.
- **Files changed:**
  - `references/solution-confidence-protocol.md`
  - `route-workflow/SKILL.md`
  - `route-workflow/references/intent-routing.md`
  - `route-workflow/references/lane-model.md`
  - `design-tech/SKILL.md`
  - `explore-solutions/SKILL.md`
  - `test-framework/evals/tier-1/validate-solution-confidence-protocol.sh`
  - `FRAMEWORK-STATE.md`
  - `references/knowledge/svc/CAPABILITIES.md`
  - `scripts/compile-delivery-graph.mjs`
  - `scripts/validate-delivery-graph.mjs`
- **Behavior added:** confidence phrases now trigger
  `solution_confidence_required: true` plus a mode. The default is
  `design_auto`: design/evaluation/planning/implementation proceed
  automatically through the normal lane once `SOLUTION-CONFIDENCE.md` selects a
  direction. `post_design_human_gate` is used only when the user explicitly asks
  to review/approve after design; the compiler now marks `plan-changeset`
  blocked until approval in that mode and the validator rejects graphs that fail
  to block planning. `intake_only` remains available when the user explicitly
  says no design/decision yet.

## Replay Verification

- **Replay target:** `bash test-framework/evals/tier-1/validate-solution-confidence-protocol.sh`
- **Result:** PASS.
- **Evidence:** `solution confidence protocol validation: PASS`, including a
  delivery-graph compiler/validator replay that proves `post_design_human_gate`
  blocks `plan-changeset` and rejects an unblocked planning graph.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** add 2026-05-30 solution confidence protocol entry.
- **Known Gaps:** no open gap remains for this specific trigger.
- **Decisions:** confidence mode is an automatic protocol, not a new lane.
- **Capabilities:** yes, add solution confidence protocol to capability list.

## Corrective Follow-Up 2026-05-30

- **Source:** Example Marketplace WI-326 approval-gate correction.
- **Finding:** The first protocol implementation required grounding, options,
  tradeoffs, cost/cache, and a compact checkpoint, but did not force the exact
  approval-ready structure the user expects by default.
- **Patch:** `SOLUTION-CONFIDENCE.md` now requires an action-by-action approval
  packet before `plan-changeset`, implementation, or user approval requests.
  Each action must include what changes, why it exists, how it would be
  achieved, positive outcome, negative/risk outcome, impact if skipped, and
  proof required before closeout. Outcome coverage is also mandatory.
- **Verification:** `test-framework/evals/tier-1/validate-solution-confidence-protocol.sh`
  now checks the approval-packet contract.
