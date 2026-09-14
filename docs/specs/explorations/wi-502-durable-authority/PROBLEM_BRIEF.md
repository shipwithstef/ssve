# Problem Brief: WI-502 durable authority

## Problem statement

Mutation authority must follow the exact canonical operation workdir and targets, remain transferable between controllers without simultaneous ownership, and support multiple scoped mutating children without weakening worktree isolation or claiming that hook parsing contains arbitrary shell execution.

## Upstream context

- Vision: progressive deterministic delivery and worktree isolation.
- Consumer: S1 framework orchestrator; no customer-facing persona/UI.
- Must criteria: every WI-502 OS/SB/AU/DG AC; especially zero false permits, exact generation invalidation, and sequential merge-back.
- Journey: J-FW-05 S13..S16 adds path contradiction, handover, child, and containment failure paths.

## Success criteria

### Must

- Canonicalize explicit workdir and every target before authority.
- Preserve exact existing v1 denial/receipt invariants during migration.
- One controller generation and no silent inheritance.
- Explicit, non-overlapping, worktree/path/task/time-bound child rights.
- Real containment or unsupported child mutation.

### Should

- Zero paid hot-path cost, bounded Git calls, exact recovery text, reversible migration, retained child evidence.

### Nice

- Safe parallel speed-up on hosts that prove stable child identity and containment.

## Baseline approach

Shared operation-scope resolver, repository-shared CAS lease, explicit v1 migration, generation-bound inner-worktree delegation, parent-only sequential merge, and host capability gating.

## Assumptions to challenge

1. A repository-shared file store is sufficient; no daemon is necessary.
2. Inner worktrees are the right mutation boundary for every child.
3. Hook parsing plus a sandbox/wrapper is preferable to banning shell.
4. One reviewed WI with checkpoints is safer than independent authority WIs.

## Constraints

Local-first scripts, no new service, all hosts acknowledged, current v1 users protected, unrelated checkout residue immutable, and no implementation before reviewed plan.
