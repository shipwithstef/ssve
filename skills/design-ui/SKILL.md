---
name: design-ui
version: "1.0"
handles_concerns:
  - dark-mode-coverage
  - mobile-responsive
phases:
  - { id: P1-ContextDesignSystemPreflight, required_for_completion: true }
  - { id: P2-VariantExplorationSelection, required_for_completion: true }
  - { id: P3-ComponentTokenSpecification, required_for_completion: true }
  - { id: P4-ResponsiveDarkMotionStates, required_for_completion: true }
  - { id: P5-TraceabilityG3LiveEvidenceGate, required_for_completion: true }
  - { id: P6-SelfVerifyContinuation, required_for_completion: true }
description: >
  Visual design for a UX-reviewed feature spec: component specs, design tokens, responsive
  layout, before tech design. Use for "design the UI", "visual design", "make it look
  good", "component specs".
inputs:
  required:
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
  optional:
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context, note: "Marketing pages only; product UI uses its feature job, UX design and personas" }
    - { path: "references/landing-bank/<sector>/", artifact: reference-sample-bank, note: "Marketing pages only; product UI compares relevant same-job product screens" }
    - { path: "docs/specs/design-system.md", artifact: design-system }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
outputs:
  produces:
    - { path: "docs/specs/ui/<name>.md", artifact: ui-design }
    - { path: "docs/specs/design-system.md", artifact: design-system }
    - { path: "docs/specs/ui/<screen>/in-app-verification/", artifact: live-page-screenshots, note: "For browser-visible UI work, capture the implemented screen in supported themes and viewports; verify its real user journey. Route-workflow resolves this artifact path for its visual-output post-skill hook." }
chain:
  lanes:
    greenfield: { position: 11, prev: design-ux, next: design-logo }
    brownfield-feature: { position: 7, prev: design-ux, next: design-logo }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🎨 Gemini (visual/multimodal reasoning) for UI generation, with Opus 4.8 for strategic framing. Gemini excels at spatial/visual composition; Opus resolves product/UX intent. See `references/model-routing.md`.

# Writing UI Design

**Runtime v2 continuation:** Register UI, design-system and visual-proof outputs with their declared
consumers via `references/skill-runtime-contracts-v2.json`; follow
`references/runtime-continuation-v2.md`. Preserve every visual, responsive and G3 obligation.

## Overview

UI design answers HOW it looks. It takes a UX-REVIEWED feature spec (screen flows, states, information hierarchy) plus the project's design system and produces component specifications, design token usage, visual hierarchy, supported-theme behavior, purposeful motion when useful, and responsive layout specifics.

**Route by surface:** Product/app screens use the named user job, current product UI, and real same-job product screens as comparisons. Marketing context, the landing bank, `landing-page`, and `benchmark-landing` apply only to marketing pages. The lane's static `next: landing-page` is conditional: marketing pages continue to `landing-page`, then applicable `track-visuals` and `design-tech`; product UI skips `landing-page` and continues to applicable `track-visuals` and `design-tech`. A missing marketing bank never blocks an app screen. Compare rendered states and the user's actual journey, not a standalone inspiration frame. Template sections for unsupported themes or unused motion are marked not applicable with a reason; they do not create new product requirements.

This skill transitions a feature spec from UX-REVIEWED to DESIGNED.

```
write-spec              → DRAFT (WHAT: stories, ACs, journeys)
design-ux         → UX-REVIEWED (HOW users experience it: flows, states, interactions)
design-ui         → DESIGNED (HOW it looks: components, visual language, tokens)
design-tech  → BASELINED (HOW to build it: architecture, data model)
```

**Announce at start:** "I'm using the design-ui skill to define the visual design and component specifications."

## Phase Receipt Contract

