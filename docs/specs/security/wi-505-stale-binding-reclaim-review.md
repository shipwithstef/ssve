# Security Review: WI-505 stale binding reclaim

**Date:** 2026-07-21
**Mode:** implementation-aware authority review, default 8/10 confidence gate
**Evidence:** final staged diff, exact tuple design, hermetic race/corruption fixtures, fresh security/G5 specialists, and the two-round post-audit Claude Opus 4.8 corrected-freeze review

## Scope and concern disposition

`scan-concerns.mjs --staged` correctly selected `auth-surface` because WI-505 changes session-bound mutation authority. The corresponding fail-closed, replay, attribution, and STRIDE checks are included below. Keyword-only matches for OAuth callback, DNS/TLS, paid inference, pricing, i18n, and browser journeys do not describe this local filesystem/Git authority path and are not security findings. No Base44 entity, RLS rule, browser endpoint, payment path, PII flow, or external API is in scope.

## OWASP Top 10

| Category | Status | Evidence |
|---|---|---|
| A01 Broken Access Control | PASS | Reclaim requires one exact canonical claim/binding tuple with attributable owner, WI, repository, real worktree, named branch, claim path, role, and current generation. Fresh foreign authority returns actionable owner evidence and no write. |
| A02 Cryptographic Failures | N/A | No password, bearer token, credential, encryption, or signing contract changes. SHA-256 is used only to compare a previously inspected local binding snapshot before retirement, not as authentication. |
| A03 Injection | PASS | The new path parses bounded JSON authority files and uses existing `execFileSync` argument arrays for Git; it adds no shell interpolation, query construction, template evaluation, prompt construction, or network input. |
| A04 Insecure Design | PASS | The generation CAS is the linearization point. Transfer re-inspects under the claim lock, old authority cannot regain the new generation, crash recovery only forward-completes the already-selected winner, and uncertain state denies. |
| A05 Security Misconfiguration | PASS | Canonical authority directories/files must be present, non-symlinked, and current-user-owned. Malformed, mismatched, ambiguous, symlinked, or foreign-owned v1/v2 evidence fails closed. |
| A06 Vulnerable Components | N/A | No package manifest, lockfile, third-party package, or runtime dependency changed. The only new import is an existing local authority-store module; other imports are Node built-ins. |
| A07 Authentication Failures | PASS | Requesting and recorded sessions must be host-session-shaped. Conflicting attributable owner fields deny, same-session resume is generation-idempotent, and a foreign session cannot convert a fresh tuple into a transfer. |
| A08 Data Integrity Failures | PASS | Complete-tuple transfer is bound to the exact observed generation and source binding path. Source retirement compares SHA-256, device, and inode; final authority resolution re-reads v2 and the complete winner tuple before success is reported. |
| A09 Logging and Monitoring | PASS | Claim and binding metadata record `transfer_from_generation`, source session, destination generation/session, `released_at`, and update time. Conflict errors expose owner/generation/worktree evidence without exposing credentials. |
| A10 SSRF | N/A | The path performs no URL parsing, remote fetch, socket operation, or external service call. |

## STRIDE threat model

| Component | Spoofing | Tampering | Repudiation | Disclosure | Denial | Elevation |
|---|---|---|---|---|---|---|
| Shared v1 tuple inspector | Attributable, non-conflicting session identities | Canonical coordinates, schema, owner, generation, secure files | Returns explicit state/reason and source evidence | Only local authority metadata in diagnostics | Bounded per-worktree binding scan; uncertain state denies | Unreleased binding alone never grants authority |
| Generation-bound transfer | Exact requesting session and old owner provenance | Claim-lock reinspection plus expected-generation CAS | Records source session/generation and destination generation | No credential material | Lock loser returns changed generation/state cleanly | Fresh foreign tuple and mismatched source deny before mutation |
| Source-binding retirement/finalizer | Only the selected winner can forward-complete | Snapshot digest/device/inode comparison; no deletion | Durable release and transfer fields | Session identifiers are operational evidence, not secrets | Crash state is retryable without another generation bump | Old generation remains non-authoritative even before retirement completes |
| V2 exclusion/final resolver | Canonical repository/WI controller identity | Secure v2 root/read; malformed or symlinked state denies | Existing controller lease receipts remain authoritative | No v2 secret is copied into v1 | Conservative v1 denial when v2 exists | V1 never preempts or silently becomes v2 |
| Public existing-worktree resume | Existing registered worktree/branch and host session | No graph, branch, worktree, tracked, untracked, or ignored user-file deletion | Actionable conflict or verified JSON result | Owner evidence only | One bootstrap lock for normal public attempts | Success requires final shared resolver to report the winner as owned |

