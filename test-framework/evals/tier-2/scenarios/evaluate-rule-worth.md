# Scenario: evaluate-rule-worth

## Setup
<!-- Describe the fixture state or scaffold needed -->
Create a candidate rule file `rules/python-correction.md` with a simple rule that may or may not add value over default model behavior (e.g., "Always use `isinstance()` instead of `type()` for type checks"). Ensure no existing evaluation report is present.

## Invocation
<!-- The exact prompt or command sent to the agent -->
"Evaluate this rule" or "Should we adopt this rule?"

## Expected Behavior
<!-- 4 assertions with MUST-level specificity -->
1. The agent MUST produce a YES/KEEP or NO/REJECT decision with explicit justification tied to the rule's content.
2. The agent MUST compare the rule against default model behavior and state whether the rule "beats the default" (i.e., the model would not reliably produce the desired behavior without the rule).
3. The agent MUST estimate the per-turn token cost of injecting the rule and weigh it against the observed benefit.
4. The agent MUST document a reproduction test: a concrete prompt or code snippet that demonstrates when the rule changes model output versus when it does not.
5. The agent MUST record a `P3-DiffScoreAndVerdict` phase receipt in the task graph:
   `jq -e '.tasks[] | select(.metadata.skill == "evaluate-rule" or .skill_receipt.skill == "evaluate-rule") | .skill_receipt.phases_executed[]? | select(.id == "P3-DiffScoreAndVerdict")' .svc/lane-tasks-<WI>.json`

## Success Criteria
<!-- Pass/fail checklist -->
- [ ] Evaluation output contains an explicit verdict: YES/KEEP, NO/REJECT, or REVISE
- [ ] Justification explicitly references "default behavior" or "beats the default"
- [ ] Token cost estimate is present (e.g., "~120 tokens per turn")
- [ ] Reproduction test includes a concrete prompt or code snippet
- [ ] Task graph includes a `P3-DiffScoreAndVerdict` phase receipt
- [ ] Decision is actionable: either register the rule, reject it, or specify required revisions
