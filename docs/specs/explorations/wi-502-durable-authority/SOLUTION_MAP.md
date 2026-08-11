# Solution Map: WI-502 durable authority

## Paradigm A: staged local capability system (baseline)

**Core bet:** exact canonical scope + generation-bound local state provides strong authority without a service.

### A1: shared scope + CAS lease + inner-worktree capability
- How: the BASELINED WI-502 design.
- Gains: satisfies all scope, handover, child, and offline constraints.
- Gives up: implementation breadth and migration complexity.
- Complexity: high but aligned with current Node/Git modules.

### A2: same model with user-global SQLite authority
- Gains: strong transaction support.
- Gives up: repository portability, inspectability, and simple setup.

## Paradigm B: centralized broker/daemon

**Core bet:** serialize all authority through a long-lived service.

### B1: local authority daemon over Unix socket
- Gains: strong live identity and atomic transitions.
- Gives up: install, lifecycle, availability, Windows/host parity.

### B2: remote coordination service
- Gains: cross-host liveness and central audit.
- Gives up: paid/network dependency and offline failure; violates local-first.

## Paradigm C: host-native containment as primary

**Core bet:** the host sandbox/worktree is the only trustworthy boundary.

### C1: sandbox per agent, framework tracks task receipts only
- Gains: smallest framework authority code.
- Gives up: no portable WI/controller/handover semantics and host behavior diverges.

### C2: forbid mutating shell and accept only structured file tools
- Gains: target enumeration becomes tractable.
- Gives up: framework scripts, Git, tests, and builds cannot execute normally.

## Paradigm D: immutable controller plus patch-only children

**Core bet:** avoid handover and filesystem child mutation.

### D1: child returns a patch blob for parent application
- Gains: narrow child write authority.
- Gives up: realistic task testing, resume/handover, large change ergonomics.

## Non-obvious option

Use OS file-descriptor capabilities/openat-style operations for structured tools while retaining sandboxed shell. This would reduce path races further but requires host/runtime changes beyond this repo; retain as future hardening, not the WI-502 primary path.

## Eliminated early

- Auto-migrating claims inside hooks: a guard would mutate authority while deciding authority.
- Same-branch parallel mutation: post-hoc scope detection is too late.
- Overlapping inner-worktree children: isolation does not make their merge assumptions compatible.
