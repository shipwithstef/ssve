# Process — detail

Moved verbatim from SKILL.md (progressive disclosure).

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

## Signature Hook (interaction decision)

- **Disposition:** existing-pattern-retained / selected improvement
- **User task and evidence:** [persona, journey, current spec/code behavior]
- **Rationale and meaningful alternative:** [why this choice fits the authorized scope]
- **Verification:** [affected ACs/states, accessibility/reduced motion, performance]
- **UI handoff:** [existing tokens/pattern, or new interaction requirements]

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
