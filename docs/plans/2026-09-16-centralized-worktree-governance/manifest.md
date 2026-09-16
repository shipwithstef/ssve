# Implementation Manifest — WI-FW-CENTRALIZED-WORKTREE-01: Centralized External Worktree Governance

- **Mode:** inline
- **Lane:** framework
- **Feature Spec Path:** FRAMEWORK-STATE.md
- **Branch Name:** `feature-centralized-worktree-governance`
- **Status:** READY_FOR_REVIEW
- **Base Branch:** `main`
- **Created:** 2026-09-16T07:22:00Z
- **Updated:** 2026-09-16T08:35:00Z

---

## 1. Upstream Lane Compliance

| Skill | Required | Status | Artifact / Decision Citation |
| :--- | :--- | :--- | :--- |
| `write-spec` | Mandatory | COMPLETE (INLINE) | Specification codified in §2 Acceptance Criteria & FRAMEWORK-STATE.md. |
| `design-tech` | Mandatory | COMPLETE (INLINE) | Technical architecture & API contracts codified in §3 Implementation Approach. |
| `review-security` | Mandatory | COMPLETE | Single-UID (`stat.uid === process.getuid()`), 0700/0600 permissions, and symlink ancestry checks verified. |
| `plan-changeset` | Mandatory | COMPLETE | This implementation manifest and accompanying review log. |

---

## 2. Acceptance Criteria

- **AC-1 (Path Formula & Namespace):** Derived worktree root formula is `~/worktrees/{repo-name}/{leaf}`, with 1:1 binding between Git branch and leaf directory. Per-project overrides supported via `projects.<repo-name>.root`.
- **AC-2 (Declarative Policy Schema):** Authoritative JSON schema defined at `schemas/worktree-policy.schema.json` validating `schema_version`, `default_root`, `naming_strategy`, `permissions`, and `projects`.
- **AC-3 (Fail-Closed Security):** An absent policy file defaults safely to `~/worktrees/{repo-name}` with mode 0700. A present-but-unreadable, invalid JSON, schema-failing, or insecurely-owned policy file must **FAIL CLOSED** with `WORKTREE_POLICY_INVALID` rather than falling back.
- **AC-4 (Dynamic Root Whitelisting):** `hooks/lib/literal-branch.mjs` dynamically approves policy roots, legacy in-repo roots, and project roots while strictly validating single-UID ownership (`stat.uid === process.getuid()`) and forbidding symlink traversal.
- **AC-5 (Containment Anchor Propagation):** `scripts/svc-ensure-worktree.mjs` parameterizes worktree creation, fresh setup, and forward completion with the dynamic `containmentAnchor` resolved from policy.
- **AC-6 (Leaf-Only Pruning):** `scripts/worktree.sh remove` removes strictly `~/worktrees/{repo-name}/{leaf}`. The parent directory `~/worktrees/{repo-name}` is preserved. Legacy `.worktrees/` pruned only when empty.
- **AC-7 (Installer Initialization):** `setup` initializes `~/worktrees` with `0700` and default policy with `0600` if missing; refuses execution inside linked worktrees.
- **AC-8 (Multi-Host Hook Detection Parity):** Broadens worktree-bound path detection across all hooks and drift checkers using `git rev-parse --git-dir != --git-common-dir` and `*"/worktrees/"*`.
- **AC-9 (Doctrine Synchronization):** Updates `WORKTREES.md` and `AGENTS.md` §7 Rule 1 without doctrinal contradictions.

---

## 3. Planning Contract & Implementation Approach (Inline Mode)

### Planning Contract
1. **Resolution API:**
   `resolveWorktreesRoot(repoRoot, env)` returns canonical path `~/worktrees/{repo-name}`.
   `resolveApprovedRoots(repoRoot, env)` returns `[centralRoot, baseRoot, legacyInRepo, projectOverrides, envOverrides]`.
2. **Policy Loading API:**
   `loadWorktreePolicy(env)` loads user policy. If missing, returns safe default. If corrupted/invalid, throws error with `reason_code: "WORKTREE_POLICY_INVALID"`.
3. **CLI Adapter Contract:**
   `node scripts/lib/resolve-worktree-root.mjs --repo <path> [--ensure]` outputs the resolved worktree root on stdout (exit 0) or error on stderr (exit 1).

