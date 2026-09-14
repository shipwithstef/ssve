# WI-383 — G6 cross-model review + resolutions

**Primary reviewer:** codex — **credit-exhausted** (verified live, until Jun 11), a legitimate mid-run primary failure.
**Fallback reviewer:** gemini (per `resolve-adversarial-reviewer.sh`). Diff-only, scope-locked (`--approval-mode plan`, piped via stdin). **Date:** 2026-06-08.
**Verdict:** 5 findings (**2 CRITICAL, 3 HIGH**) — **all accepted and fixed.** On the only forward WI that can drop a review pass, the adversarial pass earned its keep: every finding was a real fail-open in a fence.

| # | Sev | Finding | Resolution (accepted + fixed) |
|---|-----|---------|-------------------------------|
| 1 | CRITICAL | `window_complete`'s `spanDays` used `recs[0].epoch` — the oldest receipt in the lane's ENTIRE history, not the streak. A lane with any 14-day-old receipt instantly passed the window for 5 clean receipts made in a single hour, defeating the 14-day observation period. | `tierForLane` now spans the **clean streak itself** (`nowEpoch - streakRecs[0].epoch`): the streak must have ≥5 receipts AND span ≥14 days. Golden test: rapid clean burst + an old dirty (not-in-streak) receipt → `full`. |
| 2 | CRITICAL | `INFRA_RE` omitted `infra/` though AC4 explicitly lists it — any `infra/` change failed open and could earn compression. | Added `infra` to the regex. Golden test: `INFRA_RE.test("infra/foo.tf")` → match. |
| 3 | HIGH | The "untagged → unknown → never compresses (safe)" claim was asserted but NOT enforced — 5 untagged receipts could let the `unknown` lane earn compression. | Explicit guard at the top of `tierForLane`: `if (lane === "unknown") return full`. Golden test. |
| 4 | HIGH | The validator enforced strict line-by-line timestamp monotonicity on `rule-hits.jsonl`, but the file is `union`-merged — concurrent appends interleave and would randomly break CI. | Relaxed to **event-validity** (every line a valid event with a parseable ISO ts); append-only is enforced by the union-merge driver + tracking, not by line order. |
| 5 | HIGH | Receipts with unparseable timestamps (`NaN` epoch) were silently filtered out — a DIRTY-but-undated receipt would vanish instead of breaking the clean streak, preserving a false streak. | Removed the silent filter; any non-finite epoch in the lane forces conservative `full`. Golden test: NaN-epoch receipt → `full`. |

**Self-review:** the value-reduction containment is now real — compression is default-OFF (route-workflow opt-in), only the plan-level round is ever tiered, and all four fences (cold-start, streak-span window, corpus-reset, infra/dirty/iteration streak-break) are golden-tested fail-CLOSED. I had also caught and fixed AC2's corpus-reset (stubbed `corpus_stable:true`) pre-review.

**Rejection action:** patch-in-place (2 critical + 3 high fence fixes + 4 new regression tests). Iteration count: 1. Full tier-1 green.
