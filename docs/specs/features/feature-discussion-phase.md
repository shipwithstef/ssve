# Feature: Discussion Phase

**Status:** BASELINED
**Type:** Enabler
**Consumers:** route-workflow, write-spec, design-ux, design-tech, review-gate, builder (interactive mode)
**Priority:** High
**Created:** 2026-04-10

---

## Problem Statement

`FRAMEWORK-STATE.md` currently lists "Discussion phase for gray areas" as an
open framework gap. The current framework jumps from idea validation into
spec/design/planning with no dedicated phase for ambiguity that is neither
"is this worth building?" nor "how do we implement it?".

`validate-feature` partially covers this space, but it is optimized for demand,
scope wedge, and ship-worthiness. It does not create a durable artifact that
captures unresolved gray areas, the evidence behind proposed defaults, and the
decisions that downstream skills must inherit. The result is predictable:
scope and design decisions get re-litigated in later phases, or worse, get
silently guessed by downstream skills.

The source inspiration is GSD's `discuss-phase`, but svc needs a version that
fits its own pipeline: progressive narrowing, file-backed continuity, review
gates, and explicit routing. Without this capability, the framework has no
first-class answer for "we know roughly what we want, but several expensive
choices are still gray."

---

## Source Problem Traceability

| Source concept | Evidence | Spec coverage |
|---|---|---|
| Dedicated phase for gray areas is missing | `FRAMEWORK-STATE.md` Known Gaps | DISC-01 through DISC-06 |
| GSD has a discuss-phase with code-aware scouting and grouped questions | `references/knowledge/gsd/CAPABILITIES.md`, `references/knowledge/gsd/details/features.md` | DISC-07 through DISC-13 |
| Decisions are getting lost between phases | `references/knowledge/gsd/CAPABILITIES.md` skipped-pattern note, framework gap wording | DISC-14 through DISC-19 |
| Downstream skills need a stable artifact instead of chat memory | Existing file-backed continuity doctrine in svc | DISC-20 through DISC-26 |

---

## User Stories

### US-1: Detect When Discussion Is Needed And Bound The Scope

**As** route-workflow,
**I need** explicit triggers and a bounded scope for a discussion phase,
**So that** the framework invokes it only when ambiguity is real and expensive.

#### Acceptance Criteria — US-1: Detection And Scope

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| DISC-01 | Capability can be invoked explicitly when the user asks to discuss gray areas or unresolved choices | — | 🔲 | — |
| DISC-02 | `route-workflow` recommends the capability when unresolved, hard-to-reverse decisions remain after `validate-feature` or while drafting a brownfield extension | — | 🔲 | — |
| DISC-03 | Capability scans existing artifacts before asking questions and excludes decisions already settled in project state, router context, decision logs, or feature specs | — | 🔲 | — |
| DISC-04 | Each gray area is tagged with one category from a controlled set: scope, UX, contract/data, operations, sequencing/ownership | — | 🔲 | — |
| DISC-05 | Active discussion scope is capped at 3-7 gray areas per run; additional items are deferred rather than mixed into one oversized discussion | — | 🔲 | — |
| DISC-06 | When no actionable gray areas remain, capability emits a "discussion not needed" result and routes directly to the next skill | — | 🔲 | — |

### US-2: Research Gray Areas And Propose Defaults

**As** the builder or P0 operating in auto mode,
**I need** each gray area to be researched, classified, and paired with explicit alternatives,
**So that** decisions are made on evidence rather than downstream guesswork.

#### Acceptance Criteria — US-2: Evidence And Alternatives

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| DISC-07 | Each gray area is classified by reversibility and magnitude before a recommendation is made | — | 🔲 | — |
| DISC-08 | Each irreversible or high-magnitude gray area includes 3-5 ranked alternatives with trade-offs | — | 🔲 | — |
| DISC-09 | Each reversible, low-magnitude gray area includes a recommended default and an explicit override path | — | 🔲 | — |
| DISC-10 | Brownfield runs perform code-aware scouting of relevant files before questioning or recommending | — | 🔲 | — |
| DISC-11 | Each recommendation cites concrete evidence: repo artifact, code path, framework state, or research source | — | 🔲 | — |
| DISC-12 | Interactive mode asks one focused question per open gray area instead of a broad questionnaire | — | 🔲 | — |
| DISC-13 | Auto mode records the recommended default, confidence, and the evidence that would reverse the recommendation | — | 🔲 | — |

