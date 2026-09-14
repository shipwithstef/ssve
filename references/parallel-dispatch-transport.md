# Parallel Dispatch Transport

Use this reference when `dispatch-waves` receives multiple WIs.

## Transport Table

| Scenario | Transport | Why | Task-State Rule |
|---|---|---|---|
| Tiny WI under `SVC_DISPATCH_MIN_COST` minutes | `local-inline` | Worker cold-start costs more than the work | Parent session owns task mirror |
| 2-3 independent WIs with shared project context | `subagent` | Fast enough and context sharing is useful | Worker writes files and result JSON; parent re-mirrors |
| Kimi-native worker requested or long detached run | `detached-kimi` | Existing detached Kimi runner handles reclaimable background work | Result JSON is the coordination channel |
| 4+ independent WIs or cross-repo execution | `headless-worker` | Fresh context avoids parent bloat | Set `SVC_SUBAGENT=1`; file state only |

Default concurrency: `SVC_MAX_WORKERS` or `3`.

Default inline threshold: `SVC_DISPATCH_MIN_COST` or `5` minutes.

This table selects coordination transport, not mutation authority. A mutating
worker additionally requires its own stable principal, active generation-bound
delegation, exact inner worktree, allowed path scope, and a real host sandbox or
contained command wrapper. Unsupported hosts remain controller-only.

## Required Extraction

Before dispatch, each WI must have:

- `affected_files`: declared frontmatter, an `Affected Files` section, or paths
  extracted from the body.
- one-hop dependency expansion where files exist and use relative imports.
- shared-resource classification.

Unknown scope blocks dispatch. Do not send a worker to discover its own write
scope from scratch.

## Shared Resource Serializers

Any WI touching these paths is serialized:

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `tsconfig*.json`
- `vite.config.*`
- `tailwind.config.*`
- `migrations/**`
- `e2e/fixtures/**`
- `.env*`

## Merge-Back

Workers write `.svc/dispatch/<WI>.result.json` with `wi`, `status`,
`changed_files`, `validation_evidence`, `clean_worktree`,
`parent_graph_mutation`, and `worker_summary`.

The parent session reads worker results and mutates lane-task files
sequentially. Workers do not modify the parent graph, lease, sibling results,
shared receipts, or parent-session UI tools. If `SVC_SUBAGENT=1`
is set, skip TaskUpdate/TaskList/update_plan mirroring and rely on repo files.
When `SVC_WORKER_WI=<WI>` is set, the Stop completion guard scopes itself to
that WI and direct child graphs only.

`dispatch-worker.sh` writes these worker-side artifacts when `SVC_WORKER_WI` is
set:

- `.svc/dispatch/<WI>.result.json`
- `.svc/dispatch/<WI>.edits.json`
- `.svc/dispatch/<WI>.log`
- `.svc/dispatch/wave-progress.jsonl`

If `SVC_SKIP_WORKER_QUALITY=1`, the result marks per-worker quality as skipped
and requires orchestrator rollup. `hooks/svc-stop-quality.js` reads worker
`*.edits.json` files so the parent session can run one consolidated quality
check over the wave edits.

Planner output records `worker_model`, `runtime_resources`, and
`runtime_assignment` for each dispatchable WI. Base44 `TEST_STREAM` and browser
daemon slots are serialized when shared; independent workers receive distinct
assignment names.

## Failure Semantics

| Failure | Parent behavior |
|---|---|
| timeout | mark `failed:timeout`, keep result/log path |
| non-zero exit | mark `failed:error`, keep stderr tail |
| dirty worktree | mark `failed:dirty-tree`, keep stash/ref details |
| missing result | mark `failed:missing-result` |
| upstream failure | leave dependents `blocked:upstream-failed` |

Successful WIs do not roll back because a peer failed. Land one PR per WI unless
the user explicitly asks for a consolidation PR.

For multiple leaf tasks inside one WI, use the nested execution graph and
delegation receipt protocol in `execute-changeset/references/subagent-dispatch.md`.
The existing parallel-WI plan remains the outer coordination layer.
