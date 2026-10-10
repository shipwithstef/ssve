# Iron Law: No Fixes Without Root Cause — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Iron Law: No Fixes Without Root Cause

**Do not propose a fix until the root cause is identified.** The natural instinct
is to jump to a patch — resist it. A patch without root cause understanding:
- May fix the symptom but not the cause
- May introduce new bugs in adjacent code
- May mask a deeper architectural problem

### Investigation Protocol

1. **Reproduce** (Step 1 above)
2. **Hypothesize** — form a concrete, falsifiable hypothesis about the root cause
3. **Scope lock** — restrict investigation to the smallest relevant subsystem:
   ```bash
   scripts/worktree.sh freeze <directory>  # if available
   ```
   This prevents accidentally "fixing" unrelated code while investigating.
4. **Trace** — follow the data flow end-to-end through the fault surface.
   **Multi-boundary instrumentation:** when the fault surface spans multiple
   components (API → service → DB → response), add logging at EVERY component
   boundary in a single pass — log what enters and what exits each layer. Run
   once. Read all boundary logs simultaneously. This pinpoints the exact layer
   where data corrupts without iterative guess-and-check (4 runs → 1 run).
   Source: superpowers systematic-debugging Phase 1.
5. **Verify hypothesis** — find code evidence that confirms or refutes. For
   cross-system flows, the probe must include both a confirmation check and a
   falsification check, then pass
   `scripts/validate-cross-system-probe-evidence.mjs`.
6. **If refuted** — form a new hypothesis. Max 3 attempts before escalating.
7. **If confirmed** → proceed to Step 5 (smallest safe fix)

### 3-Attempt Escalation

After 3 failed investigation hypotheses:
- Stop investigating. The root cause is non-obvious.
- Report: what was tried, what was ruled out, current best hypothesis.
- **Explicitly consider: is this a design problem (wrong architecture) or a
  code problem (wrong implementation)?** If all 3 hypotheses targeted code-level
  causes and all failed, the root cause may be architectural — the component is
  doing the wrong thing, not doing the right thing incorrectly. Surface this
  distinction in your escalation report.
- Escalate: ask the user for domain knowledge or pair debugging.
- Do NOT start guessing fixes.

### Pattern Library

Common root cause patterns to check:

| Pattern | Signature | How to verify |
|---------|-----------|--------------|
| Race condition | Intermittent, timing-dependent | Add logging around shared state access |
| Null/undefined access | Crashes on specific paths | Trace data flow, find where value becomes null |
| State machine violation | Wrong state after specific sequence | Map valid transitions, find the illegal one |
| Stale cache | Correct after restart, wrong after time | Check cache invalidation triggers |
| Schema mismatch | Works in dev, fails in prod | Compare migration state across environments |
| Off-by-one | Edge cases fail, middle cases pass | Test boundary values explicitly |
