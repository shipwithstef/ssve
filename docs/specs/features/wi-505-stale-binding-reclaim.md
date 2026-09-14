# WI-505 Technical Design: Automatic Stale Complete-Tuple Reclaim

**Status:** VERIFIED
**Type:** pure background framework authority enabler
**Work item:** `docs/specs/work-items/WI-505.md`
**Bugfix brief:** `docs/specs/bugfix/wi-505-stale-binding-reclaim-brief.md`
**Journey anchors:** J-FW-05 S8/S9/S10/S11/S14

UI and visual design are explicitly N/A. The operator-visible surface is the existing CLI JSON result and actionable denial text.

**Promotion proof:** PR #163 merged at `9ae4728b3fd75eee680702d15732dd0b7ea5c11e`. Installed replay of the original Example Marketplace WI-496 command transferred stale generation 1 to the current session at generation 2 with `created=false` and `resumed=true`; a second replay remained generation 2. See `docs/specs/verification/wi-505-stale-binding-reclaim.md`.

## Industry Grounding

**Landscape state:** inapplicable
**Gate verdict:** SKIP
**Branch taken:** inapplicable — internal framework authority correction with no customer-facing or market-facing flow
**Source:** repository-local claim-v1/controller-lease-v2 authority contracts; external market research is not applicable

### What the industry does

No external product or competitive mechanism is being selected. The relevant baseline is the repository's existing generation-bound claim-v1 and controller-lease-v2 authority contract.

### What we're doing

Correct one local ordering defect by correlating bindings to the canonical claim owner, generation, coordinates, and freshness before the existing claim CAS can authorize transfer.

### Why we differ (or align)

The design aligns with the framework's established fail-closed authority model and WI-502's explicit migration boundary. Market differentiation, provider choice, and customer workflow comparison are not applicable.

### Reversibility

Two-way door at the code level through a sanctioned revert/corrective PR. Durable ownership generations remain forward-only and are never rolled back operationally.

## Technical Design

### Architecture

Keep v1 claim CAS as the authority linearization point. Move stale complete-tuple classification into a shared secure helper in `hooks/lib/wi-claim.mjs`; `resumeExisting()` consumes that classification instead of scanning for any unreleased binding, and `transferClaim()` revalidates the exact snapshot under its claim lock before changing generation. When the CAS succeeds, retire the exact source binding under the same lock, then let the existing binding writer and `authorityJson` postcondition complete and verify the winner tuple.

No authority schema, graph schema, v2 lifecycle, host payload, provider, external dependency, or data-migration change is introduced.

### Components

| Component | Type | Responsibility | Change |
|---|---|---|---|
| Secure v1 tuple inspector | local authority helper | Read canonical claim and all binding candidates securely; validate repository/worktree/branch/WI/path/owner/generation; classify fresh, reclaimable, current-unbound, obsolete, or deny | Add in `hooks/lib/wi-claim.mjs` |
| Generation-bound transfer | local CAS mutation | Re-run exact inspection under claim lock, exclude v2, CAS expected generation, record transfer provenance, retire exact source binding | Extend existing `transferClaim()` without changing default direct-claim compatibility |
| Existing-worktree resume | bootstrap orchestrator | Remove coarse binding owner scan; consume inspector/transfer outcomes; forward-complete current winner binding and verify exact tuple | Modify `scripts/svc-ensure-worktree.mjs` |
| Final authority resolver | postcondition oracle | Prove winner binding, claim, generation, graph, and v2 compatibility | Existing `hooks/lib/resolve-wi.mjs`, no planned change |
| V2 store | higher-version exclusion | Return canonical repository/WI lease record; any record excludes standard v1 transfer | Existing read exports in `hooks/lib/authority-store.mjs`, no schema/lifecycle change |
| Hermetic Tier-1 fixture | behavioral proof | Exercise public ensure, exact transfer races, corrupt state, v2 exclusion, and dirty user bytes | Extend default-checkout isolation fixture |

### Dependency graph

```text
svc-ensure-worktree.resumeExisting
          |
          v
wi-claim.inspectV1AuthorityTuple
     |             |
     v             v
secure v1 files   authority-store.readController
     |
     v
wi-claim.transferClaim (claim lock + expected generation CAS)
     |
     +--> claim generation N+1  [linearization point]
     +--> exact source binding released/obsolete
     |
     v
writeSessionBinding --> authorityJson --> owned tuple or fail closed
```

`resolve-wi.mjs` depends on `wi-claim.mjs`; the new v2 query is therefore kept in `wi-claim.mjs` through the already canonical `authority-store.mjs`, which does not import `wi-claim.mjs`. No circular module dependency is introduced.

