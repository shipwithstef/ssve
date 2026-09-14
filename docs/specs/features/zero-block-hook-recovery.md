# Zero-block hook recovery and instant provisioning

**Status:** VERIFIED-L3
**Work item:** WI-531
**Lane:** framework

## Behavior contract

SVC separates inspection from authority before evaluating ownership. A proved read never acquires or requires mutation authority. An explicitly approved mutation enters one canonical worktree, activates one task atomically, and keeps one generation-bound controller. Exact same-owner continuity self-heals bounded metadata drift; ambiguity and foreign ownership remain fail-closed.

Provisioning is content-addressed. Host manifests define lifecycle events and exact managed-command cardinality. Setup preserves unrelated host state, skips unchanged work, and provides explicit full rebuild and all-host modes.

## Acceptance criteria

The authoritative criteria are AC-531-1 through AC-531-15 in `docs/specs/work-items/WI-531.md`. Proof boundaries:

1. Synthetic fixtures prove each security negative and crash boundary.
2. Real-session canaries prove user-visible recovery behavior.
3. Full Tier-1 proves no baseline regression and closes the Phase B denominator.
4. Installed-host checks prove source behavior and effective host behavior separately.
5. Post-merge canonical-main checks are required before `VERIFIED`.

## Invariants

- Read classification runs before claim, task, lease, or operation-scope enforcement.
- Unknown or mixed commands are not guessed read-only.
- Repair is deterministic, CAS-protected, idempotent, no-follow contained, and bounded to one retry.
- Same-owner repair never changes the checked-out commit or user files.
- Host provisioning never deletes or rewrites unrelated user/plugin configuration.
- A passing fixture is not a substitute for the three named live canaries.

## Industry Grounding

**Source:** repository-local authority incidents and tests; capability-based security, transactional reconciliation, content-addressed installation, and bounded-retry infrastructure patterns
**Landscape state:** stable internal developer-infrastructure standards as of 2026-08-11

### What the industry does

Separates read capabilities from write authority, uses idempotent reconcilers and locks for shared state, and caches installs by content identity.

### What we're doing

SVC classifies proved reads before authority, self-heals one exact same-owner lineage under CAS, and provisions manifest-defined hosts through digest-bound per-host locks.

### Why we differ

This is internal developer infrastructure rather than a market-facing product feature. The relevant external standards are least privilege, capability-based authority, idempotent reconciliation, transactional rollback, content-addressed installation, and bounded retries. SVC differentiates by combining those controls with an agent-visible recovery contract: inspection stays frictionless, mutations remain attributable, and every automatic repair has deterministic proof and a fail-closed ambiguity boundary.

### Reversibility

The change retains explicit `--full`, installation rollback snapshots, foreign-owner denial, and the pre-existing v1/v2 authority records required to reverse or audit a repair.

## Verification journeys

### J1 — clean first task

Given a new WI created by `svc-ensure-worktree`, when Codex loads the first approved skill from that worktree, then exactly one task becomes active without recovery or override.

### J2 — preserved product continuation

Given a unique same-owner preserved product worktree with stale branch metadata, when the owner says continue, then SVC repairs the lineage and resumes the task without asking for a shell command.

### J3 — safe read after closeout

Given no active WI, when the agent runs read-only diagnosis, then the command succeeds and creates no authority state.

### J4 — reset-safe runtime target

Given an authorized product worktree whose local database runtime was reset, when a fixture repair targets a configured runtime path, then canonical scope remains valid and no branch mismatch is introduced.

### J5 — fast unchanged install

Given an already converged host, when setup runs again, then managed files and config bytes remain unchanged and the no-op performance budget passes.