### US-3: Persist Decisions In A Stable Artifact

**As** downstream pipeline skills,
**I need** one durable discussion artifact that captures decisions, blockers, and deferrals,
**So that** later phases inherit settled choices instead of reopening them from chat memory.

#### Acceptance Criteria — US-3: Persistence

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| DISC-14 | Capability writes `docs/specs/discussions/<topic>.md` with frontmatter and structured sections for gray areas, decisions, blockers, and next-step routing | — | 🔲 | — |
| DISC-15 | Each gray area in the artifact has a status of `open`, `decided`, `deferred`, or `blocked` | — | 🔲 | — |
| DISC-16 | Each decided item maps to the downstream artifact or phase it constrains (`write-spec`, `design-ux`, `design-tech`, `plan-changeset`, or `review-gate`) | — | 🔲 | — |
| DISC-17 | Unresolved one-way-door items are marked blocking with an explicit owner and required next decision | — | 🔲 | — |
| DISC-18 | Deferred items are written to a tracked defer list or work item with the trigger condition for revisiting them | — | 🔲 | — |
| DISC-19 | Material decisions are appended to `.svc/pipeline-decisions.jsonl` with the correct decision type and provenance | — | 🔲 | — |

### US-4: Integrate Cleanly With The Rest Of The Pipeline

**As** `write-spec`, `design-tech`, and `review-gate`,
**I need** consistent rules for consuming discussion output,
**So that** settled decisions become inherited constraints rather than repeated debate.

#### Acceptance Criteria — US-4: Pipeline Integration

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| DISC-20 | When a discussion artifact exists for the current topic, `write-spec`, `design-ux`, and `design-tech` read it before making new choices in the same area | — | 🔲 | — |
| DISC-21 | `route-workflow` can use the artifact to recommend the next skill: proceed, block, or reroute | — | 🔲 | — |
| DISC-22 | If discussion reveals the problem is actually unvalidated demand or wedge ambiguity, the capability reroutes to `validate-feature` instead of continuing downstream | — | 🔲 | — |
| DISC-23 | If discussion reveals the issue is broken known behavior rather than new-feature ambiguity, the capability reroutes to `diagnose-bug` | — | 🔲 | — |
| DISC-24 | `review-gate` can fail work that contradicts a settled discussion decision unless the spec's revision log explicitly supersedes it | — | 🔲 | — |

### US-5: Make The Phase Auditable And Safe In Zero-State Runs

**As** the framework maintainer,
**I need** the phase to work even when the target artifacts are thin and to leave a testable audit trail,
**So that** it is useful in both greenfield and brownfield runs.

#### Acceptance Criteria — US-5: Auditability

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| DISC-ZERO | When invoked without an existing target spec, capability derives a bounded topic from the prompt, work item, or framework gap and still produces a valid discussion artifact | — | 🔲 | — |
| DISC-25 | Artifact frontmatter includes `target`, `repo_mode`, `authoring_mode`, `ambiguity_before`, `ambiguity_after`, `open_count`, `blocking_count`, and `recommended_next_skill` | — | 🔲 | — |
| DISC-26 | Output ends with a concise proceed, block, or reroute summary that downstream routing can consume directly | — | 🔲 | — |

---

## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|-------------|-----------------|---------------|
| `route-workflow` | Enabler | N/A (skill, not spec) | Entry-point routing, repo mode, change type, next-skill selection | Use a sample route request with explicit ambiguity and a target work item |
| `validate-feature` | Enabler | N/A (skill, not spec) | Upstream wedge validation and ambiguity signals | Use a sample ship brief with 2-3 unresolved design choices |
| `FRAMEWORK-STATE.md` / `project-state.md` / `router-context.md` | Framework artifacts | N/A (convention) | Current repo truth, known gaps, prior decisions, repo-local constraints | Use the current framework gap plus a sample brownfield project-state/router-context pair |
| Existing feature specs and decision logs | Framework artifacts | Partial (`docs/specs/features/*.md`, `docs/specs/decisions/*.md`) | Prior settled choices that must not be reopened | Use `feature-roadmap-evaluation.md` plus sample decision records |
| `research` | Enabler | N/A (skill, not spec) | Evidence gathering when repo artifacts are insufficient | Use a mocked comparison table or cached research notes |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|----------------------|
| `write-spec` | Enabler | Settled scope decisions and explicit unresolved blockers |
| `design-ux` | Enabler | Resolved UX gray areas and deferred UX questions |
| `design-tech` | Enabler | One-way-door decisions and evidence-backed defaults |
| `review-gate` | Enabler | A stable record of what was intentionally decided vs accidentally changed |
| `route-workflow` | Enabler | Proceed, block, or reroute outcome for the active topic |

---

## Data Flow

```text
Prompt / WI / framework gap
        |
        v
route-workflow or explicit invocation
        |
        v
discussion-phase
  | read upstream truth
  | classify gray areas
  | gather evidence
  | rank alternatives
  | choose / defer / block
  v
docs/specs/discussions/<topic>.md
        |
        +--> .svc/pipeline-decisions.jsonl
        |
        +--> defer list or work item (for deferred items)
        |
        +--> next routed skill
             - write-spec
             - design-ux
             - design-tech
             - validate-feature
             - diagnose-bug
```

---

## State Machine

```text
DETECTED
  |
  v
CLASSIFIED
  |
  +--> RESEARCHED
          |
          +--> DECIDED   -> inherited by downstream phase
          |
          +--> DEFERRED  -> tracked defer list or work item with revisit trigger
          |
          +--> BLOCKED   -> explicit user decision required
          |
          +--> REROUTED  -> validate-feature or diagnose-bug
```

---

## API Contracts

There is no HTTP API surface. The machine contracts for this capability are:

| Interface | Producer | Consumer | Shape |
|-----------|----------|----------|-------|
| Skill invocation | `route-workflow` or direct user invocation | `discuss-phase` | topic + source refs + repo mode + authoring mode |
| Discussion artifact | `discuss-phase` | `write-spec`, `design-ux`, `design-tech`, `review-gate`, `route-workflow` | Markdown file with YAML frontmatter + fixed tables |
| Decision-log append | `discuss-phase` | `route-workflow`, `review-gate`, audit flows | Existing `pipeline-decisions.jsonl` event schema |

---

## Data Model

No database changes. The persisted model is a file-backed discussion artifact.
See `## Technical Design > Data Model` for the canonical schema.

---

## Component Tree

_N/A — no visual component tree. Interaction is CLI/prompt plus file output._

---

## Event Contracts

_N/A — no async message bus required. Invocation is synchronous and file-backed._

---

## Feature Toggles

_N/A — no external runtime dependency that requires local/remote toggle behavior._

---

## Technical Design

This feature uses the pure-background Enabler exception: there is no browser UI
or visual design artifact to baseline first. The interaction surface is prompt
flow + markdown artifacts, so technical design can proceed directly from the
DRAFT spec + system journeys.

### Architecture

Add the capability as a thin, file-backed workflow phase rather than a new
runtime subsystem.

Primary placement:
- optional interstitial phase after `validate-feature` and before `write-spec`

Allowed re-entry points:
- `write-spec`
- `design-ux`
- `design-tech`
- `review-gate`

Re-entry rule:
- only when the current phase encounters unresolved one-way-door ambiguity that
  is not already covered by an active discussion artifact

The implementation should stay small:
- one new skill: `discuss-phase`
- one helper script: `scripts/discussion-artifact.mjs`
- targeted contract edits in `route-workflow`, `review-gate`, and the upstream/downstream consuming skills

```text
route-workflow / explicit user call
        |
        v
classify topic
  | broken behavior? -------- yes --> diagnose-bug
  | no
  | value / wedge ambiguity? - yes --> validate-feature
  | no
  v
ambiguity trigger score
  | < 4 and no explicit request --> continue current lane
  | >= 4 or explicit request
  v
discuss-phase
  | read source artifacts
  | scout code/docs
  | classify gray areas
  | choose / defer / block / reroute
  v
discussion artifact + decision-log append
        |
        +--> downstream pre-flight readers
        +--> review-gate contradiction check
        +--> route-workflow next-skill recommendation
```

