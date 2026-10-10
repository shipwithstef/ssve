# land-changeset: decision logging

### Decision Logging

After the merge/wait decision is made, log it. The `run_id` comes from the active task graph.

```bash
# Merge strategy decision (mechanical — determined by repo configuration)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill land-changeset \
  --phase "<task-id>" \
  --type mechanical \
  --decision "<Merged PR #N via squash|PR #N open, waiting for approval>" \
  --reasoning "<auto-approve: solo contributor, no branch protection|team mode: reviewers assigned>" \
  --decided-by P0 \
  --overrideable false
```