### Exact tuple contract

The inspector derives, rather than accepts, the canonical claim path:

```text
<real worktree>/.svc/claims/<WI>.claim.json
```

It securely reads the claim and every `.svc/bindings/*.json` entry. A candidate source binding must match:

- secure regular current-user-owned binding and claim files; secure containing directories;
- binding filename derived from its attributable session id;
- schema role `mutating` and the requested WI;
- canonical repository root, real worktree root, named branch, and exact claim path;
- claim owner equal to binding session;
- positive integer claim generation equal to binding generation;
- exactly one source candidate at the current generation.

Released exact bindings remain valid evidence for a released-claim transfer. Secure lower-generation bindings with the same exact coordinates are `obsolete`; they never grant authority and do not make a later exact current candidate ambiguous. A higher generation, wrong owner at the current generation, wrong path/coordinate, duplicate current candidate, malformed JSON, insecure/symlinked/foreign-owned entry, or missing complete source tuple denies before mutation. Read-only bindings are not mutation candidates.

### Authority state machine

```text
                         +------------------------------+
                         | malformed/mismatch/ambiguous |
                         +---------------+--------------+
                                         |
                                         v
                                      DENY (no write)

v1 exact A/genN --fresh----------------> DENY foreign A evidence
       |
       +--stale/released, no v2----------> CAS claim A/N -> B/N+1
                                              |
                                              v
                                  old A binding non-authoritative
                                              |
                                  retire A binding under claim lock
                                              |
                                              v
                                  write/verify B binding at N+1
                                              |
                                              v
                                   RESUMED created=false

B claim/N+1 + no B binding + only obsolete A/N
       |
       +--same current session----------> write/verify B binding at N+1
                                          (no generation increment)

any canonical v2 lease record----------> DENY v1 lifecycle; no v1 write
```

### Transfer ordering and crash states

The existing outer repository/WI bootstrap lock serializes public ensure attempts. The claim-path lock remains the CAS boundary for direct or concurrent transfer attempts. Lock order is always outer bootstrap lock, then claim lock; the inspector only reads the v2 lease atomically and never acquires the v2 mutation lock, so no new lock cycle exists.

| Crash point | Durable state | Next safe action |
|---|---|---|
| Before claim CAS | A/genN and A binding unchanged | Retry classification/transfer |
| After claim CAS, before A binding retirement | B/genN+1 claim; A/genN binding mismatches generation | B forward-completes binding at N+1; A cannot resolve authority |
| After A retirement, before B binding | B/genN+1 claim; A released | B forward-completes binding at N+1 |
| After B binding, before final verification | Complete B/genN+1 tuple | Same-session resume verifies; no bump |
| Verification fails | Ownership metadata retained; no user file rollback/deletion | Correct malformed graph/state explicitly, then retry exact current owner |

Claim generation is never decremented. Binding retirement failure fails the command even though the claim CAS may already have selected B; the retry path recognizes B's current-unbound state and completes it without generation N+2.

### V1/v2 interaction

Before any v1 CAS, derive the canonical repository id and authority state root and securely read the exact repository/WI controller lease. Any lease record—active or released—denies standard v1 reclaim with a v2-lifecycle diagnostic. This is deliberately conservative: a record proves explicit migration occurred, and `resolve-wi.mjs` already refuses to treat adjacent v1 as standalone authority. Malformed/insecure v2 evidence throws and denies. The standard ensure command never calls migration; only `--authority-v2` retains the WI-502 explicit bridge.

If v2 appears concurrently after the read, v2 remains the resolver's source of truth and the final `authorityJson` postcondition denies v1 success. No v1 result is reported authoritative over v2. WI-505 does not redesign cross-version migration locking.

### Race behavior

- Two public ensure calls are serialized by the existing repository/WI lock; one may succeed and the other either observes a busy bootstrap or later resumes/denies the new state.
- Two direct complete-tuple transfers with expected generation N serialize on the claim lock. The first writes N+1; the second re-reads N+1 and returns `claim generation changed; retry from current state` without binding or user-file mutation.
- The winner's `transfer_from_generation=N` is written once. `writeSessionBinding()` sees the same winner claim and retains N+1.
- Same-session replay takes the existing resolver fast path and cannot increment generation.

### Data model

No schema migration. Existing v1 JSON remains compatible. Successful transfer adds only existing claim field `transfer_from_generation`; source binding uses existing `released_at`/`updated_at` plus optional diagnostic transfer fields that readers ignore. V2 bytes and schemas do not change.

### Data flow

