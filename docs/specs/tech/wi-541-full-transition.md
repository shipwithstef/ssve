# Technical Design: WI-541 Full Framework Transition

**Status:** G4 PASS
**Date:** 2026-08-15
**Spec:** `docs/specs/features/wi-541-full-transition.md`

## Architecture

Keep the current file-backed controller, hook dispatcher, receipt, and skill architecture. Add narrowly scoped pure contracts at the seams where current declarations are not consumed, then wire them into existing callers. Every mutation remains under the current repository/worktree locks and stable-principal authority. No new service, database, dependency, provider, or product runtime is introduced.

### Processing pipeline

```text
owner intent + source census
          |
          v
spec/AC graph --> technical decision --> one mechanical manifest
                                             |
                                             v
 canonical chain contract --> plan review --> sequential implementation
          |                                  |
          v                                  v
 exact lane validation               focused negative fixtures
          |                                  |
          +-------------> cumulative review/audit/test
                                             |
                                             v
                         local land -> all-host install -> installed replay
```

### Authority state machine

```text
UNBOUND
  | secure bootstrap
  v
OWNED_BRANCH -- exact reviewed tuple + short capability --> PROMOTION_DETACHED
  | same-owner missing legacy state                           |
  | secure convergence                                       | close/fail/retry
  +----------------------> OWNED_BRANCH <---------------------+

Any foreign owner, ambiguous path/branch/repository, dirty reviewed tree,
wrong generation, widened operation, replay, or expiry ----------------> DENY
```

### Child dispatch flow

```text
task + requested transport + host capability + delegation tuple
                         |
                         v
                 pure resolver
             /           |            \
 delegated-wrapper   controller   read-only-native
        |                 |              |
 contained inner WT   serial owner   no mutation tuple
        |                 |              |
 receipt + merge      normal chain   summary/review only
```

### Learning flow

```text
framework ledger + project ledger
              |
              v
 normalize id/key + confidence ---- malformed report (never trusted)
              |
              v
 action match -> used/ignored -> outcome link -> bounded landing triage
                                              |
                                              v
                               evaluate-rule -> elevation/federation
```

## Components

| Component | Type | Responsibility | Change |
|---|---|---|---|
| Mandatory delivery-chain contract | Node library | Own the exact ordered mutable-lane chain and sequence validation | New shared module, consumed by compiler and lane validator |
| Delivery graph compiler/validator | Node scripts | Compile exactly one chain and reject omission, duplication, substitution, or reorder | Modify |
| Decoded Bash target coverage | Hook/library wiring | Apply concrete-path guards to Bash mutations while allowing reads | Modify existing shared classifier consumers |
| Child transport resolver | Pure Node CLI/library | Return only delegated wrapper, controller, or read-only native from typed evidence | New; consumed by execute-changeset and dispatch-waves |
| Promotion authority | Authority library/CLI seam | Mint, inspect, consume, expire, revoke, and restore an exact promotion tuple | New small library plus existing recovery/dispatcher wiring |
| Legacy worktree convergence | Worktree bootstrap path | Recreate only missing same-owner claim/binding/graph state after exact secure checks | Modify existing ensure path |
| Plan contract validator | Pure Node CLI | Validate stream ownership, reversible writers, property sweeps, claim evidence, callers, and declared consumers | New; consumed by plan and review |
| Reviewer evidence contract | Receipt schemas/launcher | Require reviewer-run command/output and parse/collect proof for deletion-bearing executable diffs | Modify |
| Learning lifecycle | Library/CLI/skill wiring | Normalize, report, triage, evaluate, federate, and outcome-link learnings | Modify plus one lifecycle CLI |
| Authorization envelope boundary | Pure check plus explicit outward wrapper/Stop recorder | Enforce declared action class only at an observable boundary and record waste without changing absent-envelope behavior | New/modify; benchmarked |
| Proposal SLA validator | Existing validator/data | Make every direct proposal disposition current with numerator/denominator output | Modify data and validator |
| Residual correctness set | Existing scripts/schemas/docs | Retire quick-fix guidance, make task graph atomic, remove OPT-01, add story hash, and close WI-523 mechanics | Modify |