## Verified findings, corrections, and residual risk

No candidate Critical, High, or Medium security finding remains above the 8/10 confidence gate.

Two independent specialists found security-relevant defects in the earlier frozen diff. Both were confirmed, corrected, and independently re-reviewed:

- **Closed High correctness/authority audit finding — provenance write ordering.** The earlier transfer path durably wrote the new owner/generation through `claimWIUnlocked()` before adding current transfer provenance. A kill between writes could leave an unprovenanced winner or stale prior provenance. Transfer now builds the winner in memory and performs one first durable winner write containing the exact current source generation/session. The public `after-claim-transfer-cas` failpoint proves the resulting durable state forward-completes, retires the source, and never writes generation N+2.
- **Closed Medium security finding — same-generation foreign binding ambiguity.** The earlier inspector selected only bindings whose session matched the claim owner and could ignore a different-session exact-coordinate binding at the same generation. The inspector now denies any same-generation foreign owner binding before freshness or transfer. The fixture preserves and compares every claim/binding byte across that denial.

Fresh G5 reported 0 Critical/High/Medium after those corrections. The renewed Opus corrected-freeze review then reported 0 Critical/High/Medium in its final round. It also certified that a present malformed canonical v2 lease throws and denies rather than being treated as absent; public and direct v1 acquisition leave malformed-v2 and v1 bytes unchanged.

**Accepted Low — independent v1/v2 lock timing (confidence 9/10, independently verified).** Exploit/interaction path: a v1 reclaim passes its v2 precheck, then an authorized actor creates a canonical v2 lease before the v1 claim CAS completes. The v1 metadata can advance one generation, but the public command writes/reads through the final resolver, which gives v2 precedence and throws instead of reporting v1 ownership. The v2 lease is not preempted, user content is not deleted, and standard v1 state is not migrated into v2. A common cross-store transaction lock would redesign WI-502 migration semantics and is outside this single-gap correction; the retained invariant is fail-closed public success, not zero benign v1 metadata writes during an explicit concurrent migration.

The initial independent review cycle also reproduced and closed a Medium same-winner finalizer race. Two concurrent recovery calls can converge on `current_complete`; the loser treats the exact current winner as idempotent success and does not write another generation.

**Accepted Low — noncanonical symlink spelling false denial (confidence 9/10, independently verified).** The inspector realpaths its worktree/repository inputs while stored coordinate comparison uses `path.resolve`. A legacy noncanonical symlink spelling can therefore deny an otherwise equivalent tuple. This cannot grant authority or preempt an owner, and normal ensure/binding writes use canonical worktree coordinates; it is retained as fail-closed robustness debt rather than an authorization vulnerability.

Same-user replacement between local `lstat` and `read` is excluded from the main findings because all framework authority files are already writable by that operating-system principal. Within this established local trust boundary, source retirement still performs digest/device/inode comparison and every malformed or changed tuple fails closed. This is a trust-model limitation, not a newly introduced privilege escalation.

## Supply chain and secrets

- Dependency changes: 0.
- New third-party dependencies: 0.
- Package/CVE audit: N/A; no package manager manifest or lockfile is part of this change.
- Sensitive file paths changed: 0.
- Private-key/provider-key literals added: 0.
- Credential assignment candidates added: 0.
- Session UUIDs and `session_token` field names are authority identities/metadata, not reusable credentials.

## Self-verify

| # | Check | Result |
|---|---|---|
| 1 | Review report exists | PASS |
| 2 | All OWASP Top 10 categories have a disposition | PASS |
| 3 | No unresolved Critical/High finding | PASS — 0 Critical, 0 High |
| 4 | Security-rule probes validated when relevant | N/A — no entity/RLS/security-rule change |

## Verdict

- [x] PASS — no unresolved Critical or High security finding.
- [ ] CONDITIONAL
- [ ] FAIL

Mandatory continuation remains `audit-implementation`, focused authority replay, full Tier-1, sanctioned landing, installed-framework refresh, and the real Example Marketplace WI-496 replay. This review does not by itself promote the correction.
