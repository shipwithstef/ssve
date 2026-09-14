# Solution Map: feature-discussion-phase

## Paradigm A: First-Class Discussion Workspace

**Core bet:** gray-area resolution is its own workflow concern, so it deserves
an explicit phase and a topic-scoped artifact that downstream skills can read
directly.

### Approach A1: Dedicated phase + markdown artifact + helper (BASELINE)

- **How it works:** add `discuss-phase`, write
  `docs/specs/discussions/<topic>.md`, append major decisions to
  `pipeline-decisions.jsonl`, and use one small helper for schema validation and
  machine-safe reads.
- **Gains:** best fit with `DISC-14` through `DISC-26`; matches the repo's
  markdown-first conventions; keeps open, decided, deferred, blocked, and
  rerouted states in one readable place.
- **Gives up:** one new skill, one new artifact family, one helper script, and
  more pre-flight work in downstream skills.
- **Complexity:** moderate and targeted.

### Approach A2: Dedicated phase + markdown artifact only

- **How it works:** same as A1 but skip the helper; each consumer parses the
  artifact directly and applies its own validation rules.
- **Gains:** smallest implementation footprint among dedicated-phase options.
- **Gives up:** weak machine guarantees; repeated parsing logic; higher risk
  that routing and review interpret the same artifact differently.
- **Complexity:** low initially, higher over time because consumers drift.

## Paradigm B: Reuse Existing Decision Artifacts As Canonical Truth

**Core bet:** the main missing capability is disciplined decision capture, not a
new artifact family. Canonical truth should live where architectural decisions
already live.

### Approach B1: Decision-record-centric canonical source

- **How it works:** keep `docs/specs/decisions/<topic>.md` as the canonical
  record for rationale and chosen path; write a thin
  `docs/specs/discussions/<topic>.md` operational register that links to it for
  statuses, owners, and next-skill routing.
- **Gains:** reuses an existing tracked area; strong rationale history; familiar
  place for high-impact choices.
- **Gives up:** split source of truth between rationale and operational state;
  downstream consumers must know which file answers which question.
- **Complexity:** moderate to high because two artifacts stay coupled.

### Approach B2: Feature-spec-embedded gray-area register

- **How it works:** store the gray-area register inside the feature spec and
  generate a snapshot discussion artifact only when needed.
- **Gains:** keeps topic context near requirements and implementation notes.
- **Gives up:** poor fit for `DISC-ZERO`; weak for pre-spec invocation; pushes
  ambiguity handling later than the problem statement wants.
- **Complexity:** moderate, but with awkward zero-state bootstrapping.

## Paradigm C: Machine-First Registry With Human Views

**Core bet:** the hard part is deterministic downstream consumption, so the
canonical truth should be structured data and the markdown discussion file
should be a rendered view.

### Approach C1: Canonical YAML/JSON register + generated discussion markdown

- **How it works:** store each topic as structured YAML/JSON, generate
  `docs/specs/discussions/<topic>.md` for humans, and let routing/review read
  the structured file directly.
- **Gains:** strongest determinism, easiest cross-host parsing, straightforward
  future aggregation.
- **Gives up:** dual artifacts or generation step; higher drift risk; less
  natural for repo-native reviews.
- **Complexity:** high relative to the scope of this feature.

### Approach C2: Decision-log ledger + query/render helper

- **How it works:** make `pipeline-decisions.jsonl` the canonical source, then
  query it by topic to render a discussion summary and state view.
- **Gains:** reuses existing helper patterns and append-only history.
- **Gives up:** poor support for mutable open/deferred/blocked state; hard to
  represent "current truth" from an audit log alone.
- **Complexity:** deceptively high because topic reconstruction logic becomes
  the real subsystem.

## Paradigm D: Late Arbitration At Gates

**Core bet:** ambiguity should not get a separate phase; it should be resolved
where it becomes a concrete problem, mainly during design review or gate review.

### Approach D1: Review-gate and plan-stage arbitration only

- **How it works:** skip a new discussion phase and make `design-tech`,
  `plan-changeset`, and `review-gate` responsible for surfacing and resolving
  gray areas in place.
- **Gains:** no new artifact family and almost no new routing logic.
- **Gives up:** fails the stated need for early routing and durable pre-design
  continuity; ambiguity is discovered too late.
- **Complexity:** low to ship, high downstream churn.

## Non-obvious options

- **Ephemeral scratch discussion with commit-only final result:** attractive for
  speed, but it recreates the chat-memory problem that `DISC-14` and
  `DISC-20` exist to prevent.
- **Always-run micro discussion after every `validate-feature`:** simple to
  explain, but violates the bounded-trigger intent behind `DISC-02` and
  `DISC-06`.
- **Managed workflow/state-machine package:** would improve formalism, but it
  spends an innovation token to solve a docs-first problem that the repo
  already handles with markdown plus small helpers.

## Eliminated early

- **Chat-summary-only output:** fails durable, topic-scoped continuity.
- **Pure work-item notes:** too narrow for zero-state and for downstream
  consumption across `write-spec`, `design-ux`, `design-tech`, and
  `review-gate`.
- **External database/service for discussion state:** violates local-first and
  first-demo constraints.
