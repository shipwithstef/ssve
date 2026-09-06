# The Serious Vibe Coding Doctrine

> Progressive Deterministic Development — a methodology for reliable agentic software engineering

> A development methodology for the agentic era, grounded in the operational
> limitations of large language models.

## The Problem This Solves

Large language models generate code through pattern matching against training
data. This produces three failure modes that no amount of prompt engineering
eliminates:

1. **Non-determinism.** The same input produces different output on different
   runs. A spec that says "sort matches by compatibility" yields fifty valid
   implementations — different abstractions, different edge case handling,
   different integration patterns. Each one is confidently presented as correct.

2. **Context blindness.** An LLM knows only what is in its context window. If
   the spec is in file A and the code is in file B and the journey is in file C,
   the agent editing file B cannot ensure consistency with A and C unless it has
   read them in the same session. Unlike a human developer who carries months of
   project context in their head, an agent starts every session empty.

3. **Lossy translation.** Each boundary crossing — spec to design, design to
   plan, plan to code — is a probabilistic translation. Information is lost or
   hallucinated at every step. The more boundaries, the more drift. The less
   context at each boundary, the more pattern matching fills the gaps.

Traditional software development assumes the developer IS the context holder.
The developer reads the ticket, remembers the architecture, understands the
codebase, and produces coherent code. When the developer is an LLM, this
assumption breaks. The methodology must compensate.

## The Science

The scientific foundation of why progressive narrowing works, based on LLM
architecture.

### Attention Decay and Drift

LLMs use self-attention to relate every token to every other token in context.
But attention is not uniform — positional encoding biases attention toward
recent tokens. When generating line 400 of a service file, spec tokens loaded
at the beginning of the context receive diminishing attention. The agent follows
code-internal patterns instead of the spec. This is drift.

### Checkpoints as Attention Resets

Each task checkpoint forces a stop. The next task re-reads the spec (fresh,
high attention) and the code so far (fresh, high attention). The positional
bias resets. The spec is never more than one task's worth of tokens from the
generation point.

### The Worktree as External Memory

An LLM has no long-term memory. Its context window IS its entire mind. When a
session ends, everything is gone. The worktree is the agent's external brain —
every artifact from every phase persists on disk, accessible by reading a file.
The worktree guarantees that everything the agent reads is consistent with a
single point in time (the base commit).

### The Entropy Argument

An LLM's output entropy (variance) is bounded by:
`H(output) ≤ H(model) + H(context)`. We cannot control `H(model)`. We CAN
minimize `H(context)` through progressive constraint accumulation. Each phase
eliminates a specific class of uncertainty:

| Phase | Uncertainty Eliminated |
|-------|----------------------|
| Vision | What product? What boundaries? |
| Personas | Who uses it? What do they need? |
| Spec | What features? What acceptance criteria? |
| UX Design | How do users experience it? What states? |
| UI Design | How does it look? What components? |
| Tech Design | How to build it? What architecture? |
| Code | Only remaining: exact syntax |

Sequential narrowing compounds. Six small entropy reductions are more effective
than one large reduction because each phase catches a DIFFERENT CLASS of
uncertainty. A single "detailed ticket" tries to eliminate all uncertainty at
once — it cannot, because the ticket author hasn't resolved UX states,
component design, or data model implications.

### The Completeness Principle

AI-assisted coding makes the marginal cost of completeness near-zero. When
the complete implementation costs minutes more than the shortcut — do the
complete thing.

**Lake vs ocean:** A "lake" is boilable — all error paths, all edge cases,
complete test coverage for a module. An "ocean" is not — rewriting an entire
system, multi-quarter migration. The pipeline boils lakes. It flags oceans
as out of scope.

| Task type | Human team | AI-assisted | Ratio |
|-----------|-----------|-------------|-------|
| Boilerplate | 2 days | 15 min | ~100x |
| Tests | 1 day | 15 min | ~50x |
| Features | 1 week | 30 min | ~30x |
| Bug fix + regression | 4 hours | 15 min | ~20x |
| Architecture | 2 days | 4 hours | ~5x |

When evaluating "approach A (complete, 150 LOC) vs approach B (90%, 80 LOC)"
— prefer A. The 70-line delta costs seconds. Shipping shortcuts is legacy
thinking from when human engineering time was the bottleneck.

This principle complements the scope prohibition in plan-changeset: scope
prohibition prevents REDUCING planned scope; the completeness principle
encourages COMPLETING all planned scope to full depth.

Source: gstack ETHOS.md (Boil the Lake), MIT, Copyright 2025 Garry Tan.

### Review Gates as Adversarial Debiasing

During generation, attention is biased toward producing coherent output
(generation mode). During self-review, attention shifts to finding errors
(evaluation mode). Self-judgment forces a third pattern: evaluating the
evaluation. Cross-review introduces a completely fresh attention state with
no bias from the generation process. Each step creates a different attention
pattern over the same content.

### The Fundamental Claim

For any LLM with fixed model entropy `H(model)`, output reliability is
maximized by minimizing context entropy `H(context)` through sequential
phase-gated constraint accumulation, where each phase: (a) reduces a specific
class of uncertainty, (b) is reviewed before the next phase begins, (c)
persists in a consistent accessible state (the worktree), and (d) is re-loaded
into the attention window at each checkpoint to prevent positional attention
decay.

## Consequential decisions and applicable work

Quality comes from relevant evidence and judgment, not question totals. Apply `_shared/product-question-format.md`: carry current owner authorization and accepted decisions forward; compare relevant current specs, ACs, journeys/personas and actual code/dependencies; expose conflicts and resolve consequential owner choices before dependent work. Retain meaningful alternatives, risk/reversibility, measurable success and useful innovation without forcing competitor counts or decorative UX. Existing signed `decide` and release authority contracts remain controlling.

Load the evidence needed for the task. The installed skill corpus is not the worker's loaded context; measure actual reads separately. Pilot applicability summaries derive from source phase contracts and preserve triggered verification. Use focused existing validator selection during iteration; unknown/global changed inputs retain full fallback and an explicitly requested unmapped surface remains a runner error. Full release validation and truthful failure attribution remain required.

## The Core Principle

**Progressive narrowing eliminates non-determinism.**

### Product-outcome execution invariant (Engine v2)

For a bounded feature slice, the operating target is accepted owner direction
through production release, live verification, rollback readiness, and a
durably scheduled outcome observation in at most **60 active engineering
minutes**. Provider queues and observation windows stay visible on separate
elapsed clocks. A timeout is `NOT_COMPLETE`. If the smallest complete outcome
cannot conservatively fit, the controller re-slices or stops with evidence; it
never weakens quality, reliability, authority, safety, migration, operability,
or rollback proof to manufacture a green clock.

