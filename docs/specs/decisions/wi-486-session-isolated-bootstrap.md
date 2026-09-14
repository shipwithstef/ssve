# Design Decisions: WI-486 session-isolated bootstrap

## Session Mode: auto

The owner supplied and accepted the complete behavior contract and authorized end-to-end delivery. These choices select its specification shape without reopening the required behaviors.

## D-1: Scope boundary

**Phase:** write-spec  
**Decided:** authority resolution, atomic bootstrap, compatibility inspection, explicit migration, and loop termination  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | One cohesive session-authority correction | Covers every cause of the unreachable bootstrap while preserving the accepted WI-486/WI-487 boundary | Touches hooks, bootstrap, migration, and fixtures atomically |
| 2 | Fix Codex read ordering only | Smallest symptom correction | Leaves bootstrap, host drift, forged override, and legacy loops broken |
| 3 | Fix worktree helper only | Makes isolated creation reachable | Mutation hooks can still confuse foreign graphs with authority |
| 4 | Implement legacy migration only | Helps older machines | Does not make new concurrent work safe and risks granting implicit authority |
| 5 | Include all-host installation and hook diagnostics | Could close the whole incident family | Absorbs WI-487 and breaks the required dependency order |

**Chosen:** #1 because the accepted gap is the complete current-session authority lifecycle; WI-487 stays separate.

## D-2: Story granularity

**Phase:** write-spec  
**Decided:** five stable system-consumer boundaries  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Reads/authority, bootstrap, host parity, compatibility migration, loop termination | Each boundary has a distinct consumer and negative-test matrix | More AC tables |
| 2 | One end-to-end session story | Compact | Hides atomicity and migration authorization boundaries |
| 3 | One story per affected source file | Easy implementation mapping | Couples requirements to an unreviewed design |
| 4 | Split migration into a new WI | Smaller implementation | Breaks the accepted WI-486 contract and leaves WI-487 without compatibility |
| 5 | One story per host | Visible parity | Duplicates the invariant and encourages host-specific drift |

**Chosen:** #1 because it is implementation-neutral while preserving independent proof obligations.

## D-3: Acceptance-proof approach

**Phase:** write-spec  
**Decided:** temporary git repositories, exact-byte fixtures, failpoints, and same-input host parity replays  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Hermetic repositories plus deterministic concurrent/failpoint replay | Proves git/worktree behavior, residue preservation, atomicity, and loop termination without external state | Fixture harness is substantial |
| 2 | Static source assertions only | Fast | Cannot prove races, rollback, or byte preservation |
| 3 | Tests against this repository's live worktrees | Realistic | Unsafe, nondeterministic, and can disturb concurrent work |
| 4 | Manual operator checklist | Flexible | Not replayable and cannot gate regression |
| 5 | Paid cross-model runtime tests | Adds reviewer diversity | Irrelevant to local state behavior and forbidden in Tier 1 |

**Chosen:** #1 because every accepted AC is observable at local process/filesystem boundaries.

## D-4: Shared authority boundary

**Phase:** design-tech  
**Decided:** extend `hooks/lib/resolve-wi.mjs` and expose the same function through a CLI serialization  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Extend the existing strict resolver | Reuses verified WI-484 ownership logic and gives every host one source | Requires adapting current Codex and Bash consumers |
| 2 | Add a new session-task-authority module | Clean new API | Creates a second ownership implementation and migration burden |
| 3 | Keep host-specific resolvers with shared tests | Small code changes | Tests cannot prevent semantic drift between implementations |
| 4 | Make graph path the authority root | Simple lookup | Reintroduces forged override and foreign-graph takeover risk |
| 5 | Use session-contract JSONL as authority | Already shared | Append-only last-row state is racy and not claim-generation bound |

**Chosen:** #1 because the current universal isolation guard already depends on this resolver's exact binding semantics.

## D-5: Bootstrap transaction and locking

**Phase:** design-tech  
**Decided:** existing secure repository lock plus cross-worktree same-WI scan and selective rollback ledger  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Repository lock, tuple scan, reverse rollback | Matches git's shared worktree state and makes one-winner behavior simple | Different-WI creations briefly serialize |
| 2 | Per-WI locks only | Higher parallelism | Git common worktree/branch operations still race globally |
| 3 | Central ownership ledger in default checkout | Easy same-WI lookup | Mutates shared residue and adds a new authority database |
| 4 | Optimistic create then reconcile | Fast uncontended path | Can leave two partial worktrees/claims during races |
| 5 | Rely on branch-name uniqueness | Uses git only | Same WI can use different branches and both appear valid |

**Chosen:** #1 because worktree creation is rare and correctness dominates negligible serialization.

## D-6: Initial graph contract

**Phase:** design-tech  
**Decided:** validate an existing exact-WI graph or create a minimal v1 route-workflow graph with inferred lane  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Existing exact graph or minimal route graph | Preserves intake graphs and makes brand-new WIs immediately routable | Bootstrap must infer/validate a lane |
| 2 | Require a graph template argument | Explicit content | Makes the accepted simple bootstrap command incomplete |
| 3 | Create an empty task array | Minimal state | No task can load route-workflow or establish the chain |
| 4 | Copy any repository graph | Easy reuse | Risks copying foreign WI state and authority |
| 5 | Defer graph creation until inside worktree | Smaller helper | Leaves partial bootstrap and recreates the original deadlock |

**Chosen:** #1 because the graph is part of the accepted atomic tuple and route-workflow is its deterministic first task.

## D-7: Compatibility loop state

**Phase:** design-tech  
**Decided:** pure byte inspector plus secure runtime marker keyed by session and full state digest  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | XDG/runtime session+digest markers | Bounds repeats without mutating repository state or granting authority | Markers are local and regenerable |
| 2 | Reuse the existing pressure count | Fewer files | Omits state digest and excludes malformed states from its cap |
| 3 | Append compatibility rows to session-contract | Durable in git | Shared append state can cross sessions and dirty every checkout |
| 4 | In-memory process cache | No disk | Hooks are separate processes, so every call looks first-time |
| 5 | Always fail open after first parse error | Ends loops | Can weaken mutation authority without an attributable recovery |

**Chosen:** #1 because it bounds messaging while leaving every security decision fail-closed.

## D-8: On-disk migration

**Phase:** design-tech  
**Decided:** separate explicit Node CLI with lossless version map, fresh-foreign exclusion, backup, atomic write, and schema receipt  
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Explicit migration CLI | Makes authorization and recovery inspectable and testable | Adds a small command and schema |
| 2 | Auto-migrate in hooks | Seamless | Hooks would gain write authority and can loop or corrupt foreign work |
| 3 | Auto-migrate during bootstrap | One command | Contradicts normal bootstrap's no-foreign-mutation contract |
| 4 | Quarantine every non-current graph | Very safe | Lossless old state becomes unnecessarily unusable |
| 5 | Manual editor instructions | No new code | Not atomic, receipted, or replayable |

**Chosen:** #1 because migration is an operator-authorized state change, not a side effect of authority inspection.
