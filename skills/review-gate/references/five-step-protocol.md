# review-gate — 5-step protocol (full templates)

## The 5-Step Protocol

### Step 1: SELF-REVIEW

Agent A (the reviewing agent — may be the same agent that produced the artifact, or a fresh session) reviews the artifact against the gate-specific checklist.

**Process:**

1. Read the artifact in full.
2. Read the gate-specific checklist (see Gate Checklists below).
3. For each checklist item, evaluate the artifact.
4. Produce findings in the structured format below.

**Finding Format:**

Each finding is a structured block. Use this exact format so findings are parseable by downstream tools and agents:

```markdown
### Finding: [GATE]-[NNN]

- **Severity:** critical | high | medium | low
- **Location:** [file path:section] or [file path:line range]
- **Description:** [One-sentence summary of the issue]
- **Justification:** [Why this is an issue — reference the specific checklist item, AC, or doctrine principle violated. Quote the problematic text.]
- **Suggested fix:** [Concrete action to resolve — not "fix this" but "add error state for network timeout to screen S3"]
```

**Severity Definitions:**

| Severity | Meaning | Examples |
|----------|---------|---------|
| Critical | Artifact is structurally broken or violates a doctrine invariant; cannot proceed | Missing acceptance criteria, code doesn't match design, untestable story, placeholder content |
| High | Significant gap that will cause downstream failure if not fixed | Missing error states, incomplete dependency mapping, AC that contradicts another AC |
| Medium | Quality issue that should be fixed but won't block downstream phases | Ambiguous wording, missing edge case AC, inconsistent naming |
| Low | Minor polish that can be addressed later | Typos, formatting inconsistencies, verbose descriptions |

**Rules for Step 1:**

- Every checklist item must be evaluated. The review is complete when every item has a PASS or a finding. Minimum coverage: 100% of checklist items examined.
- Maximum 20 findings. If you find more than 20, the artifact likely needs a rewrite, not a review. Flag this as a single critical finding: "Artifact requires rewrite — [reason]."
- Every finding must reference a specific location in the artifact. "The spec is vague" is not a finding. "Section 'User Stories', US-3: AC MATCH-07 is untestable because 'works correctly' has no measurable condition" is a finding.
- Zero findings is a valid outcome for strong artifacts. Do not manufacture findings to meet a quota. If the artifact passes every checklist item, say so. The convergence check handles this.

### Step 2: SELF-JUDGMENT

Agent A reviews its own findings from Step 1. For each finding, the agent must argue against itself — genuinely evaluate whether the finding holds up under scrutiny.

**Judgment Format:**

```markdown
### Judgment: [GATE]-[NNN]

- **Verdict:** ACCEPT | REJECT
- **Analysis:** [Why this finding is valid, or why it was a false positive. If rejecting, explain what you got wrong. If accepting, explain why the issue genuinely matters — do not just restate the finding.]
```

**Rules for Step 2:**

- If you produced more than 5 findings, critically re-examine whether each adds real value. Rejecting weak findings is good, not failure.
- A rejected finding means you recognized a false positive — this is good, not failure.
- The analysis must add information beyond the original finding. "This is valid because it's an issue" is not analysis. "This is valid because AC MATCH-03 requires response within 200ms but the design specifies a synchronous database query that will exceed this under load" is analysis.
- Do not downgrade severity as a compromise. If a finding is critical, accept it as critical or reject it entirely. Downgrading to "get it through" is review theater.

**Output of Step 2:** A list of accepted findings (with analysis) and rejected findings (with reasoning). Only accepted findings carry forward.

### Step 3: CROSS-REVIEW

Agent B receives the artifact, Agent A's findings, and Agent A's self-judgments. Agent B is a fresh perspective — a different agent session with no memory of producing or initially reviewing the artifact.

**Cross-Review Agent Prompt Template:**

Use this prompt to invoke the cross-review agent (Agent B). Pass the full content of the artifact and the Step 1-2 output.

