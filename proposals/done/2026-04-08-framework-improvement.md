# Framework Improvement: Contract Consistency and Responsive Enforcement

**Status:** IMPLEMENTED (2026-04-08, uncommitted worktree, replay verified)

## Evidence
- **Source:** user report + direct contract review in `skills-manifest.json`, `route-workflow/SKILL.md`, `REPO_MODES.md`, `review-gate/SKILL.md`, `design-ux/SKILL.md`, `design-ui/SKILL.md`, `design-tech/SKILL.md`, `test-journeys/SKILL.md`, `verify-promotion/SKILL.md`, and `track-visuals/SKILL.md`
- **Finding:** lifecycle transitions, brownfield lane defaults, responsive verification, and visual-tracking claims disagreed across the framework contracts
- **Severity:** high

## Diagnosis
- **Root cause:** multiple framework truth sources drifted independently. State transitions moved out of sync, brownfield feature guidance favored skipping UX/UI, and responsive/visual checks were described as important without being required in the actual sequences.
- **Category:** drift
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** direct framework contract edits (manifest + SKILL.md + doctrine docs)
- **Files changed:** `skills-manifest.json`, `review-gate/SKILL.md`, `design-ux/SKILL.md`, `design-ui/SKILL.md`, `design-tech/SKILL.md`, `test-journeys/SKILL.md`, `verify-promotion/SKILL.md`, `track-visuals/SKILL.md`, `route-workflow/SKILL.md`, `REPO_MODES.md`, `README.md`, `references/knowledge/svc/CAPABILITIES.md`, `FRAMEWORK-STATE.md`
- **Commits:** none (worktree not committed in this session)

## Replay Verification
- **Replay target:** `bash test-framework/evals/run-all-evals.sh` (tier-1 static validation) plus targeted contract checks
- **Result:** PASS
- **Evidence:**
  - `node scripts/lint-skills-manifest.mjs` → PASS
  - `git diff --check` → PASS
  - initial tier-1 replay exposed a real gap: `track-visuals` was referenced in manifest lanes without matching frontmatter lane declarations
  - after adding the lane declarations, `bash test-framework/evals/run-all-evals.sh` → PASS (all tier-1 scripts passed)
  - targeted `rg` replay confirms the old brownfield skip wording and stale lifecycle transition strings were removed from the routing/doctrine files while the intended lifecycle strings remain

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add a new 2026-04-08 entry for contract consistency and responsive enforcement
- **Known Gaps:** no existing gap entry moved
- **Decisions:** add brownfield UI rule and responsive verification rule
- **Capabilities:** update `references/knowledge/svc/CAPABILITIES.md` to reflect visual baseline/diff and responsive evidence