### Implementation Approach
- Core policy engine: `hooks/lib/worktree-policy.mjs`.
- Security bridge: `hooks/lib/literal-branch.mjs` delegates `approvedWorktreeRoots()` to `resolveApprovedRoots()`.
- Ensure script: `scripts/svc-ensure-worktree.mjs` passes `containmentAnchor` to avoid out-of-root false positives.
- Tooling wrapper: `scripts/worktree.sh` queries `resolve-worktree-root.mjs` and supports leaf-only removal.
- Multi-host hook hardening: `hooks/svc-pre-commit-multi-host-check.sh`, `scripts/check-install-drift.sh`, `hooks/svc-session-start-healthcheck.mjs`, `hooks/lib/enforcement-core.mjs`, `hooks/lib/durable-source.mjs`.

---

## 4. Executor Discretion

The executor is granted discretion to:
1. Create `~/worktrees` with permissions `0700` (`rwx------`).
2. Create user policy file with permissions `0600` (`rw-------`).
3. Add unit tests under `test-framework/tests/` to verify edge cases.
4. No other modifications outside the declared `Files Planned` are permitted.

---

## 5. Files Planned & Task Graph

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
| `AGENTS.md` | MODIFY | task-5-docs | Harmonize §7 Rule 1 doctrine with centralized worktrees. |
| `test-framework/tests/worktree-policy.test.mjs` | CREATE | task-6-tests | Unit tests for worktree policy and resolution. |
| `test-framework/evals/tier-1/validate-literal-branch-worktree.sh` | MODIFY | task-6-tests | Tier-1 eval updated for external worktree path formats. |
| `hooks/lib/durable-source.mjs` | MODIFY | task-7-hooks | Robust git-dir/git-common-dir worktree detection. |
| `hooks/lib/enforcement-core.mjs` | MODIFY | task-7-hooks | Broaden classifySource for worktrees directory segment. |
| `hooks/svc-pre-commit-multi-host-check.sh` | MODIFY | task-7-hooks | Accurate worktree detection in pre-commit hook. |
| `hooks/svc-session-start-healthcheck.mjs` | MODIFY | task-7-hooks | Accurate worktree detection in session-start healthcheck. |
| `scripts/check-install-drift.sh` | MODIFY | task-7-hooks | Accurate worktree detection in drift check. |

### Task 1: Policy Engine (`task-1-policy`)
- **Touched Files:** `schemas/worktree-policy.schema.json`, `hooks/lib/worktree-policy.mjs`, `scripts/lib/resolve-worktree-root.mjs`
- **Dependencies:** None
- **AC Coverage:** AC-1, AC-2, AC-3
- **Validation Command:** `node --test test-framework/tests/worktree-policy.test.mjs`

### Task 2: Security & Containment (`task-2-security`)
- **Touched Files:** `hooks/lib/literal-branch.mjs`, `scripts/svc-ensure-worktree.mjs`
- **Dependencies:** task-1-policy
- **AC Coverage:** AC-4, AC-5
- **Validation Command:** `bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh`

### Task 3: CLI Modernization (`task-3-cli`)
- **Touched Files:** `scripts/worktree.sh`
- **Dependencies:** task-1-policy
- **AC Coverage:** AC-6
- **Validation Command:** `bash scripts/worktree.sh list`

### Task 4: Framework Installer (`task-4-setup`)
- **Touched Files:** `setup`
- **Dependencies:** task-1-policy
- **AC Coverage:** AC-7
- **Validation Command:** `bash scripts/check-install-drift.sh --all-hosts`

### Task 5: Doctrine Documentation (`task-5-docs`)
- **Touched Files:** `WORKTREES.md`, `AGENTS.md`
- **Dependencies:** None
- **AC Coverage:** AC-9
- **Validation Command:** `git diff WORKTREES.md AGENTS.md`

### Task 6: Automated Test Suite (`task-6-tests`)
- **Touched Files:** `test-framework/tests/worktree-policy.test.mjs`, `test-framework/evals/tier-1/validate-literal-branch-worktree.sh`
- **Dependencies:** task-1-policy, task-2-security
- **AC Coverage:** AC-1 through AC-8
- **Validation Command:** `node --test test-framework/tests/worktree-policy.test.mjs && bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh`

### Task 7: Multi-Host Hook Hardening (`task-7-hooks`)
- **Touched Files:** `hooks/lib/durable-source.mjs`, `hooks/lib/enforcement-core.mjs`, `hooks/svc-pre-commit-multi-host-check.sh`, `hooks/svc-session-start-healthcheck.mjs`, `scripts/check-install-drift.sh`
- **Dependencies:** task-2-security
- **AC Coverage:** AC-8
- **Validation Command:** `bash scripts/check-install-drift.sh --all-hosts`

---

## 6. AC-to-Task-to-Validation Matrix

