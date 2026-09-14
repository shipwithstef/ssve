# Framework Improvement: diagnose-bug Step 0 missing explicit TaskCreate mirror call

**Status:** IMPLEMENTED (2026-04-12)
**Triggered by:** WI-034 execution in Example Marketplace project

## Evidence

- **Source:** User-reported
- **Finding:** `diagnose-bug/SKILL.md` Step 0 writes `.svc/lane-tasks-<WI>.json` but never explicitly instructs calling `TaskCreate`/`TaskUpdate` to mirror the task graph in the Claude UI. Instruction to mirror was buried in the Chaining section (read at exit, not at setup).
- **Severity:** medium

## Diagnosis

- **Root cause:** Step 0 had two parts (write JSON, set --diagnose-only flags) but was missing part (c): mirror to TaskList. Agents never saw the instruction until they were exiting the skill.
- **Category:** fragility

## Implementation

- **Route:** direct SKILL.md edit
- **Files changed:** `diagnose-bug/SKILL.md` — added explicit "In Claude Code — mirror to TaskList immediately" block to Step 0

## Replay Verification

- **Replay target:** Next diagnose-bug execution creates TaskCreate entries for all 7 tasks at Step 0 before any diagnosis work
- **Result:** MANUAL — next live execution is the test

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** added
- **Decisions:** TaskCreate mirroring is mandatory at Step 0, not deferred to Chaining section
