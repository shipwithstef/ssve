# Write-Once Execution: Eliminate Plan→Reimplement Double-Spend

**Date:** 2026-04-05
**Status:** IMPLEMENTED

## The Problem

The current pipeline has a token doubling problem:

```
plan-changeset    → agent figures out WHAT to write (reads spec, designs, code)
execute-changeset → agent figures out WHAT to write AGAIN (reads the plan, re-derives the code)
```

The plan describes intent ("create a function that validates payment amounts").
The executor reads that description and generates code from it. This is a
lossy translation — the same non-determinism problem the doctrine warns about.

obra/superpowers has the same issue: `writing-plans` produces task descriptions,
`executing-plans` re-implements from those descriptions.

## The Proposal: Write Directly, Diff as Artifact

Instead of plan-then-reimplement, write code directly on the worktree branch.
The plan provides context and constraints. The execution produces code directly.
The diff IS the changeset.

### How it works

```
plan-changeset:
  1. Produces manifest: task graph, file list, AC mapping, validation plan
  2. The simulation (dry run) validates structure against codebase
  3. NO code payloads in the manifest — just intent, constraints, and file targets

execute-changeset:
  1. Back up files that will be modified (git stash or snapshot)
  2. For each task group:
     a. Independent tasks → spawn parallel subagents (inner worktrees if file conflicts)
     b. Dependent tasks → execute sequentially
  3. Each subagent writes directly: test first → implementation → verify
  4. Checkpoint commit per task (with trailers)
  5. After ALL tasks: one holistic review of the full diff
  6. No per-task quality review (style contract + constraints are sufficient)
```

### Why this solves determinism

In the current approach:
- plan-changeset: "Create a PaymentValidator class with methods for..." (tokens spent understanding the problem)
- execute-changeset: reads that description → generates PaymentValidator (tokens spent AGAIN understanding the problem, plus translation loss)

In the proposed approach:
- plan-changeset: "Task 3: validate payment amounts. Files: src/services/payment-validator.ts, src/services/__tests__/payment-validator.test.ts. ACs: PAY-01, PAY-02. Constraints: use Zod schema from tech design."
- execute-changeset: reads the spec + tech design + style contract directly → writes PaymentValidator

One generation step. Zero translation. The context (spec, design, style) constrains the output. The manifest constrains the scope (which files, which ACs). Determinism comes from the constraints, not from re-describing what to write.

### Parallel execution model

```
Orchestrator (Opus, medium effort):
  - Reads manifest task graph
  - Identifies parallel groups (tasks with no mutual dependencies)
  - Detects file conflicts within groups
  - Spawns subagents per task

Implementor subagents (Sonnet, medium/high effort):
  - Each gets: task intent + AC slice + spec + style contract + targeted code files
  - Writes test → writes code → runs test → commits
  - Reports back: done / stuck / found defect

Conflict resolution:
  - Tasks touching different files → run on same branch in parallel
  - Tasks touching overlapping files → inner worktree per task, merge after
  - Hydration: if task B needs types from task A, task A runs first (dependency in graph)
```

### Inner worktrees for epic-scale features

When a feature has many tasks that could conflict:

```
main
  └── .worktrees/feature-payments/          (parent worktree — specs, designs, plans live here)
        ├── .worktrees/task-3-validator/     (inner worktree — isolated execution)
        ├── .worktrees/task-4-webhook/       (inner worktree — isolated execution)
        └── .worktrees/task-5-receipt/       (inner worktree — isolated execution)
```

An evaluator decides which tasks need inner worktrees:
- If tasks touch disjoint file sets → no inner worktree needed
- If tasks modify overlapping files → inner worktree per task
- After all tasks complete → merge inner worktrees to parent

### Holistic review replaces per-task review

Current: review staged diff after EVERY task (N reviews for N tasks).
Proposed: one review of the full feature diff after all tasks complete.

Why this works:
- Style contract constrains how code looks → no style drift per task
- Spec ACs constrain what code does → no scope drift per task
- TDD within each task constrains correctness → no silent bugs
- The holistic review catches CROSS-TASK issues that per-task reviews miss

The holistic review surface:
```bash
git diff main..HEAD
```

Check: full AC coverage, cross-file consistency, no orphaned code, no
contradictions between tasks, toggle registry complete, first-demo passes.

### Hook integration

| Hook | When | What it does |
|------|------|-------------|
| `pre-commit` | Before each task checkpoint | Run style linter (from style contract) |
| `post-task` | After each subagent completes | Run the task's validation command |
| `pre-merge` | Before merging inner worktrees | Check for merge conflicts |
| `post-all-tasks` | After all tasks done | Run full test suite + first-demo test |

### Token savings

| Step | Current tokens | Proposed tokens | Savings |
|------|---------------|----------------|---------|
| Plan (manifest) | 40-60K | 30-40K (no code payloads) | 10-20K |
| Execute (per task) | 30-50K (re-reads plan + re-derives code) | 20-35K (writes directly from context) | 10-15K per task |
| Review (per task) | 5-10K × N tasks | 10-15K × 1 holistic | 20-50K for 5-task feature |
| **Total for 5-task feature** | **195-310K** | **120-195K** | **~40% reduction** |

Combined with the spec-as-index optimization (65-195K saved earlier), the full
pipeline drops from ~500K to ~250-300K tokens — a 40-50% total reduction.

## What Changes

1. **plan-changeset**: Remove code payload sections from manifest. Keep intent,
   file targets, AC mapping, constraints, validation commands.
2. **execute-changeset**: Write directly on branch. Parallel subagent model.
   Inner worktrees for conflicts. Holistic review at end. No per-task review.
3. **DOCTRINE.md**: Update execution model section.
4. **WORKTREES.md**: Document inner worktree pattern.