```text
ensure request
  -> canonical repo/WI bootstrap lock
  -> registered exact worktree/branch check
  -> same-session complete tuple verify (fast path)
  -> secure v2 exclusion + exact v1 tuple inspection
  -> fresh/corrupt: actionable deny
  -> stale: claim-lock reinspection + expected-generation CAS
  -> source binding retirement
  -> winner binding write/renew at unchanged new generation
  -> graph preservation/validation
  -> authorityJson exact owned postcondition
  -> JSON {created:false,resumed:true,claim_generation:N+1}
```

### External dependencies and toggles

None. The entire path is local Git, Node, and filesystem state. No feature flag is appropriate for fail-closed authority semantics: rollback is the reviewed commit revert, and partial dual behavior would create inconsistent authority. Hermetic fixtures are the zero-credential/no-network mock architecture and first-demo guarantee.

### Technology decisions

| Decision | Choice | Rationale |
|---|---|---|
| Classification | Shared exact inspector in `wi-claim.mjs` | One freshness/generation/security implementation for resume and locked transfer |
| Linearization | Existing claim generation CAS | Already tested, generation-bound, and authoritative to resolver |
| Source binding | Retire after CAS under claim lock | Old binding is immediately non-authoritative and durably stops future false blocks |
| V2 precedence | Any canonical v2 record excludes standard v1 transfer | Preserves never-dual-authoritative explicit migration contract |
| Crash recovery | Forward-complete current owner binding without bump | Honors the already-selected CAS winner |
| Final proof | Existing `authorityJson` resolver | Keeps success tied to the same hook authority semantics |
| Fixture | Extend hermetic complete-tuple Tier-1 section | Proves public Git/worktree/data behavior without new infrastructure |

Full five-option analysis is in `docs/specs/decisions/wi-505-stale-binding-reclaim.md`.

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute | One bounded binding-directory scan, claim parse, and local Git identity lookup per existing-worktree resume | Human bootstrap frequency | $0 external | Linear in binding files; normally single digits | Local operator CPU |
| Storage | A few diagnostic fields on existing claim/binding JSON | One record per transfer | Negligible local bytes | Linear in retained sessions | Repository operator |
| Bandwidth | None | 0 | $0 | Constant zero | N/A |
| External APIs | None | 0 | $0 | Constant zero | N/A |
| Background jobs | None | 0 | $0 | Constant zero | N/A |

**Scaling trigger:** 1,000+ binding files in one worktree would make the bounded scan noticeable and merits an indexed authority inventory; normal one-session-per-WI use remains far below this.
**First month/year 1:** $0 external cost.
**Red line:** any provider/network call or unbounded repository-wide scan on bootstrap is prohibited.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| Owner | svc framework maintainers |
| On-call | Best effort; no paging |
| SLA / SLO | Zero-tolerance false permit; false denial must retain exact reason/evidence |
| Error budget | N/A for best-effort local tooling; no accepted false-authority budget |
| Monitoring | Focused Tier-1, full Tier-1, install drift, and promoted live replay |
| Alerting | Test/receipt/merge gates block promotion; no external alert channel |
| Dashboard | None; task graph, review receipts, and CLI JSON are the evidence surface |
| Runbook | WI-505 brief/design plus `WORKTREES.md` and capability authority docs after promotion |
| Failure modes | Fresh-owner preemption, duplicate CAS winner, old binding reassertion, malformed-state permit, v2 preemption, user-file deletion, crash between claim/binding writes |
| Recovery procedure | Retry current winner for forward completion; use v2 lifecycle for v2 state; revert commit for framework rollback; never delete user worktree as transfer recovery |
| Backup / restore | User files are never mutated; claim/binding metadata is auditable and generation-bound; v2 explicit migration retains its WI-502 backup |
| Dependencies' failure impact | Local filesystem/Git failure denies or aborts without reporting authority; no remote dependency |

### Feasibility Matrix

| AC | Persona pressure | Feasible? | Technical proof |
|---|---|---|---|
| SR-01 | N/A - system-only | Yes | Inspector returns foreign-fresh owner/generation/worktree diagnostic |
| SR-02 | N/A - system-only | Yes | Existing registered worktree path flows through locked transfer and resume result |
| SR-03 | N/A - system-only | Yes | Existing expected-generation CAS and transfer provenance |
| SR-04 | N/A - system-only | Yes | Generation change revokes A; exact binding retirement is required before success |
| SR-05 | N/A - system-only | Yes | Released or lower-generation bindings are non-authoritative/obsolete |
| SR-06 | N/A - system-only | Yes | Claim lock plus generation re-read gives one winner |
| SR-07 | N/A - system-only | Yes | Existing same-session resolver fast path retains generation |
| SR-08 | N/A - system-only | Yes | Secure file/dir checks and deny classifications precede mutation |
| SR-09 | N/A - system-only | Yes | Exact inspector coordinate/path/generation contract |
| SR-10 | N/A - system-only | Yes | Canonical v2 read occurs before CAS and final resolver rechecks |
| SR-11 | N/A - system-only | Yes | No migration call in standard path; v2 schemas untouched |
| SR-12 | N/A - system-only | Yes | Transfer mutates only claim/binding metadata; digest fixture covers user bytes |
| SR-13 | N/A - system-only | Yes | Fixture and replay commands omit break-glass/deletion/impersonation |
| SR-14 | N/A - system-only | Yes | Task graph mandates reviews, focused/full tests, land, install, replay |
| SR-15 | N/A - system-only | Yes | Verify-promotion captures gen1-to-gen2 and second-call idempotence |

