# Framework improvement: package first-party skills under `skills/`

**Status:** ACCEPTED
**Accepted WI:** WI-530
**Severity:** high

## Gap

SVC currently places 103 first-party skill directories at repository root. This obscures the framework's real package boundary, makes root discovery noisy, and spreads a legacy `<repo>/<skill>/SKILL.md` assumption across installers and validators.

## Decision

Use `skills/<skill-name>/SKILL.md` as the only first-party source layout. Keep skill identities and flat host installation paths unchanged. Do not add a redundant `skills/svc/` layer or root compatibility aliases.

As part of the same consumer convergence boundary, make canonical bootstrap adopt one registered preserved worktree and repair only an exact same-session branch-rename drift. Canonical Codex routing deterministically promotes or resumes the recovered tuple as controller-lease-v2, forward-completes an interrupted receipt, and leaves duplicate, symlinked, live-foreign, or ambiguous ownership blocked before mutation.

## Proof

- A manifest-to-source bijection validator rejects missing, duplicate, nested, and root-level skills.
- Setup and drift fixtures prove every host-visible skill path stays flat.
- Operational scripts share the packaged source-root contract.
- The migration passes exact-candidate review and post-merge all-host convergence.
- A preserved-path/renamed-branch fixture proves zero duplicate worktrees, byte-preserved user files and HEAD, unchanged v1 generation, exact metadata repair, idempotent controller-v2 promotion, failpoint recovery, exact rollback, and pre-mutation denial for duplicate registrations, symlinked state, foreign owners, and ambiguous identities.
