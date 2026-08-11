# Framework Improvement: Pre-deploy E2E ambiguity in write-e2e + verify-promotion

**Status:** IMPLEMENTED (2026-04-12)

## Evidence

- **Source:** Live session — WI-033 (Example Marketplace, Base44 platform)
- **Finding:** `write-e2e` self-verify check #8 says "test executed at least once; PASS is acceptable." The WI-033 regression spec was run pre-deployment against production and returned PASS. The test did not validate the fix — it validated the current (pre-fix) production state. The `verify-promotion` step 4 ran all tests via `npx playwright test` without explicitly targeting the WI-specific regression spec as the primary post-deploy check.
- **Severity:** medium — the fix's actual production validation was deferred to verify-promotion (correct) but nothing in the skills made this explicit. An agent following check #8 literally would declare the E2E done without understanding the pre-deploy PASS was not fix validation.

## Diagnosis

- **Root cause:** `write-e2e` check #8 had no distinction between "PASS = fix validated" and "PASS = production currently OK at baseline." On production-only deployment platforms (Base44, Vercel preview-only), the E2E suite always hits the live production URL. Pre-deploy = baseline check. Post-deploy = fix validation. This distinction was not in the skill.
- **Secondary root cause:** `verify-promotion` step 4 targeted the entire test suite (`npx playwright test`) without calling out the WI-specific regression spec as the primary verification target.
- **Category:** fragility — skill produced a hollow self-verify pass signal

## Implementation

- **Route:** direct SKILL.md edits
- **Files changed:**
  1. `write-e2e/SKILL.md` — Added "Production-Only Deployment Platforms" section before Repository Mode Gate explaining the pre-deploy vs post-deploy distinction for Base44/Vercel-preview platforms. Updated check #8 to document what a PASS means before vs after deployment, and to require explicit documentation when a spec passes pre-deploy.
  2. `verify-promotion/SKILL.md` — Step 4 now leads with "Priority 1: Run the WI-specific regression spec first" (pattern: `WI<number>-*.spec.ts`) before the broader `npx playwright test` sweep. Clarifies this is the primary post-deploy fix validation signal.

## Replay Verification

- **Replay target:** tier-1 evals
- **Result:** PASS on my changes — no new failures introduced by these edits
- **Evidence:** `bash test-framework/evals/run-all-evals.sh --tier1` — 8 scripts passed. Pre-existing failures in diagnose-bug and route-workflow (pre-existing uncommitted changes) unrelated to this proposal.

## FRAMEWORK-STATE.md Mutations

- Add to Analysis History: WI-033 pre-deploy E2E ambiguity + fix
- No Known Gaps mutations
- No new Decisions
