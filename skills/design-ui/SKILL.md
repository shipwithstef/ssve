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

> **Cognitive routing:** visual/multimodal reasoning for UI generation, strategic reasoning for product/UX intent. Resolve the harness and model for each through the active profile in `references/model-routing.md`.

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

**Design Shotgun** — Before finalizing component specs, gather context on five dimensions (who, job to be done, what exists, user flow, edge cases); variants built without it solve the wrong problem. When the work changes existing UI, complete the Production-Derived Mock Parity Gate below before any mock. Then read prior approvals (`docs/specs/decisions/approved.json`, `taste-*.md`), propose genuinely different same-job text concepts, and present them to the user BEFORE generating HTML (a gate; in auto mode P0 selects with justification). Generate self-contained HTML/CSS variants with real content, 375px and 1200px, and record the chosen direction in `approved.json`. Details: `references/design-shotgun.md`.

### Step 1.5: Production-Derived Mock Parity Gate

This gate applies whenever the UI work changes an existing component,
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
valid, because they cannot show what the change does to the real product.

## External Canvas Handoff (opt-in escape hatch, not the default path)

**External Canvas Handoff (opt-in only)** — The default is the in-session Design Shotgun; use external handoff only when the user names an external canvas (Claude Design, v0, Lovable), the task graph names `design-ui-external-handoff`, or the WI sets `design_route: external-canvas`. Do not route here because quality "might be higher" or the codebase is large. When triggered: a Gemini subagent builds `docs/specs/ui/constraint-matrix.md` (the orchestrator does not re-read the codebase, to keep its context free for integration), compose the Vibe Contract prompt (Claude Design uses `/design-sync`, falling back to Design Shotgun if unavailable), then a second zero-history Gemini subagent audits the returned code against the matrix (strict PASS/FAIL) before integration. Code stays the source of truth. Details: `references/external-canvas-handoff.md`.

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

**UI design does not define:** Which screens exist, how users navigate between them, what information hierarchy to use, or what error recovery flows look like. Those are UX design (Phase 4). If you catch yourself adding new screens or changing flow logic, stop — that is a feedback loop to design-ux.

**The boundary:** UX says "this screen has a primary action, a list of results, and a filter panel." UI says "the primary action is a filled button using `color.primary` at `size.lg`, the list uses `CardList` with `spacing.md` between items, and the filter panel uses `CollapsiblePanel` that becomes a `BottomSheet` below the `breakpoint.md` threshold."

## The Design System

**The Design System** — `docs/specs/design-system.md` is a foundational artifact; if it is missing, create it before designing any feature UI, from the vision, personas and existing codebase UI patterns (adapted to this brand, not a copy of Material or Tailwind). If it exists, read it: every UI decision must reference its tokens, and a missing pattern means extend the design system first, then use the new tokens. Details: `references/design-system.md`.

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

**Step 0a: Ensure DESIGN.md exists** — Check `DESIGN.md` (or `docs/specs/DESIGN.md`); if absent, create it at project root through the Design Consultation process: gather product context (README, manifest, components, vision, personas, `domain-profile.md`, `analyze-competitors.md`), inspect real same-job product screens (not marketing pages), propose one package marked SAFE or RISK per dimension, preview fonts and colors in HTML, then write DESIGN.md. If it exists, make every UI decision align with it. Details: `references/process-steps.md`.

### Step 0b: Ensure Design System Exists (Tokens)

If `docs/specs/design-system.md` does not exist, create it before proceeding to Step 1. Follow the design system creation process described in "The Design System" section above. The design system implements the direction from DESIGN.md as concrete tokens.

**W3C Design Tokens (Masterclass UI):**
In addition to the Markdown design system, generate a machine-readable `docs/specs/ui/tokens.json` following the **W3C DTCG 1.0** standard. This ensures 1:1 token parity across all hosts (Gemini, Claude, Codex).