Delivery closure and outcome closure are different states. Delivery closes
only after final-SHA binding, production release, live verification, rollback
readiness, and acknowledged observation scheduling. Outcome closure happens
later, after the metric is observed and the next product decision consumes the
delta.

Owner interaction is one of two explicit modes. `AUTONOMOUS` permits
evidence-backed decisions only inside a signed delegation. `STRATEGIC_QUESTIONS`
uses the localized `decide` adapter only for consequential undelegated choices
or genuine evidence ties; implementation questions remain internal.

Decision nodes apply the protocol order exactly: hard-constraint filter,
evidence weighting, expected product value, value of information, minimax
regret, reversibility, and complete critical-path fit. Quality, reliability,
authority, and safety are hard constraints, never scoreable trade-offs.

Every produced object declares its producer, named consumers, target outcome,
consumption condition, acknowledgement, invalidation inputs, trust/freshness,
idempotency, and retention. `RUNTIME`, `RELEASE`, and `LEARNING` alone are not
product terminals. The same relevant state and causal fingerprint cannot run
again unless the iteration adds resolved evidence, changes relevant state,
resolves an obligation, records an authorized decision, or measurably reduces
uncertainty. The executable normative contract is
`references/product-outcome-improvement-protocol-v2.md`.

Each phase of the pipeline constrains the space of possible outputs for the
next phase. By the time code is written, the implementation is essentially
determined — not by the agent's pattern matching, but by the accumulated
constraints from every prior phase.

```
Phase 1: Vision          → infinite possibilities
Phase 2: Personas        → narrows WHO
Phase 3: Feature Spec    → narrows WHAT (stories, acceptance criteria)
Phase 4: UX Design       → narrows HOW users experience it (flows, states)
Phase 5: UI Design       → narrows HOW it looks (components, visual language)
Phase 6: Technical Design → narrows HOW to build it (architecture, data model)
Phase 7: Change Set      → narrows to ONE reviewed branch outcome
Phase 8: Promotion       → squash-merges the reviewed branch to main
Phase 9: Verification    → proves the promoted result matches the manifest
```

At Phase 1, the agent is generating. By Phase 7, the agent is executing
against a constrained implementation plan. The creative work happens in
Phases 1-6 and in explicit loop-backs when later phases expose defects
upstream. Phase 7 is controlled execution with task reviews and checkpoints.

## Phases and Artifacts

Every phase produces a specific artifact. Every artifact has a lifecycle state.
Every state transition requires a review gate.

### Phase Table

| # | Phase | Skill | Artifact | Format | State Transition |
|---|-------|-------|----------|--------|-----------------|
| 1 | Vision | `write-vision` | `docs/specs/vision.md` | Single file, 12-section canonical structure | — → ACTIVE |
| 1b | Domain Profile | `analyze-domain` | `docs/specs/domain-profile.md` | Industry, stack, conventions, pitfalls | — → ACTIVE |
| 1c | Competitor Analysis | `analyze-competitors` | `docs/specs/analyze-competitors.md` | Up to 20 competitors (4-tier), whitespace, moat scoring, differentiation | — → ACTIVE |
| 2 | Personas | `build-personas` | `docs/specs/personas/P*.md` | One file per persona | — → ACTIVE |
| 3 | Feature Spec | `write-spec` | `docs/specs/features/<name>.md` | One file per feature (Feature/Enabler/Integration) | — → DRAFT |
| 4 | UX Design | `design-ux` | `docs/specs/ux/<name>.md` | Screen flows, states, interactions, information architecture | DRAFT → UX-REVIEWED |
| 5 | UI Design | `design-ui` | `docs/specs/ui/<name>.md` + `docs/specs/design-system.md` | Component specs, visual language, responsive behavior | UX-REVIEWED → DESIGNED |
| 6 | Technical Design | `design-tech` | Updated feature spec: Technical Design section | Architecture, data model, feasibility matrix | DESIGNED → BASELINED |
| 7 | Change Set Planning | `plan-changeset` + `execute-changeset` | `docs/plans/<date>-<name>/` + branch checkpoints | Implementation manifest, task graph, staged diffs, checkpoint commits | BASELINED → CHANGE-SET-APPROVED |
| 8 | Promotion | `land-changeset` | Actual codebase files | Squash merge + manifest/diff validation | CHANGE-SET-APPROVED → PROMOTED |
| 9 | Verification | `verify-promotion` | Updated feature spec: VERIFIED status | Test results, QA status, E2E status | PROMOTED → VERIFIED |

### Artifact Lifecycle

```
Feature Spec States:
  DRAFT               → requirements defined (stories, ACs, journeys)
  UX-REVIEWED         → UX design approved (screen flows, states)
  DESIGNED            → UI design approved (visual, components)
  BASELINED           → technical design approved (architecture, data model)
  CHANGE-SET-APPROVED → implementation executed and reviewed on branch
  PROMOTED            → reviewed branch state squash-merged to main
  VERIFIED            → tests pass, QA complete, E2E complete

  REJECTED            → NO-SHIP: validate-feature killed the feature (3+ kill signals)
  PIVOTED             → alternative direction accepted after NO-SHIP, re-enters as DRAFT
```

Each state transition is gated by the Review Protocol (see below).
REJECTED and PIVOTED are exit/re-entry states from the kill signal gate
in validate-feature. A REJECTED feature has a permanent evidence package.
A PIVOTED feature re-enters the pipeline as DRAFT with a new brief.

### Foundational Artifacts (Project-Level)

These are not per-feature — they are created once and evolved:

| Artifact | Skill | Path | Purpose | Freshness | Consumers |
|----------|-------|------|---------|-----------|-----------|
| Vision | `write-vision` | `docs/specs/vision.md` | Product direction, boundaries, principles | Stable (evolves with product) | All downstream skills |
| Domain Profile | `analyze-domain` | `docs/specs/domain-profile.md` | Industry, tech stack, conventions, pitfalls | Refresh if stack changes | build-personas, validate-feature, write-spec, design-tech, analyze-marketing |
| Competitor Analysis | `analyze-competitors` | `docs/specs/analyze-competitors.md` | Top competitors, whitespace, differentiation | Refresh every 30 days or before major feature bets | validate-feature (kill signals K3), write-spec (scope), analyze-marketing |
| Personas | `build-personas` | `docs/specs/personas/P*.md` | Who uses this product (grounded in domain + competitors) | Refresh when market shifts | validate-feature, write-spec, write-journeys, design-ux |
| Design System | `design-ui` | `docs/specs/design-system.md` | Visual language: tokens, typography, colors, spacing, motion | Stable | design-ui, execute-changeset |
| Journey Index | `write-journeys` | `docs/specs/journeys/JOURNEY_INDEX.md` | Cross-reference of all journeys | Updated per feature | validate-feature, test-journeys |

### Per-Feature Artifacts

Each feature produces these artifacts as it moves through the pipeline:

