# SVC skills package layout

**State:** VERIFIED
**Work item:** WI-530

## Contract

SVC is one skill package whose repository source root is `skills/`. A skill named `route-workflow` therefore lives at `skills/route-workflow/SKILL.md` in this repository. Package identity remains `svc`; it is metadata, not an additional filesystem nesting level.

Installation is a separate boundary. Each provisioned host receives the existing flat path `<configured skills root>/route-workflow/SKILL.md`. Consumers and host integrations must not observe the source-layout migration.

## Namespace matrix

| Boundary | Authoritative layout | Executable authority |
|---|---|---|
| SVC source checkout | `skills/<name>/SKILL.md` | Canonical framework checkout only; source paths must remain contained and no-follow |
| Provisioned host | `<host-skill-root>/<name>/SKILL.md` | Flat central installation selected by the host manifest |
| Consumer repository | `.agents/skills/<local-name>/SKILL.md` | Project context only; never a source for framework enforcement executables |
| Eval harness | `test-framework/` | Root infrastructure; only `skills/test-framework/SKILL.md` belongs to the skill package |

## Invariants

1. `skills-manifest.json.includedSkills` is the authoritative skill-name set.
2. Each included name maps bijectively to `skills/<name>/SKILL.md`.
3. Source lookup is centralized; new operational code must not assume `<repo>/<name>/SKILL.md`.
4. Host lookup remains flat and is never routed through the repository `skills/` directory at runtime.
5. Existing skill frontmatter and chain semantics are byte-preserved by the move except where path documentation itself must change.
6. Historical proof is not rewritten. Current executable contracts, tests, and maintained documentation are migrated.
7. Skill-local scripts rebase repo-root imports and self-paths explicitly; moving a directory is not assumed to preserve those paths.
8. Discovery rejects symlinked source directories/files and any realpath outside the canonical `skills/` root.
9. Consumer bootstrap is lineage-aware: a branch already registered at a preserved path under `.worktrees/` is resumed in place, and exact same-session stale branch coordinates are repaired to the registered Git branch without a new worktree or generation.
10. Recovery remains fail-closed for live foreign ownership, malformed coordinates, controller-v2 conflicts, paths outside `.worktrees/`, and ambiguous candidates.
11. Controller promotion is a deterministic migration: backup and intent precede the lease, exact retries preserve lease ID/generation and reconstruct a missing receipt, and rollback restores both v1 bytes and the exact prior controller state.
12. Worktree `.svc` and controller authority roots are no-follow containment boundaries; a symlink or duplicate branch registration fails before mutation.
13. An exact active controller-v2 lease created before migration intents is resumed as existing authority without inventing migration evidence, while every securely validated v1 binding in a transferred claim lineage converges idempotently to the registered branch before promotion, including retry after a partial multi-file repair.
14. Setup compares unique manifest names to discovered packaged source names as exact sets before any host target mutation; equal counts are not evidence of a bijection.
15. Central framework commands separate executable provenance from operation scope: `svc-reconcile` loads its receipt checker beside the installed command while `--repo` selects the exact consumer worktree for Git and state, and help performs no reconciliation.
16. The multi-host pre-commit slot is checkout-relative and has two explicit phases: feature worktrees run setup validation only against the candidate; canonical main alone reconciles live host install drift.

## Failure behavior

- Setup fails if a manifest skill is absent, duplicated, or outside `skills/`.
- Setup fails before host mutation if a source directory or its `SKILL.md` traverses a symlink.
- Drift detection fails if a flat installed link does not resolve to the packaged source skill.
- Layout validation fails if a root-level `SKILL.md` skill directory reappears.
- Rollback restores the previous source tree and resolvers as one Git revert; host installs are refreshed from the restored canonical checkout.
- Existing-worktree recovery returns the adopted absolute path and promotes to controller-lease-v2 when routed by the canonical Codex dispatcher; it never asks the user to copy a session ID into an owner-override command for a provable same-session rename.
- Repeating the same canonical bootstrap resumes the existing controller lease rather than treating it as a conflict.
- A post-lease/pre-receipt interruption forward-completes only the matching durable migration intent; a changed lease or ambiguous owner fails closed.
- A pre-intent exact controller resumes with the same lease and generation and produces no migration backup or receipt; a non-exact controller remains a conflict.
- Generation-transfer branch recovery checks the whole lineage on every same-session resume, so a stop after claim/current writes but before a historical binding is repaired forward-completes before promotion and rollback returns an authoritative v1 tuple.
- Symlinked `.svc` or controller state roots and duplicate Git branch registrations produce no outside writes.
- A consumer-local `scripts/check-chain-receipts.mjs` never shadows the central checker; an invalid or non-root `--repo` fails before reconciliation state is written.
- Pre-commit never repoints a live host at a feature worktree and never requires canonical main to already contain an unmerged source-layout migration.
