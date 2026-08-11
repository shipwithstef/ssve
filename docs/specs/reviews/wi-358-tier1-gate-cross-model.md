# WI-358 — Cross-Model Review Trail (tier-1 pre-push gate)

**Landed:** PR #30, squash `57b30ed1` (2026-06-07). **Manifest:** `docs/plans/2026-06-06-wi-358-tier1-pre-push-gate/manifest.md`. **Review log:** `docs/plans/2026-06-06-wi-358-tier1-pre-push-gate/review-log.yaml` (terminal: APPROVED_ALL_TIERS).

## Tiers

| Tier | Reviewer | Rounds | Findings | Outcome |
|---|---|---|---|---|
| 1 | verify-plan-mechanical.sh | iterative | C1 path-token classes (incl. CREATE-target chicken-and-egg) | exit 0 |
| 2 (plan G2) | codex (openai) | 2 | 6: PLAN-001 reject lane-compliance (partial-accept — non-chain artifacts demand rejected, Lane Compliance section added); PLAN-002/003 high+medium external-state (checkpoint/probe ledgers declared); PLAN-004 high probe under-spec (deterministic 6-probe harness w/ stdin fixtures); PLAN-005 medium .git/hooks hermeticity (versioned-contract check + warn-only drift); PLAN-006 medium lint-only pushes skipped lint (dual-engage HOT/LINT restructure) | approve (via reviewer-applied patch, audited + accepted with attribution; reviewer scope-overreach documented) |
| 3 (plan) | gemini (google) | 2 | 2 high: T3-001 mkdir -p .svc before bypass append; T3-002 three-dot merge-base for new-branch ranges (two-dot false-engages after main advances) | approve |
| G6 (exec) | codex (openai) | 2 | 2: EXEC-001 reject — dispatcher stdin starvation (slot 10 while-read drained shared stdin; slot 15 saw EOF → silent skip in integrated operation; fixed via dispatcher template stdin capture-replay; dispatcher invariant consciously revised per manifest loop-back row); EXEC-002 medium — bypass channel moved to canonical `.svc/pipeline-decisions.jsonl` per WI guardrail | approve |
| LF (live fire) | reality | 2 pushes | **LF-001 (P0):** first gated push ran the suite under inherited git-hook env; `GIT_DIR`/`GIT_WORK_TREE` leaked into fixture-building validators whose git ops executed against the REAL repo (local main ref hijacked, `core.bare=true`, identity overwritten, branch renamed, 9 validators failed). Recovered from origin-verified refs + object store. Fix: `env -u GIT_*` sanitization for suite + lint; validator check 24. Second push: ENGAGED → 195/195 → PASS with refs verified intact. | clean |

## Verdicts
- codex G6 round-2: `{EXEC-001: confirmed-fixed, EXEC-002: confirmed-fixed, new_findings: [], verdict: approve}`
- gemini T3 round-2: `{T3-001: confirmed-fixed, T3-002: confirmed-fixed, verdict: approve}`

## Live evidence
- Probes 9/9 (`.svc/wi-358-gate-probes.log`): notes-ref skip · docs-only skip (self-verified fixture) · hot-engage suite-green · refuse-block exit 2 (timeout-induced under probe-written refuse policy) · bypass + canonical ledger row · new-branch ENGAGED-delta · integrated dispatcher stdin-replay
- Live-fire push (sanitized): `tier1-gate ENGAGED (suite)` → `195 scripts passed, 0 failed` → `tier1-gate PASS` → branch pushed; `main`/refs integrity verified post-push
