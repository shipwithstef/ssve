# Framework Improvement: Kimi session contract hardening for visual QA

**Status:** IMPLEMENTED 2026-04-22 (`cac7afd`)

## Evidence
- **Source:** [2026-04-22-evolution.md](/workspace/seriousvibecoding/proposals/2026-04-22-evolution.md:1) and [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:1)
- **Finding:** explicit `/skill:track-visuals` could finish without a `track-visuals` artifact family; `test-journeys` could still recommend the wrong direct next skill; review reports had no mechanical count reconciliation
- **Severity:** high

## Diagnosis
- **Root cause:** svc had the right written contracts in `track-visuals` and `test-journeys`, but no shared validator that could be reused by skills or replayed by `test-framework` to check output-family emission, review-report arithmetic, or allowed next-skill suggestions.
- **Category:** fragility
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** direct SKILL.md edit + shared script + tier-1 replay
- **Files changed:** `scripts/verify-skill-contract.mjs`, `track-visuals/SKILL.md`, `test-journeys/SKILL.md`, `references/anti-patterns.md`, `references/knowledge/svc/CAPABILITIES.md`, `test-framework/evals/tier-1/validate-framework-self-management.sh`, `test-framework/fixtures/contract-validation/*`
- **Commits:** `cac7afd`

## Replay Verification
- **Replay target:** contract replay for the dark-mode failure class
- **Result:** PASS
- **Evidence:**
  - `node scripts/verify-skill-contract.mjs artifact-family track-visuals --root test-framework/fixtures/contract-validation/track-visuals`
  - `node scripts/verify-skill-contract.mjs visual-review-closeout --report test-framework/fixtures/contract-validation/track-visuals/.svc/visuals/WI-000/review-dark-mode-2026-04-22.md --screenshots-dir test-framework/fixtures/contract-validation/track-visuals/.svc/visuals/WI-000/current-state`
  - `node scripts/verify-skill-contract.mjs test-journeys-closeout --summary test-framework/fixtures/contract-validation/test-journeys/SUMMARY.md --scenarios test-framework/fixtures/contract-validation/test-journeys/scenarios.json --next diagnose-bug --next write-e2e`
  - `bash test-framework/evals/tier-1/validate-framework-self-management.sh` → PASS (`262 passed, 0 failed`)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add a 2026-04-22 entry for contract validators covering output families, track-visuals review close-out, and test-journeys next-skill routing
- **Known Gaps:** no new deferred items
- **Decisions:** direct next-step recommendation after `test-journeys` regressions cannot be `review-gate`
- **Capabilities:** yes — `references/knowledge/svc/CAPABILITIES.md` updated
