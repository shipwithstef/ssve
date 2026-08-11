# Security Review: WI-485 Codex Execution Integrity

**Date:** 2026-07-14
**Mode:** security, 8/10 confidence gate
**Scope:** Codex prompt authority, Stop continuation, skill receipts, runtime storage, and host hook reconciliation

## Concern Coverage

| Concern | Required handling | Evidence | Status |
|---|---|---|---|
| `auth-surface` | `review-security` | this report | PASS |
| `security-cross-family-review` | different-family `review-cross-model` | Claude rounds through final `8c0bfe07` APPROVE in `docs/specs/reviews/wi-485-codex-execution-integrity-exec-cross-model.md` | PASS |
| `session-management` | post-fix evidence | 88/88 focused validator after audit remediation and final hardening | PASS |

## OWASP Top 10

| Category | Status | Evidence |
|---|---|---|
| A01 Broken Access Control | PASS | Continuation requires exact session, turn, positive intent, target, route timing, worktree, and foreign-claim checks. |
| A02 Cryptographic Failures | PASS | SHA-256 is used for prompt redaction and skill-byte binding, not password storage; runtime records are 0600 in 0700 directories. |
| A03 Injection | PASS | Ambiguous Bash is governed; process-spawning/write options are denied; the sole loader bootstrap command is token-for-token bound to the active task. |
| A04 Insecure Design | PASS | Missing identity fails safe by direction: Stop allows termination, governed mutation denies. One composite Stop prevents order-dependent continuation. |
| A05 Security Misconfiguration | PASS | The wirer validates the complete nested effective Stop view before any host write and rolls back transactional writes on failure. |
| A06 Vulnerable Components | N/A | No package or dependency change; implementation uses Node built-ins and repository scripts. |
| A07 Authentication Failures | PASS | Foreign, legacy, unknown, stale, wrong-turn, and negated-intent cases have explicit fixtures. |
| A08 Data Integrity Failures | PASS | Receipts bind the canonical worktree skill hash as well as the recorded skill path; self-consistent forged bytes deny. |
| A09 Logging and Monitoring | PASS | Authority and receipt schemas are allowlisted; recursive runtime scans reject raw and encoded prompt/secret sentinels. |
| A10 SSRF | N/A | No URL or network input exists in this change. |

## STRIDE Threat Model

| Component | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| Prompt authority record | exact session/turn | atomic 0600 write | timestamp/hash | raw prompt omitted | TTL cleanup | no authorization from record alone |
| Stop firewall | exact authority + intent | foreign claims protected | target-scoped output | no prompt output | Stop fails toward termination | no cross-session continuation |
| Skill receipt | exact session/task/graph/worktree | canonical SHA comparison | loaded-at/turn evidence | no prompt/env/secret fields | exact bootstrap recovery | forged/mismatched receipt denies |
| Hook wirer | N/A | nested command reconciliation | adjacent backups + state JSON | no secrets | preflight before writes | duplicate Stop rejected |

## Verified Findings and Disposition

### SR-1: Non-continuation WI mentions pressured Stop

- **Original severity/confidence:** Critical, 10/10
- **Exploit:** A summary/review prompt mentioning `WI-485` created explicit-WI authority and the old firewall ignored `continuation_intent`.
- **Fix:** Stop now requires positive `continue`, `resume`, or `end_to_end`; summary, direct-negation, and natural-negation fixtures emit `{}`. Malformed authority timestamps also fail toward allowing Stop.
- **Status:** FIXED and independently identified by the security specialist.

### SR-2: Skill-loader recovery deadlocked behind its own receipt gate

- **Original severity/confidence:** Critical, 10/10
- **Exploit:** The exact recovery Bash command was governed before the first receipt could exist.
- **Fix:** One token-exact active graph/task/skill loader command is bootstrap-allowed; altered forms deny, and the CLI performs the full validation before writing.
- **Status:** FIXED and independently identified by the security specialist.

### SR-3: Self-consistent forged skill bytes passed

- **Original severity/confidence:** High, 10/10
- **Exploit:** The enforcer compared a receipt hash only to `receipt.skill_path`, not to the canonical worktree skill.
- **Fix:** The receipt hash must equal both the recorded file bytes and `<worktree>/<skill>/SKILL.md`; a forged-file fixture denies.
- **Status:** FIXED and independently identified by the security specialist.

### SR-4: Hidden nested Stop and partial host write

- **Original severity/confidence:** High, 10/10
- **Exploit:** Only `hooks[0]` was reconciled/counted, and config could be written before invalid hooks or duplicate effective Stop failed.
- **Fix:** Every nested command is normalized and counted; both nested orders are tested; candidates validate before host writes and failures preserve config bytes.
- **Status:** FIXED and independently identified by the scope specialist.

## Supply Chain

- New dependencies: 0
- Lockfiles changed: 0
- Network calls in validation: 0
- Result: PASS

## Secrets Archaeology

- No credential or API-key literal introduced.
- Authority schema excludes prompt, command, environment, remote, credential, and secret fields.
- Skill receipt schema contains only identity/path/hash/timestamp fields.
- Raw and base64 sentinel scans run recursively after both records exist.
- Result: PASS

## Residual Limits

- Codex `/hooks` trust and a live runtime trace are promotion evidence, not pre-merge claims.
- PreToolUse remains preventive rather than omniscient; post-action validation and the receipt chain remain mandatory.

## Verdict

- [x] PASS — no unresolved Critical or High security findings.
- [ ] CONDITIONAL
- [ ] FAIL