| AC ID | Requirement | Implementing Task | Automated Verification Command |
| :--- | :--- | :--- | :--- |
| **AC-1** | Path formula `~/worktrees/{repo}/{leaf}` | task-1-policy | `node --test test-framework/tests/worktree-policy.test.mjs` |
| **AC-2** | Schema validation | task-1-policy | `node -e "import('./hooks/lib/worktree-policy.mjs').then(m => m.loadWorktreePolicy())"` |
| **AC-3** | Fail-closed on corrupted policy | task-1-policy | `node --test test-framework/tests/worktree-policy.test.mjs` |
| **AC-4** | Dynamic root whitelist & single-UID | task-2-security | `bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh` |
| **AC-5** | Dynamic containment anchor | task-2-security | `bash test-framework/evals/tier-1/validate-worktree-safety.sh` |
| **AC-6** | Leaf-only removal preserving project parent | task-3-cli | `node --test test-framework/tests/worktree-policy.test.mjs` |
| **AC-7** | Installer setup init (0700/0600) | task-4-setup | `bash scripts/check-install-drift.sh --all-hosts` |
| **AC-8** | Multi-host hook detection parity | task-7-hooks | `bash scripts/check-install-drift.sh --all-hosts` |
| **AC-9** | Doctrine synchronization | task-5-docs | `git diff WORKTREES.md AGENTS.md` |

---

## Prerequisite Alignment Matrix

| Task | Technical Design | Security Contract | Multi-Host Parity |
| :--- | :--- | :--- | :--- |
| task-1-policy | Central policy engine | Strict schema v1 & fail-closed | Universal node resolver |
| task-2-security | Containment anchor repair | Same-UID no-symlink check | Codex/Claude/Antigravity hooks |
| task-3-cli | CLI wrapper modernization | Safe leaf-only directory removal | Bash portable execution |
| task-4-setup | Installer initialization | 0700 base permissions | All 9 provisioned hosts |
| task-5-docs | Doctrine alignment | Unambiguous rule definition | Shared reference docs |
| task-6-tests | Tier-1 integration evals | Automated denial verification | Regression guard |
| task-7-hooks | Hook detection hardening | Robust git rev-parse checks | Cross-host lifecycle parity |

---

## Execution Command Sequence

```bash
# 1. Run unit test suite
node --test test-framework/tests/worktree-policy.test.mjs

# 2. Run literal-branch worktree tier-1 validation
bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh

# 3. Run worktree safety tier-1 validation
bash test-framework/evals/tier-1/validate-worktree-safety.sh

# 4. Run multi-host drift check across all 9 hosts
bash scripts/check-install-drift.sh --all-hosts
```

---

## External State

| Environment | External Path | Coupled / Decoupled | Wiring & Verification Command |
| :--- | :--- | :--- | :--- |
| Host Filesystem | User Policy (~/.svc/worktree-policy.json) | Coupled | Mode 0600, single-UID, verified via `node --test test-framework/tests/worktree-policy.test.mjs`. |
| Host Filesystem | Worktree Base (~/worktrees) | Coupled | Mode 0700, single-UID, verified via `ensureWorktreesDirectory()` and setup probe. |
| Git Runtime | External Git Worktree (~/worktrees/{repo}/{leaf}/.git) | Coupled | Git worktree pointer file, verified via `git worktree list --porcelain`. |

### Live Probes
```bash
stat -c "%a %u %g" "$HOME/.svc/worktree-policy.json" 2>/dev/null || echo "absent (valid initial state)"
stat -c "%a %u %g" "$HOME/worktrees" 2>/dev/null || echo "absent (valid initial state)"
```

Untouched environments (walked the taxonomy, found nothing): AWS, GCP, Azure, Docker, Kubernetes, Production Databases, CI Secrets, Cloudflare, Vercel, Supabase.

---

## 8. Rollback & Migration Procedure

### Commit-Scoped Rollback
If code changes must be reverted:
```bash
COMMIT_SHA="HEAD"
git revert "$COMMIT_SHA" --no-edit
```

### External State Cleanup
1. External worktrees created for a specific WI are removed using:
   ```bash
   BRANCH_NAME="feature-centralized-worktree-governance"
   bash scripts/worktree.sh remove "$BRANCH_NAME"
   ```
   This strictly removes the leaf worktree directory while leaving the project root and policy file intact.
2. If the user policy file was created during this WI, removing it causes the system to revert cleanly to standard fallback behavior.

### Migration Precedence
- When querying an existing worktree by branch:
  1. Look up `~/worktrees/{repo-name}/{branch}`.
  2. If absent, fall back to `<repo-root>/.worktrees/{branch}`.
  3. Pre-existing in-repo worktrees remain 100% functional without forced migration.
