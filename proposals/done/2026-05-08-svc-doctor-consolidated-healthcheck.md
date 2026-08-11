# Proposal: `svc doctor` — Consolidated Framework Health Check

**Status:** open
**Filed:** 2026-05-08
**Author:** Claude (during AP-30 hardening session)
**Class:** framework, defensive

## Problem

After PRs #78 and #79 (AP-30 lifecycle pinning), the framework has solid install-time and worktree-removal-time hardening. The remaining gap: **a single command the user can run anytime to verify framework integrity end-to-end.**

Today the integrity surface is spread across:

- `scripts/check-install-drift.sh` — symlink + skill drift
- `scripts/kimi-health-check.mjs` — Kimi-specific
- `scripts/preflight.mjs` — pre-task readiness
- `test-framework/evals/tier-1/validate-*.sh` — 30+ structural tests
- `hooks/svc-session-start-healthcheck.mjs` — fires only at session boot

A user who suspects something is wrong mid-session has no single command to run. They have to pick which check to invoke, in what order. The fragmentation also means new install hazards (like AP-30) can land without an obvious place to register the new check.

## Proposal

Create `svc doctor` (`scripts/doctor.sh`) that:

1. Runs **all tier-1 validators** (structural, fast — currently ~30 scripts under `test-framework/evals/tier-1/`)
2. Runs **install-drift check** (`scripts/check-install-drift.sh --host claude`)
3. Runs **session-start healthcheck logic** (the symlink + hook-script dangling probes from `svc-session-start-healthcheck.mjs`, but as a callable function)
4. Runs **concern-registry sanity** (registry parses, fixtures pass — already wired in Example Marketplace via `npm run check:concerns`)
5. Reports a single PASS / WARN / FAIL summary with a punch list

**Output contract:** under 50 lines, structured. Each finding has `severity`, `surface` (e.g., "symlinks", "tier-1", "concerns"), `recovery` (one-line action).

**Recovery hook:** `svc doctor --fix` runs the recovery actions where they're safe (re-run setup, prune dangling links, etc.). Manual confirmation for anything that mutates state.

## Why this is worth it

- **Discoverability:** users can audit framework health without knowing the topology.
- **Single registration point** for new install hazards — when AP-31 is filed next, one new line in `doctor.sh` covers it.
- **CI portability:** doctor.sh becomes the natural CI target for "does the framework still work."

## Why it can wait (defer signal)

The session-start auto-heal (`svc-session-start-healthcheck.mjs`) catches the most common failure mode (dangling symlinks, missing hook scripts) at every session boot. Mid-session failures are rare now that PR #79 closed the worktree-removal hole. So the user-facing tool is a UX improvement, not a load-bearing safety mechanism.

## Out of scope

- Wirer hardening: confirmed safe in current invocation chain; would only matter if someone invoked `wire-*-hooks.mjs` directly from a worktree, which no documented flow does.
- A tier-2 behavioral integration test for `worktree.sh remove` (instead of the structural-only tier-1 we shipped). The structural test catches code-level regressions; behavioral testing would require filesystem mutation in CI which is a different cost class.

## Decision needed

Approve as a future WI (medium priority — closes UX gap, not a hazard). When approved, runs as:
- `capture-idea --from-proposal proposals/done/2026-05-08-svc-doctor-consolidated-healthcheck.md` → WI created → standard Lane 7 framework lane.
