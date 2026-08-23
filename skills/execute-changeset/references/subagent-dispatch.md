# execute-changeset — Execution architecture detail (model assignment, inner worktrees, subagent context, enrichment)

## Execution Architecture

### Model assignment

| Role | Model | Effort | What it does |
|------|-------|--------|-------------|
| **Orchestrator** | current controller | owner policy | Reads manifest, identifies groups, persists delegation, and runs holistic review |
| **Implementor** | repository-owner EXEC tuple | resolved effort | Receives task + file constraints, writes test → writes code → runs test → commits |

The orchestrator coordinates governed delegated work. The implementor tuple is
resolved at invocation time; adapters do not remap it to a historical model.

**CRITICAL ORCHESTRATOR CONSTRAINT:** Mutating children MUST be launched through the durable delegation and containment path. Persist the parent-to-child edge before launch, use a stable child principal and one-time acceptance token, and explicitly pass the file scope. If host capability validation denies child mutation, execute under the controller.

Example invocation:
```bash
SVC_WORKER_MUTATION=true SVC_WORKER_WI="$wi" SVC_DELEGATION_ID="$delegation_id" SVC_DELEGATION_STATE_ROOT="$state_root" SVC_DELEGATION_CHILD_PRINCIPAL="$child_principal" SVC_DELEGATION_TOKEN="$one_time_token" SVC_EXECUTION_GRAPH="$execution_graph" SVC_HOST="$orchestrator" SVC_DELEGATION_VALIDATION="$validation_command" SVC_DELEGATION_COMPLETION_OUT="$completion_receipt" bash scripts/dispatch-log.sh "$resolved_host" execute-changeset @"$payload_file"
```

The dispatcher refuses a mutation-bearing launch before selecting a harness or reading provider credentials when any persisted-delegation field is absent. Set `SVC_WORKER_MUTATION=false` only for an explicitly read-only worker. If a complete tuple cannot be issued, run the task in the controller session.

Delegated write grants are directory-scoped (`path/**`). Exact-file CREATE,
MODIFY, and DELETE tasks stay controller-owned: ordinary editors create sibling
temporary files and atomically rename them, while granting the parent directory
would widen authority to unrelated siblings.

### Task graph execution

```
1. Read manifest → extract task graph with dependencies
2. Build the nested execution graph with `scripts/plan-execution-wave.mjs`
3. For each wave:
   a. Require pairwise-disjoint known scopes after dependency expansion
   b. Serialize overlaps and shared/unknown scopes
   c. Create one delegated inner worktree per concurrently mutating child
4. Wait for group to complete
5. Merge inner worktrees if used
6. Move to next group (which may depend on this one)
7. After ALL groups: holistic review
```

### Delegated inner worktrees

Every mutating child uses its own inner worktree. Overlapping tasks never share
a wave; isolation is not permission to race conflicting scopes.

```
.worktrees/feature-payments/                    (parent — execution branch)
  ├── .worktrees/task-3-validator/              (inner — isolated)
  ├── .worktrees/task-4-webhook/                (inner — isolated)
  └── .worktrees/task-5-receipt/                (inner — isolated)
```

The orchestrator decides:
- **Disjoint, known file sets** → independent inner worktrees in one wave
- **Overlapping or shared files** → dependency-ordered serialized waves
- **Hydration dependency** (task B needs types from task A) → task A runs
  first, task B gets its output via the dependency graph

Issue capabilities with `scripts/dispatch-execution-task.mjs issue` before
launch. Children accept once, commit only allowed paths, then use `complete` to
emit a receipt. The parent runs `scripts/validate-execution-merge-back.mjs`,
recomputes ancestry, file set, diff digest, validation, and cleanliness, and
merges sequentially. A conflict becomes `merge_rejected` and is remediated as a
serialized controller task.

### Subagent context (what each implementor receives)

Each implementor subagent gets ONLY what it needs. The orchestrator constructs
the prompt using this exact template:

```
You are implementing one task from a feature implementation plan.

## Your constraints
- Write code ONLY for the files listed below. Do not create files not in the file list.
- Do NOT grep, find, or scan the codebase. You have all the context you need below.
- Do NOT read files not listed in your context. If you encounter an unknown import,
  report it back to the orchestrator — do not resolve it yourself.
- Follow the style contract exactly. Do not invent conventions.
- TDD: write the test FIRST, run it (must FAIL), then write implementation (must PASS).
- Search before building: when a task requires infrastructure, middleware, or
  patterns not in the style contract, STOP and check three layers before writing code:
  **Layer 1 — Framework built-in:** Does the runtime/framework already provide this?
    (Example: Express has `express-rate-limit`, Next.js has `middleware.ts`, Django has `@login_required`)
  **Layer 2 — Established library:** Is there a well-adopted package for this?
    (Check package.json/requirements.txt first, then search if needed)
  **Layer 3 — Build from scratch:** Only if L1 and L2 genuinely don't apply.
  The cost of checking is near-zero. The cost of reinventing is 100+ wasted LOC
  that a one-liner would have replaced — plus maintenance debt the builder inherits.
  If you find a built-in or library, USE IT. Do not build a "simpler" custom version.

## Style contract
[INSERT docs/specs/style-contract.md content]

## Changeset Blueprint
[INSERT the precise, context-rich diff or CREATE payload from the manifest's Changeset Blueprint section for this task]

## Execution Command Sequence
[INSERT the copy-pasteable, non-interactive shell commands for this task]

## RECOVERY_IF_FAIL Instructions
[INSERT the pre-programmed rollbacks or self-healing commands for this task]

## Existing code (targeted files only)
[INSERT content of ONLY the files listed in this task's "touched files". Nothing else.]

## File list (you may ONLY create/modify these files)
[INSERT the touched files from the manifest for this task]

## Validation command
[INSERT the validation command for this task]
```

This is ~10K tokens or less per subagent. All high-level specifications (Acceptance Criteria, Tech Design, UX, UI) are completely stripped to isolate the implementer and prevent token context degradation.

**The "do not scan" constraint is critical.** Without it, a Sonnet subagent
encountering an unfamiliar import will grep the entire codebase to resolve it,
wasting 20-50K tokens. The constraint forces it to report back instead, letting
the orchestrator provide the specific file on demand.

### Adaptive Context Enrichment (1M Models)

When the context window is 500K+ tokens (Opus 4.8 1M tier, Sonnet 4.6 with 1M context):

- **Executor subagents** receive prior task summaries from the same changeset, the full spec context, and AC mappings — enabling cross-task awareness
- **Reviewer subagents** receive all task files + summaries + the full feature spec — enabling history-aware review

At standard 200K windows, use truncated versions with cache-friendly ordering (most relevant context first). Do not inline large files — tell agents to read from disk.

## Task Execution Model

Each task in the manifest defines:

- task id and title
- touched files
- dependencies (other task IDs)
- AC slice covered
- validation command
- checkpoint name
- parallel group (tasks in the same group can run concurrently)



## Claude-host note (WI-373)
Read-only analysis fan-outs route through the native Workflow tool — see `references/workflow-fanout-protocol.md`. The shell transport below remains for non-Claude hosts and for mutating parallel groups (inner worktrees).