When a task graph exists, record these receipts before completing the
`design-ui` task:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextDesignSystemPreflight --evidence command_output:.svc/design-ui-context-system.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-VariantExplorationSelection --evidence command_output:.svc/design-ui-variants.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ComponentTokenSpecification --evidence file:docs/specs/ui/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ResponsiveDarkMotionStates --evidence command_output:.svc/design-ui-responsive-dark-motion.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-TraceabilityG3LiveEvidenceGate --evidence command_output:.svc/design-ui-g3-live-evidence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/design-ui-self-verify.log
```

## Design Alternatives

For each key decision in this phase (component strategy, layout system,
responsive approach), follow the Design Alternatives Protocol
(`references/design-alternatives.md`).

## Design Shotgun (variant exploration)

See references/design-shotgun.md for the full "Design Shotgun (variant exploration)" section (moved verbatim).

The mock parity gate below stays inline because later gates assert it:

### Step 1.5: Production-Derived Mock Parity Gate

This gate is mandatory whenever the UI work changes an existing component,
existing screen, shared component, or route already present in the codebase.
Do not generate standalone greenfield mocks until this gate is complete.

Create a **Production-Derived Mock Parity Ledger** in the UI design artifact
(`docs/specs/ui/<feature>.md`) or as
`docs/specs/ui/<feature>-mock-parity-ledger.md` with these fields:

| Field | Required evidence |
|---|---|
| Affected existing component/screen | Exact component/screen name and current role in the product |
| Production source paths | File paths for the component, route, styles, design tokens, and parent containers |
| Current-state evidence | Current screenshot, visual baseline, or code-grounded render description with file:line citations |
| Intended final-state mock/evidence | Final mock or rendered target tied to the same component and state set |
| Affected usages/routes | Every route, parent surface, modal/sheet/toast usage, and responsive context using the component |
| Spec ACs and journeys covered | AC IDs, journey IDs, and state-machine steps that exercise the component |
| Required states and viewports | Loading, empty, error, focused, disabled, overflow, permission, and breakpoint states required by spec/journeys |
| Known exclusions with rationale | Any skipped usage/state/viewport and why it is out of scope |

Parity requirements:
- The existing component must be visibly present in the mock. A mock that
  replaces it with an unrelated layout does not satisfy this gate.
- Show the pre-change current state and intended final state for the same
  component/route/state whenever the change touches existing UI.
- Ground typography, spacing, colors, density, chrome, responsive behavior, and
  component structure in the production source paths and design tokens.
- Account for every spec, journey, state, usage, and viewport before proceeding.
- If current screenshots or baselines are unavailable, run `track-visuals`
  baseline/review first, or record a blocking gap with the exact missing capture.

**Hard fail:** generic "inspired by" mocks, isolated Dribbble-style frames,
or HTML variants that do not include the affected existing component are not

## External Canvas Handoff (OPT-IN escape hatch — NOT the default path)

See references/external-canvas-handoff.md for the full "External Canvas Handoff (OPT-IN escape hatch — NOT the default path)" section (moved verbatim).

## Adversarial Design Review (after UI is drafted)

Score each design dimension 0-10:

| Dimension | What to check |
|-----------|--------------|
| Consistency | Same patterns for same interactions across all screens? |
| Subtraction | Can anything be removed without losing function? |
| Component reuse | Are similar UI patterns using the same component? |
| Design system compliance | Does everything follow DESIGN.md tokens? |
| Dark mode | If applicable — does the palette work in both modes? |
| Trust signals | Loading states, skeleton screens, optimistic UI — all present? |

Fix anything under 7. In auto mode: P0 fixes automatically.

## What UI Design Is (And Is Not)

UI design defines the visual treatment, component structure, and interaction aesthetics of screens that UX design already mapped. It takes the screen inventory, state machines, flows, and information hierarchy from UX design and specifies exactly how each element renders — which components, which tokens, which states, which animations.

**UI design does NOT define:** Which screens exist, how users navigate between them, what information hierarchy to use, or what error recovery flows look like. Those are UX design (Phase 4). If you catch yourself adding new screens or changing flow logic, stop — that is a feedback loop to design-ux.

**The boundary:** UX says "this screen has a primary action, a list of results, and a filter panel." UI says "the primary action is a filled button using `color.primary` at `size.lg`, the list uses `CardList` with `spacing.md` between items, and the filter panel uses `CollapsiblePanel` that becomes a `BottomSheet` below the `breakpoint.md` threshold."

## The Design System

See references/design-system.md for the full "The Design System" section (moved verbatim).

## When To Use

- After design-ux produces a UX-REVIEWED feature spec
- When a feature's screen flows and states are defined but visual design is not
- When the design system needs to be created (bootstrapping)
- Before invoking design-tech (requires DESIGNED spec)

## Prerequisites

| Artifact | Where | Required? | If missing |
|----------|-------|-----------|------------|
| Feature spec (UX-REVIEWED) | `docs/specs/features/<feature>.md` | Yes — must be UX-REVIEWED | Route to `design-ux` |
| UX design | `docs/specs/ux/<feature>.md` | Yes — screen inventory, states, flows | Route to `design-ux` |
| Design system | `docs/specs/design-system.md` | Yes — tokens and patterns | Create it first (see above) |
| Personas | `docs/specs/personas/P*.md` | Recommended | Provides audience context for visual decisions |
| Vision | `docs/specs/vision.md` | Recommended | Provides brand personality for design system |

**Gate:** Do not start UI design without a UX-REVIEWED spec and UX design artifact. If the UX design does not exist, route to `design-ux` first.

## Process

### Step 0a: Ensure DESIGN.md Exists (Brand + Aesthetic Foundation)

See references/process-steps.md for the full "Step 0a: Ensure DESIGN.md Exists (Brand + Aesthetic Foundation)" section (moved verbatim).

### Step 0b: Ensure Design System Exists (Tokens)

```bash
cat docs/specs/design-system.md 2>/dev/null
```

If the file does not exist, create it before proceeding to Step 1. Follow the design system creation process described in "The Design System" section above. The design system implements the direction from DESIGN.md as concrete tokens.

**W3C Design Tokens (Masterclass UI):**
In addition to the Markdown design system, the agent MUST generate a machine-readable `docs/specs/ui/tokens.json` following the **W3C DTCG 1.0** standard. This ensures 1:1 token parity across all hosts (Gemini, Claude, Codex).

**Vibe Contract (Motion Schema):**
Read the Signature Hook disposition from `design-ux`. For `existing-pattern-retained`, carry the existing motion/accessibility tokens and verify the affected states; do not invent new decorative physics or require a new motion schema. For a selected new interaction, generate `docs/specs/ui/vibe-contract.json` with its applicable motion parameters (including easing and interaction behavior), reduced-motion/accessibility behavior and performance checks. Keep the technical contract tied to the approved interaction and current design tokens.

### Step 0c: UX→UI Traceability Table

Before designing components, map every screen and state from the UX design:

| UX Screen | UX States | UI Components (to design) | Coverage |
|-----------|-----------|---------------------------|----------|
| [from UX doc] | [loading, empty, populated, error] | [components to create] | — |

Missing entries = UX screens with no UI plan = design gap. Resolve before proceeding.

### Step 1: Read The UX Design And Spec

Read the UX design artifact and the feature spec. Understand:

- What screens exist (screen inventory)
- What states each screen has (state machines)
- What the information hierarchy is (priority per screen)
- What error and loading states are defined
- What the responsive strategy requires
- What accessibility requirements are specified

```bash
# Read UX design
cat docs/specs/ux/<feature-name>.md

