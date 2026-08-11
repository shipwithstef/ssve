---
name: design-ux
version: "1.0"
handles_concerns:
  - wcag-aa-compliance
  - keyboard-navigation
  - screen-reader-flow
  - reduced-motion
  - cookie-consent
  - mobile-responsive
phases:
  - { id: P1-InputArtifactPreflight, required_for_completion: true }
  - { id: P2-DiscussionAlternativesReview, required_for_completion: true }
  - { id: P3-ScreenStateFlowDesign, required_for_completion: true }
  - { id: P4-AccessibilityResponsiveDesign, required_for_completion: true }
  - { id: P5-TraceabilityG2Handoff, required_for_completion: true }
  - { id: P6-SelfVerifyContinuation, required_for_completion: true }
description: Use when a DRAFT feature spec needs UX design — produces screen flows, state machines, information hierarchy, and interaction patterns before any visual design
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
    - { path: "docs/specs/journeys/J*-<name>.feature.md", artifact: journey-docs }
  optional:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
outputs:
  produces:
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
chain:
  lanes:
    greenfield: { position: 10, prev: write-journeys, next: design-ui }
    brownfield-feature: { position: 5, prev: write-journeys, next: design-ui }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Writing UX Design

**Runtime v2 continuation:** Register the UX artifact and its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve every state, journey, accessibility and G2 obligation.

## Overview

UX design answers HOW users experience the feature. It takes a DRAFT feature spec (user stories, ACs, journeys) plus personas and produces screen flows, state machines, information hierarchy, error handling, and accessibility requirements.

This skill transitions a feature spec from DRAFT to UX-REVIEWED.

```
write-spec              → DRAFT (WHAT: stories, ACs, journeys)
design-ux         → UX-REVIEWED (HOW users experience it: flows, states, interactions)
design-ui         → DESIGNED (HOW it looks: components, visual language, tokens)
design-tech  → BASELINED (HOW to build it: architecture, data model)
```

**Announce at start:** "I'm using the design-ux skill to define the user experience."

## Phase Receipt Contract

