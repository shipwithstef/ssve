# Design Decisions: WI-541 Full Framework Transition

## Session Mode: auto

## D-1: Program architecture

**Phase:** design-tech
**Decided:** shared pure primitives with existing consumers
**By:** AI (auto under owner-directed full delivery)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Add small pure enforcement primitives and wire existing route, authority, plan, review, learning, and landing consumers | Makes declarations executable while preserving current controller and receipt architecture | Cross-cutting diff; requires cumulative assembly and full regression proof |
| 2 | Patch each WI independently in its current file | Small local diffs | Duplicates parsers/state rules and recreates drift between writers and validators |
| 3 | Rewrite the execution controller around a new unified engine | Could eventually simplify orchestration | Excessive blast radius, migration risk, and no evidence the existing controller is the root problem |
| 4 | Documentation-only policy tightening | Fast and reversible | Leaves every reproduced false-green or inert mechanism intact |
| 5 | Move orchestration to an external service | Centralizes coordination | Adds network, credentials, cost, deploy surface, and violates local-first/offline constraints |

**Chosen:** #1 because every open failure is a missing executable seam around otherwise valid current contracts.

## D-2: Mutation transport selection

**Phase:** design-tech
**Decided:** pure three-outcome resolver before launch
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Resolve `delegated-wrapper`, `controller`, or `read-only-native` from a complete transport tuple before dispatch | Prevents doomed child turns without weakening the dispatcher backstop | Requires callers to record and consume the decision |
| 2 | Keep trying native workers and rely on PreTool denial | Preserves current behavior | Deterministically wastes turns and misreports active implementors |
| 3 | Grant native children the parent lease | Easy parallel mutation | Breaks stable identity, task isolation, and least authority |
| 4 | Disable all subagents | Simplest safety rule | Throws away safe read-only parallel analysis and review |
| 5 | Infer mutation support from `agents: true` plus model name | Minimal manifest work | Confuses orchestration availability with containment and delegation authority |

**Chosen:** #1 because it preserves read-only utility and the existing contained mutation path while failing early.

## D-3: Authority recovery model

**Phase:** design-tech
**Decided:** expiring purpose-bound promotion capability plus same-owner legacy convergence
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Add exact-tuple, generation-bound, expiring capabilities and idempotent convergence under repository locks | Represents sanctioned lifecycle transitions without making exceptions to isolation | More state-machine fixtures and append-only evidence |
| 2 | Permanently allow detached HEAD for an owner | Small implementation | Widens authority after promotion and loses reviewed-candidate binding |
| 3 | Temporarily disable hooks during release | Operationally expedient | Removes the boundary precisely when production mutation occurs |
| 4 | Require a new WI/session after every detach or legacy worktree | Clean ownership reset | Breaks same-owner continuation and strands reviewed residue |
| 5 | Recreate the worktree and discard old authority files | Appears to reset state | Destructive, loses audit lineage, and risks protected residue |

**Chosen:** #1 because recovery is a first-class transition, not a bypass.

## D-4: Plan safety enforcement

**Phase:** design-tech
**Decided:** one plan-contract validator with typed sections
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Validate ownership, reversible writers, verified claims, consumer/caller proof, and reviewer-run commands in one executable contract | One parser and one failure surface for related plan truth claims | Manifest schema becomes stricter and needs migration-compatible diagnostics |
| 2 | Add one script per rule | Easy unit isolation | Multiple parsers drift and add unused machinery |
| 3 | Leave rules as reviewer prose | No schema churn | Submitter prose can remain false-green |
| 4 | Infer ownership and reversals from file names | Minimal author work | Heuristics miss shared files and domain-specific money writers |
| 5 | Ban parallel plans and deletion | Strongly conservative | Sacrifices safe speed and legitimate cleanup without addressing claim truth |

**Chosen:** #1 because typed evidence should be validated once and then consumed by planning and review.

## D-5: Learning lifecycle

**Phase:** design-tech
**Decided:** normalize on read, report malformed rows, append lifecycle outcomes, and gate elevation
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 ⭐ | Normalize both ledgers into one typed view and append used/ignored/outcome/promotion/elevation events | Makes existing capture and injection measurable without rewriting history | Adds lifecycle schema and bounded landing work |
| 2 | Rewrite both ledgers into a new canonical file | Produces clean bytes | Destructive to append-only history and risky across projects |
| 3 | Normalize only framework learnings | Smaller scope | Project learnings remain second-class and federation cannot work |
| 4 | Keep silent parse skipping | Zero change | Malformed evidence remains invisible and can never be repaired |
| 5 | Auto-promote every high-confidence row to a rule | Maximizes reuse | Turns confidence into authority without `evaluate-rule` or outcome proof |

**Chosen:** #1 because consumption and outcome credit, not more capture, are the missing links.
