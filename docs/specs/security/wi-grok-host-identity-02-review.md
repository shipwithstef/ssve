# Security Review: Grok Host Identity

**Date:** 2026-08-30
**Mode:** default, 8/10 confidence gate
**Verdict:** PASS after remediation; no unresolved Critical or High findings

## Verified findings and remediation

| Severity | Confidence | Exploit | Remediation | Verification |
|---|---:|---|---|---|
| Critical | 10/10 | A Git-valid branch containing command substitution was decoded safely, then re-emitted as unquoted shell text by the bootstrap dispatcher. | The dispatcher now builds decoded argv and passes it through `encodeSimpleCommand`; only the fixed allowlisted `SVC_HOST=<host>` assignment remains outside the encoder. | The Tier-1 fixture executes a rewritten bootstrap with a literal `$(touch${IFS}PWNED)` branch and proves no command substitution occurs. |
| High | 9/10 | A still-live one-use handoff nonce could be replayed with another allowlisted host or changed base, recreating a synthetic controller principal. | Handoff schema v2 binds host, canonical repository, WI, branch, and resolved base. Dispatcher, enforcer, and consumer compare the same tuple before one-time consumption. The unused command digest was removed. | Host/base mismatches are denied without consuming the nonce; the exact tuple consumes once and replay fails. The end-to-end Grok bootstrap stamps the Grok principal. |

Independent specialist review identified both paths before land. The main implementation reproduced them, applied the remediations, and ran the focused regression suite.

## OWASP Top 10

| Category | Status | Finding |
|---|---|---|
| A01 Broken Access Control | PASS | Controller, WI binding, operation scope, and exact host/session principal remain mandatory. |
| A02 Cryptographic Failures | N/A | No credentials or cryptographic material are introduced. |
| A03 Injection | PASS | Bootstrap argv is shell-encoded and round-trips through the canonical lexer. |
| A04 Insecure Design | PASS | The zero-state exception is bounded by default checkout, canonical installed script, one-use tuple handoff, and exact host. |
| A05 Security Misconfiguration | PASS | Unknown host identity and malformed compatibility values fail closed. |
| A06 Vulnerable Components | N/A | No dependency or lockfile changes. |
| A07 Authentication Failures | PASS | Host/session identity is stable and host-bound across hook-to-process handoff. |
| A08 Data Integrity Failures | PASS | Host, repo, WI, branch, and resolved base are checked at inspect and consume boundaries. |
| A09 Logging & Monitoring | PASS | Existing authority events and denial reasons remain intact; no prompt/session secrets enter shell text. |
| A10 SSRF | N/A | No network URL handling. |

## STRIDE threat model

| Component | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| Host/session resolver | PASS | PASS | PASS | PASS | N/A | PASS |
| Bootstrap dispatcher | PASS | PASS | PASS | PASS | N/A | PASS |
| One-use handoff | PASS | PASS | PASS | PASS | N/A | PASS |
| Grok TOML convergence | PASS | PASS | PASS | PASS | N/A | PASS |

## Supply chain and secrets

- Dependencies changed: 0.
- Package manifests or lockfiles changed: 0.
- Known-CVE audit: not applicable to this dependency-free script change.
- Credential material introduced: none.
- Session identifiers remain in the private mode-0600 handoff and never appear in rewritten shell text.

## Self-verify

| # | Check | Result |
|---|---|---|
| 1 | All ten OWASP categories classified | PASS |
| 2 | Concrete exploit paths reproduced and fixed | PASS |
| 3 | Independent findings verified | PASS |
| 4 | No unresolved Critical/High finding | PASS |
