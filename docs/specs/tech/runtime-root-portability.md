# Technical Design: Secure Runtime-Root Portability

**Status:** BASELINED
**WI:** WI-506
**Mode:** design_auto
**Contract map:** `docs/specs/contract-maps/svc-runtime-root-resolution.md`

## Scope and acceptance authority

This is framework infrastructure with no user-visible UI, personas, or product
journey. The acceptance authority is RP-01 through RP-18 in `WI-506.md`, the
real invalid-XDG host reproduction, and the original Example Marketplace WI-496 loader
replay. No discussion artifact exists and no product question is unresolved.

## Current architecture

Six consumers independently choose `XDG_RUNTIME_DIR` or a fallback. Codex adds
its own strict resolver, while ensure-worktree, claim locking, isolation,
migration, and the shell completion guard use different path and validation
rules. `codex-load-skill` validates graph shape and skill identity, activates
the graph, then resolves session storage and authority.

```text
XDG/env --> ephemeral policies --> receipt/advisory namespaces
                                  |
Codex graph --> activate-skill ----+--> sessionDir --> authority --> receipt
```

The permanent design makes one resolver the stable dependency for all
ephemeral runtime consumers, keeps every correctness lock in one Git
compare-and-swap ref namespace shared by linked worktrees, and
moves predictable loader checks before the graph mutation.

## Architecture

Add one dependency-free Node library under `hooks/lib/` that owns root
classification, secure leaf creation, and operation-local path snapshots. Add a
small stdout-only Node CLI for shell use. Consumers retain their existing
purpose-specific leaf names; only selection and validation are centralized.

```text
                       +-------------------------------+
env/uid/home ----------> hooks/lib/svc-runtime-root.mjs |
                       +---------------+---------------+
                                       |
             +-------------------------+--------------------------+
             |                         |                          |
             v                         v                          v
       Codex session               isolation               completion
             |
             +--> loader preflight --> activate --> receipt publish
                                       |
                            post-activation failpoint
                                       |
                                  exact retry

shell completion guard --> scripts/svc-runtime-root.mjs --> same library

canonical Git repository --> refs/svc/authority-locks/<hash>
                                  |
                 exact-old-object update-ref CAS
                                  |
                  +---------------+----------------+
                  v               v                v
            claim/binding   ensure bootstrap   task migration
```

### Components

| Component | Type | Responsibility | New/Modify |
|---|---|---|---|
| Shared runtime resolver | Node library | Select, classify, validate, create, and snapshot a secure consumer leaf | New |
| Runtime resolver CLI | Node script | Expose the same resolver to shell with path-only stdout and actionable stderr | New |
| Codex context | Node library consumer | Delegate root policy while preserving session/repo hashing and legacy override | Modify |
| Loader transaction | Node script | Preflight storage/authority before activation and recover the cross-file crash gap by retry | Modify |
| Runtime consumers | Node/shell | Replace direct XDG/temp selection with shared resolver calls; preserve explicit advisory-only degradation for completion-pressure state | Modify |
| Focused validator | Tier-1 shell/Node fixture | Prove the classification and consumer parity matrix | New |
| Existing activation validator | Tier-1 fixture | Prove byte identity, failpoint recovery, and receipt idempotency | Modify |
| Direct-policy pattern gate | Tier-1 check | Reject future direct XDG runtime selection outside the resolver/tests | New or folded into focused validator |
| Plan-review phase classifier | Node review launcher | Treat exact mandatory blend outputs as pre-execution evidence while retaining exec-record and executable-diff denial | Modify |

No data model, external service, network call, UI, feature toggle, or new package
is required. A feature flag is deliberately rejected because parallel security
policies would create drift; rollback is a reviewed code revert.

## Plan-review phase classification

`blend-external` is an upstream lane requirement and writes attribution and
knowledge records before `plan-changeset` and `review-plan`. The phase guard must
therefore classify only these exact non-executable paths as pre-execution:
`NOTICES`, `references/blend-registry.json`, and `references/knowledge/**`.
This is an allowlist, not a general `references/**` exemption.