The manifest will assign every shared file to exactly one stream and serialize dependent edits. Although the program affects more than eight files, splitting it into independent WIs would re-create the current cross-WI drift. The minimal safe form is one cumulative assembly with pure modules and focused fixtures; no AC is dropped.

## Data and state contracts

No database changes are required. State remains repository-local and append-only where already required.

| State | Shape | Integrity rule |
|---|---|---|
| Mandatory chain | frozen array of skill identifiers | exact count and contiguous order per mutable lane |
| Child transport decision | `{outcome, reason, evidence_refs}` | pure, recorded before launch, generic host capability insufficient |
| Promotion capability | exact repository/WI/worktree/branch/tree/SHA/environment/operation/owner/generation/expiry tuple | single-purpose, expiring, one generation, append-only issuance/consume/deny events |
| Plan ownership | normalized repo-relative paths or explicit bounded prefixes | pairwise disjoint; shared file has one owner and dependency edges |
| Product safety | writer class plus both operation orders, compensation mechanism, property sweep command | required for balance/ledger/quota/entitlement/counter writers |
| Verification claims | claim, denominator, direct command/output evidence | zero without a denominator is unproven |
| Learning view | canonical `{key, insight, confidence_number, files, skill, type, origin}` plus parse findings | accepts `id` or `key`, numeric or numeric-string confidence; malformed reported |
| Learning lifecycle | append-only used/ignored/outcome/promotion/elevation/federation events | no framework credit before outcome linkage; elevation requires evaluate-rule |
| Authorization envelope decision | action/environment/purpose plus matching envelope row | absent envelope preserves current behavior; explicit deny blocks at wrapper boundary |

## External dependencies and toggles

No external runtime dependency is added. Current reviewer CLIs remain optional under existing policy; local deterministic validation does not need network or credentials.

Feature selection is capability-derived rather than a mutable rollout toggle:

| Environment | Native read-only agents | Mutating child | External actions |
|---|---|---|---|
| Local fixtures | allowed | contained wrapper or controller | mocked command executor |
| Installed host | allowed when exposed | only complete delegated wrapper | explicit outward-action wrapper/envelope |
| Host without containment | allowed | controller | existing behavior if no envelope; declared rows enforced |

The first demonstration and full focused suite run offline with disposable repositories, fake commands, deterministic clocks, and no credentials.

## Technology decisions

| Decision | Choice | Rationale |
|---|---|---|
| Shared topology | One imported mandatory-chain constant plus pure sequence validator | Eliminates compiler/validator drift without a new registry format |
| State mutation | Existing locked atomic update and temp/fsync/rename patterns | Proven in current authority/state code; prevents lost updates |
| Shell parsing | Reuse decoded argv classifier | Avoids a second quoting/heredoc parser and closes WI-514 consistently |
| Child transport | Explicit tuple-based resolver | Availability flags cannot prove identity, worktree, delegation, or containment |
| Recovery | Purpose-bound capability and exact same-owner convergence | Models sanctioned transitions while keeping foreign/ambiguous state fail-closed |
| Plan checks | One typed plan-contract parser | A single consumer prevents several new inert scripts |
| Learning | Normalize on read, append lifecycle events | Preserves immutable history while making malformed rows and outcomes visible |
| Authorization envelope | Explicit observable wrapper plus Stop telemetry, not generic per-tool guesswork | Enforces the declared class where it is known and avoids unbounded hot-path inference |
| Cleanup | Remove routing/guidance only; retain risk detectors | Retires unused context without deleting the only bypass evidence |

## Cost model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Pure Node validation | local process, typically tens of milliseconds | per plan/graph/review | no provider charge | linear with files/rows | framework owner compute |
| Hook classification | in-process or existing dispatcher child | per guarded action | no provider charge; p95 budget enforced | linear with guarded calls | framework owner compute |
| State storage | JSON/JSONL receipts and ledgers | kilobytes per WI | local disk only | linear; bounded triage/retention | framework owner storage |
| External API calls | none added | zero | $0 | constant zero | N/A |
| Background jobs | none added | zero | $0 | constant zero | N/A |