**Vibe Contract (Motion Schema):**
Read the Signature Hook disposition from `design-ux`. For `existing-pattern-retained`, carry the existing motion/accessibility tokens and verify the affected states; do not invent new decorative physics or require a new motion schema. For a selected new interaction, generate `docs/specs/ui/vibe-contract.json` with its applicable motion parameters (including easing and interaction behavior), reduced-motion/accessibility behavior and performance checks. Keep the technical contract tied to the approved interaction and current design tokens.

### Step 0c: UX→UI Traceability Table

Before designing components, map every screen and state from the UX design:

| UX Screen | UX States | UI Components (to design) | Coverage |
|-----------|-----------|---------------------------|----------|
| [from UX doc] | [loading, empty, populated, error] | [components to create] | — |

Missing entries = UX screens with no UI plan = design gap. Resolve before proceeding.

### Step 1: Read The UX Design And Spec

Read the UX design (`docs/specs/ux/<feature-name>.md`), the feature spec, the design system and the relevant personas. Extract the screen inventory, per-screen state machines, information hierarchy, error and loading states, responsive strategy and accessibility requirements; the UI spec has to cover each of them.

### Step 2: Component Specifications

**Step 2: Component Specifications** — For each screen in the UX screen inventory, specify the components that render it, turning each information-hierarchy element into a component with concrete design tokens, layout and content. Details: `references/process-steps.md`.

### Step 3: Design Token Usage

**Step 3: Design Token Usage** — Map exactly which design-system tokens each screen uses and list any new tokens required, so the design system is proven sufficient and the feature stays consistent. Details: `references/process-steps.md`.

### Step 4: Visual Hierarchy

**Step 4: Visual Hierarchy** — For each screen, map the UX information hierarchy to visual weight: Priority 1 elements must be visually dominant and lower priorities visually subordinate. Details: `references/process-steps.md`.

### Step 5: Supported Themes

**Step 5: Supported Themes** — Specify each theme the product actually supports, including screen-specific dark-mode behavior and contrast when dark mode exists; do not add a theme just to fill a template. Details: `references/process-steps.md`.

### Step 6: Animation and Motion

**Step 6: Animation and Motion** — Specify motion only for state transitions or interactions where it improves feedback or comprehension; record "none" for immediate transitions and omit unused rows. Details: `references/process-steps.md`.

### Step 7: Component States

**Step 7: Component States** — Specify every visual state (default, hover, focus, active, disabled, loading, error, etc.) for every interactive component. For tabs, accordions, dropdowns and similar controls, define the active/selected/expanded states, map them to ARIA attributes (`aria-selected`, `aria-expanded`), and state which panel is visible or unmounted per state (exactly one active panel); missing panel-visibility mapping or ARIA documentation is a G3 FAIL. Details: `references/process-steps.md`.

## Purposeful visual choices

**Purposeful visual choices** — Distinctiveness comes from the product's data, language, user job and hierarchy; prefer the smallest change that clarifies the important action. Do not add glass effects, headline imagery, a new font, accent colors or tactile motion just to signal polish; any chosen treatment must record the compared real screen, intended user outcome, and how it will be shown. Details: `references/purposeful-visual-choices.md`.

### Step 8: Responsive Layout Specifics

**Step 8: Responsive Layout Specifics** — Translate the UX responsive strategy into implementation-ready decisions: grid system, per-screen layouts at each breakpoint, and responsive behavior of each component. Details: `references/process-steps.md`.

### Step 9: Assemble The UI Design Document

**Step 9: Assemble The UI Design Document** — Write the complete UI design to `docs/specs/ui/<feature-name>.md` with header links (feature spec, UX, design system), Status DRAFT pending G3, and the component, token, hierarchy, theme, motion, state and responsive sections from Steps 2-8. Details: `references/process-steps.md`.

### Step 10: AC Traceability Check

