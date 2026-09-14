# review-gate — Findings→fix-tasks, convergence tracking, token cost, process summary

## How Findings Feed Back as Fix Tasks

When a gate returns FAIL, the critical/high findings become structured fix tasks. Each fix task references back to the original finding so the fix can be verified in the next iteration.

**Fix Task Format:**

```markdown
### Fix Task: [GATE]-[NNN]

- **Source finding:** [GATE]-[NNN] from iteration [N]
- **Severity:** [from finding]
- **Artifact to fix:** [file path]
- **Location:** [section or line range]
- **Action required:** [from the finding's suggested fix — made concrete]
- **Verification:** [How to confirm the fix — what the next review should check]
- **Assigned to:** [producing skill name — the skill that created the artifact]
```

**Fix Cycle:**

```
1. Gate returns FAIL with fix tasks
2. Producing skill receives fix tasks
3. Producing skill applies fixes to the artifact
4. Review protocol re-enters at Step 1 with:
   - Updated artifact
   - Previous findings history
   - Iteration count + 1
5. New findings are checked against previous findings
   - Previously fixed findings should not reappear
   - If a "fixed" finding reappears, escalate its severity by one level
```

## Convergence: How Medium/Low Findings Are Tracked

Findings that remain after PASS are not discarded. They become improvement backlog items:

```markdown
## Improvement Backlog from [GATE] Review

| Finding | Severity | Description | Target |
|---------|----------|-------------|--------|
| G1-004 | medium | AC MATCH-03 missing timeout edge case | Next spec revision |
| G1-007 | low | Inconsistent capitalization in story titles | Next spec revision |
```

These do not block progress but are tracked so they are addressed before the artifact is considered finalized.

## Token Cost Considerations

The review protocol runs at every gate. Cost depends on artifact size and iteration count.

| Component | Estimated Tokens | Notes |
|-----------|-----------------|-------|
| Step 1: Self-Review | 3K-10K | Scales with artifact size |
| Step 2: Self-Judgment | 2K-5K | Proportional to finding count |
| Step 3: Cross-Review | 5K-15K | Includes full artifact + findings in context |
| Step 4: Convergence Check | 1K-2K | Fixed overhead |
| Step 5: Gate Decision | 1K-2K | Fixed overhead |
| **Total per iteration** | **12K-34K** | |
| **Total per gate (1-3 iterations)** | **12K-100K** | Most gates converge in 1-2 iterations |

**Optimization strategies:**

- Steps 1-2 (self-review + self-judgment) run in a single agent session — no context switch cost.
- Step 3 (cross-review) is a separate agent session — context loading cost is the main expense.
- For large artifacts (change sets), review tasks independently and run cross-reviews in parallel.
- Gate checklists focus the review — agents do not free-associate; they check specific items.
- If the producing skill is high-quality, most gates pass in iteration 1 with only medium/low findings.

## Anti-Patterns

| Anti-Pattern | What it looks like | Why it is harmful | Instead |
|-------------|-------------------|------------------|---------|
| Rubber-stamping | Checklist items marked PASS without evidence. No specific artifact references. | Misses real issues. The review is theater — it looks like review happened but nothing was actually checked. | Every checklist item must have evidence (quote, line reference, or verification command output). A PASS without evidence is not a PASS. |
| Review theater | Agent produces 15 findings, all about typos and formatting. Zero structural issues identified. | Creates false confidence. Looks thorough but ignores architecture, correctness, and consistency. | Gate checklists force structural evaluation. Findings must reference checklist items, not just surface observations. |
| Infinite loops | Fix cycle keeps finding new critical issues each iteration. Artifact never converges. | Wastes tokens. Indicates the artifact or the producing skill is fundamentally broken. | Hard cap at 3 iterations. If 3 rounds of fix-and-review cannot resolve critical issues, escalate to human. The agents cannot solve this. |
| Severity inflation | Agent marks everything as critical to seem thorough or to force fixes on minor issues. | Blocks progress unnecessarily. Causes the team to distrust severity ratings. | Severity definitions are strict (see table above). A finding's severity must match the definition. Cross-review agent independently rates severity — disagreements default to the lower rating unless both say critical. |
| Severity deflation | Agent marks critical issues as medium to avoid blocking the gate. Especially common in self-judgment. | Lets broken artifacts advance. Downstream phases inherit the problem. | Cross-review agent independently rates severity. If Agent B rates a finding higher than Agent A, the higher rating wins. |
| Copy-paste agreement | Cross-review agent restates Agent A's analysis verbatim and adds "I agree." | No independent evaluation occurred. Two agents said the same thing because Agent B pattern-matched on Agent A's output rather than reading the artifact. | Cross-review prompt explicitly forbids "I agree with Agent A." Every verdict requires analysis grounded in the artifact text, not in Agent A's text. |
| Finding reuse across iterations | Same finding appears in iteration 2 and 3 with identical wording because the fix was not applied or was applied incorrectly. | Wastes iterations. Agents are not verifying that fixes landed. | When re-entering Step 1, the agent receives previous findings. If a prior critical/high finding reappears, its severity escalates and the iteration may fast-track to ESCALATE. |

## Process Summary

```
                    ┌─────────────────────────────────┐
                    │  Artifact produced by skill      │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
        Step 1      │  SELF-REVIEW                     │
                    │  Agent A reviews against          │
                    │  gate checklist                   │
                    │  Output: structured findings      │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
        Step 2      │  SELF-JUDGMENT                   │
                    │  Agent A argues with itself       │
                    │  Accept or reject each finding    │
                    │  Output: filtered findings        │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
        Step 3      │  CROSS-REVIEW                    │
                    │  Agent B independently evaluates  │
                    │  Confirms, rejects, adds new      │
                    │  Output: consolidated findings    │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
        Step 4      │  CONVERGENCE CHECK               │
                    │  Only medium/low? → PASS          │
                    │  Critical/high? → FIX + re-enter  │
                    │  3 iterations? → ESCALATE         │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
        Step 5      │  GATE DECISION                   │
                    │  PASS → state transition          │
                    │  FAIL → findings become fix tasks │
                    │  ESCALATE → human decides         │
                    └─────────────────────────────────┘
```

