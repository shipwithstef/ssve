# Skill Outcome Contract

Major graph-affecting skills emit a machine-readable `skill_outcome` when they
discover new routing signals, evidence obligations, contradictions, or closeout
state changes. `route-workflow` applies the outcome with
`scripts/apply-skill-outcome.mjs`, which uses `scripts/state-io.mjs` locking and
appends every mutation to `delivery_graph.mutation_history`.

Minimum shape:

```json
{
  "skill_outcome": {
    "skill": "diagnose-bug",
    "status": "pass|partial|blocked|fail",
    "signals_added": ["browser-visible", "graph-mismatch"],
    "artifacts_produced": ["docs/specs/..."],
    "validator_proof": "command or artifact proving the signal",
    "graph_mutations_requested": [
      {
        "action": "insert_task",
        "target": "track-visuals",
        "signal": "browser-visible",
        "reason": "The bug changes browser-visible behavior.",
        "affected_evidence_families": ["visual"],
        "validator_proof": "diagnose-bug reproduction notes"
      }
    ],
    "closeout_impact": "framework-complete|runtime-accepted|corrective-closure-complete|blocked"
  }
}
```

Supported mutation actions:

| Action | Effect |
|---|---|
| `insert_task` | Adds a required skill task if absent. |
| `mark_n_a` | Marks an evidence family or skill as N/A with proof. |
| `escalate_review` | Inserts the requested review task. |
| `reclassify_lane` | Updates the graph lane. |
| `return_to_prior_gate` | Reopens the target gate and downstream tasks. |
| `block_until_user_input` | Blocks the graph until the user answers. |
| `block_on_discovery` | Blocks the graph on a validated `BLOCKING_DISCOVERY`, records the artifact, and inserts the follow-up routing skill. |
| `close_as_runtime_accepted` | Records runtime-accepted closeout impact. |
| `close_as_corrective_closure_complete` | Records corrective closure impact. |
| `close_as_framework_complete` | Records framework-complete closeout impact. |

Every mutation history entry records source skill, signal discovered, reason,
affected tasks, affected evidence families, and validator proof.

For `block_on_discovery`, first emit and validate
`.svc/blocking-discovery-<parent-WI>.json` per
`references/blocking-discovery-format.md`. The mutation must include `artifact`
and either `follow_up_wi` or `follow_up_status: needs-wi`.
