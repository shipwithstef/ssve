# Security Review: WI-506 Runtime-Root Portability

**Date:** 2026-07-22
**Mode:** default, 8/10 confidence gate
**Scope:** framework path trust, local receipt/lock storage, graph activation,
shell adapter behavior, and planning-phase classification. Example Marketplace auth/session
code is not changed.

## Scope and concern disposition

The final full-diff concern scan is stored at
`.svc/review-security-concerns-final.json`. Its Critical/High auth, OAuth, PII,
pricing, DNS/TLS, provider and session matches are lexical collisions in
framework evidence (`session`, `state`, `address`, `plan`, `fallback`); no
changed production file implements those product surfaces. The real path-trust,
secret and supply-chain checklists were applied. `security-cross-family-review`
is satisfied by the exact-diff Anthropic Opus round-2 certification with zero
unresolved Critical/High and no fallback. No concern waiver is used.

## OWASP Top 10

| Category | Status | Finding |
|---|---|---|
| A01 Broken Access Control | PASS | Runtime selection does not grant WI authority. Existing claim/binding/lease resolution remains the authorization boundary and runs before graph activation. |
| A02 Cryptographic Failures | N/A | No cryptography, credential, or token lifecycle changed. Receipt hashes remain integrity bindings, not authentication secrets. |
| A03 Injection | PASS | Runtime leaves accept one strict path segment; explicit roots must be absolute. No user string enters a shell command, query, template, or provider prompt. |
| A04 Insecure Design | PASS | Missing XDG alone falls back; existing unsafe, symlinked, foreign-owned, non-directory, or wrong-mode roots deny. The system contract map names both storage boundaries and the unavoidable crash gap. |
| A05 Security Misconfiguration | PASS | The framework never creates the advertised XDG parent or `/run/user/<uid>`. Explicit shared parents and direct legacy roots must pre-exist and pass ownership/mode checks. |
| A06 Vulnerable Components | PASS | No root package manifest or lockfile exists, and no fixture package manifest, lockfile, Dockerfile, or release workflow changed. A network dependency audit is not applicable to this diff. |
| A07 Authentication Failures | N/A | No product login/session behavior changes. Codex session identifiers locate receipts; they do not replace repository authority resolution. |
| A08 Data Integrity Failures | PASS | Graph writes and receipt writes are atomic. Loader preflights graph, canonical skill, runtime storage, and current authority before activation; exact retry repairs the graph-first crash gap. |
| A09 Logging and Monitoring | PASS | Resolver failures preserve actionable path/trust diagnostics. Shell completion pressure degrades visibly and cannot silently convert an unsafe root into authority. |
| A10 SSRF | N/A | No network destination or user-controlled URL is introduced. |

## STRIDE threat model

| Component | Spoofing | Tampering | Repudiation | Information disclosure | Denial of service | Elevation of privilege |
|---|---|---|---|---|---|---|
| Host environment to resolver | Process environment is configuration, not identity; authority is checked separately | Existing roots are lstat-checked for type, owner, symlink and mode | Resolver reports source and fallback reason | Paths contain no secret material | Unsafe existing roots fail closed; missing XDG recovers | A configured path cannot grant WI authority |
| Runtime leaf and receipt files | Current uid ownership and `0700` leaf required | Atomic writes plus real-parent containment prevent path escape inside the validated parent | Session/task/skill/authority tuple is recorded | Directories are private and receipt files remain `0600` through existing writer | Same-user deletion causes denial/retry, not fail-open | Receipt presence is checked together with durable repository authority |
| Loader graph-to-receipt handoff | Canonical graph/task/skill and WI tuple are preflighted | Graph and receipt are individually atomic; canonical comparison prevents needless rewrite | Skill receipt records graph realpath, task, skill hash and authority generation/lease | Skill content is already repository-readable | Injected post-activation failure forward-completes on exact retry | Graph activation alone cannot satisfy the mutation enforcer without the matching session receipt |
| Shell completion adapter | No authority decision is delegated to shell pressure state | Resolver stdout/stderr are separated and absolute single-line output is validated | Missing/unsafe resolver state produces an operator-facing advisory | Diagnostics expose local paths only | Common allow path spawns no resolver; failure is advisory for pressure only | Durable claim/binding CAS remains authoritative |
| Git authority-lock refs | Holder host/PID/start-token are evidence, not self-asserted WI authority | Acquisition, proven-dead takeover and release require the exact observed object id; malformed holders deny | Ref/OID/holder diagnostics and surfaced release failure make recovery attributable | Metadata exposes only local host/process identifiers | Malformed or uncertain remote identity fails closed; no TTL theft; failed release is not reported as success | Runtime environment cannot split or grant lock ownership |
| Plan-review classifier | Exact file/extension allowlist only | No-rename diff classification keeps both sides of moves visible; executable knowledge and durable exec-record still force implementation divergence | Retro exception is WI/SHA/source/path bound and receipted | No secret data is added | Classification failure blocks review rather than execution authority | Broad `references/**` exemption and implementation-to-exempt rename hiding are explicitly rejected |

