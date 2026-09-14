# Framework Improvement: Router Improve-vs-Evolve Clarity

**Status:** IMPLEMENTED (2026-04-08, uncommitted worktree, replay verified)

## Evidence
- **Source:** user report after an actual routing interaction
- **Finding:** `route-workflow` did not explicitly distinguish "find the framework gaps" from "we already have the findings, now validate and implement them"
- **Severity:** medium

## Diagnosis
- **Root cause:** freeform routing examples covered framework diagnosis and framework improvement separately, but omitted the "existing evidence/proposal" case
- **Category:** drift
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** direct SKILL.md / doctrine edit
- **Files changed:** `route-workflow/SKILL.md`, `README.md`, `FRAMEWORK-STATE.md`
- **Commits:** none (worktree not committed in this session)

## Replay Verification
- **Replay target:** targeted contract replay for framework routing language
- **Result:** PASS
- **Evidence:**
  - `node scripts/lint-skills-manifest.mjs` → PASS
  - `git diff --check` → PASS
  - targeted `rg` confirms framework-improvement phrasing now includes the existing-findings case in `route-workflow/SKILL.md`
  - README now states the intended distinction explicitly: `evolve-framework` finds/prioritizes gaps; `improve-framework` validates and implements existing findings/proposals

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add a new 2026-04-08 entry clarifying improve-vs-evolve routing
- **Known Gaps:** none moved
- **Decisions:** no new locked design decision beyond the router clarification
- **Capabilities:** no capability change
