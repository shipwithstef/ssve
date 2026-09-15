# execute-changeset — Execution architecture detail (model assignment, inner worktrees, subagent context, enrichment)

## Execution Architecture

### Model assignment

| Role | Model | Effort | What it does |
|------|-------|--------|-------------|
| **Orchestrator** | existing owner-configured resolver; dated recipes are nonauthoritative | as resolved | Reads the sealed v5 contract, identifies groups, spawns subagents via `scripts/dispatch-worker.sh`, runs holistic review |
| **Implementor** | existing `resolve-model.sh EXEC`; after Deterministic Transmutation a lighter EXEC tuple is advised; recipes are nonauthoritative | as resolved | Receives task + file constraints, writes test → writes code → runs test → commits |

On the explicitly selected dispatch path, the orchestrator coordinates and implementor subagents write code. Inline execution remains controller-owned. Routing stays on existing owner config; after Deterministic Transmutation, EXEC is the remaining lighter implementation work. Dated recipes are nonauthoritative.

**CRITICAL ORCHESTRATOR CONSTRAINT:** Mutating children MUST be launched through the durable delegation and containment path. Persist the parent-to-child edge before launch, use a stable child principal and one-time acceptance token, and explicitly pass the file scope. If host capability validation denies child mutation, execute under the controller.

Example invocation:
```bash
SVC_WORKER_MUTATION=true SVC_WORKER_WI="$wi" SVC_DELEGATION_ID="$delegation_id" SVC_DELEGATION_STATE_ROOT="$state_root" SVC_DELEGATION_CHILD_PRINCIPAL="$child_principal" SVC_DELEGATION_TOKEN="$one_time_token" SVC_EXECUTION_GRAPH="$execution_graph" SVC_HOST="$host" SVC_DELEGATION_VALIDATION="$validation_command" SVC_DELEGATION_COMPLETION_OUT="$completion_receipt" SVC_WORKER_SKILL="execute-changeset" SVC_WORKER_MODEL="claude-sonnet-4-6" bash scripts/dispatch-worker.sh "Execute Task 3. Target ONLY these files: src/app/auth.tsx. Task details: [insert task intent from manifest]"
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

### Original clauses before dispatch

Alongside the complete dispatch blueprint, include the applicable ORIGINAL AC/UX/technical text and source references. Preserve temporal behavior, manual overrides, ownership, transaction and performance constraints verbatim. Read targeted imports within the permitted repository context; never treat read permission as a widened write grant. Dispatch still requires a complete task packet and durable isolated delegation. `prepare-plan-handoff --task` requires the verified seal. Inline's later local repair is not permission to send an incomplete child packet or to apply an amendment without reopening the affected source decision/contract.

### Subagent context (what each implementor receives)

Each implementor subagent gets ONLY what it needs. The orchestrator constructs
the prompt using this exact template:

```
You are implementing one task from a feature implementation plan.

## Your constraints
- Write code ONLY for the files listed below. Do not create files not in the file list.
- Read targeted in-repo imports and relevant callers when needed; avoid broad rescans.
- Read permission never widens the exact write list or delegated worktree boundary.
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

## Original requirements and reviewed context
[INSERT applicable original AC/UX/technical clauses verbatim with source references;
for sealed v5 use prepare-plan-handoff --task output (requires verified seal; must not rewrite reviewed bytes). Dispatch retains its complete
packet below; the helper is not a historical v1–4 execution reader.]

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

Keep the handoff bounded around this task. Preserve original consequential clauses;
short digests guide navigation and never replace those requirements. Resolve unknown
imports with targeted reads inside the repository; escalate only missing authority
or a consequential contract conflict. Do not force an orchestrator round trip for a
read the implementor can safely perform.

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