| Artifact | Created at Phase | Path |
|----------|-----------------|------|
| Feature Spec | 3 (write-spec) | `docs/specs/features/<name>.md` |
| UX Design | 4 (design-ux) | `docs/specs/ux/<name>.md` |
| UI Design | 5 (design-ui) | `docs/specs/ui/<name>.md` |
| Journey Doc(s) | 3 (write-spec triggers write-journeys) | `docs/specs/journeys/J*-<name>.feature.md` |
| Change Set | 7 (plan-changeset + execute-changeset) | `docs/plans/<date>-<name>/` + branch checkpoints |

## Feature Types

Every feature spec carries a Type that identifies its consumer. The type
determines the persona, not the process. All types go through the same pipeline.

| Type | Consumer | Story Format | Journey Type |
|------|----------|-------------|--------------|
| Feature | Human user (persona) | "As P1, I want..." | User journey with UI + system steps |
| Enabler | Other service/feature | "As [service], I need..." | System journey with service interactions |
| Integration | External system boundary | "When [event], system must..." | Contract journey with request/response |

### The Cascade Effect

Specifying a Feature automatically reveals every Enabler and Integration it
depends on. Layer 3 journey analysis flags ungrounded preconditions — system
steps that have no producer. Each ungrounded precondition becomes a new feature
spec (Enabler or Integration). The chain builds top-down until the full system
is specified.

```
User says: "I want match recommendations"
  → Feature: match-discovery (Feature)
    → Layer 3 finds: "scores must be fresh" — no producer
      → Feature: score-recalculation (Enabler)
    → Layer 3 finds: "notification sent to matches" — no producer
      → Feature: notification-service (Enabler)
        → Layer 3 finds: "email delivery" — no producer
          → Feature: email-delivery (Integration)
```

Nothing hand-waved. Nothing deferred. The spec process IS the architecture
discovery tool.

## The Change Set

The change set is the worktree branch itself. Code lives in actual files, not
in markdown documents. The agent writes real code into real files during
Phase 7, and those files are committed as checkpoints on the feature branch.

### Why the Branch IS the Change Set

Traditional full-doc-code approach:
```
Plan says: "Here is the full code for every file"
Executor: re-applies or reconstructs that code into the repo
Problem:  high token cost, duplicated state, and brittle drift between docs and code
```

Serious Vibe Coding approach:
```
Manifest says: task-1-types touches src/types/match.ts and tests/matchScore.test.ts
Executor:      writes those files directly in the worktree
Review:        git diff --staged checks the current task only
Checkpoint:    commit task-1 when accepted, then continue
Promotion:     git merge --squash the reviewed branch, no doc-to-code replay
```

The agent writes code while holding full context — every spec, every journey,
every AC is in the worktree. The code is reviewed on the branch before it
touches main. Promotion is a deterministic merge of reviewed branch state,
not a second generation step.

### The Manifest

The manifest still exists as a document (`docs/plans/<date>-<name>/manifest.md`)
for reviewability. It describes what will change, how tasks are grouped, which
files are expected to move, and which checkpoints should exist. The actual code
lives in the branch, not in the manifest.

```markdown
# Change Set: Match Discovery

**Feature Spec:** docs/specs/features/feature-matching.md
**Branch:** feature-match-discovery
**Base:** main @ <sha>
**Status:** BASELINED
**Created:** 2026-04-03

## Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| src/types/match.ts | CREATE | task-1-types | Type definitions, interfaces |
| migrations/003-match-scores.sql | CREATE | task-2-data-model | Score table migration |
| tests/matchScore.test.ts | CREATE | task-3-tests | Unit tests (TDD — written first) |
| src/services/matchScore.ts | CREATE | task-4-services | Score calculation logic |
| src/components/MatchCard.tsx | CREATE | task-5-components | Match display component |
| e2e/specs/matching.spec.ts | CREATE | task-6-e2e | End-to-end test coverage |
| docs/specs/features/feature-matching.md | MODIFY | task-7-spec | Status update, AC annotations |

## Checkpoint History

| Checkpoint | Commit | What It Contains |
|------------|--------|-----------------|
| checkpoint: phase-3-spec | abc1234 | Feature spec with stories, ACs |
| checkpoint: phase-4-ux | def5678 | UX design with flows, states |
| checkpoint: phase-5-ui | ghi9012 | UI design with components |
| checkpoint: phase-6-tech | jkl3456 | Technical design, architecture |
| checkpoint: task-1-types | mno7890 | Type definitions |
| checkpoint: task-2-data-model | pqr1234 | Database migration |
| checkpoint: task-3-tests | stu5678 | Unit tests |
| checkpoint: task-4-services | vwx9012 | Service implementation |
| checkpoint: task-5-components | yza3456 | UI components |
| checkpoint: task-6-e2e | bcd7890 | E2E tests |
| checkpoint: task-7-spec | efg1234 | Spec status updates |
```

The manifest is the map. The branch is the territory.

## Universal Assurance Floor: Change Impact Triad

Every mutating lane answers `breaks_what`, `intended_behavior`, and `product_surface` in one diff-bound receipt. Rich feature and bug phases may subsume the answers only by naming their exact evidence artifacts. The receipt is bound to WI, session, worktree, task graph, task, and classifier SHA; foreign or stale state is invalid.

Risk is a mechanical floor: protected auth/policy, billing, schema/migration, shared layout, feature flags, host hook/task graph, and release/signing/version surfaces are high; executable behavior is logic; only content with no structural signal is cosmetic. No agent, file count, or line count may downgrade the result. Cosmetic requires static proof, logic requires a mapped passing test, and high requires behavioral/runtime proof at the task checkpoint plus exact deferral to the graph's one final different-family review. Missing coverage creates a blocking owned task. See `references/change-impact-triad.md`.

## The Review Protocol

Every state transition is gated by a review. The review protocol is designed
around the specific failure modes of LLM agents: they miss their own errors,
they agree too easily, and they rationalize incorrect output.

### The Protocol

```
Step 1: SELF-REVIEW
  Agent A reviews the artifact.
  Produces: list of findings, each with:
    - Finding ID
    - Severity (critical / high / medium / low)
    - Description
    - Location (file:line or section reference)
    - Justification (why this is an issue)

Step 2: SELF-JUDGMENT
  Agent A reviews its own findings.
  For each finding, produces:
    - ACCEPT or REJECT
    - Analysis (why the finding is valid or why it was a false positive)
  This forces critical reasoning — the agent must argue with itself,
  not just list issues.

Step 3: CROSS-REVIEW
  Agent B receives:
    - The artifact
    - Agent A's findings
    - Agent A's self-judgments
  Agent B produces:
    - ACCEPT or REJECT for each of Agent A's accepted findings
    - NEW findings Agent A missed
    - Justification for every decision

Step 4: CONVERGENCE CHECK
  If only medium/low severity issues remain → PASS (proceed to next phase)
  If critical/high issues remain → fix and re-enter Step 1
  Maximum 3 iterations → escalate to human with full findings history

Step 5: GATE DECISION
  PASS → artifact transitions to next state
  FAIL → artifact stays in current state, findings become fix tasks
  ESCALATE → human reviews findings, makes final call
```

