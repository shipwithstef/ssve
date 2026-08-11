# WI-FRAMEWORK-EVOLVE-REFINEMENT: Framework Refinement and Never Say "Fix If Needed" Guard

- **Feature Spec Path:** docs/specs/project-state.md (Framework Evolution)
- **Branch Name:** feature-framework-elevate
- **Status:** SIMULATED
- **Base Branch:** main
- **Base SHA:** 5703f422d0dbcecc7a84f5dbee847f52c99bd19d
- **Created:** 2026-05-21T12:36:24Z

## Implementation Summary

This plan addresses a refinement of the framework evolutions:
1. **Revert process.stdin.isTTY check:** Discard the defensive TTY check inside `hooks/svc-auto-capture-learnings.mjs` (Fix #4 in the previous changeset) to maintain exact compatibility with all session input pipes.
2. **Implement 'Never Say Fix If Needed' Guard:** Edit the commit message quality hook in `hooks/svc-workflow-guard.mjs` to block commit messages containing the ambiguous phrase "fix if needed" (or "fix if-needed").
3. **Formulate Steering Rule:** Add a companion rule `rules/common/neversay-fix-if-needed.md` documenting the engineering rationale and mechanical block of speculative conditional fixes.

### Invariants
- Pre-existing git hooks (commit-quality, branch guard, loop guard) must remain fully operational.
- Existing tier-1 validation suite must pass cleanly without regressions.

---

## Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| [hooks/svc-auto-capture-learnings.mjs](file:///workspace/seriousvibecoding/hooks/svc-auto-capture-learnings.mjs) | MODIFY | task-1-revert-tty | Revert isTTY tweak (Fix 4) |
| [hooks/svc-workflow-guard.mjs](file:///workspace/seriousvibecoding/hooks/svc-workflow-guard.mjs) | MODIFY | task-2-neversay-hook | Implement "fix if needed" check in git commit hook |
| [rules/common/neversay-fix-if-needed.md](file:///workspace/seriousvibecoding/rules/common/neversay-fix-if-needed.md) | CREATE | task-3-steering-rule | Document steering rule for "never say fix if needed" |

---

## Task Graph

### 1. `task-1-revert-tty`
- **Subject:** Revert process.stdin.isTTY tweak in auto-capture learnings hook
- **Touched Files:** `hooks/svc-auto-capture-learnings.mjs`
- **Dependencies:** None
- **AC Coverage:** AC-1 (Revert Fix 4)
- **Validation:** `git diff hooks/svc-auto-capture-learnings.mjs` (confirm removal of `isTTY` block)
- **Checkpoint:** `tty-reverted`

### 2. `task-2-neversay-hook`
- **Subject:** Implement commit message validation check for "fix if needed"
- **Touched Files:** `hooks/svc-workflow-guard.mjs`
- **Dependencies:** `task-1-revert-tty`
- **AC Coverage:** AC-2 ("never say fix if needed" mechanical check)
- **Validation:** `bash test-framework/evals/tier-1/validate-workflow-guard.sh`
- **Checkpoint:** `neversay-hook-active`

### 3. `task-3-steering-rule`
- **Subject:** Create steering rule docs for "never say fix if needed"
- **Touched Files:** `rules/common/neversay-fix-if-needed.md`
- **Dependencies:** `task-2-neversay-hook`
- **AC Coverage:** AC-3 (Steering rule documented)
- **Validation:** `test -f rules/common/neversay-fix-if-needed.md`
- **Checkpoint:** `steering-rule-added`

---

## AC-to-Task Mapping

| Acceptance Criterion | Task | Description |
|----------------------|------|-------------|
| AC-1: Revert Fix 4 | `task-1-revert-tty` | Revert `isTTY` check in auto-capture hook |
| AC-2: "never say fix if needed" check | `task-2-neversay-hook` | Enforce commit message block matching `\bfix\s+if[- ]needed\b` |
| AC-3: Steering rule documented | `task-3-steering-rule` | Steering rule document in `rules/common/` |

---

## AC-to-Test Mapping

| Acceptance Criterion | Test Type | Enforcing Test/Validation |
|----------------------|-----------|---------------------------|
| AC-1: Revert Fix 4 | Unit/Manual | Confirm via file diff |
| AC-2: "never say fix if needed" check | Unit | Added cases in workflow-guard tests |
| AC-3: Steering rule documented | Manual | File existence and linter checks |

---

## Validation Plan

### Task-level Validation
- `task-1-revert-tty`: `git diff hooks/svc-auto-capture-learnings.mjs`
- `task-2-neversay-hook`: `bash test-framework/evals/tier-1/validate-workflow-guard.sh`
- `task-3-steering-rule`: `node scripts/lint-skills-manifest.mjs`

### Final Branch Validation
- `bash test-framework/evals/run-all-evals.sh` (ensure full static suite passes cleanly)

---

## Checkpoint Plan

1. **`tty-reverted`**: `isTTY` code removed and staged.
2. **`neversay-hook-active`**: Commit-quality regex check added and validated against test fixtures.
3. **`steering-rule-added`**: Markdown steering rule created.

---

## Promotion Readiness Checklist

- [x] All planned files accounted for in manifest.
- [x] All tasks have specific validation commands.
- [x] All ACs mapped to implementation tasks.
- [x] All checkpoints named and expected order defined.
- [x] Final diff will only contain planned files.

---

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Hooks / git integration | Git hooks installed locally | Coupled | `scripts/wire-hooks.mjs` ensures hook alignment during setup |

Untouched environments: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15

---

## Simulation Report

| Task | Check | Result | Action |
|------|-------|--------|--------|
| `task-1-revert-tty` | `hooks/svc-auto-capture-learnings.mjs` exists | PASS | Proceed with revert |
| `task-2-neversay-hook` | `hooks/svc-workflow-guard.mjs` has commit checks | PASS | Edit `checkCommitQuality` |
| `task-3-steering-rule` | `rules/common/neversay-fix-if-needed.md` does not exist | PASS (CREATE) | Create new markdown file |

## Scenario Coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---------|----------|-------|-------|----------|
| J01 | Commit with vague/forbidden message | 3 | task-2-neversay-hook | 3/3 ✅ |
| J02 | Normal commit with Co-Author trailer | 2 | task-2-neversay-hook | 2/2 ✅ |