The durable matching `exec-record` remains authoritative and rejects plan review
even when every changed path is exempt. Any changed path outside the existing
planning prefixes and this exact allowlist also continues to reject before a
provider spawn. The classifier disables Git rename detection so both the source
and destination of a move are evaluated; moving implementation into an exempt
path therefore remains implementation divergence. Tier-1 fixtures prove
blend-only allow, executable-path deny, staged and committed rename deny, and
exec-record deny. The one owner-authorized WI-506 retro-plan receipt exists only
because this correction cannot affect the guard until after the plan is reviewed
and implemented.

## Resolver contract

### Precedence

1. `SVC_RUNTIME_DIR` when explicitly set: absolute, pre-existing, canonical,
   current-user-owned directory with mode `0700`; consumer leaf is created below
   it. Unsafe or missing explicit override fails closed.
2. Legacy `SVC_CODEX_RUNTIME_DIR` for the Codex consumer only: preserved as the
   exact direct leaf and validated to the same boundary contract. It is no
   longer auto-created: create it explicitly with `mkdir -m 700 -p <path>`
   before export so a typo cannot create state at an unintended location.
3. `XDG_RUNTIME_DIR` when set and existing: require a non-symlink directory,
   current uid, exact mode `0700`; create the consumer leaf below it.
4. `XDG_RUNTIME_DIR` absent or `lstat` returns exactly `ENOENT`: select
   `${real HOME}/.cache/svc-runtime/<consumer-leaf>`. The SVC-owned boundary and
   descendants are `0700`; files are `0600`. The existing user-owned `.cache`
   parent may use conventional `0755` permissions but may not be a symlink or
   foreign-owned.
5. Any other XDG access failure, existing non-directory, symlink, foreign owner,
   or unsafe mode fails closed. SVC never creates the advertised XDG parent and
   never creates `/run/user/<uid>`.

The resolver returns `{ path, source, fallback_reason }` internally and a
canonical path only through the shell CLI. Each consumer resolves once at the
start of an operation and passes that snapshot through its helpers.

### Consumer leaves

Existing names are retained on valid XDG where practical to minimize drift:
`svc-codex`, `svc-isolation-overrides-<uid>`, and the completion guard leaf.
Home fallback places those leaves under `~/.cache/svc-runtime/`.
The legacy unset-XDG Codex leaf remains `~/.cache/svc-codex-runtime` for
behavior compatibility; it is selected and validated by the shared policy.

### Shell failure boundary

The two shell-owned files are completion-pressure/compatibility markers, not
mutation authority. They consume the same resolver and therefore make the same
unavailable-versus-unsafe classification. When the resolver rejects an unsafe
existing root, the Stop guard must emit an explicit advisory-only diagnostic and
skip persistent completion pressure instead of writing elsewhere or trapping the
session in a repeated block. Git-ref correctness locks, isolation receipts, and
Codex mutation receipts remain fail-closed. This is the deliberate RP-06 adapter
difference; it is tested and may never be reused for authority state.

## Loader transaction and state machine

```text
START
  |
  v
PARSE_AND_VALIDATE_GRAPH
  | failure -> REJECT_NO_WRITE
  v
RESOLVE_SKILL_AND_INSTALLED_TASK_GRAPH
  | failure -> REJECT_NO_WRITE
  v
PREFLIGHT_RUNTIME_DIR_AND_RECEIPT_TARGET
  | failure -> REJECT_NO_WRITE
  v
PREFLIGHT_CURRENT_AUTHORITY
  | failure -> REJECT_NO_WRITE
  v
ACTIVATE_GRAPH_ATOMICALLY
  | process crash -> PARTIAL_GRAPH_ONLY
  v
PUBLISH_SESSION_RECEIPT_ATOMICALLY
  | process crash/write failure -> PARTIAL_GRAPH_ONLY
  v
OUTPUT_SKILL -> COMPLETE

PARTIAL_GRAPH_ONLY -- exact same loader retry --> preflight --> idempotent
activation --> receipt publish --> COMPLETE
```