### Why This Protocol Works

| LLM Failure Mode | How the Protocol Catches It |
|---|---|
| Agent doesn't see its own errors | Step 3: fresh agent with different "perspective" |
| Agent lists issues but doesn't evaluate them | Step 2: forced accept/reject with reasoning |
| Agent agrees with everything | Step 3: cross-agent must independently justify |
| Infinite review loops | Step 4: max 3 iterations, then escalate |
| Review theater (finding trivial issues to seem thorough) | Severity classification + convergence on medium/low = pass |

### Review Gates

| Gate | Artifact | Transition | What the Review Checks |
|------|----------|------------|----------------------|
| G1 | Feature Spec | DRAFT → ready for UX | Stories testable? ACs specific? Layer 3 clean? Dependencies identified? |
| G2 | UX Design | DRAFT → UX-REVIEWED | Flows cover all stories? States complete? Error handling? Accessibility? |
| G3 | UI Design | DRAFT → DESIGNED | Design system consistency? Responsive? Dark mode? Component reuse? |
| G4 | Technical Design | DESIGNED → BASELINED | All ACs feasible? Architecture sound? Risks identified? Trade-offs explicit? |
| G5 | Executed Change Set | BASELINED → CHANGE-SET-APPROVED | Executed branch diff matches design? Tests cover ACs? Cross-file consistency? No placeholders? Checkpoints clean? |
| G6 | Promotion | CHANGE-SET-APPROVED → PROMOTED | Squash diff matches manifest? No unplanned changes? Validation clean? |
| G7 | Verification | PROMOTED → VERIFIED | Tests pass? QA complete? E2E complete? Spec annotations updated? |

## Promotion

Promotion is `git merge --squash feature-branch` into main. The entire feature
branch — specs, designs, code, tests — lands as a single atomic commit.

### Promotion Process

```
1. Ensure feature branch has passed G5 review (executed change set approved)
2. git checkout main && git merge --squash feature-<name>
3. Deviation check: git diff --staged should match expected changes
   (compare against the manifest's file list)
4. If deviations found → enter Review Protocol at G6
5. If clean → commit, run validation commands, status → PROMOTED
```

### Why Squash Merge

The feature branch contains many intermediate checkpoints — useful during
development but noisy in main's history. The squash merge collapses them into
a single commit that represents the complete, reviewed change set. The feature
branch is preserved (not deleted) so checkpoint history remains available.

## Checkpoints

Every phase ends with a checkpoint — a commit on the feature branch. Checkpoints
are the mechanism that makes the worktree model work.

### Why Checkpoints Matter

1. **Attention resets.** When the agent starts a new task, it re-reads the
   relevant artifacts fresh. The checkpoint guarantees those artifacts are on
   disk and consistent. The positional attention bias resets — the spec is at
   the top of the context, not buried under 10K tokens of generated code.

2. **Rollback to any phase.** If Phase 6 reveals that the spec is wrong, you
   can roll back to the Phase 3 checkpoint and re-run from there. No
   reconstructing state from memory. No hoping the agent remembers what the
   spec said before you changed it.

3. **Lightweight commits.** Checkpoints are ordinary git commits. They carry
   no ceremony — no PR, no review, no CI. They exist for the agent's benefit.
   All of them get squashed at promotion anyway.

4. **Audit trail.** The checkpoint history tells the story of how the feature
   was built: what was designed first, what changed during technical design,
   which tasks were completed in what order.

### Checkpoint Naming

```
checkpoint: phase-3-spec
checkpoint: phase-4-ux
checkpoint: phase-5-ui
checkpoint: phase-6-tech
checkpoint: task-1-types
checkpoint: task-2-data-model
checkpoint: task-3-tests
checkpoint: task-4-services
checkpoint: task-5-components
checkpoint: task-6-e2e
checkpoint: task-7-spec-updates
```

The prefix `checkpoint:` is mandatory. It distinguishes checkpoint commits from
any other commits on the branch. Phase checkpoints use `phase-N-<name>`. Task
checkpoints (within Phase 7) use `task-N-<name>`.

## UX Design vs UI Design

These are fundamentally different concerns and must be separate documents
in separate phases with separate review gates.

### UX Design (Phase 4)

**What it answers:** How does the user move through the feature? What do
they see at each state? What happens when things go wrong?

**Artifact:** `docs/specs/ux/<feature-name>.md`

