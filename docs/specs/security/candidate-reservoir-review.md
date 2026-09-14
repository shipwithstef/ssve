# Security Review: Candidate Reservoir and Triage Engine

**Date:** 2026-07-23T08:53:55+03:00
**Reviewer:** P0 automated review
**Mode:** Default, confidence gate 8/10
**Verdict:** PASS — no Critical or High security findings
**Reviewed staged tree:** `daa0ca6fad4046172bbee7b7957cf5383c1a06ee`
**Reviewed staged diff:** `1767ff41f8a774dca2c845b14f93db2afa8f05d8d43bce4e3e9d09b3fe627b0f`

## Scope and threat boundary

This is a local, single-operator Node.js CLI. It has no HTTP listener, authentication layer, customer database client, remote provider, or deployment target. Untrusted inputs are CLI operands, a repository-contained candidate JSON mirror, optional machine-local project identity configuration, and Git origin metadata. Durable outputs are a project-scoped local SQLite database, a deterministic repository mirror, and append-only JSONL decision events.

The concern scan correctly activated the local data-model and database-migration checklists. Authentication, session, OAuth, PII, paid-API, pricing, and deployment signals came from governed task records or generic words in documentation; no corresponding executable surface exists. The required different-family review reached its hard three-round cap through the canonical Claude Opus 4.8/high launcher with zero unresolved Critical or High findings, as recorded in `docs/specs/reviews/candidate-reservoir-exec-cross-model.md`.

## OWASP Top 10

| Category | Status | Finding |
|----------|--------|---------|
| A01 Broken Access Control | N/A | There is no server, account, tenant, or privileged endpoint. Project/scope identity is applied to every SQLite lookup and mutation. |
| A02 Cryptographic Failures | N/A | The reservoir stores feature-candidate metadata, not credentials or regulated data; no cryptographic protocol is implemented. |
| A03 Injection | PASS | All candidate values use prepared statements. The sole interpolated `PRAGMA table_info` identifier comes from a closed internal object literal. Git is invoked through `execFileSync` with a constant executable and fixed argument arrays, never a shell. |
| A04 Insecure Design | PASS | The design defines repository, mirror, local-store, ledger, and project-identity boundaries; terminal transitions are transactional and the outbox makes ledger delivery retryable. |
| A05 Security Misconfiguration | PASS | The state directory and database are enforced as `0700` and `0600`; chmod failures propagate. New ledgers are `0600`, while a pre-existing shared ledger keeps its existing mode. There are no ports, CORS settings, debug services, or default credentials. |
| A06 Vulnerable Components | PASS | The change adds zero third-party dependencies or lockfile changes. Runtime imports are Node.js built-ins plus the repository-local state writer. |
| A07 Authentication Failures | N/A | No authentication or session surface exists. The `.svc/session-contract.jsonl` scanner match is workflow evidence, not product authentication code. |
| A08 Software and Data Integrity Failures | PASS | Candidate mirrors receive strict shape, finite-score, status, path, and project checks; terminal fields cannot bypass operational state; cross-mirror reassignment and same-mirror re-scoping are refused transactionally. Registered schema version, column types/nullability/PK positions, checks, foreign key, and index are verified fail-closed. |
| A09 Security Logging and Monitoring Failures | PASS | Promote/reject decisions receive stable event IDs, enter the outbox in the same transaction as state, and are appended once. A matching ledger ID must carry a deeply equal payload; rank/top drains pending outbox work without re-entering the terminal operand. |
| A10 Server-Side Request Forgery | N/A | The harness performs no network requests and imports no network module. URL-shaped Git origins are parsed only into a project identifier. |

## STRIDE threat model

Legend: PASS means a concrete control closes the applicable threat; N/A means the component has no such authority or data path.

| Component | Spoofing | Tampering | Repudiation | Information disclosure | Denial of service | Elevation of privilege |
|-----------|----------|-----------|-------------|------------------------|-------------------|------------------------|
| CLI argument parser | N/A | PASS — strict exclusive flags, WI grammar, and nonblank reason | PASS — terminal actions emit governed events | PASS — errors contain metadata only | N/A | N/A |
| Candidate JSON mirror | PASS — optional project ID must equal resolved identity | PASS — strict schema, finite bounds, terminal-field invariants, contained source path, and immutable source/scope binding | PASS — Git diff plus decision event | PASS — metadata-only grounding never reads target contents | N/A | N/A |
| Target-file grounding | N/A | PASS — lexical containment plus `realpath` containment rejects escapes and outside symlinks | N/A | PASS — only existence/type and invalid path names are reported | N/A | N/A |
| Local SQLite store | PASS — every key includes resolved `project_id` and `item_scope` | PASS — constraints, prepared statements, `BEGIN IMMEDIATE`, registered schema shape checks, and non-symlink file checks | PASS — durable state plus outbox | PASS — enforced `0700` parent and `0600` regular database file | N/A | N/A |
| Decision outbox and JSONL ledger | N/A | PASS — contained default parent, stable event IDs, deep payload equality, append lock, strict parse, append-once behavior | PASS — action, candidate, project, scope, actor, reason, and timestamp are retained | PASS — events contain candidate decision metadata and no secrets | N/A | N/A |
| Project identity resolver | PASS — explicit local config wins, then normalized Git origin, then workspace basename | PASS — config path and real parent remain inside the repository; config shape is strict; remote parsing rejects absolute local paths and removes credentials/query fragments | N/A | PASS — normalized identifiers exclude URL credentials | N/A | N/A |

## Local database and migration checklist

- Schema version `1` is recorded in `candidate_schema`; older, newer, partial, or unregistered managed schemas fail closed without being stamped.
- All three tables, types, nullability, primary-key positions, check constraints, foreign key, and lookup index are checked at startup.
- The schema is additive and isolated from product/customer databases; no Supabase, Postgres, Base44, RLS, or network client appears in the executable.
- The default database is `~/.svc/store.db`; tests can redirect state through explicit path variables.
- Migration and import run under immediate SQLite transactions with rollback on failure.
- A source mirror cannot silently change source path or item scope after binding.
- Recovery is non-destructive: repair a malformed governed ledger and use rank/top or the identical command so the pending outbox entry is flushed exactly once.

## Supply chain

- Dependencies added: 0
- Dependency or lock manifests changed: 0
- Known CVEs introduced: 0 identified; no third-party component was added
- Package-manager audit: N/A because this documentation/script repository has no root package manifest and this change adds none

## Secrets and privacy

- Leaked credentials found: no
- Tracked `.env` files found: no
- New secret-bearing configuration: no
- PII processed: no; candidate titles, summaries, paths, scores, and triage reasons are framework planning metadata
- Customer database access: none

## Finding verification

Independent audit and round-three review reproduced the ancestor-symlink,
same-ID forged-payload, undefined-schema, permission, and same-mirror re-scope
risks against the pre-repair tree. All are now closed by executable hostile
fixtures. The remaining trust boundary is deliberate: a committed terminal
mirror may reconstruct a new local database, while an existing operational row
cannot be transitioned by import. Repository review is the authorization
boundary for that Git reconstruction path.

## Verdict

- [x] PASS — no Critical/High findings
- [ ] CONDITIONAL — High findings that need mitigation
- [ ] FAIL — Critical findings, do not proceed to implementation

Implementation audit and final test replay may proceed.
