# WI-361 — Cross-Model Review Trail (signal-gated rule injection)

**Landed:** PR #33, squash `13892cd0` (2026-06-07). **Manifest:** `docs/plans/2026-06-07-wi-361-rule-injection/manifest.md`. **Review log:** review-log.yaml (APPROVED_ALL_TIERS).

| Tier | Reviewer | Outcome |
|---|---|---|
| host-capability gate | claude-code-guide agent | additionalContext per-event matrix vs live docs: PreToolUse allow+context (10K cap) → the WI's PreToolUse upgrade clause fired |
| 2 (plan) | codex — **5th output corruption; ALL 8 findings recovered from ~/.codex/sessions transcript (new protocol)** | 8/8 ACCEPTED incl. **PLAN-001 CRITICAL** (host-generic trim + Claude-only injector = 4 hosts silently lose 30 rules → Claude-scoped); payload normalizer; two-state memo; bridge-only fixtures; content keywords; identity allowlist; Write-tool authenticity path |
| 3 (plan) | gemini | T3-002 globToRe anchoring ACCEPTED (then its verbatim snippet's self-clobber found+fixed at GREEN); **T3-001 CRITICAL REJECTED w/ live realpath evidence** (module __dirname resolves through install symlink to repo → injector reads untrimmed repo rules) — rejection upheld |
| G6 (exec) | codex ×3 | EXEC-001 HIGH: sweep could delete a USER's personal rules → svc-owned-only gate; EXEC-002 cwd-escape (+r2 normalize-order residual); EXEC-003 true fail-open; EXEC-004 keywords invariant; r3 approve |
| live fire | reality | drift-sync pre-commit ran the patched setup mid-execution → early-continue skipped EXPECTED_ALWAYS tracking → live dir EMPTIED; backup held, **restore proven by actual use**, tracking-order fix landed |

## Live evidence (post-merge, from main)
- Trim: 31→6 files; always-on bytes 121,502 → **11,162** (~27K tokens/session reclaimed)
- Injector wired ×3; live smoke through the INSTALLED symlink path: react rule injected (4,728 chars) with `permissionDecision: allow` — pre-edit injection working in production
- Dual restore lines captured (.svc/wi-361-live-rewire.log)
