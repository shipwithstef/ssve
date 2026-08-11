# Diff and Verdict — common/agents.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Complex feature | Work directly or use generic Agent subagent | Use `planner` ECC agent | ECC dependency |
| Code review | Inline review | Use `code-reviewer` ECC agent | ECC dependency |
| Architectural decision | Reason directly | Use `architect` ECC agent | ECC dependency |
| Parallel tasks | Use parallel tool calls / generic agents | Use parallel agents by name | ECC dependency |
| TDD | Recommend TDD | Use `tdd-guide` ECC agent | ECC dependency |

## Analysis

The entire routing table in this rule depends on ECC-specific named agents that
don't exist in base Claude Code. Without ECC installed:
- `planner`, `tdd-guide`, `code-reviewer`, `security-reviewer`, `architect`,
  `build-error-resolver`, `e2e-runner`, `refactor-cleaner`, `doc-updater`,
  `rust-reviewer` — none of these exist.

If you follow this rule without ECC installed, you'd be dispatching to agents
that don't exist, causing failures.

In the vibomatic/svc context specifically, the framework has its own agent
routing via `route-workflow` and skills. The ECC agent names conflict with
svc's routing vocabulary.

The "always use parallel task execution" guidance is actually valid and in line
with my defaults (I do parallelize independent operations).

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | Parallel execution emphasis is marginally useful |
| correctness_delta | 1 | Correct in ECC environments |
| friction_cost | 2 | Agent references cause failures in non-ECC environments |
| convention_conflict | 2 | Conflicts with svc's own agent routing (route-workflow) |

## Verdict

**reject**

friction_cost ≥ 2 AND convention_conflict ≥ 2. This rule is valid only inside
the ECC ecosystem. In svc/vibomatic, the routing is done by route-workflow;
an ECC agent dispatch table is a direct conflict.
