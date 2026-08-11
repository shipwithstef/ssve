# Proposal: stale-branch-read guard + branch-divergence/config-on-main check

- **Date:** 2026-06-20
- **Status:** proposed
deferred_until: 2026-08-25
reason: pending owner triage
blocked_reason: re-triaged/deferred to 2026-07-29 to match backlog cadence (WI-475 house-keeping)
- **Lane to implement:** framework-evolution (PreToolUse hook + routing/closeout check are hot-path → plan-changeset)
- **Origin:** a single session produced (a) three wrong root-cause diagnoses from reading a stale feature branch as if it were the deployed ref, and (b) a config change that was invisible to the pipeline because it sat on a long-lived branch never merged to `main`. The rule `verify-state-before-context.md` already covered the spirit of both but was not mechanically enforced, so it was violated.

## Problem 1 — stale-branch reads (silent wrong conclusions)

Local clones of multi-branch repos (`ezbob-platform`, `ezbob-services`, `gitops-ezbob`) are routinely parked on feature branches. `Read`/`grep` returns whatever branch is checked out, not the deployed ref. This session: `ezbob-platform` was on `wi179/lms-init-port-fix`; the diagnosis `Read` `actions/dbank-bundle-bootstrap/action.yml` from it and concluded "no `--replSet`/`rs.initiate` — the author forgot the wiring." The deployed `origin/main-pilot` version *had* both. Three corrections shipped to the wrong place before `git show origin/main-pilot:<file>` revealed the truth.

The existing rule (`verify-state-before-context.md` → "Read the deployed ref, not the local working tree") is advisory; nothing enforces it.

## Problem 2 — work stranded on a long-lived branch (no pipeline effect)

`new-devops-platform`'s working branch `docs/main-pilot-graduation-policy` drifted **316 commits ahead** of `main`. Its `bb-gh-sync-config.yaml` edits were a no-op for the pipeline (Hop-2 reads that config from `new-devops-platform@main` by default), so the changes "worked locally" but never took effect — discovered only by accident. Plus the primary checkout being parked on that branch is what made the stale reads in Problem 1 easy.

## Proposed changes

### A. PreToolUse hook `svc-stale-branch-read-guard` (advisory, fail-open)

On `Read`/`Grep` (and `Bash` containing `cat`/`sed`/`head` of a tracked file) whose target path resolves under a **registered multi-branch repo**, compare the repo's `HEAD` branch to its registered canonical ref. If they differ, emit an **advisory** (never block):

```
ADVISORY: ezbob-platform is on 'wi179/lms-init-port-fix', not the canonical 'main-pilot'.
For deployed/running truth use:  git show origin/main-pilot:<path>
(working-tree reads here may not reflect what is deployed)
```

- Registry: a small JSON `repo → canonical-ref` map (`ezbob-services:main-pilot`, `ezbob-platform:main-pilot`, `gitops-ezbob:main`, `new-devops-platform:main`).
- Fail-open: unknown repos, detached HEAD, or any error → silent pass. Never blocks a read.
- One advisory per repo per session (dedupe) to avoid noise.

### B. Routing + closeout check `svc-branch-divergence` (advisory → warn)

At `route-workflow` start and at mutating-closeout, for the active repo:
1. If `HEAD` is **> N commits ahead of its canonical** (default N=50) with no open PR to canonical → warn "long-lived divergent branch; land it or use per-WI worktrees off canonical."
2. If a **pipeline-read config file** (registry of `path → consumed-from-ref`, e.g. `new-devops-platform/scripts/bb-gh-sync-config.yaml → main`) is modified on a branch other than the consumed-from ref → warn "this config is read from `<ref>`; edits here are a no-op until merged."

### C. (Optional) primary-on-canonical nudge

At session start, if the primary checkout of a registered repo is on a non-canonical branch, note it once (advisory). Encourages per-WI worktrees off canonical + primary tracking canonical.

## Blast radius / risk

- A is a PreToolUse hook on `Read`/`Grep`/`Bash` — a hot path. Must be fast (one `git rev-parse`), cached per-repo-per-session, and strictly fail-open/advisory (a read guard that blocks reads would be intolerable). Plan-changeset + careful testing required.
- B/C are advisory log lines in routing/closeout — low risk, but still touch hot-path scripts → plan-changeset.
- All three are **advisory only** — no blocking. The goal is to surface the mismatch at the moment of the mistake, not to gate.

## Alternatives considered

- **Rule-only (status quo):** already exists; was violated this session. Insufficient alone.
- **Force primary checkouts onto canonical:** unsafe — these are multi-session shared worktrees with other sessions' uncommitted work (see `commit-on-scaffold` rule). Advisory + worktree discipline is the safe path.
- **Block reads off-canonical:** rejected — too disruptive; reading feature-branch code is legitimate.

## Acceptance

- A: on a repo parked off-canonical, a `Read` of a tracked file emits exactly one advisory naming the canonical ref + the `git show origin/<ref>:` form; on-canonical or unknown → silent.
- B: editing `bb-gh-sync-config.yaml` on a non-`main` branch emits the no-op-until-merged warning; a 316-ahead branch with no PR emits the divergence warning.
- Both fail-open and add < 50ms to the hot path.
