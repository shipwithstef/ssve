# execute-changeset — exact dispatch preflight

Before any implementation, bind the exact WI to its active authorized review
log and resolve the current repository-owner EXEC tuple:

```bash
dispatch_json="$(bash scripts/execute-dispatch-preflight.sh "$PWD" "<wi-id>")"
host="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).host)' "$dispatch_json")"
model="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).model)' "$dispatch_json")"
effort="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).effort)' "$dispatch_json")"
```

The one-line schema-v2 JSON also binds `wi`, `manifest`, `manifest_sha256`,
`review_log_sha256`, `policy_sha256`, `mode`, `orchestrator`, and `family`.
Missing, ambiguous, unreviewed, stale, or post-review-mutated authority exits
nonzero; there is no permissive `not-required` result.

Dispatch the exact returned host through the evidence writer:

```bash
SVC_WORKER_WI="<wi-id>" \
  bash scripts/dispatch-log.sh "$host" execute-changeset @<payload-file>
```

For the current owner policy this may be Grok 4.6 High, but adapters never
hardcode that choice. The Grok transport uses `--permission-mode auto`,
`--no-subagents`, `--disable-web-search`, and `--single`; it never uses an
approval bypass. `execute-changeset` is always mutating: the logger refuses to
launch without a persisted delegation, containment policy, one-time child token,
and completion receipt path. The logger fsyncs the exact manifest/policy/review/
mode/orchestrator/tuple/exit receipt, and the commit guard re-resolves those
values before allowing staged `src/` changes.

A repository-owner emergency override remains explicit and WI-bound:

```bash
node scripts/resolve-execute-dispatch.mjs record-override \
  --repo "$PWD" --wi "<wi-id>" \
  --allow-override-file /secure/path/override.json
```

The override cannot bypass a non-authorized review log and cannot masquerade as
a resolved tuple.



This skill takes the implementation manifest from `plan-changeset` and carries
it out directly in the worktree. It stages one task at a time, reviews the staged
diff, creates a checkpoint commit when the task is accepted, and moves to the next task.

**Announce at start:** "I'm using the execute-changeset skill to apply the implementation plan directly in the worktree."
