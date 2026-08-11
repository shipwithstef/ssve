# Design Decisions: Candidate Reservoir

## Session Mode: auto

## D-1: Feature scope

**Phase:** write-spec
**Decided:** #1 — reservoir, evaluator, ranking, and explicit terminal triage only
**By:** AI (auto), grounded in the user's explicit isolation and promotion boundary

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Local reservoir + grounding + ranking + explicit promote/reject | Complete for the narrow pre-WI outcome and directly testable | No automatic research or WI authoring |
| 2 | Read-only JSON ranker | Smallest surface | No durable transitions, isolation ledger, or idempotent state |
| 3 | Reservoir plus automatic WI creation | Fewer operator steps | Pollutes active work and violates the requested boundary |
| 4 | Central company candidate service | Cross-project dashboards | Network/auth/operations cost and weak open-source portability |
| 5 | Store candidates in project/customer database | Familiar query surface | Violates data isolation and couples framework state to product schema |

## D-2: Story granularity

**Phase:** write-spec
**Decided:** #1 — separate import/rank, grounding, scoring, triage, and isolation consumers
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Five contract-focused stories | Maps directly to independent failure domains and tests | More AC tables |
| 2 | One end-to-end operator story | Reads simply | Hides component ownership and failure isolation |
| 3 | One story per CLI flag | Mechanical mapping | Fragments shared import/ranking behavior |
| 4 | One story per `/cos` role | Highlights role ownership | Duplicates common scoring/state contracts |
| 5 | One story per persistence table | Implementation-aligned | Couples requirements to a premature schema |

## D-3: Acceptance-criteria strategy

**Phase:** write-spec
**Decided:** #1 — observable contract matrix with hermetic CLI/runtime fixtures
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Atomic CLI, state, formula, path, and isolation ACs | Every user constraint maps to a deterministic proof | Larger focused fixture suite |
| 2 | Snapshot only the top-10 output | Fast regression check | Misses transitions, hostile input, and scope leakage |
| 3 | Unit-test internal helpers only | Precise failures | Does not prove the shipped CLI boundary |
| 4 | Manual checklist | Flexible | Non-repeatable and weak for promotion proof |
| 5 | Full Tier-1 only | Reuses framework gate | Broad suite cannot prove candidate-specific semantics |

## Scope Review

**Mode:** Hold. The scope is the complete narrow pre-WI reservoir: all error, isolation, and state-transition paths are included, while UI, network sync, LLM inference, customer databases, and automatic WI creation are explicitly excluded.

## D-4: Persistence architecture

**Phase:** design-tech
**Decided:** #1 — project-scoped native SQLite plus deterministic Git mirror
**By:** AI (auto)

| Rank | Option | S4 pressure (`J-FW-06`) | Why | Trade-offs |
|---|---|---|---|---|
| 1 ⭐ | Native SQLite operational store + JSON mirror | Durable local triage plus a reviewable pool | Meets concurrency, local-first, diffability, and zero-dependency constraints together | Requires explicit projection/recovery logic |
| 2 | JSON mirror only | Reviewable but mutation-fragile | Simplest storage | Weak concurrent mutations and expensive whole-file transitions |
| 3 | SQLite only | Durable but opaque to Git review | Strong local transactions | Loses human review and Git portability |
| 4 | Embedded key/value files per candidate | Isolated but noisy at high volume | Natural isolation | Directory churn and no atomic multi-row import |
| 5 | Remote service/customer DB | Central view at the cost of offline isolation | Central querying | Violates isolation, offline use, and open-source portability |

## D-5: Decision-ledger consistency

**Phase:** design-tech
**Decided:** #1 — transactional SQLite outbox with deterministic event IDs
**By:** AI (auto)

| Rank | Option | S4 pressure (`J-FW-06`) | Why | Trade-offs |
|---|---|---|---|---|
| 1 ⭐ | DB outbox + ledger event-ID dedupe | Safe retry after an uncertain response | Survives every DB/JSONL crash seam and makes retry idempotent | One small table and projection step |
| 2 | Append ledger before DB commit | Visible decision, unreliable state | Avoids missing event | Can log a transition that rolls back |
| 3 | Append ledger after DB commit without outbox | Durable state, potentially missing audit | Minimal code | Crash can lose the decision permanently |
| 4 | Rewrite the full JSONL transactionally | Stable file but no cross-store atomicity | Atomic file update | Still cannot share a transaction with SQLite and rewrites history |
| 5 | Do not log triage | No explainable decision history | Simplest | Violates auditability requirement |

## D-6: Code-grounding trust boundary

**Phase:** design-tech
**Decided:** #1 — lexical containment plus `realpath` containment and metadata-only checks
**By:** AI (auto)

| Rank | Option | S4 pressure (`J-FW-06`) | Why | Trade-offs |
|---|---|---|---|---|
| 1 ⭐ | Lexical + realpath containment | Trust the evidence without exposing file content | Handles `..`, absolute paths, broken links, and external symlinks | Extra filesystem calls |
| 2 | `path.resolve` prefix only | Fast but unsafe evidence | Fast | Symlinks can escape the root |
| 3 | Git tracked-file lookup only | Strongly versioned but incomplete evidence | Strong repository relation | Excludes valid untracked directories and generated targets |
| 4 | Open and inspect every file | Rich evidence with excess disclosure | More semantic evidence | Discloses content and increases cost/risk |
| 5 | Trust declared grounding | Fast but not evidence-based | No filesystem work | Makes code grounding unverifiable |

## D-7: Module boundaries

**Phase:** design-tech
**Decided:** #1 — cohesive functions in one executable with one validator
**By:** AI (auto)

| Rank | Option | S4 pressure (`J-FW-06`) | Why | Trade-offs |
|---|---|---|---|---|
| 1 ⭐ | One executable with named pure/stateful boundaries | One discoverable, fast operator command | Fits the repository script pattern and stays below scope-reduction thresholds | Internal APIs are not reusable yet |
| 2 | Separate parser/store/grounding/scoring modules | Same CLI with broader maintenance surface | Easier unit imports | Premature file and module surface for one consumer |
| 3 | Add a framework package | Formal reusable API the operator did not request | Formal API | Repository has no root package lifecycle |
| 4 | Bash wrapper plus Node helpers | Familiar shell but inconsistent errors | Familiar CLI shell | Duplicates argument/error handling across languages |
| 5 | Python SQLite implementation | Another runtime path for the same command | Mature standard library | Violates the requested Node native API |
