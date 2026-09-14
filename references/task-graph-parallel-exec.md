# Native Workflow execution over the manifest task graph (WI-388 core)

execute-changeset's parallel architecture (parallel groups, inner worktrees, Sonnet
subagents via `dispatch-worker.sh`) is dead: `.svc/dispatch-log.jsonl` = 5 entries,
all opus-override inline. The transport is why — `claude -p` is auth-dead (WI-357).
Native `agent(prompt, {isolation:'worktree', schema})` runs **in-session on
subscription** and IS the inner-worktree design already specified in
`execute-changeset/SKILL.md`. This is **mutating** parallel work, now permitted on
isolated/worktree transport per the S5 policy (recorded 2026-06-09).

**Scope:** the SINGLE-WI, intra-changeset core. The multi-WI-wave economics half is
WI-374 F-01 (user-frozen) and is **explicitly NOT in scope here** — the single-WI
core runs in-session on subscription, which WI-374's own analysis blesses as the
primary port target, so it needs no credit-cost model.

## The mechanism
1. **Partition (the HARD fence — AC1).** `node scripts/partition-task-graph.mjs
   --graph <task-graph.json>` computes the file-set per task node and partitions
   into dependency-ordered waves. A wave is parallel ONLY if its task file-sets are
   pairwise DISJOINT (the closed-loop `scripts/lib/disjoint-scopes.mjs` primitive,
   shared with WI-387). **Any overlap ESCALATES THAT WAVE TO SEQUENTIAL** — the
   single validator is the difference between fenced and vibes. A cycle / unknown
   dep fails closed.
2. **Dependencies → `pipeline()` stage order (AC2).** The wave levels ARE the
   pipeline stages; a task runs only after every dependency's wave. Never
   `parallel()` across a dependency edge.
3. **Dispatch (Claude host).** Each task in a parallel wave is an
   `agent(prompt, {isolation:'worktree', schema: task-node-result})` call. Results
   are **schema-forced** (`schemas/task-node-result.schema.json`) — no
   grep-for-SVC_WORKER_SUMMARY (AC4).
4. **Sequential merge-back.** Worktree checkpoints merge back one at a time (the
   `files_written` of each result MUST be a subset of its partitioned file-set; a
   write outside it is a partition violation the merge rejects). Then the
   holistic review stack runs UNCHANGED — the whole verification stack is
   downstream of the merge.

## Gates (AC3)
- The **Step-0c delegation contract** gates whether parallel is allowed at all.
- **Non-Claude hosts keep `dispatch-worker.sh` / the sequential path** — native
  `agent()` worktree isolation is a Claude-host capability.

## Reconcile with WI-380
WI-380 is STAGE-level context isolation (the chain's plan/exec/land segments);
this is INTRA-stage TASK-level parallelism inside execute-changeset. They compose:
a stage-isolated execute-changeset segment may itself run its task graph in
parallel via this partition. The disjoint fence keeps the task wave safe.
