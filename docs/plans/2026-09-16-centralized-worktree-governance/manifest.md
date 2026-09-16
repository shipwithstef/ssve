# Implementation Manifest — WI-FW-CENTRALIZED-WORKTREE-01: Centralized External Worktree Governance

- **Feature Spec Path:** docs/specs/project-state.md
- **Branch Name:** `feature-centralized-worktree-governance`
- **Status:** APPROVED_FOR_EXECUTION
- **Base Branch:** `main`
- **Created:** 2026-09-16T07:22:00Z

---

## 1. Implementation Summary

This changeset implements **Centralized External Worktree Governance** within the Serious Serious Vibe Engineering (SSVE) framework to decouple git worktree storage from the repository filesystem tree, eliminate project bloat (e.g., Capacitor mobile builds and dependencies inside worktrees), and retire brittle workarounds.

Key changes include:
1. **Central Policy Schema & Engine:**
   - Authoritative schema defined at `schemas/worktree-policy.schema.json`.
   - Core resolver at `hooks/lib/worktree-policy.mjs` providing policy loading, root resolution, and approved roots.
   - CLI helper `scripts/lib/resolve-worktree-root.mjs` for bash integration.
2. **Hook Security & Ancestry Containment:**
   - Updated `hooks/lib/literal-branch.mjs` to dynamically whitelist policy-approved roots while maintaining strict UID and symlink checks.
   - Updated `scripts/svc-ensure-worktree.mjs` to dynamically pass containment anchor through worktree creation, fresh setup, and forward completion, eliminating false-positive ancestor checks.
3. **CLI Worktree Tooling:**
   - Modernized `scripts/worktree.sh` to dynamically resolve the worktree directory and seamlessly handle both external centralized paths and legacy in-repo paths.
4. **Framework Installer (`setup`):**
   - Initializes external worktree root with strict user-only permissions.
   - Initializes default policy settings if missing.
   - Guards against executing the installer within linked worktrees.
5. **Testing & Verification:**
   - Added `test-framework/tests/worktree-policy.test.mjs` with 5 automated unit tests.
   - Updated `test-framework/evals/tier-1/validate-literal-branch-worktree.sh` assertion to support external worktree roots.

---

## 2. Files Planned

| File | Action | Task | Purpose |
| :--- | :--- | :--- | :--- |
| `schemas/worktree-policy.schema.json` | CREATE | task-1-policy | JSON schema for external worktree policy. |
| `hooks/lib/worktree-policy.mjs` | CREATE | task-1-policy | Core policy loader and path resolution library. |
| `scripts/lib/resolve-worktree-root.mjs` | CREATE | task-1-policy | CLI helper for bash scripts. |
| `hooks/lib/literal-branch.mjs` | MODIFY | task-2-security | Whitelist policy-approved roots dynamically. |
| `scripts/svc-ensure-worktree.mjs` | MODIFY | task-2-security | Containment anchor and ancestry chain repair. |
| `scripts/worktree.sh` | MODIFY | task-3-cli | Dynamic worktree path resolution and backward compatibility. |
| `setup` | MODIFY | task-4-setup | Installer initialization of external roots and default policy. |
| `WORKTREES.md` | MODIFY | task-5-docs | Framework doctrine update for centralized worktree governance. |
| `test-framework/tests/worktree-policy.test.mjs` | CREATE | task-6-tests | Unit tests for worktree policy and resolution. |
| `test-framework/evals/tier-1/validate-literal-branch-worktree.sh` | MODIFY | task-6-tests | Tier-1 eval updated for external worktree path formats. |
| `hooks/lib/durable-source.mjs` | MODIFY | task-7-hooks | Robust git-dir/git-common-dir worktree detection. |
| `hooks/lib/enforcement-core.mjs` | MODIFY | task-7-hooks | Broaden classifySource for worktrees directory segment. |
| `hooks/svc-pre-commit-multi-host-check.sh` | MODIFY | task-7-hooks | Accurate worktree detection in pre-commit hook. |
| `hooks/svc-session-start-healthcheck.mjs` | MODIFY | task-7-hooks | Accurate worktree detection in session-start healthcheck. |
| `scripts/check-install-drift.sh` | MODIFY | task-7-hooks | Accurate worktree detection in drift check. |

