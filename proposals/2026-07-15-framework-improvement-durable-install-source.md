# Framework improvement: durable installed enforcement source

**Status:** DRAFT
accepted_wi: WI-487
**Date:** 2026-07-15
**Source:** installed Codex hook/skill oscillation observed during WI-486 diagnosis; Fable 5 high-effort review
**Candidate severity:** critical
**Severity:** critical
**Plan-changeset class:** hot-path

## Gap

Framework setup can leave host hooks or skills symlinked to an ephemeral source that later disappears. When the enforcement executable becomes dangling, the host can silently stop enforcing a previously active guard. Installed safety behavior therefore depends on the lifetime of an unrelated temporary directory.

This proposal covers one gap only: **installed enforcement must have a durable, observable source and must not silently fail open when that source disappears**.

The all-host migration is the repair mechanism for that installation lifecycle, and actionable/deduplicated denial is how the lifecycle remains observable. Legacy WI-state transformation is owned by WI-486; WI-487 may invoke that compatibility contract but may not invent a second graph migrator.

## Evidence

- `~/.codex/hooks.json` referenced installed commands under `~/.codex/skills/hooks`.
- That path resolved through symlinks into a deleted `/tmp/claude-1000/.../scratchpad/fw-wt/hooks` source.
- The same guard first emitted `ambiguous active tasks` and later stopped executing after its target vanished, without a clear blocking installation error.
- Several installed skills shared the ephemeral source pattern.
- The current Codex run repeatedly displayed only `PreToolUse hook (failed)` and `hook exited with code 1`, omitting hook identity, denial reason, affected operation, and recovery. The same opaque message was emitted many times.
- A different machine with older framework/work-item state entered a loop instead of performing one bounded compatibility migration.
- The intake Tier-1 run found missing `concerns`/scanner and `_shared` infrastructure across seven configured installs (Antigravity, Codex, Cursor, Gemini, Kimi, Mimo-Code, and OpenCode); Claude resolved to the durable main checkout rather than the intake worktree. This is a concrete mixed-host migration fixture.
- `setup`, `hooks/svc-session-start-healthcheck.mjs`, and existing tier-1 canonicalization/self-heal validators already attempt to protect worktree installations. The regression must identify the uncovered install path or repair failure instead of adding a duplicate superficial check.

## Relationship to existing controls

This extends the existing setup canonical-source resolution, install-drift checks, and session-start self-heal. It is distinguished from WI-485: WI-485 verifies Codex hook authority when the hook executes; WI-487 guarantees the installed hook and skill source remains executable and that loss of enforcement is visible.

Any host/model labels in install receipts resolve through `references/model-routing.md`; no live model capability is assumed by the installation fixture.

## Proposed change boundary

Likely implementation surfaces after planning:

- `setup`
- `scripts/check-install-drift.sh`
- `hooks/svc-session-start-healthcheck.mjs`
- host install manifests or install-state receipts under `provision/`
- a versioned, all-host first-run migration invoked by setup/session healthcheck
- focused fixtures under `test-framework/evals/tier-1/`, including the existing canonical-resolution and double-dead-pointer suites

### Tier-1 promotion note

- `validator_path`: extend `test-framework/evals/tier-1/validate-setup-worktree-canonical-resolution.sh` and `test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh`; do not add a third overlapping validator unless diagnosis proves a distinct failure class.
- `failure_class`: ephemeral or dangling installed hook/skill source silently removes enforcement.
- `promotion_signal`: installation and hook execution are framework hot paths under signal 3 of `rules/tier-1-promotion.md`, and the observed failure disabled a critical mutation guard.
- `expected_runtime_budget`: under 5 seconds, hermetic, with no network or model invocation.
- `why_tier_2_or_targeted_is_insufficient`: the regression can be detected deterministically from filesystem and setup state and must block before host installation ships.

## Acceptance criteria