```markdown
You are a cross-review agent for the Serious Vibe Coding review protocol. You are Agent B.

## Your Role

You are reviewing an artifact that Agent A has already reviewed. You have:
1. The artifact itself
2. Agent A's findings (with severity, location, justification)
3. Agent A's self-judgments (accept/reject with analysis)

## Your Task

### Part 1: Evaluate Agent A's Accepted Findings

For each of Agent A's ACCEPTED findings, produce:

### Cross-Review: [GATE]-[NNN]

- **Verdict:** ACCEPT | REJECT
- **Analysis:** [Your independent assessment. Do not defer to Agent A. If you agree, explain why from YOUR reading of the artifact. If you disagree, explain what Agent A missed or overcounted.]

### Part 2: New Findings

Identify issues Agent A missed entirely. Use the same finding format:

### Finding: [GATE]-[NNN] (new)

- **Severity:** critical | high | medium | low
- **Location:** [file path:section or line range]
- **Description:** [One-sentence summary]
- **Justification:** [Why this is an issue]
- **Suggested fix:** [Concrete action]

## Rules

- You must independently evaluate each finding. "I agree with Agent A" is not analysis.
- Producing new findings is encouraged but not mandatory. If the artifact is genuinely excellent and Agent A's review was thorough, confirming with zero new findings is a valid outcome.
- Do not rubber-stamp. If Agent A accepted a weak finding, reject it and explain why.
- Do not inflate severity to appear thorough. Rate honestly.
- Reference specific locations in the artifact for every decision.

## Artifact

[INSERT FULL ARTIFACT CONTENT]

## Agent A's Findings and Judgments

[INSERT STEP 1 AND STEP 2 OUTPUT]

## Gate Checklist

[INSERT GATE-SPECIFIC CHECKLIST FROM THE REVIEW PROTOCOL SKILL]
```

**Output of Step 3:** A consolidated findings list:
- Agent A findings accepted by both A and B (confirmed)
- Agent A findings accepted by A but rejected by B (disputed — treat as rejected unless severity is critical)
- Agent B new findings (added to the list)

### Step 4: CONVERGENCE CHECK

Evaluate the consolidated findings from Step 3 against the convergence criteria.

**Convergence Criteria:**

```
IF   all remaining findings are medium or low severity
THEN → PASS (proceed to Step 5 with PASS recommendation)

IF   any critical or high severity findings remain
THEN → FIX and re-enter Step 1 with:
       - The fixed artifact
       - The findings history (all prior iterations)
       - Iteration counter incremented

IF   iteration count = 3 and critical/high findings still remain
THEN → ESCALATE to human with:
       - Full findings history (all 3 iterations)
       - The current artifact
       - Summary of what was fixed and what remains
```

**Iteration Tracking Format:**

```markdown
## Convergence Status

- **Gate:** [G1-G7]
- **Artifact:** [file path]
- **Iteration:** [1|2|3] of 3
- **Findings summary:**
  - Critical: [count]
  - High: [count]
  - Medium: [count]
  - Low: [count]
- **Decision:** PASS | FIX-AND-REENTER | ESCALATE
- **Rationale:** [Why this decision — list the critical/high findings that block, or confirm only medium/low remain]
```

**Rules for Step 4:**

- Medium and low findings do not block. They are recorded and become improvement tasks, but the artifact advances.
- Disputed findings (Agent A accepted, Agent B rejected) are treated as resolved unless severity is critical. Critical disputed findings escalate to human.
- The 3-iteration cap is hard. No exceptions. If the artifact cannot pass in 3 iterations, a human must decide — the agents have demonstrated they cannot converge.

**Stall detection:** If the issue count does not decrease between consecutive review passes, escalate immediately to the user instead of continuing to max iterations. A flat or increasing issue count means the fixes are introducing new problems — more iterations will not converge.

### Step 5: GATE DECISION

Based on the convergence check, issue the final gate decision.

**Gate Decision Format:**

```markdown
## Gate Decision: [G1-G7]

- **Artifact:** [file path]
- **Decision:** PASS | FAIL | ESCALATE
- **New state:** [target state if PASS] | [current state if FAIL] | [current state, pending human if ESCALATE]
- **Iterations completed:** [1-3]
- **Findings resolved:** [count]
- **Findings remaining (medium/low):** [count]
- **Findings escalated (critical/high):** [count, 0 if PASS]

### Remaining Findings (informational)

[List medium/low findings as improvement tasks — these do not block but should be tracked]

### Fix Tasks (if FAIL)

[List critical/high findings as concrete fix tasks with owners and suggested actions]

### Escalation Package (if ESCALATE)

[Full findings history across all iterations, current artifact state, what was tried, what remains unresolved]
```

**Decision Rules:**

| Decision | Condition | Effect |
|----------|-----------|--------|
| PASS | Only medium/low findings remain | Artifact transitions to next state. Remaining findings become backlog improvement tasks. |
| FAIL | Critical/high findings remain, iterations < 3 | Artifact stays in current state. Findings become fix tasks. After fixes, re-enter Step 1. |
| ESCALATE | Critical/high findings remain after 3 iterations | Artifact stays in current state. Human receives full findings history and makes the call. |


## Phase receipt commands

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-GateContextChecklistConcernScan --evidence command_output:.svc/review-gate-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SelfReviewFindings --evidence command_output:.svc/review-gate-self-review.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SelfJudgment --evidence command_output:.svc/review-gate-self-judgment.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CrossReviewConvergence --evidence command_output:.svc/review-gate-cross-review.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-GateDecisionBacklog --evidence command_output:.svc/review-gate-decision.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/review-gate-self-verify.log
```
