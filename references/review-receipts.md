# Review Receipts

Framework PR merges require a machine-readable review-gate receipt before
`gh pr merge` runs. The Bash guard checks this at merge time so review-gate is
not just a skill instruction.

## Eligible Receipt Paths

- `.svc/review-receipts/pr-<number>.json`
- `docs/specs/reviews/pr-<number>-review-gate.json`

`.svc/` receipts are local merge-time evidence. `docs/specs/reviews/` receipts
are durable repo evidence when a team wants the review artifact committed.

## Schema

```json
{
  "pr": 123,
  "review_gate_required": true,
  "review_gate_task": "G5",
  "reviewer": "plan-reviewer",
  "reviewed_at": "2026-05-12T10:00:00Z",
  "result": "PASS",
  "self_review": false,
  "evidence": [
    "review-gate/SKILL.md",
    "test-framework/evals/tier-1/run.log"
  ]
}
```

`self_review: true` is never merge-eligible. Emergency bypasses must be logged
in `.svc/pipeline-decisions.jsonl` with `review_gate_bypass: true`, `pr`,
`reasoning`, and `approved_by`.
