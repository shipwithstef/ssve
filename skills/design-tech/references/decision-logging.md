### Decision Logging

After the technical design is written into the spec, log each Technology Decisions table row. The `run_id` comes from the active task graph.

```bash
# Each technology decision row (taste when alternatives existed, mechanical when obvious)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill design-tech \
  --phase "<task-id>" \
  --type "<taste|mechanical>" \
  --decision "Tech decision: <what was decided> — chose <choice>" \
  --reasoning "<rationale from the table's Rationale column>" \
  --decided-by P0 \
  --alternatives-json '["<alt 1>", "<alt 2>"]' \
  --overrideable true
```

Also log the feasibility matrix summary (how many ACs feasible/infeasible/mitigated) as a single `gate-result` entry.
