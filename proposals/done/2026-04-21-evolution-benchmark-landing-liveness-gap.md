# Framework Evolution — 2026-04-21

**Status:** IMPLEMENTED (2026-04-21, via `improve-framework` direct SKILL.md edit route — see `proposals/done/2026-04-21-framework-improvement-benchmark-landing-v2.md`). P0 findings F-012, F-013, F-015 landed in `benchmark-landing/SKILL.md` (rubric v2 + Step 0 precondition) and `references/landing-bank/local-business-saas/README.md` (positioning + capture-bundle status). P1/P2 findings deferred per FRAMEWORK-STATE entry 2026-04-21.

**Trigger:** Diagnostic on WI-088 iter1 landing hero (example-marketplace). Benchmark scored 7.50/10 PASS. User visually compared current (`1543f53`) vs pre-WI-088 original (`04e35411`) at 1600×900 and reported "feels barely different." Investigation confirms: the user's intuition is correct, and it exposes real gaps in `benchmark-landing/SKILL.md` and `references/landing-bank/local-business-saas/`.

## Method

1. Read `FRAMEWORK-STATE.md` sections on 2026-04-20 benchmark-landing gate, landing-bank F-001, rubric locked decisions (aggregate = min of per-viewport, sample refresh cadence).
2. Read `benchmark-landing/SKILL.md` — all 8 rubric dimensions and weighting.
3. Read `references/landing-bank/local-business-saas/README.md` — sample set, medians, declared Example Marketplace-applicable patterns.
4. Read `docs/specs/benchmark/2026-04-20-wi-088-iter1-landing.yaml` (iter1 PASS score) and `…-wi-088-landing.yaml` (iter0 BLOCK score).
5. Read `src/components/landing/LiveStorefrontHero.jsx` (iter1) and `git show 04e35411:src/pages/Landing.jsx` (predecessor).
6. Spun worktree at `04e35411`, ran `vite --port 5175`, captured both pages at 1600×900 via Playwright. Compared side-by-side.

Screenshots retained at `/home/svc-user/app-workspaces/example-marketplace/.playwright-mcp/iter1-current-1600x900.png` and `…/iter0-original-1600x900.png`.

## The visual finding (honest answer to user's question)

**Cold-glance in first 3 seconds — are iter1 and the pre-WI-088 original distinguishable?** No. Both share:

- Identical split-hero silhouette (copy left, card right)
- Identical dark purple → slate gradient background
- Identical "fake browser chrome" framing on the right card
- Identical left-column treatment (trust badge, same headline, same subhead, same multilingual strip, same CTAs)
- Roughly identical right-column footprint

What differs, *inside* the right card:

| | Original (`04e35411`) | iter1 (`1543f53`) |
|---|---|---|
| Inside-card visual | Unsplash dashboard photo (real chart with axes, tick marks, data labels "PAGE VIEWS VS ONLOAD", "FLASH RENDER (LUX)") | Hand-built "Flash Offer" offer card (one gradient pill, one headline, one counter line, one progress bar) |
| Floating elements | **Two** overlay cards: "+47% Revenue / This month" and "LIGHTNING DEAL / Happy Hour 50% Off! / 12 customers claimed / [progress bar]" | **Zero** floating overlays. Everything inside the single card. |
| Liveness signals visible in first 3s | 3D tilt on mousemove (interactive) + two stat cards with concrete numbers (+47%, 12 claimed) | One `animate-ping` pulse on a 1.5×1.5px green dot (LIVE pill) — easily missed. Counter tick is on an **8-second** interval (likely invisible to a bouncing visitor) |
| Information density on the right card | High (chart + 2 stat overlays + trophy badge) | Low (1 offer card, 4 text elements) |

**Blunt conclusion:** iter1 has LESS perceived liveness than the version it replaced. The predecessor — which we scored 3.8/10 and called BLOCK — had two visible stat overlays and a 3D tilt. iter1 has one 8-second tick and a 1.5px pulsing dot. The benchmark-landing rubric said "+3.70 points improvement" but at cold-glance the new design is *quieter* than the old one, not just "less chaotic."

This is not a claim that iter0 was correct — the 12-character animated scene that iter0 actually shipped (before execute-changeset landed iter1) truly was wrong. But iter1 corrected against the 12-character scene by reverting to something *visually indistinguishable* from the pre-WI-088 baseline, while replacing a believable dashboard photo with a lower-information hand-built card.

## The OpenTable archetype discrepancy

