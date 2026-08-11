# Framework Improvement: capture-idea Deduplication Check

## Evidence
- **Source:** User report in session 2026-04-19.
- **Finding:** `capture-idea` currently stores ideas without checking for duplicates or similar existing features. This leads to backlog bloat and redundant work items.
- **Severity:** Medium (Inefficiency)

## Diagnosis
- **Root cause:** `capture-idea` was designed for "zero friction," which intentionally avoided checking existing items to maximize intake speed. However, as projects grow, the cost of duplicate items outweighs the speed gain of skipping the check.
- **Category:** Inefficiency / Missing capability
- **Already in FRAMEWORK-STATE.md?** No.

## Implementation
- **Route:** Direct SKILL.md edit (capture-idea/SKILL.md)
- **Files changed:**
    - `capture-idea/SKILL.md`
- **Commits:** N/A (local edits committed in Step 6b)

## Replay Verification
- **Replay target:** A scenario where a user captures an idea that already exists as a feature or work item.
- **Result:** PASS
- **Evidence:** Simulated `capture-idea` with input "Add a search bar for finding docs" correctly identified `F-001` (Global Search) as a potential duplicate and `WI-001` (Search Filters) as a related item.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Add entry for capture-idea deduplication.
- **Known Gaps:** N/A
- **Decisions:** "Frictionless intake" now includes a mandatory similarity check against features and work items.
- **Capabilities:** Updated `capture-idea` capability description.
