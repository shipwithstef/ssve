# Design Decisions: WI-505 stale binding reclaim

## Session Mode: auto

The owner fixed the outcome and required a full fail-closed authority pipeline. These alternatives decide only how to preserve those invariants with the smallest implementation.

## D-1: Authority classification boundary

**Phase:** design-tech
**Decided:** one shared secure v1 tuple inspector, called optimistically by resume and re-run under the claim lock by transfer
**By:** AI (auto)

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Shared exact tuple inspector in `wi-claim.mjs` | Keeps claim security, owner, coordinates, freshness, generation, ambiguity, and v2 exclusion in one implementation while allowing a locked re-read | Adds one explicit result/state vocabulary |
| 2 | Make `activeBindingOwner()` claim-aware | Small script-only diff | Duplicates transfer logic and leaves binding retirement/v2 ordering unresolved |
| 3 | Reorder existing checks around `transferClaim()` | Fewest changed lines | Still accepts ambiguous bindings and leaves old residue unreleased |
| 4 | Route all classification through `resolve-wi.mjs` | Reuses the final authority oracle | Resolver answers only exact current-session ownership and cannot select a stale foreign source tuple for mutation |
| 5 | Replace v1 bootstrap with v2 recovery | One future authority model | Violates explicit migration, expands scope, and silently changes existing WI authority |

**Chosen:** #1 because WI-505 needs one implementation of tuple truth without changing the authority model.

## D-2: Transfer and source-binding ordering

**Phase:** design-tech
**Decided:** retain the existing generation CAS as the linearization point, then retire the exact source binding under the same claim lock before returning success
**By:** AI (auto)

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Claim CAS first, exact binding retirement second, both under claim lock | The moment generation changes, the old binding is already non-authoritative; a crash is recoverable without generation rollback | Two atomic files cannot commit as one filesystem transaction, so crash states must be supported |
| 2 | Binding release first, then claim CAS | Removes coarse residue early | A crash temporarily removes the source binding while leaving the old claim current |
| 3 | Write a transaction journal and replay | Can describe multi-file intent explicitly | New schema/state/recovery machinery is disproportionate; current generation semantics already provide the authority linearization point |
| 4 | Delete the old binding after CAS | Simple cleanup | Violates audit preservation and turns recovery into deletion |
| 5 | Leave the old binding unreleased and teach all readers to ignore it | Minimal mutation | Expands every consumer and lets residue keep causing conservative false blocks |

**Chosen:** #1 because exact generation mismatch immediately revokes old authority, while durable `released_at` cleanup prevents later false blocks.

## D-3: V1/v2 precedence

**Phase:** design-tech
**Decided:** any canonical v2 lease record for the repository/WI excludes standard v1 reclaim; use the v2 lifecycle or explicit rollback/migration tooling instead
**By:** AI (auto)

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Deny v1 transfer when a v2 lease record exists | Preserves WI-502's never-dual-authoritative contract and protects active leases before v1 mutation | Conservative for a released v2 lease until explicit recovery/rollback is completed |
| 2 | Deny only active v2 leases | Exactly matches the minimum stated invariant | A released/corrupt v2 record could allow v1 mutation that final resolution later rejects |
| 3 | Prefer whichever generation is larger | Mechanical arbitration | Compares unrelated version domains and can silently reverse migration |
| 4 | Auto-migrate stale v1 into v2 | Gives one modern path | Explicitly forbidden by WI-502 |
| 5 | Ignore adjacent v1 whenever v2 directory exists | Very conservative | Directory existence alone is not secure identity evidence and malformed state diagnostics are lost |

**Chosen:** #1 because an exact secure v2 record is evidence that the explicit migration boundary was crossed; standard v1 bootstrap must not arbitrate it.

## D-4: Crash and repeated-resume recovery

**Phase:** design-tech
**Decided:** treat a current-session claim with no current-generation binding and only provably older exact-coordinate bindings as forward-completable without a generation bump
**By:** AI (auto)

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Forward-complete the winner binding at the existing generation | Recovers a crash after claim CAS, preserves idempotence, and keeps old bindings non-authoritative | Requires an explicit `current_unbound` inspector state |
| 2 | Re-transfer current owner to itself | Reuses transfer entry point | Incorrectly increments generation twice or needs a special CAS exception |
| 3 | Roll claim back to the old owner | Reconstructs pre-transfer state | Generation rollback is unsafe and can revive old authority |
| 4 | Require manual binding deletion/recreation | Operationally simple code | Violates the automatic recovery objective |
| 5 | Create a bootstrap marker retroactively | Reuses partial-create recovery | Marker provenance would be fabricated after the fact and blur deletion authority |

**Chosen:** #1 because the claim CAS already chose the winner; binding creation is forward completion, not another transfer.

## D-5: Test placement

**Phase:** design-tech
**Decided:** extend the existing complete-tuple bootstrap Tier-1 fixture and reuse the existing claim/v2 fixture helpers; no new test framework
**By:** AI (auto)

| Rank | Option | Why recommended | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Add a focused section to `validate-default-checkout-isolation.sh` | It already creates hermetic Git/worktree tuples through the public ensure path and owns residue safety | The fixture grows, so helpers and assertions must remain clearly sectioned |
| 2 | New `validate-stale-binding-reclaim.sh` | Very focused ownership | Adds another Tier-1 entry and duplicates repository scaffolding |
| 3 | Put all cases in `validate-session-worktree-binding.sh` | Existing CAS and binding coverage | That fixture mostly targets a single worktree root, not public registered-worktree resume |
| 4 | Node unit tests only | Fast and precise | Cannot prove Git worktree identity or dirty-file preservation |
| 5 | Live Example Marketplace replay only | Highest fidelity | Unsafe and too late for red/green development; races and corrupt states are hard to reproduce |

**Chosen:** #1, followed by the mandatory live replay after promotion.