**Contains:**
- Screen inventory (what screens/views exist)
- State machine (what states each screen can be in)
- Flow diagram (how users navigate between screens)
- Information hierarchy (what's most important on each screen)
- Error states and recovery paths
- Loading states and transitions
- Accessibility requirements
- Responsive behavior strategy (mobile-first, breakpoints)

**Does NOT contain:** Colors, fonts, spacing, visual style. Those are UI design.

**Input:** Feature spec (stories, ACs) + Personas + Journeys
**Output:** UX-REVIEWED feature spec (screen flows and states validated)

### UI Design (Phase 5)

**What it answers:** How does it look? What's the visual language? What
specific components render the UX design's screens?

**Artifact:** `docs/specs/ui/<feature-name>.md` + `docs/specs/design-system.md`

**Contains:**
- Component specifications (what renders each screen element)
- Design token usage (which colors, spacing, typography from the design system)
- Visual hierarchy (size, weight, contrast decisions)
- Dark mode behavior
- Animation and motion specifications
- Component states (hover, active, disabled, error, loading)
- Responsive layout specifics (grid, breakpoints, reflow)

**References:** Design System (`docs/specs/design-system.md`) for tokens
and patterns. If the design system doesn't exist, UI design creates it first.

**Input:** UX Design (screen flows, states) + Design System (tokens, patterns)
**Output:** DESIGNED feature spec (visual specifications locked)

### Design System (Foundational)

**What it is:** The project's visual language. Created once, evolved as
features demand new patterns.

**Artifact:** `docs/specs/design-system.md`

**Contains:**
- Color palette (semantic: primary, error, warning — not hex values as names)
- Typography scale (headings, body, code, captions — sizes, weights, line heights)
- Spacing system (base unit, scale)
- Component patterns (card, modal, form, button, navigation)
- Motion principles (durations, easing, when to animate)
- Dark mode strategy
- Brand personality (voice, tone, visual feeling)

**Influenced by:** Google Material Design, Stitch, Tailwind — but adapted
to the project's specific brand. Not a copy of any framework.

## Cache-Optimized Execution

### The Spec as Codebase Index

In a mature project, the feature spec IS the codebase index. sync-spec-code
annotations tell you where everything is:

```markdown
- RESOLVED 2026-03-15 [SERVICE] src/services/matchScore.ts:42 — score calculation
- RESOLVED 2026-03-15 [API] src/routes/matches.ts:18 — API endpoint
- PLANNED — real-time score updates
- DRIFT 2026-03-20 — timezone filter uses different column
```

This eliminates the need to grep during Phases 3-6. The spec already did the
search. During spec writing, UX design, UI design, and technical design, the
agent reads SPECS, not SOURCE CODE. Source code is loaded only in Phase 7
(implementation), and only the files the spec points to — not the entire
codebase.

```
Phases 3-6 context: specs + designs only (~30-50K tokens)
Phase 7 context:    specs + designs + targeted code files (~50-100K tokens)
Naive approach:     entire codebase every phase (~200-500K tokens)
```

The more mature your specs (more RESOLVED annotations with file:line), the
fewer tokens you spend loading code. sync-spec-code is not just a consistency
tool — it is a cache optimization tool.

### Structured Spec Sections Eliminate Scans

Beyond annotations, the spec itself contains structured tables that replace
codebase greps:

| Spec section | Replaces | Skills that benefit |
|-------------|----------|-------------------|
| API Contracts table | Grepping route files | audit-implementation, sync-spec-code |
| Data Model table | Grepping migrations/ORM models | audit-implementation, sync-spec-code |
| Component Tree | Scanning component directories | write-e2e, design-ux |
| Event Contracts table | Grepping event emitters | sync-spec-code |
| Feature Toggles table | Reading .env files | execute-changeset, write-e2e |

### Context Loading Rules for Phase 7

Skills in Phase 7 (plan-changeset, execute-changeset) must NOT scan the full
source tree. Instead, they load code from these sources only:

1. **Style contract** (`docs/specs/style-contract.md`) — patterns, naming,
   conventions. Already derived from the codebase by define-code-style.
2. **Spec RESOLVED annotations** — file:line pointers to existing code.
   Tier tags (`[DB]`, `[API]`, `[UI]`, `[TEST]`, `[SERVICE]`) tell the skill
   what layer each file belongs to.
3. **Manifest file list** — the specific files being created or modified.
4. **Import resolution** — when a loaded file imports another, follow that
   import on demand.

This eliminates the 3-scan redundancy where design-tech, plan-changeset, and
execute-changeset all independently scan the source tree for the same patterns
the style contract already encoded.

### The Four-Layer Cache Architecture

LLM providers cache the KV pairs (key-value attention states) of prompt
prefixes. When a request starts with the same tokens as a previous request,
the cached computation is loaded at ~90% discount. The cache matches on
EXACT PREFIX — same tokens, same order, from the start.

Serious Vibe Coding exploits this by loading artifacts in a stable order, most stable
first:

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: Project (cached across ALL features, ALL tasks)      │
│   Skill instructions + vision + personas + design system      │
│   ~15K tokens. Changes rarely. Cache hit rate: ~95%           │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Feature (cached across all tasks of one feature)     │
│   Feature spec + UX design + UI design + tech design          │
│   ~20K tokens. Changes at phase boundaries. Hit rate: ~80%    │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Code (cached across parallel sub-agents in Phase 7)  │
│   ONLY files referenced by spec annotations                   │
│   ~30K tokens. Empty during Phases 3-6. Hit rate: ~70%        │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Task (unique per task, always computed fresh)         │
│   Task instructions + task-specific code segments             │
│   ~10K tokens. Never cached.                                  │
└──────────────────────────────────────────────────────────────┘
```

**Rules:**
- NEVER reorder layers (breaks cache prefix match)
- NEVER insert content between cached layers
- Layer 3 is EMPTY during Phases 3-6 (no code loaded until Phase 7)
- Parallel sub-agents in Phase 7 load the same code files in the same
  order to share Layer 3 cache

### Token Cost With Caching

```
Naive (load everything every time):
  10 tasks × 200K context = 2M input tokens at full price

Cache-optimized:
  Phases 3-6 (no code, Layer 1+2 only):
    Phase 3: 35K (full price, first load)
    Phases 4-6: 15K cached (90% off) + 20K feature = ~23K each × 3 = 69K
    Subtotal: 104K equivalent

  Phase 7 (code loaded, 6 tasks):
    Task 1: 35K (L1+2 cached) + 30K (L3 fresh) + 10K (L4) = 75K
    Tasks 2-6: 35K + 30K (both cached) = ~17K + 10K = 27K × 5 = 135K
    Subtotal: 210K equivalent

  Reviews (7 gates × ~20K each):
    140K (Layer 1+2 cached for most)
    Subtotal: ~80K equivalent

  Total: ~394K equivalent
  Savings vs naive: ~80%
  Realistic (accounting for TTL misses): ~50-60% savings
```

### Execution Model: Sequential Phases, Parallel Tasks

**Phases are sequential.** Phase 4 (UX) needs Phase 3 (spec) output. Phase 5
(UI) needs Phase 4 output. There is no shortcut — each phase reads the previous
phase's artifact. This is the progressive narrowing chain.

**Tasks within Phase 7 can be parallel.** Independent tasks (different files,
no shared state) run as parallel sub-agents. Dependent tasks run sequentially.
This matches the `blockedBy` and `parallelGroup` metadata from the plan.

**How this differs from obra (superpowers):**

Obra's subagent-driven-development dispatches one agent per task with a
two-stage review (spec compliance, then code quality). The tasks come from a
plan with dependency metadata. This is sound for execution.

Where obra falls short:

1. **No phase separation.** Obra goes brainstorm → plan → execute. There is no
   spec phase, no UX phase, no UI phase. The plan tries to capture everything.
   When the executing agent hits an ambiguity, it pattern-matches instead of
   consulting a reviewed spec.

2. **The plan describes, then re-implements.** Obra's plan says "create a
   function that does X." The executor reads that description and generates
   the function from scratch. This is a double-spend: tokens are used to
   understand the problem (planning), then used AGAIN to understand the same
   problem (execution). The translation from plan description to code is lossy.

3. **No checkpoint-as-attention-reset.** Obra's executor runs tasks
   sequentially in one session or dispatches sub-agents. Neither model
   explicitly re-reads prior artifacts at task boundaries. The spec fades from
   attention as code accumulates.

4. **No cache-aware loading.** Obra doesn't specify artifact loading order.
   Each sub-agent loads what it needs in whatever order. Cache prefix overlap
   is accidental, not designed.

**What svc adds:**

1. **Phase separation** ensures each class of uncertainty is resolved in the
   right order, with a review gate before the next phase begins.

2. **Write-once execution.** The plan provides intent, constraints, and file
   targets — not code descriptions. The executor writes code directly on the
   branch from the spec + design + style contract. No plan→code translation
   step. The diff IS the changeset. One generation, zero re-implementation.

3. **Spec-as-index** means Phase 7 loads only referenced code, not the entire
   codebase.

4. **Generation-bound parallel subagent execution.** Independent tasks with
   pairwise-disjoint known scopes run concurrently in one nested execution wave.
   Every mutating child has an independently attributable principal, its own
   inner worktree, a one-time accepted path capability, and a probed filesystem
   containment boundary. Unknown, overlapping, shared-state, lockfile,
   migration, and root-config scopes serialize. The controller recomputes child
   receipts and merges results sequentially; handover freezes old-generation
   results until explicit adoption.

5. **Holistic review replaces per-task review.** Style contract + TDD +
   spec constraints make per-task reviews redundant. One review of the full
   diff after all tasks catches cross-task issues that per-task reviews miss.

6. **Checkpoints at phase boundaries** reset attention — the agent re-reads
   artifacts fresh, preventing positional decay.

7. **Cache-optimized loading order** ensures Layer 1-2 tokens are cached across
   all tasks, reducing cost by 50-60%.

8. **Authority and containment are distinct.** Canonical operation scope plus
   controller/delegation checks decide who may mutate what. PreTool hooks are an
   authority guardrail, not a complete shell security boundary; the host sandbox
   or contained command wrapper is the filesystem boundary.

5. **The worktree** is the consistent state — all artifacts from all phases
   are co-located and checkpointed until promotion.

### Sequential vs Parallel: When Each Checkpoint Stacks

Within Phase 7, tasks build on each other:

```
Task 1: Write types          → checkpoint (commit)
Task 2: Write tests (TDD)    → checkpoint (depends on types)
Task 3: Write service         → checkpoint (depends on types + tests)
Task 4: Write component       → checkpoint (depends on types + service)
```

Each checkpoint IS a known-good state. If Task 3 drifts, you roll back to
Task 2's checkpoint and retry. You don't redo Tasks 1-2.

Independent tasks parallelize:

```
Task 1: Write types      → checkpoint
                            ↓
Task 2: Write service A   → checkpoint  }  parallel (same parallelGroup)
Task 3: Write service B   → checkpoint  }
                            ↓
