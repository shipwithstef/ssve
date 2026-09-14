<!-- Extracted from skills/write-journeys/SKILL.md (WI-CLN-14 / plan §4.13 progressive disclosure). -->
## Mode 6: Tiered Auto-Discovery

Full instructions for the proposal-gated, tiered journey discovery mode. This is the
right mode when starting fresh — new product, major pivot, or full reset. It produces
a complete picture of all possible journeys before writing any of them.

### Phase 6A: Deep Read

Read everything before thinking about journeys.

**Step 1: Read persona files**

```bash
ls docs/specs/personas/P*.md 2>/dev/null
cat docs/specs/personas/PERSONA_INDEX.md 2>/dev/null
```

If persona files exist, read ALL of them fully. Each persona file has a
**Skill Implications > write-journeys** section — read it. Each has a **Lifecycle
Progression** section — this is a proto-journey map. Each has a **Tier** field
(Tier 1, 2, or 3) — the persona's tier affects the journey tier classification.

If no persona files exist, extract basic personas from feature specs (role names,
user stories) and warn the user: "Run `/build-personas` Mode 7 first for best
results. Proceeding with spec-extracted personas — journeys will be less nuanced."

**Step 2: Read ALL feature specs**

```bash
ls docs/specs/features/*.md 2>/dev/null
```

Read every spec. You cannot classify journeys without knowing what the product
can and can't do today. For each spec, note:
- Which user role(s) it serves
- Which lifecycle stage it covers (onboarding, core loop, advanced)
- Whether it's fully built, partially built, or planned

**Step 3: Check for existing journeys and Tier 2 backlog**

```bash
ls docs/specs/journeys/*.feature.md 2>/dev/null
cat docs/specs/personas/TIER2_BACKLOG.md 2>/dev/null
```

If journeys already exist, note which personas and flows are covered. The discovery
should propose NEW journeys only — avoid duplicating what's already built.

If a TIER2_BACKLOG.md exists (produced by build-personas Mode 7), read it — it
tells you exactly which small additions are available to enhance Tier 2 journeys.

---

### Phase 6B: Build Journey Candidates

For each persona, identify the distinct journey archetypes they need. One persona
typically needs 3–5 journeys. Some journeys serve multiple personas.

**Journey archetypes to look for:**

| Archetype | What it covers | Usually maps to |
|-----------|---------------|-----------------|
| Activation | Signup → first value moment | Every persona has one |
| Core loop | The thing they do in every session | Every persona has one |
| Conversion | Free → paid, or basic → advanced | Personas with upgrade paths |
| Recovery | Error state or re-engagement | Where the product has known gaps |
| Power user | Advanced feature combination | Tier 2/3 personas primarily |

**Persona-specific archetypes:** Some journeys are unique to one persona type:
- A scout ambassador needs a "referring a business" journey
- A multi-location operator needs a "cross-location management" journey
- An AI-forward operator needs an "AI weekly workflow" journey
- An employee needs a "shift lifecycle" journey

**Shared journeys:** Some journeys serve multiple personas who overlap:
- Onboarding/signup: all user roles have one but they're different paths
- Points redemption: any customer persona
- Notification response: any persona with notifications

**Produce the candidate list:**

```
JOURNEY CANDIDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Persona P1 (3 journeys):
  - P1-J1: Owner activation (setup wizard → first deal live)
  - P1-J2: Owner daily operations (status update → analytics check)
  - P1-J3: Owner deal + loyalty management

Persona P2 (4 journeys):
  - P2-J1: Customer activation (signup → first check-in)
  - P2-J2: Customer daily discovery (check status → flash offer)
  - P2-J3: Customer loyalty progression (earn points → redeem reward)
  - P2-J4: Customer premium upgrade

[... etc for all personas, noting shared journeys only once]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total candidates: N (including N shared journeys)
```

---

### Phase 6C: Tier Classification

Classify each candidate journey as Tier 1, Tier 2, or Tier 3 using this rubric:

