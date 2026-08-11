# Problem Brief: WI-511 loop-state lifecycle

## Problem statement

Per-session loop-guard state prevents cross-session pollution but has no retirement lifecycle. Reclaim files inactive for more than seven days without changing current-session detection, state format, repository scoping, concurrency safety, or host output.

## Upstream context

- Governing spec: `docs/specs/work-items/WI-511.md`
- Hard rule: zero quality, determinism, validation, auditability, or durability loss.
- Current owner: `hooks/svc-loop-guard.mjs`.
- Current persistence: repository-scoped `.svc`, `writeJsonAtomic`, one filename per sanitized session ID.
- Relevant precedents: WI-399, WI-440, WI-452, WI-508, WI-509, WI-510.

## Success criteria

### Must

- WI511-AC1 through WI511-AC8.
- No recursion and no target outside the resolved `.svc`.
- Active writer wins without waiting.
- Cleanup failure cannot alter the hook decision.

### Should

- Avoid scanning `.svc` on every tool event.
- Keep rollback to one owner-local boundary.

### Nice

- Expose deterministic helper results for hermetic fixtures.

## Baseline approach

The technical design selects a creator-owned helper, a 24-hour scan cadence derived from the current state file, exact filename/file-type/age checks, and zero-wait reuse of the existing state lock.

## Assumptions to challenge

1. Cleanup belongs in the creating hook.
2. A small helper is preferable to inline logic.
3. A 24-hour cadence is worth the extra current-file `lstat`.
4. Filesystem `mtime` is sufficient freshness evidence for generated state.

## Constraints

No daemon, external service, cache, state schema migration, recursive deletion, glob deletion, task-graph coupling, or audit-file deletion.
