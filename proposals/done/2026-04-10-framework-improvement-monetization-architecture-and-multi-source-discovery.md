# Framework Improvement: monetization-architecture skill + multi-source discover-skills

**Status:** IMPLEMENTED (2026-04-10)

## Evidence
- **Source:** User-reported capability gap during WI-008 (premium gating not enforced)
- **Finding:** 14 installed monetization skills cover ~35% of the feature→tier mapping decision. No external candidates fill the remaining 65%. `discover-skills` searches only 1 of 5 mapped marketplaces.
- **Severity:** medium (framework capability gap, not a regression)

## Diagnosis
- **Root cause:** Missing skill for monetization architecture decisions; single-source skill discovery limits external candidate pool
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No (new finding from marketplace research)

## Implementation
- **Route:** create-skill (new skill) + direct SKILL.md edit (discover-skills enhancement)
- **Files changed:**
  - `monetization-architecture/SKILL.md` (NEW — 7-step process with evidence grading)
  - `discover-skills/SKILL.md` (ENHANCED — dual-source search)
  - `skills-manifest.json` (added monetization-architecture to includedSkills + corePackForRouting)
  - `README.md` (added monetization-architecture description)
  - `EXTERNAL_ADDONS.md` (added monetization-architecture to core pack)
  - `route-workflow/SKILL.md` (added monetization-architecture to core pack list)
  - `FRAMEWORK-STATE.md` (updated skill count 49→50, lint count, analysis history)
  - `references/knowledge/skill-marketplaces/` (NEW — CAPABILITIES.md + 3 detail files)
  - `references/knowledge/INDEX.md` (added skill-marketplaces entry)
  - `docs/specs/research-log.md` (2 new entries)

## Replay Verification
- **Replay target:** lint + tier-1 evals
- **Result:** PASS
- **Evidence:** `node scripts/lint-skills-manifest.mjs` → PASS (50 skills, 33 routing); `bash test-framework/evals/run-all-evals.sh --tier1` → PASS (9/9 scripts, 3,887 checks, 0 failures)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added "2026-04-10: monetization-architecture skill + multi-source discover-skills"
- **Known Gaps:** none moved (this was a new finding, not a deferred gap)
- **Decisions:** none locked
- **Capabilities:** update svc/CAPABILITIES.md — yes (new skill + enhanced discovery)