### Components

| Component | Type | Responsibility | New/Modify |
|-----------|------|---------------|------------|
| `discuss-phase/SKILL.md` | Skill | Run the discussion workflow, create the artifact, score ambiguity, and emit proceed/block/reroute outcome | New |
| `scripts/discussion-artifact.mjs` | Helper | Validate frontmatter, summarize artifact status, and provide machine-safe reads for routing/review | New |
| `route-workflow/SKILL.md` | Router contract | Compute trigger score, apply reroute precedence, and invoke the phase when required | Modify |
| `write-spec/SKILL.md` | Downstream consumer | Read discussion artifact during pre-flight and treat `decided` items as fixed constraints | Modify |
| `design-ux/SKILL.md` | Downstream consumer | Read discussion artifact before proposing UX flows when the topic has open or decided UX gray areas | Modify |
| `design-tech/SKILL.md` | Downstream consumer | Read discussion artifact before making technical decisions for the same topic | Modify |
| `review-gate/SKILL.md` | Enforcement | Fail G4/G5 when implementation contradicts settled discussion decisions without revision-log supersession | Modify |
| `test-framework/evals/tier-1/validate-discussion-phase-contracts.sh` | Eval | Static replay of trigger rules, schema contract, and review enforcement wording | New |

### Data Model

The persisted model is the discussion artifact at
`docs/specs/discussions/<topic>.md`.

#### Frontmatter schema

| Field | Type | Meaning |
|-------|------|---------|
| `topic` | string | Stable topic slug, derived from feature name, work item, or framework gap |
| `target` | string | Primary artifact or source being discussed |
| `repo_mode` | `bootstrap` \| `convert` \| `framework` | Routing context |
| `authoring_mode` | `new-feature` \| `extend-feature` \| `bugfix-behavior` \| `contract-change` \| `framework-gap` | Why discussion was opened |
| `status` | `open` \| `proceed` \| `blocked` \| `rerouted` \| `not-needed` | Terminal state for this run |
| `ambiguity_before` | integer 0-10 | Trigger score before discussion |
| `ambiguity_after` | integer 0-10 | Residual ambiguity after discussion |
| `open_count` | integer | Gray areas still unresolved but not blocking |
| `blocking_count` | integer | One-way-door items still blocking |
| `recommended_next_skill` | string | Next routed skill when status is `proceed` or `rerouted` |
| `source_refs` | array<string> | Files or work items read during discussion |
| `updated` | ISO date | Last update timestamp |

#### Gray Area Register

| Column | Meaning |
|--------|---------|
| `id` | Stable local identifier like `GA-01` |
| `category` | `scope` \| `ux` \| `contract-data` \| `operations` \| `sequencing-ownership` |
| `reversibility` | `two-way-door` \| `one-way-door` |
| `magnitude` | `low` \| `medium` \| `high` |
| `signal_score` | Weighted trigger score for this item |
| `status` | `open` \| `decided` \| `deferred` \| `blocked` \| `rerouted` |
| `downstream_phase` | Which skill or gate must consume this outcome |
| `decision_summary` | One-sentence recommendation or outcome |

#### Decision-log usage

No schema changes are needed for `.svc/pipeline-decisions.jsonl`.
Discussion events reuse existing types:
- `question`
- `answer`
- `taste`
- `user`
- `mechanical`

### Data Flow

```text
1. route-workflow classifies the topic
2. reroute precedence runs before ambiguity scoring
3. if discussion is still the right lane, compute trigger score
4. discuss-phase reads source artifacts and scouts relevant code/docs
5. discuss-phase writes docs/specs/discussions/<topic>.md
6. discuss-phase appends material decisions to pipeline-decisions.jsonl
7. route-workflow or the caller consumes the artifact status:
   - proceed -> next skill
   - blocked -> stop and await decision
   - rerouted -> invoke reroute target
   - not-needed -> continue normal lane
8. downstream skills read the artifact in pre-flight
9. review-gate checks settled decisions against later artifacts/diffs
```