---

## 3. Task Graph

### task-1-policy
- **Touched Files:** `schemas/worktree-policy.schema.json`, `hooks/lib/worktree-policy.mjs`, `scripts/lib/resolve-worktree-root.mjs`
- **Dependencies:** None
- **AC Coverage:** Schema validates, policy loads defaults or custom overrides, paths resolve correctly.
- **Validation Command:** `node --test test-framework/tests/worktree-policy.test.mjs`

### task-2-security
- **Touched Files:** `hooks/lib/literal-branch.mjs`, `scripts/svc-ensure-worktree.mjs`
- **Dependencies:** task-1-policy
- **AC Coverage:** Dynamic root approval, containment anchor alignment in creation and resume.
- **Validation Command:** `bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh`

### task-3-cli
- **Touched Files:** `scripts/worktree.sh`
- **Dependencies:** task-1-policy
- **AC Coverage:** Command list, enter, remove, create work across centralized and legacy roots.
- **Validation Command:** `bash scripts/worktree.sh list`

### task-4-setup
- **Touched Files:** `setup`
- **Dependencies:** task-1-policy
- **AC Coverage:** Initializes worktrees directory and default policy; guards against linked worktree execution.
- **Validation Command:** `bash scripts/check-install-drift.sh --all-hosts`

### task-5-docs
- **Touched Files:** `WORKTREES.md`
- **Dependencies:** None
- **AC Coverage:** Rule 1 and operational docs updated.
- **Validation Command:** `git diff WORKTREES.md`

### task-6-tests
- **Touched Files:** `test-framework/tests/worktree-policy.test.mjs`, `test-framework/evals/tier-1/validate-literal-branch-worktree.sh`
- **Dependencies:** task-1-policy, task-2-security
- **AC Coverage:** 100% passing tests across unit and tier-1 suites.
- **Validation Command:** `node --test test-framework/tests/worktree-policy.test.mjs && bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh`

### task-7-hooks
- **Touched Files:** `hooks/lib/durable-source.mjs`, `hooks/lib/enforcement-core.mjs`, `hooks/svc-pre-commit-multi-host-check.sh`, `hooks/svc-session-start-healthcheck.mjs`, `scripts/check-install-drift.sh`
- **Dependencies:** task-2-security
- **AC Coverage:** Eliminate hardcoded /.worktrees/ patterns across all hooks and drift checkers using git rev-parse.
- **Validation Command:** `bash scripts/check-install-drift.sh --all-hosts`

---

## Execution Command Sequence

```bash
# 1. Run unit test suite
node --test test-framework/tests/worktree-policy.test.mjs

# 2. Run literal-branch worktree tier-1 validation
bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh

# 3. Run worktree safety tier-1 validation
bash test-framework/evals/tier-1/validate-worktree-safety.sh
```

---

## Prerequisite Alignment Matrix

| Task | Technical Design | Security Contract | Multi-Host Parity |
| :--- | :--- | :--- | :--- |
| task-1-policy | Central policy engine | Strict schema v1 | Universal node resolver |
| task-2-security | Containment anchor repair | Same-UID no-symlink check | Codex/Claude/Antigravity hooks |
| task-3-cli | CLI wrapper modernization | Safe directory traversal | Bash portable execution |
| task-4-setup | Installer initialization | 0700 base permissions | All 9 provisioned hosts |
| task-5-docs | Doctrine alignment | Unambiguous rule definition | Shared reference docs |
| task-6-tests | Tier-1 integration evals | Automated denial verification | Regression guard |

---

## 4. External State Lifecycle & Verification

- **Config File:** User policy located at ~/.svc/worktree-policy.json (mode 0600).
- **Directory Root:** Base external directory at ~/worktrees (mode 0700).
- **Security Invariants:** Single-UID ownership required. No symlinks allowed in ancestor chain.
- **Rollback Safety:** If policy is absent or unparseable, resolver defaults gracefully to standard layout.
