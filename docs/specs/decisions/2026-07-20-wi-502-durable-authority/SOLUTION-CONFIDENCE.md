# Solution Confidence: WI-502 durable authority

## 1. User Ask And Confidence Bar

The owner wants the defective current-session hook bypassed, the complete relevant authority/dispatch framework reviewed, and an implementation-ready plan reviewed by Fable before code implementation. Good enough to plan means: both live failure directions are reproduced; current invariants and prior WIs are accounted for; operation scope, lease lifecycle, delegation, merge-back, migration, and shell containment have explicit negative proofs; every proposed action has a closeout gate.

Out of scope: visual UX, hosted deployment, a general shell parser, inferred child ownership, and implementation before the reviewed plan checkpoint.

## 2. Current Picture

The framework already has exact worktree/WI/session binding, claim generation, liveness checks, atomic bootstrap, read-only classification, and exact skill receipts from WI-484 through WI-501. Those checks are valuable but receive the wrong repository when top-level session cwd differs from tool workdir/targets. `svc-worktree-isolation-guard` has stronger path helpers than the Codex context, but the two do not share a complete target parser. Dispatch is mostly WI-level and its worker result is post-hoc; within-WI mutating children lack durable capabilities.

There is no customer UI, web/mobile flow, cold/warm product perception, provider charge, or runtime deployment. The hot path is local hook execution. Cold path means first Git identity/lease lookup; warm path means revision-keyed cached identity and no lease write until renewal threshold.

## 3. Why The Current Design May Exist

WI-484 correctly optimized for the first hard problem: prevent one session from adopting another worktree. Worktree-local binding/claim files were simple, inspectable, and avoided a central ledger. WI-486 added atomic bootstrap and generation checks. WI-494's review noticed per-call `workdir`, but the then-documented Codex contract exposed only top-level cwd, so the finding was dismissed rather than implemented speculatively. WI-501 then improved read classification and break-glass recovery without changing scope resolution.

That sequence explains the design: it was a safe monotonic hardening for immutable single-controller sessions. The new host payload and desired mutating-child model exceed that original boundary; deleting the existing tuple checks would discard proven safety.

## 4. Constraint Profile

- Local documentation/script framework; no root package manager or service.
- Linux is the primary current host, but all provisioned hosts must receive explicit capability treatment.
- Mutation hot path must remain zero-provider and fast.
- Main/default checkout and unrelated `.svc` residue are protected.
- Existing v1 authority must not silently widen or vanish during upgrade.
- Codex subagent hooks use the parent session id; stable agent identity is event-specific, so child mutation fails closed unless dispatch binds a stable identity through a trusted channel.
- Hook syntax inspection cannot become a claimed shell security boundary.
- Rollback must restore exact v1 bytes and disable new delegation without weakening the current v1 guard.

## 5. Freshness And Cache Classes

| Data | Class | Invalidation owner |
|---|---|---|
| Session cwd/principal input | per-event real-time | host adapter; never cross-event cached |
| Canonical target scope | per-tool-call real-time | target/workdir changes |
| Git worktree/common-dir identity | process/session cacheable | canonical path or Git common-dir mismatch |
| Controller lease | revision/generation cached | backend revision, generation, expiry, renew threshold |
| Delegation capability | short-lived cached | status, expiry, parent generation, task/worktree mismatch |
| Execution graph | parent-controlled durable state | accepted task/receipt/merge transition |
| Host containment capability | install/version cached | setup, host binary/version, policy drift |
| Child worktree/diff | live Git state | every commit/write/merge |

No media/image cache applies.

## 6. Cost Model

Current work performs multiple local Git calls in different guards and can trap the operator in repeated denied turns. Target work performs one canonical scope pass shared by guards, one read-only lease/capability lookup, and a locked write only on lifecycle transitions or thresholded renewal. Recurring monetary cost remains zero. Disk cost grows with one inner worktree per concurrently mutating child and is bounded by explicit cleanup/retention. The design reduces repeated parsing and denial loops rather than hiding them in a cache.

