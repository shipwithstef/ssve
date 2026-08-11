# Design Decisions: WI-502 durable authority

## Session Mode: auto

The owner supplied a detailed candidate design and asked for framework-wide evaluation before planning. Full alternatives and evidence live in `docs/specs/decisions/2026-07-20-wi-502-durable-authority/SOLUTION-CONFIDENCE.md`.

## D-1: Scope authority boundary

**Phase:** design-tech
**Decided:** one pure canonical operation-scope resolver before all mutation authority
**By:** AI (auto)

Alternatives ranked: shared resolver; Codex-only patch; universal guard only; host-specific duplicate resolvers; sandbox-only. Shared resolution wins because exact downstream checks are meaningless when repository selection differs.

## D-2: Controller persistence

**Phase:** design-tech
**Decided:** repository-shared CAS lease keyed by common-Git-dir digest with diagnostic worktree mirrors
**By:** AI (auto)

Alternatives ranked: shared CAS store; worktree claims; default-checkout ledger; user-global database; Git notes. The shared store coordinates all worktrees without dirtying a checkout and retains local-first operation.

## D-3: Migration

**Phase:** design-tech
**Decided:** explicit v1→v2 migration with exact-byte backup, digest, receipt, and rollback; never dual-authoritative
**By:** AI (auto)

Alternatives ranked: explicit migration; auto-upgrade in hook; dual-write indefinitely; replace state on setup; abandon active WIs. Explicit migration is the only reversible fail-closed path.

## D-4: Child topology

**Phase:** design-tech
**Decided:** one inner worktree and one generation-bound capability per mutating leaf; overlap/shared/unknown scopes serialize
**By:** AI (auto)

Alternatives ranked: inner worktree per leaf; same branch for disjoint files; inner worktrees only for overlap; patch-only workers; no child mutation. The chosen design makes the filesystem boundary match the authority boundary.

## D-5: Merge-back

**Phase:** design-tech
**Decided:** parent recomputes schema-bound completion receipts and merges sequentially
**By:** AI (auto)

Alternatives ranked: sequential validated merge; concurrent cherry-pick; child self-merge; trust worker summary; patch concatenation. Sequential recomputation prevents stale assumptions and keeps one integration authority.

## D-6: Shell security claim

**Phase:** design-tech
**Decided:** hook rejection is an authority guardrail; sandbox/wrapper is containment; child mutation requires both identity and containment
**By:** AI (auto)

Alternatives ranked: defense in depth; shell AST as security boundary; regex-only; sandbox-only; forbid Bash. Defense in depth is honest and preserves useful controller commands without granting unsupported child mutation.

## D-7: Rollout unit

**Phase:** plan-changeset
**Decided:** one WI contract with four reversible implementation checkpoints and no partial promotion
**By:** AI (auto)

Alternatives ranked: checkpointed single WI; four independent WIs; operation patch only; big-bang rewrite; daemon migration. The single reviewed contract avoids two live authority models while preserving task-level rollback anchors.
