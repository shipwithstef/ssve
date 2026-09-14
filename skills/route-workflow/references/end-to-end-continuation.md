# End-To-End Continuation Decisions

Use this contract when `execution_mode: end_to_end` discovers same-lane work
after a verification, review, or closeout seam. The goal is to keep continuing
without asking permission while still leaving an audit trail for why the next
step remained inside the original commitment.

## Decision Record Shape

Append the record to `.svc/pipeline-decisions.jsonl` with `skill:
"route-workflow"` and `kind: "mechanical"`:

```json
{
  "ts": "2026-05-12T00:00:00Z",
  "skill": "route-workflow",
  "wi": "WI-123",
  "kind": "mechanical",
  "decision": "auto-continue after verification gap",
  "details": {
    "end_to_end_continuation": {
      "original_commitment_phrase": "continue until verified",
      "seam_crossed": "verification",
      "gap_classification": "same-lane-follow-up",
      "next_action": "run the newly discovered validator",
      "recursion_depth": 1,
      "recursion_limit": 3,
      "blast_radius": {
        "destructive_git": false,
        "paid_spend": false,
        "schema_or_data_risk": false,
        "security_escalation": false,
        "pause_required": false
      }
    }
  }
}
```

Validate with:

```bash
node scripts/validate-end-to-end-continuation.mjs \
  --decisions .svc/pipeline-decisions.jsonl \
  --lane-tasks .svc/lane-tasks-<WI>.json
```

## Recursion Limits

Default continuation limit: `recursion_limit: 3` per WI and seam. If the third
same-seam continuation still discovers new implementation work, stop automatic
continuation and escalate by filing or updating a child WI with the current
evidence.

Use `recursion_depth: 0` for the first continuation after the original planned
task, then increment for each follow-up discovered by the previous follow-up.

## Blast-Radius Pause Thresholds

End-to-end mode does not authorize all action. Set `pause_required: true` and
stop for explicit user approval when any of these fields are true:

| Field | Pause When |
|---|---|
| `destructive_git` | The next action deletes branches, force-pushes, rewrites history, resets worktrees, or removes unmerged work. |
| `paid_spend` | The next action can spend money, trigger paid provider usage, or change billing state. |
| `schema_or_data_risk` | The next action changes schema, production data, migrations, auth rules, or persistent storage semantics. |
| `security_escalation` | The next action changes security posture, access controls, secrets, RLS, OAuth callbacks, or public exposure. |

If no threshold is crossed, keep working and record the continuation decision
before mutating the next artifact.
