# Security Review: zero-block hook recovery

**Date:** 2026-08-11
**Mode:** default 8/10 confidence gate
**Scope:** WI-531 cumulative diff from `ac42091b` through the post-audit remediation candidate

## Concern disposition

The scanner matched `auth-surface`, `security-cross-family-review`, and
`session-management` because WI-531 appends one row to
`.svc/session-contract.jsonl`. The row is task-routing authority metadata; it
does not create an application login, credential, token, cookie, OAuth, or user
session path. The security review still treats SVC controller/task authority as
an access-control surface.

The required different-family review is satisfied by AGY / Gemini 3.6 Flash
High on the full implementation diff. Its final successful pass scored 10 with
zero findings. Sol supplied the additional same-family security/reliability
lens. A later evidence-file-only AGY attempt timed out at its configured ceiling
and is preserved as an availability receipt; it did not replace or relabel the
successful independent implementation review.

## OWASP Top 10

| Category | Status | Evidence |
|---|---|---|
| A01 Broken Access Control | PASS | Reads exit before authority enforcement; mutations still require the exact worktree/controller/task tuple. Dangling symlink leaves now fail before classification, and explicit reviewer overrides must still be required independent stations. |
| A02 Cryptographic Failures | PASS | No credential or application-token change. Runtime identities and receipt bindings retain SHA-256 content identities. |
| A03 Injection | PASS | The read classifier validates decoded argv and rejects shell-active syntax; output/compile forms for `sort`, `uniq`, `file`, `sed`, Git, and redirection have negative fixtures. |
| A04 Insecure Design | PASS | One-retry recovery, CAS authority, exact worktree containment, manifest-exact hook cardinality, and fail-closed ambiguity are explicit invariants. |
| A05 Security Misconfiguration | PASS | Setup refuses missing `flock`, symlinked target/state ancestry, invalid governed routing, and mixed `--host`/`--all-hosts` modes; late failure restores the prior host surface. |
| A06 Vulnerable Components | N/A | No dependency manifest or third-party package changed. Runtime dependencies remain Bash, Git, Node, Python, and `flock`. |
| A07 Authentication Failures | N/A | No product authentication or session issuance is changed. SVC controller identity remains generation/principal bound. |
| A08 Data Integrity Failures | PASS | Atomic graph activation, content-addressed install state, receipt tree/diff binding, and byte-preservation fixtures cover integrity boundaries. |
| A09 Logging and Monitoring | PASS | Denials, migration state, reviewer availability, task phases, and final receipts remain explicit and durable. |
| A10 SSRF | N/A | No URL fetch or network-target input is introduced. |

## STRIDE threat model

| Component | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| Codex read dispatcher | PASS: no identity claimed by reads | PASS: write-capable argv denied | PASS: mutations remain receipted | PASS: no secret data added | N/A | PASS: reads cannot mint mutation authority |
| Task activation | PASS: stable session/controller tuple | PASS: atomic exact-task update | PASS: skill receipt persisted | PASS | PASS: retry forward-completes | PASS: non-first/foreign tasks denied |
| Operation scope | PASS | PASS: realpath/worktree comparison | PASS: structured contradictions | PASS | PASS: invalid targets do not poison authority | PASS: cross-worktree targets denied |
| Multi-host setup | N/A | PASS: digest, lock, and routing verification | PASS: per-host receipts | PASS: no credentials handled | PASS: bounded concurrency | PASS: symlink/state-root negatives |
| Reviewer topology | PASS: owner config is authority | PASS: digest-bound package | PASS: tuple and availability receipts | PASS: private bridge cleaned | PASS: bounded timeout | PASS: same-family advisory cannot claim independence |

## Supply chain

- Dependency manifests changed: none.
- New executable requirements: none; `flock` was already an allowed runtime
  dependency and is now enforced fail-closed for parallel setup.
- Full Tier-1 result: 308 passed, 0 failed, 0 timed out.

## Secrets archaeology

- No password, API key, bearer token, credential, or private key was introduced
  in the executable WI-531 files.
- `.svc/session-contract.jsonl` adds only WI, intent, worktree, branch, and stable
  local session-routing fields already governed by the existing contract.

## Findings

Successive independent passes exercised containment, input classification,
SessionStart trust, reviewer independence, and shared setup state. Each finding
is repaired and has a negative fixture. The final exact-candidate re-entry is
PASS with 0 Critical, 0 High, 0 Medium, and 0 Low findings.

## Verdict

- [x] PASS
- [ ] CONDITIONAL
- [ ] FAIL

Installed-host behavior is intentionally not certified here. Canonical-main
all-host setup and fresh-session canaries remain the G7 promotion boundary.