Predictable preflight rejection must leave graph bytes and any prior receipt
bytes unchanged. Cross-file atomicity is not claimed: graph and session receipt
live under different roots. Instead, the only permitted partial state is a
valid activated graph without the new session receipt, which denies mutation
and is forward-completed by the exact same authorized loader request. A valid
existing matching receipt is not rewritten on retry.

## Design alternatives

### D1 — Root selection architecture

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 | Shared resolver library plus thin CLI | One policy for Node and shell; dependency-free and testable | Touches all consumers in one WI |
| 2 | Shared shell resolver sourced everywhere | Natural for shell | Awkward/error-prone from Node and weaker structured errors |
| 3 | Use Node `os.tmpdir()` universally | Very portable | Shared temp is not an adequate authority boundary |
| 4 | Keep consumers local and add common tests | Small code diff | Drift remains structurally possible |
| 5 | Introduce a runtime-state daemon | Centralizes ownership | Large lifecycle/security/deployment burden |

**Chosen:** #1 because SVC needs one enforceable policy without a new service or dependency.

### D2 — Missing versus unsafe XDG

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 | Fallback only on unset/ENOENT; deny unsafe existing state | Restores WSL/container availability without hiding attacks | More classification branches |
| 2 | Fallback for every XDG error | Maximum availability | Silently bypasses hostile roots |
| 3 | Always fail when XDG is set but absent | Strict reading | Leaves supported host class unusable |
| 4 | Create missing advertised XDG root | Seems self-healing | Impersonates session manager/trust boundary |
| 5 | Ignore XDG and always use home | Predictable | Discards session lifetime and valid host contract |

**Chosen:** #1 because availability and security require different treatment for absent and hostile state.

### D3 — Graph/receipt transaction

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 | Preflight then activate, publish, exact retry | Smallest safe change; predictable failures no-write | Tiny unavoidable crash window remains denied until retry |
| 2 | Publish receipt before graph activation | Receipt storage proven first | Creates the more dangerous receipt-without-active-graph state |
| 3 | Co-locate receipt inside graph transaction | True single-file atomicity | Breaks per-session isolation and current enforcer contract |
| 4 | Journaled two-phase commit | Formal recovery | Excessive new state and recovery complexity |
| 5 | Roll graph back if receipt write fails | Restores bytes in common cases | Races can overwrite another valid graph update |

**Chosen:** #1 because exact forward recovery is safer than cross-file rollback.

### D4 — Shell consumer integration

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 | Invoke stdout-only Node resolver CLI | Exact parity and one pattern gate | One short Node process at Stop time |
| 2 | Duplicate classification in shell | No subprocess | Two policies drift immediately |
| 3 | Keep `/tmp` for shell as advisory | Simple | Completion state also affects blocking behavior |
| 4 | Port completion guard to Node | Strongest parity | Large unrelated rewrite |
| 5 | Remove completion runtime state | Fewer files | Loses anti-loop/compat behavior |

**Chosen:** #1; measured subprocess overhead is negligible relative to Stop hook work and authority consistency is more important. Resolver rejection keeps the completion-pressure surface advisory-only, matching its existing non-authority role.
The common allow path launches no resolver subprocess. Malformed-state handling
and completion-pressure counting are mutually exclusive branches, so one Stop
evaluation launches the resolver at most once.

## Cost model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute | One `lstat`/realpath chain per operation; one Node process for Stop shell bridge | Local framework commands/hooks | No provider charge; sub-millisecond library path, process startup for shell | Linear with hook invocations | Developer machine |
| Storage | Small lock/receipt files, existing lifecycle | KB per active session/WI | No external charge | Linear with concurrent sessions | Developer disk |
| Bandwidth | None | 0 | 0 | N/A | N/A |
| External APIs | None | 0 | 0 | N/A | N/A |
| Background jobs | None | 0 | 0 | N/A | N/A |

First-month and year-1 provider cost remain $0. The operational red line is a
measured material Stop-hook latency regression; focused timing should compare
the shell bridge to current guard runtime, while correctness remains the gate.

## Freshness and cache classes