Task 4: Integration       → checkpoint (depends on 2 + 3)
```

**When stacking fails (and what to do):**

If the agent writes 500 lines across 5 tasks and Task 5 reveals that Task 2
was wrong, rolling back to Task 2 means redoing Tasks 3-5. This burns tokens.

The mitigation is the review protocol at checkpoints. A lightweight review
after each task catches drift early — before 3 more tasks build on it. The
cost of reviewing each task (~10K tokens) is far less than the cost of
redoing 3 tasks (~60K tokens).

**The principle:** Review early, review each layer. The cost of a checkpoint
review is always less than the cost of rolling back stacked work.

### Feature-Level Dependencies and Parallel Features

The cascade effect discovers feature dependencies. These create a
feature-level execution graph:

```yaml
features:
  - id: feature-matching
    depends_on:
      - id: enabler-score-recalc
        needed_at: Phase 7    # needs code, not just spec
    
  - id: enabler-score-recalc
    depends_on:
      - id: integration-email
        needed_at: Phase 7

  - id: integration-email
    depends_on: []
```

**Dependencies are phase-specific.** Feature A needs Enabler B's SPEC to
write A's spec (Phase 3). It needs B's CODE to write A's code (Phase 7).
So:

```
B: Phase 3 (spec) ──→ Phase 4-6 ──→ Phase 7 (code) ──→ merge
                ↓