- **AC-487-1:** Setup refuses an ephemeral source such as `/tmp`, or materializes/repoints it to a verified durable canonical checkout before installing hooks or skills.
- **AC-487-2:** A dangling or non-executable installed enforcement command produces a visible fail-closed diagnostic for governed mutation; it never silently converts deny behavior into allow behavior.
- **AC-487-3:** Setup or healthcheck detects existing ephemeral/dangling installs and deterministically repairs them or reports an actionable hard failure.
- **AC-487-4:** Canonical worktree installs still resolve to the durable repository source without breaking legitimate `.worktrees/` development.
- **AC-487-5:** Repair covers hooks and skills as one installed surface and records the effective resolved source used by the host.
- **AC-487-6:** Repeated setup/repair is idempotent and does not overwrite unrelated user host configuration.
- **AC-487-7:** Every blocking hook result emits a stable hook identifier, machine-readable reason code, human-readable cause, affected operation, and exact recovery command/action; an anonymous nonzero exit is a test failure.
- **AC-487-7A:** For hosts that truncate or swallow hook stderr, the hook writes the same diagnostic to a durable per-session receipt/log and the shortest host-visible message includes its reason code and lookup path; host-specific fixtures prove the effective surface.
- **AC-487-8:** Repeated identical failures for the same session, hook, reason, and state digest are deduplicated or rate-limited after the first actionable denial, without converting the denial into permission.
- **AC-487-9:** The first run after upgrade dynamically inventories and migrates every host declared by `provision/hosts/` (currently Claude, Codex, Gemini, Kimi, OpenCode, Antigravity, Cursor, and Mimo-Code), rather than repairing only the active host or relying on a hard-coded subset.
- **AC-487-10:** Migration is versioned, transactional, bounded, resumable after interruption, and idempotent; it preserves unrelated host configuration and user work and emits one per-host before/after report.
- **AC-487-11:** Old hooks, skills, install receipts, and supported legacy WI state are aligned in one first-run orchestration pass; WI transformation delegates to WI-486's compatibility contract. Until that contract is available, unsupported WI state ends in an actionable fail-closed terminal state rather than being retried.
- **AC-487-12:** A migration or hook failure has a hard retry ceiling and fail-closed terminal recovery state for governed mutations, so unchanged bad state cannot produce an infinite first-run, PreToolUse, or Stop loop.

## Negative tests

- Install from `/tmp` and then delete the source.
- Double-dead symlink pointer and non-executable target.
- Durable source moved while host config remains present.
- Partial installation where hooks resolve but skills do not, and the inverse.
- Repeated repair with unrelated host configuration entries.
- Canonical repository worktree source versus an unregistered scratch directory that only resembles a worktree.
- An all-host fixture containing a mix of current, stale, dangling, ephemeral, missing, and user-owned configuration entries.
- Anonymous stderr, empty stderr, duplicate identical denials, and two distinct denials that must remain distinguishable.
- Interrupted migration resumed on the next run, and a third run proving byte-identical no-op behavior.
- A legacy-machine fixture combining old install receipts, old hook layout, and unsupported work-item state with a strict bounded-invocation assertion.

## Route

**Lane:** framework
Severity: critical — a safety control that disappears silently is a fail-open enforcement defect.
**Plan class:** full mandatory chain; setup, host configuration, and safety-hook behavior require migration and rollback proof.
**Coordination:** the durable install and diagnostic portions may land independently, but full legacy-state migration verification depends on WI-486's compatibility contract; the coordinated release must expose one first-run migration entrypoint.
**Sequence:** diagnose-bug → write-spec → plan-changeset → adversarial review → execute-changeset → review-exec → audit-implementation → land-changeset → verify-promotion.

## Rollback and replay proof

The plan must preserve the last known durable installation until the replacement passes executable/source checks. Replay must start from the observed dangling Codex configuration and a mixed legacy all-host installation, run the versioned migration, delete the original ephemeral path, and prove hooks and skills still resolve from recorded durable sources. A deliberately broken target must yield one actionable, deduplicated denial rather than silent allowance or an anonymous code-1 storm. Interrupted and repeated first runs must converge to the same state without looping.