**Tier 1 — Platform-Native (fully supported today)**

Every step of this journey is documented in a spec and the feature exists. A user
could complete this entire journey right now. The journey can be written fully from
existing specs with no gaps, no planned steps, no missing transitions.

*Signal:* All personas involved are Tier 1 personas. All feature specs for this
journey are fully implemented (not marked as planned or partial).

**Tier 2 — Near-Future Enhanced (core path works, 1–3 additions make it better)**

The core version of this journey works today — the user can complete the essential
steps. But 1–3 specific additions (from the Tier 2 backlog, or identified here)
would meaningfully improve the journey: removing friction, closing a feedback loop,
or unlocking a use case that's currently half-built.

*Signal:* At least one step involves a Tier 2 persona's gap area. Or the persona is
Tier 2 and their specific capability gap affects this journey directly.

Tier 2 journeys produce TWO versions:
- **Current path** — the journey as it exists today (all `[SPEC]` or `[LIVE]` steps)
- **Enhanced path** — the same journey with the additions, marking each enhancement
  with `[TIER-2-ENHANCED: <backlog item reference>]`

**Tier 3 — Vision (requires major new capabilities)**

This journey is only possible after significant platform changes: new auth roles,
new entity types, cross-account features, new permission models. No amount of small
additions enables it — it needs architectural work.

*Signal:* The persona is a Tier 3 persona. Or the journey requires capabilities the
platform explicitly doesn't have (e.g., cross-account analytics, franchise hierarchy).

Tier 3 journeys become **stubs only** — title, persona, goal, capability dependencies.
No scenario steps. Clearly marked `[TIER 3 — VISION STUB]`.

---

### Phase 6D: Proposal Output (approval gate)

**Do not write any journey files before the user approves the proposal.**

Present the classified candidate list in a single structured output:

```
JOURNEY DISCOVERY — TIERED PROPOSAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tier 1 — Fully supported today (N journeys)
These can be written immediately from existing specs.

| # | Journey | Persona(s) | Features touched | Priority |
|---|---------|-----------|-----------------|----------|
| 1 | [title] | P1, P2    | 3 specs          | Critical |
...

Tier 2 — Core path works, enhanced path available (N journeys)
Written with two sections: current path + enhanced path.

| # | Journey | Persona(s) | Current gap | Backlog items needed |
|---|---------|-----------|-------------|---------------------|
| N | [title] | P4        | No rollup view | #1 cross-location analytics |
...

Tier 3 — Vision stubs (N journeys)
Stub files only. Steps defined after major platform additions.

| # | Journey | Persona(s) | Capabilities needed |
|---|---------|-----------|---------------------|
| N | [title] | P7        | Manager role, cross-account analytics |
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: N journeys (Tier 1: N, Tier 2: N, Tier 3: N)

Build all?  Build Tier 1 + 2 only?  Pick specific journeys?
```

**Wait for user approval before proceeding.** Common responses:
- "build all" → build everything
- "build Tier 1 and 2, skip Tier 3" → build non-stubs
- "start with the critical ones" → build Critical-priority journeys first, come back for High/Medium
- "skip #3 and #5" → build everything except those
- Numbers like "1, 4, 7" → build only those specific journeys

---

### Phase 6E: Build Approved Journeys

Build in this order: Tier 1 Critical first → Tier 1 High → Tier 2 → Tier 3 stubs.

**Tier 1 journeys** — use the standard journey format from Phase 3. Full scenarios,
all layers (Layer 1/2/3 analysis), complete AC references. No special treatment.

**Tier 2 journeys** — standard format, with these additions:

After the standard `## Behavior Specification` section (which shows the current path
using `[SPEC]`/`[LIVE]` status tags), add:

