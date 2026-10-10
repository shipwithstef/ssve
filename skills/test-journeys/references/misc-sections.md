### Step 4: Update Feature Specs (Source of Truth)

Write QA column statuses in AC tables:
- `✅ MM-DD`
- `✅ MM-DD (code) path:line`
- `❌ MM-DD`
- `⚠️ MM-DD`
- `⏭️ reason`
- `—`

For failures, add bug blockquotes directly under the relevant AC section.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

## Feature Validation Ledger Handoff

When a user-facing or admin-facing feature graph requires
`feature_validation_closeout`, write runtime results so they can be copied
directly into `FEATURE_VALIDATION_LEDGER.md`:

| AC ID | Journey scenario(s) | Runtime result | Evidence path(s) |
|---|---|---|---|
| `<AC-ID>` | `<journey file + scenario/tag>` | `PASS|FAIL|BLOCKED — <summary>` | `<report/screenshot/log path>` |

Every blocked or failed runtime result must name the follow-up WI. Do not leave
the ledger to infer coverage from a generic browser smoke summary.
