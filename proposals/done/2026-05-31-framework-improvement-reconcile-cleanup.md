# Framework Improvement: Reconcile cleanup

## Evidence

- **Source:** User report after post-deploy evidence-lock closeout.
- **Finding:** `svc-reconcile` still reported 13 historical `origin/main` commits as unaccounted, and normal runs could print a GitHub GraphQL repository error when the active `gh` account did not match the repo owner.
- **Severity:** High. A dirty reconcile gate blocks route-workflow preflight and undermines the mandatory chain.

## Diagnosis

- **Root cause:** Historical commits had partial or missing `refs/notes/svc-receipts` envelopes. Separately, `svc-reconcile` queried merged PRs with whichever `gh` account was active instead of using the deterministic owner-switch recovery already documented for push/fetch closeout.
- **Category:** drift + fragility.
- **Already in FRAMEWORK-STATE.md?** The auth-switch policy existed for push/fetch, but not for `svc-reconcile`.

## Implementation

- **Route:** direct framework cleanup and narrow hot-path patch with targeted Tier-1 regression.
- **Files changed:**
  - `scripts/svc-reconcile.mjs`
  - `test-framework/evals/tier-1/validate-svc-reconcile-gh-auth-recovery.sh`
  - `FRAMEWORK-STATE.md`
  - `proposals/done/2026-05-31-framework-improvement-reconcile-cleanup.md`
- **Commits:** pending at proposal creation; filled by git history.
- **Receipt notes:** Backfilled retroactive chain receipts for the 13 SHAs reported by `svc-reconcile`.

## Replay Verification

- **Replay target:** `node scripts/svc-reconcile.mjs` with a non-owner active GitHub account.
- **Result:** PASS.
- **Evidence:**
  - `node scripts/svc-reconcile.mjs` returned `unaccounted_count: 0`, `merged_unverified_count: 0`, `gh_available: true`.
  - `bash test-framework/evals/tier-1/validate-svc-reconcile-gh-auth-recovery.sh` passes.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Added `2026-05-31: Reconcile receipt backlog cleaned`.
- **Known Gaps:** No existing gap moved.
- **Decisions:** `svc-reconcile` now owns deterministic repo-owner GitHub auth recovery for its `gh pr list` call.
- **Capabilities:** No capability catalog update needed.