### External Dependencies

None.

Implementation must use:
- existing markdown + YAML frontmatter conventions
- existing `pipeline-log.mjs`
- Node built-ins only for the new helper script

No new third-party package should be introduced for scoring, frontmatter
validation, state machines, or routing.

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Capability form | Standalone `discuss-phase` skill | Keeps gray-area handling explicit and routable instead of overloading `validate-feature` |
| Storage format | Markdown artifact with YAML frontmatter | Matches repo conventions and stays readable for humans |
| Machine enforcement | Small Node helper script | Strong enough for routing/review without creating a new subsystem |
| Trigger model | Weighted deterministic score | Easy to explain, test, and replay |
| Reroute precedence | bug/regression → validation gap → discussion → continue | Prevents discussion from swallowing problems that belong in another lane |
| Enforcement model | Pre-flight read + review-gate contradiction check | Lightest mechanism that still makes settled decisions durable |

### Trigger Scoring

Compute `ambiguity_before` as the sum of the strongest applicable signals:

| Signal | Score |
|--------|------:|
| Explicit user request to discuss gray areas | 3 |
| Unresolved one-way-door decision | 3 |
| Contradiction between upstream artifacts | 2 |
| Same topic reopened by a later phase or gate | 2 |
| Brownfield uncertainty requiring code-aware scouting | 1 |
| More than three unresolved categories in the same topic | 1 |

Thresholds:
- `0-1` → no discussion phase; continue current lane
- `2-3` → keep inside current phase as a local note unless user explicitly asked for discussion
- `4+` → open `discuss-phase`
- any unresolved one-way-door item remaining after discussion with confidence `< 7/10` → `blocked`

### Reroute Precedence

Apply this order before opening discussion:

1. **Broken known behavior or regression**
   Route to `diagnose-bug`
2. **Unvalidated demand, wedge, or feature value**
   Route to `validate-feature`
3. **True design ambiguity after 1 and 2 are cleared**
   Route to `discuss-phase`
4. **No actionable ambiguity**
   Continue the current lane

If multiple reasons apply, pick the highest-precedence route and record the
secondary signal in the discussion or decision log as follow-up context.

### Downstream Consumption Contract

Downstream skills consume discussion artifacts in pre-flight using this rule:

- if no discussion artifact exists for the topic, continue normally
- if artifact `status: proceed`, treat every `decided` row as a fixed input
- if artifact `status: blocked`, stop and report the blocking items
- if artifact `status: rerouted`, hand off to `recommended_next_skill`
- if artifact `status: not-needed`, ignore the artifact for decision making and continue

`review-gate` enforcement:
- G4 checks the technical design against any settled discussion decisions
- G5 checks the executed diff against the same decisions
- contradiction without a `Revision Log` entry that explicitly supersedes the discussion decision is a FAIL

### Feature Toggle System

No feature toggles required.

The capability has no external integrations and no credentialed runtime path.
Local, staging, and production behavior should be identical because the feature
is documentation- and routing-driven.

### Mock Architecture

Mocking is artifact-based rather than service-based:
- sample feature spec or framework gap text
- sample work item
- sample brownfield `project-state.md` / `router-context.md`
- sample contradictory upstream artifacts

The helper script should support validating example discussion artifacts without
needing network access or credentials.

### First-Demo Guarantee

The full capability must run locally with:
- zero credentials
- zero network access
- only repo files and prompt input

If research evidence is unavailable, the phase still runs using local artifacts
and labels the residual uncertainty explicitly rather than failing open.

### Dependency Graph

```text
route-workflow
    |
    +--> discuss-phase
            |
            +--> discussion-artifact helper
            |
            +--> pipeline-log.mjs
            |
            +--> docs/specs/discussions/<topic>.md
                    |
                    +--> write-spec
                    +--> design-ux
                    +--> design-tech
                    +--> review-gate
```

### Adversarial Engineering Review