# Read feature spec
cat docs/specs/features/<feature-name>.md

# Read design system
cat docs/specs/design-system.md

# Read personas for visual context
ls docs/specs/personas/P*.md 2>/dev/null
```

### Step 2: Component Specifications

See references/process-steps.md for the full "Step 2: Component Specifications" section (moved verbatim).

### Step 3: Design Token Usage

See references/process-steps.md for the full "Step 3: Design Token Usage" section (moved verbatim).

### Step 4: Visual Hierarchy

See references/process-steps.md for the full "Step 4: Visual Hierarchy" section (moved verbatim).

### Step 5: Supported Themes

See references/process-steps.md for the full "Step 5: Supported Themes" section (moved verbatim).

### Step 6: Animation and Motion

See references/process-steps.md for the full "Step 6: Animation and Motion" section (moved verbatim).

### Step 7: Component States

See references/process-steps.md for the full "Step 7: Component States" section (moved verbatim).

## Purposeful visual choices

See references/purposeful-visual-choices.md for the full "Purposeful visual choices" section (moved verbatim).

### Step 8: Responsive Layout Specifics

See references/process-steps.md for the full "Step 8: Responsive Layout Specifics" section (moved verbatim).

### Step 9: Assemble The UI Design Document

See references/process-steps.md for the full "Step 9: Assemble The UI Design Document" section (moved verbatim).

### Step 10: AC Traceability Check

See references/process-steps.md for the full "Step 10: AC Traceability Check" section (moved verbatim).

### Step 11: Trigger G3 Review

The UI design artifact is ready for Gate G3 review. Invoke the Review Protocol:

**G3 checks:**
- Does the rendered screen make the named user job and primary action clear, with any distinctive choice tied to an observed task outcome and relevant same-job comparison?
- Is the design system referenced consistently (no ad-hoc values)?
- Is every component state specified (hover, active, disabled, error, loading, focus)?
- Does responsive layout preserve all ACs on all viewports?
- Are all supported themes specified and contrast-checked?
- Do actual animations have reduced-motion fallbacks, and are they purposeful?
- Does the implemented visual hierarchy serve the named user job better than the current or compared same-job screen?
- Does component reuse maximize (not duplicating similar components)?
- Is every AC traceable to specific components and states?

**Review Protocol steps:**
1. **Self-review** — review the UI design artifact for consistency and completeness
2. **Self-judgment** — accept or reject each finding with reasoning
3. **Cross-review** — fresh agent reviews artifact plus self-review findings
4. **Convergence check** — only medium/low issues remain? Pass. Critical/high? Fix and re-enter.
5. **Gate decision** — PASS (proceed to technical design) / FAIL (fix findings) / ESCALATE (human reviews)

### Step 12: Update Feature Spec Status

See references/process-steps.md for the full "Step 12: Update Feature Spec Status" section (moved verbatim).

### Step 13: Handoff

Present a summary:

```
UI design saved: docs/specs/ui/<feature-name>.md
Design system: [created / updated / no changes]
Feature spec updated: docs/specs/features/<feature-name>.md
Status: DESIGNED (was UX-REVIEWED)
Components: N components specified across M screens
New design system tokens: K tokens added
Supported themes: [names], with contrast and relevant states specified
Motion: [none / N purposeful transitions], with reduced-motion fallbacks where used
Responsive: all screens have small + large viewport layouts
AC coverage: [all / N of M covered, gaps listed]

