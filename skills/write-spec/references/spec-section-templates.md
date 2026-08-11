# write-spec — Spec section templates (Steps 2-6 payloads)

### Step 2: Define The Problem

Write a clear problem statement. This is NOT a solution description — it's what breaks or is missing without this feature.

**For Features:**
```markdown
## Problem Statement

[Who — persona] currently [pain point / gap]. This means [consequence].
[Evidence or context that validates this is worth solving.]
```

**For Enablers:**
```markdown
## Problem Statement

[Which features/services] currently [lack / cannot / must manually handle] [capability].
Without this, [consequence — what breaks for end users or other services].
[List dependent feature specs that need this.]
```

**For Integrations:**
```markdown
## Problem Statement

The system currently [has no way to / manually handles] [external interaction].
This means [consequence — data staleness, manual work, broken flow].
[External system: name, docs URL, API version.]
```

**Gate:** If you cannot articulate the problem without referencing the solution, stop and ask what breaks without this.

For `bugfix-behavior`, the problem statement should capture:
- actual behavior
- expected behavior
- why the mismatch matters

Do not turn a bugfix clarification into a net-new feature narrative unless the evidence shows the capability is actually missing.

### Step 3: Write Consumer Stories

Each story maps to a consumer — human persona, system service, or external event.

**Rules (all types):**
- One goal per story. "and" in the goal → split it.
- Order stories by flow — the sequence consumers encounter them.
- 2-7 stories per feature. >10 → decompose. 1 → might be a task, not a feature.

**Feature stories** reference personas (P1, P2) and describe user intent, not UI elements.
Feature-class specs must also add a `## Persona Trace` section mapping each
persona ID/path to the stories, ACs, journey implications, and explicit non-goals
it drives. A generic `customer`, `admin`, `all users`, `PASS`, or `satisfied`
entry is not evidence; cite concrete persona IDs such as `P2` or
`docs/specs/personas/P2-real-time-discovery-customer.md`.

**Enabler stories** name the consuming service and describe the contract it needs.

**Integration stories** use "When [external event]" format and describe the system's obligation.

### Step 4: Write Acceptance Criteria

Each story gets an AC table in the shared contract format:

```markdown
### Acceptance Criteria — US-1: [Story title]

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| [PREFIX]-01 | [Testable condition — one behavior per row] | — | 🔲 | — |
| [PREFIX]-02 | [Another testable condition] | — | 🔲 | — |
```

**Rules:**
- AC prefix derived from feature name (e.g., `MATCH-01`, `RECALC-01`, `STRIPE-01`)
- Each AC is one testable behavior — no compound conditions
- QA, E2E, and Test columns start empty — other skills fill these
- Include happy path, error cases, edge cases, and **failure modes**
- **Interactive Control Contracts:** If the spec introduces or modifies UI controls that toggle views/content (tabs, segmented controls, accordions, filters, dropdowns, toggles, steppers, mode buttons), the AC table MUST explicitly define the control type, default state, click/change transition behavior, what content/surface appears, what content/surface disappears, and required accessible state (e.g., `aria-selected`, `aria-expanded`). Clicking a control must not only change styling or leave multiple panels/surfaces visible/mounted simultaneously.

**Vibe Acceptance Criteria (Masterclass UI):**
Every feature with a user-facing UI MUST include at least one **Vibe AC** that specifies a "Masterclass Hook" (e.g., a specific animation curve, haptic feedback, or unique interaction state). These are discovered during the `design-ux` vibe phase.
- Example: `HOUR-VIBE-01 | Vault-door timer "ignites" with a high-precision blue glow and inertial recoil on state-lock.`

**For Enablers, add SLA criteria:**
```markdown
| RECALC-05 | Recalculation completes within 30min SLA | — | 🔲 | — |
| RECALC-06 | On failure, last good data preserved (no data loss) | — | 🔲 | — |
| RECALC-07 | Failure emits alert event within 5min | — | 🔲 | — |
```

**For Integrations, add contract criteria:**
```markdown
| STRIPE-04 | Invalid webhook signature returns 401 | — | 🔲 | — |
| STRIPE-05 | Duplicate event IDs are idempotent (no double-processing) | — | 🔲 | — |
| STRIPE-06 | Webhook processing completes within 10s (Stripe timeout) | — | 🔲 | — |
```

**Gate:** Read each AC aloud. If you can't write a test for it, it's not specific enough. Rewrite.

### Step 5: Identify System Dependencies