| State | Class/lifetime | Invalidation owner |
|---|---|---|
| Selected runtime root | Operation-local snapshot | New operation re-resolves |
| XDG runtime leaf | Login-session ephemeral | Session manager removes parent; SVC recreates leaf next operation |
| Home fallback leaf | Persistent cache | Consumer-specific runtime evidence remains non-authoritative; correctness locks do not live here |
| `refs/svc/authority-locks/*` | Durable compare-and-swap token | Exact old object id gates acquisition, proven-dead takeover, and release; Git garbage collection owns unreachable holder blobs |
| Task graph | Durable WI state | Task graph transitions |
| Session receipt | Current session/task evidence | Next exact skill load atomically replaces when authorized |

No runtime path choice is cached across processes. This avoids stale host state
at the cost of a few local filesystem metadata calls.

During the bounded old/new install window, unset-XDG processes can briefly use
different ephemeral receipt/advisory namespaces. Correctness operations use one
repository-shared `refs/svc/authority-locks/*` namespace. `git update-ref`
conditions acquisition on absence, dead-holder takeover on the exact inspected
blob, and release on the exact owned blob, so a delayed contender cannot remove
a fresh holder. A release failure is returned as `lock_release_error` with the
operation result and exact ref/OID rather than being hidden as success. Malformed
holder blobs carry no death proof and therefore deny;
they may be removed only by an independently verified operator using exact-OID
CAS. Live or cross-host-uncertain holders remain fail-closed: the diagnostic
records ref, object id, hostname and PID, and gives the exact conditional
`git update-ref --no-deref -d <ref> <oid>` operator command to run only after
independent death verification. Holder bytes are stable per process and written
only when acquisition is possible, bounding unreachable objects. Durable `.svc`
generation CAS remains the data boundary.
Promotion therefore refreshes every declared
host before replay; zero install drift closes the temporary split before the
framework is called verified.

## Operations and ownership

| Dimension | Answer |
|---|---|
| Owner | SVC framework maintainers |
| On-call | Best effort; no paging |
| SLA / SLO | Guarded commands must either succeed on supported local hosts or deny with actionable cause; no formal uptime SLA |
| Error budget | No accepted silent authority bypass or partial predictable mutation |
| Monitoring | Focused Tier-1 matrix, full Tier-1, installed drift checks, original WI-496 replay |
| Alerting | Command stderr and failing receipts/tests |
| Dashboard | Existing WI/task graph and framework state; no new dashboard |
| Runbook | Contract map plus WI-506 replay section |
| Failure modes | Unsafe root, missing home, disk full, graph/receipt crash gap, shell bridge failure, mixed install versions |
| Recovery procedure | Correct host permissions or exact authorized loader retry. For an uncertain authority-lock holder, independently verify recorded-host process death, then use the diagnostic's exact-old-OID `git update-ref` command; never time-expire or blindly delete locks, claims, graphs, or receipts |
| Backup / restore | Repository state follows Git/receipts; runtime files are reconstructable coordination evidence |
| Dependencies' failure impact | Node/filesystem failure denies guarded mutation; no external dependency |

## Feasibility matrix

