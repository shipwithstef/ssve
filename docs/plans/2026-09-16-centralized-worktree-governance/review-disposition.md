# Review Disposition: Centralized External Worktree Governance

> **Work Item:** `WI-FW-CENTRALIZED-WORKTREE-01`  
> **Date:** 2026-09-16  
> **Reviewers:** Astra / Codex Sol High (`codex-sol-high`), Grok xhigh (`grok-high`), Cursor CLI (`cursor-auto-receipt`), and Antigravity Self-Review

---

## 1. Executive Summary

Three independent adversarial/advisory reviewers (OpenAI Sol/Astra, xAI Grok 4.6, and Cursor Auto) evaluated the plan manifest. All three converged on the exact same core architectural and mechanical findings. Every finding has been accepted and incorporated into the updated plan.

---

## 2. Review Findings & Dispositions Matrix

| Finding ID | Source | Topic | Severity | Disposition | Action Taken |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-001** | Astra, Grok, Cursor | Mode & Contract Blueprint | Critical / High | **ACCEPTED** | Declared `mode: inline`, added `planning_contract`, `implementation_approach`, and `executor_discretion` sections with complete interface specifications. |
| **F-002** | Astra, Grok, Cursor | AC Traceability & Lane Compliance | High | **ACCEPTED** | Replaced generic descriptions with stable numbered acceptance criteria (`AC-1` through `AC-8`), lane compliance table, and AC-to-task-to-validation matrix. |
| **F-003** | Astra, Grok, Cursor | Malformed Policy Fail-Closed Semantics | High | **ACCEPTED** | Explicitly distinguished absent policy (defaults to `~/worktrees/{repo}`) from present-but-malformed/corrupted/tampered policy (must **FAIL CLOSED** with `WORKTREE_POLICY_INVALID`). |
| **F-004** | Astra, Grok, Cursor | `## External State` Mechanical Compliance | High | **ACCEPTED** | Formatted exact `## External State` heading, added coupling table, live probe commands, and untouched taxonomy walk. |
| **F-005** | Astra, Grok, Cursor | Behavioral & Source-Level Proofs | High | **ACCEPTED** | Added hermetic unit tests for policy, setup initialization, and hook detection rather than relying solely on installed drift checks. |
| **F-006** | Astra, Grok, Cursor | Commit-Scoped Rollback & Migration Precedence | High | **ACCEPTED** | Added commit-scoped revert sequence, external-state cleanup rules, and defined precedence for mixed legacy and centralized roots. |
| **F-007** | Astra, Grok, Cursor | Path Identity, Collision & Concurrency | High | **ACCEPTED** | Formalized derived path formula `~/worktrees/{repo-name}/{leaf}`, project-specific root overrides for collision avoidance, and leaf-only pruning. |
| **F-008** | Grok | Doctrine Sync (`AGENTS.md` & `FRAMEWORK-STATE.md`) | Medium | **ACCEPTED** | Added `AGENTS.md` §7 and `FRAMEWORK-STATE.md` to Files Planned (task-5-docs) to prevent doctrine forking. |

---

## 3. Dispositions in Detail

### F-001: Mode & Contract Blueprint (Inline v5)
* **Finding:** Missing mode declaration and v5 planning sections left consequential interfaces (functions, shapes, errors) open to executor discretion.
* **Disposition:** Declared `mode: inline`. Sealed exported API contracts for `hooks/lib/worktree-policy.mjs`, `scripts/lib/resolve-worktree-root.mjs`, `hooks/lib/literal-branch.mjs`, and `scripts/svc-ensure-worktree.mjs`.

### F-002 & F-003: Acceptance Criteria & Lane Compliance
* **Finding:** Feature spec path pointed to `project-state.md` without numbered ACs, and lane compliance artifacts were unlisted.
* **Disposition:** Defined explicit requirements `AC-1` through `AC-8`. Documented framework-lane compliance and mapped each AC to its implementing task and automated verification command.

### F-004: Fail-Closed Policy Security
* **Finding:** Treating missing and malformed policy identically as graceful default-to-standard-layout fails open against tampering or corrupted config.
* **Disposition:** Policy engine strictly distinguishes:
  1. **Absent:** Allowed, falls back to `~/worktrees/{repo-name}`.
  2. **Corrupted / Invalid JSON / Schema failure / Unsafe mode / Symlink:** Refused, fails closed with `WORKTREE_POLICY_INVALID`.

### F-005: External State Coupling & Taxonomy Walk
* **Finding:** Heading did not match `## External State`, and coupling table / taxonomy walk were missing.
* **Disposition:** Implemented exact `## External State` section with complete coupling table, probe commands (`stat -c "%a %u %g"`), and untouched taxonomy list.

### F-008: Doctrine Sync with `AGENTS.md`
* **Finding:** Updating `WORKTREES.md` without updating `AGENTS.md` §7 Rule 1 creates a contradictory doctrine fork.
* **Disposition:** Included `AGENTS.md` in task-5-docs to synchronize the rule text across both doctrine documents.
