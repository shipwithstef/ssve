# Design Decisions: WI-489 reviewer runtime routing

## Session Mode: auto

The owner fixed the reviewer-policy outcome and authorized end-to-end delivery. These alternatives select the narrowest faithful specification shape; they do not reopen the July 20 cutover, Fable safety-routing behavior, or the requirement to resume WI-486 only after promotion.

## D-1: Scope boundary

**Phase:** write-spec
**Decided:** delta contract over WI-488 covering protocol turns, provider safety routing, and reviewer profiles
**By:** AI (auto, owner constraints fixed)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | One focused WI-489 delta over WI-488 | Repairs all mutually dependent receipt/runtime assumptions without reopening stable isolation, fallback, or consumer migration behavior | Requires precise supersession language and cross-spec traceability |
| 2 | Patch only `--max-turns` | Smallest executable edit | Leaves safety routing, cache truth, and scheduled policy unresolved |
| 3 | Disable automatic Fable switching | Simplifies tuple truth | Rejects the owner's requirement to handle legitimate provider routing and reduces successful review availability |
| 4 | Replace WI-488 with a wholly new spec | Produces one consolidated document | Creates unnecessary churn and obscures which promoted guarantees remain invariant |
| 5 | Split protocol, routing, and profile into three WIs | Maximizes local separation | Creates unsafe intermediate states and blocks WI-486 through three landings |

**Chosen:** #1 because the three corrected boundaries share the same requested/invoked/effective tuple, receipt, cache, and call-count state machine.

## D-2: Story granularity

**Phase:** write-spec
**Decided:** five system-consumer stories
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Protocol, provider route, reviewer profile, receipt/operations, and verification stories | Each story owns a stable externally observable boundary and maps cleanly to fixture families | More AC rows than a single narrative |
| 2 | One end-to-end correction story | Compact | Hides independent failure and cache boundaries |
| 3 | One story per receipt field | Maximally atomic | Turns requirements into schema implementation trivia |
| 4 | One story per model | Easy model inventory | Duplicates cross-model policy and misses operator/profile behavior |
| 5 | One story per dependent WI | Direct WI-486/WI-487 framing | Couples the launcher contract to consumers that should remain independent |

**Chosen:** #1 because it preserves consumer-first requirements while keeping protocol, route, policy, and proof independently testable.

## D-3: Acceptance-proof approach

**Phase:** write-spec
**Decided:** protocol-faithful fake CLI replays plus one bounded real Fable/high review
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Deterministic protocol fixtures for every branch, then one real Fable/high primary verification | Gives exhaustive free regression coverage and proves the actual schema handshake without a separate smoke call | Requires the fake CLI to model intermediate protocol states, not just final JSON |
| 2 | Static argv/source assertions only | Fast and cheap | Repeats the exact WI-488 blind spot |
| 3 | Multiple paid live probes | Exercises provider behavior | Costs quota, is nondeterministic, and violates the no-smoke-call contract |
| 4 | Disable provider safety routing in tests and production | Makes model identity simple | Does not handle the owner's stated real-world route |
| 5 | Trust Claude Code's displayed label without receipt semantics | Minimal launcher logic | Cannot support cache truth, audit, or fail-closed mismatch handling |

**Chosen:** #1 because exhaustive fixture replays protect the state machine while the real primary review proves the provider protocol once, within the normal review workflow.

## D-4: Reviewer policy authority

**Phase:** design-tech
**Decided:** versioned `externalReviewPolicy` data in `references/model-registry.json`, parsed by the canonical launcher
**By:** AI (auto, owner cutover fixed)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Put profiles, UTC schedule, and fallback eligibility in the model registry; launcher validates and resolves it | One tracked authority already owns model identifiers; resolver and receipts can consume the same result | Launcher needs strict semantic validation for registry data |
| 2 | Keep policy constants in the launcher | Minimal file count | Repeats WI-488 drift between registry, shell resolver, skills, and runtime |
| 3 | Put schedule in the shell resolver | Easy to display | Makes a compatibility view authoritative and duplicates Node runtime logic |
| 4 | Read the active model from host user configuration | Flexible | Nondeterministic and violates exact tuple isolation |
| 5 | Ask the operator on every review | Explicit | Blocks end-to-end automation and cannot reproduce historical resolution |

