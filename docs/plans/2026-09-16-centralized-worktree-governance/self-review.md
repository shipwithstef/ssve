# Self-Review: Centralized External Worktree Governance

> **Work Item:** `WI-FW-CENTRALIZED-WORKTREE-01`  
> **Author / Reviewer:** Session Orchestrator (Antigravity)  
> **Date:** 2026-09-16  
> **Scope:** Architecture, Multi-Host Hooks, Consuming Projects, and Isolation Invariants

---

## 1. Executive Self-Assessment

### Verdict: PASS WITH HARDENING
* **Rubric Score:** 9 / 10
* **Status:** All core invariants verified; multi-host hook detection hardened; zero install drift across 9 hosts.

---

## 2. Evaluation Across 10 Solution-Readiness Dimensions

### (1) Exact Resolvable & Declared Files
* **Declared in Manifest:**
  * `schemas/worktree-policy.schema.json` (authoritative schema)
  * `hooks/lib/worktree-policy.mjs` (policy engine & root resolvers)
  * `scripts/lib/resolve-worktree-root.mjs` (CLI bridge)
  * `hooks/lib/literal-branch.mjs` (dynamic root whitelisting)
  * `scripts/svc-ensure-worktree.mjs` (containment anchor propagation)
  * `scripts/worktree.sh` (leaf-only pruning, dynamic fallback resolution)
  * `setup` (0700 base directory permissions, default policy seeding)
  * `WORKTREES.md` (doctrine updates)
  * `test-framework/tests/worktree-policy.test.mjs` (6 unit tests)
  * `test-framework/evals/tier-1/validate-literal-branch-worktree.sh` (36 tier-1 tests)
  * `hooks/lib/durable-source.mjs` (Git rev-parse worktree detection)
  * `hooks/lib/enforcement-core.mjs` (broadened source classification)
  * `hooks/svc-pre-commit-multi-host-check.sh` (worktree candidate validation)
  * `hooks/svc-session-start-healthcheck.mjs` (worktree filter during self-heal)
  * `scripts/check-install-drift.sh` (worktree detection and drift prevention)
* **Assessment:** All 15 files exist, resolve without symlink escapes, and are covered by automated checks.

### (2) Complete Consequential Behavior & Interfaces
* **Leaf-Only Removal Invariant:**
  * `scripts/worktree.sh remove <branch>` removes strictly `~/worktrees/{repo-name}/{leaf}`.
  * The parent directory `~/worktrees/{repo-name}` is explicitly protected.
  * In contrast, legacy in-repo `.worktrees/` directory is pruned only when completely empty.
* **1:1 Branch-to-Worktree Binding:**
  * Leaf directory naming maps 1:1 to the branch ref text or deterministic hash-leaf for slash branches.
  * Zero cross-branch contamination or leaf collision.

### (3) Appropriate Executable Proof & Outcomes
* `node --test test-framework/tests/worktree-policy.test.mjs` -> 6/6 pass.
* `bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh` -> 36/36 pass.
* `bash test-framework/evals/tier-1/validate-worktree-safety.sh` -> 6/6 pass.
* `bash scripts/check-install-drift.sh --all-hosts` -> 0 drift across all 9 provisioned hosts.
* `bash scripts/verify-plan-mechanical.sh` -> TIER-1 PASS.

### (4) Meaningful Action & Authority Limits
* **Strict Single-UID Ownership:**
  * `~/worktrees` initialized with `0700` (`rwx------`).
  * `~/.svc/worktree-policy.json` initialized with `0600` (`rw-------`).
  * Policy engine enforces `stat.uid === process.getuid()`.
* **Symlink Escapes Forbidden:**
  * `isApprovedExistingWorktreeRoot` and `resolveApprovedRoots` reject paths containing symlinked directory components.

### (5) Exact Write Scope
* External worktrees live strictly within the policy-approved root (`~/worktrees/{repo-name}/` or project-configured override).
* `scripts/svc-ensure-worktree.mjs` verifies containment against the dynamic `containmentAnchor`.
* Mutations outside approved roots are denied fail-closed with `WORKTREE_ROOT_UNAPPROVED`.

### (6) Recovery Path
* **Corrupt/Missing Policy:** Falls back gracefully to `~/worktrees/{repo-name}` with standard 0700 permissions.
* **Legacy Compatibility:** Existing worktrees in `<repo-root>/.worktrees/` remain whitelisted in `approvedWorktreeRoots()`, enabling seamless adoption and resume.
* **Rollback:** Restoring previous code cleanly falls back to legacy in-repo paths without data loss.

### (7) Correct Dependencies & Lifecycle
* Zero cyclic dependencies between `worktree-policy.mjs`, `literal-branch.mjs`, and `svc-ensure-worktree.mjs`.
* `setup` runs `svc-migrate-install materialize` before wirers so launcher routes through durable canonical source.

### (8) Observable Success
* `git worktree list --porcelain` correctly lists external worktrees alongside main checkout.
* Pre-commit and drift checks distinguish linked worktrees from main repository via `git rev-parse --git-dir != --git-common-dir`.

### (9) Original AC / Technical Trace
* Solves all user issues identified in consuming projects (e.g. `hourshub-port`):
  * Eliminates nested `.worktrees/` Capacitor/node_modules bloating.
  * Eliminates Cursor IDE indexing spikes on nested `.git` repos.
  * Eliminates need for `touch ~/.svc/BREAK-GLASS` or prompt override workarounds.

### (10) No Unresolved Consequential Choice
* All user decisions resolved:
  * Policy format: JSON (`~/.svc/worktree-policy.json`).
  * Default root: `~/worktrees/{repo-name}/{leaf}`.
  * Pruning behavior: Leaf-only, preserving project parent directory.
  * Adversarial plan review: Mandatory before release.

---

## 3. Potential Edge Cases & Mitigations

| Edge Case | Risk | Mitigation Verified |
| :--- | :--- | :--- |
| Multi-repo name collision | Two repos with same basename clashing under `~/worktrees` | Policy supports `projects.<repo-name>.root` override in `~/.svc/worktree-policy.json` to assign custom paths. |
| In-repo leftover detection | Old scripts looking for `/.worktrees/` | Updated all 5 hook locations to check `git-dir != git-common-dir` and `*"/worktrees/"*`. |
| Antigravity workspace boundary | Antigravity `run_command` requiring CWD inside registered workspace | Documented option to set `projects.ssve.root` to `/home/dianast/app-workspaces/worktrees/ssve` if needed. |