Ready for the next lane step. Next step:
  "For a marketing page, run landing-page; otherwise skip it. Then run applicable track-visuals baseline and design-tech against docs/specs/features/<feature-name>.md"
```

**The terminal state is a DESIGNED spec and a surface-specific handoff.** Marketing pages continue to `landing-page`; product UI skips it. Both then continue through applicable `track-visuals` to `design-tech`. This skill does not define architecture, data models, or technology choices.

## Feedback Loops

UI design often reveals problems upstream. Handle them:

| Discovery | Action |
|-----------|--------|
| UX screen flow is missing a screen needed for visual coherence | Route back to `design-ux` to add the screen |
| Information hierarchy doesn't map to a visual hierarchy that works | Route to `design-ux` to re-prioritize |
| Design system lacks patterns needed for this feature | Extend `docs/specs/design-system.md` first, then return |
| Component state from UX state machine has no visual representation | Route to `design-ux` to validate the state machine |
| Responsive strategy from UX doesn't work visually | Route to `design-ux` to adjust responsive strategy |
| AC implies a visual behavior not covered by any screen | Route to `design-ux` or `write-spec` depending on whether it is a flow gap or a spec gap |

**Key principle:** It is cheaper to extend the design system or revise UX now than to discover visual inconsistencies during implementation.

## Chrome Control Testability

For layout, header, sidebar, shell, navigation, and persistent chrome controls,
record a stable testability contract at design time:

- accessible name or `aria-label`
- `data-testid` or equivalent app-controlled stable selector when the visible
  name is absent, duplicated, icon-only, or locale-dependent
- `@chrome-control:<id>` trace when the control should be covered by chrome
  journey discovery

Do not leave important chrome controls as icon-only positional targets. This
keeps `scripts/validate-e2e-selector-discipline.mjs` aligned with design output
before E2E authors are forced into selector exceptions.

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Add new screens or change flows | That is UX design (Phase 4) | Feed back to design-ux if flow changes are needed |
| Use hardcoded values instead of tokens | Breaks design system consistency | Every color, spacing, and typography reference must use a design system token |
| Ignore a supported theme | Users lose contrast or state cues | Specify and verify every theme the product actually supports |
| Skip component states | Hover, disabled, error, loading are not optional | Every interactive component must have all states specified |
| Copy Material/Tailwind wholesale | The design system must reflect the project's brand | Use them as inspiration, adapt to the project |
| Skip reduced motion fallbacks | Accessibility requirement, not optional | Every animation must specify what happens with prefers-reduced-motion |
| Add decorative animation without a user purpose | Distracts from the task and adds maintenance cost | Use immediate state changes or justify purposeful motion with existing tokens |
| Design for one viewport only | Responsive is required, not optional | Every screen must have small and large viewport layouts at minimum |

## Routing

| Situation | Route to |
|-----------|----------|
| UI design complete, G3 passed, marketing page | `landing-page`, then `track-visuals` (baseline) and `design-tech` |
| UI design complete, G3 passed, product/app screen | Skip `landing-page`; `track-visuals` (baseline) then `design-tech` |
| UI design complete, G3 passed, no visual surface | `design-tech` |
| UX flow needs revision for visual coherence | `design-ux` (feedback loop) |
| Design system needs new patterns | Extend `docs/specs/design-system.md` (then return) |
| No UX-REVIEWED spec exists | `design-ux` (prerequisite) |
| Feature has no visual surface | Skip to `design-tech` |
| Design system does not exist | Create it first (see "The Design System" section) |

## Audit Mode

When invoked with `--audit` to review existing UI design:

1. Read `docs/specs/ui/<name>.md`
2. UX→UI traceability: every UX screen has mapped UI components?
3. Design system compliance: components reference tokens from design-system.md, not ad-hoc values?
4. DESIGN.md alignment: visual decisions match brand personality?
5. Component state coverage: hover, active, disabled, error, loading states defined?
6. Report: component-by-component PASS/WARN/FAIL

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | UI design file exists | `test -f docs/specs/ui/<name>.md` | |
| 2 | Design system file exists | `test -f docs/specs/design-system.md` | |
| 3 | Component specs reference design tokens (not ad-hoc values) | grep for hardcoded hex/px values in UI design file; should find only token references | |
| 4 | Skip justified if applicable | If the feature has no visual surface (pure API/backend/background job): skip reason is logged in lane-tasks JSON and `pipeline-decisions.jsonl` with explicit justification referencing the no-visual-surface evidence; otherwise UI design file is substantive | |
| 5 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**If `--progressive` flag is present AND self-verify passed:**
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- If this is a marketing page: invoke `landing-page --progressive --lane <lane>`; that skill continues to applicable `track-visuals` and `design-tech`.
- If this is a product/app screen: skip `landing-page` with a recorded reason, then invoke `track-visuals --mode baseline` and `design-tech --progressive --lane <lane>`.
- If there is no visual surface: skip the visual-only steps with recorded reasons and invoke `design-tech --progressive --lane <lane>`.

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: run `landing-page` for a marketing page; otherwise continue with applicable `track-visuals --mode baseline`, then `design-tech`."

## Phase Z — Live in-app verification (post-execution promotion gate)

After implementation is deployed and before promotion is declared done, capture the affected screen(s) in every supported theme and shipping viewport via Playwright, follow the actual user journey through the changed states, and run the eyeball checklist in `_shared/live-evidence.md`. **No live screenshots, no done.**

Output: `docs/specs/ui/<screen>/in-app-verification/` with labeled captures for the supported theme(s), viewports, and material states.

Hard-fails (raw text leak from JSX swap, broken theme swap, contrast fail, layout overlap, cached old asset) loop back to component re-render. Tier-1 component preview alone is **not sufficient** — the live journey and captures are the truth-teller.

A pre-execution design-ui task records this as a downstream proof obligation; it does not claim a deployed capture before implementation. On first deploy, capture the supported themes, viewports, and affected journey before promotion.

Origin: 2026-04-30 Example Marketplace run shipped a logo-swap that bundle-grep + build all PASSED while the live page rendered raw JSX text in the top-left. The component-preview was correct in isolation; only live capture caught it.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
