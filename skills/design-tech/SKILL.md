---
name: design-tech
version: "1.0"
handles_concerns:
  - paid-external-api
  - data-model-mutation
description: Use when you have a DESIGNED feature spec (after UX and UI design) and need to define architecture, tech choices, and component design before implementation
phases:
  - id: P1-SpecJourneyDiscussionPreflight
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/journeys/J*-<name>.feature.md", "docs/specs/discussions/<topic>.md when present"]
    writes: [".svc/pipeline-decisions.jsonl when discussion routing affects design"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-CodebasePatternAnalysis
    trigger: always
    reads: ["src/", "app/", "lib/", "components/", "package.json", "go.mod", "requirements.txt", "pyproject.toml"]
    writes: [".svc/design-tech-codebase-analysis.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ArchitectureAlternativesAndDiagrams
    trigger: always
    reads: ["references/design-alternatives.md", "docs/specs/features/<name>.md", "docs/specs/ui/<name>.md"]
    writes: ["docs/specs/features/<name>.md", "docs/specs/tech/<name>.md when using separate tech output"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-CostOpsFeasibilityRiskDesign
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/journeys/J*-<name>.feature.md", "docs/specs/analyze-competitors.data.json when present"]
    writes: ["docs/specs/features/<name>.md", "docs/specs/tech/<name>.md when using separate tech output"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-G4ReviewAndDecisionLogging
    trigger: always
    reads: ["docs/specs/features/<name>.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/pipeline-decisions.jsonl", ".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-BaselinedSpecSelfVerify
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/tech/<name>.md when using separate tech output"]
    writes: ["docs/specs/features/<name>.md"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/specs/journeys/J*-<name>.feature.md", artifact: journey-docs }
  optional:
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
    - { path: "docs/specs/ui/<name>.md", artifact: ui-design }
outputs:
  produces:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec, status: BASELINED }
chain:
  lanes:
    greenfield: { position: 15, prev: track-visuals, next: explore-solutions }
    brownfield-feature: { position: 10, prev: track-visuals, next: explore-solutions }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Writing Technical Design

**Runtime v2 continuation:** Register the baselined spec and its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve architecture, security, data, operations and G4 obligations.

## Overview

Technical design answers HOW to build what the spec defines. It takes a DESIGNED feature spec (after UX and UI design) and produces the architecture, component design, data model, and technology decisions needed to implement it.

This skill transitions a feature spec from DESIGNED → BASELINED.

```
write-spec              → DRAFT (WHAT: stories, ACs, journeys)
design-ux         → UX-REVIEWED (HOW users experience it: flows, states)
design-ui         → DESIGNED (HOW it looks: components, visual language)
design-tech  → BASELINED (HOW to build it: architecture, data model)
plan-changeset        → implementation manifest + task graph
execute-changeset      → CHANGE-SET-APPROVED (DO: execute the plan on branch)
land-changeset      → PROMOTED (APPLY: reviewed branch state to codebase)
verify-promotion       → VERIFIED (PROVE: tests pass, QA complete)
```

**Announce at start:** "I'm using the design-tech skill to define the technical approach."

## Product Questions — MANDATORY format

Ground architecture, concurrency, scalability and cost choices in the current spec and affected implementation dependencies. Follow `_shared/product-question-format.md` with `phase: design-tech`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work. BASELINED requires the shared promotion predicate.

## Discussion Artifact Pre-Flight

Before finalizing architecture, check for a matching discussion artifact at
`docs/specs/discussions/<topic>.md`.

If one exists:

- read it before making technical choices in the same area
- treat `decided` rows as fixed inputs to the technical design
- if the artifact status is `blocked`, stop and surface the blocker instead of designing through it
- if the artifact status is `rerouted`, hand off to `recommended_next_skill`
- if technical design encounters unresolved one-way-door ambiguity not already
  covered by an active discussion artifact, route to `discuss-phase` before completing G4

## Design Alternatives

For each key decision in this phase (architecture, data model, API pattern,
state management), follow the Design Alternatives Protocol
(`references/design-alternatives.md`).

## Solution Confidence Mode

Before finalizing technical design, check `.svc/lane-tasks-<WI>.json`,
the active decision workspace, and the latest user prompt for
`solution_confidence_required: true` or confidence phrases such as "best
solution", "right design", "all cards on the table", "golden standard",
"real examples", "cost/caching", or "before the plan".

When active, load `references/solution-confidence-protocol.md` and inspect
`solution_confidence_mode`.

- `design_auto`: produce or update
  `docs/specs/decisions/<YYYY-MM-DD-slug>/SOLUTION-CONFIDENCE.md`, complete the
  technical design work needed to choose the direction, then continue through
  the normal lane.
- `post_design_human_gate`: produce or update
  `docs/specs/decisions/<YYYY-MM-DD-slug>/SOLUTION-CONFIDENCE.md`, complete the
  technical design work needed to choose the direction, then stop before
  `plan-changeset` for user approval.
- `intake_only`: append evidence to the decision workspace and stop at the
  explicit intake boundary instead of writing a final technical design.

Human gates are not default. They happen after design only when explicitly
requested.

The confidence artifact must cover current implementation, prior decisions,
web/mobile/native surfaces, user perception, cache/freshness classes, cost
model, at least five sourced real-world examples, options considered, tradeoff
matrix, action-by-action approval packet, outcome coverage, proof gates, and
triage of external/AI suggestions. The approval packet must state what changes,
why each action exists, how it would be achieved, positive outcome,
negative/risk outcome, impact if skipped, and required proof before closeout.
Suggestions from Base44 or other assistants must be evaluated as evidence, not
accepted. `plan-changeset` waits for this artifact to select a direction or
record a measured "not ready yet" stop; after that it proceeds automatically
unless `post_design_human_gate` is active. In `post_design_human_gate`, do not
ask the user to approve until the approval packet is complete.

## Capability and Inertia Pre-Flight

Before choosing an architecture that extends an existing integration, SDK,
framework pattern, or API surface, prove that the foundation is still the
right one to build on.

1. Identify capability assumptions in the spec: external APIs, host features,
   provider permissions, SDK methods, browser/native APIs, data stores,
   payment/auth/search/geocoding/AI services, and any "we can just..." claim.
2. If availability is uncertain, run the smallest code or provider scan before
   finalizing design. Use project-local truth first, then route to the right
   skill:
   - missing business capability -> `validate-feature`
   - unknown provider/API behavior -> `research`
   - capability inventory or project-fit question -> `capability-registry` /
     `capability-concierge`
   - auth/token/provider setup blocker -> the provider environment skill
3. If the work extends existing code, scan the affected files for deprecated
   foundations:

```bash
node scripts/validate-deprecated-foundations-registry.mjs --root .
node scripts/scan-deprecated-foundations.mjs --root . --path <file-or-dir> --first-hit-codebase-scan --promote-findings .svc/deprecated-foundation-findings.jsonl --fail-on-findings
```

4. If the scan finds a deprecated foundation, stop normal design and record a
   migrate-vs-extend decision in the technical design. A deliberate extension
   must name the successor, migration size, why migration is deferred, and the
   child WI that owns the migration debt. Confirmed project-local findings are
   promoted per `references/deprecated-foundations-lifecycle.md`.

Do not design through a capability blocker. Route before implementation churn.

## Adversarial Engineering Review (after tech design is drafted)

P0 challenges the architecture before it's finalized. This is a structured
adversarial review using the three-layer framework. Every recommendation
must be tagged. Work through each review section interactively (max 8 issues
per section).

### The Three Layers

Every technical recommendation falls into one of three layers. Tag each one.

**[Layer 1] Tried and true** — don't reinvent. Use what exists. Flag any
custom solution where a built-in or well-established library already solves
the problem. Search npm, PyPI, crates.io, or the relevant ecosystem before
building. If the team is writing a custom date parser, a bespoke HTTP client,
or a hand-rolled state machine that `xstate` already handles — that's a
Layer 1 violation.

**[Layer 2] New and popular** — scrutinize. Adoption enthusiasm does not
equal proven reliability. When the design reaches for a trending library,
a new framework feature, or a pattern that went viral on Twitter last month,
apply extra skepticism. Ask: how many production-hours does this have? What's
the bus factor on the maintainer team? Is the API stable or still churning?
Layer 2 choices need stronger justification than Layer 1.

**[Layer 3] First principles** — prize above all. When first-principles
reasoning produces a better answer than convention, that is a **[EUREKA]**
moment. These are rare and valuable: a novel data structure that eliminates
an entire class of bugs, an unconventional architecture that halves latency,
a simplification that removes three services. Document the reasoning chain
clearly. If someone can't follow the logic from axioms to conclusion, it's
not a real EUREKA — it's a Layer 2 risk dressed up.

Tag every recommendation: `[Layer 1]`, `[Layer 2]`, `[Layer 3]`, or `[EUREKA]`.

### Review Sections

Work through each section interactively. Max 8 issues per section. Present
findings with the layer tag and a recommended fix.

#### 1. Architecture

- Data flow: trace every user action through the system end-to-end. Where
  does data enter? Where does it rest? Where does it exit?
- System Contract Map: for OAuth, hosted login, SSO, payments, webhooks, deep
  links, native/WebView handoffs, sync, streaming tool calls, provider
  callbacks, or any flow crossing runtimes/origins/protocols/SDKs/storage
  layers, create `docs/specs/contract-maps/<flow-name>.md` from
  `_shared/system-contract-map.md` and validate it with
  `node scripts/validate-system-contract-map.mjs --map <path>`.
- Component boundaries: are responsibilities cleanly separated? Can you
  describe each component's job in one sentence?
- Dependency graph: draw it. Are there circular dependencies? Is the
  coupling appropriate (stable dependencies principle)?
- Integration points: where does this feature touch existing code? What's
  the contract at each boundary?
- **Feature toggle system** — the design must define the toggle mechanism
  for this project (env vars, config file, or runtime flag). Every external
  integration identified in the spec's System Dependencies table gets a
  toggle. Define:
  - Where toggles are read (e.g., `src/config/toggles.ts`)
  - How mock implementations are structured (e.g., `src/mocks/`)
  - The environment matrix: what's real in local / staging / production
  - How toggling works at runtime vs build time
- **Mock architecture** — for each external dependency, define the mock
  implementation. Mocks must be realistic enough to exercise the full AC —
  a mock Stripe that returns `{ success: true }` is not enough if the AC
  says "user sees a payment confirmation with transaction ID." The mock
  must return a realistic response shape.
- **First-demo guarantee** — confirm that the architecture supports running
  the full feature locally with zero credentials and zero network access.
  If it doesn't, redesign until it does.

#### 2. Code Quality

- **DRY** — any duplicated patterns across proposed components? Extract
  shared logic before it ships, not after.
- **Explicit over clever** — can a new team member read this design and
  understand what happens? If a component requires a paragraph of
  explanation for its "elegant" approach, simplify it.
- **Boring by default** — standard patterns unless there's a documented
  reason to deviate. Every deviation costs future-you.
- **Naming** — do component, service, and model names describe what they
  do without needing context?

#### 3. Tests

- **Test matrix** — for each component, what needs unit tests, integration
  tests, and E2E tests? Make the decision explicit.
- **Coverage gaps** — which code paths have no proposed test? Especially:
  error paths, edge cases, permission boundaries.
- **E2E vs unit** — E2E for critical user journeys, unit for logic-heavy
  functions. Don't E2E what a unit test covers faster. Don't unit-test
  what only makes sense as an integration.
- **Test data** — where does test data come from? Fixtures, factories,
  or mocks? Is the strategy consistent?

#### 4. Performance

- **N+1 queries** — any list endpoint that fetches related data in a loop?
  Propose eager loading or batch fetching.
- **Unnecessary re-renders** — in frontend designs, are component
  boundaries drawn to minimize re-render blast radius? Are expensive
  computations memoized?
- **Cold start impact** — does this feature add to cold start time? New
  DB connections, large imports, initialization logic?
- **Payload size** — are API responses shaped for the consumer? No
  over-fetching, no sending the kitchen sink?

#### 5. Motion Guardrails (Hardware-Acceleration)

- **GPU-Only Rule:** Animate exclusively via `transform` and `opacity`.
- **Hard Ban:** Animating `top`, `left`, `width`, `height`, or `margin` is strictly BANNED for motion.
- **Micro-physics:** Prefer spring physics (`stiffness: 100, damping: 20`) over linear easing for a "weighty," premium feel.
- **Render Separation:** High-frequency mouse-follow or magnetic effects MUST use `useMotionValue` (Framer Motion) outside the React render cycle to prevent 60fps drops.

### Cognitive Patterns

These are the mental models that guide the review. Apply them as lenses
across all four sections above.

1. **State diagnosis** — is this team falling behind, treading water,
   repaying debt, or innovating? (Larson) The review's tone and
   recommendations change based on which state the project is in.

2. **Blast radius instinct** — what's the worst case? How many systems
   are affected? If this component fails at 3am, what breaks downstream?

3. **Boring by default** — "3 innovation tokens" (McKinley). Every
   project gets roughly three. Is this design spending one? Is it
   spending one wisely, or burning a token on something that doesn't
   differentiate the product?

4. **Incremental over revolutionary** — strangler fig, not big bang
   (Fowler). Can this design be shipped in slices that each deliver
   value? If it's all-or-nothing, that's a red flag.

5. **Systems over heroes** — design for tired humans at 3am. If the
   on-call engineer needs to understand a 4-layer abstraction to fix
   a production issue, the design is too clever.

6. **Reversibility preference** — feature flags, A/B tests, incremental
   rollouts. How easy is it to undo this change if it goes wrong?
   Irreversible decisions need proportionally more scrutiny.

7. **Failure is information** — blameless postmortems, error budgets
   (Google SRE). Does the design include observability? Can you tell
   when it's failing and why?

8. **Essential vs accidental complexity** — "Is this solving a real
   problem or one we created?" (Brooks). If the complexity exists to
   serve the abstraction rather than the user, remove the abstraction.

9. **Make the change easy, then make the easy change** (Beck) — if
   the design requires restructuring existing code, do the restructuring
   as a separate, testable step first.

10. **Two-week smell test** — if a competent engineer can't ship a small
    feature in 2 weeks using this architecture, it's an onboarding
    problem. The architecture is too complex or the documentation is
    insufficient.

### Confidence Scoring

Every finding must include a confidence score. This prevents speculation
from being presented as fact.

| Score | Meaning | Usage |
|-------|---------|-------|
| 9-10 | Verified by reading specific code — cite the file and line | Report as fact |
| 7-8 | High confidence pattern match — seen this exact failure mode before | Report with brief rationale |
| 5-6 | Moderate — plausible but not verified | Show with explicit caveat |
| 3-4 | Low — educated guess | Appendix only |
| 1-2 | Speculation — "this might..." | Only if P0 severity (production risk) |

Format: `[Layer N] [Confidence: X/10] Finding description.`

Example: `[Layer 1] [Confidence: 9/10] Custom date formatting in
src/utils/dates.ts duplicates what date-fns already provides — we
import date-fns elsewhere in the project (see package.json L42).`

### ASCII Diagram Requirements

Diagrams are mandatory, not decorative.

**Mandatory for:**
- Data flow (user action → frontend → API → backend → database → response)
- State machines (every state, every transition, every terminal state)
- Dependency graphs (component A depends on B depends on C)
- Processing pipelines (input → transform → validate → persist → respond)

**In code comments:**
- Models: data relationships between entities
- Services: processing pipelines and decision trees
- Tests: setup/teardown sequences for complex test fixtures

**Maintenance rule:** diagram maintenance is part of the change. A stale
diagram is worse than no diagram — it actively misleads. When the design
changes, the diagram changes in the same commit.

```
Example: Data Flow Diagram

  User Action
       |
       v
  +------------+     +-----------+     +----------+
  | Controller | --> | Service   | --> | Database |
  | (validate) |     | (process) |     | (persist)|
  +------------+     +-----------+     +----------+
       |                   |                |
       v                   v                v
  +------------+     +-----------+     +----------+
  | Response   | <-- | Transform | <-- | Query    |
  | (shape)    |     | (format)  |     | (fetch)  |
  +------------+     +-----------+     +----------+
```

### Scope Reduction Trigger

**If the design produces 8+ new files or introduces 2+ new classes/services:**

Stop the review. This is a scope reduction trigger.

1. **Explain what's overbuilt** — which components go beyond what the ACs
   require? Which abstractions are premature?
2. **Propose the minimal version** — what's the smallest set of changes
   that satisfies the ACs? What can be deferred to a follow-up?
3. **Ask whether to reduce** — present both versions (full and minimal)
   with the trade-offs. The team decides.

Rule of thumb: if you can't explain the feature's technical design in a
5-minute standup, it's too big for one change set.

### Mandatory Checks (summary)

| Check | What P0 verifies | Layer |
|-------|-----------------|-------|
| Scope smell | >8 new files or 2+ new classes/services → trigger scope reduction | All |
| Search-before-build | Every new dependency: is there a simpler built-in way? | [Layer 1] |
| Completeness | Build/deploy pipeline included? Not just app code? | [Layer 1] |
| DRY | Any duplicated patterns across the proposed components? | [Layer 1] |
| Boring by default | Using well-known patterns unless there's a strong reason not to? | [Layer 1] |
| Scrutinize the new | Any trending/new tech in the design? Justify harder. | [Layer 2] |
| First-principles wins | Any EUREKA moments? Document the reasoning chain. | [Layer 3] |
| ASCII diagrams | Data flow, state machines, dependency graphs present? | All |
| Confidence scores | Every finding tagged with a confidence score? | All |
| Reversibility | Can this be rolled back? Feature flags? Incremental rollout? | All |

For anything that fails: explain why and fix. In auto mode: P0 fixes.
In interactive mode: present findings with the layer tag, confidence
score, and P0's recommended fix.

## When To Use

- After design-ui produces a DESIGNED feature spec
- When a feature's requirements are clear but the technical approach isn't
- When the team needs to evaluate feasibility before committing to implementation
- Before invoking plan-changeset

## Prerequisites

| Artifact | Where | Required? |
|----------|-------|-----------|
| Feature spec (DESIGNED) | `docs/specs/features/<feature>.md` | Yes — must have user stories + ACs + UX and UI design |
| Journey doc(s) | `docs/specs/journeys/J*.feature.md` | Yes — must reference the feature's ACs |
| Style contract | `docs/specs/style-contract.md` | Optional — if exists, use its patterns. Produced by define-code-style AFTER this phase in greenfield. In brownfield, usually exists. |
| Domain profile | `docs/specs/domain-profile.md` | Tech stack, framework conventions (produced by analyze-domain) |

**Gate:** Do not start technical design without a DESIGNED spec (after UX and UI design). If the spec doesn't exist or lacks user stories and ACs, route to `write-spec` first. If UX/UI design hasn't been done, route to `design-ux` first. The only exception is pure background Enabler/Integration work with no human-visible surface; those skips must be explicit in the spec and journey set.

## Process

### Step 1: Read The Spec And Journeys

Read the DESIGNED feature spec and all referenced journey docs. Understand:
- What user stories need to be satisfied
- What ACs define "done"
- What journey flows exercise this feature
- What Layer 3 findings were flagged (dependencies, gaps)

### Step 2: Codebase Analysis

Scan the existing codebase to understand current patterns and constraints.

```bash
# Project structure
ls -la src/ app/ lib/ components/ 2>/dev/null

# Tech stack
cat package.json 2>/dev/null | head -30
cat go.mod 2>/dev/null | head -20
cat requirements.txt pyproject.toml 2>/dev/null | head -20

# Existing patterns
ls src/components/ src/services/ src/models/ 2>/dev/null
```

Identify:
- **Tech stack:** Languages, frameworks, libraries already in use
- **Patterns:** How existing features are structured (MVC, services, hooks, etc.)
- **Data layer:** Database, ORM, API patterns
- **Testing:** What test frameworks and conventions exist
- **Boundaries:** Where this feature touches existing code

### Step 2.5: Concern Scan (load matching concern checklists)

The framework ships 100+ structured concern checklists in `concerns/` (routing
primitives, not skills). Before architecting, run the concern scanner against the
files this design will create or touch, so the technical design addresses the
matched subject-matter checklists (auth-surface, data-model-mutation,
paid-external-api, pii-handling, etc.) up front instead of being caught at review.

```bash
node <SKILLS_PATH>/scripts/scan-concerns.mjs \
  --project <repo-root> \
  --paths <planned-or-touched-files> --json
```

For each matched concern, open its `source_file` checklist and fold its
requirements into the relevant Technical Design section (Architecture, Data Model,
External Dependencies, Cost Model, Operations). CRITICAL/HIGH matches whose
`required_skills` name a specialist (e.g. `review-security`, `manage-finops`) must
be reflected as an explicit design decision or routed as a follow-on task — not
left implicit. This is the same helper `audit-implementation` runs in its Phase
0.6 Concern Coverage Check, so design-time and audit-time use one source of truth.

### Step 3: Architecture Decision

Define the high-level approach. This is where you answer:

1. **Where does this feature live?** New module, extension of existing, new service?
2. **What components are needed?** UI components, services, models, API endpoints
3. **What data model changes?** New tables, columns, relationships, migrations
4. **What external dependencies?** Third-party APIs, libraries, services
5. **What's the data flow?** User action → frontend → API → backend → database → response

**Template:**
```markdown
## Technical Design

### Architecture

[2-3 sentences: high-level approach, where it fits in the codebase]

### Components

| Component | Type | Responsibility | New/Modify |
|-----------|------|---------------|------------|
| [Name] | [UI/Service/Model/API/Migration] | [What it does] | [New/Modify existing] |

### Data Model

[Schema changes, new tables/columns, relationships]
[If no data changes: "No data model changes required."]

### Data Flow

[Step-by-step: user action through system and back]

### External Dependencies

[New libraries, APIs, services — or "None"]

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| [What needs deciding] | [What we chose] | [Why — reference existing patterns or constraints] |

### Competitive Tech Alternatives (per WI-140 TECH-01..03)

When the feature touches core mechanics (earn / redeem / verify / enroll / loyalty / points / reward), this subsection is REQUIRED. Lists what each direct competitor uses for the same mechanic, what we're choosing, why ours differs.

```markdown
| Competitor | Their tech for this mechanic | What we use | Why we differ |
|-----------|------------------------------|-------------|---------------|
| Toast Loyalty | Native POS hook | OCR receipt scan | No POS partnership yet (WI-XXX); receipt OCR is compensating control |
| Square Loyalty | Square POS API | OCR receipt scan | Same reason |
```

If `landscape_state: populated` (per `docs/specs/analyze-competitors.data.json`) AND chosen tech matches NO competitor pattern, ALSO add an explicit ADR under Technical Design explaining the divergence (TECH-03). The ADR should cite the Compensating Control section in the spec (per CC-01).

### Cost Model

**Mandatory.** Every feature has a cost, even if it's "zero today on free tier." State it explicitly so future-you can spot when the cost curve bends.

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute (per-request CPU/memory) | [e.g., ~5ms Vercel function = $0.0000001] | [e.g., 10k req/mo baseline] | [e.g., ~$0.001] | [e.g., linear with requests] | [user business / customer / free tier] |
| Storage (persistent data) | [e.g., Supabase $0 up to 500MB] | [e.g., 1KB per row × 50k rows] | [e.g., $0 (free tier)] | [e.g., linear with rows] | [who] |
| Bandwidth (egress) | [e.g., Vercel $0 up to 100GB] | [e.g., 50MB/mo] | [e.g., $0] | [linear] | [who] |
| External API calls | [e.g., OpenAI $0.002/call] | [e.g., 500 calls/mo] | [e.g., $1] | [linear] | [user / business] |
| Background jobs | [e.g., cron, $0 on Vercel free tier] | [e.g., 1 run/hour] | [e.g., $0] | [constant] | [who] |

**Scaling trigger points:** when does this become expensive?
- At [X users / Y requests / Z GB] the free tier caps out
- At [X users] we move from [current tier] to [next tier] at [$Y/mo]
- **Red line:** [when does cost exceed revenue for a user segment?]

**First-month and year-1 projections:** [e.g., "$0 at 100 users, $12 at 1000 users, $85 at 10k users"]

**Zero-cost justification (if claiming $0):** [specific free-tier quotas being consumed + headroom]

### Operations & Ownership

**Mandatory.** Features don't run themselves. State who owns this in production and what happens when it breaks.

| Dimension | Answer |
|---|---|
| **Owner** | [Who maintains this code post-ship — name/role or "solo founder" for indie projects] |
| **On-call** | [Who gets paged when it breaks — or "no paging, best-effort response" for indie projects] |
| **SLA / SLO** | [e.g., "99.5% availability, <500ms p95 latency" or "best effort, no guarantee" — must be explicit] |
| **Error budget** | [e.g., "20 min downtime/month" or "N/A for best-effort" — must be explicit] |
| **Monitoring** | [What's being measured — uptime, latency, error rate, custom metric — and where (Plausible, Sentry, Grafana, none)] |
| **Alerting** | [What triggers a notification — specific thresholds — and where it goes (email, Slack, PagerDuty, none)] |
| **Dashboard** | [Link to the single-pane view or "none — no dashboard yet"] |
| **Runbook** | [Link to the "when X breaks, do Y" doc or "none — troubleshoot from code"] |
| **Failure modes** | [What are the known ways this fails? What happens to the user when it does?] |
| **Recovery procedure** | [How do we get it back up? Restart? Rollback? Manual intervention? Data restore?] |
| **Backup / restore** | [What data is backed up, how often, how do we restore it — or "N/A, stateless"] |
| **Dependencies' failure impact** | [If Supabase/Stripe/OpenAI goes down, what happens to this feature?] |

**"Best effort" is a valid answer for indie / pre-PMF projects** — but it must be explicitly stated, not implied. "No SLA" is acceptable. "Didn't think about SLA" is not.
```

### Step 4: Feasibility Check Against ACs

Walk through each AC from the spec and verify the technical design can satisfy it.

```markdown
### Feasibility Matrix

| AC | Persona pressure | Description | Feasible? | Notes |
|----|------------------|-------------|-----------|-------|
| MATCH-01 | P2 speed/trust | User sees matches sorted by compatibility | ✅ | Sorting in query, no new index needed |
| MATCH-02 | P2 freshness expectation | Matches update in real-time | ⚠️ | Requires WebSocket — adds complexity |
| MATCH-03 | P3 scheduling context | User can filter by timezone | ✅ | Filter on existing timezone column |
```

**If an AC is not feasible:**
- Explain why (technical constraint, dependency, cost)
- Propose alternatives that satisfy the user intent
- Flag as a **feedback loop** to write-spec — the AC or story may need revision

For user/admin-facing ACs, `Persona pressure` must cite a concrete persona ID/path
or `N/A - system-only`. This prevents technical design from optimizing away the
reason the AC exists.

**This is the critical gate.** If the design can't satisfy the spec, the spec needs to change. Don't proceed with a design that leaves ACs unsatisfied.

### Step 5: Risk And Trade-offs

Identify what could go wrong and what trade-offs the design makes.

```markdown
### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| [What could go wrong] | [Consequence] | [How to prevent or handle] |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|-----------|-------|------|-----------|
| [What's being traded] | [This approach] | [Alternative] | [Why] |
```

### Step 6: Trigger G4 Review

The technical design artifact is ready for Gate G4 review. Invoke the Review Protocol:

```
/review-gate --gate G4 --artifact docs/specs/features/<feature-name>.md --section "Implementation Notes"
```

G4 checks: All ACs feasible? Architecture sound? Risks identified? Trade-offs explicit?

**On PASS:** proceed to Step 7.
**On FAIL:** fix findings, re-trigger G4.
**On ESCALATE:** present to user.

### Step 7: Update The Feature Spec

Only after G4 PASS. Write the technical design into the feature spec and update status:

```markdown
# Feature: [Feature Name]

**Status:** BASELINED
```

Add the full technical design (architecture, components, data model, data flow, technology decisions, feasibility matrix, risks, trade-offs) under `## Implementation Notes`.

Mark all planned items as `PLANNED`:
```markdown
## Implementation Notes

- `PLANNED` — UserProfile service (new: src/services/userProfile.ts)
- `PLANNED` — ProfileCard component (new: src/components/ProfileCard.tsx)
- `PLANNED` — users table: add timezone column (migration)
```

### Decision Logging

After the technical design is written into the spec, log each Technology Decisions table row. The `run_id` comes from the active task graph.

```bash
# Each technology decision row (taste when alternatives existed, mechanical when obvious)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill design-tech \
  --phase "<task-id>" \
  --type "<taste|mechanical>" \
  --decision "Tech decision: <what was decided> — chose <choice>" \
  --reasoning "<rationale from the table's Rationale column>" \
  --decided-by P0 \
  --alternatives-json '["<alt 1>", "<alt 2>"]' \
  --overrideable true
```

Also log the feasibility matrix summary (how many ACs feasible/infeasible/mitigated) as a single `gate-result` entry.

### Step 8: Handoff

Present a summary:

```
Feature spec updated: docs/specs/features/<feature-name>.md
Status: BASELINED (was DRAFT)
Components: N new, M modified
Data model changes: [yes/no — summary]
Feasibility: [all ACs feasible / N ACs need spec revision]
Risks: [count]

Ready for solution exploration. Next step:
  "Run explore-solutions against docs/specs/features/<feature-name>.md"
```

**The terminal state is invoking explore-solutions, which then hands off to plan-changeset and execute-changeset.**

## Feedback Loops

Technical design often reveals problems upstream. Handle them:

| Discovery | Action |
|-----------|--------|
| AC is technically impossible | Route back to `write-spec` to revise the AC |
| Story assumes nonexistent capability | Route to `validate-feature` for the dependency |
| Capability availability is unknown | Run the capability/inertia pre-flight above, then route to `validate-feature`, `research`, `capability-registry`, `capability-concierge`, or the provider environment skill |
| Deprecated foundation found in target code | Record migrate-vs-extend decision; migrate now or file child WI before extending |
| Design requires new persona understanding | Route to `build-personas` (then return) |
| Journey flow doesn't match what's technically possible | Route to `write-spec` to re-run `write-journeys` |
| Existing code is too tangled to extend | Include refactoring as part of the design |

**Key principle:** It's cheaper to revise the spec now than to discover infeasibility during implementation.

### Auto-Invoke On-Demand Skills

Based on signals detected during technical design, conditionally insert these skills into the task graph:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| Cost Model pillar unanswered or requires infrastructure/platform selection | `manage-finops` | After Cost Model pillar evaluation | Hosting/provider choice blocks architecture decisions |
| Spec references tier gating, usage limits, or pricing boundaries but `docs/specs/monetization-architecture.md` is missing | `monetization-architecture` | After tech architecture pillar, before explore-solutions | Gating matrix must exist before hard-to-reverse architecture decisions |
| Unknown API, pattern, framework version, or domain concept encountered | `research` | Inline before the design step that needs the answer | Prevents architecture decisions based on stale training data |

If any on-demand skill is inserted, update `.svc/lane-tasks-<WI>.json` with the new task and set `blocked_by` so downstream work waits for the on-demand skill's output. Log the insertion as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`.

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Write code or over-spec exact file contents | That's not technical design's job | Define architecture, responsibilities, constraints, and file-level intent |
| Invent new patterns when existing ones work | Increases codebase complexity | Follow established project patterns unless they're clearly broken |
| Ignore existing tech stack | Creates maintenance burden | Use what's already there unless there's a strong reason not to |
| Design without reading ACs | Design may not satisfy requirements | Walk through every AC in the feasibility check |
| Skip risks and trade-offs | Surprises during implementation | Name them now — the team can decide if they're acceptable |
| Over-design | Premature abstraction, wasted effort | Design what the ACs require, not what might be needed someday |

## Routing

| Situation | Route to |
|-----------|----------|
| Design complete, spec BASELINED | `plan-changeset` then `execute-changeset` |
| AC not feasible, spec needs revision | `write-spec` (feedback loop) |
| Missing dependency discovered | `validate-feature` |
| Design reveals persona gap | `build-personas` (then return) |
| No DESIGNED spec exists | `design-ux` (prerequisite, or `write-spec` if no spec at all) |

## Audit Mode

When invoked with `--audit` to review existing technical design:

1. Read the technical design section in the feature spec
2. Check feasibility matrix: every AC still marked feasible given current codebase?
3. Check architecture against actual code: do the components described actually exist?
4. Check data model against actual schema: tables/columns match?
5. Check dependency versions: still current? Breaking changes since design was written?
6. Report: section-by-section PASS/WARN/FAIL

## Chrome Control Testability

For technical designs that introduce or alter layout/chrome components, verify
the UI design names every interactive chrome control with an accessible name
and stable app-controlled selector. Run:

```bash
node scripts/validate-design-chrome-testability.mjs --root .
```

This companion rule prevents later E2E positional selector exceptions by
requiring chrome controls to be testable before implementation starts.

## Retrieval-Augmented Reasoning (cutting-edge technique #9)

When you hit uncertainty mid-design, do NOT guess:
1. **Pause** the reasoning chain.
2. **Retrieve** the specific fact — grep the codebase, read the file slice, check the API doc or `references/knowledge/` node.
3. **Incorporate** it, then **continue** from where you paused.

Rules:
- Never guess when you can retrieve — retrieval cost < rework cost.
- Retrieve the minimum: grep before read; read the slice, not the whole file.
- Log non-trivial retrievals (what + why) in `.svc/pipeline-decisions.jsonl`.

Formalizes `rules/common/research-before-build.md` as a mid-reasoning loop, not just a session-start step.

## Pipeline Continuation

### Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `design-tech` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-SpecJourneyDiscussionPreflight --evidence command_output:.svc/design-tech-preflight.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-CodebasePatternAnalysis --evidence command_output:.svc/design-tech-codebase-analysis.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ArchitectureAlternativesAndDiagrams --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CostOpsFeasibilityRiskDesign --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-G4ReviewAndDecisionLogging --evidence command_output:.svc/design-tech-g4-review.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-BaselinedSpecSelfVerify --evidence file:docs/specs/features/<name>.md
```

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
| 1 | Feature spec status is BASELINED | grep for "BASELINED" in `docs/specs/features/<name>.md` | |
| 2 | Technical design section exists | grep for "## Technical Design" or "## Implementation Notes" in feature spec | |
| 3 | Feasibility matrix covers all ACs | Every AC from the spec has a row in the feasibility matrix | |
| 4 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |
| 5 | Cost Model sub-section present and filled | grep for "### Cost Model" in feature spec Technical Design; verify all rows populated (compute, storage, bandwidth, external APIs, background jobs) + scaling trigger points + first-month/year-1 projection. Zero-cost claim must have justification. | |
| 6 | Operations & Ownership sub-section present and filled | grep for "### Operations & Ownership" in feature spec Technical Design; verify all rows populated (owner, on-call, SLA/SLO, error budget, monitoring, alerting, dashboard, runbook, failure modes, recovery, backup/restore, dependency failure impact). "Best effort" is acceptable but must be explicit. | |

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
- Invoke next skill: `explore-solutions --progressive --lane <lane>`
  - In greenfield lane: `explore-solutions --progressive --lane greenfield`
  - In brownfield-feature lane: `explore-solutions --progressive --lane brownfield-feature`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: run `explore-solutions` if this design introduces a hard-to-reverse framework or architecture choice; otherwise continue to `define-code-style` if the approach is already established"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.
