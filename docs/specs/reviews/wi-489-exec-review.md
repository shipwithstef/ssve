# WI-489 Independent Execution Review

**Reviewer:** gpt-5.6-sol, high (OpenAI, via Codex CLI + ChatGPT subscription auth)
**Launcher:** `scripts/run-external-review.mjs --orchestrator claude --review-kind exec` (Claude-orchestrated → exact gpt-5.6-sol/high, no fallback)
**Reviewed code-diff sha256:** `cfc6e1d8f1f0e053fbae3531493e95bb190fcd496efa561e9138b3c39dfff6cb` (origin/main..candidate, code files)
**Durable artifacts:** `wi-489-exec-review-artifacts/round1-findings.json`, `round2-findings.json`, `round2-receipt.json`
**Round-2 launcher receipt:** classification `success`, route `exact_primary`, `model_attestation.level=requested_accepted`

## Enabling the review at all

Running the WI-489-mandated reviewer (gpt-5.6-sol) surfaced three defects that made every prior codex review fail before producing findings — the actual cause of the recurring "codex review fails":

1. **Findings schema not OpenAI strict-compatible** — the free-form `consumer_payload` object and several optional properties violated OpenAI strict structured-output (every object needs `additionalProperties:false` and `required` must list every property). Fixed: removed unused `consumer_payload`, made optional fields nullable+required, added a static tier-1 strict-compliance guard.
2. **Model-identity over-strict** — the launcher hard-failed on the model-authored `reviewer.model`/`effort` (gpt-5.6-sol self-reports `gpt-5`/`xhigh`; a model cannot know its deployment alias or launched effort). `validateFindings` now enforces only `host`+`family` (the real cross-family trust boundary); `model`/`effort` are advisory, with the process-level `model_attestation` remaining authoritative.

## Round 1 — 4 findings, ALL accepted and fixed

| Finding | Sev | Disposition |
|---|---|---|
| EXEC-001 override self-authorizable + `Math.abs` ~48h future-replay window | high | FIXED (freshness): reject future timestamps beyond a 5-min skew and anything older than the 24h lifetime. Independent owner-auth deferred → WI-490. |
| EXEC-002 adapter could skip the binding / bind a dependency WI | high | FIXED: adapter derives exactly one authoritative WI (branch-first, `sort -u`) and fails closed (exit 4, zero provider calls) on absence/ambiguity; never invokes the launcher without `--phase-binding`. |
| EXEC-003 exec-record note checked only on HEAD | high | FIXED: `findExecRecordForWi` scans `refs/notes/svc-receipts` across `base..HEAD` (+HEAD). Reachability-after-rewrite residual → WI-490 (EXEC-006). |
| EXEC-004 binding didn't require/verify the plan hash | high | FIXED (syntactic): `plan_manifest_sha256` required in `parsePhaseBinding`. Semantic content-binding deferred → WI-490 (EXEC-005). |

## Round 2 — verification pass, 3 findings

Round 2 confirmed every round-1 fix is correct and that the model/effort relaxation does not weaken cross-family enforcement. It identified the deeper residuals:

| Finding | Sev | Disposition |
|---|---|---|
| EXEC-005 binding self-asserted, not verified against durable `plan-manifest` receipt (direct caller can forge base=HEAD + arbitrary WI/hash; missing binding still allowed unless env switch set) | high | ACCEPTED → **deferred to [WI-490](../work-items/WI-490.md)**; US-7 ACs narrowed to the sanctioned-adapter threat model per the reviewer's own suggested resolution. |
| EXEC-006 exec-record note scan bypassable after history rewrite (reset/rebase makes the noted commit unreachable from `base..HEAD`) | high | ACCEPTED → **deferred to [WI-490](../work-items/WI-490.md)** (reachability-independent notes enumeration / durable WI→exec-record index). |
| EXEC-007 adapter branch-first can bind the branch WI while reviewing a different plan's WI | medium | FIXED: adapter cross-checks the derived WI against the plan's WI set and fails closed (exit 4) on mismatch; fixture added. |

## Verdict

For WI-489's **narrowed (sanctioned-adapter) threat model**, all findings are FIXED or dispositioned; the two deep DIRECT-caller hardening items are re-scoped to the filed, concrete WI-490. No unresolved finding remains in WI-489's scope above MEDIUM. The reviewer explicitly sanctioned the "defer full hardening to a linked follow-up WI + narrow the ACs" resolution.

**Evidence:** launcher suite 144/144, AGY 12/12, full Tier-1 245/245, all with fixture CLIs only (zero live provider calls); two launcher-accepted gpt-5.6-sol reviews.
