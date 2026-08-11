# Wave Closeout Validation

Use this gate when a run creates, fixes, audits, or closes a batch of related
work items and the closeout claim is "all are closed", "all follow-ups are
done", or equivalent.

The validator is intentionally repo-agnostic. Point it at the project that owns
the wave:

```bash
node scripts/validate-wave-closeout.mjs \
  --root /path/to/project \
  --from WI-284 \
  --to WI-303 \
  --expect-count 20 \
  --evidence-root docs/specs/features/test-evidence
```

For non-contiguous waves, pass an explicit list:

```bash
node scripts/validate-wave-closeout.mjs \
  --ids WI-284,WI-286,WI-303 \
  --expect-count 3
```

## Required Proof

For every WI in the wave, the gate checks:

- `docs/specs/work-items/WI-<n>.md` exists and has a terminal status.
- `docs/specs/work-items/INDEX.md` has a matching terminal row.
- `.svc/lane-tasks-WI-<n>.json` exists, is completed, and passes
  `scripts/task-graph.mjs validate` when that helper exists in the target repo.
- The WI evidence directory contains a recognized JSON runtime result, and the
  newest recognized result is zero-fail.
- `git worktree list --porcelain` has no scoped residual worktree whose path or
  branch matches the wave IDs.

Terminal statuses are `verified`, `done`, `closed`, `completed`,
`implemented`, `resolved`, `merged`, or `released`.

## Scope Tokens

By default, worktree cleanup checks each WI ID plus the range token. Use
`--worktree-scope` to add project-specific branch or directory tokens:

```bash
node scripts/validate-wave-closeout.mjs \
  --from WI-284 \
  --to WI-303 \
  --worktree-scope exploratory-testing,audit-wi-284-303
```

## Evidence Shape

The runtime artifact must be JSON and contain a recognizable pass/fail shape,
such as:

```json
{
  "stats": {
    "passed": 6,
    "failed": 0
  }
}
```

The gate fails when there is no recognized JSON result, or when the newest
recognized result contains a non-zero failure, unexpected, error, or timeout
count.