**Chosen:** #1. `run-external-review.mjs --policy-status` is the authority-facing read API; `resolve-adversarial-reviewer.sh` delegates to it and never owns a second policy table.

## D-5: Explicit Fable profile selection

**Phase:** design-tech
**Decided:** launcher-managed, ignored local selection state with owner provenance, secure file checks, and an optional expiry
**By:** AI (auto, owner requested easy re-enable)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | `--select-profile fable-high --reason ... [--expires-at ...]`, stored atomically at `.svc/external-review-policy/v1/selection.json` | One command, no tracked edit, observable and receipted; same-user file ownership/mode checks prevent accidental foreign state | Local selection is per checkout and must be deliberately repeated elsewhere |
| 2 | Require an external file plus a separately configured SHA-256 trust anchor | Strong exact-byte binding | Too cumbersome for the requested easy switch and provides no durable built-in status lifecycle |
| 3 | Environment variable override | Easy | Ephemeral, easily inherited, and weakly auditable |
| 4 | Tracked registry edit | Reviewable | Requires a code change/PR for an operational switch |
| 5 | Automatic retry to Fable based on availability | Hands-free | Adds paid probes and conflates entitlement with owner policy |

**Chosen:** #1. The selection document carries schema version, profile, authority=`repository-owner`, reason, selected timestamp, optional expiry, and its own content hash in receipts. The launcher rejects symlinks, wrong owner, group/world-write, malformed/expired/unsupported state before cache/provider activity. This supersedes the draft trust-anchor wording in EXTREV-101.

## D-6: Fable safeguard-route attestation

**Phase:** design-tech
**Decided:** attest the route by construction from a controlled Fable invocation envelope plus exact runtime model usage
**By:** AI (auto, installed CLI surface verified)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Force `switchModelsOnFlag=true`, omit CLI fallback, scrub refusal/model remap env, request exact Fable, and accept exact Opus 4.8 usage as `provider_safety_route` | Uses controls the installed CLI actually exposes and distinguishes the same-process provider route from launcher fallback | Cannot name a private provider trigger category that the public output does not expose |
| 2 | Require private refusal headers in normal CLI JSON output | Would be direct provenance | Those headers are internal and are not proven available to this launcher surface |
| 3 | Trust the findings' self-reported reviewer model | Simple | Model-authored identity is not authority evidence |
| 4 | Treat all Opus observations as mismatch | Fail-closed | Discards the provider behavior the owner explicitly requires us to support |
| 5 | Launch Opus again after observing routed Opus | Produces an explicit tuple | Duplicates cost and violates the no-second-Opus contract |

**Chosen:** #1. The receipt records the envelope controls as route evidence. Missing controls or any model other than exact Fable, allowed auxiliary Haiku, or exact Opus 4.8 fails closed. A safeguard block without valid findings is `provider_safety_failure`, not availability fallback.

## D-7: Schema and cache evolution

**Phase:** design-tech
**Decided:** receipt schema v2 with launcher-normalized reviewer identity; findings payload remains v1-compatible
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Add policy/protocol/route fields to receipt v2 and normalize findings reviewer from runtime evidence | Keeps consumer findings stable while placing authoritative identity and effort provenance in the durable invocation receipt | Consumers needing provenance must read the receipt, as already required by WI-488 |
| 2 | Make findings schema v2 nullable for effective effort | Puts every fact in one payload | Forces every review consumer and model prompt to understand provider-managed effort |
| 3 | Leave schemas unchanged and add free-form usage keys | Small edit | Cannot enforce contradictions or cache eligibility mechanically |
| 4 | Store provider-route facts only in logs | No schema churn | Logs are not a durable semantic contract |
| 5 | Cache routed Opus as Fable success | Saves calls | Launders a non-Fable effective model into future Fable demand |

**Chosen:** #1. Findings `reviewer` is overwritten after validation using trusted effective host/family/model and requested effort for exact-primary only; provider-routed findings use model `claude-opus-4-8` and effort `high` solely as the request-level setting, while receipt v2 marks `effective_effort_provenance=provider-managed`. Only an exact, no-fallback primary outcome (`scheduled_primary`, `explicit_profile_primary`, or fixed-policy `exact_primary`) whose requested and effective tuples match may be cached as reusable.
