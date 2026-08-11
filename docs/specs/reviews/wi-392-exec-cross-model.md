# WI-392 — G6 cross-model adversarial review (review-exec)

**Date:** 2026-06-08
**Subject:** action-time intended-owner injection (`hooks/svc-owner-inject.mjs`, `hooks/lib/owner-index.mjs`, `ownersRegistry`, wiring, validator)
**Reviewer chain:** Codex (primary) → Gemini (fallback). Codex produced the initial findings, then hit its usage limit (until Jun 11) on the re-review; Gemini took over the confirmation passes.
**Self-review (orchestrator, Claude):** additive-only by construction (allow + additionalContext, never deny); fail-open via dynamic-imports-in-`main` + `main().catch` + `uncaughtException`; deterministic order-stable match. Mirrors the verified WI-361/WI-384 injectors.

## Findings (Codex, P1 ×3 — all real, all resolved)

| # | Severity | Finding | Resolution | Confirm |
|---|---|---|---|---|
| F1 | P1 | **Fail-open violated on memo-write failure** (`svc-owner-inject.mjs`). `writeJsonAtomic` could spin the default **5s** state-lock on a stale `.lock`, then inject anyway → hot-path hang + re-fire spam (dedup never persisted). | `writeJsonAtomic(..., {timeoutMs:250})` and SKIP the injection (`return`, no output) when persistence fails — bounded, no-hang, no-spam. | Gemini: **RESOLVED** |
| F2 | P1 | **ReDoS via untrusted regex** (`owner-index.mjs`). A catastrophic regex (`(a+)+$`) from a project `.svc/task-owners.json` would hang the hot path before fail-open. | First fix (nested-quantifier heuristic) was **bypassable** — Gemini found `(a?)+$` and `(a|aa)+$` still hang. Reworked: **removed the untrusted-regex surface** — project signals are matched as **literal substrings** (`String.includes`, never compiled); only the trusted, in-repo-reviewed global `ownersRegistry` uses regex, behind an improved `safeRe` (rejects any quantified group) + a 2000-char input cap. | Gemini: **RESOLVED** |
| F3 | P1 | **Shadow applied after signal filtering** (`owner-index.mjs`). A project row narrowing a `task_class` still let the broad global owner fire on inputs only the global matched. | `loadOwners` now drops global rows whose `task_class` is claimed by any project row **at load time, before signal evaluation** — the project fully shadows the global. | Gemini: **RESOLVED** |

## Loop
Codex (3×P1) → patch → Gemini re-review (F1+F3 RESOLVED, F2 NOT-RESOLVED, bypass cited) → F2 rework (architectural, not heuristic) → Gemini re-confirm (F2 **RESOLVED**). Iteration count: 2 patch passes, no re-plan. All resolutions carry a regression test in `validate-owner-injection.sh` (F2 dual global/project test incl. the Gemini bypasses; F3 narrowed-shadow test). Final tier-1: **215/0**.

## Sibling note (follow-up)
F1's root cause (the 5s `writeJsonAtomic` lock default on a hot-path memo write) **also affects the WI-384 sibling `svc-learning-inject.mjs`**, which Gemini's WI-384 G6 did not surface. Filed as a follow-up: apply the same `{timeoutMs}`+skip bound to the learning injector's memo/fires writes.

**Verdict: pass** — additive-only, fail-open, deterministic, ReDoS-proof; all 3 cross-model findings resolved and locked by regression tests.