When a task graph exists, record these receipts before completing the
`design-ux` task:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-InputArtifactPreflight --evidence command_output:.svc/design-ux-inputs.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-DiscussionAlternativesReview --evidence command_output:.svc/design-ux-discussion-alternatives.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ScreenStateFlowDesign --evidence file:docs/specs/ux/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-AccessibilityResponsiveDesign --evidence command_output:.svc/design-ux-accessibility-responsive.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-TraceabilityG2Handoff --evidence command_output:.svc/design-ux-g2-handoff.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/design-ux-self-verify.log
```

## Product Questions — MANDATORY format

When this skill asks any product question (screen flows, empty/error/loading states, interaction patterns), follow `_shared/product-question-format.md` — 12 sections per question. Append to `docs/specs/features/<feature>-questions.md` with `phase: design-ux`. **Gating rule:** spec cannot flip → UX-REVIEWED unless `phase: design-ux` questions are all AGREE.

## Discussion Artifact Pre-Flight

Before defining flows for a topic, check for a matching discussion artifact at
`docs/specs/discussions/<topic>.md`.

If one exists:

- read it before making new UX choices in the same area
- inherit every `decided` row that constrains flows, states, or ownership
- if the artifact status is `blocked`, stop instead of designing around the blocker
- if the artifact status is `rerouted`, hand off to `recommended_next_skill`
- if UX work discovers new one-way-door ambiguity not already captured there,
  route back to `discuss-phase` instead of silently guessing

## Design Alternatives

For each key decision in this phase (navigation model, interaction pattern,
information hierarchy), follow the Design Alternatives Protocol
(`references/design-alternatives.md`).

## Adversarial Design Review (after UX is drafted)

See [references/adversarial-design-review.md](references/adversarial-design-review.md) for the full adversarial review — the 12 Designer Cognitive Patterns, AI Slop Blacklist, 7 Review Dimensions, and Review Scorecard. MANDATORY after the UX is drafted; this is the G2 design-review rubric.

## What UX Design Is (And Is Not)

UX design defines the structure, flow, and behavior of the experience. It determines what screens exist, what states each screen can be in, how users navigate between them, what information matters most, and what happens when things go wrong.

**UX design does NOT define:** Colors, fonts, spacing, visual style, component libraries, design tokens, animation specifics. Those are UI design (Phase 5). If you catch yourself writing hex values, font names, or pixel measurements, stop — you have crossed into UI territory.

**The boundary:** UX says "this screen has a primary action, a list of results, and a filter panel." UI says "the primary action is a 48px filled button in brand-primary, the list uses 16px inter-line spacing, and the filter panel collapses below 768px into a bottom sheet."

## Feature Types and UX Implications

All three feature types go through UX design, but the experience they design is different:

| Type | UX Focus | Screens/Views |
|------|----------|---------------|
| Feature | End-user flows — the journey a persona takes through the UI | Application screens, modals, forms, result views |
| Enabler | Admin/monitoring UX — how operators observe and control the system | Dashboards, status views, configuration panels, log viewers |
| Integration | Configuration UX — how the integration is set up and monitored | Setup wizards, connection status, credential management, webhook logs |

**Enablers without any UX surface** (pure background services with no admin interface) can skip this phase. The gate question is: "Does any human ever look at a screen related to this?" If no, skip to design-tech.

## When To Use

- After write-spec produces a DRAFT feature spec with user stories, ACs, and journeys
- When a feature has user-facing or admin-facing screens that need flow design
- Before invoking design-ui (requires UX-REVIEWED spec)
- When Layer 3 journey analysis reveals flow gaps that need screen-level resolution

## Prerequisites

| Artifact | Where | Required? | If missing |
|----------|-------|-----------|------------|
| Feature spec (DRAFT) | `docs/specs/features/<feature>.md` | Yes — must have stories + ACs | Route to `write-spec` |
| Journey doc(s) | `docs/specs/journeys/J*.feature.md` | Yes — must reference the feature's ACs | Route to `write-spec` to trigger `write-journeys` |
| Personas | `docs/specs/personas/P*.md` | Required for Features | Enablers/Integrations use system consumers |
| Vision | `docs/specs/vision.md` | Recommended | Provides product boundaries and principles |

**Gate:** Do not start UX design without a DRAFT spec. If the spec lacks user stories and ACs, route to `write-spec` first.

## Process

### Step 1: Read The Spec, Journeys, and Personas

Read the DRAFT feature spec, all referenced journey docs, and all relevant personas. Understand:

- What user stories need screen flows
- What ACs define the experience (not just the outcome)
- What journey steps involve UI or admin interaction
- What personas use this feature (their goals, pain points, technical comfort)
- What Layer 3 findings affect the experience

```bash
# Read the feature spec
cat docs/specs/features/<feature-name>.md

# Read referenced journeys
ls docs/specs/journeys/J*.feature.md 2>/dev/null
cat docs/specs/journeys/J*-<feature-name>.feature.md 2>/dev/null

# Read personas (for Features)
ls docs/specs/personas/P*.md 2>/dev/null

# Read vision for product boundaries
cat docs/specs/vision.md 2>/dev/null | head -80
```

Read `docs/specs/domain-profile.md` if available — domain constraints affect UX flows:
- Regulated domains (fintech, health) need consent gates, review checkpoints, trust moments
- Technical user domains (devtools, infra) need dense defaults, not consumer-style handholding
- Domain pitfalls section flags what the UX must make explicit (e.g., destructive actions in admin tools)

Read `docs/specs/analyze-competitors.md` if available — competitor UX patterns inform what users already expect and where to differentiate.

### Step 1.5: Signature Interaction Discovery (Masterclass UI)

The agent must autonomously conceive a "Signature Hook" that makes the UI unique and "alive." This is an automated activity that moves beyond generic components.

**The Creative Director's Menu:**
Propose 3 distinct hooks from the library below that align with the Vision:
- **Precision Dials**: Digital knobs with inertial momentum and friction.
- **Liquid Glass**: Refractive state-transitions using advanced backdrop filters.
- **Dead-Front UI**: Components that "ignite" with a high-precision glow.
- **Tactile Maximus**: 3D-sculpted geometry with squishy physics.

**Autonomous Selection Protocol (Standalone Mode):**
In standalone mode, the agent uses an internal **Actor-Critic Loop** to rate each proposal against the **Aesthetic Scoring Rubric** (Precision, Resonance, Novelty, Efficiency, Maturity).
1. **Parallel Pitch**: Actor pitches 3 hooks.
2. **Blind Critique**: Critic scores each (0-100).
3. **Winner**: The hook with the highest score (Target 90+) is **Auto-Selected** as the project's Signature Hook.

Record the winner in the UX Design document and ensure its technical requirements are passed to `design-ui`.

### Step 2: Screen Inventory

Identify every distinct screen or view the feature requires. A "screen" is any state the user perceives as a distinct place — a page, a modal, a panel, an overlay.

```markdown
## Screen Inventory

