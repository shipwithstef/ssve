# produce-ad-video — Codex exec review

**Date:** 2026-08-28
**PR:** https://github.com/s7an-it/serious-serious-vibe-engineering/pull/30
**Branch:** `feat/produce-ad-video`
**Orchestrator:** grok-4.6 (xai)
**Independent station:** Codex `gpt-5.6-sol` high (`codex-sol-high`)
**Launcher:** `scripts/run-external-review.mjs --orchestrator grok --review-kind exec --reviewer-station codex-sol-high`
**Rounds:** 3 of 3 (hard cap)
**Verdict:** PROMOTED (0 Critical, 0 unresolved High, remaining Medium/Low dispositioned)

## Round 1

Frozen digest `6916944d7e85bcd9c561e1ddee6b8985d77aacc6d188079fb1ede5e6b83e3865` (HEAD `8f1a300`).
Artifact: `.svc/external-review-artifacts/produce-ad-video-exec-r2/findings.json`

Codex verdict `fail`. Findings:

| ID | Sev | Disposition |
|---|---|---|
| F-001 | high | **REJECT** — AGENTS.md §9 still names `skills/route-workflow/SKILL.md` as the Core Pack mirror. Live generator is `routing-rules.md` (`routing-rules-core-pack`). `generate-manifest-mirrors --check` was fresh. SKILL.md has no Core Pack section. |
| F-002 | medium | **ACCEPT** — added repo `DELIVERY-RECEIPT.md` output (`~/delivery` is not a valid contracts path). |
| F-003 | medium | **ACCEPT** — `paid_media=PENDING_FOUNDER_WATCH`; terminal state `WAITING_FOR_HUMAN`. |
| F-004 | medium | **ACCEPT** — P1 requires stills/spectrogram files on disk, not “named windows”. |
| F-005 | medium | **ACCEPT** — added Prompt B/C adjacent negatives (see R3 F-011 residual). |
| F-006 | medium | **ACCEPT** — placeholders `<render-host>` / `<windows-user>`. |
| F-007 | low | **ACCEPT** — first-party count 103 → 104. |

Patch commit: `37eabc2`.

## Round 2

Package still embedded the R1 diff. Codex correctly refused (`F-008` high: digest mismatch). No code change. Re-packaged the frozen cumulative diff.

## Round 3

Frozen digest `64c160ca15952cf90bb4ee89ed2afeebb718b43c2eb641d07615534c6fd15aa1` (HEAD `37eabc2`).
Artifact: `.svc/external-review-artifacts/produce-ad-video-exec-r4/findings.json`

Codex verdict `pass-with-findings`. No Critical, no High.

| ID | Sev | Disposition |
|---|---|---|
| F-008 | medium | accept-with-justification — placement in receipt path is a follow-up; one launch master per product is the current HoursHub shape. |
| F-009 | medium | accept-with-justification — sidecar `chain.lanes: {}`; record-phase when a WI graph exists, not required to land the skill text. |
| F-010 | medium | accept-with-justification — `docs/specs/ad-scripts/` is the declared folder; note already allows an existing cut. Formal one-of input schema is a follow-up. |
| F-011 | medium | accept-with-justification — adjacent negatives are documentation for route-workflow; primary three-line prompt remains the executable case. Split files later. |
| F-012 | medium | **ACCEPT applied after cap** — “before remixing” not “before touching ffmpeg”. |
| F-013 | low | **ACCEPT applied after cap** — CLAUDE.md verified date 2026-08-28. |

## Bounded exit

No 4th round. Residuals do not weaken the house lock (no second loudnorm, I2V hygiene, VM delivery ≠ Windows write, founder watch).