## Supply chain

- The repository has no root package manifest or lockfile.
- Test-fixture package manifests exist but are unchanged by WI-506.
- No lockfile, Dockerfile, dependency declaration, download/install pipeline, or
  release workflow changed.
- Result: PASS; no dependency graph changed and there is no root graph on which
  an `npm audit` claim could honestly be made.

## Secrets archaeology

- The production diff contains no password, secret, API-key, credential,
  bearer-token, or private-key material.
- No tracked `.env` file was found.
- No new environment variable carries secret data; runtime variables carry local
  filesystem paths only.
- `.env.local` is not currently matched by this repository's `.gitignore`, but
  no such file exists or is tracked and this framework WI introduces no root
  credential-loading path. Per the skill's missing-hardening exclusion, this is
  recorded as pre-existing hygiene rather than an exploitable WI-506 finding.

## Finding verification

The first specialist pass found three confidence-8+ blocking issues adjacent to
the portability change. All were accepted and remediated before landing:

| Finding | Confidence | Resolution | Regression proof |
|---|---:|---|---|
| Repository skill symlink could disclose an arbitrary readable host file | 9.6/10 | Repository skill and every ancestor must be non-symlink and realpath-contained; trusted installed skill farms retain their separate boundary | Codex integrity fixture proves the symlink cannot override an installed skill or resolve without one |
| Malformed same-user completion counter reached Bash arithmetic command substitution or octal parsing | 9.9/10 | Only canonical 0 or non-zero-leading 1–6 digit decimal bytes may enter forced-base-10 arithmetic; malformed state becomes advisory with no write | Session-binding fixture proves command-substitution, `08`, and `0777` inputs cannot enter pressure arithmetic |
| Persistent fallback could strand a dead correctness lock forever, while blind unlink or malformed-holder auto-recovery could steal a live lock | 9.8/10 | Claim, binding, bootstrap, and migration locks use one Git ref namespace; only proven-dead takeover and release use exact prior holder object ids; ESRCH recovery works without `/proc`; malformed and uncertain cross-host holders fail closed with exact operator CAS recovery evidence | Runtime portability fixture seeds tokenless-dead, tokenless-live and malformed holders, proves malformed bytes never enter the critical section, and launches two contenders with serialized start/end events |
| Successful mutation could hide a failed authority-lock release | 9.1/10 | Release failure returns structured `lock_release_error`, exact ref/OID, and the underlying operation result instead of ordinary success | Runtime portability fixture forces only exact-OID deletion to fail and proves the ref remains diagnosable and recoverable |
| Git rename detection could hide removal of implementation when the destination is phase-exempt | 9.4/10 | Phase classification uses `git diff --no-renames` and evaluates source deletion plus destination addition | External-review fixture proves staged and committed `scripts/` to `docs/` moves reject before provider spawn |

Two defense-in-depth findings were also fixed: the loader now rejects non-regular,
symlinked, or escaped graph paths and binds the canonical graph realpath to the
authority tuple; environment-selected roots can no longer split any correctness
lock namespace.

The execution reviewer additionally identified ambiguous lock-result signaling
and unnecessary Git-object churn. Lock failures now use distinct `lock_busy` and
`lock_error` discriminators, application `{ok:false}` results pass through
unchanged, and live contention writes no candidate object. Production controller
lease activation and repo-local-only canonical skill loading now have direct
behavioral regression fixtures.

Independent verification culminates in the certified Anthropic Opus 4.8 high
execution review at `.svc/impact-triad/WI-506/review-git-cas-round3/`. It re-read
the authority, loader, installed-layout, phase, and shell dependencies and
confirmed zero unresolved Critical/High with no fallback. Its Medium findings
are bounded availability/compatibility and Git subprocess performance, not
authority bypasses; Low observations retain fail-closed behavior.

The independent exact-diff review's low symlinked-`~/.cache` observation remains
an availability boundary, not a trust bypass: the implementation intentionally
denies it and documents a pre-existing `0700` explicit-root remediation.

Runtime permission evidence on this host confirms the fallback parent and all
created consumer leaves are owned by `dianast` and mode `0700`. Focused fixtures
separately prove `0600` receipt writes, unsafe-root denial without leaf creation,
and no creation of `/run/user/1000`.

## Verdict

PASS AFTER REMEDIATION — no unresolved Critical, High, or confidence-8 security finding. The
security gate does not claim post-merge installation verification; that remains
the verify-promotion responsibility.
