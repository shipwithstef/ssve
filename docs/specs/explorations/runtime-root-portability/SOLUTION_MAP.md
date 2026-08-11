# Solution Map: Secure Runtime-Root Portability

## Paradigm A: Central secure resolver (BASELINE)

**Core bet:** Central classification plus private fallback solves the root cause
without changing SVC authority architecture.

### Approach A1: Shared Node resolver plus shell CLI

- **How it works:** All consumers request a purpose-specific leaf from one
  resolver. Unset/ENOENT XDG falls back under home; unsafe existing roots deny.
  Loader preflights then forward-recovers by exact retry.
- **Gains:** Meets all RP criteria, dependency-free, one pattern gate.
- **Gives up:** Touches every consumer and adds one Node startup to shell Stop.
- **Complexity:** Medium migration, low steady-state complexity.

### Approach A2: Shared resolver but always use home

- **How it works:** Ignore XDG and place every leaf under home cache.
- **Gains:** Simplest deterministic root.
- **Gives up:** Session-scoped semantics and compatibility with valid XDG.
- **Complexity:** Low.

## Paradigm B: Incident-only compatibility patch

**Core bet:** The host defect is narrow enough to patch at entry points.

### Approach B1: Special-case missing `/run/user/<uid>` in ensure and loader

- **How it works:** If the advertised parent is missing, those two commands use
  the existing Codex/home or OS temp fallback; other consumers remain unchanged.
- **Gains:** Smallest diff and quickest initial repair.
- **Gives up:** Leaves four direct consumers and shell drift; no structural gate.
- **Complexity:** Low now, high support cost.

### Approach B2: Document two environment commands permanently

- **How it works:** Require each session to set a private `XDG_RUNTIME_DIR`.
- **Gains:** No framework change.
- **Gives up:** Not automatic, not host-agnostic, impossible to guarantee across
  hooks/installers, and fails the explicit user requirement.
- **Complexity:** Zero code, highest human burden.

## Paradigm C: Host-native/shared temp state

**Core bet:** The operating system's temp API is the only portable primitive
needed; authority can rely on private leaf modes.

### Approach C1: `os.tmpdir()` for every consumer

- **How it works:** Ignore XDG and create uid-namespaced `0700` leaves in OS temp.
- **Gains:** Works across WSL, containers, Linux, macOS, and Windows conventions.
- **Gives up:** Shared temp parent, cleanup variability, and weaker session owner
  semantics for authority state.
- **Complexity:** Low.

## Paradigm D: Repository-local authority coordination

**Core bet:** All audit/authority state should live with the repository.

### Approach D1: Move runtime locks and receipts into `.svc/runtime/`

- **How it works:** Worktree/common-dir scoped directories hold session receipts
  and locks, using existing Git identity and ownership checks.
- **Gains:** No host runtime-root dependency and strong provenance locality.
- **Gives up:** Writes ephemeral state into product repos, risks tracked residue,
  complicates worktree/shared-common-dir separation, and expands authority schema.
- **Complexity:** High.

## Paradigm E: Dedicated runtime authority service

**Core bet:** A daemon/database can provide true transactional coordination.

### Approach E1: Per-user local daemon with transactional store

- **How it works:** Hooks and scripts call a Unix socket/local RPC service that
  owns locks, graph activation receipts, and sessions.
- **Gains:** Could make multi-file operations transactional and centrally observable.
- **Gives up:** Bootstrapping, lifecycle, installation, version skew, Windows
  transport, and a new privileged single point of failure.
- **Complexity:** Very high.

## Non-obvious options

- Encode the session receipt inside the graph to gain one atomic file. This
  collapses per-session isolation into repository state and makes unrelated
  Codex sessions contend, so it is not acceptable.
- Activate only after writing a provisional receipt. That reverses the partial
  state but risks a receipt that appears authoritative for an inactive graph.
- Roll back the graph after receipt failure. This cannot safely distinguish the
  loader's write from a concurrent legitimate task transition.

## Eliminated early

- Permanent environment commands (B2) fail RP-01/RP-14/RP-15.
- A local daemon (E1) violates the smallest-safe-surface and dependency/host
  constraints.
- Receipt-first or rollback transactions create more dangerous concurrency
  states than graph-first deny-and-retry.

## Research grounding

The seven sourced examples and their lessons are recorded in the solution
confidence artifact: XDG, `pam_systemd`, GLib, gstack, Open GSD, GSD 2, and
Superpowers. The targeted peer snapshot is under
`references/knowledge/runtime-state-portability/`.