| Screen ID | Name | Type | Entry Point | Primary Action |
|-----------|------|------|-------------|----------------|
| S1 | [Name] | [Page/Modal/Panel/Overlay/Toast] | [How user gets here] | [What user does here] |
| S2 | [Name] | [Type] | [Entry point] | [Primary action] |
```

**Rules:**
- Every user story must map to at least one screen
- Every journey UI step must happen on a named screen
- Empty states, error states, and loading states are NOT separate screens — they are states of a screen (Step 3)
- Modals and overlays are screens if they require user decisions; they are components if they are pure confirmation

**For Enablers:** Screens are admin dashboards, monitoring views, configuration panels.

**For Integrations:** Screens are setup wizards, connection status views, credential management forms.

### Step 3: State Machines Per Screen

Each screen has a finite set of states. Map them as a state machine.

```markdown
## State Machines

### S1: [Screen Name]

| State | Description | Transitions To | Trigger |
|-------|-------------|---------------|---------|
| EMPTY | No data, first visit | LOADING | User opens screen |
| LOADING | Fetching data | POPULATED / ERROR | API response |
| POPULATED | Data displayed | LOADING / ACTION_PENDING | User scrolls, filters, selects |
| ACTION_PENDING | User initiated action, awaiting response | POPULATED / ERROR | API response |
| ERROR | Something failed | LOADING | User retries |
| STALE | Data older than threshold | LOADING | Auto-refresh or user refresh |
```

**Rules:**
- Every screen must have at minimum: LOADING, POPULATED, EMPTY, ERROR
- Identify what triggers each transition (user action, system event, timer)
- Name the data conditions — what makes a screen "empty" vs "populated"?
- Consider offline/degraded states if the app should work offline
- **Interactive Control Transitions:** For interactive controls that toggle visible panels (such as tabs, accordions, segmented controls), the state machine or screen flow must specify the precise transition: what triggers it, what is mounted/visible, what is unmounted/hidden, and how the default state is restored.

**Diagram format:** Use ASCII state diagrams for clarity:

```
EMPTY ──[open]──→ LOADING ──[success]──→ POPULATED
                     │                       │
                     ├──[failure]──→ ERROR    ├──[action]──→ ACTION_PENDING
                     │                ↑      │                    │
                     │                └──────←┘──[retry]─────────←┘
                     │                       │
                     └──[empty result]──→ EMPTY (with prompt)
```

### Step 4: Flow Diagrams

Map how users navigate between screens. The flow diagram shows the paths through the feature, not just individual screens.

```markdown
## Flow Diagrams

### Primary Flow: [Journey name / Happy path]

S1 (Entry) → S2 (Selection) → S3 (Confirmation) → S4 (Result)
     ↓              ↓                ↓
  [back nav]    [cancel → S1]   [error → S3-ERROR state]

### Alternative Flow: [Edge case / Error recovery]

S1 → S2 → S2-ERROR → S2 (retry) → S3 → S4
```

**Rules:**
- One flow per journey scenario at minimum
- Show branching points (where user makes a choice)
- Show error recovery paths (where user gets back on track)
- Show exit points (where user can abandon the flow)
- Map each AC to the flow that exercises it

```markdown
### AC Coverage

| AC | Flow | Screen | State |
|----|------|--------|-------|
| MATCH-01 | Primary Flow | S3 | POPULATED |
| MATCH-02 | Primary Flow | S2 | LOADING → POPULATED |
| MATCH-03 | Error Recovery | S2 | ERROR |
```

### Step 5: Information Hierarchy

For each screen, define what information matters most. This is NOT layout — it is priority. UI design will determine how priority maps to visual weight.

```markdown
## Information Hierarchy

### S1: [Screen Name]