Map what this feature depends on and what depends on it. For every Integration
and external Enabler, specify the mock strategy — how it behaves locally with
zero credentials.

```markdown
## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|-------------|-----------------|---------------|
| User authentication | Enabler | ✅ feature-auth.md | Authenticated session | Local JWT issuer, test users |
| Email service | Enabler | ❌ — needs spec | Transactional email delivery | Console logger, captures body |
| Stripe API | Integration | ❌ — needs spec | Payment processing | Returns success, logs to console |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|----------------------|
| Match discovery UI | Feature | Fresh scores via API |
| Recommendation emails | Enabler | Top matches per user |
```

**Mock strategy is required for every Integration and every Enabler that talks
to an external service.** Internal Enablers (e.g., a cron job that reads the
local DB) don't need a mock strategy. The rule: if it needs credentials or
network access to work, it needs a mock strategy.

**When a dependency spec doesn't exist (❌):** Flag it. After this spec is complete, create the dependency spec. This is how the full chain gets built — each spec reveals what's missing below it.

**Gate:** No spec passes G1 without mock strategies for all external
dependencies. If a mock strategy is missing, the spec is incomplete.

### Step 6: Assemble The Feature Spec

Write the complete DRAFT spec to `docs/specs/features/<feature-name>.md`:

```markdown
# Feature: [Feature Name]

**Status:** DRAFT
**Type:** [Feature | Enabler | Integration]
**Consumers:** [P1, P3 | service names | external system]
**Priority:** [from Ship Brief or user input]
**Created:** [YYYY-MM-DD]

---

## Problem Statement

[From Step 2]

---

## User Stories

[From Step 3 — all stories with AC tables from Step 4]

---

## System Dependencies

[From Step 5]

---

## API Contracts

_Fill for Features and Integrations that expose or consume HTTP endpoints.
Skip for Enablers with no HTTP surface._

| Method | Path | Auth | Request | Response | AC |
|--------|------|------|---------|----------|-----|

---

## Data Model

_Fill when the feature adds or modifies tables/collections. Skip if no
schema changes._

| Table | Column | Type | Nullable | Constraints | AC |
|-------|--------|------|----------|-------------|-----|

---

## Component Tree

_Fill for Features with UI. Skip for Enablers and Integrations._

```
[PageComponent]
  └── [ChildComponent]
        ├── [Subcomponent]
        └── [Subcomponent]
```

---

## Event Contracts

_Fill for Enablers and Integrations that emit or consume events/messages.
Skip for simple Features with no async communication._

| Event | Producer | Consumer | Payload | AC |
|-------|----------|----------|---------|-----|

---

## Feature Toggles

_Fill when the feature depends on external services. Maps to the
project-level toggle registry._

| Toggle | Local default | What it controls | ACs affected |
|--------|--------------|-----------------|-------------|

---

## Technical Design

_To be added by design-tech. MUST include sub-sections: Architecture, Components, Data Model, Data Flow, External Dependencies, Technology Decisions, **Cost Model**, **Operations & Ownership**. See `skills/design-tech/SKILL.md` for the contract on cost and operations._

---

## Pillars Coverage Matrix

_Mandatory. See `references/pillars-coverage-matrix.md` for the contract. All 8 pillars must be populated with an explicit state. Blank cells, TODO placeholders, or "skipped" are a hard fail at G1 review gate._

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[NEW | UPDATED | UNCHANGED — VERIFIED | N/A — justified]` | <path or one-line justification> |
| 2 | Journey | `[state]` | <path> |
| 3 | Acceptance criteria | `[state]` | <path> |
| 4 | UX | `[state]` | <path or `[N/A — justified: <reason>]`> |
| 5 | UI | `[state]` | <path or `[N/A — justified: <reason>]`> |
| 6 | Tech architecture | `[state]` | <path> |
| 7 | Cost model | `[state]` | <path or explicit estimate> |
| 8 | Operations & ownership | `[state]` | <path or explicit ownership> |

**Lane 1 (greenfield):** all pillars start `[NEW]`. Exceptions to UX/UI/Cost/Ops require `[N/A — justified]` with a specific reason.
**Lane 3 (brownfield extension):** pillars are a mix of `[UPDATED]` / `[UNCHANGED — VERIFIED]` / `[N/A — justified]`. Journey, AC, Tech architecture, and Operations are NEVER skippable.

---

## Implementation Notes

_To be added by plan-changeset and execute-changeset._

---

## Journey References

_To be added in Step 7._
```