`references/landing-bank/local-business-saas/README.md:31-32` claims "most 'live' element observed is a single animated booking-availability pill (OpenTable)" and scores iter1's `vs_best_in_class_anchor` at 7/10. **But no OpenTable capture exists in the bank.** The sample dossier has 5 products listed (OpenTable, Resy, Square, Mindbody, Top of Mind Networks) but no stored screenshots, no measured motion counts per sample, no captured pattern file per sample. The "sector medians" are asserted, not computed from captured evidence.

This is the heaviest-weighted dimension in the rubric (weight 1.5, `benchmark-landing/SKILL.md:47`) and it was scored 7/10 against a claim, not against a measurement. OpenTable's actual hero has a live availability widget showing **concrete bookable times** (e.g. "7:00 PM · 7:15 PM · 7:30 PM") — this is a visible product affordance, not an abstract "LIVE" pill. iter1's Flash Offer card shows "4 / 12 claimed" — that is count display, not an affordance. Different league of liveness.

## Findings

### P0 — Fix now (blocks quality)

**F-012. `vs_best_in_class_anchor` dimension scores against claims, not captured evidence.**

Evidence: `benchmark-landing/SKILL.md:47` weights dimension 8 at 1.5× (heaviest). `references/landing-bank/local-business-saas/README.md` lists 5 samples in a table but stores no screenshots, no per-sample `pattern.md`, no measured motion-element counts per sample. The iter1 score-yaml (`docs/specs/benchmark/2026-04-20-wi-088-iter1-landing.yaml:31`) rubber-stamped `vs_best_in_class: 7 — "OpenTable-archetype quiet product card — legitimately in same family now"` without presenting OpenTable's current hero for comparison.

Fix:
1. `benchmark-landing/SKILL.md` Step 3 precondition: for each of the top-3 bank samples, require a stored `references/landing-bank/<sector>/<sample>/hero.png` captured within the last 6 months AND a `pattern.md` with measured element count + motion count + liveness affordances.
2. `benchmark-landing/SKILL.md` Step 4 (Omni subjective dimensions): the prompt must include the top-3 captured samples as image inputs. If samples are missing, skill must HALT and route to `references/landing-bank/<sector>/` maintenance, not emit a score.
3. `benchmark-landing` self-verify must fail if `references/landing-bank/<sector>/*/hero.png` is missing for ≥3 samples.

**F-013. "Motion tempo" dimension conflates three unrelated things: count, tempo, and perceptibility.**

Evidence: `benchmark-landing/SKILL.md:42` reads "count of simultaneously-animating elements. Must be ≤ sector 75th percentile." iter1 scored 9/10 on motion tempo because it has "1 animated element." But that 1 element ticks every **8 seconds** — below the human noticing-threshold for cold-glance animation in a hero (common UX heuristic: hero motion must cycle within 2-4s or the visitor bounces before seeing it). A 1-element animation at 8s vs. a 1-element animation at 2s are not equivalent under the rubric but produce radically different perceived-liveness.

Fix: split dimension 3 into two dimensions:
- 3a. **Motion count** — number of simultaneously-animating elements. Cap at sector 75th percentile (keeps the anti-chaos guardrail that correctly killed iter0).
- 3b. **Perceptibility of liveness** — for any motion element, does the cycle complete within 4s, AND is the moving pixel area ≥0.5% of the hero viewport? If yes → scored by whether motion reads as "something is happening here." If no → motion element does not count toward "this hero feels alive."

This directly addresses the iter1 failure mode: a 1.5×1.5 px `animate-ping` dot on a LIVE pill has motion area ~0.01% of a 1600×900 hero — mechanically present, practically invisible. An 8-second counter tick has a 200ms transform but the next event is 7.8s away — perceptibility from a cold-glance visitor is ~0.

**F-014. Sample bank biased toward enterprise-static; no indie-SaaS-alive anchor.**

