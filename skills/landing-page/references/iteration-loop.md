# Iteration Loop — failure-driven retry rules

`landing-page` produces a benchmarked output. If `benchmark-landing` returns a weighted score < 7.5, the skill enters the iteration loop. Without explicit failure-mapped retry rules, iteration becomes "try random tweaks until something passes" — which produces local maxima with no convergence.

This doc defines: for each benchmark dimension that scored low, which artifacts to regenerate.

## Benchmark dimensions (from `benchmark-landing`)

The benchmark-landing skill scores 8 dimensions. The 9th dimension ("delta vs predecessor") only applies on iterations 2+.

| Dim | Name | Low-score signal | Regenerate |
|---|---|---|---|
| 1 | Information density | Hero too sparse OR too cluttered | Copy variants (Step 3 in Process) — request 3 new at adjusted density |
| 2 | Visual hierarchy | CTA not dominant; eye doesn't track to value-prop | Component scaffold (Step 5) — adjust hero layout proportions |
| 3 | Brand consistency | Asset palette drifts from brand tokens | Re-brief generate-visuals with stricter `forbid:` and explicit palette tokens |
| 4 | Trust signals | Generic logos, no real social proof | `marketing-context.md` enrichment required — block until real customer assets are sourced |
| 5 | Mobile fidelity | Mobile viewport benchmark fails | Component scaffold — re-render at 1242×2688 with mobile-first stack |
| 6 | Loading performance | LCP > 2.5s, CLS > 0.1 | Asset optimization — codex-image.md post-step (`convert ... -quality 80`); add explicit width/height |
| 7 | Sector adherence | Looks like generic SaaS, not the sector archetype | Re-pick anchor from `references/landing-bank/<sector>/` and re-write brief |
| 8 | Conversion intent | Multiple CTAs competing, unclear next-step | Copy variants — single-CTA constraint added to brief |
| 9 | Delta vs predecessor (iter 2+) | New version measurably worse on any dim than prior | Roll back the regression by reverting that dim's specific change; regenerate other dims |

## Iteration cap

After **3 iterations** without crossing 7.5, halt and surface to user with:
- All 3 benchmark reports
- The dim-by-dim trend (improving / regressing / plateaued)
- A specific recommendation: "this brief / this anchor / this sector might not have a 7.5+ design with current constraints — escalate to founder for archetype reconsideration"

This prevents infinite iteration burning credits on unsolvable briefs.

## Cost-aware iteration

Each iteration costs:
- 3 copy variants (~$0.10 in LLM tokens)
- 3-9 visual candidates (~$0.30-2.00 per iteration depending on providers)
- 1 component re-render (free, local)
- 1 benchmark run (~$0.20 — `benchmark-landing` is LLM-graded)

So 3 iterations ≈ $1.50-7.00. If the iteration cap fires, the user is informed BEFORE the 4th attempt — they choose whether to keep iterating or escalate.

## What does NOT trigger an iteration

- Test infrastructure errors (Playwright crash, screenshot timeout) — re-run that step, not the whole loop
- User-driven brief changes — those are a NEW invocation, not an iteration of the prior brief
- Benchmark scoring 7.5-7.9 (passing but tight) — ship; an iteration here would over-invest

## Invocation

Iteration is automatic inside `landing-page` Step 6 (Benchmark gate). The skill reads the benchmark report, looks up the failing dim(s) in the table above, regenerates the named artifacts, and re-runs benchmark. No external invocation of the iteration loop is needed.
