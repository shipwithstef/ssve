---
name: write-journeys
version: "1.0"
description: >
  Generate BDD journey docs (.feature.md) with Gherkin scenarios and AC traceability.
  Nine modes: create, expand, sync, audit, bootstrap, tiered auto-discovery,
  regression refresh, chrome auto-discovery, and capability auto-scaffolding.
  Use when: "generate journeys", "journey sync", "define user flows",
  "journey coverage", "tiered journeys", "discover journeys",
  "auto-discover chrome", "write-journeys --capability", or when feature specs
  exist but no docs/specs/journeys/ found.
phases:
  - { id: P1-InputAudit, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-ScenarioGeneration, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P3-Traceability, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P4-JourneyIndex, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
  optional:
    - { path: "docs/specs/journeys/J*.feature.md", artifact: existing-journeys }
outputs:
  produces:
    - { path: "docs/specs/journeys/J*-<name>.feature.md", artifact: journey-docs }
    - { path: "docs/specs/journeys/Chrome-*.feature.md", artifact: chrome-journey-docs }
    - { path: "docs/specs/journeys/J-CAP-*.feature.md", artifact: capability-journey-docs }
    - { path: "docs/specs/journeys/JOURNEY_INDEX.md", artifact: journey-index }
    - { path: "docs/specs/journeys/SUMMARY.md", artifact: chrome-discovery-summary }
chain:
  lanes:
    greenfield: { position: 9, prev: audit-ac, next: design-ux }
    brownfield-feature: { position: 4, prev: write-spec, next: design-ux }
    drift: { position: 2, prev: sync-spec-code, next: sync-work-items }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Journey Sync

Generate and maintain BDD journey documents that describe how real users move through
the product across multiple features. Journeys are the connective tissue between
capability specs (what the system can do) and E2E tests (proving it works).

**Announce at start:** "I'm using the write-journeys skill to generate journey scenarios."

## Phase Receipt Contract

When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-InputAudit --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ScenarioGeneration --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-Traceability --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-JourneyIndex --evidence file:<path>
```

**The three-layer model:**
- **SDD** (feature specs) — what to build and why → `docs/specs/features/*.md`
- **BDD** (journey docs) — how users behave across features → `docs/specs/journeys/*.feature.md`
- **TDD** (E2E tests) — automated proof it works → `e2e/*.spec.ts` or `test/`

Journey docs use Cucumber's Markdown with Gherkin (MDG) format: standard GitHub-flavored
markdown with Gherkin scenarios embedded using `#` headers for keywords and `-` list items
for steps. Files use the `.feature.md` extension. This renders beautifully on GitHub while
remaining parseable by the Gherkin parser (JS v19.0.0+).

## Persona Trace Contract

For user-facing or admin-facing feature work, every generated or refreshed
journey must preserve concrete persona traceability:

- the journey header names the persona ID/path (`P2`, `docs/specs/personas/P2.md`);
- each scenario is assigned to a persona path or explicitly marked
  `N/A - system-only`;
- Layer 3 findings say which persona is harmed by a missing transition,
  confusing state, or uncovered AC;
- `JOURNEY_INDEX.md` keeps the persona-to-journey table current.

Do not use `customer`, `admin`, `all users`, `PASS`, or `satisfied` as a
standalone persona reference. Those labels are too generic for downstream E2E
and feature validation ledgers.

**What IS a journey:** A multi-step, multi-feature flow a real user takes to accomplish
a goal. "New user signs up, sets up profile, enters matching queue, gets a match, starts
chatting" — that crosses 4+ features.

**What is NOT a journey:** A single-feature interaction like "toggle dark mode" or
"change email address." Those stay as acceptance criteria in their feature spec.

---

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before running any journey mode.

- `bootstrap`: initialize missing journey/spec folders and generate first baseline journeys.
- `convert`: inventory existing flows/tests/docs and map them into journey format before
  introducing new naming or file conventions.

---

## Prerequisites

Journey-sync depends on accurate, up-to-date feature specs. Before running for the
first time (or after significant code changes), ensure:

1. **sync-spec-code** has been run — specs reflect what code actually does
2. **audit-ac** has been run — every user story has complete, testable ACs

Check this automatically at the start of every run:

```bash
# Check when sync skills last ran (look for recent spec changes)
git log --oneline -5 --format="%h %s" -- docs/specs/features/
```

If the last spec-touching commit is NOT from a sync skill, warn the user:
"Feature specs may be stale. Run `/sync-spec-code` then `/audit-ac` first
for best results. Continue anyway?"

---

## Modes

### Mode 1: Bootstrap (first run, no journeys exist)

Triggered when `docs/specs/journeys/` doesn't exist or is empty.
This is the big initial generation. Works in iterations to avoid overwhelming the user.

### Mode 2: Expand (journeys exist, add more)

Triggered when journeys exist but coverage is incomplete.
Adds new journeys for uncovered personas or feature combinations.

### Mode 3: Refresh (journeys exist, check for drift)

Triggered when the user says "sync journeys" or "are journeys up to date?"
Compares journey AC references against current feature specs. Flags broken refs,
new ACs not covered by any journey, and stale scenarios.

### Mode 4: Migrate (old test runbooks exist)

Triggered when `MANUAL_TEST_RUNBOOK_*.md` or similar legacy journey docs are detected.
Extracts useful flows from legacy docs, generates proper journey files, and archives
the originals.

### Mode 5: Auto (full codebase, no stopping)

Triggered when the user says "auto", "full sync", "do everything", "cover all journeys",
or passes `--auto` as an argument. Also triggered when the user explicitly asks to not
be interrupted.

In auto mode, the skill runs the ENTIRE pipeline without pausing for user confirmation:

1. Read ALL feature specs (not just the ones for one journey)
2. Identify ALL personas from the full spec set
3. Generate ALL critical journeys (J01-J03)
4. Run three-layer analysis on each
5. Generate all expansion journeys until every persona has at least one journey
   and every feature spec with user-facing ACs is referenced by at least one journey
6. Run coverage analysis
7. Migrate legacy docs if found
8. Write the full JOURNEY_INDEX.md
9. Present the complete result to the user for review ONCE at the end

Auto mode does NOT skip any quality steps. It still reads specs deeply, still writes
in user language, still runs Layer 3 reasoning. The only difference: it doesn't pause
between iterations to ask the user. It makes its own decisions about which journeys
to generate next based on coverage gaps.

**Completion criteria for auto mode:**
- Every persona has at least 1 journey
- Every feature spec with user-facing ACs (not infrastructure-only specs) is
  referenced by at least 1 journey
- All 3 critical journeys exist (activation, core loop, conversion)
- Layer 3 analysis run on every journey
- Coverage report produced
- JOURNEY_INDEX.md written

Auto mode outputs a summary at the end:
```
JOURNEY SYNC COMPLETE (auto mode)
═══════════════════════════════════════
Personas identified: N
Journeys generated: N
  - Critical: N
  - Expansion: N
AC coverage: X% (N of M total ACs referenced)
Layer 3 findings: N issues, N gaps, N missing transitions
Legacy docs migrated: N (archived: N)
═══════════════════════════════════════
Review the journeys at docs/specs/journeys/
```

### Mode 6: Tiered Auto-Discovery (proposal gate, new product or full reset)

Triggered when the user says "tiered journeys", "discover journeys", "classify journeys",
"journey tiers", "full journey discovery", "journeys from personas", or is starting
fresh on a product that already has persona files and feature specs but no journeys yet.

Mirrors the structure of build-personas Mode 7: reads specs deeply, proposes a
classified journey set (Tier 1/2/3) for the user to approve BEFORE writing a single
journey file, then builds only what was approved. Tier 2 journeys show both the
current path (what works today) and the enhanced path (what becomes possible with
1-3 backlog additions). Tier 3 journeys become stub files only.

### Mode 7: Regression Refresh

Triggered when the repo is brownfield and the problem is not "we need more journeys"
but "a known journey is now broken or changed."

Use this mode when:
- a work item is typed `regression`
- journey-based QA found a broken flow
- shipped behavior changed and the journey contract needs to be refreshed
- verify-promotion reports milestone completion, no active WIs, existing
  journeys, changed shipped behavior, and a roadmap/readiness handoff

Mode 7 does not generate a full new journey set. It:

1. finds the affected existing journeys
2. identifies the broken or changed steps
3. records the expected path vs actual path
4. updates the journey or writes a work-item note for follow-up

This keeps regression work in the correction lane instead of treating it like greenfield authoring.

This mode is the right starting point for new products, major product pivots, or any
situation where you want a complete discovery pass rather than incremental additions.
See [references/mode-6.md](references/mode-6.md) for the full Mode 6 instructions.

### Mode 8: Chrome Auto-Discovery

Triggered when the user says "auto-discover chrome", "chrome journey coverage",
"discover chrome controls", or passes `--auto-discover-chrome`.

This mode scans rendered app chrome backward from code instead of reading feature specs
forward. It catches interactive controls rooted in layout, header, sidebar, shell, and
navigation components that may never appear in a feature spec.

Run the deterministic helper:

```bash
node skills/write-journeys/scripts/auto-discover-chrome.mjs --root .
```

The helper:

1. Scans `src/**/*.{jsx,tsx,vue,svelte}` files whose names match chrome surfaces
   (`Layout`, `Header`, `Sidebar`, `Nav`, `Chrome`, `Shell`, `Menu`).
2. Detects interactive roots: `<button>`, `<Select>`, `<Sheet>`, `<DropdownMenu>`,
   `<Drawer>`, `<a href>`, `<Link>`, and `<NavLink>`.
3. Extracts role, visible label, surface, and file:line source.
4. Cross-references existing `docs/specs/journeys/*.feature.md` for
   `@chrome-control:<id>` traces.
5. Emits one idempotent `docs/specs/journeys/Chrome-<role>-<surface>-<label>.feature.md`
   skeleton per uncovered control.
6. Writes `docs/specs/journeys/SUMMARY.md` with a file:line row for every control found.

Skeletons are intentionally minimal. After generation, refine product-specific assertions
for the control. Default assertions cover "open/change/navigate, then app remains
interactive" so the body-lock / inert-state bug class is represented immediately.

### Mode 9: Capability Auto-Scaffolding

Triggered when `catalog-domain-capabilities` finds recognized table-stakes
capabilities in `docs/specs/capability-catalog.data.json`, or when the user
passes `--capability <name>`.

Run the deterministic helper:

```bash
node skills/write-journeys/scripts/capability-journeys.mjs --root . --capability <name>
```

The helper:

1. Reads `docs/specs/capability-catalog.data.json`.
2. Matches the initial table-stakes set: `multi-language`, `theme-switching`,
   `auth-state-recovery`, `multi-locale-payments`, and `accessibility`.
3. Checks implementation-pattern evidence in `src/` before generating, so a
   catalog row alone does not false-fire.
4. Emits idempotent `docs/specs/journeys/J-CAP-<capability>.feature.md` files.
5. Covers the standard role and surface matrix: customer mobile, customer
   desktop, owner mobile, and owner desktop.

---

## Phase 1: Deep Project Analysis

This is the most important phase. You MUST deeply understand the product before
generating a single journey. Shallow reading produces generic, disconnected output.

### 1a. Read ALL feature specs — FULLY, not just headers

```bash
ls docs/specs/features/*.md 2>/dev/null
```

For EACH spec relevant to the journey being generated, READ THE ENTIRE SPEC. Not
just the headings — the full AC tables, the UI descriptions, the user stories, the
error states, the edge cases. You need to know:

- **What the user sees on each screen** — UI components, labels, states
- **What choices the user has** — buttons, options, flows, branches
- **What happens when they choose** — success states, error states, edge cases
- **What the AC says should happen** — the exact behavior, not a summary
- **How features connect** — when one feature hands off to another, what's the
  transition? What does the user see during the handoff?

The journey will be WRONG if you summarize ACs instead of reading them. A scenario
like "Then my profile shows as complete" is useless. The spec says exactly what
"complete" means — which fields, which validation, which visual indicator. Use that.

### 1b. Map the journey BEFORE writing it

After reading specs, create a written outline of the journey:

```
JOURNEY MAP: [title]
Step 1: User is on [screen]. They see [what]. They choose [action] because [motivation].
Step 2: System responds with [what]. User now sees [screen/state].
Step 3: User decides [choice] because [goal]. If [alternative], then [branch].
...
```

This map is your draft. It forces you to think through the COMPLETE experience
before writing Gherkin. If you can't describe what the user sees at every step,
you haven't read the specs deeply enough. Go back and read more.

### 1c. Read existing E2E tests for real flow evidence

```bash
ls e2e/*.spec.ts test/e2e/*.spec.ts web/e2e/*.spec.ts 2>/dev/null
```

E2E tests encode REAL flows — actual selectors, actual navigation, actual assertions.
Read the test bodies (not just names) to understand:
- What screens actually exist
- What the real navigation flow is
- What assertions are made (these are the real "Then" steps)
- Where tests use workarounds (reveals gaps in the product)

### 1c. Read existing journeys (Mode 2/3)

```bash
ls docs/specs/journeys/*.feature.md 2>/dev/null
```

### 1d. Read legacy docs (Mode 4)

```bash
ls docs/testing/MANUAL_TEST_RUNBOOK_*.md 2>/dev/null
```

Extract user flows described in legacy docs. These are proto-journeys — the flows
are valuable even if the format is wrong.

### 1e. Read spec index

```bash
cat docs/specs/INDEX.md 2>/dev/null
```

The index often has a feature dependency map or coverage matrix.

### 1f. Build the feature graph

From what you've read, build a mental model of:
- Which features reference each other (shared AC IDs, shared user stories)
- Which E2E tests cross feature boundaries
- Which features are entry points (onboarding, landing) vs mid-flow vs terminal
- What user types exist (look for persona references in specs, entity types, role systems)

Output a summary: "Here's what I understand about this project's feature graph..."

---

## Phase 2: Load Personas (from build-personas)

Personas are NOT built by write-journeys. They come from the `build-personas` skill
which produces rich, structured persona files in `docs/specs/personas/`.

### Step 1: Check for persona files

```bash
ls docs/specs/personas/P*.md 2>/dev/null
```

**If personas exist:** Read all persona files. Each one contains:
- Who they are (portrait, not user story)
- Their 2026 world (what they've tried, what failed, their skepticism)
- What they came for (success/failure by timeframe)
- Patience budget (friction tolerance, deal-breakers)
- Trust triggers (what earns/loses trust at each journey stage)
- Feature touchpoints (which specs matter to them)
- Skill implications (specific guidance for write-journeys)

Use the **Skill Implications > write-journeys** section directly — it tells you
what this persona's journey should emphasize and what alternative paths matter.

Use the **Trust Triggers** table to inform Layer 3 analysis — at each journey step,
check: "Is this step earning or losing trust for this persona?"

Use the **Patience Budget** to identify where the journey needs to be faster or
where adding steps would cause this persona to bounce.

**If personas DON'T exist:** Warn the user:
"No persona files found at docs/specs/personas/. Run `/build-personas` first
to create structured personas. Without them, journeys will be generic and won't
capture different user types' experiences. Continue with basic persona extraction
from specs?" If the user says yes, fall back to extracting basic persona info
from feature specs (name, entry point, features touched) — but flag that these
are shallow and should be replaced by proper build-personas output.

### Step 2: Map personas to journeys

For each persona, identify which journey archetype they need:
- **Activation journey** — how THIS persona goes from signup to first value
- **Core loop** — what THIS persona does repeatedly
- **Conversion** — what makes THIS persona upgrade/commit

Different personas may share a journey (e.g., all personas go through onboarding)
but experience it differently. The persona's skepticism profile and patience budget
determine which alternative paths and which Layer 3 findings matter most.

### Step 3: Persona-aware scenario writing

When writing scenarios, always know WHICH persona you're writing for. Reference
the persona's context at each step:

- A cautious first-timer at the matching step needs to see safety signals
- An eager apprentice at the same step is excited and needs momentum
- A skill holder at that step is evaluating quality of potential partners

The same feature step feels different to different personas. The journey should
capture this through alternative paths and Layer 3 annotations.

---

## Phase 3: Generate Journeys (Iterative)

Work in batches. Each iteration generates 2-3 journeys, gets user approval,
then continues. This prevents overwhelming the user and allows course correction.

### Iteration 1: Critical journeys

Start with the journeys that matter most:
1. **New user activation** — signup to first value moment
2. **Core loop** — the thing users do most often (daily session)
3. **Conversion/upgrade** — free to paid, or equivalent

These are almost always the right starting three. Adjust based on the project.

### Iteration 2+: Expand by persona and coverage

For each subsequent iteration:
1. Check which personas have no journeys yet
2. Check which feature specs have ACs not referenced by any journey
3. Check which E2E tests don't map to a journey
4. Propose the next 2-3 journeys based on gaps

### Journey numbering

Use sequential IDs: J01, J02, J03...
File names: `J01-descriptive-name.feature.md`

### Journey document format

Journeys must be ABSOLUTE. Every step describes:
- What the user **sees** (specific screen, specific UI elements, specific labels)
- What the user **decides** and **why** (their motivation, their goal)
- What **happens** as a result (system response, screen transition, feedback)
- What could go **wrong** (error states, edge cases, alternative paths)

A good journey reads like a screenplay. A bad journey reads like a checklist.

**BAD scenario (too abstract):**
```
- When I click "Find Match"
- Then I see a loading state
- And I get a match
```

**GOOD scenario (absolute):**
```
- When I click the "Find Match" button (primary CTA, visible without scrolling)
- Then the button enters a spinner state for up to 5 seconds while instant matching runs
- And if a compatible partner is found, I see a "Match found!" celebration with their
  display name, avatar, and compatibility score (e.g., "87% match")
- But if no instant match is found, the button changes to "Searching..." (disabled)
  and a message reads "Looking for your match — we'll notify you when one is found"
- And I receive a push notification when matched (showing partner name + score)
```

Each journey doc follows this structure:

```markdown
# JXX: [Journey Title]

**Journey ID:** J-XXX
**Persona:** [Which persona this journey serves]
**Covers:** [comma-separated feature spec names]
**Priority:** Critical | High | Medium | Low

## Why This Journey Matters

[2-3 sentences from PM perspective. Why does this flow exist? What user
goal does it serve? What's the cost if this journey is broken?]

## User Motivation

[What brought this user here? What's their emotional state? What do they
want to accomplish? This grounds every "When" step in WHY the user acts.]

## Behavior Specification

# Feature: [Journey title as Gherkin Feature]

  [Journey description — the full narrative arc in 2-3 sentences]

  # Background:
  - Given [specific precondition with detail]

  `@AC-ID-1` `@AC-ID-2` `@AC-ID-3`
  # Scenario: [Descriptive name of this phase]
  - Given [specific context — what screen, what state, what the user sees]
  - When [specific user action — what they click/type, and WHY they do it]
  - Then [specific system response — what changes on screen, what feedback]
  - And [specific detail — labels, counts, visual indicators, timing]
  - But [alternative path — what happens if something differs]

  `@AC-ID-4` `@AC-ID-5`
  # Scenario: [Next phase — continues from where the previous ended]
  - Given [state carried from previous scenario]
  - When [next user action with motivation]
  - Then [specific outcome with UI detail]

## Alternative Paths

Describe what happens when the user takes a different path:
- **[Branch name]:** [What triggers it, what the user sees, where it leads]
- **[Error case]:** [What goes wrong, what feedback the user gets, recovery path]

## E2E Coverage

- `test-file.spec.ts` — [specific test name and what it verifies]

## Coverage Gaps

- [ ] AC `@ID` ([feature]) — [what's missing and why it matters]
```

### AC reference syntax

AC IDs use backtick-wrapped Gherkin tags on the line above each scenario:

```
`@MT-26` `@MT-30` `@CH-01`
# Scenario: Enter queue and get matched
```

This is:
- Parseable by the MDG Gherkin parser (tags)
- Grep-able: `grep -r '@MT-26' docs/specs/journeys/`
- Readable on GitHub (rendered as inline code)

### Writing good scenarios

**The PM test:** Every scenario must be readable by a PM who has never opened the
codebase. If the scenario mentions a file name, database column, CSS class, component
name, or API endpoint, it is WRONG. Rewrite it in user language.

**NO technical references in scenarios:**
- NO file names (`AuthModal.tsx`, `CollabPage`)
- NO database columns (`profiles.onboarding_completed`, `profile_completed_at`)
- NO CSS selectors (`[data-tour="profile"]`)
- NO implementation details (`Supabase Realtime`, `localStorage`)
- NO code paths (`/auth/callback`, `/collab/:matchId`)

**AC IDs are the ONLY technical element.** They appear as tags above scenarios for
traceability. Everything else is written from the user's perspective.

**BAD (technical):**
```
- Then `profiles.onboarding_completed` is set to true in the database
- And `localStorage.cvf_onboarding_skipped` is set to 'true'
- And the CollabPage at /collab/:matchId loads with the right sidebar
```

**GOOD (user language):**
```
- Then the platform remembers I completed the tour so I won't see it again
- And the tour is marked as skipped so it can be shown again later if I want
- And I see the collaboration workspace with my partner's profile on the right
```

Scenarios describe BEHAVIOR, not implementation:
- GOOD: "When I click Find Match" (what the user does)
- BAD: "When the matchmaking queue RPC is invoked" (implementation)

Keep scenarios at 3-7 steps. If longer, split into multiple scenarios
within the same journey.

### What BDD scenarios MUST capture

Each scenario is a complete picture of the user's experience at that moment:
- **What the user sees** — screens, buttons, labels, indicators (in plain language)
- **What the user decides** and **why** — their goal, their motivation
- **What happens** as a result — transitions, feedback, confirmations
- **Alternative user paths** — what happens when the user chooses differently (e.g., skip tour, cancel auth, no match found)
- **Timing and feel** — how long things take, what loading states look like

### What BDD scenarios must NOT include

- **Emotional narration** — "I'm excited but nervous" is UX research, not BDD. Describe behaviors, not feelings.
- **Infrastructure failures** — "server is down", "internet drops", "GitHub is unavailable" belong in ops runbooks, not journeys.
- **Implementation details** — no file names, database columns, CSS classes, API endpoints.
- **Technical architecture** — "Supabase Realtime delivers in 200ms" becomes "my partner receives it almost instantly."

**The test:** Can this scenario step be verified by watching someone use the app?
If yes, it belongs. If it requires reading server logs or checking database state, it doesn't.

---

## Phase 3.5: Three-Layer Journey Analysis

Every journey must be analyzed through three lenses. Present each layer clearly
in the journey doc so the PM can see reality, intent, and gaps at a glance.

### Layer 1: What IS (spec-driven baseline)

Map the journey from existing feature specs. Every scenario step must trace to
a real AC ID. If the spec says it, include it. If the spec doesn't mention it,
don't invent it. This is the faithful reflection of the documented product.

Mark each scenario with its source: `[SPEC: feature-name]` so it's clear
which spec drives that behavior.

### Layer 2: What SHOULD BE (spec-ideal, implementation uncertain)

Some ACs in the spec may describe planned or partially built features. Flag these
honestly. The journey should include them (they're the intended experience) but
mark them so the PM knows what's aspirational vs confirmed:

- `[LIVE]` — this behavior is confirmed working (has passing E2E test or QA check)
- `[SPEC]` — the spec describes this, but no test confirms it's built
- `[PLANNED]` — the spec explicitly marks this as Phase 2/3/future

This prevents the journey from lying. A PM reading a `[SPEC]` step knows:
"This is what we designed but I should verify it actually works."

### Layer 3: What's MISSING + What's WRONG (journey reasoning)

This is the most valuable layer and where the skill earns its existence.
Dimensions 1 and 2 are translation work. Dimension 3 is independent reasoning
about the journey as a complete system.

**Why this matters:** Individual feature specs can each be perfect and the
journey can still be broken. Problems only visible when you look at the
end-to-end flow: contradictions between specs, missing transitions, persona
mismatches, wrong sequencing. No single spec reveals these.

The skill looks at the whole journey and finds:

**Logical contradictions:**
"The journey assumes GitHub auth but this persona is an expert who uses
Google auth. The journey breaks at step 1."

**Sequencing problems:**
"Step 4 depends on data from step 2 but no spec describes how that data
persists across the transition between features."

**Persona mismatches:**
"This step was designed for power users but appears in the new user journey.
A newcomer wouldn't understand '7D compatibility score' without context."

**Missing transitions:**
"The user goes from matching to the collab workspace but nothing in any spec
describes what that transition looks like. Is it a redirect? A modal? Nobody
defined this seam between features."

**Wrong placement:**
"The spec puts the credit explanation modal before first match. For a new
user at this moment in the journey, that's friction at the worst time.
They're excited about matching, not ready to think about billing."

**Redundancies:**
"The onboarding tour explains matching on step 3. Then the matching screen
explains matching again. The user sees the same concept explained twice."

**Concept fragmentation (duplicate features under different names):**
When the codebase has two components, two names, or two flows that operate
on the same underlying entity or serve the same user goal, that's concept
fragmentation — and it's a sign the product doesn't understand its own
feature. The skill must catch this by checking:

1. **Entity-level dedup**: If two different UI components both create/read
   the same entity type, they're the same feature split across two names.
   Flag it: "Component A creates EntityX. Component B also creates EntityX.
   These are the same product concept with two names — consolidate."

2. **Industry pattern recognition**: When a journey involves a common
   product pattern, name the pattern and check completeness against
   industry standard. Common multi-role patterns:

   | Pattern | Producer side | Consumer side | System side |
   |---------|-------------|--------------|-------------|
   | Flash deals / time-limited offers | Seller creates deal (UI + validation + plan gating) | Buyer browses, claims (limit checks, confirmation) | Notifications to nearby/subscribed users, expiry cleanup |
   | Referral programs | Referrer shares link (tracking, custom message) | Referee signs up (attribution, reward trigger) | Double-sided reward disbursement, fraud detection |
   | Booking / reservations | Provider sets availability (calendar, capacity) | Customer books slot (confirmation, reminders) | No-show handling, waitlist promotion |
   | Reviews / ratings | Customer writes review (after purchase gate) | Business owner responds (moderation) | Aggregate score computation, display |
   | Loyalty / points | System awards on purchase (earning rules) | Customer redeems (balance check, reward catalog) | Tier progression, expiry, rollover |
   | Content publishing | Creator publishes (draft → review → live) | Audience discovers (feed, search, recommendations) | Moderation, analytics, notifications |
   | Marketplace listings | Seller lists item (pricing, photos, description) | Buyer searches, purchases (cart, checkout) | Search indexing, commission, fulfillment |

   For each pattern, check: does the product have ALL three sides covered
   by journeys? If the consumer journey exists but the producer journey
   doesn't, that's an ungrounded precondition. If both exist but the system
   side (notifications, cleanup, fraud) isn't covered, that's a gap.

3. **Naming alignment**: If the codebase uses one name ("FlashSlot")
   but a component uses a different user-facing name ("Last Hour Offer")
   for the same entity, flag the mismatch. The product should have ONE
   name per concept. Different names create confusion in specs, journeys,
   UI copy, and analytics. Recommend: pick the name that matches the
   industry pattern (e.g., "flash deal") or the entity name, and rename
   the outlier.

4. **Full persona lifecycle mapping**: For every entity the journey
   touches, list EVERY persona that interacts with it and HOW:

   ```
   Entity: FlashDeal
   ├── Seller: creates (dashboard shortcut + full form)
   ├── Customer: browses, claims (discovery page)
   ├── System: validates limits, sends notifications, expires
   └── Admin: monitors abuse, overrides limits
   ```

   If any persona's interaction is missing a journey, flag it. If any
   persona's interaction exists in code but has no journey, flag that too.
   The goal is complete lifecycle coverage — inception to consumption to
   cleanup, across all roles.

**Dead ends:**
"If no match is found and the 24-hour queue expires, what happens? No spec
describes the queue-expired state. The user sees... nothing?"

**Missing user expectations:**
"After completing the wizard, there's no confirmation. The user selected
preferences across 7 dimensions and gets no summary of what they chose."

**Ungrounded preconditions (supply-side gaps):**
This is the check most likely to catch critical product gaps that no other
analysis finds. Many features are two-sided: one role produces data, another
role consumes it. A journey that only covers the consumer side looks complete
in isolation but hides a product gap — there's no way for the supply side
to actually create what the journey assumes exists.

For every Background precondition and every "Given" that assumes data exists,
ask: **"Who creates this data, and does a journey cover that creation flow?"**

Examples of what this catches:

"The customer claim journey assumes flash deals exist, but no seller journey
covers creating them. The claim page works perfectly — but there's no
validated path for sellers to actually post deals. The only UI that creates
them bypasses validation and plan limits."

"The customer journey assumes a loyalty balance > 0. The admin setup journey
covers configuring the program, but no journey covers the actual earning
transaction — how points get credited after a purchase. Points appear from
nowhere in the consumer journey."

"The discovery journey filters by an accessibility flag on listings. But no
seller journey covers setting that flag — and the flag doesn't even appear
in the listing edit form. The filter will always return zero results."

"The reporting dashboard assumes managers have assigned tasks to team members.
But the task assignment UI requires a permission that only admins have. The
manager journey silently assumes data that managers can't actually produce."

**How to check — the full producer-to-consumer pipeline:**

For each precondition in the Background section, trace the COMPLETE path
from inception to consumption:

1. **Entity/state assumed** — what data must exist? (e.g., "a flash deal")
2. **Producing role** — which user role creates it? (e.g., "sellers")
3. **UI to produce it** — does a page/form/button exist for that role to
   create the data? Is the field actually exposed in the form? Is the
   button wired to the right backend call?
4. **Validation/security** — does the creation path go through the same
   validation pipeline that the consumer side expects? (e.g., plan limits,
   permissions, required fields) A shortcut that bypasses validation is a
   gap even if the UI exists.
5. **Side effects** — does creating the data trigger expected downstream
   effects? (e.g., notifications to consumers, cache invalidation, status
   updates) If the consumer journey assumes "sellers are notified when a
   buyer claims," check that the notification actually fires on that path.
6. **Journey coverage** — does any journey for the producing role include
   a scenario covering this creation flow end-to-end?
7. **Discoverability** — can the producing role actually FIND the UI?
   A button buried in a submenu that no journey mentions is functionally
   invisible.

Report the gap at whichever step the chain breaks: missing UI, missing
validation, missing side effects, missing journey, or missing discoverability.

This is especially important for multi-role products (seller/buyer,
admin/employee/customer, creator/viewer, host/guest) where every
consumer-side feature has an implicit dependency on a producer-side flow
that may never have been specced or tested. The gap is invisible when you
look at each role's journeys in isolation — it only appears when you trace
data flow across roles.

Present ALL findings in a `## Journey Analysis` section:

```markdown
## Journey Analysis

### Logical Issues

| ID | Type | Where | Finding | Impact |
|----|------|-------|---------|--------|
| F1 | Contradiction | Step 1 → Step 2 | Expert persona can't use GitHub auth but journey assumes it | Journey breaks for P2 |
| F2 | Dead end | After queue expires | No spec for what user sees when 24h expires with no match | User sees nothing, churns |
| F3 | Wrong placement | Before first match | Credit explanation interrupts excitement momentum | Increases bounce at key moment |

### Ungrounded Preconditions

| Precondition | Producer role | Producer journey | UI exists? | Validation intact? | Impact |
|-------------|--------------|------------------|:---:|:---:|--------|
| "a seller has posted a flash deal" | Seller | NONE | Partial — button exists but bypasses plan limits | NO — skips security middleware | Consumer page works but producer path is unvalidated and ungated |
| "3 listings flagged as accessible" | Seller | NONE — daily ops journey doesn't mention this field | Unknown — check if edit form exposes the flag | N/A | Filter may always return zero results |
| "buyer has a loyalty balance > 0" | System (on purchase) | PARTIAL — setup journey exists but no earning scenario | Yes — purchase recording exists | Yes | Consumer can't redeem because no journey tests the earning path |

### Missing Transitions

| From | To | What's undefined |
|------|----|-----------------|
| Matching screen | Collab workspace | No spec describes this transition |
| Tour completion | Profile wizard | Spec says "prompted" but no UI defined |

### Product Gaps

| Gap | Where | What user expects | Why it matters |
|-----|-------|-------------------|----------------|
| G1 | After wizard | Summary of selections | Confirmation reduces anxiety |
| G2 | After matching | WHY we matched | Trust in the algorithm |
```

**Rules for Layer 3:**
- Reason about the journey as a system, not individual specs
- Flag problems that only appear when you look end-to-end
- Each finding must be specific: where in the journey, what's wrong, why it matters
- Connect findings to the persona's context at THAT moment
- Don't flag technical debt or architecture issues — only user-facing problems
- Don't flag deliberate design choices (dark mode only = intentional, not a gap)
- Separate "definitely wrong" (contradictions, dead ends) from "worth considering"
  (sequencing suggestions, gap opportunities)
- These are findings for the PM to evaluate, not demands to implement

### Routing Layer 3 findings to other skills

Layer 3 findings are not just documentation — they're actionable inputs for
other skills. After presenting findings, recommend the right next step based
on what was found:

| Finding type | Route to | Why |
|-------------|----------|-----|
| Ungrounded precondition (no producer journey, no UI) | `/validate-feature` | The missing producer side is a product gap that needs business validation before building. Feature-discovery determines if it's a real need, a pipeline fix, or concept fragmentation. |
| Ungrounded precondition (UI exists, bypasses validation) | `plan-changeset` (or `/writing-plans` if external add-on) | The feature exists but the pipeline is broken. This is a fix, not a new feature — go straight to planning. |
| Concept fragmentation (two names, one entity) | `/validate-feature` | Feature-discovery resolves naming, identifies the industry pattern, and produces a consolidated brief. |
| Missing persona (journey needs a user type with no persona file) | `/build-personas` | Can't write a proper journey without understanding who the user is. |
| Missing transition (gap between two features) | `/audit-ac` | The transition needs ACs before it can be journeyed. |

Don't just list findings and move on. The whole point of Layer 3 is to
surface problems that need action — route them to the skill that acts on them.

### When validate-feature routes BACK to write-journeys

Feature-discovery may route back here when it produces a brief for a feature
that needs journey coverage. When that happens, the brief becomes input to
the journey — read it for the business context, the persona mapping, and
the MVP scope. The brief's "Who / Problem" section directly informs the
journey's User Motivation. The brief's "Explicit Non-Scope" prevents the
journey from over-covering.

### Iteration flow with three layers

When presenting a journey to the PM:
1. First show the journey (Layers 1+2 woven together with status tags)
2. Then show the product gaps (Layer 3) as a separate section
3. Show the recommended skill routes for each finding type
4. Ask: "Which of these gaps should become real specs?"
5. If the PM approves gaps, create placeholder ACs in the relevant feature spec
   (with `[PLANNED]` status) and reference them in the journey

---

## Phase 4: Coverage Analysis

After generating journeys, produce a coverage report:

### AC Coverage Matrix

For each feature spec, list:
- Total AC count
- ACs referenced by at least one journey
- ACs NOT referenced by any journey (gaps)
- ACs with E2E test coverage
- ACs with journey reference but no E2E test (needs test)

```
JOURNEY COVERAGE REPORT
═══════════════════════════════════════════════════
Feature                | Total ACs | In Journeys | Gaps
-----------------------|-----------|-------------|------
feature-matching.md         | 43        | 12          | 31
feature-onboarding.md     | 28        | 15          | 13
feature-collab.md  | 35        | 8           | 27
...
═══════════════════════════════════════════════════
```

### E2E Test Mapping

For each E2E test file, show which journey (if any) it validates:
- Tests mapped to a journey: working as expected
- Tests NOT mapped to any journey: either standalone feature tests (fine)
  or cross-feature tests missing a journey doc (gap)

### Cross-Journey Dependency Graph (supply-side validation)

This is the highest-value coverage check. Most product gaps hide here.

For every journey's Background section and Given preconditions, trace backwards:

1. **List every assumed state** — entities that must exist, flags that must be set,
   data that must have been created by someone
2. **Identify the producing role** — which user role creates that data?
3. **Check if a journey covers that production** — does any journey for that role
   include a scenario where they create/set that data?
4. **Check if a UI path exists** — even if no journey covers it, does the codebase
   have a page/component where that role can produce the data?

```
CROSS-JOURNEY DEPENDENCY REPORT
═══════════════════════════════════════════════════════════════════════
Consumer Journey       | Assumes                  | Producer | Producer Journey | UI? | Validation?
-----------------------|--------------------------|----------|-----------------|-----|------------
J07 (buyer claims deal)| flash deal exists         | Seller   | NONE            | Partial | NO — bypasses limits
J12 (filtered search)  | listing.accessible = true | Seller   | NONE            | No  | N/A
J06 (redeem points)    | points balance > 0        | System   | J05 (partial)   | Yes | Yes
J15 (team report)      | tasks assigned to members | Manager  | NONE            | Yes | NO — wrong permission
═══════════════════════════════════════════════════════════════════════
```

**Flag as CRITICAL** any row where both "Producer Journey" and "UI Exists?" are
missing or partial — that means the consumer feature literally cannot work because
there's no way to produce its preconditions.

**Flag as GAP** any row where the UI exists but no journey covers it — the feature
works in practice but is undocumented and untested.

This check catches the class of bugs where individual journeys look complete but
the product has holes: features that consume data nobody can create, entity fields
assumed in filters that no UI exposes, states that Background sections require but
no role can produce.

For multi-role products (owner/employee/customer, seller/buyer, creator/viewer),
run this check systematically: every entity referenced in a consumer journey's
Background should trace back to a producer journey's scenario.

### Missing journey candidates

Identify feature combinations that have no journey but probably should:
- Features that share user stories
- Features connected by navigation flows
- Features that E2E tests exercise together
- **Producer-side flows with no journey** — if the dependency graph above found
  missing producer journeys, these are the top candidates for new journeys

Present as suggestions: "These feature combinations might need journeys..."

---

## Phase 5: Migration (Mode 4)

When legacy journey-like docs exist (manual test runbooks, old flow docs):

1. Read each legacy doc
2. Extract the user flows described
3. Map flows to current feature specs and AC IDs
4. Generate proper journey docs that capture the same flows
5. Archive originals: `mv docs/testing/MANUAL_TEST_RUNBOOK_*.md docs/testing/archive/`

Tell the user what was migrated and what was dropped (outdated flows that
no longer match the current product).

---

## Phase 6: Persist State

After each iteration, save progress to a tracker file so the next session
can pick up where you left off:

```bash
mkdir -p docs/specs/journeys
```

Write `docs/specs/journeys/JOURNEY_INDEX.md`:

```markdown
# Journey Index

**Last synced:** [date]
**Personas:** [count]
**Journeys:** [count]
**AC coverage:** [X]% of total ACs referenced by at least one journey

## Personas

| ID | Name | Description | Journey count |
|----|------|-------------|---------------|
| P1 | [name] | [desc] | [N] |

## Journeys

| ID | Title | Persona | Priority | Features | AC refs | E2E tests |
|----|-------|---------|----------|----------|---------|-----------|
| J01 | [title] | P1 | Critical | 4 | 12 | 3 |

## Next Iteration

- [ ] [What to generate next, based on coverage gaps]
```

Also update `docs/specs/INDEX.md` if it exists — add a Journeys section.

---

## Important Rules

1. **Never generate journeys without reading specs first.** The whole point is
   traceability. Every scenario step must trace to a real AC ID.

2. **Iterate, don't dump (unless auto mode).** In interactive mode: 2-3 journeys per
   iteration, get user approval between iterations. In auto mode: generate all journeys
   without pausing, present the full set at the end for review. The PM still owns the
   narrative — auto mode just defers the review to the end.

3. **Critical first.** New user activation, core loop, conversion. Always
   start with these three. Everything else comes later.

4. **Standalone interactions are NOT journeys.** Theme toggle, password change,
   notification preferences — these are feature-level ACs. Don't force them
   into journeys.

5. **Scenarios describe user behavior, not system internals.** "When I click"
   not "When the API processes." PMs should be able to read every scenario.

6. **Flag, don't fabricate.** If an AC is missing for a step that clearly
   needs one, flag it in the Coverage Gaps section. Don't invent AC IDs.

7. **Legacy migration is opt-in.** Don't delete old docs without explicit
   user approval. Archive, don't destroy.

8. **Journey docs are source of truth for E2E test scope.** The write-e2e
   skill should read journey docs to understand what cross-feature flows to test.
   Make sure journey docs are written clearly enough for an agent to generate
   tests from them.

9. **E2E-ready journeys must pass the bridge validator.** Before handing a journey
   to `write-e2e`, run `node scripts/verify-journey-e2e-bridge.mjs <journey-file>`.
   The validator requires parseable scenarios, AC/chrome/capability trace tags,
   `## E2E Coverage`, specific UI labels or context instead of generic "primary CTA"
   language, and no scenario longer than 7 Given/When/Then steps.

9. **Every Background must be grounded.** When writing a journey's Background or
   Given preconditions that assume data exists (entities created, flags set, states
   reached), trace backwards: who creates that data? Does another journey cover
   that creation? Does the UI even support it? This is the supply-side check.
   A consumer journey with an ungrounded Background is hiding a product gap —
   the feature looks complete on paper but may be impossible to use because nobody
   can produce what it assumes. This is especially critical for multi-role products
   where Role A produces data that Role B consumes. If you write "Given a seller
   has posted a flash deal" and no seller journey covers posting deals, flag it
   in the Journey Analysis as an Ungrounded Precondition. Don't silently assume
   the producer side exists just because the consumer side works.

---

## Mode 6: Tiered Auto-Discovery

See [references/mode-6.md](references/mode-6.md) for full details — the complete
proposal-gated, tiered journey-discovery instructions (Phases 6A–6E, deep read,
proposal gate, tier classification, output templates).

## Audit Mode

When invoked with `--audit` to review existing journeys:

1. Glob `docs/specs/journeys/J*.feature.md`
2. For each journey:
   - Persona referenced exists in `docs/specs/personas/`?
   - ACs referenced exist in the linked feature spec?
   - Layer 3 analysis: any ungrounded preconditions?
   - Background steps: do producer journeys exist for each dependency?
3. Cross-journey check: are there dead-end flows (journey ends but user has no next step)?
4. Report: journey-by-journey PASS/WARN/FAIL

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
| 1 | At least one journey file exists | `ls docs/specs/journeys/J*.feature.md` | |
| 2 | JOURNEY_INDEX.md exists | `test -f docs/specs/journeys/JOURNEY_INDEX.md` | |
| 3 | Layer 3 analysis completed | verify Layer 3 section present in journey output | |
| 4 | E2E bridge validated | `node scripts/verify-journey-e2e-bridge.mjs docs/specs/journeys/*.feature.md` passes for generated E2E-ready journeys | |
| 5 | Journey format validates | `node scripts/validate-journey-format.mjs --root .` passes | |
| 6 | AC/persona coverage validates | `node scripts/verify-journey-coverage.mjs --root .` passes | |

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
- In greenfield lane: `design-ux --progressive --lane greenfield`
- In brownfield-feature lane: `design-ux --progressive --lane brownfield-feature`
- In drift lane: `sync-work-items --progressive --lane drift`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `design-ux`" (greenfield or brownfield-feature), or "`sync-work-items`" (drift)

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

**Boilerplate rationale:** references/phase-receipts.md supersedes duplicate task-graph boilerplate cleanup for journey skills. The duplicated host-specific chaining blocks stay temporarily for host readability; future changes should update the shared phase-receipt/task-graph references first and use validators instead of hand-maintaining divergent journey-skill copies.
