# Deep-dive #4: Memory Secret Redaction (scorecard rows #46/#72)

**Source:** GSD-2 `bin/lib/secrets.cjs` (Deterministic Secret Masking) + gsd-2/skills-agents.md § Memory secret redaction (10 SECRET_PATTERNS regex set, `redactSecrets(text)` runs all patterns with `[REDACTED]` replacement before LLM ingestion).
**Decision required:** adopt OR skip.

## What the feature is

Two complementary mechanisms:

1. **Deterministic config-key masking** (`bin/lib/secrets.cjs`): explicit `SECRET_CONFIG_KEYS` set (`brave_search`, `firecrawl`, etc.). When rendering config output, if `isSecretKey` is true: secret >= 8 chars returns `****<last-4>`; secret < 8 chars returns strictly `****`. Mathematically prevents fractional leaking.

2. **Memory-ingestion regex redaction** (`SECRET_PATTERNS`): 10 regex patterns covering generic API keys/tokens, AWS AKIA keys, GitHub tokens, Stripe keys, JWTs, private keys, Bearer tokens, npm tokens, Anthropic keys, OpenAI keys. `redactSecrets(text)` runs ALL patterns with `[REDACTED]` replacement before any text is sent to an LLM for memory extraction.

## svc current state

This is the highest-risk gap in the entire scorecard. Auto-learning capture (WI-343, just landed) writes raw session snippets to `.svc/auto-learnings.jsonl`. Promotion via `scripts/promote-auto-learnings.mjs` writes those snippets into tracked files (`references/framework-learnings.jsonl`, `docs/learnings/learnings.jsonl`) AND into user-memory directories. **NONE of these paths run secret redaction.** A session that included an API key in a tool output (e.g. `gh api -H "Authorization: Bearer ghp_..."`) can leak that key into:

- `.svc/auto-learnings.jsonl` (gitignored, but local disk)
- `references/framework-learnings.jsonl` on promote (TRACKED — would commit to repo)
- `docs/learnings/learnings.jsonl` on promote (TRACKED)
- User-memory directories on promote (`.claude/projects/.../memory/feedback_*.md`)

Adjacent svc artifacts:
- `hooks/svc-auto-capture-learnings.mjs` — the writer; passes raw `insight` text through with no redaction
- `scripts/promote-auto-learnings.mjs` — the promoter; same
- `scripts/lib/learning-candidate-detector.mjs` — the detector; reads `git log` and `pipeline-decisions.jsonl` (could contain secrets in error messages)
- No svc artifact runs any regex secret-redaction
- No svc artifact has a `SECRET_CONFIG_KEYS` set

## 10 improvement scenarios

### Scenario 1: API key in a tool output gets captured into auto-learnings

**Today (svc):** Session error output includes `Authorization: Bearer ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`. The auto-learning detector captures the surrounding decision context. The Bearer token is now in `.svc/auto-learnings.jsonl`. User runs `promote-auto-learnings` → token is now in `references/framework-learnings.jsonl` (tracked). User pushes the framework PR. Token is now in the public GitHub repo. Catastrophe.
**With redaction:** Before any text is appended to `.svc/auto-learnings.jsonl`, `redactSecrets(text)` runs all 10 regex patterns. The Bearer token becomes `[REDACTED]`. Promotion to tracked files is safe.
**Improvement:** Closes a real pre-disclosure leak path.
**Verdict: POSITIVE — critical security gap.**

### Scenario 2: AWS AKIA key in a stack trace from an integration test

**Today (svc):** `aws-sdk` error includes the AKIA key. Captured by auto-learning hook. Promoted. Leaked.
**With redaction:** AWS AKIA pattern matches `AKIA[0-9A-Z]{16}`. Replaced with `[REDACTED]`. Safe.
**Verdict: POSITIVE.**

### Scenario 3: OpenAI API key (`sk-proj-...`) in a debug output

**Today (svc):** Same leak path.
**With redaction:** OpenAI pattern catches `sk-(proj-)?[A-Za-z0-9_-]{20,}`. Redacted.
**Verdict: POSITIVE.**

### Scenario 4: Anthropic API key (`sk-ant-...`)

**Today (svc):** Same leak path.
**With redaction:** Anthropic pattern catches `sk-ant-[A-Za-z0-9_-]{20,}`. Redacted.
**Verdict: POSITIVE.**

### Scenario 5: GitHub token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`)

**Today (svc):** Same leak path. svc heavily uses `gh` CLI; tokens appear in error output, in `.git/config` if accidentally exposed, in CI logs.
**With redaction:** GitHub token pattern catches `gh[pousr]_[A-Za-z0-9]{36}`. Redacted.
**Verdict: POSITIVE.**

### Scenario 6: Stripe key (`sk_live_`, `pk_live_`, `sk_test_`, `pk_test_`)

