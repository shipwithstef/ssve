# Session Audit and Framework Proposal — WI-368 Execution Controller v2

**Date:** 2026-08-10
**Status:** IMPLEMENTED AND LOCALLY VERIFIED — FINAL REVIEW / GOVERNED LANDING PENDING; the unified runtime and
external owner-configured review topology are implemented in the isolated framework candidate,
while installation, real-product canary proof and journal/CAS-authorized production cutover remain
separate gates
**Source run:** Example Marketplace `WI-368`, Codex session `019fdb39-a94f-77f2-b3cb-d7e367cc5557`
**Framework branch:** `proposal/wi368-execution-controller-v2`
**Scope:** Execution structure and governance only. Product scope, security invariants, runtime proof,
deployment gates and the founder's product-decision authority remain intact.

## Executive decision

Adopt **Product-Outcome Engine / Persistent Executor / Continuous Orchestrator Verification with
Evidence-Triggered Plan Repair**, strengthened by a canonical layer inventory, consumption-closed
product graph, compiled task capsules, Luna-owned runtime, relevant-digest invalidation, standard
proof runners, one final holistic review and production/outcome continuation.

The prime directive is machine-enforced: turn an owner's direction into a production-released,
live-verified, rollback-ready feature in at most **60 active engineering minutes**, without reducing
quality, reliability, authority, security, migration, operability or product-truth coverage. The
clock starts at accepted owner direction, not at a pre-frozen plan. If no complete product slice can
fit, the controller re-slices or stops with evidence; it never deletes proof to hit the clock.

Product delivery closure and outcome-cycle closure are separate. Delivery closes inside the active
budget after live verification and a durable observation schedule. A metric window may mature later
on a visible external clock; the graph stays open until its delta is observed and consumed by the
next product decision.

The foundation preserves the already-agreed ownership model while removing its global serialization
bottleneck:

1. one logical execution run owns the feature outcome; the scheduler leases independent capsules to
   sticky Luna-max workers, each of which owns implementation, tests, disposable runtime, cleanup,
   receipts and its task checkpoint;
2. one Sol-medium root owns task state, scope, fast plan-vs-diff verification and deployment
   authority;
3. Sol-high is not a routine reviewer. It is invoked only for a real product/authority decision or
   the one final frozen holistic review;
4. the plan is holistic, but execution is delivered through bounded machine-readable task capsules.

Four reconciliations are binding:

- **Persistent identity is capsule-scoped, not a global mutex.** Resume the same worker for local
  retries and its checkpoint. Independent capsules may use parallel sticky workers; successors get
  a fresh bounded context containing the accepted interface and checkpoint receipt.
- **Luna owns disposable runtime.** Root must not build inline Docker controllers, copy transient
  logs or re-run a task's proof merely to observe it.
- **Strategic decision remains product authority.** A plan-repair router classifies the conflict.
  Existing signed truth is reconciled mechanically; a genuinely new product choice invokes
  `strategic-decision` on Sol-high.
- **Continuous verification is not independent review.** Root's per-task comparison is cheap
  control-plane verification. Exactly one independent holistic review runs after the complete
  candidate is frozen.
- **Every produced object has a runtime-proven consumer.** Research, decisions, plans, receipts,
  evidence, learning and release state may not advance or close merely because a file exists.
- **Owner interaction is policy, not skill-local improvisation.** `AUTONOMOUS` uses signed delegated
  scope; `STRATEGIC_QUESTIONS` asks only consequential unresolved choices through one localized
  `decide` adapter. Implementation questions remain internal.
- **Hooks are adapters, not authority.** Claude/Codex/Kimi hooks normalize host events into the same
  journal. Hookless and fail-open hosts still pass through the canonical runtime/effect boundary.

## Scope and evidence inventory

### Durable evidence

- Current session history:
  `~/.codex/history.jsonl`, session
  `019fdb39-a94f-77f2-b3cb-d7e367cc5557`; the founder-provided execution audit and operating model
  are recorded at the 2026-08-09 prompt.
- Full host trace:
  `~/.codex/sessions/2026/08/07/rollout-2026-08-07T10-56-57-019fdb39-a94f-77f2-b3cb-d7e367cc5557.jsonl`.
- Product execution graph:
  `example-marketplace/.worktrees/brownfield-WI-OWNER-ONBOARD-01-finish/.svc/lane-tasks-WI-368.json`.
- Product execution contract:
  `example-marketplace/.worktrees/brownfield-WI-OWNER-ONBOARD-01-finish/docs/plans/2026-08-07-owner-onboarding-go-live/manifest.md`.
- Product checkpoint history and persistent receipts under
  `/home/svc-user/.cache/wi368-owner-receipts/`.
- Framework execution contract: `execute-changeset/SKILL.md`.
- Framework model taxonomy: `references/model-routing.md` and
  `references/model-registry.json`.
- Framework benchmark evidence: `references/benchmark-findings.md`.
- Existing overlapping proposal: `proposals/2026-08-02-one-lane-framework.md`.
- Current framework state: `FRAMEWORK-STATE.md`.

### Current measured shape

At the proposal snapshot, the WI-368 product worktree contains:

| Artifact | Lines |
|---|---:|
| owner-onboarding manifest | 3,396 |
| shared lock/race harness | 1,959 |
| task-04 rate runner | 547 |
| floor-1200 migration | 1,562 |
| floor-1210 migration | 2,500 |
| claim pgTAP | 1,330 |
| launch pgTAP | 1,289 |

Nine `checkpoint(WI-368)` commits and twelve first/second-level persistent receipt directories
already exist. These counts are current command evidence, not estimates.

The prior audit reported 49 Sol calls, about 33 around task-03, at least 17 mechanical review
rounds and at least six controller-invocation failures. Those figures are **reported audit
measurements from the session transcript**; this proposal does not independently recount every
message.

Token efficiency is **UNKNOWN** because the provider did not expose a complete task-by-task token
ledger. Artifact volume, repeated review dispatch and repeated runtime setup prove structural waste,
but this proposal does not fabricate an exact token saving. The 60-minute active-execution budget
and 100x normalized-throughput ambition below are targets to prove by replay, not achieved claims.

### Sample revenue activation stress-test snapshot

The 2026-08-09/10 Sample Revenue Activation run provides a second, current stress test of the same
machinery. Read-only evidence was collected from
`example-marketplace/.worktrees/sample-revenue-activation` and its Git-worktree executor state:

| Measure | Current value |
|---|---:|
| reviewed-plan checkpoint to accepted `E1B1.r21` checkpoint | 12 h 19 m 57 s |
| planned implementation units | 9 (`E1A`, `E1B1`, `E1B2`, `E1C`, `E2`-`E6`) |
| accepted implementation units | 2 |
| plan repairs recorded | 21 |
| validation runs | 311 (20 active + 291 inactive) |
| validation batches | 32 (4 active + 28 inactive) |
| inactive candidates retained | 21 |
| plan/controller surface | 8,844 lines across manifest, contract, controller and controller test |

This is not evidence that the product semantics are unusually unstable. Most late repairs bound
fixture cardinality, JSON shape, timestamp serialization, runner scope, stale assertions or retry
mechanics. Those are valuable checks, but they belong in compiled capsules, typed fixtures and the
executor's local correction loop rather than in a new Sol-high-authored plan revision.

The framework's own complete Tier-1 run was also measured in this proposal worktree on 2026-08-10:

```text
declared contract: "Tier 1 always runs (free, <10s)"
actual: 275 validators, 190.48 s wall, 256 pass, 19 fail, 0 timeout
captured output: about 69,592 tokens before tool truncation
```

The failures included host-install and historical work-item metadata state unrelated to this
proposal. The validators are not the defect. Running the entire global population, printing every
passing assertion and mixing current-diff failures with pre-existing host/repository failures on
every checkpoint is the defect.

### Primary-source architecture benchmark

The target is not a larger prompt pack. It is a small durable execution kernel that compiles the
valuable SVC knowledge into work, evidence and release state. The following mechanisms are adopted
from their primary implementations; their product-specific APIs are not copied:

