# Security Review: WI-502 durable authority

**Date:** 2026-07-20
**Mode:** implementation-aware, comprehensive authority review
**Evidence:** staged diff, three-round Fable review, focused Tier-1 fixtures, and independent security specialist audit

## OWASP Top 10

| Category | Status | Evidence |
|---|---|---|
| A01 Broken Access Control | PASS after correction | Principals bind trusted host session identity; structured authority worktree operands are scope-checked; delegation checks exact lease generation, worktree, allowed and denied paths. |
| A02 Cryptographic Failures | PASS | Handover and delegation secrets use 32 random bytes; only SHA-256 digests are persisted and tokens are consumed once. |
| A03 Injection | PASS with boundary | CLIs use `execFileSync` argument arrays for Git. Controller-defined post-merge validation is the only shell command rerun; child-provided validation commands are not used as authority. |
| A04 Insecure Design | PASS after correction | Duplicate task dispatch is serialized by an exclusive graph lock; handover uses CAS and generation invalidation. |
| A05 Security Misconfiguration | PASS | Mutation-capable hosts declare stable identity and containment; missing Landlock/wrapper support fails closed. |
| A06 Vulnerable Components | N/A | No package or third-party runtime dependency was added. The containment helper uses Linux Landlock directly. |
| A07 Authentication Failures | PASS | CLI `--session-id` and `--host` cannot override the trusted host environment. Role/name alone is rejected. |
| A08 Data Integrity Failures | PASS after correction | Merge recomputes ancestry, file set, commit list, diff digest, cleanliness, and controller-defined post-merge validation. |
| A09 Logging and Monitoring | PASS | Lease lifecycle, handover/recovery, capability status, completion, and integration mapping are durable receipts/state. |
| A10 SSRF | N/A | No network URL input or outbound service exists. |

## STRIDE Threat Model

| Component | Spoofing | Tampering | Repudiation | Disclosure | Denial | Elevation |
|---|---|---|---|---|---|---|
| Controller lease | trusted session principal + CAS | atomic secure files | lifecycle receipts | token hash only | bounded lock retry | generation invalidation |
| Operation scope | trusted adapter workdir | realpath + exact Git identity | contradiction codes | no secret payload | per-call Git cache | mixed/non-Git targets deny |
| Child capability | stable child principal | inherited denies + bounded globs | acceptance/completion receipts | one-time token consumed | expiry/revoke states | exact worktree/path/task checks |
| Merge back | controller-only | ancestry/files/commits/digest + validation | source-to-integration mapping | no secret material | sequential merge | old generations and unknown files deny |
| Shell containment | hook syntax guardrail | Landlock standalone inner repository | worker result/log | no added secret channel | fail closed if unavailable | writes confined to child repository |

## Verified Findings and Corrections

The independent audit initially confirmed four security blockers: structured CLI cross-root targeting, delegated relative-redirection scope bypass, nested capability widening, and stale-lock inode replacement. All four were corrected before commit and gained focused assertions. The audit also reproduced duplicate child issuance; dispatch now locks the graph transition and the two-process test requires exactly one winner.

Residual limitations are bounded: PreTool shell parsing cannot understand arbitrary interpreter programs, so mutation-capable child execution still requires Landlock or an equivalent host wrapper. Older Bash portability and a guaranteed Landlock promotion job remain follow-up operational concerns, not silent authority claims.

## Supply Chain and Secrets

- New dependencies: none.
- Root package audit: N/A; this repository has no root package manifest.
- Credential scan of changed authority modules: no embedded password, API key, private key, or reusable secret.
- Tokens: random, hashed at rest, one-time, and generation-bound.

## Verdict

- [x] PASS — no unresolved Critical or High security finding.
- [ ] CONDITIONAL
- [ ] FAIL