All 15 ACs are technically feasible; none require spec revision.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Inspector ignores a malformed extra binding | Ambiguity could become fail-open | Securely parse every JSON entry; any insecure/malformed mutation candidate denies |
| Claim CAS succeeds but binding retirement fails | Command reports failure after authority moved | Treat claim as linearization point; current winner forward-completes without bump |
| V2 state appears concurrently | Dual-state residue | V2 remains resolver source of truth; final postcondition denies v1 success |
| Lock-order cycle | Bootstrap deadlock | Outer bootstrap -> claim only; v2 is read without mutation lock; binding file written directly under claim lock |
| Conservative v2 record denial blocks rollback | False denial | Require explicit WI-502 rollback/lifecycle completion; never guess standard v1 authority |
| Fixture proves helper but not public path | Installed bug remains | Public ensure hermetic test plus exact promoted Example Marketplace replay are mandatory |
| Dirty files are accidentally reset or removed | User data loss | No worktree Git mutation commands in reclaim path; hash tracked/untracked/ignored bytes |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|---|---|---|---|
| Safety vs permissiveness | Exact complete tuple and any-v2-record denial | Reclaiming partial/ambiguous state | Authority recovery must fail closed |
| Audit vs deletion | Mark old binding released | Delete old binding | Preserve ownership history and avoid manual cleanup proof |
| Minimality vs centralization | One helper plus narrow caller changes | Script-only reorder | Prevent repeated liveness/generation drift |
| Availability vs crash simplicity | Forward-complete winner after partial transfer | Manual recovery | CAS winner is already authoritative; completing its binding is safe/idempotent |
| Scope vs perfect cross-version serialization | Read v2 before mutation and verify after | Redesigning v1/v2 common lock | Required active-v2 protection without reopening WI-502 architecture |

### Adversarial G4 review

- `[Layer 1] [Confidence: 10/10]` Reusing `readClaimAbsolute`, atomic JSON writes, claim locks, generation CAS, and `authorityJson` is safer than a new transaction store.
- `[Layer 3] [Confidence: 10/10]` Claim generation is the multi-file linearization point: old binding authority disappears at generation mismatch even before its cleanup write.
- `[Layer 1] [Confidence: 9/10]` Any-v2-record exclusion matches the existing resolver's refusal to treat released/corrupt v2 alongside v1 as standalone authority.
- `[Layer 1] [Confidence: 10/10]` The selected file surface is below the scope-reduction trigger: two runtime files, one focused fixture, and documentation.
- `[Layer 1] [Confidence: 9/10]` No feature toggle is safer for authority code; rollback is a whole-commit revert with no schema migration.
- `[Layer 3] [Confidence: 9/10]` A current-unbound state is necessary and sufficient to recover the only dangerous crash window without another generation bump.

**G4 result:** PASS. Architecture satisfies SR-01..SR-15, all failure paths are fail-closed, risks/trade-offs/rollback are explicit, and no unresolved one-way-door question remains.

### Rollback

Revert the runtime and fixture changes as one reviewed commit. Existing transferred v1 tuples remain schema-compatible: old bindings stay released, current claim/binding generation remains authoritative, and the prior framework will still verify the current same-session tuple. Do not decrement generation, restore the old owner, delete authority files, or modify v2 state during rollback.

### Planned implementation items

- `PLANNED` — shared exact v1 tuple inspector and locked source-binding retirement in `hooks/lib/wi-claim.mjs`.
- `PLANNED` — replace coarse foreign binding precheck in `scripts/svc-ensure-worktree.mjs`.
- `PLANNED` — hermetic stale/fresh/race/mismatch/idempotence/v2/dirty-file fixture.
- `PLANNED` — focused/full Tier-1, independent reviews, sanctioned landing, installation, and live replay evidence.

**Next:** `plan-changeset` must translate this design into exact function/file edits, red/green order, review evidence, rollback checkpoints, and promoted replay commands.