- `[Layer 1] [Confidence: 9/10]` Do not build a new state store or workflow engine. Existing markdown artifacts plus `pipeline-decisions.jsonl` already provide the persistence model the capability needs.
- `[Layer 1] [Confidence: 8/10]` Avoid a JSON-only artifact. The repo is docs-first, and humans need to read discussion output directly during reviews.
- `[Layer 2] [Confidence: 8/10]` Do not add a third-party scoring, state-machine, or frontmatter package. This repo currently relies on thin Node helpers and markdown contracts; a trendy orchestration dependency would spend an innovation token without real product value.
- `[Layer 3] [Confidence: 8/10]` Reroute precedence must run before ambiguity scoring. This prevents a real bug or validation gap from being misclassified as a discussion topic, which is the simplest way to eliminate the inconsistent-lane risk surfaced by the journeys.

### Feasibility Matrix

| AC | Description | Feasible? | Notes |
|----|-------------|-----------|-------|
| DISC-01 | Capability can be invoked explicitly when the user asks to discuss gray areas or unresolved choices | ✅ | Direct invocation path is the new `discuss-phase` skill |
| DISC-02 | `route-workflow` recommends the capability when unresolved, hard-to-reverse decisions remain after `validate-feature` or while drafting a brownfield extension | ✅ | Trigger scoring added to `route-workflow` with post-`validate-feature` primary placement |
| DISC-03 | Capability scans existing artifacts before asking questions and excludes decisions already settled in project state, router context, decision logs, or feature specs | ✅ | Pre-flight artifact scan + helper summary support |
| DISC-04 | Each gray area is tagged with one category from a controlled set | ✅ | Fixed category enum in artifact schema |
| DISC-05 | Active discussion scope is capped at 3-7 gray areas per run | ✅ | Skill contract can batch extras into deferred rows |
| DISC-06 | When no actionable gray areas remain, capability emits a "discussion not needed" result and routes directly to the next skill | ✅ | `status: not-needed` + `recommended_next_skill` |
| DISC-07 | Each gray area is classified by reversibility and magnitude before a recommendation is made | ✅ | Required register columns |
| DISC-08 | Each irreversible or high-magnitude gray area includes 3-5 ranked alternatives with trade-offs | ✅ | Core skill output contract; no extra runtime needed |
| DISC-09 | Each reversible, low-magnitude gray area includes a recommended default and an explicit override path | ✅ | Stored as `decided` or `open` rows plus decision summary |
| DISC-10 | Brownfield runs perform code-aware scouting of relevant files before questioning or recommending | ✅ | Skill pre-flight requires targeted code/doc reads for brownfield topics |
| DISC-11 | Each recommendation cites concrete evidence: repo artifact, code path, framework state, or research source | ✅ | Evidence notes section + decision-log provenance |
| DISC-12 | Interactive mode asks one focused question per open gray area instead of a broad questionnaire | ✅ | Skill interaction model can iterate row-by-row |
| DISC-13 | Auto mode records the recommended default, confidence, and the evidence that would reverse the recommendation | ✅ | Decision card format in artifact body |
| DISC-14 | Capability writes `docs/specs/discussions/<topic>.md` with frontmatter and structured sections for gray areas, decisions, blockers, and next-step routing | ✅ | Primary persisted model |
| DISC-15 | Each gray area in the artifact has a status of `open`, `decided`, `deferred`, or `blocked` | ✅ | Fixed register enum |
| DISC-16 | Each decided item maps to the downstream artifact or phase it constrains | ✅ | `downstream_phase` column |
| DISC-17 | Unresolved one-way-door items are marked blocking with an explicit owner and required next decision | ✅ | Blocking rows + dedicated blocking section |
| DISC-18 | Deferred items are written to a tracked defer list or work item with the trigger condition for revisiting them | ✅ | Defer section in artifact + work-item projection |
| DISC-19 | Material decisions are appended to `.svc/pipeline-decisions.jsonl` with the correct decision type and provenance | ✅ | Reuse existing `pipeline-log.mjs` helper |
| DISC-20 | When a discussion artifact exists for the current topic, `write-spec`, `design-ux`, and `design-tech` read it before making new choices in the same area | ✅ | Downstream pre-flight contract edits |
| DISC-21 | `route-workflow` can use the artifact to recommend the next skill: proceed, block, or reroute | ✅ | Artifact status + helper summary are machine-readable |
| DISC-22 | If discussion reveals the problem is actually unvalidated demand or wedge ambiguity, the capability reroutes to `validate-feature` instead of continuing downstream | ✅ | Deterministic reroute precedence |
| DISC-23 | If discussion reveals the issue is broken known behavior rather than new-feature ambiguity, the capability reroutes to `diagnose-bug` | ✅ | Deterministic reroute precedence |
| DISC-24 | `review-gate` can fail work that contradicts a settled discussion decision unless the spec's revision log explicitly supersedes it | ✅ | Add G4/G5 contradiction check keyed off the artifact |
| DISC-ZERO | When invoked without an existing target spec, capability derives a bounded topic from the prompt, work item, or framework gap and still produces a valid discussion artifact | ✅ | Zero-state mode uses prompt + framework gap/work item as `target` |
| DISC-25 | Artifact frontmatter includes `target`, `repo_mode`, `authoring_mode`, `ambiguity_before`, `ambiguity_after`, `open_count`, `blocking_count`, and `recommended_next_skill` | ✅ | Defined in frontmatter schema and helper validation |
| DISC-26 | Output ends with a concise proceed, block, or reroute summary that downstream routing can consume directly | ✅ | Added to skill terminal summary contract |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Trigger score is too sensitive | Discussion opens too often and slows the pipeline | Keep the rubric small, set threshold at 4, and include a `not-needed` outcome |
| Trigger score is too weak | Real ambiguity leaks into later phases | Re-entry allowed from `write-spec`, `design-ux`, `design-tech`, and `review-gate` when a one-way-door decision is still unresolved |
| Artifact schema drifts across runs | Routing and review become unreliable | Use `scripts/discussion-artifact.mjs` for validation and summary extraction |
| Reroute precedence is applied inconsistently | Same topic lands in different lanes across sessions | Encode precedence order in `route-workflow` and add tier-1 replay coverage |
| Enforcement is advisory only | Settled decisions still get ignored downstream | Make downstream pre-flight reads mandatory and fail contradictions in `review-gate` |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|-----------|-------|------|-----------|
| Capability shape | Standalone skill | Expanding `validate-feature` | Keeps the contract explicit and topic-scoped |
| Artifact format | Markdown + frontmatter | JSON-only | Better fit with repo conventions and review ergonomics |
| Enforcement | Pre-flight + gate checks | New central workflow engine | Enough enforcement without creating a new runtime layer |
| Trigger logic | Weighted threshold | Pure operator judgment | Easier to test and replay across hosts |
| Resume semantics | Reopen from blocked rows in the artifact | Separate discussion state store | Uses the same file-backed continuity doctrine as the rest of svc |

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute (local agent/runtime work) | ~1 extra skill invocation + helper validation | 5-20 discussion runs/mo in heavy framework work | ~$0.50-$10 in model/runtime cost depending on host/model mix | Linear with invocation count | Builder / framework operator |
| Storage (artifact files) | ~2-8 KB per discussion artifact | 20 artifacts/mo baseline | Negligible (<1 MB/mo) | Linear with artifact count | Git repo storage |
| Bandwidth | $0 local-only path | 0 network required for base capability | $0 | Flat unless research is invoked | N/A |
| External API calls | $0 by default | 0 unless `research` is explicitly used | $0 baseline | Optional and operator-controlled | Builder / framework operator |
| Background jobs | $0 | None | $0 | Flat | N/A |

