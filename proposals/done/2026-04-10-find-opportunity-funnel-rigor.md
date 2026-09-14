# Framework Improvement: find-opportunity Funnel Rigor

**Status:** IMPLEMENTED (2026-04-10)

## Evidence
- **Source:** Real pipeline run — find-opportunity executed 3 times (v1→v2→v3) for Stefan's builder profile. User rejected v1 as "hyper average" and v2 as "still insufficient, need 10+ sources."
- **Finding:** The skill contract allowed presenting 3 opportunities from a pool of 3 (no funnel). No minimum evidence depth per candidate. No category diversity enforcement. No parallel research mandate. No structured proof chain format.
- **Severity:** high — the skill's core purpose is evidence-backed opportunity selection, but the contract had no teeth to enforce rigor.

## Diagnosis
- **Root cause:** Step 3 said "find 10-20 products" and Step 8 said "present top 3" but nothing between them enforced a minimum funnel breadth, evidence depth per candidate, category diversity, or structured proof format. The agent took the path of least resistance: investigate 3, present 3.
- **Category:** inefficiency + fragility (the skill worked for ideal agents but failed for lazy execution)
- **Already in FRAMEWORK-STATE.md?** No (new finding from first real pipeline run)

## Implementation
- **Route:** direct SKILL.md edit (skill contract surgery)
- **Files changed:**
  - `find-opportunity/SKILL.md` — new Step 2b "Candidate Funnel Requirements (MANDATORY)" with:
    - Funnel minimums table: 8+ categories, 10+ candidates, 5+ evidence per top-3, 2+ category diversity, all rejected shown
    - Proof chain format: 10-type structured evidence trail with sourced URLs
    - Parallel research mandate: split categories across parallel agents
  - `find-opportunity/SKILL.md` — self-verify expanded 11→16 checks:
    - #12: Funnel breadth (10+ candidates)
    - #13: Evidence depth (5+ proof points per top-3)
    - #14: Category diversity (2+ categories in top 3)
    - #15: Full funnel visible (all rejected shown)
    - #16: Parallel research used

## Replay Verification
- **Replay target:** tier-1 eval suite
- **Result:** PASS (9 scripts, all checks pass, 0 failures)
- **Evidence:** `bash test-framework/evals/run-all-evals.sh --tier1` → PASS

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added "find-opportunity Funnel Rigor" entry
- **Known Gaps:** n/a (new finding, fixed in this run)
- **Decisions:** find-opportunity now requires 10+ candidate funnel with structured proof chains
- **Capabilities:** Updated svc/CAPABILITIES.md if applicable