Evidence: `references/landing-bank/local-business-saas/README.md:11-15` — 4 of 5 samples are enterprise (OpenTable, Resy, Square, Mindbody), 1 is indie (Top of Mind Networks). Enterprise SaaS landings optimize for "we won't break" (static, conservative). Indie SaaS landings — especially ones where the product differentiator IS liveness (like Example Marketplace's "Flash Offers" pitch) — optimize for "we feel alive." The sector median computed from this bank ("0-1 motion per hero") pulls every scored candidate toward the enterprise-defensive end. Correct behavior for Example Marketplace's positioning is *not* sector median; it's sector 75th-90th percentile on liveness.

Fix: add to `references/landing-bank/local-business-saas/README.md`:
- `positioning_tag` per sample: `enterprise-defensive` vs `indie-alive`
- Sector medians computed per positioning segment, not just globally
- `benchmark-landing/SKILL.md` input: candidate's `positioning` must be declared; comparison uses the matching segment's medians + 75th percentile, not the global median
- Bank addition priority: 3+ indie-alive samples (candidates: Linear `/home` circa 2024-2026, Raycast `/`, Attio `/`, Cron (now Notion Calendar) pre-acquisition hero) — not local-business-specific but positioning-matched

**F-015. No "delta-from-predecessor" dimension in the rubric.**

Evidence: iter1 was scored against the sector bank, not against the pre-WI-088 original. Both would score similarly on the 8-dimension rubric because they share silhouette, layout, background, and (now) motion count. But shipping iter1 as "iter0 resolved" is misleading when iter1 is cold-glance-indistinguishable from a version we already had *before* we spent 3 commits + a 9-finding review-plan pass + a 5-sample bank.

Fix: add dimension 9 to `benchmark-landing/SKILL.md`:
- **Design delta vs baseline** — when iterating on an existing design, score how visually distinguishable the candidate is from its predecessor within the first 3 seconds of cold view. Weight 0.75. Low score = "you spent N commits to land in the same visual neighborhood you started in." This forces the pipeline to either (a) justify the revert as intentional, or (b) keep iterating until the delta is visible.
- Implementation: capture predecessor screenshot + candidate screenshot, Omni prompt "would a cold visitor perceive these as the same hero or different heroes?" emit 1-10.

This is the single change that would have flagged WI-088 iter1 as "you fixed the motion chaos but landed back at the pre-WI-088 baseline; reviewer should decide if that's intended."

### P1 — Fix soon (degrades quality)

**F-016. Pipeline has no cold-glance test before execute-changeset.**

Evidence: `benchmark-landing/SKILL.md` dimension 7 (`first_5_sec_comprehension`) scores *comprehension* ("can visitor name the purpose in 5s"). It does NOT score *perception of liveness* in 3s. Those are different axes. iter1 passes comprehension (pitch is clear) while failing perceived-liveness. No other skill in the pipeline owns this.

Fix: extend dimension 7 or add 7b: "first-3-sec liveness perception — would a cold visitor, within 3 seconds of page load, perceive the hero as static, subtly-live, or clearly-live?" Score 1-10 where static=1-4, subtly-live=5-7, clearly-live=8-10. Evidence requirement: Omni must be shown a 3-second MP4/GIF capture of the hero, not a still PNG. This is an input-format change to `scripts/benchmark-landing-capture.sh` — add `--capture-motion` flag that produces a 3-second WebM alongside the PNG set.

**F-017. Sample bank "medians" are asserted without per-sample captures.**

Evidence: `references/landing-bank/local-business-saas/README.md:17-26` presents a "Pattern density summary (median of 5 samples)" table with specific numbers (4 primary elements, motion count 0-1, density ~5 per 100k px², etc.). None of these numbers are traceable to a captured sample file in the repo. There is no `references/landing-bank/local-business-saas/opentable/hero.png` + `pattern.md` with the measurements. The medians are a reasonable prior, but the skill uses them as ground truth.

Fix:
1. Each sample in the bank needs a subdirectory: `references/landing-bank/<sector>/<sample-slug>/` containing `hero.png` (current capture), `hero.webm` (3-second motion capture), `pattern.md` (measured dimensions).
2. Sector README's median table must be *computed* (script: `scripts/compute-sector-medians.mjs`) from the per-sample `pattern.md` files, not hand-asserted. The computed table is regenerated on each bank refresh.
3. Add `benchmark-landing` self-verify check: "sector README medians match recomputation from per-sample pattern.md within ±10%."

### P2 — Improve when possible

**F-018. Override audit trail exists only in declaration, not in enforcement.**

Evidence: `benchmark-landing/SKILL.md:143` says "All overrides land in `.svc/quality-timeseries.jsonl` (via F-005 when landed). No silent bypasses." F-005 (quality timeseries) is not landed per this proposal date. So "all overrides land in timeseries" is currently aspirational. iter1 did not need an override (it passed 7.50), so this wasn't exercised — but the next sub-7 result will have no timeseries to land in.

Fix: implement F-005 (already queued from 2026-04-20 proposal) as a prerequisite for the override-protocol claims in `benchmark-landing/SKILL.md`. Until then, update the skill to say "overrides must be logged in `FRAMEWORK-STATE.md` under the current date entry" as an interim measure.

**F-019. Aggregate as min-of-viewports can hide that ALL viewports are mediocre.**

Evidence: `benchmark-landing/SKILL.md:55`, iter1 yaml: viewport scores 7.75 / 7.75 / 7.50 / 8.13 / 8.25. Aggregate = 7.50 (min). All 5 viewports are between 7.50 and 8.25 — a tight band, well above 7. That's the intended behavior.

But consider: if ALL 5 viewports scored exactly 7.0, aggregate would be 7.0 (PASS), even though the design is "exactly threshold everywhere" — i.e. nowhere is it good, it just fails to fail. Min-of-viewports catches regression (one bad viewport blocks) but doesn't distinguish "broadly good" from "broadly mediocre."

Fix (P2, not urgent — current math is defensible): add a secondary reportable: `viewport_mean` alongside `aggregate` (= min). If `aggregate ≥ 7` but `viewport_mean < 8`, surface a "passing without excelling" warning in the yaml, non-blocking.

### P3 — Track

**F-020. "8-second loop" was an intentional choice, but the rubric never tested whether the choice was correct.**

Evidence: `src/components/landing/LiveStorefrontHero.jsx:35` hardcodes `intervalMs = 8000`. The component author reasoned correctly about reducing chaos vs iter0. But no step in the pipeline asked "does 8 seconds match or beat OpenTable's live availability update cadence?" It was an internal taste call, accepted by review-plan without external-reference check.

Not actionable as a P0-P2 fix — F-013 (perceptibility) already creates the forcing function that would have caught this. Tracking for future evolve-framework passes: individual tempo values should be defensible against captured competitor tempos, not just "≤ sector 75th percentile count."

## Comparison delta (vs adjacent frameworks)

- Gstack / superpowers: no direct equivalent of `benchmark-landing`. svc is ahead on having the skill at all. The gaps are internal to svc's implementation, not capabilities other frameworks cover.
- General UX industry practice: landing-page benchmarks in design agencies typically DO include captured-predecessor delta reviews and motion-capture (MP4/WebM) as part of the audit bundle. F-015 (delta dimension) and F-016/F-017 (motion capture) bring svc in line with mainstream UX-audit practice.

## Stale proposal audit

- `proposals/2026-04-20-evolution-design-benchmark-gate.md` → implemented as F-001/F-002/F-003/F-004 (per FRAMEWORK-STATE entry 2026-04-20). Should move to `proposals/done/` if not already.
- `2026-04-19-evolution-design-ui-*.md` (three files) — not audited in this pass; orthogonal to this finding.
- F-005 (quality timeseries), F-006 (illustration-craft rule extension), F-007 (blend watchlist), F-002-followup (auto-dispatch Omni), F-001 expansion (10 samples per sector + new sectors) — all still pending per FRAMEWORK-STATE. This proposal's F-017 depends on F-001-expansion machinery; F-018 depends on F-005.

## Honest summary (for the user)

Your visual intuition was correct. iter1 does not look meaningfully different from the pre-WI-088 original at cold glance. The benchmark said 7.50 because the rubric measured "motion count matches sector median" and "no mobile regression" — both true. But the rubric did not measure "is the liveness perceptible in 3 seconds" or "is this visibly different from what it replaced." Those are the two gaps that allowed a visually-mediocre-but-not-wrong result to PASS a framework designed to catch mediocrity.

Short answer to your framed options:
- **(a) iter1 is fine, your intuition is cache-leftover:** No, evidence says the intuition is correct.
- **(b) There's a concrete gap in rubric + sample bank:** Yes, both. F-013 and F-015 are the rubric gaps. F-014 and F-017 are the sample-bank gaps. F-012 is the integrity gap (heaviest-weighted dimension scored without evidence).

The path to a visually-dynamic iter2 probably requires: (1) a real bookable-affordance-style liveness signal (timed slot tiles, not a counter), (2) a motion cycle under 4 seconds, (3) visual delta from the predecessor that's obvious in 3 seconds. F-013/F-015/F-016 would have forced those requirements into iter1's plan instead of leaving them as after-the-fact diagnostic findings.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists at proposals/<date>-evolution-*.md | PASS |
| 2 | Every finding cites file:line or a captured artifact | PASS (benchmark-landing/SKILL.md:42/47/143, bank README:11-32, iter1 yaml line refs, LiveStorefrontHero.jsx:35) |
| 3 | FRAMEWORK-STATE.md was read before starting | PASS (2026-04-20 benchmark-landing + landing-bank entries) |
| 4 | Findings ranked by impact (P0-P3) | PASS |
| 5 | Screenshots captured (user explicitly required) | PASS — iter1-current-1600x900.png + iter0-original-1600x900.png |
| 6 | Honest answer delivered, not defensive score-math | PASS — finding confirms user's intuition, names two framework gaps |

## Next step

User to decide:
- Route to `improve-framework` with this proposal → lands F-012, F-013, F-015 as P0 skill + bank edits
- OR queue an iter2 on WI-088 that uses F-013/F-015 preconditions as gating (tests the proposed rubric before committing to it framework-wide)
