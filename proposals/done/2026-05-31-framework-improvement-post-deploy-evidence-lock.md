# Framework Improvement: Post-deploy evidence lock

## Evidence

- **Source:** User report during Example Marketplace WI-327 closeout on 2026-05-31.
- **Finding:** The agent answered a "post deployment E2E" question from local/pre-deploy E2E plus production visual/bundle evidence instead of running the named E2E after deploy against `https://example-marketplace.app`.
- **Severity:** High. This can produce false completion claims on deployed work.

## Diagnosis

- **Root cause:** `route-workflow` normalized noisy user language but did not preserve `post-deploy`/`production` as a hard evidence-stage constraint. `base44-environment` described deploy validation but did not explicitly state that user-requested post-deploy E2E must run after the live marker moves. `onboard-repo` did not inject a baseline project-context line making svc/project deployment rules mandatory when no skill is explicitly invoked.
- **Category:** fragility.
- **Already in FRAMEWORK-STATE.md?** No.

## Implementation

- **Route:** direct framework docs/contract edit with targeted Tier-1 regression. The change is additive prose plus a new static eval; no hook protocol, script interface, or skill frontmatter changed.
- **Files changed:**
  - `route-workflow/SKILL.md`
  - `route-workflow/references/intent-normalization.md`
  - `base44-environment/SKILL.md`
  - `onboard-repo/SKILL.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `FRAMEWORK-STATE.md`
  - `references/knowledge/svc/CAPABILITIES.md`
  - `test-framework/evals/tier-1/validate-post-deploy-evidence-lock.sh`
- **Commits:** `3a921b3d0849`

## Replay Verification

- **Replay target:** Static framework regression for noisy post-deploy wording, route-workflow evidence lock, Base44 production-targeted validation, onboarded-project bootstrap contract, and root AGENTS/CLAUDE bootstrap rule.
- **Result:** PASS.
- **Evidence:**
  - `bash test-framework/evals/tier-1/validate-post-deploy-evidence-lock.sh` -> `11 passed, 0 failed`
  - `bash test-framework/evals/tier-1/validate-intent-normalization-routing.sh` -> `11 passed, 0 failed`
  - `node scripts/lint-skills-manifest.mjs` -> `skills-manifest lint passed`

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Added `2026-05-31: Post-deployment evidence lock added`.
- **Known Gaps:** No existing gap moved.
- **Decisions:** Post-deploy/live/production proof language is now a hard evidence-stage constraint; local/pre-deploy proof cannot satisfy it.
- **Capabilities:** Updated `references/knowledge/svc/CAPABILITIES.md` with `Post-Deploy Evidence Lock`.
