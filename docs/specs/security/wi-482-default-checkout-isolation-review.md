# Security Review: WI-482 Mandatory Default-Checkout Isolation

**Date:** 2026-07-14

**Mode:** local authorization, path containment, and state integrity

**Scope:** pre-tool guard, pre-commit backstop, worktree lifecycle, overrides, and cross-host wiring

## Security Controls

| Threat | Control | Proof |
|---|---|---|
| Default-checkout mutation | cwd and target git contexts; unconditional default-root denial | structured, shell-fs, external-cwd, and commit fixtures |
| Cross-worktree contamination | every repository target must remain in the exact authoritative worktree | linked-to-default and multi-root regression fixtures |
| Symlink path escape | nearest existing parent is realpath-resolved before containment | external symlink back into repo denies |
| Read-only command smuggling | WI-485 classifier plus exact `node --check <file>` only; all sed forms write-capable | `-i`, `w`, `s///w`, and `e` fixtures deny |
| Session spoofing | exact WI-484 session/worktree/WI binding | linked commit and cross-root tests |
| Override abuse | exact session, non-empty reason, future expiry capped at 30 minutes | negative override matrix and mode-0600 append receipt |
| Runtime receipt tampering | owner-only directory/file, non-symlink, `O_NOFOLLOW`, append, fsync | source inspection and focused validator |
| Create race or partial lifecycle | per-repository exclusive runtime lock and rollback after binding failure | create/resume/conflict fixture |

## Supply Chain and Secrets

- New dependencies: 0.
- Lockfiles changed: 0.
- Network calls introduced by runtime guard: 0.
- Credentials or secret literals introduced: 0.
- Installed host skill symlinks are neither repointed nor refreshed during create/resume.

## Residual Boundaries

- Pre-tool shell parsing cannot enumerate every shell language write target. The universal pre-commit slot prevents tracked repository mutation from landing, while default-checkout shell commands not classified read-only are denied wholesale.
- OpenCode lacks a supported pre-tool command hook; it receives the universal pre-commit backstop and explicit installer diagnostics.
- Emergency override is intentionally local, bounded, session-specific, and receipt-bearing; automated lanes must not set it.

## Verdict

- [x] PASS — no unresolved Critical, High, or Medium security finding.
- [ ] CONDITIONAL
- [ ] FAIL
