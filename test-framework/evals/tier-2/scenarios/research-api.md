# Scenario: research-api

## Setup
<!-- Describe the fixture state or scaffold needed -->
A skill encounters uncertainty during execution (e.g., the `design-tech` skill needs to know how Kimi Code CLI handles PreToolUse hooks). Ensure `docs/specs/research-log.md` does not already contain an answer to this exact question.

## Invocation
<!-- The exact prompt or command sent to the agent -->
"Research how Kimi CLI hooks work" or "Find out how Kimi Code CLI PreToolUse hooks are configured."

## Expected Behavior
<!-- 5 assertions with MUST-level specificity -->
1. The agent MUST produce structured findings that include one or more source URLs pointing to official documentation, release notes, or authoritative repository files.
2. The agent MUST append or update `docs/specs/research-log.md` with the findings, including the research question, date, and answer summary.
3. The agent MUST include a confidence level (e.g., HIGH, MEDIUM, LOW) with a brief rationale for that rating.
4. The agent MUST cite actual documentation or source files; citations MUST NOT rely solely on training-data recollection without an external source.
5. The agent MUST record a `research` phase receipt in the lane task graph; validation can use `jq -e '.tasks[] | select(.metadata.skill == "research" or .skill_receipt.skill == "research") | .skill_receipt.phases_executed[]? | select(.id == "P1-InvocationReceiptModeFrame")' .svc/lane-tasks-<WI>.json`.

## Success Criteria
<!-- Pass/fail checklist -->
- [ ] Research output contains at least one `https://` or `http://` source URL
- [ ] `docs/specs/research-log.md` exists and contains an entry for the researched question
- [ ] Confidence level is stated explicitly (HIGH / MEDIUM / LOW)
- [ ] Findings are grounded in documentation, not generic training-data paraphrasing
- [ ] Log entry includes a timestamp or session identifier
- [ ] `.svc/lane-tasks-<WI>.json` contains a `research` `phases_executed` receipt for `P1-InvocationReceiptModeFrame`