| Priority | Element | Content | Why |
|----------|---------|---------|-----|
| 1 (highest) | [Primary content] | [What it shows] | [Why it's most important — ties to persona goal] |
| 2 | [Secondary content] | [What it shows] | [Supports the primary task] |
| 3 | [Tertiary content] | [What it shows] | [Nice to have, not essential to the task] |
| Navigation | [Nav elements] | [What they do] | [How user moves forward/back] |
| Metadata | [Supporting info] | [What it shows] | [Context, not actionable] |
```

**Rules:**
- Priority 1 must directly serve the screen's primary action (from Step 2)
- If two things are "equally important," you have not prioritized — pick one
- Reference persona goals to justify priority decisions
- Metadata goes last unless the feature IS about metadata (e.g., analytics dashboard)

### Step 6: Error and Loading States

Define the experience for every non-happy-path state. This is where most UX fails — the happy path is designed, everything else is an afterthought.

```markdown
## Error States

| Screen | Error Type | User Sees | Recovery Action | Copy Tone |
|--------|-----------|-----------|-----------------|-----------|
| S1 | Network failure | [What message] | [What they can do] | [Empathetic / Informative / Actionable] |
| S1 | Empty result | [What message] | [Suggestion to change input] | [Helpful, not blaming] |
| S2 | Validation error | [Inline on field] | [Fix and resubmit] | [Specific, not generic] |
| S2 | Server error | [What message] | [Retry or contact support] | [Apologetic, actionable] |
| S3 | Timeout | [What message] | [Auto-retry or manual] | [Transparent about cause] |

## Loading States

| Screen | Load Type | Duration Expected | User Sees | Interaction During Load |
|--------|----------|-------------------|-----------|------------------------|
| S1 | Initial data | <1s | Skeleton/shimmer | None — block interaction |
| S2 | Search results | 1-3s | Progress indicator | Can cancel |
| S3 | Submit action | 1-5s | Button loading state | Disable submit, allow cancel |
| S3 | Heavy processing | >5s | Progress bar with status | Can navigate away, notified on complete |
```

**Rules:**
- Every screen's ERROR state (from Step 3) must have a row here
- Loading states must specify whether the user can interact during the load
- Error copy must be actionable — "Something went wrong" is never acceptable
- Define timeout thresholds (when does "loading" become "error"?)

### Step 7: Accessibility Requirements

Define accessibility requirements specific to this feature. These are not generic WCAG guidelines — they are feature-specific decisions.

```markdown
## Accessibility Requirements

### Keyboard Navigation

| Screen | Tab Order | Keyboard Shortcuts | Focus Management |
|--------|-----------|-------------------|-----------------|
| S1 | [Logical tab sequence] | [Feature-specific shortcuts] | [Where focus goes on load / after action] |

### Screen Reader

| Screen | Announcements | Live Regions | Landmark Structure |
|--------|--------------|-------------|-------------------|
| S1 | [What gets announced and when] | [Dynamic content that updates] | [Main, nav, complementary] |

### Cognitive

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Reading level | [Target level] | [Persona context] |
| Animation | [Reduce motion support?] | [What changes when prefers-reduced-motion is set] |
| Time limits | [Any timed interactions?] | [How to extend / disable time limits] |
| Error prevention | [Confirmation before destructive actions?] | [Which actions are reversible vs. destructive] |
```

**Rules:**
- Keyboard navigation must cover every interactive element
- Focus management must be specified for modals, dynamic content, and route changes
- Screen reader announcements must be specified for state changes (Step 3 transitions)
- Every timed interaction must have an extension mechanism

### Step 8: Responsive Strategy

Define how the experience adapts across viewport sizes. This is behavior strategy, not pixel breakpoints — UI design handles specific measurements.

```markdown
## Responsive Strategy

### Approach: [Mobile-first / Desktop-first / Adaptive]

### Behavior by Viewport

| Screen | Small (Mobile) | Medium (Tablet) | Large (Desktop) |
|--------|---------------|-----------------|-----------------|
| S1 | [How it adapts — stack, collapse, hide, reorder] | [Behavior] | [Full layout] |
| S2 | [How it adapts] | [Behavior] | [Full layout] |

### Critical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Navigation pattern | [Bottom tabs / hamburger / sidebar / persistent] | [Why for this feature's flow] |
| Content priority on small viewport | [What hides / collapses / moves] | [Based on info hierarchy Step 5] |
| Touch targets | [Minimum size strategy] | [Based on primary actions] |
| Scroll behavior | [Infinite scroll / pagination / load more] | [Based on data volume and UX pattern] |
```

**Rules:**
- Do not specify breakpoint pixel values — that is UI design
- Do specify behavioral strategy (stack vs. hide vs. collapse)
- Small viewport must still satisfy all ACs — no features can be desktop-only unless explicitly specified in the spec
- Touch target decisions must reference primary actions from Step 2

### Step 9: Assemble The UX Design Document

Write the complete UX design to `docs/specs/ux/<feature-name>.md`:

```markdown
# UX Design: [Feature Name]

**Feature Spec:** `docs/specs/features/<feature-name>.md`
**Status:** DRAFT (pending G2 review)
**Type:** [Feature | Enabler | Integration]
**Personas:** [P1, P3 | system consumers]
**Created:** [YYYY-MM-DD]

---

## Persona Trace

| Persona | Flow(s) | Trust/friction moment | ACs driven | UX decision |
|---------|---------|-----------------------|------------|-------------|
| [P2 / docs/specs/personas/P2.md] | [Primary flow] | [What this persona worries about] | [AC-ID] | [Concrete design decision] |

---

## Screen Inventory

[From Step 2]

---

## Signature Hook (Masterclass UI)

**Autonomous Discovery (Step 1.5):**
The agent (as Creative Director) pitched 3 hooks from the Signature Interaction Menu:
1. [Hook 1 Name]: [Brief Description]
2. [Hook 2 Name]: [Brief Description]
3. [Hook 3 Name]: [Brief Description]

**Autonomous Selection:**
- **Winner**: [The Auto-Selected Hook]
- **Target Aesthetic Score**: [Aggregate Score, e.g. 94/100]
- **Critic's Note**: [Why this hook won resonance with the Vision]

---

## State Machines

[From Step 3]

---

## Flow Diagrams

[From Step 4]

---

## Information Hierarchy

[From Step 5]

---

## Error and Loading States

[From Step 6]

---

## Accessibility Requirements

[From Step 7]

---

## Responsive Strategy

[From Step 8]

---

## AC Traceability

| AC | Screen | State | Flow | Covered? |
|----|--------|-------|------|----------|
| [AC-ID] | [Screen] | [State] | [Flow name] | Yes / Partial / No |

---

## Open Questions

[Any UX decisions that need stakeholder input before proceeding]
```

### Step 10: AC Traceability Check

Walk through every AC from the feature spec and verify the UX design addresses it.
For user/admin-facing ACs, the row must be explainable by a persona in
`## Persona Trace`; otherwise route back to `build-personas` or `write-spec`.

```markdown
### AC Traceability

| AC | Screen | State | Flow | Covered? |
|----|--------|-------|------|----------|
| MATCH-01 | S3 | POPULATED | Primary Flow | Yes |
| MATCH-02 | S2 | LOADING → POPULATED | Primary Flow | Yes |
| MATCH-03 | S2 | ERROR | Error Recovery | Yes |
| MATCH-04 | S1 | EMPTY | First-time flow | Partial — needs empty state copy decision |
```

**Gate:** Every AC must be covered. If an AC cannot be covered by the UX design:
- The AC may need revision (feedback loop to `write-spec`)
- The screen flow may be missing a screen (go back to Step 2)
- The state machine may be missing a state (go back to Step 3)

### Step 11: Trigger G2 Review

The UX design artifact is ready for Gate G2 review. Invoke the Review Protocol:

**G2 checks:**
- Do flows cover all user stories?
- Are states complete for every screen?
- Is error handling specified (not hand-waved)?
- Are accessibility requirements feature-specific (not generic)?
- Does the responsive strategy preserve all ACs on all viewports?
- Is every AC traceable to a screen, state, and flow?

**Review Protocol steps:**
1. **Self-review** — review the UX design artifact for completeness and consistency
2. **Self-judgment** — accept or reject each finding with reasoning
3. **Cross-review** — fresh agent reviews artifact plus self-review findings
4. **Convergence check** — only medium/low issues remain? Pass. Critical/high? Fix and re-enter.
5. **Gate decision** — PASS (proceed to UI design) / FAIL (fix findings) / ESCALATE (human reviews)

### Step 12: Update Feature Spec Status

On G2 PASS, update the feature spec:

```markdown
**Status:** UX-REVIEWED
```

Add a UX Design reference:

```markdown
## UX Design

**Artifact:** `docs/specs/ux/<feature-name>.md`
**G2 Review:** PASS — [date]
```

### Step 13: Handoff

Present a summary:

```
UX design saved: docs/specs/ux/<feature-name>.md
Feature spec updated: docs/specs/features/<feature-name>.md
Status: UX-REVIEWED (was DRAFT)
Screens: N screens identified
States: M total states across all screens
Flows: K flows mapped
AC coverage: [all / N of M covered, gaps listed]
Accessibility: [keyboard, screen reader, cognitive, responsive — all addressed]

Ready for UI design. Next step:
  "Run design-ui against docs/specs/ux/<feature-name>.md"
```

**The terminal state is invoking design-ui.** This skill does not define visual design, choose colors, pick fonts, or specify component libraries.

## Feedback Loops

UX design often reveals problems upstream. Handle them:

| Discovery | Action |
|-----------|--------|
| Story implies a flow that is impossible or confusing | Route back to `write-spec` to revise the story |
| AC requires a screen state not in any journey | Route to `write-spec` to re-run `write-journeys` |
| Persona's goals conflict with the proposed flow | Route to `build-personas` to validate persona (then return) |
| Feature type unclear (does this need admin UX?) | Route to `write-spec` to clarify Type |
| Journey has UI steps that map to no screen | Add screen to inventory (Step 2) and re-check flows |

**Key principle:** It is cheaper to revise the spec now than to discover flow problems during UI design or implementation.

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Specify colors, fonts, or spacing | That is UI design (Phase 5) | Define priority and behavior, not visual treatment |
| Name specific UI components (e.g., "Material Card") | Couples UX to a component library | Describe what the element does, not what it is called |
| Skip error and loading states | These are where users lose trust | Every screen state machine must have ERROR and LOADING |
| Write generic accessibility boilerplate | WCAG compliance is a baseline, not a feature-specific UX decision | Define keyboard flow, focus management, and announcements for THIS feature |
| Design for desktop only | Mobile is often the primary viewport | Responsive strategy must preserve all ACs on all viewports |
| Skip AC traceability | Untraced ACs become unimplemented features | Every AC maps to a screen, state, and flow |
| Combine UX and UI into one document | Separate concerns, separate review gates | UX is structure and behavior; UI is visual and components |

## Routing

| Situation | Route to |
|-----------|----------|
| UX design complete, G2 passed | `design-ui` |
| Story requires flow revision | `write-spec` (feedback loop) |
| Persona gap discovered | `build-personas` (then return) |
| Journey flows don't match screen flows | `write-spec` to re-run `write-journeys` |
| No DRAFT spec exists | `write-spec` (prerequisite) |
| Feature has no user-facing screens | Skip to `design-tech` |

## Audit Mode

When invoked with `--audit` to review existing UX design:

1. Read `docs/specs/ux/<name>.md`
2. Check against current feature spec ACs: every AC has a screen that addresses it?
3. Check state coverage: every screen has LOADING, ERROR, EMPTY states defined?
4. Check flow completeness: can the user reach every screen from the entry point?
5. Check responsive strategy: defined for all screens?
6. Report: screen-by-screen PASS/WARN/FAIL

## Pipeline Continuation

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
| 1 | UX design file exists | `test -f docs/specs/ux/<name>.md` | |
| 2 | Screen Inventory section present | grep for "## Screen Inventory" in output file | |
| 3 | State Machines section present | grep for "## State Machines" in output file | |
| 4 | Flow Diagram section present | grep for "## Flow Diagrams" in output file | |
| 5 | Loading/error/empty states defined for each screen | Every screen's state machine includes LOADING, ERROR, and EMPTY states | |
| 6 | Skip justified if applicable | If this is an Enabler/Integration with no UX surface: skip reason is logged in lane-tasks JSON and `pipeline-decisions.jsonl` with explicit justification; otherwise UX design file is substantive | |
| 7 | No unresolved questions | grep for TBD, TODO, open questions in output file | |

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
- Invoke next skill: `design-ui --progressive --lane greenfield`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `design-ui`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
