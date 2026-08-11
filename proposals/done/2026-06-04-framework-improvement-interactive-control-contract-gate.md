# Framework Improvement: Interactive Control Contract Gate

**Status:** IMPLEMENTED (2026-06-04)
accepted_wi: WI-332
source_project: `/home/svc-user/app-workspaces/example-marketplace`
source_wi: `docs/specs/work-items/WI-332.md`

## Evidence

- **Source:** Example Marketplace WI-332 implementation audit, user report, and post-implementation corrections on the `/customerpoints` rewards tab surface.
- **Finding:** The /customerpoints rewards controls ("Reward Programs", "Rewards Activity", and "Example Marketplace") looked like tabs, but the implementation initially only changed button styling (adding active/selected classes) while leaving all three surfaces visible/mounted simultaneously. Review (G5), visual proof, and E2E allowed this because they checked for element presence and static screenshots instead of verifying the semantic interaction contract.
- **Severity:** HIGH. Interactive controls can pass visual and structural presence checks while violating the semantic interaction contract, leading to completely broken user experiences in production.

## Diagnosis

- **Root cause:** The framework lacks a dedicated gate/rule requiring interactive controls (e.g., tabs, accordions, dropdowns, filters) to define and verify their semantic interaction contract. E2E and visual checks traditionally focus on *presence* of elements and *static screenshots* rather than asserting *content toggle/visibility behavior* and *accessible state transition lifecycle* (e.g., aria-selected, aria-expanded) across views.
- **Category:** fragility / contract enforcement.
- **Already in FRAMEWORK-STATE.md?** No. G3 has an existing-component mock parity ledger and G5 has visual proof/track-visuals diff checks, but neither enforces interaction contract behavior or mutual exclusion checks for panels.

## Proposed Implementation

- **Route:** Documentation and skill contract additions across the design, review, and verification phases.
- **Files changed:**
  - `write-spec/SKILL.md` (Step 4: Write Acceptance Criteria rules)
  - `design-ux/SKILL.md` (Step 3: State Machines)
  - `design-ui/SKILL.md` (Step 7: Component States)
  - `review-gate/SKILL.md` (G1, G2, G3, G5, and G7 checklists)
  - `FRAMEWORK-STATE.md` (History, Decisions, and Gaps)
- **Commits:** TBD after implementation.

## Required Contract Changes

### 1. Spec/Acceptance Criteria Definition (`write-spec/SKILL.md`)
Every user story/specification introducing or modifying interactive controls (such as tabs, accordions, dropdowns, segmented controls, filters, toggles, steppers, mode buttons) must include an AC specifying the control's interaction contract:
- The control type (e.g., tab, accordion).
- Default active state.
- Semantic trigger and interaction behavior (e.g., clicking, hovering).
- Visibility changes (what content/panel appears, what content/panel disappears/unmounts).
- Accessibility state changes (e.g., `aria-selected`, `aria-expanded`, `aria-hidden`).
- Explicit failure condition: clicking must not only change styling or leave multiple panels visible/mounted at the same time.

### 2. State Transition Specification (`design-ux/SKILL.md`)
UX State Machines must explicitly map interactive control visibility changes. If clicking a control alters which surface is displayed, the state transition table must verify mutual exclusion (e.g., state `TAB_A_ACTIVE` implies Panel A is visible, Panels B & C are hidden).

### 3. Component Specification (`design-ui/SKILL.md`)
Component design must specify design token usage and corresponding accessible HTML state attributes (`aria-selected="true"`, `aria-expanded="false"`, etc.) for every interactive control state.

### 4. Review Gates Hardening (`review-gate/SKILL.md`)
Add checklist items to enforce the gate:
- **G1 (Feature Spec Review):** Verify that any interactive controls have a fully defined interaction contract in the ACs.
- **G2/G3 (UX/UI Design Review):** Verify screen/component states define accessibility properties and visibility transition contracts for controls.
- **G5 (Executed Change Set Review):** Verify that E2E tests or visual/DOM assertions check panel visibility/hidden state (e.g. `toBeHidden()`, `toBeVisible()`) and accessible state transitions rather than only checking class presence or static styling.
- **G7 (Verification Review):** Verify that manual QA or E2E proof runs check the interaction sequence (e.g., A -> B -> C -> A) and verify that exactly one active panel/surface is visible after each transition.

## Replay Verification

- **Replay target:** A validation scenario replaying the Example Marketplace WI-332 rewards tab controls.
- **Verification mechanism:**
  - Spec contains a testable AC showing:
    - Tab 1 click -> Panel 1 visible, Panels 2 & 3 hidden.
    - Tab 2 click -> Panel 2 visible, Panels 1 & 3 hidden.
    - Tab 3 click -> Panel 3 visible, Panels 1 & 2 hidden.
  - Verification succeeds if exactly one panel/surface is active after each click, and accessible attributes (`aria-selected`) update correctly.
  - Falsification case: An implementation that only changes styling classes (active tab style) while keeping Panels 1, 2, and 3 simultaneously visible/mounted fails the gate.

## Acceptance Criteria

- Interactive UI controls are explicitly listed in `write-spec/SKILL.md` rules with the required contract fields.
- UX and UI design skills require explicit accessibility attribute mapping and transition definitions for control states.
- Review Gates (G1, G2, G3, G5, G7) contain checks ensuring interaction contracts are defined, implemented, and E2E-proven.
- All modified framework files pass Tier 1 static validation checks.

## Rollback

Revert the changes to `write-spec/SKILL.md`, `design-ux/SKILL.md`, `design-ui/SKILL.md`, and `review-gate/SKILL.md`.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add a 2026-06-04 entry describing the interactive-control-contract-gate proposal and implementation.
- **Known Gaps:** Add the gap and immediately mark it as fixed once implemented.
- **Decisions:** Add a locked decision enforcing interaction contract verification for UI controls.

## Post-Implementation Review (2026-06-04)

A post-implementation review caught one gap: the G2 checklist was missing an explicit interactive control panel transitions check, even though the proposal section 4 required it and the design-ux skill body at line 431 already mandated it. G2 check #9 has been added to `review-gate/SKILL.md` and design-ui Step 7 was promoted to a named gate-fail rule.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal is scoped to a single gap | PASS |
| 2 | Evidence cites the Example Marketplace WI-332 rewards controls | PASS |
| 3 | Verification target and falsification pattern defined | PASS |
| 4 | Proposed files for modification are identified | PASS |
| 5 | Status is IMPLEMENTED after post-implementation review | PASS |
