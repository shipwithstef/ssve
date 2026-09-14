# Cross-Model Exec Review (G6): WI-357 — Model-Registry Refresh

**Date:** 2026-06-06 · **Models:** Claude Opus 4.8 (orchestrator) + Codex GPT-5.5 xhigh (adversary, resolver-selected) · **Mode:** exec (diff review) · **Rounds:** 4 · **Branch:** `refactor-wi-357-model-registry` · **Final HEAD:** `02359305` · **Verdict:** **PASS (converged)**

## Summary

- Findings: 6 unique across 4 rounds (3 high, 1 medium, 1 low + 1 orchestrator-found sibling)
- Fixed: 6 (commits `47bbf26b`, `8b82e7fc`, `811200e6`, `02359305`)
- Rejected-with-receipts: 1 half-finding (preflight SCRIPT mimo-first contract — WI-367's adversarially-accepted disposition; **Codex accepted both rulings in round 4**)
- Standout: Codex **web-searched Anthropic's model docs** to prove `claude-opus-4-8` defaults to 1M context, overturning the conservative 200000 value — citation-grade adversarial review
- Orchestrator full-file audit (after patch-cap) caught one sibling Codex hadn't reached (kimi-mixed "MiMo-Omni" shorthand, L57)

## Findings ledger

| # | Sev | Finding | Resolution |
|---|---|---|---|
| X1 | high | model-toggle deep examples (override L92, --invocation L110, MiMo-setup L131-133) still svc-default→mimo | iter1: svc-default examples → claude/sonnet; MiMo examples scoped to opencode-mimo/kimi-mixed, freshened to mimo-v2.5 |
| X2 | high | registry opus contextWindow 200000 stale — Opus 4.8 API default is 1M (Anthropic docs cited) | iter1: 1048576; variants note reframed as harness-tier observation |
| X3 | low | trailing whitespace execute-changeset L174 | iter1: stripped; `git diff --check` clean |
| X4 | high | routing-kimi L46 prose: svc-default "delegates EXEC/SENSE to MiMo" | iter2: prose aligned (Opus/Sonnet/Haiku + key-gated SENSE) |
| X5 | high | execute-changeset Step-0 locked-decision + preflight script still mimo-first | iter3: prose carries SUPERSEDED-by-WI-357 note + states actual script behavior + WI-367 ownership. SCRIPT: rejected-with-receipts (executable transport surface, Tier-3-accepted deferral, preflight-gating evidence). Codex accepted both rulings |
| X6 | med | toggle backward-compat bullets ("Nothing changes" / svc-default-for-MiMo advice) | iter4 + full-file audit: bullets corrected; sibling L57 family shorthand fixed; file provably exhausted |

## Environment notes

- Codex's in-sandbox tier-1 runs were partially red (read-only sandbox can't run setup-dependent validators) — classified environment-class; authoritative runs are the worktree's: PASS pre-iterations and PASS on final HEAD (`.svc/wi-357-tier1-final.log` in worktree)
- review-exec receipt + re-anchored exec-record on `02359305` (note keys verified)

## Receipts

`.svc/receipts/02359305/{exec-record,review-exec}.json` + consolidated git note. Self-review note staged (3 declared gaps, none suspicious-zero). Iteration cap honored: 3 codex patch-rounds + 1 ruling round; convergence achieved with reviewer-accepted dispositions.