## 7. World Grounding

| Primary source | Production lesson | Applied decision |
|---|---|---|
| [OpenAI Codex hooks](https://developers.openai.com/codex/hooks) | PreToolUse sees tool-specific JSON, subagent hooks reuse the parent session id, and hooks are explicitly a guardrail rather than a complete enforcement boundary. | Parse verified tool input; do not treat session id alone as child identity; document and require containment separately. |
| [Git rev-parse](https://git-scm.com/docs/git-rev-parse) | `--show-toplevel` identifies an exact worktree and `--git-common-dir` identifies shared repository state. | Keep worktree identity and repository digest distinct. |
| [Git worktree porcelain](https://git-scm.com/docs/git-worktree) | `worktree list --porcelain -z` is the stable script interface and worktree locking avoids creation races. | Use stable NUL-safe enumeration and repository locking. |
| [Git submodules](https://git-scm.com/docs/gitsubmodules) | A submodule is another project with independent history even when nested inside a parent working tree. | Parent authority never covers submodule/nested-repo targets. |
| [Kubernetes Leases](https://kubernetes.io/docs/concepts/architecture/leases/) | Leases coordinate one active leader, renew availability, and support controlled leader transition. | Use one controller lease with renewal, expiry, and atomic handover. |
| [Consul sessions and locks](https://developer.hashicorp.com/consul/docs/automate/session) | Lock invalidation/release enables liveness but imperfect failure detection trades safety for progress. | Prefer positive liveness proof; use expiry only under configured uncertainty; record recovery evidence. |
| [Linux Landlock](https://docs.kernel.org/userspace-api/landlock.html) | Filesystem restrictions compose as a real process boundary and cover hierarchy mutation; limitations must be explicit. | Separate hook authorization from sandbox/wrapper containment and advertise capability gaps. |

## 8. Options Considered

### Decision: overall rollout architecture

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 | Staged single-WI contract: scope primitive → lease v2 → delegation → containment rollout | Preserves v1 safety, fixes the proven repository-selection bug first, then adds dependent capabilities with rollback anchors | Large reviewed changeset and several checkpoint gates |
| 2 | Only patch Codex `tool_input.workdir` | Fast symptom relief | Leaves patch targets, structured commands, handover, children, and shell claims inconsistent |
| 3 | Replace claims with a new central authority daemon | Strong central serialization | New service/install/availability burden conflicts with local-first framework |
| 4 | Keep claims and add signed delegation files only | Smaller migration | Immutable controller ownership and recovery remain unresolved; two authority semantics drift |
| 5 | Rely entirely on host sandbox/worktrees | Real containment | Does not decide which WI/task/principal is authorized and varies by host |

**Chosen:** #1.

### Decision: authoritative v2 storage

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 | Repository-shared CAS store keyed by canonical common-dir digest, with worktree-local mirrors | One controller decision across all worktrees while retaining inspectable local compatibility | Migration and secure shared-state lifecycle required |
| 2 | Keep one claim per worktree | Existing code | Cannot atomically hand over or coordinate children across inner worktrees |
| 3 | Default-checkout `.svc` ledger | Easy to find | Dirties/protects the wrong checkout and couples to residue |
| 4 | User-global database only | Cross-worktree coordination | Harder backup/repo portability and stale identity cleanup |
| 5 | Git notes as live lease store | Durable history | Poor CAS/expiry hot path and concurrent mutation ergonomics |

**Chosen:** #1.

### Decision: child mutation topology

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 | Inner worktree per mutating leaf, explicit disjoint capability, sequential parent merge | Strong containment and deterministic integration | More worktrees and orchestration |
| 2 | Same parent branch for disjoint files | Cheap | A child can still touch shared/unexpected files and commits race |
| 3 | Inner worktrees only for overlapping scopes | Current reference shape | Overlap should serialize; it is the least safe case to parallelize |
| 4 | Patch-only child output with no workspace | Narrow authority | Harder realistic tests and tool compatibility |
| 5 | No mutating children | Safest simple baseline | Rejects the requested capability and loses safe parallelism |

**Chosen:** #1 when identity and containment are proven; otherwise #5 for that host.

## 9. Tradeoff Matrix

| Option | Correct scope | Handover | Parallel child safety | Hot-path cost | Reversible | Operational risk |
|---|---:|---:|---:|---:|---:|---:|
| Staged v2 | high | high | high on capable hosts | low/local | high by slice | medium during migration |
| Workdir-only patch | medium | none | none | lowest | high | high residual false permits |
| Authority daemon | high | high | high | service IPC | medium | high install/availability |
| Claims + delegation | medium | low | medium | low | medium | high semantic drift |
| Sandbox only | filesystem-only | none | host-dependent | host-dependent | high | high authority ambiguity |

Mobile memory and customer perception are N/A. Operator perception improves through precise denial causes and deterministic recovery.

## 10. Action-by-Action Approval Packet

| Proposed action | Why this action exists | How it would be achieved | Positive outcome | Negative / risk | Impact if skipped | Required proof before closeout |
|---|---|---|---|---|---|---|
| Add canonical operation scope | Live false deny and false permit share one root cause | Pure shared resolver, verified host adapters, complete target parsing, exact Git identity | Existing authority checks apply to the correct repo/worktree | Parser omissions could create new escape paths | Current hook remains both over- and under-enforcing | Red/green three-probe replay plus symlink/nested/mixed/new-file matrix |
| Integrate scope into all mutation guards | Split consumers currently disagree | Codex enforcer and universal worktree guard consume one normalized object | One invariant across mutation paths | Read/prompt paths could be accidentally tightened | A second guard can reintroduce drift | Consumer inventory has no duplicate authority parser; parity fixtures pass |
| Add structured Bash rejection plus containment capability | Cwd/targets cannot contain arbitrary subprocesses | Reject obvious forms; declare sandbox/wrapper adapter and unsupported states | Honest defense in depth | Host variance and wrapper compatibility | Hooks may be misrepresented as shell security | Escape fixtures plus actual denied write outside sandbox on supported hosts; docs assert limitations |
| Migrate claim to controller lease v2 | Immutable session ownership cannot hand over safely | Shared CAS store, repo digest, lease/generation/state/timestamps, explicit migration | Resume, transfer, and recovery become auditable | Migration could wedge existing WIs | Handover/recovery remain unsafe or manual | v1 exact-byte backup/rollback, CAS races, old-generation denial |
| Add one-time handover and recovery | New sessions must not inherit silently | Prepare/accept token, generation bump, liveness/expiry recovery receipt | One controller before and after transition | Token handling/replay risk | Operators stay trapped when shell changes | replay/expiry/concurrent accept/live-owner/corrupt-evidence fixtures |
| Add nested execution graph and partition fence | One lane stage must support multiple leaf tasks safely | Versioned graph; dependency expansion; disjoint waves; shared/unknown serialization | Parallelism without breaking lane ordering | Planner may underdeclare scope | Same-WI mutation remains unsafe | overlap/shared/unknown matrices and atomic one-winner accept |
| Add child capability and hook enforcement | Parent relationship cannot be inferred | Persist delegation before launch; bind principal/generation/worktree/path/expiry/task/skill | Least-privilege child mutation | Host may lack stable child identity | Any child mutation would inherit parent too broadly | forged/expired/revoked/wrong-generation/worktree/path/receipt negative fixtures |
| Add completion receipt and sequential merge | Post-hoc summaries are insufficient | Recompute Git ancestry/files/digest/validation/cleanliness; merge one at a time | Reproducible, rejectable merge-back | More validation time | Undeclared files or stale assumptions can merge | tamper, unknown file, conflict, changed-base, source→integration mapping fixtures |
| Freeze/adopt children on handover | Old generation receipts must not cross controllers | Freeze then explicit adopt/wait/revoke/restart creates new generation capability | Handover cannot accidentally merge stale child authority | Additional operator decisions | Old controller generation leaks through merge | handover-during-run replay with direct old receipt rejection |
| Update docs/knowledge/install surfaces | Installed hosts and future agents must use the contract | Host capability matrix, Codex payload knowledge, setup/drift checks, doctrine/reference updates | Durable cross-host behavior | Install drift during rollout | Source can be correct while live hooks stay stale | all-host install drift checks and focused post-install smoke fixtures |

## 11. Outcome Coverage

- Best case: correct repository selection eliminates both live failure directions; leases make control transferable; capable hosts gain safe parallel mutation.
- Worst scope case: incomplete parser misses a target. Mitigation: complete directive fixtures, deny contradictions, universal consumer inventory, real containment.
- Worst migration case: v2 state disagrees with v1. Mitigation: no implicit migration, exact backup, single authority source, reversible feature gate.
- Worst concurrency case: stale child finishes after handover. Mitigation: generation invalidation, freeze, explicit adoption, recomputed receipt.
- Cost/scalability: local Git/digest work grows with targets/tasks; cache by stable identity/revision and serialize merges. No provider/API usage.
- Support/ops: more lifecycle commands, offset by deterministic status/recovery and retained logs/worktrees.
- Web/mobile/native/data correctness are N/A except filesystem/Git state correctness; no customer data path exists.

## 12. Decision Or Remaining Unknowns

**Decision:** proceed with the staged v2 architecture. **Confidence: high** on scope resolution, lease generation, explicit delegation, and sequential merge principles; **medium** on the exact containment adapter for every provisioned host until capability probes run during implementation.

The only blocking implementation unknown is per-host availability of a trustworthy stable child identity plus a writable-filesystem sandbox/wrapper. The contract resolves that unknown safely: child mutation is unsupported on a host until both are mechanically proven.

## 13. Base44/AI Suggestions Triage

The owner's proposal is the external suggestion set.

| Suggestion | Class | Reason |
|---|---|---|
| Verified `tool_input.workdir`, relative resolution, realpath, exact worktree | adopt | Directly fixes reproduced cause and matches Git/host contracts. |
| Preserve original session repository separately | adopt | Needed for honest context/contradiction diagnostics. |
| Complete file-tool target extraction and one-worktree rule | adopt | Closes reproduced absolute patch target false permit. |
| Nested repos/submodules require own authority | adopt | Matches independent Git repository identity. |
| Bash two-layer model | adopt | Matches official hook guardrail limits and OS containment practice. |
| Principal/lease/generation model | modify | Adopt semantics, but evolve current claims through explicit v1→v2 migration rather than wholesale replacement. |
| Multiple child tasks in one WI | modify | Always use one inner worktree per mutating child; overlapping/unknown/shared scopes serialize rather than using inner worktrees to justify overlap. |
| Parent→child persisted edge | adopt | Codex session id is not trustworthy child lineage. |
| Merge receipt and sequential merge-back | adopt | Required to make parallel execution deterministic. |
| Resume/handover/recovery | adopt | Generation transition is the missing ownership lifecycle. |
| Complete all capability on every host immediately | modify | Enforce only after host identity and containment probes; otherwise fail closed for child mutation. |

## 14. User-Facing Summary

- The current hook bug is confirmed in both directions: it can block the wrong repo and allow a governed target from the wrong cwd.
- Fix repository selection first with one canonical scope resolver shared by every mutation guard.
- Keep the proven WI-484/486 checks, then migrate them explicitly into a generation-based controller lease.
- Safe mutating children require separate inner worktrees, non-overlapping scopes, stable identities, expiring capabilities, and parent-only sequential merge.
- A hook can reject obvious Bash escapes, but only a host sandbox/wrapper can contain arbitrary shell writes.
- Hosts lacking stable child identity or containment remain single-controller instead of silently weakening authority.
- Implementation closes only after red/green payload tests, CAS/handover races, child scope/receipt replays, all-host install checks, and independent review.
