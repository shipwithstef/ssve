# Security Review: WI-484 Session, Worktree, and WI Binding

**Date:** 2026-07-14
**Mode:** concurrency, ownership, and local-state security
**Scope:** session binding, WI claims, Stop authority, runtime counters, and worktree lifecycle

## OWASP-Oriented Review

| Category | Status | Evidence |
|---|---|---|
| Broken access control | PASS | Mutation authority requires exact session, binding, worktree, branch, WI, and fresh normalized claim agreement. Foreign claims are advisory before graph parsing. |
| Injection | PASS | Binding and claim commands use argument arrays; state is parsed as JSON; WI and role values are schema/command validated. |
| Insecure design | PASS | Diagnostic branch/graph/contract inference cannot authorize mutation. Transfers require stale/released proof and generation CAS. |
| Security misconfiguration | PASS | Mutating create without a session or WI now fails before any repository/worktree side effect. |
| Vulnerable components | N/A | No dependency or lockfile change; only Node built-ins and portable shell are used. |
| Identification failures | PASS | Legacy owner fields normalize only host-session-shaped values; agent/model labels are rejected. |
| Data integrity failures | PASS | Temp-write, fsync, rename, owner/mode checks, per-claim locks, and repository-scoped session locks protect state. |
| Logging/monitoring | PASS | Conflicts and fail-open Stop decisions emit actionable diagnostics without exposing prompt contents. |
| SSRF/network | N/A | No URL or network input exists in this change. |

## STRIDE Summary

| Threat | Control | Proof |
|---|---|---|
| Session spoofing | Host-session-shaped IDs plus exact binding/claim match | accepted/rejected owner-variant matrix |
| Claim tampering | same-user regular-file reads, atomic writes, exclusive lock, generation CAS | malformed/symlink and simultaneous-transfer fixtures |
| Cross-worktree elevation | repository-scoped one-session binding lock | simultaneous two-worktree race has one winner |
| Foreign graph disclosure/mutation | foreign ownership exits before graph parsing | corrupt foreign graph is never parsed; receipt sentinel remains unchanged |
| Counter poisoning | absolute hashed runtime path, owner/symlink checks, pressure-only writes | insecure-root and non-pressure fixtures |
| Lifecycle denial | released records remain transfer eligible; lock failure gives manual recovery path | release-cleanup-transfer fixture and Fable review |

## Supply Chain and Secrets

- New dependencies: 0.
- Lockfiles changed: 0.
- Network calls introduced: 0.
- Credential, token, API-key, and private-key literals introduced: 0.
- Binding records contain identity and path metadata only; active-intent authority uses prompt classification/hash rather than raw prompt as authority.

## Residual Limits

- A process killed while holding the file lock can require verified manual lock removal. This is fail-closed for mutation and avoids unsafe automatic lock stealing.
- Malformed, symlinked, or foreign-owned claim files are invalid state and may be removed by cleanup; only readable well-formed released records retain generation history.
- Legacy unbound worktrees retain compatibility behavior, but cannot enter the new authoritative bound path without a valid binding.

## Verdict

- [x] PASS — no unresolved Critical or High security finding.
- [ ] CONDITIONAL
- [ ] FAIL