**Step 10: AC Traceability Check** — Walk every AC in the feature spec and confirm the UI design addresses it visually, in an AC/persona/screen/components/states/responsive table. Every AC must have a visual spec (otherwise loop back to `design-ux`, extend the design system, or confirm it is backend-only), and user/admin-facing ACs must cite concrete persona IDs or paths, not generic labels like `customer` or `all users`. Details: `references/process-steps.md`.

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

**Step 12: Update Feature Spec Status** — On G3 PASS, set the feature spec `**Status:** DESIGNED` and add a UI Design section with the artifact path, design-system path and `G3 Review: PASS — [date]`. Details: `references/process-steps.md`.

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

**Lane graph driven by `svc-next`.** When `.svc/lane-tasks-<WI>.json` was compiled for this work, `svc-next` alone completes this stage and picks the successor: do not mark the task completed, start or load the next task or skill, or follow a next-skill default from this section; finish through `## Handback` at the end of this file. The rules below apply only without a compiled lane graph.

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Follow `references/task-graph-chaining-protocol.md`: treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, mark this skill's task `completed` before leaving, then load the next runnable task's skill (marking it `in_progress`) or mark it `completed` with a skip reason. Mirror status to the host UI only from the parent session (Claude `TaskList`/`TaskUpdate`; Kimi `/task` observation; in Codex, mirror only the active step in `update_plan`); a subagent (`SVC_SUBAGENT=1`) leaves mirroring to the parent, because a failed mirror call silently drifts from the file.

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

**Under a compiled lane graph (`.svc/lane-tasks-*.json`) `svc-next` chooses the next stage: do not invoke or suggest the next skill from this section; follow `## Handback` at the end of this file. The standalone guidance below applies only when no lane graph exists.**

Apply the task-graph protocol above, then:

**If `--progressive` flag is present AND self-verify passed:**
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- If this is a marketing page: invoke `landing-page --progressive --lane <lane>`; that skill continues to applicable `track-visuals` and `design-tech`.
- If this is a product/app screen: skip `landing-page` with a recorded reason, then invoke `track-visuals --mode baseline` and `design-tech --progressive --lane <lane>`.
- If there is no visual surface: skip the visual-only steps with recorded reasons and invoke `design-tech --progressive --lane <lane>`.

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: run `landing-page` for a marketing page; otherwise continue with applicable `track-visuals --mode baseline`, then `design-tech`."

## Phase Z — Live in-app verification (post-execution promotion gate)

After implementation is deployed and before promotion is declared done, capture the affected screen(s) in every supported theme and shipping viewport via Playwright, follow the actual user journey through the changed states, and run the eyeball checklist in `_shared/live-evidence.md`. Without live screenshots the UI work is not done.

Output: `docs/specs/ui/<screen>/in-app-verification/` with labeled captures for the supported theme(s), viewports, and material states.

Hard-fails (raw text leak from JSX swap, broken theme swap, contrast fail, layout overlap, cached old asset) loop back to component re-render. Tier-1 component preview alone is **not sufficient** — the live journey and captures are the truth-teller.

A pre-execution design-ui task records this as a downstream proof obligation; it does not claim a deployed capture before implementation. On first deploy, capture the supported themes, viewports, and affected journey before promotion.

Origin: 2026-04-30 Example Marketplace run shipped a logo-swap that bundle-grep + build all PASSED while the live page rendered raw JSX text in the top-left. The component-preview was correct in isolation; only live capture caught it.

## Post-Compaction Recovery

If context was compacted and you lost framework state, `.svc/lane-tasks-<WI>.json` is the sole source of truth: resume the first `in_progress` task (else the first `pending` task with blockers satisfied), re-load its skill with `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and continue. Never ghost-complete: verify `skill_receipt` exists before marking any task complete. If `.svc/.checkpoint-<WI>.checkpoint.json` names a different `next_task`, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Handback

Run `node "$SVC_ROOT"/scripts/svc-next.mjs --root . --done design-ui --receipt load-skill` and follow the printed card: do only what its `SKILL` says. `progressive: true` means do not ask a person; it never names the next skill.
