# Framework Evolution — 2026-05-25

## Method
Surveyed `.gitignore` provisioning, synchronization, and validation across the repository setup scripts (`setup`), onboarding scripts (`onboard-repo/SKILL.md`), state initialization scripts (`scripts/init-project-state.mjs`), and tier-1 validators (`test-framework/evals/tier-1/validate-worktree-safety.sh`).

---

## Findings (by priority)

### P0 — Fix now (blocks quality)
* **Finding:** Lack of automated `.gitignore` template provisioning. Downstream projects converted to `svc` are not supplied with a standard set of ignored patterns for `.svc/` transient states (like `.svc/*.log`, review configs, push states, or local test results), leading to constant untracked workspace pollution and risk of accidental commits of local evidence logs.
  * **Evidence:** `scripts/init-project-state.mjs` (lines 37-67) creates `.svc/` files but does not look at or mutate the root `.gitignore`.
  * **Proposed fix:** 
    1. Create a canonical `.gitignore` template at `templates/.gitignore.template` containing standard svc patterns:
       ```gitignore
       # === BEGIN SERIOUS VIBE CODING IGNORES ===
       .worktrees/
       .svc/*.log
       .svc/sessions/
       .svc/review-exec-pair.json
       .svc/pending-push.json
       .svc/loop-guard-state.json
       .svc/receipts/*
       .svc/reconcile-checkpoint.json
       .svc/chain-policy.json
       .svc/leftover-dispositions/
       .svc/hooks.json
       # === END SERIOUS VIBE CODING IGNORES ===
       ```
    2. Teach `scripts/init-project-state.mjs` to idempotently check, update, or append this missing pattern block envelope to the project's root `.gitignore`. It must search for the `# === BEGIN SERIOUS VIBE CODING IGNORES ===` comment block and replace only its contents if present, preventing duplication.

### P1 — Fix soon (degrades quality)
* **Finding:** Insufficient `.gitignore` validation in tier-1 safety checks. The worktree safety validator only asserts the presence of `.worktrees/` in `.gitignore`, letting other dirty transient `.svc/` files slip through.
  * **Evidence:** `test-framework/evals/tier-1/validate-worktree-safety.sh` (lines 33-51) only checks `.worktrees/` presence and ignores all other transient/metadata paths.
  * **Proposed fix:** Extend `validate-worktree-safety.sh` to check for the complete set of core `.svc/` ignore rules (like `*.log`, `review-exec-pair.json`, `pending-push.json`, etc.). When the validator fails, its error output must print the exact recovery command: `node scripts/init-project-state.mjs` to auto-populate the block.


### P2 — Improve when possible (nice to have)
* **Finding:** Missing `.gitignore` check in onboard-repo process. The onboarding/conversion phase does not report or check whether the target repository has active ignores for framework assets, leaving it to the developer's manual attention.
  * **Evidence:** `onboard-repo/SKILL.md` has no mentions of gitignore/ignores checking during conversion.
  * **Proposed fix:** Add a `.gitignore` validation step to `onboard-repo`'s core checklist.

---

## Comparison delta
Competitor frameworks like `superpowers` and `gsd-2` enforce strict project ignore trees during onboarding to avoid dirty workspaces. Adding automated ignores brings `svc` to parity.

---

## Stale proposal audit
* `proposals/2026-05-17-generic-data-access-control-delivery-guard.md`: COMMITTED.
* `proposals/WI-FRAMEWORK-EVOLVE-research-flow-improvement.md`: PENDING.
* `proposals/2026-05-02-lane-7-infra-mode-deepening.md`: PENDING.
