# Peer Runtime-State Portability — Detail

## Mechanisms

### gstack

`bin/gstack-paths` owns three explicit precedence chains. State chooses a
framework override, matching plugin data, home state, then project-local state.
Temporary storage chooses `TMPDIR`, `TMP`, then a project-local directory. It
creates the temp root best-effort and intentionally leaves failure to callers.

### Open GSD

`hooks/gsd-context-monitor.js` builds context metric and debounce filenames
under Node's `os.tmpdir()`. It rejects session IDs with separators or traversal
tokens, ignores missing/stale/corrupt files, and suppresses all hook failures.
This is intentional because the files only influence advisory warnings.

### GSD 2

`src/resources/extensions/gsd/session-lock.ts` keeps an `auto.lock` under the
project `.gsd` root and uses `proper-lockfile` when available. It snapshots the
selected lock path at acquisition, records PID/start metadata, distinguishes
compromise and stale state, and supports bounded reacquisition/recovery.

### Superpowers

`docs/porting-to-a-new-harness.md` separates invariant skill content from thin
per-harness tool mappings and bootstrap delivery. Install artifacts, rather
than manual edits to user configuration, own the integration. The project also
maintains a zero-runtime-dependency policy.

## Analysis

- **Useful for:** Designing one SVC root-selection contract that works across
  Linux, WSL, containers, and multiple AI harness installers.
- **Trade-offs:** Home-cache fallback survives beyond a login session, so SVC
  must use private namespaces, TTL/stale metadata, and exact authority checks;
  raw system temp is easier to clean but weaker on shared hosts.
- **Similar to:** SVC already has project state (`.svc`) and secure
  generation-bound authority. WI-506 concerns only the ephemeral coordination
  directory and loader publication order.
- **Could improve SVC by:** Centralizing precedence, classifying unavailable
  versus hostile roots, snapshotting the chosen root per operation, and
  defining exact preflight/retry boundaries.
- **Assumptions:** The current user ID and home directory are available to Node;
  a real XDG runtime directory, when present, is user-owned and mode `0700`.
- **Watch out for:** A nonexistent path and an existing unsafe path are not the
  same condition. Falling back for both converts a security signal into an
  availability path. Creating `/run/user/<uid>` would incorrectly impersonate
  the session manager.

## Key source files

- gstack `bin/gstack-paths:12-63` — precedence chains and best-effort temp creation.
- Open GSD `hooks/gsd-context-monitor.js:45-90` — path-key validation and advisory temp bridge.
- GSD 2 `src/resources/extensions/gsd/session-lock.ts:70-117` — snapshotted paths and parallel lock targets.
- GSD 2 `src/resources/extensions/gsd/session-lock.ts:258-398` — acquisition and recovery.
- Superpowers `docs/porting-to-a-new-harness.md:34-87` — invariant core and host adapter split.
- Superpowers `docs/porting-to-a-new-harness.md:768-775` — installed integration and zero-runtime dependency rule.