**Scaling trigger points:**
- No infrastructure tier change is needed for normal usage
- The real cost bend is model spend if discussion is opened on too many low-value topics
- Red line: if discussion runs become common enough to add noticeable operator friction without reducing downstream churn, the trigger rubric needs retuning rather than more infrastructure

**First-month and year-1 projections:** approximately `$0.50-$10/mo` for ordinary framework use, remaining effectively zero on storage and infrastructure unless optional research is invoked heavily.

**Zero-cost justification:** no deployed service, no database, no network requirement, and no background processing. Only local repo files and existing agent/runtime execution are consumed.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| **Owner** | svc framework maintainers |
| **On-call** | No paging; best-effort maintenance |
| **SLA / SLO** | Best effort, no external availability guarantee |
| **Error budget** | N/A for best-effort framework docs/skill behavior |
| **Monitoring** | Tier-1 eval coverage, skills-manifest lint, and review of resulting discussion artifacts |
| **Alerting** | None automated; failures surface through eval runs and framework use |
| **Dashboard** | None |
| **Runbook** | `FRAMEWORK-STATE.md`, the feature spec, and tier-1 eval output |
| **Failure modes** | Over-triggering, under-triggering, wrong reroute precedence, stale discussion artifacts, contradictions missed by downstream phases |
| **Recovery procedure** | Fix the contract or helper, regenerate the artifact, re-run tier-1 evals, and update framework memory |
| **Backup / restore** | Git history is the backup/restore mechanism for specs, skills, and helper scripts |
| **Dependencies' failure impact** | If local file reads fail or artifacts are malformed, discussion cannot proceed safely and should fail closed rather than continue |

