# Framework Improvement: diagnose-bug causal-chain classification gate

**Status:** IMPLEMENTED (2026-04-12, see commit below)

## Evidence

- **Source:** User-reported live failure during WI-034 (Example Marketplace, 2026-04-12)
- **Finding:** `diagnose-bug` skill identified a rendering fallback (Unsplash placeholder images) as the root cause of a bug the user described as "after I upload a photo, discovery still shows generic images." The real root cause was a cache key mismatch between `LocationProfile.jsx` (invalidates `['locations']`) and `useLocationDiscovery.jsx` (reads from `['batch-location-data']`). The rendering fallback was a secondary issue.
- **Severity:** medium — systematic. Any bug report with a temporal qualifier ("after X, Y is wrong") is vulnerable to the same category error.

## Diagnosis

- **Root cause:** Step 1 (Reproduce) had no mandatory structured-repro format and no temporal qualifier handling. Step 3 (Isolate) listed subsystems but did not require the agent to classify the bug by causal structure (action / propagation / rendering) before exploring code.
- **Mechanism:** Agent delegated to an Explore subagent without first classifying the bug. The subagent received a simplified task ("find how image src is determined") that dropped the temporal qualifier "after uploading." The subagent found the nearest plausible rendering explanation (Unsplash fallback) and the agent accepted it without verifying whether data actually propagated from save → discovery reader.
- **Category:** fragility — the skill's explore delegation is structurally unsafe for propagation-class bugs
- **Already in FRAMEWORK-STATE.md?** No

## Implementation

- **Route:** Direct SKILL.md edit (quick-fix)
- **Files changed:** `diagnose-bug/SKILL.md`
  - **Step 1** — replaced "State the shortest reliable repro" with a structured-repro template + mandatory causal classification table (Action / Propagation / Rendering) with explicit gate: "Do NOT start reading code until you've classified"
  - **Step 3** — added "For propagation-class bugs" block with 3-step ordered verification: (1) action persists?, (2) reader sees it? (keys match?), (3) renderer displays it? — with explicit statement that jumping to step 3 when report says "after X, Y is wrong" is a category error

## Replay Verification

- **Replay target:** Manual — next live execution of `diagnose-bug` on a propagation-class bug
- **Contract change proven by:** The specific WI-034 failure would not recur — the classification gate in Step 1 forces the agent to ask "is this action / propagation / rendering?" before touching any code. A bug report saying "after uploading, discovery shows wrong images" maps directly to propagation-class → trace invalidation path first.
- **Result:** MANUAL PENDING

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry for this improvement
- **Known Gaps:** None — new finding
- **Decisions:** "diagnose-bug Step 1 requires structured repro + causal classification before code exploration — this is a hard gate, not a suggestion"
- **Capabilities:** No new capabilities, behavioral enforcement improvement
