# WI-486 diagnosis: session-isolated bootstrap and bounded compatibility

**Work item:** WI-486  
**Status:** diagnosed  
**Date:** 2026-07-15  
**Baseline:** promoted `origin/main` at `4d230174c0e1bda200c6bb820f18fbe88cc97aac`; Tier 1 passed 244 scripts, failed 0, timed out 0  
**Scope boundary:** session authority, isolated bootstrap, and task-state compatibility only. Durable all-host installation and hook-failure deduplication remain WI-487.

## Symptom

A new session cannot safely start a WI when a neutral checkout contains multiple foreign live graphs. Codex denies even read-only commands as ambiguous, the supported worktree helper rejects unrelated checkout residue, and malformed legacy state can hard-block Stop indefinitely.

## Reproduction

| ID | Fixture | Observed current behavior | Required behavior |
|---|---|---|---|
| R1 | Neutral branch with live `WI-901` and `WI-902` graphs; Codex payload is `git status --short` | PreToolUse returns `permissionDecision=deny`, reason `ambiguous active tasks` | Allow the read; foreign graph discovery must not grant or deny mutation authority |
| R2 | Default checkout has one tracked modification and one untracked file; target branch/worktree does not exist | `svc-ensure-worktree` exits 2: `default checkout is dirty` before creating the target | Create the isolated target while preserving both residue files byte-for-byte |
| R3 | Legacy checkout has one malformed `lane-tasks-WI-904.json`; identical Stop payload repeated five times with cap 3 | Attempts 1–5 all return `decision=block`; zero pressure-counter files are created | Return one bounded, actionable compatibility result keyed by session plus state digest; unchanged state cannot create an unbounded loop |
| R4 | Static inspection of `svc-ensure-worktree.mjs` | It creates a worktree, claim, and binding but never creates or verifies the target task graph as part of the transaction | Bootstrap graph, claim, binding, and worktree as one exclusive operation or roll back every newly created artifact |

## Root cause

### RC1 — graph discovery is incorrectly used as authority

`hooks/codex/lib/codex-hook-context.mjs:236-270` scans every non-completed graph when `SVC_CODEX_TASK_GRAPH` is unset. It selects by branch only after collecting every in-progress task and returns `ambiguous active tasks` when more than one remains. It does not validate the current session's worktree binding first.

`hooks/codex/svc-codex-skill-load-enforcer.mjs:24-27` calls that resolver and denies ambiguity before `isReadOnlyTool` runs. Therefore unrelated foreign work can deny a read even though it cannot authorize a mutation.

### RC2 — the explicit override is a path existence hint, not authority proof

`laneGraphs()` accepts an existing in-repository `SVC_CODEX_TASK_GRAPH` path without proving that its WI, absolute worktree, branch, claim generation, and session binding agree. Receipt checks happen later, after the graph has already selected the governed task. An unset or forged override therefore lacks one fail-closed validation boundary.

### RC3 — bootstrap is split and over-constrained

`scripts/svc-ensure-worktree.mjs:123-168` holds a repository lock and can roll back a newly created worktree when binding fails, but:

- `assertCleanDefault()` rejects every tracked or untracked default-checkout change, including unrelated residue;
- the transaction does not create or validate `.svc/lane-tasks-<WI>.json`;
- ownership is stored inside the new worktree, but no same-WI scan under the lock prevents a second session from creating the same WI in another branch/worktree;
- resumption checks only the requesting session's binding and the first live binding owner, not one complete graph/claim/binding tuple.

The helper can therefore be both unreachable for safe isolated work and incomplete as an atomic bootstrap primitive.

### RC4 — Claude and Codex have separate ownership implementations

Claude's embedded Stop preflight in `hooks/svc-task-completion-guard.sh:255-375` validates a binding and claim before reading the exact bound graph. Codex uses the repository-wide `activeTask()` path instead. The Claude path then falls back to repository-wide legacy graph aggregation when no bindings directory exists. Host parity is accidental rather than enforced by one shared resolver.

### RC5 — malformed compatibility state bypasses the only loop cap

The Stop guard counter key is repository/session/worktree/WI only (`hooks/svc-task-completion-guard.sh:915-946`) and omits a state digest. More importantly, the cap applies only to pressure statuses; `invalid_input` and `invalid_graph` are deliberately uncapped (`:955-963`, `:1012-1024`). A malformed or unsupported legacy graph therefore emits the same hard block forever, while a changed graph can incorrectly inherit a stale pressure count.

## Fix boundary

1. Add one shared session-task authority module used by Codex and Claude. It must validate the exact session, absolute worktree, repository, branch, WI, claim owner/generation, and graph path before returning mutation authority.
2. Classify provably read-only operations before mutation-authority resolution. Ambiguous or foreign graph inventory remains diagnostic only.
3. Treat `SVC_CODEX_TASK_GRAPH` as a consistency assertion against the validated binding, never as standalone authority.
4. Extend the canonical bootstrap helper into one repository/WI-locked transaction. It must create or validate the isolated worktree, initial graph, claim, and binding; detect any live same-WI owner across worktrees; and roll back only artifacts created by the failed attempt.
5. Remove whole-checkout cleanliness as a prerequisite. Snapshot and compare default-checkout residue in fixtures; deny only branch/worktree/WI target conflicts.
6. Add a versioned task-state inspector that returns `supported`, `lossless-read-only`, or `quarantine-recommended` without granting authority.
7. Add a separate explicit migration command with authorization, before-state backup, before/after digests, and a receipt. Fresh foreign state is ineligible.
8. Key Stop/PreTool compatibility outcomes by repository, session, worktree, and state digest. The first unchanged unsupported result is actionable; repeats are advisory/allow. A changed digest starts one new bounded diagnosis.
9. Preserve WI-485: after bootstrap, arbitrary governed mutation still requires the exact current task/skill receipt.

## Proof plan

- Add fixture-controlled tests for two foreign graphs, safe reads, denied unbound mutation, exact bound graph selection, forged overrides, wrong worktrees, foreign receipts, and shell-chained mutations.
- Add clean and dirty-default bootstrap fixtures, byte digests for residue, same-WI concurrent bootstrap, partial-state replay, different-WI coexistence, and rollback assertions.
- Add Claude/Codex parity fixtures against the same authority vectors.
- Add supported, legacy, future-version, malformed, stale-contract, and fresh-foreign compatibility fixtures.
- Replay identical unsupported state beyond the configured cap, then mutate its bytes and prove exactly one new actionable result.
- Run task-graph, receipt, Markdown, JSONL, targeted Tier 1, full Tier 1, and `git diff --check` validation.

## Pillar revisit

| Pillar | Impact | Required proof |
|---|---|---|
| Product | Framework sessions can start independent work without taking over foreign work | Two-WI/session journey replay |
| UX | Losers and unsupported-state users receive one terminal, actionable recovery | Exact diagnostic assertions |
| Design | No visual surface | N/A |
| Frontend | No browser/client surface | N/A |
| Backend | Atomic filesystem/git state transaction | Race and rollback fixtures |
| Security | Session/worktree/WI authority and forged override rejection | `review-security` plus negative fixtures |
| Data | Versioned graph normalization, backups, digests, and receipts | Migration replay and byte preservation |
| Performance | Locks and compatibility checks must be bounded | Concurrent replay and no-loop assertions |

## Decision

The defect is confirmed and reproducible. It is not eligible for quick-fix handling: the correction changes hot-path authority, concurrent state creation, and compatibility semantics. Continue through `write-spec`, `design-tech`, and the full mandatory chain. No WI-487 installation or diagnostic-storm behavior is absorbed here.