```markdown
---

## Enhanced Path

> **Tier 2 Enhancement** — This section shows the same journey after the following
> backlog additions are implemented: [list the specific additions from TIER2_BACKLOG.md].
> Each enhanced step is marked `[TIER-2-ENHANCED]`.

# Feature: [Journey title — Enhanced]

  [Brief description of what changes in the enhanced path]

  `@AC-ID-1` `@AC-ID-2`
  # Scenario: [Step that changes with the enhancement]
  - Given [same context as current path]
  - When [same action as current path]
  - Then [enhanced outcome — what changes with the addition] `[TIER-2-ENHANCED: backlog #N]`
  - And [additional feedback or capability not available today] `[TIER-2-ENHANCED: backlog #N]`

## What This Enhancement Requires

| Backlog item | Effort | Impact on this journey |
|-------------|--------|------------------------|
| [item name] | [XS/S/M] | [what specifically changes in this journey] |
```

The enhanced path only needs to show the STEPS THAT CHANGE. If 8 steps stay the same
and 2 steps change, the enhanced path only shows those 2 steps in context. Don't
rewrite the whole journey — just the delta.

**Tier 3 stubs** — minimal format:

```markdown
# J[N]: [Journey Title] [TIER 3 — VISION STUB]

**Journey ID:** J-0NN
**Persona:** [Which persona — Tier 3]
**Tier:** 3 — Vision (cannot be built without major platform additions)
**Priority:** [Critical/High when the platform reaches this stage]

## Why This Journey Matters

[2-3 sentences on what user goal this journey serves and why it matters
for the long-term product vision.]

## What This Journey Would Look Like

[Brief narrative — not Gherkin scenarios — describing the journey in plain
language. 3-5 sentences. Give the PM a picture of what it would feel like.]

## Platform Capabilities Required

| Capability | Current state | What needs to exist |
|-----------|---------------|---------------------|
| [e.g., Manager auth role] | Doesn't exist | New user role with delegated access to multiple owner accounts |
| [e.g., Cross-account analytics] | Per-location only | Aggregate queries across accounts owned by different users |

## Estimated Platform Complexity

[S/M/L/XL — and a 1-sentence rationale. This helps the PM understand the
investment required to unlock this journey.]

## Journey Scenarios (Placeholder)

> These scenarios will be filled in after the required capabilities are built.
> For planning purposes, the journey has approximately N major steps covering:
> - [Step type 1]
> - [Step type 2]
> - [Step type N]
```

---

### Phase 6F: Update JOURNEY_INDEX.md

After building all approved journeys, update (or create) `docs/specs/journeys/JOURNEY_INDEX.md`
with a tier column and a new summary section:

```markdown
# Journey Index

**Last synced:** [date]
**Method:** Mode 6 Tiered Auto-Discovery
**Personas:** [count] ([Tier 1 count] Platform-Native, [Tier 2 count] Near-Future, [Tier 3 count] Vision)
**Journeys:** [count] ([Tier 1 count] full, [Tier 2 count] with enhanced path, [Tier 3 count] stubs)
**AC coverage:** [X]% of total ACs referenced by at least one journey

## Journeys

| ID | Title | Persona | Tier | Priority | Features | AC refs |
|----|-------|---------|------|----------|----------|---------|
| J01 | [title] | P1 | 1 | Critical | 4 | 12 |
| J02 | [title] | P4 | 2 | High | 3 | 8 |
| J07 | [title] [STUB] | P7 | 3 | Vision | — | 0 |

## Tier 2 Enhancement Summary

Journeys that improve meaningfully with small additions:

| Journey | What changes | Backlog items | Combined effort |
|---------|-------------|--------------|-----------------|
| [J-ID] [title] | [what changes in 1 sentence] | [#N, #N] | [S/M] |

## Pending (Tier 3 stubs — vision-phase journeys)

| Journey | Key capability needed | Estimated complexity |
|---------|----------------------|---------------------|
| [J-ID] [title] | [1 capability] | [L/XL] |

## Next Steps

- [ ] Run `/write-e2e` on Tier 1 journeys to generate E2E test skeletons
- [ ] Implement Tier 2 backlog items and update enhanced paths to `[LIVE]` status
- [ ] Re-run Mode 6 after major platform additions to promote Tier 3 stubs
```