A:              Phase 3 (references B's ACs) ──→ Phase 4-6 ──→ waits ──→ Phase 7
```

A can start its spec as soon as B's spec passes G1. A doesn't wait for B's
full pipeline. But A's Phase 7 waits for B to merge — because A's code calls
B's code.

**Independent features** get their own worktrees from main and run the full
pipeline in parallel:

```
main
  ├── worktree: feature-chat       (Phases 3-9, independent)
  ├── worktree: feature-payments   (Phases 3-9, independent)
  └── worktree: feature-matching   (Phases 3-7, waits for enabler)
```

**Cross-feature cache sharing:** Independent features sharing the same vision,
personas, and design system share Layer 1 cache. Tokens are computed once for
the first feature, cached for all parallel features within the TTL window.

### Token Budget Per Feature

| Scenario | Estimated Cost | Notes |
|----------|---------------|-------|
| Full pipeline, cache-optimized | 300K-500K tokens | All 9 phases, 7 gates |
| Skip UX/UI (backend-only Enabler) | 150K-300K tokens | Phases 4-5 skipped |
| Bug fix (spec + change set only) | 50K-100K tokens | Phases 4-6 skipped |
| "Ticket → code" (no svc) | 20K-50K initial + 75K-150K fix cycles | Cheaper upfront, more expensive total |

The structured approach costs more per feature but produces fewer fix cycles.
For features that would have required 3+ fix cycles, svc is cheaper
in total tokens spent.

## Why This Is Necessary Now

In 2024-2025, AI coding meant "copilot autocompletes your line." The developer
held the context, the AI filled in syntax. The developer was the deterministic
element; the AI was a stochastic accelerator.

In 2026, AI coding means "agent implements your feature." The agent holds no
persistent context. The agent IS the stochastic element. If the methodology
doesn't account for this, every feature is a gamble — sometimes the agent
produces what you wanted, sometimes it produces something confidently wrong.

Serious Vibe Coding is the methodology that makes agentic development deterministic.
Not by fixing the models — that's Anthropic's, OpenAI's, and Google's job.
But by structuring the process so that by the time the agent generates code,
the implementation is already tightly constrained by everything that came before it.

**The progressive narrowing model is not optional.** It is the only way to
get reliable output from a probabilistic system. Every methodology that skips
phases — that goes from ticket to code, from spec to implementation, from
design to "let the agent figure it out" — is accepting non-determinism as
a feature. Serious Vibe Coding rejects that.

## The Complete Pipeline

All phases happen in a single worktree branched from main. Each phase produces
a checkpoint. The worktree is the time capsule — nothing changes under the
agent between phases. Promotion is a squash merge to main.

```
main (frozen at SHA)
  └── worktree: feature-<name>
        Phase 3: write-spec             → checkpoint → [G1 Review]
        Phase 4: design-ux        → checkpoint → [G2 Review]
        Phase 5: design-ui        → checkpoint → [G3 Review]
        Phase 6: design-tech → checkpoint → [G4 Review]
        Phase 7: plan + execute on branch → checkpoint per task → [G5 Review]
        Phase 8: squash merge to main = promotion → [G6 Review]
        Phase 9: verify on main           → [G7 Review]
```

## Feedback Loops

The pipeline is not strictly linear. Later phases reveal problems in earlier
phases. These feedback loops are explicit and expected:

| Discovery | Source Phase | Loops Back To |
|-----------|-------------|---------------|
| Business case fails kill signals | Feature Discovery (3) | **Pipeline exit** — NO-SHIP or PIVOT |
| AC not feasible | Technical Design (6) | Feature Spec (3) |
| Screen flow impossible | UX Design (4) | Feature Spec (3) |
| Design system insufficient | UI Design (5) | Design System (foundational) |
| Missing enabler | Journey Layer 3 (3) | Feature Spec (3, recursive) |
| Code doesn't match ACs | Verification (9) | Change Set (7) |
| Promotion deviated | Promotion Review (8) | Promotion (8, re-apply) |

The first row is the only feedback loop that exits the pipeline entirely.
`validate-feature` scores 7 kill signals (no demand, no pain, competitor
shipped it, vision misalignment, no kill condition, MVP is a platform,
existing solution). 3+ kill signals = NO-SHIP with a structured evidence
package and alternative directions. The user can override with
counter-evidence or accept a pivot. This is the reject path — the pipeline
does not always proceed forward.

### Phase Boundary Rule

Later phases may refine or verify approved artifacts. They may NOT silently
replace an approved upstream decision without looping back through the
relevant gate. Specifically:

- `explore-solutions` may change the technical approach → must re-trigger G4
- `execute-changeset` may find spec ambiguity → must loop back to `write-spec`
- `verify-promotion` may find coverage gaps → route to `write-e2e` before next promotion, not during verification

If a later phase materially changes what an earlier gate approved, that
gate must re-run on the changed artifact. The cost of re-review is lower
than the cost of shipping an unreviewed change.

All other feedback loops re-enter the Review Protocol at the destination
phase. The artifact's state regresses to the destination phase's state
(e.g., if Technical Design reveals an infeasible AC, the feature spec goes
back to DRAFT).

## Invocation Modes

Every svc skill works in multiple modes. The skill logic is identical —
only what happens after completion changes.

### Standalone

User invokes a skill directly: `/write-spec` or `/sync-spec-code`. The skill
runs, reports results, and suggests the next step. The user decides whether to
continue. This is the default mode.

### Progressive

User invokes with a flag: `/write-vision --progressive --lane greenfield`. The
skill runs, self-verifies its output, and automatically invokes the next skill
in the lane with the same flags. The chain continues until:

- A skill's self-verify fails (chain stops, reports the failure)
- A human checkpoint is reached and `--auto-approve` is NOT set (chain pauses)
- The lane is complete (last skill has no `next`)

The `--skip` flag can exclude skills: `--progressive --lane bugfix --skip style`.
A skipped skill passes the flag to the next without executing.

#### Safety Gates Before Chain Advance

Before any progressive chain invokes the next skill, run these hard-stop checks:

1. **Unresolved checkpoint** — if the previous skill logged a blocker in the
   decision log (type: `user` or `no-ship`), do not advance. Present the
   blocker and wait for resolution.
2. **Self-verify failure** — if the previous skill's self-verify had any FAIL
   items, do not advance. Fix first.
3. **Stale builder profile** — if builder profile is 30+ days old and this is
   a new session, prompt for update before continuing.
4. **Context budget** — if context usage is in DEGRADING or POOR tier, checkpoint
   progress before advancing. See `references/context-budget.md`.

#### Gate Taxonomy

Every validation checkpoint in the pipeline is one of 4 canonical types:

| Type | Purpose | Behavior | Selection |
|---|---|---|---|
| Pre-flight | Validate preconditions before starting | Block entry if unmet, no partial work created | Use when you can verify with a file-existence check or config read |
| Revision | Evaluate output quality, route to revision | Loop back to producer with feedback, bounded by iteration cap | Use after a producer step where quality varies |
| Escalation | Surface unresolvable issues to developer | Pause workflow, present options, wait for human input | Use wherever automated resolution is impossible or ambiguous |
| Abort | Terminate to prevent damage or waste | Stop immediately, preserve state, report reason | Use when continuing would cause damage or produce meaningless output |

**Selection heuristic:** Start with pre-flight. If the check happens after work is produced, it's a revision gate. If the revision loop cannot resolve, escalate. If continuing is dangerous, abort.

**svc gate mapping:** G1-G4 are revision gates (loop between skill and review-gate). G5-G6 are pre-flight gates (verify before landing). G7 is a revision gate with escalation fallback.

### Autorun (One Prompt to Product)

`route-workflow --autorun` runs the entire lane from a single prompt. This is
the one-prompt-to-product mode. The virtual founder (P0) takes over all human
checkpoints:

- `validate-feature`: P0 reviews the business case. **Exception:** NO-SHIP
  decisions always surface to the user — killing a feature is never silent.
- `write-spec`: P0 reviews the spec and logs concerns as Taste decisions.
- `explore-solutions`: P0 selects the approach based on research.
- `plan-changeset`: P0 approves if the plan covers all ACs.
- `execute-changeset`: P0 reviews diffs and approves if tests pass.
- `land-changeset`: P0 merges in solo mode; opens PR and stops in team mode.

At the end of the run, all Taste decisions are presented for review. The user
can override any of them retroactively.

Hard stops that cannot be P0-decided:
- NO-SHIP kill decision (feature rejection)
- Test failure after 3 P0 fix attempts
- Critical/high security finding
- Merge conflict on promotion
- Team mode PR (requires external reviewer)

### Pipeline Decision Log

All modes (standalone, progressive, autorun) produce a persistent decision
trail at `.svc/pipeline-decisions.jsonl`. `route-workflow` defines the
schema and initializes the log, and skills with explicit logging steps append
entries for material decisions, user interactions, and gate results.

#### JSONL Schema

```json
{
  "timestamp": "2026-04-05T14:32:01Z",
  "run_id": "<stable-session-or-worktree-id>",
  "skill": "validate-feature",
  "phase": 4,
  "type": "taste",
  "decision": "MVP includes delete and open commands",
  "reasoning": "Table-stakes for any bookmark manager",
  "alternatives": ["Defer to v2", "Include only delete"],
  "decided_by": "P0",
  "evidence": "buku and nb both ship delete on day 1",
  "overrideable": true
}
```

Event types: `mechanical`, `taste`, `user`, `question`, `answer`, `no-ship`,
`gate-result`.

The workflow MUST preserve this file when material decisions are recorded.
At end of run, taste decisions that were logged are surfaced for user review
and override.

The decision log is one of the resume sources the pipeline reads for interrupted
runs. For product work, the primary source is `docs/specs/project-state.md`.
For task-graph sessions, the primary source is `.svc/lane-tasks.json`.
The decision log fills in the audit trail and last material decisions when the
state files are missing or ambiguous.

For task-graph sessions, persisted timestamps in `.svc/lane-tasks*.json`
and `.svc/pipeline-decisions.jsonl` are part of the audit trail, not
decorative metadata. They should reflect real wall-clock events. Use the helper
scripts (`scripts/task-graph.mjs`, `scripts/pipeline-log.mjs`) for persisted
top-level task creation/status writes and decision-log appends instead of
hand-writing synthetic example times into live project logs.

#### Three Logging Systems

| System | Path | Purpose |
|--------|------|---------|
| **Decision log** | `.svc/pipeline-decisions.jsonl` | What was decided and why (audit trail) |
| **Learnings** | `docs/learnings/learnings.jsonl` | What was learned (institutional memory) |
| **Design alternatives** | `docs/specs/decisions/<feature>.md` | Alternatives considered (architecture record) |

### Builder Profile

A global file at `~/.svc/builder-profile.md` persists across all projects.
It captures who is building: financial context, time budget, skills, team,
social presence, existing tools, business entity, project history, and
learned builder patterns.

P0's persona file embeds a `Builder Context` and `Strategy` section derived
from the builder profile. All downstream skills read P0 — the builder
profile propagates through P0, not through direct reads. The canonical P0
template is defined in `skills/route-workflow/SKILL.md`.

The profile is updated after every project by `verify-promotion` (for shipped
projects) and by user-initiated session (for abandoned projects).

### Orchestrated

A Claude session uses the Agent tool to invoke skills in standalone mode, reading
output between steps and making decisions. The orchestrator holds state, handles
conditional logic, and routes failures. Skills don't know they're being orchestrated.

A Codex session follows the same lane order and file contracts, but uses direct
`SKILL.md` loading plus `.svc/lane-tasks.json` / `update_plan` mirroring
instead of Claude's native task APIs. The cross-host source of truth is the file
state, not the host UI.

### Programmatic

An external Python or TypeScript program calls `claude -p` (Max subscription) or
the Agent SDK (API billing) to invoke skills. The control flow is real code —
deterministic `if/else`, structured retry, typed data flow. A feature toggle swaps
between `claude -p` and API transport. The orchestration logic is identical either way.

## Self-Verification

Every skill includes a self-verify step before declaring completion:

1. **Output existence** — declared output files exist on disk
2. **Contract satisfaction** — outputs have required structure (status field,
   AC table format, required sections)
3. **Unresolved questions** — no TBD/TODO left in outputs

Self-verify uses a structured PASS/FAIL checklist, not freeform assessment.
If any check fails, the skill fixes before continuing (standalone) or stops
the chain (progressive).

## Pre-Implementation Simulation

Between `plan-changeset` and `execute-changeset`, a simulation step
validates the manifest against actual codebase state using a two-layer model:

- **Disk layer** — files that exist now
- **Planned layer** — files that earlier tasks will CREATE

This catches wrong API assumptions, missing imports, dependency ordering issues,
and test framework mismatches before any code is written.

## Code Style Contract

`define-code-style` produces `docs/specs/style-contract.md` — a project-level
artifact that codifies naming conventions, file structure patterns, import style,
test patterns, and error handling. In brownfield mode it derives from existing
code; in greenfield from the design system and tech stack.

`execute-changeset` loads the style contract as context during code generation,
ensuring all generated code follows consistent patterns.

## Local-First, Mock-by-Default, Feature-Toggleable

Every first iteration must be demoable, stunning, and locally runnable with
zero credentials, zero paid accounts, and zero remote infrastructure.

### The Principle

Any dependency that costs money, requires credentials, or talks to a remote
service ships in two forms:

1. **Mock implementation** — ON by default. Works locally, returns realistic
   data, exercises the full AC. This is not a stub that returns `true` — it's
   a mock that looks and behaves like the real thing from the user's perspective.

2. **Real implementation** — OFF by default. Behind a feature toggle. Enabled
   per-environment when ready.

```
LOCAL (default):    all mocks ON, all real integrations OFF
STAGING:            some real ON (e.g. auth, email), risky ones still mocked
PRODUCTION:         all real ON, mocks OFF
```

### Why This Matters

- **First demo wins.** The first person who sees your product sees a working
  product, not a "set up Stripe first" error page. The mock Stripe returns
  success, the mock email logs to console, the mock S3 writes to local disk.

- **E2E tests are deterministic.** Tests run against mocks — no flaky network
  calls, no rate limits, no credential rotation. The same test passes
  identically on every machine, every time.

- **Incremental real-ification.** You flip toggles one at a time: first auth,
  then payments, then email. Each toggle flip is a small, reviewable change —
  not a "make everything work for real" big bang.

- **Risk isolation.** A broken real integration doesn't block development.
  The team works against mocks while the integration issue is fixed.

### Feature Toggle Convention

Every repo maintains `docs/specs/toggle-registry.md`:

```markdown
| Toggle | Default | Mock behavior | Real behavior | Environments |
|--------|---------|--------------|---------------|-------------|
| `ENABLE_STRIPE` | off | Returns success, logs to console | Stripe SDK | staging, prod |
| `ENABLE_EMAIL` | off | Logs email body to stdout | SendGrid API | staging, prod |
| `ENABLE_S3` | off | Writes to `./local-storage/` | AWS S3 SDK | prod |
```

Toggle mechanism is tech-stack dependent (env vars, config file, runtime flag)
and defined in the technical design. The toggle registry is the canonical
source of truth — it lists every toggle, its default, and what each state does.

### Where This Is Enforced

| Phase | Skill | What it checks |
|-------|-------|---------------|
| 3. Spec | `write-spec` | Every Integration dependency has a Mock Strategy in the System Dependencies table |
| 6. Tech Design | `design-tech` | Architecture defines toggle mechanism, mock implementations, and environment matrix |
| 7. Execution | `execute-changeset` | Code ships with mocks ON. E2E passes locally with zero credentials. Toggle registry exists |
| 9. Verification | `verify-promotion` | Toggle registry matches actual code. No hard-coded credentials |

## Domain Reference Packs

When a project uses a framework or library version that may exceed the model's
training data, `references/domains/<framework>/` provides persistent reference
material (conventions, testing patterns, version-specific gotchas). These are
markdown files loaded by `execute-changeset` when the tech stack matches.
They are NOT skills — they don't participate in the pipeline or manifest.

## Validation cadence and evidence reuse

Use focused mapped checks during iteration. At the release boundary, require a
complete passing validation run for the candidate. Reuse that result only when
its recorded source/input hashes, validator set, command options, runtime and
relevant environment still match; elapsed time or an earlier green message is
not evidence. A changed input, actual failure, or gate requiring fresh external
state invalidates the affected result. Missing provenance requires a new run.
Keep post-commit relevant checks and actual post-promotion/install verification.
Unknown/global and unmapped-surface test selection retain their full-coverage
semantics. Never treat provider unavailability or skipped tests as passing.
