# HO1-A — authority and count accounting

- Implemented on `feature/ho1-orchestrator-hierarchy`; no push.
- Imported CP2/SR1 runtime/docs from the sibling Orchestrator OS worktree, including recovery tests and stable descriptor locks.
- Added `goals.mjs`: create, grant-worktree, set-priority, set-state, list; sole goals.json writer.
- Parent transactions use a stable kernel lock, expected revision, fsync/atomic rename and private file modes.
- Canonical grants reject aliases, nested/overlapping planning or worker roots, reserved paths and observed escaping links.
- Child contracts reuse the recorded existing planning worktree; generation/session/principal/depth checks reject stale/foreign/grandchild dispatch.
- Dispatcher start/resume requires an active goal and exact worktree/lane grant; existing lifetime whole-worktree/session locks remain.
- A queued durable attempt reserves a worker run under the same lock as parent edits; concurrent admission cannot exceed the cap.
- Counts-v1 reports Claude turns from session events/checkpoints and attempts/approximate elapsed per CLI.
- Replay/resume IDs and cumulative count checkpoints deduplicate; known provider usage stays latest reported snapshots, never summed charges.
- Added registry/child JSON schemas, immutable contracts, idempotent seed helper and README contracts.
- Collector projects empty registry goals, priority, registry_revision, changed_goal_ids, budgets/usage and orphan ownership blockers.
- Public task fields use an allowlist; raw contracts, private fields, prompts and process argv are excluded.
- Seeded `~/.local/state/orch/goals.json` at revision 2 with novisenti and orchestrator-os using the requested exact plan paths/root restrictions.
- Both seeds are registered with unknown caps and no grants; parent must explicitly allocate/activate. No sessions launched or services changed.

Validation:
- `node --test scripts/orch/*.test.mjs`: 42 passed, 0 failed, 0 skipped (14.31 s).
- Includes real user-systemd scopes with fake CLI: lease exclusion, stop, exact resume, timeout and descendant teardown; no inference.
- `node --check` for changed runtime modules, `bash -n scripts/orch/install-units.sh`, `git diff --check`: PASS.
- `bash scripts/verify-file-persistence.sh --from-git-status`: PASS.
- Initial authority test failed before goals.mjs existed; native usage-field regression failed before the normalizer fix; final suite passed.
- Imported SR1 web recovery string escaping failed its new parse test; fixed and verified.

Limits:
- Cumulative token journals/quota-share estimates are future work per the binding v1 correction.
- Live Claude transport, native session leases/fencing, event delivery and owner headers/recovery extensions remain HO1-B/C, unverified.
- Role/principal checks are trusted local protocol assertions; bypass-mode worker filesystem containment remains unverified, not a security claim.
- Four pre-existing untracked docs outside docs/orch were preserved; independent orchestration review remains the parent's responsibility.