---

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[NEW]` | Closes a known framework gap between validation and downstream design/planning |
| 2 | Journey | `[NEW]` | System journey: route into discussion, settle gray areas, hand off with explicit next step |
| 3 | Acceptance criteria | `[NEW]` | 26 ACs across 5 stories in this spec |
| 4 | UX | `[NEW]` | CLI/question-flow UX matters: bounded prompts, focused questions, clear proceed/block/reroute result |
| 5 | UI | `[N/A — justified: no browser or visual interface; output is a markdown artifact plus routed next step]` | — |
| 6 | Tech architecture | `[NEW]` | Requires a new skill/artifact contract and integration with routing + review phases |
| 7 | Cost model | `[NEW]` | Adds one extra prompt phase when ambiguity is real; should reduce downstream rework and review churn |
| 8 | Operations & ownership | `[NEW]` | Framework-owned capability; requires artifact stability and eval coverage in this repo |

---

## Implementation Notes

- `PLANNED` — `discuss-phase/SKILL.md` (new skill for the discussion workflow)
- `PLANNED` — `scripts/discussion-artifact.mjs` (helper for schema validation + summary extraction)
- `PLANNED` — `route-workflow/SKILL.md` (trigger scoring, reroute precedence, next-skill handling)
- `PLANNED` — `write-spec/SKILL.md` (discussion-artifact pre-flight read contract)
- `PLANNED` — `design-ux/SKILL.md` and `design-tech/SKILL.md` (same pre-flight consumption contract)
- `PLANNED` — `review-gate/SKILL.md` (G4/G5 contradiction enforcement against settled discussion decisions)
- `PLANNED` — `test-framework/evals/tier-1/validate-discussion-phase-contracts.sh` (static replay coverage)

---

## Journey References

| Journey | Scenarios | ACs Covered | Type |
|---------|-----------|-------------|------|
| J01: Resolve Gray Areas And Proceed | Detect a real gray-area cluster and keep it bounded; Research hard choices before recommending defaults; Ask focused questions for reversible choices; Save the discussion record and hand work forward | DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-07, DISC-08, DISC-09, DISC-10, DISC-11, DISC-12, DISC-13, DISC-14, DISC-15, DISC-16, DISC-19, DISC-20, DISC-21, DISC-25, DISC-26 | System |
| J02: Block Or Reroute When Discussion Cannot Safely Proceed | Return "discussion not needed" when the choices are already settled; Block on unresolved one-way-door choices; Reroute back to validation when the issue is still product uncertainty; Reroute broken-behavior topics and preserve settled decisions | DISC-06, DISC-17, DISC-18, DISC-22, DISC-23, DISC-24 | System |
| J03: Start Discussion From A Zero-State Prompt | Derive a bounded topic and produce a valid discussion record; Use available evidence even when the artifact set is thin | DISC-01, DISC-ZERO, DISC-07, DISC-11, DISC-14, DISC-15, DISC-25, DISC-26 | System |

---

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|------|----|-----|-----|-----|----------|
| 2026-04-10 | — | — | Initial DRAFT | Feature spec created from `FRAMEWORK-STATE.md` Known Gaps and GSD discuss-phase reference material | write-spec |
| 2026-04-10 | (status) | DRAFT | BASELINED | Technical design added: pipeline placement, schema, trigger scoring, reroute precedence, and downstream enforcement | design-tech |
