# Implementation Plan — 2026-05-26-gitignore-hygiene

**Spec Reference:** [proposals/2026-05-25-evolution.md](file:///workspace/seriousvibecoding/proposals/2026-05-25-evolution.md)
**Branch Name:** `feature/gitignore-hygiene`
**Status:** SIMULATED
**Base Branch:** `main` (current HEAD: `ec7bf3ffbc862840b303851e1c80b84e4bb6918f`)
**Created At:** 2026-05-26T04:45:00Z

---

## 1. Implementation Summary

This change automates the provisioning, validation, and maintenance of `.gitignore` patterns in Serious Vibe Coding downstream projects. Downstream repos initialized or converted to `svc` will automatically receive the correct set of framework ignores (like `.worktrees/`, `.svc/*.log`, review config files, local locks, etc.) within a comment envelope block. This prevents constant untracked workspace clutter and blocks accidental commits of session-private logs.

### Invariants
* Existing custom user/developer ignores outside the boundary comments MUST be fully preserved.
* The script `init-project-state.mjs` must remain safe, idempotent, and non-destructive.
* The validator `validate-worktree-safety.sh` must remain fast (<10ms execution overhead) and completely precise.

---

## 2. Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| [templates/.gitignore.template](file:///workspace/seriousvibecoding/templates/.gitignore.template) | `CREATE` | `task-1-templates` | Canonical Serious Vibe Coding ignore pattern set. |
| [scripts/init-project-state.mjs](file:///workspace/seriousvibecoding/scripts/init-project-state.mjs) | `MODIFY` | `task-2-init-script` | Load root template, idempotently parse and merge block. |
| [test-framework/evals/tier-1/validate-worktree-safety.sh](file:///workspace/seriousvibecoding/test-framework/evals/tier-1/validate-worktree-safety.sh) | `MODIFY` | `task-3-validator` | Assert presence of envelope and core ignores, print recovery command. |
| [onboard-repo/SKILL.md](file:///workspace/seriousvibecoding/onboard-repo/SKILL.md) | `MODIFY` | `task-4-onboarding-doc` | Append `.gitignore` verification to the core onboarding checklist. |

---

## 3. Task Graph

### `task-1-templates` (Prerequisites: None)
* **Description:** Create `templates/.gitignore.template` at the framework source root with all 18 transient and metadata ignore patterns listed in the baselined spec.
* **AC Coverage:** P0-F1 (Template creation).
* **Validation:** Verify file exists and is populated.
* **Checkpoint:** `checkpoint-1-templates`

### `task-2-init-script` (Prerequisites: `task-1-templates`)
* **Description:** Add logic in `scripts/init-project-state.mjs` to read from the root `templates/.gitignore.template` and idempotently merge the block into the target `.gitignore`. Correctly handle the 3 starting states (A: no file, B: file exists without envelope, C: file exists with envelope).
* **AC Coverage:** P0-F2 (Idempotent merge).
* **Validation:** Run manual dry-run scripts on temporary mock directories testing all 3 transition states.
* **Checkpoint:** `checkpoint-2-init-script`

### `task-3-validator` (Prerequisites: `task-2-init-script`)
* **Description:** Extend `test-framework/evals/tier-1/validate-worktree-safety.sh` to search for `# === BEGIN SERIOUS VIBE CODING IGNORES ===` and assert that core patterns are ignored. If missing, fail with exit code 1 and print recovery command `node scripts/init-project-state.mjs`.
* **AC Coverage:** P1-F3 (Actionable validator checks).
* **Validation:** Execute `bash test-framework/evals/tier-1/validate-worktree-safety.sh` on clean and dirty mock states.
* **Checkpoint:** `checkpoint-3-validator`

### `task-4-onboarding-doc` (Prerequisites: `task-3-validator`)
* **Description:** Add `.gitignore` provisioning validation to the onboard-repo conversion checklist in `onboard-repo/SKILL.md`.
* **AC Coverage:** P2-F4 (Onboarding checklist step).
* **Validation:** Verify markdown rendering and checklist presence.
* **Checkpoint:** `checkpoint-4-onboarding-doc`

---

## 4. AC-to-Task Mapping

| AC | Description | Task |
|----|-------------|------|
| P0-F1 | Create canonical ignore template | `task-1-templates` |
| P0-F2 | Teach init script idempotent envelope updating | `task-2-init-script` |
| P1-F3 | Expand tier-1 validator with recovery help | `task-3-validator` |
| P2-F4 | Onboarding integration check | `task-4-onboarding-doc` |

---

## 5. AC-to-Test Mapping

| AC | Test Type | Execution / Verification |
|----|-----------|------------------------|
| P0-F1 | Static | Verify `templates/.gitignore.template` matches spec exactly. |
| P0-F2 | Integration | Script runs on mock folders, checking States A, B, and C round-trips. |
| P1-F3 | Unit | Run validator on clean vs modified `.gitignore` files, checking outputs. |
| P2-F4 | Static | Verify `onboard-repo/SKILL.md` checklist updates. |

---

## 6. External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Local Workspace Config | Project-local root `.gitignore` | coupled | `test-framework/evals/tier-1/validate-worktree-safety.sh` checks `.gitignore` matches canonical template on every tier-1 run. |

*Untouched environments (walked the 15-environment taxonomy, found no other external states):* 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15

---

## 7. Simulation Report

| Task | Check | Result | Action |
|------|-------|--------|--------|
| `task-1-templates` | `templates/.gitignore.template` does not exist | PASS (CREATE) | Safe to create. |
| `task-2-init-script` | `scripts/init-project-state.mjs` exists | PASS (MODIFY) | Exports/methods ready for addition. |
| `task-3-validator` | `test-framework/evals/tier-1/validate-worktree-safety.sh` exists | PASS (MODIFY) | Shell code ready for extension. |
| `task-4-onboarding-doc` | `onboard-repo/SKILL.md` exists | PASS (MODIFY) | Ready for checklist update. |

---

## 8. Checkpoint Plan

1. `checkpoint-1-templates`: `templates/.gitignore.template` populated and committed.
2. `checkpoint-2-init-script`: Idempotent script updates written and verified against mock targets.
3. `checkpoint-3-validator`: Tier-1 safety check extended and verifying clean/dirty mock states.
4. `checkpoint-4-onboarding-doc`: Onboarding docs updated, all tier-1 checks green.

---

## 9. Promotion Readiness Checklist

* [ ] All 4 planned files accounted for with no extra modifications.
* [ ] Task-level validation commands verify real correctness.
* [ ] No banned scope-reduction phrases in task descriptions.
* [ ] Git worktree clean before promo, branch pushed to origin.
* [ ] Post-merge tier-1 verification green.