Scaling triggers: reject an authorization or guard change if native p95 exceeds its focused budget; compact/archive only through existing append-only policies when ledgers affect startup; prefer one parser and cached normalized reads over per-rule processes. First month and year one remain $0 in provider spend. The material saving is avoided failed child turns, fewer repeated proposals, and less unused core context.

## Operations and ownership

| Dimension | Answer |
|---|---|
| Owner | SSVE framework owner |
| On-call | Best effort; no pager |
| SLA / SLO | Deterministic local commands; focused validators must be stable and host install must converge |
| Error budget | Zero false authorization widening; performance regressions above explicit p95 budgets fail release |
| Monitoring | Test output, proposal counts, learning lifecycle ledgers, denial/authority receipts, install drift |
| Alerting | Command failure is synchronous and actionable; no external alert service |
| Dashboard | Task graph plus FRAMEWORK-STATE and generated validation summaries |
| Runbook | Denials print exact in-scope recovery; rollback uses local commit revert plus reinstall |
| Failure modes | false-green chain, parser drift, lost graph update, stale/foreign recovery, forged transport tuple, malformed learning, stale proposal, envelope misclassification |
| Recovery | fail closed; preserve bytes; repair only exact same-owner tuple; rerun setup and focused fixtures |
| Backup / restore | Git history and refs/notes for tracked evidence; append-only authority/receipt history preserved |
| Dependency failure impact | Optional external reviewer unavailable follows existing fallback policy; deterministic local gates continue |

## Test matrix

| Component | Unit/fixture | Integration | Installed replay |
|---|---|---|---|
| Chain contract | every mutable lane plus reorder/duplicate/substitution negatives | compile then lane validate | route replay |
| Bash guard | read positives; python/sed/heredoc/jq write negatives | consolidated dispatcher replay | installed Codex hook |
| Transport resolver | full tuple matrix, forged/replayed/overlap cases | HoursHub billing topology | native read-only plus controller/contained path |
| Promotion/recovery | transition, expiry, wrong tuple, crash-forward, legacy state | disposable linked worktree | original detach/preflight-fail/restore topology |
| Plan contract | ownership, money order, claims, callers, consumers | review-plan/review-exec receipts | N/A |
| Learning lifecycle | both schemas, malformed rows, used/ignored/outcome, elevation/federation | land + recall | installed preload/action injection |
| Authorization envelope | outside deny, inside stop record, absent behavior, timing | outward wrapper/Stop seam | installed dispatcher where applicable |
| Residuals/triage | focused WIs 516-518/522-523 and proposal denominator | manifest/pipeline validators | all-host drift |

## Feasibility matrix

