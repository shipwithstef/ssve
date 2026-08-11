# Design Decisions: WI-488 deterministic external reviewer

## Session Mode: auto

The owner supplied the complete accepted policy and authorized end-to-end execution. These alternatives select the narrowest faithful specification shape; they do not reopen the accepted model, effort, or fallback policy.

## D-1: Scope boundary

**Phase:** write-spec
**Decided:** one canonical launcher plus every active independent-review consumer
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | One launcher, shared schemas, all active review consumers | Makes tuple, fallback, cache, and evidence one enforceable invariant while staying inside WI-488 | Touches several contracts and fixtures in one atomic migration |
| 2 | Migrate review-plan only | Small first patch | Leaves other paid review paths nondeterministic and violates the accepted inventory requirement |
| 3 | Separate Codex and Claude launchers behind a thin dispatcher | Allows provider-specific ownership | Duplicates receipt, cache, and failure policy at the exact boundary being repaired |
| 4 | Keep direct consumers and add a validator | Detects some drift cheaply | Cannot prove runtime tuple, auth preservation, stream separation, or fallback provenance |
| 5 | Replace all framework model invocations | Maximizes uniformity | Absorbs unrelated eval, worker, extraction, and creative surfaces beyond WI-488 |

**Chosen:** #1 because the accepted contract is indivisible at the paid-review boundary and the diagnosis found one cohesive correction.

## D-2: Story granularity

**Phase:** write-spec
**Decided:** five system-consumer stories
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Policy, invocation, fallback, evidence/cache, migration/testing | Mirrors independently testable failure boundaries and downstream ownership | More AC tables than a single story |
| 2 | One end-to-end launcher story | Compact narrative | Hides provider-specific and cache/fallback edge cases |
| 3 | One story per CLI flag | Maximum atomicity | Fragments the product contract into implementation trivia |
| 4 | One story per current consumer | Easy migration checklist | Repeats the same external-action policy and encourages future drift |
| 5 | Split Codex and Claude into separate feature specs | Strong provider separation | Prevents atomic enforcement of the cross-family policy |

**Chosen:** #1 because each story owns a stable contract boundary without prescribing file-level implementation.

## D-3: Acceptance-proof approach

**Phase:** write-spec
**Decided:** fixture-controlled CLI capture plus schema and replay validation
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Fake CLI fixtures capture argv/stdin/env/streams and replay receipts | Proves exact behavior without paid calls and deterministically covers failures | Requires a purposeful fixture harness |
| 2 | Static source grep only | Very fast | Cannot prove invocation, classification, or cache behavior |
| 3 | Live paid smoke calls in Tier 1 | Exercises providers | Nondeterministic, costly, and explicitly forbidden |
| 4 | Recorded prose transcripts | Easy to inspect | Cannot bind effective tuple or detect launcher drift |
| 5 | Manual operator checklist | Flexible | Not replayable and cannot gate landing |

**Chosen:** #1 because the contract is observable at a process boundary and every accepted negative case can be simulated without external spend.

## D-4: Launcher architecture

**Phase:** design-tech
**Decided:** one zero-dependency Node launcher with shell compatibility adapters
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | One Node launcher owns policy, spawning, validation, cache, and receipts | Node provides argv-safe spawning, timers, hashing, JSON, locks, and existing zero-dependency helpers | The launcher is a substantial single module and needs internal responsibility boundaries |
| 2 | Portable Bash launcher | Matches current scripts | Robust JSON/schema/process/stream/cache logic becomes fragile and difficult to unit-test |
| 3 | Separate Node launcher per provider | Provider code is visibly isolated | Duplicates the cross-provider fallback and receipt invariant |
| 4 | Python launcher | Strong subprocess and JSON support | Introduces a second primary scripting language for core chain machinery |
| 5 | Third-party orchestration library | Could reduce boilerplate | Violates the repository's zero-dependency posture and adds supply/version risk |

**Chosen:** #1. The existing pure-Node schema and atomic-state helpers cover the hard parts without a new dependency; existing shell paths remain compatibility adapters only.

## D-5: Schema and semantic validation

**Phase:** design-tech
**Decided:** two shared JSON Schemas plus explicit semantic validation in the launcher
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Shared findings schema + receipt schema + semantic validator | Separates structural interchange from tuple/cache/fallback invariants that JSON Schema cannot safely express with the repo's supported subset | Requires clear tests for both validation layers |
| 2 | One giant schema only | Single artifact | Current validator intentionally does not enforce conditionals, regex, or additionalProperties |
| 3 | Consumer-specific schemas | Precise per rubric | Recreates drift and blocks shared receipt processing |
| 4 | Prose contract plus parser | Minimal files | Fails closed only by convention, not machine validation |
| 5 | Add Ajv | Full JSON Schema support | Adds dependency and lockfile/install surface to a zero-dependency framework |

**Chosen:** #1. The schemas use only supported structural keywords; the launcher re-derives hashes, tuple equality, fallback eligibility, override provenance, and cache reuse mechanically.

## D-6: Cache concurrency and identity

**Phase:** design-tech
**Decided:** per-key lock, staging directory, and atomic promotion under `.svc/external-review-cache/v1`
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Lock before lookup/invoke/write; hash package + tuple + schema + launcher version | Prevents duplicate concurrent spend and partial cache publication; exactly matches the accepted identity | A crashed invocation can leave recoverable staging/lock residue |
| 2 | Lookup without lock, lock only writes | Higher concurrency | Two identical misses can both make paid calls |
| 3 | Global cache lock | Simple correctness | Unrelated reviews serialize unnecessarily |
| 4 | Git notes as invocation cache | Durable across clones | Paid-call runtime writes would contend with chain receipt notes and dirty external state |
| 5 | No cache | Simplest execution | Violates duplicate suppression and increases cost |

**Chosen:** #1. A valid cache hit is allowed only for a no-fallback receipt whose requested, invocation, and effective primary tuples agree.

## D-7: Failure classification

**Phase:** design-tech
**Decided:** structured provider codes first, conservative diagnostic classifier second, ambiguity never falls back
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Typed event/error codes, then ordered anchored patterns; unknown is hard failure | Maximizes correct fallback while making false-positive Opus spend fail closed | New provider wording may require fixture updates before fallback resumes |
| 2 | Any non-zero Fable exit falls back | High apparent availability | Auth, quota, network, timeout, and schema failures incorrectly spend on Opus |
| 3 | Error-string regex only | Easy to implement | Fragile and can classify model-authored text or overlapping quota messages |
| 4 | Separate paid availability probe | Clear model check | Adds forbidden duplicate paid calls |
| 5 | Never fallback | Simplest safety | Violates the accepted three-class Opus fallback policy |

**Chosen:** #1. Only provider diagnostics and structured events are classifiable; final model content is never an availability signal.
