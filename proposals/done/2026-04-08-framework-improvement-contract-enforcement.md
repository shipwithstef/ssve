# Framework Improvement: Contract Enforcement Follow-Up

## Evidence
- **Source:** pending proposal `proposals/done/2026-04-08-evolution.md`
- **Finding:** contract drift still escaped static validation across brownfield chaining and visual sidecars: `write-journeys/SKILL.md:19-24`, `design-ui/SKILL.md:1135-1143`, `execute-changeset/SKILL.md:515-523`
- **Severity:** high

## Diagnosis
- **Root cause:** manifest order, frontmatter chaining, continuation prose, and capability/reference docs were being maintained separately, so a previous “fixed” contract still had live handoff drift and stale capability claims.
- **Category:** drift
- **Already in FRAMEWORK-STATE.md?** yes (deferred via 2026-04-08 evolution proposal)

## Implementation
- **Route:** direct SKILL.md/doc/linter edits
- **Files changed:** `write-journeys/SKILL.md`, `design-ui/SKILL.md`, `execute-changeset/SKILL.md`, `track-visuals/SKILL.md`, `review-security/SKILL.md`, `review-cross-model/SKILL.md`, `DOCTRINE.md`, `README.md`, `skills-manifest.json`, `references/knowledge/svc/CAPABILITIES.md`, `route-workflow/SKILL.md`, `references/skill-pack-comparison.md`, `scripts/lint-skills-manifest.mjs`, `FRAMEWORK-STATE.md`, `proposals/done/2026-04-08-evolution.md`
- **Commits:** none (verified in worktree)

## Replay Verification
- **Replay target:** `node scripts/lint-skills-manifest.mjs` plus `bash test-framework/evals/run-all-evals.sh`
- **Result:** PASS
- **Evidence:** manifest lint passed; tier-1 eval replay passed (`validate-chain-references.sh`, `validate-contracts.sh`, `validate-self-verify-sections.sh`, `validate-skill-structure.sh`, `validate-worktree-safety.sh` all green). Targeted `rg` replay confirmed `write-journeys` now routes brownfield work to `design-ux`, and `design-ui` / `execute-changeset` now invoke `track-visuals` sidecars explicitly.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add 2026-04-08 Contract Enforcement Follow-Up entry
- **Known Gaps:** add doctrine evidence debt for C1/C7 as an explicit tracked gap
- **Decisions:** none
- **Capabilities:** yes — lint capability wording updated to reflect chain-handoff and false auto-routing checks