| AC | Persona pressure | Feasible? | Design proof |
|---|---|---|---|
| W541-01 | S1 owner trust | Yes | deterministic content ledger and disposition validator |
| W541-02 | S2 chain integrity | Yes | shared exact chain contract consumed at compile time |
| W541-03 | S2 false-green prevention | Yes | pure contiguous sequence validator with negative fixtures |
| W541-04 | S3 guard completeness | Yes | decoded argv reuse plus documented exemptions |
| W541-05 | S3 safe routing | Yes | pure three-outcome resolver |
| W541-06 | S3 no doomed launch | Yes | prelaunch tuple validation and controller fallback |
| W541-07 | S3 sanctioned promotion | Yes | exact purpose-bound expiring capability |
| W541-08 | S3 zero-block recovery | Yes | secure same-owner legacy convergence under lock |
| W541-09 | S4 merge safety | Yes | typed ownership matrix and diff reconciliation |
| W541-10 | S4 product money safety | Yes | writer classification, two-order compensation, property sweep |
| W541-11 | S4 claim truth | Yes | denominator/evidence schema and namespace-aware caller search |
| W541-12 | S4 independent proof | Yes | receipt requires reviewer-run commands and deletion parse/collect evidence |
| W541-13 | S5 usable knowledge | Yes | normalization plus explicit malformed findings |
| W541-14 | S5 compounding loop | Yes | bounded triage, evaluate-rule, federation validation, outcome events |
| W541-15 | S3 autonomy/security | Yes | explicit outward boundary and telemetry with p95 benchmark |
| W541-16 | S1 context cleanup | Yes | remove core/curated guidance only; detectors unchanged |
| W541-17 | S2 concurrent state | Yes | locked closures and real concurrent fixture |
| W541-18 | S1 dead idea removal | Yes | delete stale plan row and preserve refutation |
| W541-19 | S2 schema correctness | Yes | optional 64-hex schema property and fixtures |
| W541-20 | S2 mechanical residuals | Yes | shared registry validator, real genesis SHA, executable commands, arg arrays |
| W541-21 | S1 proposal hygiene | Yes | current triage plus numerator/denominator SLA validator |
| W541-22 | S1 no inert machinery | Yes | every new executable names caller and behavioral test |
| W541-23 | S1 quality | Yes | focused, Tier 1, lint, pipeline, security, implementation, and session audits |
| W541-24 | S1 installed truth | Yes | all-host setup/drift plus installed Codex replays |
| W541-25 | S1 local delivery | Yes | local commit and receipts; no GitHub operation |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Broad cumulative diff hides interaction bugs | High | one file owner, dependency edges, sequential merge, cumulative tests, holistic final review |
| Recovery capability widens authority | Critical | exact tuple, short expiry, generation CAS, purpose allowlist, dirty/foreign/path negatives, security review |
| Shell classifier false positives block reads | High | shared decoded argv, read fixtures, exemption inventory, installed replay |
| Envelope wrapper is bypassed by unclassified commands | High | only claim enforcement at explicit observable boundary; retain ordinary host security and document coverage denominator |
| Learning normalization trusts coercion | Medium | accept only strict numeric strings/range, report malformed, never silently trust |
| Proposal drain destroys history | High | update triage or archive move; never delete source/audit rows |
| More machinery becomes inert | Medium | declared consumer plus behavioral test is an AC and final audit gate |

## Trade-offs

| Trade-off | Chose | Over | Rationale |
|---|---|---|---|
| Speed | fail-before-dispatch and fewer parsers | skipped gates | removes waste without reducing proof |
| Scope | one full cumulative transition | many disconnected partial WIs | cross-cutting invariants must be validated together |
| Safety | purpose-bound recovery | blanket denial or bypass | permits sanctioned owner flow while preserving least authority |
| Compatibility | normalize on read | ledger rewrite | keeps append-only history and supports both existing shapes |
| Parallelism | disjoint files and sequential assembly | same-worktree concurrent writes | predictable containment and receipts |

## Adversarial engineering review

- `[Layer 1] [Confidence: 10/10]` Reusing current locked atomic state primitives is safer than adding another store.
- `[Layer 1] [Confidence: 10/10]` A single imported chain contract removes the reproduced compiler/validator duplication.
- `[Layer 3] [Confidence: 9/10]` Host capability must resolve per concrete transport; `agents: true` is not an authorization fact.
- `[Layer 1] [Confidence: 9/10]` Exact tuple, deny-by-default, and check-at-boundary semantics are required for recovery and envelope decisions.
- `[Layer 1] [Confidence: 9/10]` Reviewer-run evidence must be machine-bound; submitter PASS prose is not independent proof.
- `[Layer 3] [Confidence: 9/10]` Learning earns framework credit only after a consumer/outcome link, which prevents capture volume from masquerading as improvement.
- `[Layer 1] [Confidence: 10/10]` No new dependency, service, or network path is needed; all scenarios remain offline-testable.

G4 result: PASS. All 25 ACs are feasible, the two high-risk authority changes have explicit state machines and negative denominators, cost remains local-only, and no unresolved one-way-door question remains.