| AC | Persona pressure | Feasible? | Design mechanism |
|---|---|---|---|
| RP-01 | N/A - framework | yes | unset/ENOENT home fallback |
| RP-02 | N/A - framework | yes | strict valid XDG branch |
| RP-03 | N/A - framework | yes | lstat/type/uid/mode rejection |
| RP-04 | N/A - framework | yes | absolute pre-existing secured override |
| RP-05 | N/A - framework | yes | shared Node module plus direct-policy gate |
| RP-06 | N/A - framework | yes | stdout-only Node CLI from shell |
| RP-07 | N/A - framework | yes | SVC-owned 0700 leaf, 0600 files, never create XDG parent |
| RP-08 | N/A - framework | yes | loader preflight ordering |
| RP-09 | N/A - framework | yes | no-write predictable failures and exact forward retry |
| RP-10 | N/A - framework | yes | preserve valid-XDG leaf names and legacy Codex override |
| RP-11 | N/A - framework | yes | focused classification/consumer/failpoint matrix |
| RP-12 | N/A - framework | yes | focused plus full Tier-1 classification |
| RP-13 | N/A - framework | yes | install refresh and drift validator |
| RP-14 | N/A - framework | yes | original Example Marketplace WI-496 replay without override |
| RP-15 | N/A - framework | yes | acceptance command environment and residue hashes |
| RP-16 | N/A - framework | yes | exact pre-execution blend-path allowlist |
| RP-17 | N/A - framework | yes | executable-diff and durable exec-record rejection fixtures |
| RP-18 | N/A - framework | yes | SHA-bound canonical retro-plan receipt and review log |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Home fallback persists ephemeral files longer than XDG | Cache growth or stale advisory pressure | Never treat runtime-file existence as authority; bound cleanup remains a follow-up lifecycle hardening item |
| A crash leaves a correctness lock | Permanent authority denial or unsafe takeover | Store hostname/PID/start-token in a Git blob and transfer the ref only with `update-ref <new> <exact-old>` after positive same-host death proof; malformed blobs deny and require independently verified exact-OID operator recovery; ESRCH remains sufficient without `/proc`; uncertain/cross-host holders fail closed, never time-based theft |
| Different processes choose different explicit runtime roots | Split serialization namespace | Keep claim, binding, bootstrap, and task-state migration locks in the repository-shared Git ref namespace; runtime roots are never the authority boundary |
| Repository skill path is a symlink | Local-file disclosure into model context | Reject repository skill files and ancestors containing symlinks; installed skill farms remain governed by the trusted install boundary |
| Malformed completion counter contains shell syntax or octal-looking bytes | Stop-hook execution or `set -e` abort | Accept only canonical bounded base-10 bytes, force base-10 arithmetic, and degrade malformed pressure state to advisory |
| New resolver breaks valid hosts | Framework-wide denial | Preserve leaf contracts, focused consumer parity, install drift and full Tier-1 |
| Mixed old/new installed files choose different roots | Temporary receipt/lock split | Land as one change, refresh every host, require zero drift before replay |
| Preflight authority goes stale before activation | Race | Existing graph/authority locks remain final mutation boundary; enforcer revalidates receipt authority |
| Shell CLI failure changes Stop behavior | Confusing closeout or repeated pressure | Emit an actionable advisory-only diagnostic and skip persistent pressure; focused tests prove no fallback write |
| Broad file count exceeds design smell threshold | Review complexity | Only two new runtime implementation files and focused tests; remaining changes are migrations/docs |
| Phase exemption becomes broad enough to hide execution | Paid plan review could run after changes began | Exact-file/prefix allowlist plus authoritative exec-record denial and executable-path negative fixtures |

## Adversarial G4 review

- `[Layer 1] [Confidence: 10/10]` One built-in Node resolver removes direct
  duplicated policy without a third-party dependency.
- `[Layer 3] [Confidence: 9/10]` Missing and unsafe roots must be separate
  states; one is availability, the other is a security signal.
- `[Layer 1] [Confidence: 9/10]` Forward-completing the graph/receipt crash gap
  avoids unsafe rollback over a concurrently advanced graph.
- `[Layer 1] [Confidence: 9/10]` A shell-to-Node adapter is smaller and safer
  than porting the full completion guard or maintaining a second resolver.
- `[Layer 1] [Confidence: 8/10]` No feature toggle: a security policy fork is
  harder to operate than a reviewed revert.

**G4 result:** PASS. All RP criteria are feasible, no external dependency or
one-way-door decision remains, risks and rollback are explicit, and promoted
acceptance is bound to the original host failure.

## Planned implementation surface

- `PLANNED` — new shared resolver under `hooks/lib/`.
- `PLANNED` — new resolver CLI under `scripts/`.
- `PLANNED` — migrate the five Node consumer files and Codex context.
- `PLANNED` — update shell completion guard to call the CLI.
- `PLANNED` — reorder and make `codex-load-skill` retry-idempotent.
- `PLANNED` — add focused runtime matrix, loader failpoints, and pattern gate.
- `PLANNED` — correct the review phase allowlist and add allow/deny/exec-record fixtures.
- `PLANNED` — update install/checksum surfaces discovered by plan scan.
