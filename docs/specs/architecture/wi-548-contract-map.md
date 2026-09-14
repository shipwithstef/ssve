# WI-548 Cross-system contract map

Producer → consumer for the portable delivery spine. Old-path / new-path
falsification is listed so a reviewer can prove the old failure is gone.

| System | Current producer | Current consumer | Selected contract | Old path that failed | New path that must pass | Falsification |
|---|---|---|---|---|---|---|
| Review launcher | `scripts/run-external-review.mjs` | review-plan, review-exec, check-chain-receipts | Launch once; write package + findings + transport receipt; promote bytes into WI-547 store; receipts keep logical ids | Absolute worktree path in launcher receipt is required to still exist | Digest + repo identity resolve the same bytes from any checkout | `check-chain-receipts --sha f27a143a` from main without the WI-542 worktree and without AGY |
| Receipt writer | `scripts/emit-receipt.mjs` | notes `refs/notes/svc-receipts`, `.svc/receipts/<sha>/` mirror | Write `{type, wi, sha, phase?}`; merge siblings; reject destructive overwrite | Second WI on same SHA overwrites the first type slot | Both WI-542 and WI-543 verify-promotion receipts survive | Emit two verify-promotion receipts on one fixture SHA; both readable |
| Evidence store | WI-547 `review-evidence-store.mjs` | reviewer-evidence, check-chain-receipts, relocate CLI | CAS under `$(git-common-dir)/svc-review-evidence/`; relocation manifest | Evidence only in `.worktrees/.../.svc/external-review-artifacts/` | Object id is SHA-256 of exact bytes | Change one byte → fail closed; replay relocate twice → idempotent |
| Receipt checker | `scripts/check-chain-receipts.mjs` | pre-push, reconcile, Stop, verify-promotion, final report | Validate schema + identity + evidence digest; never launch a reviewer | Passes only in the original worktree; Stop ignores a failing check | Same SHA checked from main and from a sibling worktree | Checker must not spawn AGY/Claude/Codex |
| Task graph | `scripts/task-graph.mjs` / `.svc/lane-tasks-<WI>.json` | Stop adapters, route-workflow | Index of work, not authority over failed receipts | `completed` allowed without plan/exec receipts | Completion refused when canonical receipts fail | Mark execute complete with no exec-record → denied |
| Stop / finalization guards | `hooks/svc-task-completion-guard.sh` + host adapters | host Stop events | Re-run canonical receipt check before success | Grok/Cursor adapters 100644 → dangling; missing policy → warn | Executable adapters (WI-545) + shared refuse (WI-549) + WI-550 barrier | Stop with invalid receipts → deny; valid dual-WI envelope → allow |
| Worktree create | `svc-ensure-worktree.mjs`, `worktree.sh create` | every mutating WI | Bind WI/branch/session; do not copy policy as authority | Fresh worktree missing gitignored chain-policy | Shared policy via git-common-dir | New worktree sees refuse without a local file |
| Worktree remove | `worktree.sh remove` | land/closeout | Refuse if unpromoted review artifacts remain | `remove` deletes the only copy of AGY packages | Promote then remove | Remove before promote → denied; after promote → checker still passes |
| Dispatch resolver | new `scripts/resolve-dispatch.mjs` | every review + subagent + continuation | Owner file at now ⊕ work overlay ⊕ explicit session override | `resolve-adversarial-reviewer.sh` rewrites non-claude/codex to claude | Grok/Cursor/AGY stay themselves when configured | Missing owner file → refuse, not Claude |
| Continuation controller | new baton + `svc-auto-drive.mjs` | land-changeset, verify-promotion | Hash-bound baton, exactly-once native launch, structured result | Owner pastes a prompt into a fresh Grok session | Controller launches `verify.restart` and consumes the result | “Prompt to send” is a failure receipt |
| Host installers / adapters | `./setup --host`, wirers, `svc-enforce` | Grok, Cursor, Claude, Codex, Kimi, AGY reviewer | Capability-declared install; executable bash runners; drift zero | Registration-only “parity”; 100644 adapters | `./setup --host grok` and `--host cursor` succeed with 0 drift | Drift or non-executable runner → setup fail-closed |

## Declared non-consumers

- AGY does not consume orchestrator lifecycle (SessionStart, Stop, task graph mutation).
- Claude/Codex are not default consumers of Grok/Cursor work.
- Historical `.wi543.bak` is not a consumer of any new contract.

## Old-path / new-path proof obligations (later execution)

1. Historical AGY review of `f27a143a` verifies from main (WI-547).
2. Dual-WI receipts on one SHA both survive (WI-550).
3. Fresh worktree observes shared refuse (WI-549).
4. Grok/Cursor Stop adapters run after `./setup` (WI-545).
5. Resolver does not rewrite Grok→Claude (WI-551).
6. Restart-bound verify launches without owner paste (WI-552).
