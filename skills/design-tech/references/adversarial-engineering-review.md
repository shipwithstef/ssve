## Adversarial Engineering Review (after tech design is drafted)

P0 challenges the architecture before it's finalized. This is a structured
adversarial review using the three-layer framework. Every recommendation
must be tagged. Work through each review section interactively (max 8 issues
per section).

### The Three Layers

Every technical recommendation falls into one of three layers. Tag each one.

**[Layer 1] Tried and true** — don't reinvent. Use what exists. Flag any
custom solution where a built-in or well-established library already solves
the problem. Inspect the current repo and installed ecosystem first (ANALYSIS).
Do not unconditionally search npm, PyPI, crates.io, or the web before building.
External registry or docs lookup runs only when `researchDecision(question)`
returns `external_research_required`. If the team is writing a custom date parser, a bespoke HTTP client,
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
| Analyze-before-build | Every new dependency: is there a simpler built-in/in-repo way? New dependency/API choice is a consequential amendment, not an automatic research trigger. | [Layer 1] |
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
