# WI-384 — G6 cross-model review + resolutions

**Primary:** codex — credit-exhausted (until Jun 11), legitimate fallback. **Fallback:** gemini (diff-only, `--approval-mode plan`). **Date:** 2026-06-08.
**Verdict:** 3 findings (1 CRITICAL, 2 HIGH) — **all fixed.** On a new PreToolUse hook that runs on every Edit/Write/Bash, the adversarial pass was essential.

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | CRITICAL | Top-level ESM imports resolve BEFORE the `try{main()}catch` wrapper — a missing/broken repo dep (state-io / lib) would throw at module load, exit non-zero, and **brick every Edit/Write/Bash** on the host. | All repo deps are now **dynamically imported INSIDE** the guarded async `main()`; `main().catch(() => exit 0)` + an `uncaughtException` handler. Only `node:path` (builtin, never fails) is top-level. Verified: a broken cwd/dep → exit 0. |
| 2 | HIGH | The dedup memo was saved only if the fires-ledger append succeeded; if the append threw, the memo never persisted and the same learning re-fired every keystroke (context flood + latency). | Persist the dedup memo **FIRST and on its own** (`writeJsonAtomic` in its own try), then append fires best-effort (each in its own try). Dedup now holds regardless of ledger-write failure. |
| 3 | HIGH | `matchByCommand` used a raw substring (`cmd.includes("lib")` matches `glibc`), over-firing learnings and polluting the context budget. | Word-boundary match (escaped basename between non-`[\w.-]` boundaries). Verified: `lib` no longer matches `glibc`; real `wire-hooks.mjs` still matches. |

**Self-review:** additive-only (allow + context, never deny), deterministic (confidence desc / key asc, golden-tested), fail-open by construction (dynamic imports + double catch), per-session dedup that survives IO failure. The fires ledger makes the elevation predicate (confidence≥8 AND fires≥3) computable for the first time. Tier-1 214/0; state-io discipline honored.

**Rejection action:** patch-in-place (1 critical fail-open + 2 high correctness). Iteration count: 1.