**Today (svc):** Less common in svc itself but high-risk for projects svc supports.
**With redaction:** Stripe pattern catches `(sk|pk)_(live|test)_[A-Za-z0-9]{24,}`. Redacted.
**Verdict: POSITIVE.**

### Scenario 7: JWT in an error trace

**Today (svc):** JWT body might contain PII or session identifiers.
**With redaction:** JWT pattern catches `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`. Redacted.
**Verdict: POSITIVE.**

### Scenario 8: Private key block in a `cat ~/.ssh/id_ed25519` output

**Today (svc):** N/A (svc shouldn't be reading SSH keys, but if a debugging session does, the multi-line key block ends up in pipeline-decisions if it happens during a decision).
**With redaction:** Private-key pattern catches `-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----`. Redacted.
**Verdict: POSITIVE.**

### Scenario 9: False positive — string that LOOKS like a token but isn't

**Today (svc):** N/A.
**With redaction:** A 36-char hex string in a code comment matches the generic-token pattern, gets redacted. Code comment becomes `// hash: [REDACTED]`. Mild noise but no harm — never the wrong direction (over-redact is safer than under-redact).
**Mitigation:** Document the over-redaction tradeoff explicitly. Provide an `SVC_REDACTION_DEBUG=1` env var that LOGS each redaction (path, pattern, masked length) so users can audit false positives.
**Verdict: POSITIVE.**

### Scenario 10: Performance — running 10 regex patterns on every captured snippet

**Today (svc):** N/A.
**With redaction:** 10 short regex passes on a typical ~200-char insight string = <1ms total. Even on a long captured pipeline-decisions block (10K chars), still <10ms. Negligible cost vs the catastrophe-class avoidance.
**Verdict: POSITIVE.**

### Scenario count: **10 POSITIVE.**

## Blast radius

| Touched | Type | Regression risk | Mitigation |
|---|---|---|---|
| `scripts/lib/secret-redaction.mjs` (new) | helper | — | new file; pure regex set + `redactSecrets(text)` and `maskConfigValue(key, value)` exports |
| `hooks/svc-auto-capture-learnings.mjs` | existing hook | LOW: adds one `redactSecrets()` call before `appendJsonlLine` | unit test on a fixture containing each of the 10 secret patterns |
| `scripts/promote-auto-learnings.mjs` | existing script | LOW: defensive double-check via `redactSecrets()` before append (in case the source `.svc/auto-learnings.jsonl` was hand-edited or pre-redaction-era data) | same unit test |
| `scripts/lib/learning-candidate-detector.mjs` | existing detector | LOW: when reading `pipeline-decisions.jsonl` or `git log` output, run through `redactSecrets()` BEFORE storing the snippet in the candidate's `insight` field | unit test |
| `hooks/svc-session-end-log.mjs` (and other hooks that write `.svc/*.jsonl`) | existing hooks | LOW: optional defensive redaction at log-write time | per-hook unit test |
| `references/framework-learnings.jsonl` | tracked file | LOW: a one-time `node scripts/audit-secrets-in-tracked.mjs` audit covers existing entries; future entries protected by the new path | one-time audit script |
| `docs/learnings/learnings.jsonl` | tracked file | LOW: same | same |
| `concerns/secret-leak-prevention.md` (new) | concern | — | new file; required_skills include `manage-learnings` |
| `test-framework/evals/tier-1/validate-secret-redaction.sh` (new) | tier-1 validator | — | new file; tests each of the 10 patterns redacts correctly + the fail-open behavior on non-string input |

**Net regression risk:** ZERO on the happy path (legitimate insight text passes through unchanged). Possible mild over-redaction on false positives (mitigated by the debug-log env var). The net catastrophe-class avoidance dramatically outweighs the over-redaction cost.

**Critical implementation rule:** the redaction MUST happen BEFORE the first write to ANY persistent file. NOT at promotion time, NOT at preload time. At the source. This ensures the secret never touches disk in clear text.

## Decision

**ADOPT — TOP PRIORITY.** All 10 scenarios are positive. Blast radius = zero-regression. This closes the highest-severity gap in the framework: secrets leaking from session output into tracked files via the auto-learning pipeline. The implementation is small (~150 lines for the helper + 5-10 lines per integration point) and the security value is large.

This deep-dive's verdict supersedes any earlier "🟡 partial" classification on rows #46 and #72.

## Implementation handoff

Next PR: implement `scripts/lib/secret-redaction.mjs` with the 10-pattern regex set + `redactSecrets()` + `maskConfigValue()`. Wire into all auto-learning entry points BEFORE first-disk-write. Run a one-time audit script on existing `references/framework-learnings.jsonl` and `docs/learnings/learnings.jsonl` to detect (and surface for review) any pre-existing secrets — manual cleanup if any found. Pipeline: `plan-changeset` → `review-plan` (codex, with explicit security-review framing) → `execute-changeset` → `review-cross-model` (codex) → `review-security` skill → `land-changeset`. Update scorecard rows #46/#72 verdict to ✅ on land.