| Primary system | Mechanism to adopt | What SVC must not copy |
|---|---|---|
| [Temporal workflow execution](https://docs.temporal.io/workflow-execution) and [retry policies](https://docs.temporal.io/encyclopedia/retry-policies) | append-only workflow history, deterministic replay, task-local activity retry | retrying a whole deterministic workflow for one failing activity |
| [LangGraph checkpoints](https://langchain-ai.github.io/langgraph/reference/checkpoints/) and [server runtime](https://langchain-ai.github.io/langgraph/concepts/langgraph_server/) | stable thread/run identity, per-node checkpoints, leases and preservation of successful sibling writes | interrupt loops that re-execute an expanding prefix |
| [Bazel remote caching](https://bazel.build/remote/caching), [Nx affected](https://nx.dev/docs/features/ci-features/affected), [Dagger](https://docs.dagger.io/) and [Buck2 DICE](https://buck2.build/docs/insights_and_knowledge/modern_dice/) | explicit action inputs, CAS, dynamic dependencies and affected-only recomputation | caching side effects or treating declared-but-unused inputs as invalidators |
| [GitHub Spec Kit](https://github.com/github/spec-kit) | cross-artifact analysis and tasks with exact paths/dependencies | another prose phase without an executable intermediate representation |
| [OpenHands](https://github.com/OpenHands/OpenHands), [SWE-agent trajectories](https://swe-agent.com/latest/usage/inspector/) and [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/) | sandbox event stream, replayable trajectory, typed handoffs, guardrails and traces | a second agent framework that bypasses SVC authority |
| [Superpowers execution](https://github.com/obra/superpowers/blob/main/skills/executing-plans/SKILL.md) and [gstack](https://github.com/garrytan/gstack) | critical plan read, focused execution contexts, persistent browser/canary and specialized review lenses | a fixed reviewer army or browser session when the task does not need it |

The current Node prototype completes its focused controller suite in a fraction of a second. A Rust
rewrite cannot accelerate model calls, repeated plan review or Docker/provider waits. Native code is
therefore an evidence-gated optimization after the graph, state and cache semantics are correct.

## Eighty root causes and preserved-control replacements

The rule for every item is: preserve why the control was introduced, then compile, cache or route
it so an LLM does not repeatedly reconstruct it. `PRESERVE` means the safety/quality outcome stays;
`STRENGTHEN` means the new mechanism must catch at least the same negative fixtures plus the
historical failure named here. An untagged row in the replacement column means `REPLACE`, never
delete. Deletion is forbidden unless the row carries `DELETE: ZERO_UNIQUE_BENEFIT`, an owner-authority
digest, measured control ROI and a regression corpus proving that no unique protection disappears.
The control-value compiler enforces those dispositions over every row rather than treating this
table as explanatory prose.

| RC | Control purpose and live evidence | Root cause | Controller-v2 replacement and required proof |
|---:|---|---|---|
| 01 | Product questions prevent silent founder-assumption drift. `review-gate/SKILL.md:85` hard-gates on at least 40 questions; `route-workflow/SKILL.md:88` fixes a 20 customer + 20 system floor. | A quantity quota is used as a proxy for decision completeness. It can generate low-information questions while one unresolved authority decision still escapes. | Compile a decision ledger keyed by outcome, authority, state transition, failure behavior and external dependency. Question count becomes telemetry. **STRENGTHEN:** mutation fixtures remove one required decision while retaining 40 filler questions; compile must fail. |
| 02 | A manifest makes execution replayable. `plan-changeset/SKILL.md:133-141` requires a large prose package plus copy-pasteable shell sequence. | The execution program is hand-authored prose and shell, so every repair rewrites and re-reviews text unrelated to the changed behavior. | Human manifest becomes a view over typed task capsules and an execution DAG. Shell is generated from typed argv/actions. **PRESERVE:** a fresh host can replay from capsules and content-addressed receipts. |
| 03 | Dispatch blueprints were introduced to keep delegated executors deterministic. `plan-changeset/SKILL.md:118-131` says `inline` is the only mode used in practice, while the uncertainty default is `dispatch`. | The default can pay to draft code in the plan and then pay again to implement it, even though the observed normal path skips blueprints. | Decide mode mechanically from host capability and task isolation. Dispatch receives constraints, interfaces and tests, never full implementation blueprints unless the task is an exact mechanical transform. **PRESERVE:** delegated output remains bounded by capsule and allowlist. |
| 04 | Tier-1 plan checks were introduced to reject paths, commands and graph errors before model review. `scripts/verify-plan-mechanical.sh:9-19` checks six shallow properties. | It validates syntax and existence, not authority graphs, CLI argument contracts, result shapes, migration consumers, fixture cardinality or runtime ownership. | Replace with a plan compiler that emits capsules, authority edges, result contracts and runnable proof descriptors. **STRENGTHEN:** historical invalid CLI flag, missing RPC argument and missing authority-edge fixtures fail before review. |
| 05 | Pre-implementation simulation should expose impossible plans. `plan-changeset/SKILL.md:186-188` walks disk/planned files and grep signatures. | Simulation proves files and imports, not that migrations, consumers, fixtures, response shapes or authority paths execute together. | Add hermetic compile/replay simulation: clean schema, migration apply, contract probes, consumer type/shape compilation and fixture dry-run. **STRENGTHEN:** the Sample 4-source/5-candidate and legacy fingerprint failures are red fixtures. |
| 06 | Bounded tasks protect context and rollback. No executable task-capsule schema exists; the Sample run grew an 8,844-line bespoke control plane. | Task intent, allowlists, tests, receipts, forbidden changes and retry policy are spread across prose, JSON, lane state and chat batons. | ECV2-01 emits one canonical capsule per unit and derived views elsewhere. **PRESERVE:** root can prove parent, scope, tests and forbidden writes without loading product code. |
| 07 | Security/authority review protects RPC ownership, grants and privacy. Current planning has no compiler joining routes, arguments, owners, grants, relations and response projections. | Cross-layer omissions are discovered by Sol review or runtime after migrations are written. | ECV2-02 compiles `route -> call -> args -> owner -> grants -> relation -> projection -> consumer`. **STRENGTHEN:** every missing/extra edge and owner mismatch has a mutation-red fixture. |
| 08 | Migration review protects irreversible data and contract changes. Consumers are currently allowed to expose missing floor authorities late. | There is no pre-freeze consumer compilation or explicit migration-freeze boundary, so downstream discovery reopens expensive DB proof. | ECV2-08 compiles all named consumers against exact migration exports/ACLs before one freeze proof; later changes are additive by default. **PRESERVE:** clean-database, upgrade and rollback proof remain final gates. |
| 09 | Review scope locks prevent reviewers from wandering or inventing dependencies. `review-plan/SKILL.md:85-91` halts when a needed file was omitted from the listed universe. | The dependency universe is selected manually before review; the lock therefore catches omissions reactively through another plan round. | Build the candidate file/authority universe mechanically from imports, SQL references, routes, grants and consumers; reviewer adjudicates exceptions. **STRENGTHEN:** hidden-dependency fixtures must be included or fail before the paid review. |
| 10 | Self-review drains obvious defects before an expensive reviewer. `review-plan/SKILL.md:139-150` and `review-exec/SKILL.md:120-138` require two consecutive empty passes and still require external review. | "Nothing new" is an LLM judgment without a finding-set digest; repeated full rereads can continue without adding coverage. | One deterministic coverage pass plus one LLM gap pass keyed to normalized finding IDs. Stop when the finding/coverage digest is unchanged. **PRESERVE:** external plan and final execution reviews remain mandatory. |
| 11 | Re-review ensures accepted fixes did not introduce new defects. `review-plan/SKILL.md:182` reruns Tier 1 and Tier 2 after applying accepted findings; changed packages miss the review cache. | Any textual revision invalidates the full package even when the reviewed authority/risk lenses are unchanged. | ECV2-07 keys findings and evidence by relevant path/contract/lens digests. Re-run only invalidated lenses; global review stays on final freeze. **STRENGTHEN:** changing log wording cannot reuse a cleanup proof incorrectly, and cannot invalidate an unchanged ACL proof. |
| 12 | A second reviewer protects high-risk infra. `review-plan/SKILL.md:185-204` makes Tier 3 mandatory for broad paths including `.svc/`, `scripts/`, migrations, deploy and schema. | The classifier treats almost all framework and database plans as one monolithic risk surface, so a small mechanical correction receives another full package review. | Require a second reviewer only for a disputed high-risk semantic lens; mechanical lens changes use mutation-tested validators. **PRESERVE:** two-reviewer consensus still binds genuine security/authority disputes. |
| 13 | High-risk diffs need independent assurance. `execute-changeset/SKILL.md:103-104,195-196,225-229` forbids per-task review, while `:178-180` requires different-family independent review on every high staged task. | The execution contract is contradictory, so both the fast and expensive interpretations are policy-valid. | ECV2-09 makes four gates explicit: task-local deterministic proof, Luna self-audit, evidence-triggered plan authority, one final independent holistic review. **PRESERVE:** no high-risk code lands without behavioral proof and final independent review. |
| 14 | Risk reclassification catches scope creep. `execute-changeset/SKILL.md:178-180` may insert new review/proof tasks at every staged checkpoint. | A frozen plan can mutate structurally during ordinary implementation, invalidating ordering and receipts and causing plan-authoring work inside execution. | The capsule compiler declares permissible risk transitions. In-scope upward evidence adds a precompiled proof lens; unrepresented authority change freezes the plan. **STRENGTHEN:** unplanned auth/schema writes still hard-block. |
| 15 | Separation of duties prevents the root controller from contaminating implementation proof. `references/context-budget.md:45-55` says root must not load implementation/test files. | The rule is prose-only; the WI-368 root owned PTY/Docker/log transport and the Sample root repeatedly diagnosed product fixtures. | ECV2-03 issues path- and action-scoped capabilities. Root can call only acceptance/state/deploy actions; disposable runtime belongs to Luna. **PRESERVE:** production, money, device and deployment authority remain root-only. **PROOF:** distinct effect-boundary classes contribute to the system-wide mutation floor and produce zero unauthorized actions. |
| 16 | Disposable runtime proof is necessary for DB, provider and concurrency behavior. Product plans currently create bespoke shell/JS runners. | Transport, quoting, timeout, artifact retention and cleanup are reimplemented per task, so framework mechanics look like product failures. | Ship a framework-owned proof carrier with declarative setup/actions/assert/cleanup and typed artifacts. **STRENGTHEN:** transport mutation fixtures fail independently of product assertions. |
| 17 | Concurrent locking/idempotency proof protects real races. Current runs hand-build sessions, locks, waiters and residue assertions. | There is no standard concurrency case format, so parent/subshell, timing and cleanup defects recur and trigger plan repair. | ECV2-04 standardizes session A/B, barrier, timing, result, cleanup and residue artifacts. **PRESERVE:** real concurrent calls and lock observation remain required, not mocked. **PROOF:** barrier, waiter, duplicate-effect and residue mutations must fail. |
| 18 | Escalation exists so executors do not silently reinterpret a bad plan. Current controller state has no framework-wide typed failure taxonomy. | Product-contract, assertion, fixture, harness, environment and invocation failures enter the same repair channel. | ECV2-05 normalizes seven failure classes and routes only semantic/authority classes to plan impact. **STRENGTHEN:** classifier mutation suite prevents a semantic failure from being mislabeled mechanical. |
| 19 | Retry ceilings prevent infinite loops. Sample attempts were bound mainly by revision/attempt and repeatedly required new control policy. | The budget follows how many times a task ran, not whether the causal fingerprint and correction class changed. | Budget by normalized causal fingerprint: two executor-local mechanical corrections, one bounded assist, then freeze only on persistent semantic contradiction. **PRESERVE:** no fourth blind retry and no unlimited assist. **PROOF:** generated retry-state sequences reject a fourth mutation and duplicate assist. |
| 20 | Plan repair preserves an auditable decision trail. Sample R1-R21 repeatedly rewrote manifest, contract, lane, review log and controller tests. | Local fixture/serialization corrections are represented as global plan revisions, making control-plane change larger than product change. | ECV2-06 emits a small immutable repair delta over capsules; derived views regenerate. Mechanical corrections append executor evidence, not plan revisions. **PRESERVE:** actual product decisions still get founder/Sol-high authority and downstream invalidation. |
| 21 | Digests prevent stale evidence reuse. Current evidence commonly binds broad files or full packages. | Unrelated wording, fixture transport or control metadata changes invalidate security/product proofs, while coarse hashes do not explain which fact changed. | ECV2-07 uses Merkle-like relevant digests for paths, authority/result contracts, fixture schema and proof lens. **STRENGTHEN:** both false reuse and false invalidation have negative fixtures. |
| 22 | Atomic control commits make recovery exact. Sample produced R4-R21 control history around two accepted units. | A new commit/ref/state archival cycle is required for routine mechanical attempts, so recovery metadata dominates product history. | Commit only accepted unit checkpoints and genuine plan-repair controls. Failed attempts are content-addressed receipts linked from state. **PRESERVE:** every attempt remains attributable and recoverable without polluting first-parent product history. |
| 23 | Durable receipts prevent optimistic completion claims. `AGENTS.md:443-444` names Git notes plus a worktree mirror, while lane state and review logs retain overlapping evidence. | There is no single content-addressed receipt index; agents copy paths/digests between stores and revalidate equivalence. | One canonical receipt object store and append-only index; notes/lane/review views reference object digests and are regenerated. **STRENGTHEN:** missing object, forged mirror and wrong-tree binding fail closed. |
| 24 | Revalidation after merge catches integration breakage. `execute-changeset/SKILL.md:198-207` reruns relevant validation after each merge, but "relevant" is not compiled. | Agents conservatively repeat successful suites because dependency-to-validator edges and evidence validity are not machine-known. | Compile validator dependencies from capsule inputs/outputs and cache by validator version + relevant digest + environment identity. **PRESERVE:** any changed dependency invalidates the exact affected proof. |
| 25 | Full Tier 1 protects framework-wide invariants. `test-framework/evals/run-all-evals.sh:3,41-42,83-105` says `<10s` but always schedules all 275 validators. Measured wall time is 190.48 s with roughly 69K tokens of output. | The hot path runs a repository census and prints every passing assertion instead of selecting affected validators and emitting a compact receipt. | Add changed-path/contract selection, content cache and silent-pass summary; run the full sweep once at freeze/landing. **PRESERVE:** selected set plus dependency closure is auditable; final full sweep remains mandatory. **PROOF:** unknown paths fall back to full and dependency-removal mutations fail selection. |
| 26 | Host-state tests protect installed governance. `run-all-evals.sh:48-69` mixes real-host sequential validators into the same default sweep; the measured run failed on unrelated host install and historical WI metadata. | Current-change truth is conflated with baseline health, so unrelated residue blocks iteration and obscures the actual regression. | Separate `focused`, `repository`, `host`, and `release` validation classes. Record baseline failures once; focused runs fail only on new or selected failures. **STRENGTHEN:** release gate still requires a clean required-class baseline. |
| 27 | Behavioral tests ensure prose skills change agent behavior. `test-framework/SKILL.md:428-433,451-477` says deterministic canned and chain fixtures are not implemented; current scenarios cost about 50K tokens each. | The cheapest reliable behavioral regression layer is missing, forcing expensive LLM scenarios or static proxies. | Implement recorded deterministic skill/chain fixtures first; reserve LLM tests for irreducible judgment and calibration. **PRESERVE:** live LLM scenarios remain scheduled release/benchmark evidence. |
| 28 | Rich skills carry hard-won operating knowledge. The 103 included skills contain about 42,398 lines; 32 exceed 500 lines. | Runtime policy, examples, history and reference prose are loaded together, increasing context cost and contradiction risk. | Compile compact runtime contracts from skills; load examples/history/references on demand. **PRESERVE:** source skill remains human-readable and every compiled rule links to source line/digest. |
| 29 | Task-graph and model-routing guidance keeps all hosts consistent. Included skills contain about 169 repeated `Task-graph mode` blocks and 608 hard-coded model-name hits, despite `references/model-routing.md:8-17` defining cognitive labels. | Repeated prose is a manual code generator with drift; concrete model names leak transport policy into capability contracts. | Generate shared graph boilerplate and resolve only cognitive labels at runtime. **STRENGTHEN:** generated-mirror checks reject hand-edited copies and unknown model literals in runtime contracts. |
| 30 | Registries and framework state make routing/install behavior auditable. `AGENTS.md:305-312` lists five files that must stay synchronized; `FRAMEWORK-STATE.md:12` says 100 skills while `skills-manifest.json` has 103. | Framework self-knowledge and consumer mirrors are partly hand-maintained, so stale truth is normal and every registry edit has broad review surface. | Make manifest/registry canonical and generate all mirrors plus FRAMEWORK-STATE inventory from it. **PRESERVE:** generated output is committed and mutation-tested; human narrative fields remain separate. |
| 31 | Specs, journeys, plans and WIs preserve product intent. They remain independent Markdown/JSON artifacts with overlapping truth. | There is no canonical typed Spec IR from which human views and task contracts are generated. | ECV2-18 compiles actors, outcomes, states, decisions, authorities, ACs, effects and release obligations into a versioned IR. **PRESERVE:** human documents remain readable generated views with source spans. |
| 32 | Traceability tables connect code to user intent. Existing links stop at artifact boundaries and are manually restated. | There is no queryable provenance graph from founder decision through AC, capsule, code, proof, artifact and live receipt. | Every node and edge gets a stable ID and digest; missing or orphaned edges fail compilation. **STRENGTHEN:** a code path with a test but no signed outcome is not production-ready. |
| 33 | `sync-spec-code` and review skills look for drift. They do not compile every cross-artifact invariant before execution. | Contradictions among spec, journeys, plan, concern routing and release obligations survive until model review. | Add cross-artifact unification with explicit precedence and minimal unsatisfied-core diagnostics. Mutation tests invert one fact in each artifact family. |
| 34 | The concern registry is a powerful 116-lens taxonomy. Live inventory shows 88 concerns with no required rule/skill handler and 18 with no handler at all. | Detection exists without an executable obligation, so a concern hit can become a log rather than quality work. | ECV2-19 compiles every active concern into `block`, `required proof`, `advisory` or explicit `observed-only`; CRITICAL/HIGH may not have an empty obligation. |
| 35 | Skills describe excellent definitions of done for DB, UI, mobile, auth, payments and infra. | Production readiness is reconstructed from several skills instead of compiled from feature archetype plus active concerns. | Emit one archetype DoD contract containing functional, failure, security, observability, rollback and live-proof obligations. **PRESERVE:** domain-specific depth remains loadable on demand. |
| 36 | Scope locks prevent hidden dependency creep. Current candidate universes are assembled from paths and reviewer judgment. | No persistent brownfield code/authority graph is the substrate for planning and impact analysis. | Build an incremental repo graph for imports, routes, schemas, SQL objects, grants, env, deploy and tests; declared scope is checked against its closure. |
| 37 | `design-ui`, visual tracking and viewport graph guards protect experience quality. | There is no compiled UI contract binding states, viewports, accessibility, interaction, visual baseline and performance budget to executable proof. | Generate UI proof capsules and selectors from a UI IR; visual/accessibility/performance mutations must fail the owning lens before review. |
| 38 | Preflight checks stop missing tools, accounts and environments. Discovery is repeated inside plans and task execution. | Environment/provider capabilities are not a reusable signed snapshot with expiry and task dependencies. | Compile an expiring capability snapshot; tasks consume exact capability IDs and only re-probe expired or changed dependencies. |
| 39 | `diagnose-bug` preserves evidence and root cause. Reproduction artifacts are still authored case by case. | A production incident or reported bug does not automatically become the smallest deterministic replay fixture. | Minimize the observed trace into a red fixture before mutation; link incident, causal fingerprint, fix and regression proof. |
| 40 | `.svc/lane-tasks-*.json` and pipeline decisions preserve state. They are snapshots/partial journals, not a complete replayable workflow history. | Current state cannot always be reconstructed solely from immutable events, so repair needs bespoke control commits and manual archaeology. | ECV2-20 appends typed events and derives state; replay from zero must reproduce byte-identical task, attempt, evidence and release views. |
| 41 | Controller leases and generation-bound CAS already provide strong mutation ownership. | Lease authority is not yet a general durable work queue with task heartbeat, cancellation, recovery and exactly-one transition semantics. | ECV2-22 layers durable task claims over the existing lease primitive; crash/restart replay requeues only nonterminal work and never duplicates accepted effects. |
| 42 | Delegation capabilities constrain child Git mutation. Tool, network, provider, deploy and paid actions remain mostly prose-governed. | There is no universal typed effect system joining action, target, principal, cost, reversibility and required authority. | ECV2-21 requires every mutating/external action to present a scoped effect capability; unknown effects fail closed before tool execution. |
| 43 | Worktrees and disposable environments provide isolation. | There is no standard per-task snapshot/restore primitive for filesystem, DB fixture and generated evidence state. | The runtime records a pre-effect snapshot and typed compensation/restore operation; rollback proof is mandatory for reversible tasks. |
| 44 | Payment/provider/deploy skills describe idempotency and cleanup. | External writes have no framework-wide idempotency-key, effect receipt and readback contract. | Side-effect actions declare idempotency key, expected remote identity, readback and compensation; replay cannot repeat an already-confirmed effect. |
| 45 | Individual scripts have timeouts and some skills carry budgets. | There is no end-to-end deadline/resource scheduler allocating the WI budget across model, validation, environment and external waits. | Compile per-node active budget and global deadline; scheduler exposes consumed/remaining/blocked time and chooses stop, assist or escalate causally. |
| 46 | Provider launchers classify several failures. | There is no shared circuit breaker/backpressure policy across model, browser, database, provider and deployment resources. | Add resource-keyed concurrency, cooldown and failure windows; terminal auth/config errors never enter retry storms and transient failures retain one causal budget. |
| 47 | SVC has waves, child capabilities and parallel helpers. | Parallelism is selected manually rather than from dependency, write-conflict, resource and evidence graphs. | Scheduler parallelizes only independent nodes, serializes overlapping effects and proves deterministic merge order. Shadow replay must match sequential truth. |
| 48 | Repeated CLI startup is currently cheap, but repository discovery and browser/environment setup recur. | There is no optional long-lived repo/runtime daemon preserving parsed graphs and safe sessions between tasks. | ECV2-29 introduces a disposable daemon only where profiling proves benefit; cache identity remains content-addressed and restart-safe. **PROOF:** cold replay after daemon deletion reproduces the same graph, schedule and evidence digests. |
| 49 | Many SVC helpers emit JSON, while others print human prose or mix PASS detail with diagnostics. | There is no stable JSON protocol/version/error envelope across all machine-consumed commands. | Version every CLI request/result; stdout is one structured result, stderr is bounded diagnostics, and compatibility fixtures protect consumers. |
| 50 | Context-budget guidance correctly limits root and executor reads. | Context is selected by prose rules, not compiled from unresolved provenance and dependency closure. | Generate a bounded context capsule containing only open decisions, current node, relevant source spans and receipts; closed facts become digest references. |
| 51 | Handoffs preserve agent continuity. Their shapes vary by skill, host and repair generation. | Structured outputs are not universal at every agent/tool boundary. | Every handoff validates against a versioned schema with task/run IDs, effects, findings, evidence and next-state proposal; freeform narrative is optional. |
| 52 | Individual controllers normalize some error classes. Most scripts expose arbitrary messages and exit codes. | There is no framework-wide causal code namespace and error-chain schema. | Normalize stage, causal code, resource, retryability and redacted evidence; fingerprint ignores noise but changes on causal facts. |
| 53 | Retry rules protect against transient failure. | Flakes, deterministic product failures, environment drift and poisoned fixtures are not statistically distinguished. | Track validator history by exact input/env; quarantine only proven flakes, require reproduction, and never convert a first failure into green by retry alone. |
| 54 | Cache concepts exist in external review and the v2 prototype. | Proof reuse lacks one universal hermetic environment fingerprint across runtime, dependencies, schema, locale, clock and tool versions. | ECV2-23 defines environment identity and rejects reuse on any declared environmental dependency change. |
| 55 | Critical WIs sometimes prove clean database/build/device behavior. | Clean-room reproducibility is not a compiled obligation for every critical artifact class. | Archetype DoD selects clean checkout/database/build proof and compares canonical artifact digests before release. |
| 56 | Negative fixtures exist across many guards. | Mutation testing is not mandatory for a new validator, policy or authority edge, allowing false-green guards. | ECV2-24 requires each control to ship at least one mutation it kills and records mutation score by lens. Security/authority controls require boundary mutations. |
| 57 | Unit tests cover many state helpers. | Workflow, lease, retry and rollback state machines lack systematic generated transition/property testing. | Generate event sequences with invariants for single acceptance, monotonic authority, bounded retry, replay equivalence and cleanup. |
| 58 | Framework migrations are reviewed carefully. | Old/new controller, validator and model policies are not routinely run differentially over the same corpus. | Shadow both versions; unexplained output/state/proof differences block default cutover and become replay fixtures. |
| 59 | External provider tests retain selected receipts. | Network/browser/provider interactions have no standard record/replay format with secret redaction and expiry. | Record signed redacted exchanges where policy allows; deterministic replay drives local tests, while live proof remains a release obligation. |
| 60 | Receipts distinguish several proof types informally. | Evidence has no universal trust level, freshness and composability rules. | Define `static`, `hermetic`, `sandbox`, `device`, `staging`, `production` trust levels; higher claims require the matching level and nonexpired dependencies. **PROOF:** trust downgrade, expiry and environment-drift mutations reject reuse. |
| 61 | Test framework documents deterministic, chain and live scenarios. `COVERAGE-MATRIX.md` reports Tier-3 Judge 0/62; skills 13-17 are simulated and comparisons are manual. | The framework cannot continuously prove that its prompts and runtime produce production behavior. | Implement recorded deterministic/chain fixtures first, then scheduled live statistical suites with bounded cost and explicit environment receipts. |
| 62 | Session transcripts and receipts make debugging possible. | SVC lacks one end-to-end trace with spans for routing, model, tool, validation, wait, cache, review and release. | ECV2-26 emits OpenTelemetry-compatible spans plus a replay trajectory; secret-safe trace IDs bind every event and receipt. |
| 63 | Final SHA/artifact receipts protect release identity. | There is no universal SBOM, dependency provenance and signing/attestation chain selected by artifact risk. | ECV2-25 adds build provenance, dependency inventory and signing obligations for releasable artifacts; verification uses the exact promoted digest. |
| 64 | `verify-promotion`, canary concerns and release skills describe safe rollout. | Progressive rollout is not one executable state machine with traffic steps, hold windows and health gates. | Compile `build -> stage -> canary -> expand -> complete` transitions; every step consumes exact health evidence and is replayable. |
| 65 | Rollback is required in plans. | Automatic rollback triggers and compensation ownership are not machine-bound to rollout state. | Declare rollback thresholds, authority, command/effect and post-rollback verification before deploy; breached gates stop expansion automatically. |
| 66 | Projects define live probes and journeys. | There is no selector that turns changed provenance/concerns into the minimal production synthetic journey set. | Generate final-SHA live probes from affected user journeys plus mandatory safety canaries; unchanged journeys reuse fresh evidence only when allowed. |
| 67 | `design-tech` requires SLA/SLO/error-budget thinking. | SLOs are document fields, not controller inputs that govern ship/stop/escalate decisions. | Compile service indicators, windows and budgets; release gate consumes live values and records explicit override authority. |
| 68 | Audits and retros capture incidents. | There is no automatic incident-to-causal-trace-to-regression-corpus loop. | ECV2-28 minimizes every confirmed incident into a replay, attaches the fix/control delta and prevents closure without the red-to-green artifact. |
| 69 | Visual tracking, browser testing and performance reviews exist as separate capabilities. | Visual, accessibility, interaction and performance baselines are not one affected-only browser evidence engine. | Keep a warm isolated browser when beneficial; compare only changed journeys/viewports and store deterministic screenshots, traces and budgets. |
| 70 | Plans request monitoring, ownership, runbooks and cleanup. | There is no single operational-readiness compiler proving alerts, dashboards, owner, rollback, backup/restore and support path for the chosen archetype. | Release compilation emits required operational edges and fails on missing owner/runbook/probe instead of relying on reviewer memory. |
| 71 | Some launchers report cost and some scripts track time. Token efficiency for WI-368 remains unknown. | Model/tool/token/cost/wall/wait telemetry is partial and cannot explain the biggest time offenders. | Trace every node with active/wait time, input/output tokens, model/tool/version, cache result and cost; optimize measured critical path, not anecdotes. |
| 72 | Model routing resolves cognitive labels to approved tuples. | Routing is mostly static policy, not calibrated by task-class quality, latency and cost outcomes. | Maintain an evaluation scorecard per task class; choose the cheapest tuple meeting quality/SLO and canary policy changes in shadow mode. |
| 73 | Receipts bind some model and policy facts. | Prompt, compiled skill, tool, schema, runtime and environment versions are not attached to every trajectory. | Make the complete execution identity mandatory; replay reports exactly which component drifted. |
| 74 | `render-status.mjs` provides a useful offline dashboard. | Operators still lack a live causal status: current node, owner, active/wait time, blocker, ETA confidence and next permitted action. | ECV2-26 renders the event log as CLI/HTML control room; no chat archaeology is required to answer “what remains?” **PROOF:** replay projects byte-identical status and every blocker mutation names one causal next action. |
| 75 | Controls were added after real incidents and protect valuable outcomes. | Their ongoing cost, hit rate, false-block rate and prevented escapes are not measured, so obsolete ceremony accumulates. | Run new controls in shadow, measure ROI, promote on killed mutations/real catches, and deprecate controls with replacement evidence. |
| 76 | Addons, hosts, skills and schemas support a broad ecosystem. | There is no versioned plugin ABI with capability negotiation and migration hooks. | ECV2-27 defines plugin manifests, inputs/outputs/effects, compatibility range and conformance suite; unknown privileges are rejected. |
| 77 | Install/migration scripts handle several host transitions safely. | Framework-wide schema/runtime compatibility and downgrade policy is not one tested matrix. | Test N/N-1 data and plugin compatibility, forward migration, failed migration recovery and explicit downgrade refusal/rollback. |
| 78 | Append-only evidence and caches preserve auditability. | Retention, quota, garbage collection and legal hold are not governed by reachability/trust/freshness policy. | Mark reachable release evidence, pin legal/incident objects, expire reusable caches safely and prove GC never removes referenced proof. |
| 79 | SVC evolves through proposals, skills and host installations. | There is no self-hosted release train that dogfoods the new engine, publishes compatibility evidence and rolls back a bad framework release. | Version engine/policy/schema together, run golden repositories, canary host installs and retain an atomic previous-version rollback. **PROOF:** forced canary failure performs rollback and re-verifies the prior installed version. |
| 80 | A native engine could reduce startup, parsing or hashing cost at scale. Existing GSD deep-dive already skipped an unproven Rust rewrite. | Language choice is being confused with workflow architecture; rewriting first would preserve the same repeated work faster. | ECV2-30 profiles realistic repositories. Rust/WASM/native modules are allowed only when a named hot path exceeds its SLO and a prototype proves >=3x there without semantic drift. **PROOF:** Node/native differential replay must be semantically identical before the measured speedup can authorize cutover. |

These causes are coupled but not interchangeable. The first eight shift defects left into plan
compilation; 09-14 collapse redundant review; 15-24 make execution/recovery cheap without weakening
authority; 25-30 make the framework itself fast enough to validate on every useful boundary;
31-39 compile scattered product knowledge; 40-51 form the durable/effect-safe runtime; 52-62 make
evidence trustworthy and replayable; 63-70 close the production release loop; 71-80 make the engine
observable, evolvable and fast for measured reasons.

## Expected contract

The intended execution contract was:

1. a founder plus high-reasoning model produces one decision-complete plan;
2. one independent review signs the frozen plan;
3. Sol-medium orchestrates, without implementing product code;
4. Luna-max executes tasks sequentially inside plan boundaries;
5. each task ends in one atomic checkpoint and compact handoff;
6. mechanical errors remain inside the executor loop;
7. concrete evidence of a bad plan freezes mutation and routes to one plan-repair decision;
8. after all tasks, one holistic review checks the complete frozen diff;
9. deployment and live proof run only from the landed final SHA.

The repository contract is internally inconsistent today:

- `execute-changeset/SKILL.md:102-104` says there is no per-task quality review and only one
  holistic review;
- `execute-changeset/SKILL.md:178-180` says every high task needs different-family independent
  review and a regenerated full diff receipt.

That contradiction makes repeated review both forbidden and mandatory. WI-368 selected the
expensive interpretation until the founder explicitly corrected it.

## Actual execution

1. The product plan correctly captured most founder outcomes and security invariants, but combined
   unrelated authority domains into oversized DB tasks.
2. The initial executable harness under-specified fixture floors, generated SQL, receipt
   persistence, cleanup ownership, parent/subshell behavior and container/host paths.
3. Sol review began before the proof vehicle was syntactically and operationally stable.
4. Mechanical changes changed a broad digest and were repeatedly treated as new security review
   surfaces.
5. Root built and drove disposable runtime orchestration, introducing failures unrelated to the
   product candidate.
6. Smaller dedicated runners and persistent receipts eventually stabilized task-04/task-05.
7. A single Luna controller improved implementation throughput, but root initially retained Target
   A/B runtime ownership at 07db — repeating the old control-plane defect.
8. The run corrected itself: Luna now owns the complete 07db disposable lifecycle and root checks
   only the scoped bundle and receipt.
9. Execution discovered two plan defects before 08a: the DB lacked compound verification-admission
   authorities, and the first repair accidentally routed owner-created accountability-phone proof
   through Google despite the signed no-Google contract.

## Expected vs actual matrix

| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Task size | 1 migration or 2-3 authority domains | task-04 carried seven authority domains | FAIL | WI-368 manifest and transcript audit |
| Executor ownership | Luna owns implementation through disposable cleanup | root repeatedly owned PTY/Docker/log transport | FAIL | session trace |
| Review timing | frozen, runtime-ready surface | reviewer saw quoting, fixture and cleanup churn | FAIL | transcript audit |
| Plan fidelity | executable authority/result graph | product prose was strong; DB/API/test bridge had gaps | WARN | 07db PLAN_IMPACT evidence |
| Runtime evidence | persistent and machine-verifiable | early runners deleted/transiently copied evidence | FAIL | task-03/04 history |
| Security quality | independent high-risk findings preserved | important capability/ACL/visibility defects were found | PASS | accepted task findings |
| Checkpoints | one atomic trace point per bounded task | adopted from task-03 onward | PASS | git history |
| Final review | one cumulative frozen review | not reached | PENDING | lane task graph |
| Deployment authority | root owns staging/prod and live proof | preserved | PASS | manifest |

## Fault-domain report

### Project-specific

- Complex PostgreSQL concurrency, phased migrations and private storage legitimately require
  behavioral runtime proof.
- Claim, setup, launch, verification, QR, referral and follower authority interact across floors.
- These facts justify high assurance; they do not justify bespoke orchestration per assertion.

### Agent-specific

- Root took over runtime work that belonged to the executor.
- Review was repeatedly requested before the harness was ready.
- The first 07db plan repair failed to re-check the original owner-created no-Google invariant.
- Oversized contexts retained dozens of already-closed findings and made attention resets late.

Every agent-specific issue below has a proposed mechanical framework enforcement. “Be more
disciplined” is not accepted as a fix.

### Framework-specific

- no executable task-capsule schema;
- no compiler that joins Edge routes, RPC signatures, function ownership, ACLs and projections;
- contradictory per-task review policy;
- no relevant-lens invalidation receipt;
- no standard concurrency-runner library;
- no explicit migration-freeze boundary;
- no machine failure taxonomy or escalation budget;
- no plan-repair router that separates existing-truth reconciliation from a real product decision;
- no rule that the executor owns disposable runtime through cleanup;
- no bounded context-reset policy for a logically persistent executor.

## Holistic integration audit — blockers added to this changeset

Three independent read-only audits covered the proposal/current slice, skills/product graph, and
hooks/runtime/memory surfaces. Promotion and default cutover remain blocked until the following
gaps are implemented and differentially proven. They are one causal architecture changeset, not
separate framework-improvement loops.

| ID | Current break | Required integrated correction | Unique value preserved |
|---:|---|---|---|
| H-01 | early skills and `route-workflow` produce artifacts without enforceable output/consumer contracts | compile producer, named consumer, product outcome, consumption condition, invalidation inputs, digest, acknowledgement and retention for every required artifact | discovery, research and routing evidence |
| H-02 | autonomous routing, forty-question floors and unconditional human checkpoints contradict each other | add owner interaction/language/delegation policy to the session contract; make `decide` the sole localized owner adapter | owner understanding and strategic authority |
| H-03 | competitor/domain/capability evidence is written, skipped, refreshed against the wrong index or consumed before journeys/specs exist | emit typed project evidence; route delta to capability refresh, affected journey/spec/WI invalidation and named consumers | competitive and domain intelligence |
| H-04 | manifest lanes and skills disagree on plan/final review order and gate numbering | compile one stage DAG: plan review once, incremental task acceptance, frozen-diff review once, land, live verify | every review lens, separation of duties |
| H-05 | lifecycle ends at `VERIFIED` task/code state | add `OUTCOME_PENDING -> OUTCOME_OBSERVED -> DELTA_EVALUATED -> KEEP/ITERATE/ROLLBACK/NEXT_DECISION` | product measurement and prioritization |
| H-06 | learning schemas disagree and product skills rarely declare recall topics | unify learning schema; derive recall topics from graph; record used/ignored disposition; credit only after linked outcome | compounding knowledge without prompt spam |
| H-07 | approved company-fleet decision cards do not create product work or receive product outcomes | add authorized `decision card -> verdict -> consumer route -> WI/product graph -> record-outcome` bridge | proposer-only fleet safety and company memory |
| H-08 | strategic decision and research outputs are prose/free-text handoffs | emit typed decisions, rejected options, evidence weights, revisit/rollback triggers and side-effect-free research results | deep analysis, provenance and reversible strategy |
| H-09 | landing does not declare final review/audit receipt as a hard input | require one final-review-station object resolving all constituent lenses at the final SHA | holistic review quality |
| H-10 | task graph is serial/single-active while v2 scheduler claims parallel waves | journal-backed multi-lease graph; dependencies from data/file/effect/resource edges; deterministic merge | safe parallelism and worktree isolation |
| H-11 | evidence integrity is checked, but intended consumers never acknowledge resolved objects | CAS-backed evidence/consumption ledger with producer, consumer, condition, trust, outcome and invalidation binding | receipts and auditability |
| H-12 | event lifecycle ends at task acceptance; controller has no durable `run/resume/dispatch/release/observe` | one append-only runtime and CLI spanning leases, validators, effects, review, release, rollback, live probes and observation | deterministic replay and crash recovery |
| H-13 | loop guard measures repeated tools/diff-stat, not product progress | one causal progress gate resolving state, evidence, obligations and authority; same state/fingerprint cannot rerun | bounded retries and useful failure evidence |
| H-14 | hooks discard or only inject useful signals and differ by host | generate thin host ingress from capability manifests; normalize events into the journal; keep correctness in runtime | host-native ergonomics and portability |
| H-15 | 39 skills duplicate continuation boilerplate and framework repair forbids one unified causal changeset | preserve single-gap default; add owner-approved unified-causal mode; extract identical mechanics into one versioned adapter contract | skill-specific semantics with lower context/drift |
| H-16 | current protocol trusts a caller-supplied layer subset and SHA-shaped progress claims | compile the real denominator from stage/skill/concern/authority/host registries and resolve progress claims through CAS/graph authority | applicable-layer completeness and anti-forgery |
| H-17 | direction-to-live and frozen-plan-to-live use two incompatible 60-minute definitions | canonicalize `DIRECTION_ACCEPTED -> DELIVERY_VERIFIED <= 60 active min`; keep metric wait visible outside active clock | honest speed measurement |

The bounded file program spans the canonical runtime/schemas plus the core router, intelligence,
decision, plan, execute, review, release, learning and company-fleet contracts named by the audits.
Shared adapters are preferred over copying another block into every skill. Compatibility views remain
readable until differential replay proves N/N-1 rollback.

## Target operating model

```text
Founder + high-reasoning plan authority
    -> holistic plan + compiled task capsules
    -> one independent frozen-plan review

Sol-medium root controller
    -> selects capsule
    -> checks allowed diff + machine receipt
    -> owns plan state and staging/prod authority
    -> never implements product code or disposable-runtime transport

Conflict-aware Luna-max worker pool
    -> scheduler leases only dependency/resource/effect-independent capsules
    -> every worker receives the same signed product index and its relevant proof slice
    -> implements
    -> static gates
    -> provisions disposable environment
    -> runtime/races
    -> fixture/harness/environment corrections
    -> cleanup + persistent receipts
    -> scoped checkpoint commit
    -> stops

Evidence-triggered exception
    -> classify failure
    -> existing signed truth: mechanical plan reconciliation
    -> genuine product choice: strategic-decision on Sol-high

After all tasks
    -> one frozen holistic review
    -> invalidated subset only if remediation changes a reviewed lens
    -> land
    -> root staging/prod deployment and live probes
```

## SVC Engine target architecture

SVC remains the product-quality constitution; the Engine makes that constitution executable. It is
one local-first program with separable planes, not a fleet of new services:

| Plane | Canonical state | Responsibility | Reuses current SVC assets |
|---|---|---|---|
| Intent compiler | Spec IR + provenance DAG | unify founder decisions, specs, journeys, concerns, ACs and release obligations | skills, concerns, WIs, specs |
| Workflow control | append-only event journal + derived task view | deterministic state, leases, retry, deadline, cancellation, recovery and affected scheduling | lane graphs, controller lease, task graph |
| Effect/security | capability ledger | authorize filesystem, Git, network, provider, payment and deploy effects before execution | delegation capabilities, rules, authority guards |
| Execution | sandbox worker protocol | run agents/tools in bounded context and own fixture/runtime/cleanup through checkpoint | worktrees, host adapters, Luna executor |
| Evidence | CAS + validation DAG + trajectories | affected-only proof, environment identity, receipts, replay and trust levels | validators, receipts, external-review cache |
| Quality lab | replay/mutation/property/differential corpus | prove the framework catches historical and synthetic regressions | test-framework, session audits, golden WIs |
| Release | artifact + rollout state machine | build provenance, stage, canary, expand, rollback and final live proof | land/verify-promotion, deploy concerns |
| Operations | trace/event projection | live status, causal blocker, ETA, cost, SLO and control ROI | status renderer, dispatch reports, finops |
| Platform | versioned plugin ABI + compatibility matrix | host/addon portability, migration, install canary and rollback | manifests, host provisioners, schemas |
| Learning | incident/trace miner | convert escaped defects and expensive paths into replay fixtures/control deltas | audits, retros, manage-learnings |

Canonical ownership is strict: the event journal owns workflow truth; CAS owns immutable evidence;
the Spec IR owns machine product truth; Git owns accepted code and human review history. Markdown,
lane JSON, Git notes, dashboards and chat handoffs are projections. They may never disagree silently
or become additional writable sources of truth.

The Engine runs local-first with no mandatory service. A daemon, remote workers or object storage
are optional adapters behind the same event/action protocol. This preserves offline Git recovery
and allows a future high-performance native implementation without changing semantics.

## State machine

### Product-delivery decision tree

```text
DIRECTION_ACCEPTED
  -> EVIDENCE_RESOLVED
  -> OUTCOME_OPTIONS_RANKED
  -> OUTCOME_AUTHORIZED
  -> PRODUCT_GRAPH_COMPILED
  -> PLAN_REVIEW_PASSED
  -> EXECUTION_PREFLIGHT_PASSED
  -> TASK_GRAPH_RUNNING
  -> CANDIDATE_VALIDATED
  -> FROZEN_DIFF_REVIEW_PASSED
  -> FINAL_SHA_BOUND
  -> PRODUCTION_RELEASED
  -> LIVE_VERIFIED
  -> OUTCOME_OBSERVATION_SCHEDULED
  -> DELIVERY_VERIFIED
  -> OUTCOME_OBSERVING
  -> OUTCOME_OBSERVED
  -> NEXT_DECISION_RECORDED
  -> OUTCOME_DECIDED
```

Every decision node uses the same technique order:

```text
hard-constraint filter
  -> evidence trust/freshness/relevance weighting
  -> expected product value
  -> value of information
  -> minimax regret when estimates overlap
  -> reversibility preference
  -> complete critical-path fit <= remaining active budget
```

Decision branch coverage:

| Node | Signal | Deterministic route | Required evidence consumer |
|---|---|---|---|
| intake | authority/language/mode valid | evidence resolution | outcome synthesizer |
| intake | missing consequential authority | one localized owner decision | delegation broker |
| evidence | enough to distinguish options | rank options | decision graph |
| evidence | uncertainty decision-relevant and value-of-information exceeds cost | bounded side-effect-free research, then resume blocked consumer only | named uncertainty |
| evidence | more research has no decision value | decide from evidence or stop; no research loop | decision receipt/stop package |
| decision | reversible or explicitly delegated | sign selection and rejected alternatives | product graph |
| decision | consequential, undelegated or tied | `decide` in configured language/level | authority receipt |
| planning | smallest complete outcome fits 60 active minutes | freeze graph/capsules | executor runtime |
| planning | smaller complete slice exists | re-slice once with a new graph digest | plan compiler |
| planning | no complete slice fits | stop/ask; never delete quality proof | owner/backlog |
| execution | independent scopes/resources/effects | parallel lease wave | merge scheduler |
| execution | overlap/unknown/shared migration/root config | deterministic serialization | next lease |
| failure | mechanical/fixture/environment and new causal state | same worker bounded correction | validator and retry classifier |
| failure | same state plus same fingerprint | reject immediately | terminal evidence/operator |
| failure | signed plan contradiction | affected-lens plan repair | invalidation compiler |
| failure | new product/authority choice | strategic decision | amended graph |
| review | correctable finding with named lens | invalidate affected tasks/proofs only | executor/validator |
| review | unchanged finding/lens digest | reuse finding; do not pay another opinion loop | final review station |
| release | canary/live proof passes | delivery close + observation schedule | customer/operations/metric |
| release | canary/live proof fails | typed rollback, product stays unverified | operator and repair decision |
| outcome | window matures with valid metric | delta evaluation | next-priority decision |
| outcome | metric invalid/missing | evidence-backed measurement repair, not release false-green | observation owner |

### Task-graph progression

```text
PLANNED
  -> BLOCKED | READY
READY
  -> LEASED | REUSED_RELEVANT_PROOF
LEASED
  -> RUNNING | LEASE_EXPIRED
RUNNING
  -> CANDIDATE | RETRYABLE_FAILURE | ASSIST_REQUESTED | PLAN_FROZEN | TERMINAL_FAILURE
CANDIDATE
  -> VALIDATING
VALIDATING
  -> ACCEPTED | RETRYABLE_FAILURE | STALE_PROOF
ACCEPTED
  -> MERGE_BLOCKED | MERGE_READY
MERGE_READY
  -> MERGING
MERGING
  -> MERGED | RETRYABLE_FAILURE
MERGED | REUSED_RELEVANT_PROOF
  -> CONSUMED
```

Rules that make the progression finite:

- a state transition is journaled with previous-state digest, causal fingerprint and idempotency key;
- a retry must change relevant product/code/environment state, resolve an obligation, add resolved
  evidence, record an authorized decision or reduce measured uncertainty;
- attempt ceilings are per causal fingerprint, not per prose plan revision;
- a repair invalidates only downstream capsules/evidence whose declared interfaces or relevant
  digests changed; accepted siblings remain valid;
- every lease has owner, generation, heartbeat, expiry and deterministic reclaim;
- cached proof advances only after all relevant input, environment, validator and authority digests
  resolve exactly;
- `CONSUMED`, not `ACCEPTED`, is the terminal task contribution to product delivery.

### Canonical receipt and consumption chain

```text
owner direction/delegation
  -> evidence claims and uncertainty resolution
  -> ranked options + selected/rejected decision
  -> product protocol + canonical layer inventory
  -> product proof graph + reviewed plan
  -> task capsule + lease/authority
  -> execution trajectory + candidate commit
  -> validator evidence + task acceptance
  -> deterministic merge + frozen cumulative diff
  -> final review-station PASS
  -> final SHA + build provenance
  -> deploy/canary/rollback-ready/live-probe evidence
  -> production delivery receipt
  -> scheduled metric observation
  -> observed delta
  -> next product decision
  -> outcome-linked learning/regression candidate
```

Each arrow is a digest-bound consumption acknowledgement. `RUNTIME`, `RELEASE` or `LEARNING` alone
cannot satisfy a product terminal. Product terminals are customer, owner, operations and the named
metric. Framework learning is allowed only after its source product evidence already has a product
consumer.

### Full-cycle route simulation

The proposal is simulated by route class rather than one happy path. The active times are admission
budgets for a Sample-class slice, not claims of measured production performance. Every failure row is
terminal-safe or resumes from the smallest affected state.

| Scenario | Interaction / graph route | Expected terminal | Active budget | Quality reduction |
|---|---|---|---:|---:|
| complete delegated feature | autonomous evidence -> ranked option -> parallel graph -> review -> canary/live | `DELIVERY_VERIFIED` then observation open | 48 min + 12 min reserve | none |
| strategic product choice | one Bulgarian simplified question -> signed choice -> normal delivery | `DELIVERY_VERIFIED` | 55 min | none |
| bounded high-value research | blocked uncertainty -> positive VOI research -> resume decision consumer | `DELIVERY_VERIFIED` | 58 min | none |
| low-value research temptation | negative VOI -> decide from evidence | `DELIVERY_VERIFIED` or evidenced stop | <= 50 min | none |
| no complete 60-minute slice | compiler re-slices to smallest complete outcome | `DELIVERY_VERIFIED` only if new graph fits | <= 60 min | none |
| no valid smaller slice | fail admission before implementation | `OWNER_DECISION_REQUIRED` / `STOPPED_WITH_EVIDENCE` | <= 8 min | none |
| independent task wave | disjoint file/resource/effect capsules leased concurrently | normal merge/delivery | <= 60 min critical path | none |
| shared migration/root config | overlap compiler serializes affected nodes only | normal merge/delivery | <= 60 min or admission stop | none |
| first mechanical failure | same worker applies bounded correction with new state digest | normal delivery | <= 57 min | none |
| repeated identical failure | causal gate rejects same state/fingerprint | `STOPPED_WITH_EVIDENCE` | <= remaining budget | none |
| signed-plan contradiction | invalidate affected graph suffix; authorized repair | delivery or owner decision | budget re-forecast required | none |
| new product authority | freeze before write; localized owner/delegated decision | `OWNER_DECISION_REQUIRED` or amended graph | clock visible | none |
| stale cached proof | relevant digest mismatch forces affected validator only | normal delivery | <= 60 min or stop | none |
| review finding | changed lens invalidates named tasks/proofs once | normal delivery or safe stop | <= 60 min or stop | none |
| duplicate review opinion | same finding/lens digest reused | no new loop | 0 incremental model review | none |
| external provider queue | journal enters visible `EXTERNAL_WAIT`, lease-safe resume | resumes prior state | active clock paused; elapsed shown | none |
| canary failure | rollback evidence executes before expansion | `ROLLED_BACK`, not complete | <= 60 min | none |
| live-probe failure | rollback/repair route; no delivery receipt | `ROLLED_BACK` / safe stop | <= 60 min | none |
| delayed business metric | delivery closes with scheduled owner/query/window | `DELIVERY_VERIFIED`, later `OUTCOME_DECIDED` | <= 60 min active + visible wait | none |
| negative observed delta | next decision chooses revise/rollback/stop | `OUTCOME_DECIDED` | measurement window external | none |
| hookless/fail-open host | canonical CLI/runtime still enforces effects and journal | same as host with hooks | no host correctness dependency | none |
| crash/restart | replay journal, reclaim expired lease, resume next permitted action | prior route preserved | <= 5 s resume SLO | none |
| learning-only activity | rejected as product progress until linked outcome is consumed | no false completion | 0 accepted progress | none |

Model-check acceptance for implementation:

- every declared decision and task transition above is reachable or has a deterministic N/A proof;
- every nonterminal state has an outgoing route and every cycle edge requires new resolved progress;
- every produced receipt has at least one required named consumer and immutable acknowledgement;
- every path to `DELIVERY_VERIFIED` contains selection, graph, validation, final review, final SHA,
  release, live verification, rollback readiness and observation scheduling;
- every failure path is fail-closed, resumable from a bounded state, or terminal with evidence;
- 100 **distinct** mutation classes across layers, authority, evidence, consumption, task progression,
  hooks, lifecycle and timing produce zero false delivery/outcome closure.

Exception paths remain explicit:

```text
RUNNING -> IMPLEMENTATION_RETRY -> RUNNING
RUNNING -> ASSIST_REQUESTED -> RETRY_AUTHORIZED -> RUNNING
RUNNING -> PLAN_FROZEN -> PLAN_AMENDED -> RUNNING
RUNNING -> EXTERNAL_WAIT -> RUNNING
```

The same normalized failure fingerprint may receive one orchestrator assist. A second identical
failure freezes the plan only if it is contract-related; mechanical retries remain executor-owned
and are bounded by their runtime budget.

## Proposal components

### ECV2-01 — Compiled task capsule

`plan-changeset` must emit a machine-readable capsule per executable task:

```json
{
  "task_id": "08a",
  "product_outcome": "provider-bound verification admission",
  "dependencies": ["07db"],
  "plan_digest": "sha256:...",
  "allowed_files": [{"path": "...", "action": "MODIFY"}],
  "migration_floor": "20260811122000",
  "authorities": [],
  "response_contracts": [],
  "stored_postconditions": [],
  "forbidden_writes": [],
  "provider_order": [],
  "validations": [],
  "receipt_schema": "schemas/receipts/task-execution-v2.schema.json",
  "cleanup_ownership": [],
  "allowed_discretion": [],
  "escalation_conditions": []
}
```

The prose manifest remains the human program graph; Luna receives only the capsule, cited source
sections and necessary files.

Acceptance:

- every executable manifest row compiles to exactly one capsule;
- no file/action/authority/result exists only in prose;
- a capsule schema failure blocks execution before model dispatch;
- root can compare `parent..commit` with the capsule without re-reading the repo.

### ECV2-02 — Authority graph compiler

For every service journey, compile and validate:

```text
route -> RPC/function -> exact argument names -> owner/security mode
      -> grants -> authoritative relations -> idempotency boundary
      -> response projection -> consumer fields
```

Inputs include Deno call sites, migration function declarations, ACL statements, route registry and
task floors. Outputs are executable authority/result/postcondition rows in the capsule.

It must have caught the WI-368 facts before task-08:

- contact-attempt table with no narrow writer authority;
- challenge table with no safe creation authority;
- a requested atomic four/five-scope reservation implemented as independent one-bucket calls;
- owner-created no-Google path routed through a generic Google-required admission result.

This is deterministic coverage, not a Sol review.

### ECV2-03 — Luna-owned runtime controller

`execute-changeset` must require the task executor to own:

- provisioning exactly one permitted disposable target set;
- runtime command execution;
- provider/test fixtures;
- persistent log and result capture;
- exact cleanup and global residue census;
- the runtime receipt;
- the checkpoint commit.

Root must reject a `ROOT_RUNTIME_REQUEST` for a disposable task unless the capsule explicitly marks
the runtime as root-only external authority. Staging, production, real-money providers and device
leases remain root-controlled.

Acceptance:

- zero root-authored disposable Docker/PTY orchestration commands in a normal task;
- task receipt survives executor exit and worktree cleanup;
- root acceptance is one validator command plus bounded diff inspection;
- fixture/harness/environment failures are repaired and rerun by Luna.

### ECV2-04 — Standard concurrency-proof package

Ship one framework-owned runner that consumes:

```text
setup.sql
session-a.sql
session-b.sql
assert.sql
cleanup.sql
run.meta.json
```

and always produces:

```text
rc.tsv
hashes.sha256
before.json
after.json
session-a.log
session-b.log
cleanup.log
residue.json
```

The library owns shell quoting, SQL tag validation, parent/subshell traps, timeouts, blocking
measurements, signal cleanup, persistent directories and project census. Product tasks provide
only fixtures, session SQL and assertions.

Acceptance:

- mutation fixtures prove malformed SQL, missing sentinel, stale receipt, cleanup residue and
  timeout paths fail;
- no generated proof lives only under a transient worktree directory;
- one case invocation cannot execute another family accidentally;
- no product race runner exceeds the small declarative case budget without an explicit exception.

### ECV2-05 — Failure classifier and assist budget

Every failure is classified before escalation:

```text
PRODUCT_CONTRACT
SECURITY_AUTHORITY
ASSERTION_SEMANTICS
HARNESS_TRANSPORT
FIXTURE
ENVIRONMENT
ORCHESTRATOR_INVOCATION
```

Only the first three may invalidate a high-risk review or freeze the plan. The remaining four stay
inside Luna's implementation loop.

An `ASSIST_REQUEST` carries task, plan digest, worktree state, command, exit code, first causal
error, retained receipts, attempts, hypothesis and suspected plan impact. One assist is allowed per
normalized fingerprint. There is no separate diagnostic agent.

### ECV2-06 — Evidence-triggered plan repair and strategic routing

Plan repair is a router, not a competing product-decision system:

```text
execution contradiction
  -> source-precedence check
  -> existing signed answer: minimal mechanical manifest reconciliation
  -> new product/security/scope choice: strategic-decision + Sol-high
```

Source precedence is mechanically recorded:

```text
founder invariant
> signed feature/spec contract
> journey contract
> reviewed manifest
> later manifest amendment
> implementation
> tests
```

Every repair emits:

- contradiction evidence;
- classification;
- changed task/downstream capsules;
- invalidation matrix;
- new plan digest;
- exact resume instructions.

No implementation mutation occurs while state is `PLAN_FROZEN`.

### ECV2-07 — Relevant-digest invalidation engine

Evidence keys bind to:

```text
relevant path digest
+ risk lens
+ authority/result contract digest
+ migration floor
+ fixture schema
+ finding IDs
```

Not every full-file change invalidates every proof.

| Change | Invalidates |
|---|---|
| quoting/path/log retention | affected harness run only |
| cleanup selector | cleanup/residue proof |
| fixture data | fixture-dependent behavioral assertions |
| assertion weakened | assertion-semantics lens and affected runtime |
| DB grant/function owner | security-authority lens and floor proof |
| business outcome/schema | product-contract lens and consumers |
| provider configuration | provider proof |
| native artifact SHA | device proof |

No unchanged relevant digest may be re-reviewed merely because an unrelated file changed.

### ECV2-08 — Migration freeze and consumer compilation

Before freeze:

- migrations may be edited;
- downstream consumers must compile against their exact functions/ACLs;
- one final floor proof replaces intermediate evidence.

After freeze:

- use a new additive migration by default;
- modifying a frozen migration requires an explicit invalidation-cost decision;
- no consumer task may be scheduled after freeze unless its route/RPC contract already compiles.

This prevents task-08 from discovering missing floor-1200/1210 authorities after task-06 already
paid the replacement proof cost.

### ECV2-09 — Review contract reconciliation

Replace the contradiction in `execute-changeset` with four explicit gates:

1. no ordinary per-task quality review;
2. cheap deterministic and Luna self-audit gates per task;
3. evidence-triggered Sol-high product/authority decision only when plan repair requires it;
4. exactly one independent holistic review of the complete frozen candidate.

If the final review causes remediation, relevant-digest invalidation determines the exact subset to
rerun. The final reviewer never causes a global restart by default.

### ECV2-10 — Context reset with persistent logical identity

Keep a stable executor identity in receipts, but reset the model context at bounded tranche
checkpoints:

```text
07db -> Luna context A -> accepted checkpoint -> close
08a/08b -> Luna context B -> accepted checkpoint -> close
09a/09b -> Luna context C
```

The next context receives only:

- accepted capsule graph;
- parent commit;
- current plan digest;
- unresolved findings;
- relevant receipt index;
- exact next capsule.

This preserves recovery and attribution without dragging dozens of closed defects through the
entire WI.

### ECV2-11 — Decision-completeness compiler

Replace fixed question-count promotion with a typed decision matrix generated from the product
outcomes and authority graph:

```text
outcome x actor x state transition x authority x failure behavior x external dependency
```

Questions remain the founder-facing discovery interface. Promotion depends on matrix coverage and
explicitly resolved decision IDs, not on reaching 40 rows. A missing decision with 100 questions
fails; a small change with 12 complete decisions may pass.

### ECV2-12 — Validation planner and evidence cache

Every validator declares its input path/contract selectors, source/version digest, environment
class, cost class and output receipt schema. The planner computes the changed dependency closure,
reuses exact content-addressed PASS evidence, runs focused validators at task checkpoints and runs
the complete required population once at freeze/landing. PASS output is one summary row; detailed
logs persist on failure or explicit AC. Pre-existing baseline failures are recorded separately and
cannot masquerade as a new regression.

### ECV2-13 — Canonical receipt object store and derived views

Receipts become immutable objects keyed by their canonical payload hash. A single append-only index
links WI, capsule, commit/tree, validation, lens and object digest. Git notes, lane state, review logs
and worktree mirrors become generated references, not independent copies of truth.

The store must fail closed on missing objects, wrong-tree bindings, forged mirrors and concurrent
index writes. It must preserve offline Git portability and not introduce a service dependency.

### ECV2-14 — Skill runtime-contract compiler

Keep full `SKILL.md` sources for human knowledge, but compile their executable policy into small
versioned contracts: triggers, prerequisites, required inputs/outputs, allowed actions, authority
boundaries, graph transitions, validators, receipt schemas and cognitive labels. Shared task-graph
boilerplate and registry mirrors are generated from canonical templates. Source line and digest
remain attached to every compiled rule for auditability.

### ECV2-15 — Lens-addressed review engine

Plan and execution reviewers receive a frozen package of semantic lenses rather than every changed
word. Finding IDs bind to lens and relevant digest. A correction reruns only invalidated lenses;
one final holistic pass checks lens composition and cross-lens interactions. A deterministic
finding-set digest replaces repeated subjective "two empty passes" loops.

### ECV2-16 — Generated execution program and delta repair

Generate argv-safe task execution, state transitions and recovery from capsules. A failed attempt
adds an immutable evidence object. A genuine repair adds a small capsule delta and invalidation
matrix; it does not rewrite a multi-thousand-line command sequence. Accepted checkpoints and real
plan decisions remain Git commits; ordinary failed mechanics do not become control commits.

### ECV2-17 — Generated framework inventory

Generate installed skill counts, cognitive-label bindings, registry mirrors, validator inventory
and framework-state metrics from canonical manifests. Human narrative and decisions remain authored;
counts and synchronized lists are never hand-maintained. The generator must reproduce byte-identical
output and its checker remains a pre-push gate.

### ECV2-18 — Canonical Spec IR and provenance graph

Compile signed product sources into stable typed nodes for actors, states, decisions, authorities,
effects, ACs, operational obligations and release proof. Each generated capsule/test/release gate
links to source spans. Contradictory values produce one minimal diagnostic before paid plan review;
unlinked implementation or unproved ACs fail closure.

### ECV2-19 — Concern and production-readiness compiler

Resolve the 116 concern lenses and the feature archetype into an executable Definition of Done.
Every CRITICAL/HIGH hit must compile to a rule, skill output, validator, release probe or explicit
authorized waiver. “Optional skill” alone cannot satisfy a blocking concern. The compiler selects
functional, failure, privacy, security, performance, observability, rollback and support proof.

### ECV2-20 — Durable event-sourced workflow runtime

Append every accepted transition as a typed, sequence-bound event. Derive task/lane/status views by
replay. Crash recovery, context reset and host transfer start from the last valid event and immutable
evidence rather than editing state snapshots. Illegal transitions, stale generations, duplicate
acceptance and divergent replay are mutation-tested.

### ECV2-21 — Typed effect and sandbox capability runtime

Represent each read, write, destructive, external, paid, device and deploy operation as a typed
effect with target, principal, cost ceiling, reversibility and required capability. Worktree and
runtime snapshots provide rollback for reversible effects. Idempotency key plus remote readback
protect irreversible/external effects. Root-only production authority stays root-only.

### ECV2-22 — Durable scheduler, leases and causal budgets

Schedule nodes from dependency/effect/resource conflicts, not prose. Reuse the generation-bound
controller lease and add task claims, heartbeat, cancellation, deadline and recovery. Independent
read-only/hermetic work may run concurrently; overlapping writes serialize. Active and blocked time
are separate, and retry follows the causal fingerprint budget.

### ECV2-23 — Environment identity and deterministic external replay

Hash declared tool/runtime/dependency/schema/locale/clock inputs into evidence identity. Support
secret-redacted record/replay for permitted network/browser/provider interactions and clean-room
proof for critical artifacts. Cached evidence is reusable only at a sufficient trust level and while
all freshness constraints hold.

### ECV2-24 — Framework quality laboratory

Promote the historical replay matrix into a permanent corpus. Every new control ships a killed
mutation. Controller invariants receive generated state-machine/property tests; migrations and
policies run old/new differentially in shadow; paid live model scenarios are reserved for judgment
calibration and statistically reported rather than treated as one-off anecdotes.

### ECV2-25 — Production release, canary and rollback engine

Compile artifact provenance/SBOM/signing requirements and an executable rollout graph. Each stage
consumes exact health/SLO evidence; violated gates stop expansion and invoke a pre-authorized
rollback/compensation plus post-rollback verification. Affected journeys select the minimal live
synthetic set, while mandatory safety canaries always run.

### ECV2-26 — Trace, cost and operator control room

Every run emits trace spans for routing, model, tool, validation, cache, wait, review, effect and
release. The live projection answers current node/owner, active versus wait time, causal blocker,
remaining work, ETA confidence, cost and next permitted action without reading chat. PASS noise is
collapsed; failure artifacts remain linked.

### ECV2-27 — Versioned plugin ABI and compatibility/release train

Define a manifest for host/addon/plugin inputs, outputs, effects, capabilities and compatibility
range. Run conformance plus N/N-1 schema and state migration tests. SVC dogfoods each release on
golden repositories, canaries host installation and keeps an atomic previous-version rollback.

### ECV2-28 — Closed-loop incident and framework learning

Convert confirmed incidents, framework false blocks, slow critical paths and final-review escapes
into minimized replay fixtures. Controls enter shadow mode, graduate on measured catches/mutations
and are deprecated only with replacement evidence. This prevents both forgotten lessons and
permanent ceremony with no measured value.

### ECV2-29 — Optional persistent repo/runtime daemon

Cache parsed graphs, content digests and isolated browser/environment sessions behind the event/action
protocol. It is disposable: deleting it and replaying durable state yields the same result. It ships
only after profiling shows repeat discovery or setup dominates the SLO.

### ECV2-30 — Native acceleration evidence gate

Profile at least a 4,000-file repository and the full framework freeze. Native Rust/WASM modules are
eligible only for a named CPU/startup/IO hot path above budget, with a semantic differential suite
and at least 3x local improvement. Model waits, provider waits and duplicated governance are solved
architecturally, not relabeled as a runtime-language problem.

### ECV2-31 — No-value-loss control evolution

Every existing framework control records its original unique benefit, measured cost/root cause,
disposition and replacement proof. `PRESERVE`, `STRENGTHEN` and `REPLACE` keep the benefit in an
executable mechanism. `DELETE` is fail-closed unless it binds `ZERO_UNIQUE_BENEFIT`, owner authority,
measured ROI and a regression corpus. This prevents speed work from quietly amputating product,
security, UX, operational or learning guarantees.

### ECV2-32 — Transformer-native product proof and context graph

Compile founder decisions, features, outcomes, journeys, ACs, tasks, code, validators, evidence,
authorities, failure behavior, operations and live probes into one provenance graph. Each executor
receives a compact product index, all global invariants and only the detailed proof slice relevant
to its task. Source spans remain addressable external memory. Missing mapping edges fail before
dispatch; context overflow fails instead of silently truncating truth. Parallel agents therefore
share total product awareness without repeatedly loading the entire product into every context.

### ECV2-33 — Product-outcome protocol and canonical layer compiler

Compile owner direction, interaction policy, signed delegation, target metrics, the 60-minute
delivery SLO and every canonical skill/stage/concern/authority/host layer into one protocol. Each
layer appears exactly once as applicable or deterministically N/A with its unique benefit. A
caller-supplied subset cannot pass. `references/product-outcome-improvement-protocol-v2.md` and
`schemas/product-improvement-protocol-v2.schema.json` are the normative starting contract; default
cutover requires importing the real repository registries and resolving their digests.

### ECV2-34 — Evidence, option and owner-decision broker

Make research side-effect-free inside a product run and type every uncertainty, claim, contradiction,
freshness bound and intended decision consumer. Rank options by the declared techniques and retain
selected/rejected reasoning. `decide` becomes the only localized owner surface. Autonomous mode may
sign consequential choices only inside exact delegation; strategic mode batches only irreducible
choices and deduplicates them by unresolved-decision digest.

### ECV2-35 — Consumption ledger and vertical product runtime spine

Implement `svc-runtime-v2 compile|run|resume|status|release|observe` over one append-only journal.
Add leases, validator/effect execution, CAS evidence resolution, required-consumer acknowledgement,
causal progress, review/final-SHA, land/deploy/canary/rollback/live events and durable observation
obligations. Legacy lane tasks, orchestrator state, receipt mirrors and decision logs become
projections during migration. This tranche is the cutover-enabling spine; pure compiler libraries
alone cannot claim an executor.

### ECV2-36 — Product-memory, company-decision and host-ingress adapters

Compile approved company cards into authorized WI/product-graph inputs and send observed outcomes
back to company state. Return typed, digest-bound memory evidence; record whether it was used or
ignored; promote framework learning only after linked product evidence is consumed. Generate thin
Claude/Codex/Kimi event ingress from host manifests and preserve context rewrites, while all security
and progress invariants remain in the host-independent runtime.

The pre-P0 clean local Node snapshot (`v24.13.0`, 4,000 files, 200 validators, 20 changed paths, 20
measured warm iterations after two warmups) is 60.029 ms p95 for capsule compilation and 82.777 ms
p95 for affected selection. Both remain below the 100 ms optimization-watch threshold and far below
the 2,000 ms native-rewrite gate, so `optimization_watch_triggered=false` and
`native_rewrite_candidate=false`. The first unoptimized
selector was 486.859 ms p95 because it recompiled glob regexes; a bounded regex cache removed the
algorithmic waste without a rewrite.

## Pre-P0 bypass implementation status (historical baseline)

Before the cumulative P0-P15 changeset, the proposal was broader than the code. That local vertical slice implemented only the
interfaces needed to prove the architecture can replace Sample's repeated control repairs:

| Local artifact | Implemented now | Deterministic proof |
|---|---|---|
| `schemas/execution-task-capsule-v2.schema.json` | decisions/authorities, exact files, effect capabilities, active budget, validators and retry policy | compiler negative fixtures |
| `schemas/execution-event-v2.schema.json` | typed hash-chained capsule event envelope | tamper and illegal-transition fixtures |
| `schemas/evidence-object-v2.schema.json` | immutable evidence object, trust/freshness/environment/relevant-digest identity | integrity, expiry and tamper fixtures |
| `scripts/svc-execution-controller-v2.mjs` | capsule/DAG compile, execution-vs-merge/interface dependencies, exact completed/ready/blocked status projection, conflict-aware parallel waves, deterministic merge order, active-deadline feasibility, effect authorization, causal failure routing, relevant-digest validation selection/cache, append/replay event state and CAS put/verify | 57 focused tests |
| `test-framework/evals/tier-1/validate-execution-controller-v2.mjs` | Sample cardinality/shape/timestamp regressions, DAG/status/interface/scheduling, retry routing, cache invalidation, effect/event/CAS tests, all 24 graph-input permutations, 8 authority denials and 3 stale-cache dimensions | `57 passed, 0 failed`; compact PASS output |
| `schemas/product-proof-graph-v2.schema.json` + `scripts/svc-product-proof-compiler-v2.mjs` | founder decision -> feature -> outcome -> journey -> AC -> task -> code/test -> evidence/live-release graph and transformer-sized task context | `8 passed, 0 failed`; all 29 unique edge removals produce zero false-complete graphs |
| `schemas/product-improvement-protocol-v2.schema.json` + `scripts/svc-product-improvement-protocol-v2.mjs` + canonical protocol reference | product-first direction, owner mode/language/delegation, layer/artifact producer-consumer declarations/ack contracts, 14-surface production census, >=24x/<=60-minute forecast with calibration truth, delivery-vs-outcome closure and causal anti-loop policy | `18 passed, 0 failed`; unresolved/omitted production surfaces and uncalibrated default-production claims are rejected |
| `scripts/svc-control-value-audit-v2.mjs` | machine-enforced preserve/strengthen/replace/delete ledger; deletion requires zero-benefit authority, ROI and regression corpus | `6 passed, 0 failed`; all 80 distinct control-row proof removals rejected, zero deletions |
| `scripts/svc-concern-compiler-v2.mjs` | deterministic concern hit -> rule/skill/ack/advisory/log/waiver obligations with shadow/enforce modes | 7 focused tests |
| `test-framework/evals/tier-1/validate-concern-compiler-v2.mjs` | live 116-concern census, strict missing-handler/unknown/waiver behavior and one honest removed-critical-handler-set case | `7 passed, 0 failed`; 40 current CRITICAL/HIGH handler gaps exposed in shadow |
| `scripts/select-tier1-validators-v2.mjs` + opt-in `run-all-evals.sh` wiring | exact known dependency closure; any unknown/global input falls back to full sweep; default remains full until cutover | selector coverage includes the product-improvement validator |
| `test-framework/evals/tier-1/validate-tier1-selector-v2.mjs` | exact selection, product-proof/product-outcome/review/replay multi-owner closure, unknown/global fallback, traversal denial and empty-diff reuse | `11 passed, 0 failed` |
| `scripts/replay-sample-revenue-activation-v2.mjs` + frozen R21 fixture | imports exact live Sample branch/HEAD/manifest/contract/lane/state digests, accepted E1A/E1B1, current E1B2 6/6 proof, all 81 AC/task/test mappings, 12 journey scenarios, explicit rollback readiness, full review/release lifecycle and 12 historical failures | focused PASS; 16 stages, 65 declared validations, 19 authorized effects, 16 event/CAS chains, 12/12 causal routes; 36.5-minute scheduled path + 10-minute risk reserve; `SHADOW_ONLY`, not calibrated production proof |
| `test-framework/evals/tier-1/validate-sample-shadow-replay-v2.mjs` | full-cycle coverage/schedule/interface/routing mutation gate | `9 passed, 0 failed`; 10 distinct semantic mutations, zero false PASS |
| `execute-changeset`, `review-plan`, `review-exec`, impact-triad guard/schema and canonical plan-review protocol | high task behavioral proof + explicit exactly-one-final-review binding; one holistic plan review with changed-lens remediation; N-1 legacy receipt read | persistent contract `18/18`; fast impact contract `6/6`; full Git integration `54/54` |
| exact-count Tier-1 negative corpus | 130 executable task/release transition mutants; 140 distinct layer/protocol/graph/control/impact/Sample cases; 26 controller/effect/lease denial dimensions; 24 schedule permutations; one dedicated event-payload tamper | zero multiplied duplicate claims and zero accepted/trusted mutations |
| `test-framework/benchmarks/benchmark-execution-controller-v2.mjs` | realistic graph/compiler/affected-selector Node benchmark | current p95 figures above |

The nine-validator affected closure contains **137 assertions**. Its first final-phase run completed
in **0.998 s wall** but correctly exposed one duplicated runtime-only next-decision terminal rule;
after that rule was removed, a clean nine-validator rerun is green in **1.125 s wall**. The focused comparison remains affected validation
versus a full repository sweep; it proves the checkpoint hot path, not permission to remove the
mandatory cumulative freeze gate.

The final cumulative freeze gate was retained and executed once after assembly: **284 Tier-1 scripts
produced 265 PASS, 19 FAIL and 0 timeout**. All nine focused v2 validators pass. The earlier frozen
snapshot had 283 scripts, 263 PASS and 20 FAIL; all 20 of those failures reproduced on an untouched
clone of base `237edc16e3e7731373aa8bafe41b0f367089f6a5` under the same host state. The current visible
failures remain repository/host debt, including Codex installed-hook routing drift, missing historical
WI affected-file metadata and the pre-existing `makeRelative` `operationRoot` regression. The
aggregate gate therefore remains honestly red. Because mutable host state changed between snapshots,
this document claims the measured one-failure improvement and green affected closure, not a fresh
one-to-one base proof for every current failure.

At that pre-P0 snapshot, the following were not implemented yet: canonical layer import; executable option/decision calculations; runtime-bound
protocol/product/context digests; general producer-consumer acknowledgement; CAS-backed causal
progress; unified durable run/resume/dispatch/release/observe runtime; multi-lease task state; host
event ingress; product/company/memory bridges; full repository/spec import into the product-proof
graph; archetype DoD compiler and wiring for the 40 exposed high-risk concern gaps; general durable
queue; CAS receipt index/GC; sandbox snapshots; external record/replay; quality-lab corpus beyond
this slice; release/observation adapters; OpenTelemetry projection; plugin ABI; daemon; and general
Sample state migration/cutover. No statement in this proposal may imply those components are already
working.

## Cumulative P0-P15 candidate status

The uncommitted candidate now implements the bounded P0-P15 architecture through the local cutover
decision: canonical layer compilation; ranked owner decisions; generation-bound graph/capsule/event/
evidence contracts; an append-only `compile|run|resume|status|release|observe` runtime; concurrent
durable leases; real shell-free validator/effect argv; CAS evidence production, named consumption,
causal progress and reachability-safe GC; skill, memory, company and host adapters; release,
rollback, live and observation lifecycle; N/N-1 differential migration; a real local golden feature;
130 distinct executable task/release transition mutants (rather than boolean guard flips), separate
negative validators for layer, decision, graph, evidence, authority, host and timing boundaries; and
a truth-preserving cutover gate.

Local validation is candidate evidence, not production evidence. Syntax, JSON, diff and file-
persistence checks pass. The frozen base sweep took 767.916 s with 252 scripts passed, 23 failed and
4 timed out. After one candidate-only secret-redaction fixture timeout was corrected and proven by
three concurrent focused runs, the cumulative candidate sweep took 694.994 s with 277 passed,
21 failed and 3 timed out: zero candidate-only failure scripts and two base failures fixed
(`validate-auto-learning-capture.sh` and `validate-wi-closeout-evidence.sh`). The remaining failures
are inherited environment/repository-state failures, not called green.

The isolated 4,000-file Node benchmark records p95 236.911 ms compile, 265.699 ms affected
selection, 167.439 ms durable claim, 284.593 ms argv dispatch, 0.818 ms journal replay and 684.376 ms
full-freeze selection. The 2,000 ms native gate therefore says `STAY_NODE`, while the 100 ms
optimization watch remains triggered. The actual 11m35s cumulative sweep still misses the separate
<=60s full-framework-freeze SLO and consumes almost all declared estimate margin.

Final review is digest-bound outside this proposal: inline self-review comes first, followed by the
configured same-family subagent and any owner-selected external stations. Google review is routed
only through the canonical AGY sandbox/private-file boundary with the exact owner-configured
`host=agy`, family, model and effort tuple; direct Gemini CLI is not a valid review route. The
`fast-local` panel can pass only with `release_authorized=false`; production requires its configured
different-family AGY station to pass. P14 is sufficient to land the framework in shadow/fail-closed mode, while P15
remains a local HOLD: default cutover is mechanically false until a journal/CAS resolver verifies
candidate-bound release, live, rollback, canary and comparable-run receipts. The 60-minute SLO
remains `TARGET` until that resolver and an explicitly authorized real Sample direction-to-live
canary plus rollback proof exist.
Even a passing first canary does not enable default cutover: high-confidence measured p95 evidence
from at least three comparable runs must also meet the >=24x and <=60-minute contract.

### Current full-cycle Sample shadow result

The replay is bound read-only to live Sample R21 evidence rather than an invented clean fixture. It
preserves 81 AC-to-task mappings, 81 AC-to-test mappings, 12 journey scenarios/74 assertions, the
accepted E1A/E1B1 prefix and the current E1B2 6/6 green validation matrix. The controller schedules
16 remaining control/lifecycle stages and every final gate. The production-surface census exposed
rollback readiness as a missing explicit stage in the older estimate, so `R1` now gates production
release instead of relying on deployment reversibility as an implicit substitute:

| Result | Shadow evidence |
|---|---:|
| core product path before production-completion extras | 1,020 s / 17 min |
| incremental validation/review/land/release/live/rollback/operations/observation path | 1,170 s / 19.5 min |
| scheduled active critical path | 2,190 s / 36.5 min |
| explicit risk reserve | 600 s / 10 min |
| declared all-in forecast / target spare | 2,790 s / 46.5 min; 810 s / 13.5 min |
| observed full-sweep adjustment | replace declared 60 s validation stage with measured 694.994 s |
| risk-adjusted estimate / target spare | 3,424.994 s / 57.08 min; 175.006 s / 2.92 min |
| 24-hour example normalized speedup | 25.23x risk-adjusted estimate; 24x required |
| measured historical Sample-baseline normalized speedup | 58.33x risk-adjusted estimate; not achieved |
| conservative fully serialized active budget | 3,390 s / 56.5 min before risk reserve |
| forecast truth label | `SHADOW_ONLY`; declared targets; low confidence; 0 calibration runs |
| external WI-368 integration wait | visible separate; duration unknown |
| declared validations | 65 |
| authorized typed effects | 19 |
| accepted event/CAS chains | 16 / 16 |
| historical causal routes | 12 / 12 |
| false PASS under distinct replay mutations | 0 / 10 |

This proves the current v2 library can represent a declared remaining lifecycle plus the production
extras and risk reserve inside 60 active minutes. It does **not** prove the canonical
direction-to-live SLO: the replay starts after major
product/plan work, synthesizes accepted task events from the fixture, stores evidence only in local
memory/CAS objects and does not execute model implementation, validators, final independent review,
landing, external WI-368 integration, deployment or live production. The claim remains blocked
until the unified runtime executes the real Sample canary from accepted direction through live proof.
Default admission additionally requires high-confidence measured p95 evidence from at least three
comparable runs; declared budgets can never promote themselves to production proof.

## Historical replay matrix

Controller v2 is not accepted because new happy-path tests pass. It must replay the failures that
made the current run slow:

| Historical failure archetype | Expected v2 route | Plan repair? | Proof |
|---|---|---:|---|
| 4 source rows versus 5 activation candidates | capsule cardinality compiler rejects before dispatch | no | mutation-red compile fixture |
| ready/no-op/quarantine object has stale field or ordering | typed fixture serializer rejects inside Luna attempt | no | exact schema/fingerprint fixture |
| ISO timestamp serialization differs | canonical serializer correction inside Luna | no | byte-stable rerun |
| runner SQL scope alias/cardinality defect | harness/assertion failure, bounded local correction | no | normalized fingerprint + PASS attempt |
| legacy evidence fingerprint collapsed to candidate key | assertion-semantics failure, local correction if signed arrays remain unchanged | no | focused mutation guard |
| owner isolation changes product meaning | `PRODUCT_CONTRACT`, freeze and strategic authority | yes | source-precedence and decision receipt |
| missing RPC/grant/owner edge in migration | authority compiler rejects before migration freeze | yes, before execution | graph mutation fixture |
| log wording changes after proof | relevant digest unchanged; cached proof remains valid | no | false-invalidation fixture |
| assertion or grant weakens | affected lens digest changes; cached proof rejected | maybe | false-reuse fixture |
| disposable runner leaves residue | runtime receipt fails; Luna cleans and reruns | no | residue mutation fixture |
| same causal mechanical fingerprint fails after budget | one bounded assist, then terminal evidence | no unless classifier proves plan impact | attempt/fingerprint fixture |
| final review finds cross-task semantic conflict | invalidate named lenses/tasks only | yes | cumulative diff replay |

Every row must be executable without a paid model call except the two genuine semantic-judgment
routes and the final holistic review.

## World-class operating SLOs

These are controller contracts, not marketing estimates. Each is emitted per run and summarized by
task class so a fast trivial task cannot hide a slow production feature.

| SLI | Target after default cutover |
|---|---:|
| route + concern/archetype selection | <= 200 ms p95 warm, <= 1 s cold |
| Spec IR/capsule mechanical compilation | <= 2 s p95 for a 4,000-file repository |
| task dispatch or incremental acceptance | <= 500 ms p95 excluding model time |
| focused hermetic validation | <= 2 s p95 |
| full framework freeze validation | <= 60 s p95 |
| status projection freshness | <= 1 s after an event |
| crash resume to next permitted action | <= 5 s p95 |
| core context capsule | <= 64 KiB excluding explicitly cited source files |
| PASS output returned to a model | <= 2 KiB per checkpoint |
| deterministic work repeated because an unrelated digest changed | 0 |
| mechanical failure escalated to plan authority | 0 |
| scope/authority false-green mutations | 0/100 accepted |
| stale-proof false-green mutations | 0/100 accepted |
| small governed bug: diagnosis through locally verified checkpoint | <= 15 active min p50, <= 30 min p95 |
| Sample-class production feature: accepted direction through live verification | <= 60 active min target |
| operator status answers with exact completed/remaining/blocker | 100% from event state |

Quality SLOs take precedence over time: hitting a time target without the required trust-level proof
is a timeout, not a successful fast delivery. External queues are visible elapsed wait and never
removed from operator status, though they do not consume the active engineering budget.

## Sixty-minute direction-to-production budget

The budget is for the complete active controller path from accepted owner direction through final
live verification, rollback readiness and durable scheduling of the outcome observation. External
provider/deployment queues and metric windows are recorded separately as visible blocked elapsed
time; they cannot be hidden or counted as productive execution. The task budgets include focused
validation and Sol-medium incremental acceptance.

| Segment | Active budget |
|---|---:|
| normalize direction, resolve relevant evidence and authorize the outcome | 5 min |
| compile canonical layers, product graph, capsules and one plan review | 5 min |
| clean baseline, authority/environment preflight and dispatch | 2 min |
| conflict-aware implementation critical path including local correction reserve | 28 min |
| focused behavioral proof plus cumulative freeze validation | 5 min |
| one holistic frozen-diff review and affected-lens correction reserve | 5 min |
| final SHA, land, deploy/canary, rollback readiness and live verification | 8 min |
| schedule observation, acknowledge consumers and render closeout | 2 min |
| **Total active budget** | **60 min** |

This table is a ceiling allocation, not an estimate reusable across products. Each real feature must
replace it with the fourteen-surface production census and a capsule-derived schedule. The Sample
shadow declares 17 minutes of core work, 19.5 incremental minutes of production-completion work and
10 minutes of reserve (46.5 minutes total). Replacing its declared one-minute validation stage with
the measured 694.994-second cumulative sweep produces the more honest current estimate: 57.08
active minutes, 2.92 minutes of spare and 25.23x against the user's 24-hour example. That narrowly
clears the 24x/60-minute admission threshold but is not an operationally safe margin. It remains
`SHADOW_ONLY`: the external integration wait is unknown, the review provider is blocked, and there
are zero calibrated direction-to-live runs.
Effect capabilities are also resolved against the executable adapter registry: an actual mobile
route using the generic `device` capability is rejected until a product-specific device adapter and
behavioral proof exist.

Budget enforcement is causal, not wishful:

- admission compiles the smallest complete product outcome whose conservative critical path fits;
- a capsule exceeding its budget emits the current causal fingerprint and retained evidence;
- a mechanical overrun stays with Luna and consumes its bounded correction budget;
- an external wait stops the active clock but remains visible in end-to-end elapsed time;
- a semantic contradiction freezes immediately instead of spending the remainder on retries;
- delivery is not called complete until final-SHA, live verification, rollback readiness and an
  acknowledged observation schedule exist.

### Speed and quality claim protocol

The current Sample run accepted two of nine units in 12 h 19 m 57 s. A linear historical-throughput
projection is about 55.5 hours for nine units. Completing the same unit graph in 60 active minutes
would therefore be about **55.5x normalized throughput**. A literal **100x** result on that baseline
requires at most 33 m 18 s. Neither number is claimed as achieved until the replay runs.

"100x quality" is not allowed as marketing language. It is accepted only if the mutation corpus
and three comparable WIs show all of the following:

- zero historical mechanical failure archetypes escape their owning compiler/fixture/runner;
- zero stale-proof false accepts across at least 100 relevant-digest mutations;
- zero scope/authority bypasses across at least 100 capsule mutations;
- zero mechanical plan repairs; genuine product repairs are counted separately;
- no regression in final-review Critical/High escape rate or live verification;
- complete provenance from source decision through capsule, commit, proof and release receipt.

Until those denominators exist, the honest labels are `target`, `simulated`, `locally replayed` or
`measured`; never `100x achieved`.

## Checkpoint and receipt contract

Commit format:

```text
checkpoint(WI-XXX): task-NN <short-slug>

Plan-Task: task-NN
Plan-Digest: <sha256>
AC: <acceptance IDs>
Tests: <commands and exact results>
Receipts: <persistent paths>
Scope-Risk: <level>
Not-Tested: <honest exclusions or none>
Plan-Deviation: <none or repair digest>
```

Root acceptance validates:

- parent and commit identities;
- exact allowed file/action set;
- task receipt schema and hashes;
- test/runtime result cardinality;
- forbidden-write scan;
- cleanup/global-zero result;
- plan digest and deviation state.

It does not reload the full repository or repeat successful disposable proof.

## What quality gates remain unchanged

This proposal does **not** remove:

- closed-world scope coverage;
- DB behavioral and concurrency proof;
- provider-bound proof and rate limits;
- privacy/ACL tests;
- native hardware proof where required;
- final-SHA receipts;
- one independent frozen-plan review;
- one independent final holistic implementation review;
- root-controlled staging/production deployment;
- live production probes and cleanup;
- founder authority over product decisions.

It removes repeated proof of unchanged facts and control-plane work performed by the wrong agent.

## Delivery program

The eighty original causes plus the holistic integration audit are not sequential WIs. They compile
into one cumulative changeset with seven checkpoint tranches, one plan review and one final holistic
review. Paying a full SVC lifecycle per helper would reproduce the defect being fixed. The vertical
runtime spine lands before broad optimization so every later producer is immediately connected to a
consumer.

| Tranche | Components | Executable result | Exit proof |
|---:|---|---|---|
| A — product contract freeze | ECV2-11, 17-19, 31-34 | canonical layer inventory, option/decision graph, product protocol/Spec IR, no-value-loss ledger and exact owner policy | omitted-layer, fake-decision, orphan-output and question-loop mutations |
| B — vertical runtime spine | ECV2-01-03, 07, 12, 13, 20-22, 35 | one journal with run/resume/dispatch, leases, effects, validators, CAS resolution, consumption acknowledgement and causal progress | crash/lease/effect/evidence/consumer state-machine suite |
| C — skill, memory and company adapters | ECV2-14, 18, 19, 32, 34, 36 | typed intelligence/decision/research outputs, company-WI bridge, outcome-linked memory and host ingress | producer-consumer differential corpus on canonical lanes/hosts |
| D — execution and repair | ECV2-04-06, 08, 10, 16 | standard runtime/concurrency proof, consumer-compiled migrations, bounded workers and generated delta repair | historical Sample/WI-368 failure replay |
| E — coherent review/evidence | ECV2-09, 15, 23, 24 | one plan station, one final station, environment identity and mutation/differential quality lab | unchanged lens reuse; changed lens rerun; zero false review closure |
| F — production and outcome loop | ECV2-25, 26, 28 | traced build/stage/canary/rollback/live verification, observation/next decision and operator control room | golden deploy, forced rollback and delayed-metric continuation |
| G — platform/acceleration | ECV2-27, 29, 30 | plugin compatibility, self-hosted release, optional daemon and evidence-gated native hot paths | N/N-1, canary install, replay equivalence and benchmark |

One logical run coordinates capsule-scoped persistent workers with bounded contexts. Accepted siblings
remain valid unless their declared interface/relevant digest changes. Each tranche has an atomic checkpoint
and deterministic replay, but no independent external review. The cumulative candidate receives the
one final holistic execution review before landing.

### Decision-complete implementation graph

The implementation prompt must execute this graph as one changeset. Parallelize only nodes whose
resolved file/effect/resource sets are disjoint; merge deterministically. Do not create a new WI,
plan review or independent review for each row. Tests are authored with their owning node but, for
this authorized bypass, executed only after the cumulative candidate is assembled.

| Task | Depends on | Exact outcome | Primary file surface | Forbidden shortcut |
|---|---|---|---|---|
| P0 — freeze invariants | — | canonical direction-to-live SLO, delivery/outcome states, owner modes, decision techniques and no-orphan semantics agree across proposal/doctrine/reference | proposal, `DOCTRINE.md`, product protocol reference/schema | changing product quality into a scoreable trade-off |
| P1 — canonical layer inventory | P0 | compile every stage/skill/concern/authority/host benefit exactly once as applicable or deterministic N/A | new registry/compiler; `skills-manifest.json`; stage/concern/host registries | trusting a caller-supplied layer subset |
| P2 — unified product/decision graph | P1 | direction, evidence, uncertainties, options, selected/rejected decision, outcomes, layer obligations, tasks, release, observation, next decision and learning form directed provenance | product-proof/protocol schemas and compilers | SHA-shaped declarations without source resolution |
| P3 — digest-bound object contracts | P2 | protocol/product/context/concern/control/authority generations bind graph, capsule, event, evidence, review and release objects; every consumer has condition, invalidation and acknowledgement | capsule/event/evidence schemas; controller compilers | `RUNTIME`, `RELEASE` or `LEARNING` as product terminal |
| P4 — vertical runtime journal | P3 | `svc-runtime-v2 compile|run|resume|status|release|observe`; append-only journal, idempotent commands, crash replay and generated projections | new runtime/lib; controller entrypoint | in-memory events or chat as workflow truth |
| P5 — leases, dispatch and effects | P4 | multi-active conflict-aware graph, durable lease/heartbeat/reclaim, actual validator argv execution and mandatory typed effect authorization | runtime scheduler/effect runner; legacy task/dispatch adapters | scheduler simulation without execution |
| P6 — evidence/consumption/progress | P4 | CAS resolution, reachability/retention pins, evidence produced/consumed/invalidated events, closeout acknowledgements and causal anti-loop gate | evidence store/runtime; loop-guard adapter | arbitrary IDs/diff-stat as product progress |
| P7 — owner/evidence adapters | P2 | session mode/language/delegation; `decide` sole owner UI; nested research side-effect-free; strategic decisions compile into graph | `route-workflow`, `decide`, `strategic-decision`, `research`, shared session/question contracts | forty-question floor or hidden product default |
| P8 — intelligence/skill graph | P1,P2 | competitor/domain/capability/persona/vision/spec/design/plan outputs declare consumers; canonical plan/final-review DAG; shared continuation contract replaces only identical boilerplate | bounded audited skill set and manifest | deleting any layer's unique benefit |
| P9 — release/outcome lifecycle | P4,P6 | final-review station -> final SHA -> land/deploy/canary/rollback/live -> observation schedule -> delta -> next decision | review/audit/land/verify contracts and runtime events | task `ACCEPTED` as product completion |
| P10 — memory/company bridge | P2,P6,P9 | typed memory evidence with used/ignored disposition; approved fleet verdict creates product route; observed outcome records back; learning promoted only afterward | company state/memory, fleet contract, learning/recall skills | injected text counted as consumption |
| P11 — host ingress/projections | P4-P10 | Claude/Codex/Kimi capabilities generate normalized event ingress; old lane/orchestrator/receipt/decision views derive from journal; hookless hosts remain correct | hook wiring/manifests and projection adapters | hooks as security or correctness boundary |
| P12 — differential migration | P11 | shadow old/new graphs and receipts, preserve N/N-1 read/rollback, import Sample accepted prefix without product writes | migration/import adapters and frozen fixtures | mass-waiving or rewriting historical evidence |
| P13 — final proof once | P12 | syntax/schema, focused affected closure, 100 distinct mutations, state-model coverage, host matrix, historical replay, full cumulative base comparison, clean resume and timing ledger | test framework and benchmarks | repeated full suites during construction or inflated duplicate mutation counts |
| P14 — one holistic review | P13 | one frozen base..HEAD review covers product/authority/security/migrations/runtime/release/memory/compatibility; findings invalidate named lenses only | final review receipt | per-task external review army |
| P15 — canary/cutover decision | P14 | local shadow-ready result is truthfully reported; first real Sample direction-to-live canary must achieve >=24x and <=60 active min with rollback proof; default cutover additionally waits for high-confidence measured p95 across three comparable runs | cutover ledger/operator report | calling the current synthetic replay or one uncalibrated canary default-production proof |

Required task parallelism after P0-P3: P5 and P6 may proceed together; P7, P8 and P10 may proceed
together on disjoint contracts; P9 can build against P4/P6 while P11 waits for runtime event shapes.
P12-P15 are sequential closure. If disjoint containment is unavailable, keep one persistent executor
and do not pay re-planning/context reload between rows.

### Bypass/bruteforce implementation mode for this repair

The founder explicitly authorized fixing the framework without routing this repair through the
framework's current slow self-pipeline. Therefore:

- work occurs only in the isolated `proposal/wi368-execution-controller-v2` worktree;
- direct code/schema/test/proposal edits are allowed;
- implementation follows the compiled dependency graph; suites run once after the cumulative
  candidate is assembled, as explicitly requested for this bypass;
- the current full 275-validator sweep, repeated external reviews, per-component WIs and generated
  receipt mirrors are not run at every edit;
- one cumulative mechanical/full-framework gate and one holistic review remain required before
  landing;
- no product worktree, deploy environment, host installation or production state is mutated by
  this bypass.

The current local slice consists of capsule/product-proof/protocol schemas, pure controller/effect/
event/CAS libraries, causal classifiers, affected validation and a read-only Sample shadow. It is not
the vertical runtime spine because it has no durable run/resume/dispatch/release/observe loop. The
next implementation must build that spine first, then wire skills/hooks/memory and run the complete
final simulation/differential corpus once before any Sample migration.

### Cutover and migration

1. **Shadow:** compile existing decisions, skills/layers, plans, concerns, capsules, affected
   validators, receipts, release obligations and event projections; compare without blocking current
   execution.
2. **Historical gate:** replay WI-368 and Sample failure archetypes, controller mutations, owner-mode
   branches, hookless hosts, delayed metrics and two golden repositories. Fix semantic differences
   in the engine rather than waiving them.
3. **Runtime spine canary:** execute a reversible local golden feature through real journal, leases,
   validator/effect runner, evidence consumption, final review projection and simulated release/
   rollback adapters. No synthetic acceptance events may satisfy the canary.
4. **Sample production canary:** begin from an accepted owner direction/delegation, import reusable
   evidence without rewriting it, derive the complete graph and execute through live production
   verification under the 60-active-minute budget. Existing accepted product checkpoints remain
   valid only through exact relevant-digest equivalence.
5. **Default:** route new governed WIs through Engine v2; legacy Markdown/lane/receipt views become
   generated read-only projections.
6. **Compaction:** after N/N-1 rollback is proven, deprecate duplicate writable mirrors and obsolete
   prose boilerplate. Source knowledge remains; only redundant runtime representations are removed.

## Success metrics

Measure the first three comparable product WIs after adoption:

| Metric | Target |
|---|---:|
| root-authored disposable runtime commands | 0 |
| independent reviews before final review | 0 unless a genuine plan decision occurs |
| mechanical changes causing product re-review | 0 |
| transient-only runtime receipts | 0 |
| repeated full suite before closure | 0 |
| task capsules with unresolved product choices | 0 |
| canonical layers missing applicability/N/A proof | 0 |
| required artifacts without named acknowledged consumers | 0 |
| internal-only consumers falsely closing a product artifact | 0 |
| implementation questions sent to owner | 0 |
| repeated unresolved strategic-question digest | 0 |
| nested research commits/tags/pushes without typed authority | 0 |
| HIGH concerns closed by acknowledgement alone | 0 |
| accepted task outputs never consumed | 0 |
| evidence/progress claims unresolved by CAS/graph authority | 0 |
| hookless-host invariant bypasses | 0 |
| plan repairs missing invalidation matrix | 0 |
| plan repairs that contradict higher-precedence signed truth | 0 |
| fixture/harness/environment escalations to Sol-high | 0 |
| final holistic review | exactly 1 |
| mechanical plan repairs per WI | 0 |
| focused checkpoint validation wall | <= 2 s p95 |
| full framework freeze validation wall | <= 60 s p95 |
| PASS log volume per checkpoint | <= 2 KiB |
| historical Sample failure replay | 12/12 correctly routed |
| distinct lifecycle/consumption/authority/progress mutation classes | 0/100 falsely accepted |
| production delivery SLO | direction accepted -> live verified <= 60 active min on real Sample canary |
| outcome continuation | 100% delivery receipts open a metric/owner/due-date obligation |

Record wall time, provider/model calls, runtime provisions, plan repairs and review invalidations.
Do not claim 60-minute completion or 100x improvement until the historical replay and measured run
produce the required receipts.

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Prompt fidelity | WARN | product objective preserved, execution time unacceptable |
| Routing correctness | WARN | correct models, wrong runtime ownership and review timing |
| Contract compliance | FAIL | contradictory review clauses and repeated pre-readiness review |
| Verification sufficiency | PASS | strong runtime/security evidence eventually produced |
| Review discipline | FAIL | review invoked on mechanical transport changes |
| User handoff | FAIL | founder repeatedly had to correct orchestration and review cadence |
| Audit/log completeness | WARN | rich receipts exist; progress truth is split across manifest/chat/cache |
| Token/context efficiency | FAIL | oversized contexts, repeated reads/reviews and bespoke runners |
| Capability gaps | FAIL | no capsule compiler, authority graph or standard race carrier |
| Safety/governance | PASS | high-risk findings were not waived; deployments remain gated |

## Landing-state verification

At the final pre-landing freeze:

- framework worktree branch: `proposal/wi368-execution-controller-v2`;
- base: `origin/main` at `237edc16e3e7731373aa8bafe41b0f367089f6a5`;
- the canonical framework checkout had unrelated dirty state and was not modified;
- the cumulative P0-P15 candidate, reviewer topology and delivery-state projection are local
  worktree changes; they are not yet committed, pushed, merged, installed or production-proven;
- final inline, Sol and optional/required external results are authoritative only when their
  protected receipts bind this freeze's candidate and owner-config digests; direct Gemini CLI
  evidence is invalid because the configured Google transport is AGY;
- no product worktree or deployed runtime was changed by this bypass build.

**Landing-state verdict:** `implemented-local-shadow-ready-for-digest-bound-final-review`.

Next action: run the cumulative base-vs-candidate proof once, land and install the exact reviewed
candidate, then keep it in shadow until the journal/CAS cutover authority resolver and an explicitly
authorized real Sample canary pass.

## Confidence

**High** on the structural findings: the session trace, current code contracts, artifact sizes,
checkpoint history, measured Tier-1 run and receipt topology agree. **Medium** on the 60-minute
budget and **unproven** on 100x until historical replay plus three post-adoption runs are measured.
The proposal intentionally preserves every material quality and deployment gate while moving
mechanical work to deterministic tooling and the correct executor.
