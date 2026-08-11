# Framework Improvement: blend-external dual assessment (blend + addon)

**Status:** IMPLEMENTED (2026-04-10)

## Evidence
- **Source:** User-reported gap — blend-external only assesses what to absorb (techniques/patterns), not whether the source should be used as an external addon at runtime. Both assessments should always be produced.
- **Finding:** `blend-external/SKILL.md` has thorough blend analysis (Phase 2 dimensional comparison, Phase 2c hybrid innovation) but no assessment of external addon viability. EXTERNAL_ADDONS.md exists as a concept but blend-external doesn't evaluate or draft entries for it.
- **Severity:** medium — missing half the evaluation. Sources like last30days-skill have clear addon value that the current process would miss.

## Diagnosis
- **Root cause:** blend-external was designed as a "pattern absorption" skill. External addon evaluation was a separate manual process with no skill contract.
- **Category:** missing capability (incomplete assessment)
- **Already in FRAMEWORK-STATE.md?** No (new)

## Implementation
- **Route:** direct SKILL.md edit (skill contract expansion)
- **Files changed:**
  - `blend-external/SKILL.md` — Step 3 expanded to "Dual Assessment" with Assessment A (blend opportunities) and Assessment B (external addon viability). New ADDON and BLEND+ADDON action types added. Blend plan template expanded with addon viability section. Self-verify check #11 added for dual assessment.
  - `improve-framework/SKILL.md` — "Output Artifact" section clarified: quick-fix routes write records post-hoc, normal pipeline routes write plans pre-implementation.
- **Commits:** (this commit)

## Replay Verification
- **Replay target:** tier-1 evals
- **Result:** PASS
- **Evidence:** 9 scripts, 3,814 checks, 0 failures

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added entry for blend-external dual assessment + improve-framework record naming
- **Known Gaps:** N/A (new findings, fixed immediately)
- **Decisions:** Every blend-external run must produce both Assessment A and Assessment B
- **Capabilities:** blend-external now evaluates external addon viability (update svc CAPABILITIES.md)
