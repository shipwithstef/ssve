---
name: design-logo
version: "1.0"
phases:
  - { id: P1-BrandBriefExemplarMoodboard, required_for_completion: true }
  - { id: P2-ConceptLedgerAndQuotaGeneration, required_for_completion: true }
  - { id: P3-RenderRubricJudgeSimulation, required_for_completion: true }
  - { id: P4-RefinementConstraintEscalation, required_for_completion: true }
  - { id: P5-SystemContextLiveEvidence, required_for_completion: true }
  - { id: P6-FinalPackSelfVerify, required_for_completion: true }
description: >
  Design or redesign a logo, wordmark or favicon as a scalable SVG pack with iterative
  refinement and in-app-context checks. Use for "design a logo", "make a logo", "redesign
  the logo", "logo is bad", "favicon", "wordmark".
inputs:
  required:
    - { path: "references/exemplar-bank-2026.md", artifact: exemplar-bank, note: "curated mark reference set with transferable principles + anti-copy notes — read at Phase 1 and Phase 5/6" }
  optional:
    - { path: "docs/specs/brand-brief.yaml", artifact: brand-brief, note: "reused when present; Phase 0 drafts it otherwise" }
    - { path: "docs/specs/vision.md", artifact: vision, note: "name, audience and promise for the drafted brief" }
    - { path: "references/landing-bank/<sector>/", artifact: reference-sample-bank }
    - { path: "references/exemplar-bank-images/originals/*", artifact: exemplar-bank-images, note: "optional PNG/SVG logo files for visual benchmarking when the image bank has been refreshed" }
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
outputs:
  produces:
    - { path: "docs/specs/brand-brief.yaml", artifact: brand-brief, note: "name, audience, voice, palette, anti-references, cross-domain inspiration sources, exemplar_inspiration (≥3 ids from exemplar bank)" }
    - { path: "docs/specs/logo-pack/concepts/", artifact: concept-set, note: "≥20 SVG concepts spanning 7 types + 4 structural primitive classes" }
    - { path: "docs/specs/logo-pack/moodboard/", artifact: cross-domain-moodboard, note: "image-gen outputs from non-sector domains" }
    - { path: "docs/specs/logo-pack/judging/", artifact: judging-records, note: "self-score, cross-model-score, persona-simulation reads, disagreements" }
    - { path: "docs/specs/logo-pack/iterations/", artifact: refinement-loop, note: "≥3 refinement passes on top picks with delta scoring" }
    - { path: "docs/specs/logo-pack/system/", artifact: brand-system, note: "animation, brand patterns, icon style derived from mark" }
    - { path: "docs/specs/logo-pack/contexts/", artifact: app-context-mockups, note: "mark in real app contexts (nav, favicon tab, OG card, app switcher)" }
    - { path: "docs/specs/design-logo/in-app-verification/", artifact: live-page-screenshots, note: "Terminal evidence: live screenshots of the deployed landing/home page in both light and dark theme, with the new logo wired in. The skill is not done without these." }
    - { path: "docs/specs/logo-pack/final/", artifact: final-pack }
    - { path: "docs/specs/logo-pack/audit.md", artifact: polish-audit }
    - { path: "docs/specs/logo-pack/concept-ledger.md", artifact: concept-ledger, note: "Round-by-round mode tracker (exploration | refinement | polish | terminal). New concepts after round 2 = skill failure." }
    - { path: "docs/specs/logo-pack/judging/love-test-<round>.md", artifact: love-test-records, note: "5-question love-test answers per top-3 concept per round" }
chain:
  lanes:
    greenfield: { position: 12, prev: design-ui, next: landing-page }
    brownfield-feature: { position: 8, prev: design-ui, next: landing-page }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** 🧠 [STRAT] for concept selection, ⚙️ [EXEC] for SVG hand-coding, 🎨 [SENSE] for evaluation, 🔁 codex CLI as cross-model judge. Diffusion image-gen is for moodboard inspiration only; final marks are hand-built SVG by construction, because raster generations cannot be kerned, optically corrected or scaled cleanly.

# Design Logo (v3 — iterative + cross-domain + cross-judge)

A 10/10 logo is rare. Tier-2 generic is the default outcome of any one-shot AI process, because the model falls back on pattern memory for the sector. This skill structures the work to break out of those grooves: outside inspiration, an independent judge, real iteration, and constraint escalation in place of the old handoff exit.

**Announce at start:** "I'm using design-logo v3 — 20+ concepts, cross-domain inspiration, cross-model judging, iteration loop, system extension. Hard rubric threshold 65/70."

## Phase Receipt Contract

When a task graph exists, record these receipts before completing the
`design-logo` task:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-BrandBriefExemplarMoodboard --evidence command_output:.svc/design-logo-brief-moodboard.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ConceptLedgerAndQuotaGeneration --evidence file:docs/specs/logo-pack/concept-ledger.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RenderRubricJudgeSimulation --evidence command_output:.svc/design-logo-judging.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-RefinementConstraintEscalation --evidence command_output:.svc/design-logo-refinement.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-SystemContextLiveEvidence --evidence file:docs/specs/design-logo/in-app-verification/landing-light.png
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-FinalPackSelfVerify --evidence file:docs/specs/logo-pack/audit.md
```

## The 7 honest constraints

Each one closes a known route back to generic output.

1. **Cross-domain inspiration is required** — sector references alone produce sector-shaped output. Pick 3+ sources outside the product's category (architecture, nature, science, art history, industrial design, abstract geometry, motion physics).
   - Also consult `references/exemplar-bank-2026.md` and pick ≥3 entries whose *transferable principle* maps to the brief; record them in `brand-brief.yaml` under `exemplar_inspiration:`. The bank is the world-class benchmark — without it the rubric self-grades against sector mediocrity.
2. **Structural-primitive diversity quota** — concepts span ≥30% path-based (Bezier curves, custom geometry), ≥20% no-container (mark-only without rounded square), ≥15% negative-space (FedEx-arrow / Stripe-S register), ≥15% custom letterform.
3. **Cross-model judging is required** — codex CLI ranks the concept set blind. Investigate disagreements with the self-score; they are evidence.
4. **Persona simulation is required** — for top picks, simulate the target persona's first-impression read. "Looks like a software icon" is a fail.
5. **Iteration loop, not one-shot** — top 3 concepts get ≥3 refinement passes (kerning / optical / weight / curve / asymmetry).
6. **System extension is required** — the winner ships with animation reveal, brand pattern set (5+), icon-style sheet and color-token export. A logo without a system is half a deliverable.
7. **Honest saturation ceiling** — if the rubric score plateaus below 65/70 across 3 iterations, escalate constraints (Phase 8b) and re-run the 5-stage refinement pipeline. Real 10/10 marks come from constraint-stacking, not external substitution.

## Process

### Phase 0 — Brand brief gate
Read `docs/specs/brand-brief.yaml`. If it is missing, draft it from `docs/specs/vision.md`, `docs/specs/marketing-context.md` and the personas (name, audience, voice, palette direction, anti-references) and propose 3+ non-sector `cross_domain_sources`. Ask the owner only about what those sources cannot answer, in one message, and record their answers in the brief. Phase 1 needs `cross_domain_sources` (3+ non-sector domains).

### Phase 1 — Exemplar bank consult + cross-domain moodboard (both mandatory)

**Phase 1a — Exemplar bank.** Read `references/exemplar-bank-2026.md` end-to-end. Pick ≥3 entries whose *transferable principle* (not visual) maps to the brief and write them into `brand-brief.yaml`:

```yaml
exemplar_inspiration:
  - id: <bank id, e.g. A2>
    principle: "<copy the entry's transferable principle verbatim>"
    why_relevant: "<one line — why this maps to THIS brief>"
```

If you cannot find 3 entries with genuine principle alignment, the brief is too vague — go back to Phase 0.

**Phase 1b — Cross-domain moodboard.** For each `cross_domain_source`, generate 3–5 inspiration images via codex CLI image-gen:

```bash
codex exec "Generate a moodboard image: <domain> meets <product attribute>. Abstract geometric, no text, no literal objects. Inspiration only — for shape language, not for the logo itself."
```

Save to `docs/specs/logo-pack/moodboard/<domain>/<n>.png`. These images are inspiration only, never a final asset. Study the moodboard before generating concepts; concepts that show no shape language from it get regenerated. Skipping this phase regresses the output to sector-pattern-matching, the failure mode v3 exists to fix.

### Phase 1c — Concept commitment ledger

After Phase 1, write `docs/specs/logo-pack/concept-ledger.md`:

```yaml
round: 1
mode: exploration  # exploration | refinement | polish | terminal
concepts_introduced: 8
concepts_advanced: 3
new_concepts_allowed_next_round: 0  # AFTER round 2, no new concepts
```

After round 2 the mode flips to `refinement` and no new concepts may enter; rounds 3–5 are 4-variation deep-dives on survivors. Round 6+ flips to `polish` (sand-grain refinement on the single chosen mark). New concepts in refinement or polish mode count as skill failure, because late exploration resets the depth the iteration loop is building.

### Phase 2 — Reference + adversarial capture (Playwright)

As v2: capture 8 sector references and render 6 anti-patterns.

### Phase 3 — Generate ≥20 concepts with structural quota

| Quota | Min count | What |
|---|---|---|
| Path-based (Bezier / custom geometry) | 6 | Real paths, not rect/circle/line primitives. |
| No-container (mark only, no rounded square) | 4 | Mark stands alone. |
| Negative-space (FedEx / Stripe register) | 3 | The cutout / hidden shape carries meaning. |
| Custom letterform | 3 | Wordmark glyphs are drawn, not Inter defaults. |
| Free / wildcard | 4 | Anything. |
| **Total** | **≥20** | spans all 7 logo types |

An unfilled quota cell fails the phase — generate more.

### Phase 4 — Render ladder + WCAG + kerning gates

As v2: 16/32/64/256/512 px renders, contrast ≥ 4.5/3, kerning audit. Concepts that fail at 16 px are killed.

### Phase 5 — Self-score (7-axis rubric, /70) + exemplar 2-up benchmark

Score each top concept on the 7 axes (same as v2). Then place each top-3 concept in a 2-up next to its claimed exemplar from `references/exemplar-bank-2026.md` (the principle alignment recorded in the brief) and save to `docs/specs/logo-pack/judging/exemplar-2up/<concept-id>-vs-<exemplar-id>.png`.

If the exemplar visibly outclasses the concept on the same principle, cap the concept at 60/70 whatever the rubric says. The bank is the world-class floor; rubric numbers do not override an eyeball comparison against a real top-tier mark.

### Phase 5b — Love-test gate (the 5 questions that actually matter)

After self-score and exemplar 2-up, before the cross-model judge, run on the top 3:

1. **Tattoo test:** "Would the founder tattoo this on their forearm?" No means competent, not lovable — flag for deeper iteration.
2. **$5k test:** "If a top-tier studio handed this to the founder for $5k, would they accept it as the deliverable?" No — flag.
3. **Reverse-jealousy test:** "If a competitor shipped this tomorrow, would the founder be impressed or shrug?" Shrug — flag.
4. **5-year test:** "Will this look intentional or dated in 2031?" Dated disqualifies outright (catches gradients, AI-render-of-the-month, palette-of-the-year).
5. **Stranger test:** show it to one person outside the project for 2 seconds and ask "what does this company do?" Wrong or unknown is a semantic-fit fail.

Failures here lead to constraint-tightening (Phase 8b), not handoff.

### Phase 6 — Cross-model judge (codex CLI, mandatory)

Send the concept grid PNG + the brand brief to codex CLI:

```bash
codex exec "You are a senior brand designer. Rank these 20 logo concepts for <product> serving <audience>. Score each /70 on: silhouette legibility, distinctiveness vs sector, distance from anti-patterns, semantic fit, type quality, color discipline, scalability. Return JSON: [{id, score, top_3_strengths, top_3_weaknesses}]."
```

Compare codex's ranking to yours. Where top picks differ:
- Codex scores a concept you underrated → find out why, then correct your rubric weight or kill your biased pick.
- You score a concept codex dislikes → simulate the persona read on it; if the persona also dislikes it, kill it.
- Treat disagreements as evidence. Suppressing them is a self-grading regression.

Final ranking = MIN(my_score, codex_score) per concept, so neither model can promote its own bias.

### Phase 7 — Persona simulation (mandatory for top 5)

For each top-5 concept, simulate the target ICP's first-impression read at 256 px. For Example Marketplace: small-business owner, age 35–55, runs 1–3 cafés. Ask plain-English questions:

1. "What does this brand do?" — "I don't know" or "software" fails.
2. "Would you trust this with your payroll?" — must be yes.
3. "Does it remind you of any brand you already use?" — if yes, name it; that's an inspiration tax.
4. "If you saw this on a competitor's storefront window, would it stand out?" — must be yes.

A concept that fails any question is demoted regardless of rubric score. **The rubric is a sieve; the persona read is the floor.**

### Phase 7b — Lockup-stutter test (mandatory for monogram-class marks)

If the chosen mark is a single letter that is also the brand name's first letter, render mark + wordmark side-by-side at a 4:1 horizontal lockup. If the letter visually duplicates the wordmark's first character (Pinterest P + "Pinterest", Example Marketplace H + "Example Marketplace"), the mark is disqualified for production lockup use regardless of rubric score; loop back to Phase 3 for non-letterform alternatives.

### Phase 8 — Multi-tool refinement pipeline (mandatory)

A 5-stage toolchain that mirrors how senior designers work, run on each top-3 concept:

**Stage A — Geometry refinement (hand-edit SVG)** — vectorize the image-gen sketch (potrace → manual cleanup); optical correction of weights, balance, asymmetric tension; Bezier smoothing (no kinks, no over-anchored points); save the vector pre-polish.

**Stage B — Style transfer iteration (image-gen img-to-img)** — send the Stage-A vector back with 3 style prompts: "Same composition, executed in [Pentagram, Collins, Sagmeister] style"; "Same composition, with one ASYMMETRIC tension element added"; "Same composition, find and embed a HIDDEN second meaning". Pick the best of 3 by eyeball + score.

**Stage C — Vector trace + kerning + curve audit** — re-trace the Stage-B winner to clean SVG; per-pair kerning (Tr, AV, LT, Wo, rs); second Bezier smoothing pass; optical compensation at 16, 32 and 64 px.

**Stage D — Motion + context test** — animate a ~600ms draw-on reveal (does the geometry flow?); render in 5 contexts (nav header, favicon, app icon, OG card, storefront mockup); it must pass the Phase 5b love-test in every context.

**Stage E — Sand-grain polish** — sub-pixel adjustments (anchor cleanup, stroke endpoints, micro-radii); color value tuning (hex ±2 for optical balance); final 2-up against the named exemplar from Phase 5. If the exemplar still outclasses it, re-enter Stage A with a constraint added.

Each stage has to improve the combined score by ≥2 points; otherwise the stage failed and is retried with a new constraint.

### Phase 8b — Constraint-escalation when plateau hits

When a refinement round produces no improvement (combined-score delta ≤1), add a constraint:

| Plateau # | Added constraint |
|---|---|
| 1 | One-color only (force geometric primacy) |
| 2 | Must work in negative space (force structural cleverness) |
| 3 | Must contain a HIDDEN second meaning (FedEx arrow class) |
| 4 | Must be drawable in ≤5 path operations (force radical reduction) |
| 5 | Must embed a brand-vocabulary glyph (e.g. for Example Marketplace: a clock-mark, time-mark, or hours-glyph) |

Each constraint forces the search out of safe territory, turning "the AI hit its ceiling" into "we haven't constrained the search hard enough."

### Phase 9 — Saturation gate WITHOUT handoff exit

| Combined score | Action |
|---|---|
| ≥ 65/70 | Promote. Run the Phase 5b love-test once more. 5/5 pass → terminal Phase 13. <5/5 → Phase 8 Stage A with a new constraint. |
| 60–64 | Phase 8 full pipeline rerun + Phase 8b plateau escalation |
| 56–59 | Phase 8b with all constraints stacked simultaneously + cross-model re-score (Phase 6) |
| < 56 | The brief itself is broken — re-enter Phase 0 with constraint forensics ("which axis are concepts failing on?") |

There is no handoff exit. The skill terminates only at ≥65/70 with a 5/5 love-test pass. If you stay plateaued for 3+ rounds despite constraint escalation, log a framework-gap entry naming the specific failure mode instead of passing the problem to a person.

## Why the skill cannot stop below 65/70

The skill is responsible for reaching designer-grade output through AI orchestration alone. A plateau is a search-space problem, not a craft ceiling, and every plateau has a constraint that breaks it. Find the constraint or log the framework gap. There is no external escape hatch.

### Phase 10 — System extension (mandatory for delivered marks)

The chosen mark ships with:

| Asset | What |
|---|---|
| `final/animation.svg` | SMIL or CSS keyframe animation: mark draws on, accent stroke pulses, etc. ~600ms reveal |
| `final/spinner.svg` | Mark adapts as a loading state — accent rotates, mark stays |
| `final/patterns/{1..5}.svg` | Brand patterns derived from mark — repeating tile, gradient, abstract field |
| `final/icon-style/{home,calendar,bell,settings,user}.svg` | 5 product icons drawn in the mark's geometric language (corner radius, stroke weight, accent rule) |
| `final/color-tokens.json` | Color tokens — primary/accent/neutral/semantic — exportable to design system |

This phase is non-skippable: a mark without a system is half a deliverable.

### Phase 11 — App-context mockups (mandatory)

Render the mark in real-world contexts with sharp + screenshot composites:

| Context | What's shown |
|---|---|
| `contexts/nav-header.png` | Mark + wordmark in a 1280×80 nav bar with 4 menu items |
| `contexts/favicon-tab.png` | Browser tab strip with the mark + page title |
| `contexts/og-card.png` | 1200×630 social-share card with mark + tagline |
| `contexts/app-switcher.png` | iOS app-switcher card with mark as app icon |
| `contexts/storefront.png` | The mark on a fictional café storefront window decal |

Show the user the contexts and ask: "Does this stand out vs blend in?"

### Phase 12 — Final variant matrix

The same 7 variants as v2 (horizontal/vertical/mark/wordmark/favicon/dark-mode/monochrome), generated from the **iterated** winner rather than the raw concept.

### Phase 13 — Live in-app verification (terminal gate)

The skill is done only when the logo is verified in the deployed product, in both themes. Self-graded rubrics, isolated previews and adversarial composites all miss palette, context and theme issues that only appear in the running app.

After deploy lands:

1. **Capture both themes via Playwright:**
   ```js
   for (const theme of ['light','dark']) {
     const ctx = await browser.newContext({ colorScheme: theme });
     const page = await ctx.newPage();
     await page.addInitScript((t) => localStorage.setItem('<theme-key>', t), theme);
     await page.goto('https://<prod-url>/', { waitUntil: 'networkidle' });
     await page.waitForTimeout(2500);
     await page.screenshot({ path: `docs/specs/design-logo/in-app-verification/landing-${theme}.png`, clip: { x:0, y:0, width:1440, height:900 } });
   }
   ```
   Save both to `docs/specs/design-logo/in-app-verification/`.

2. **Eyeball check** on the actual screenshots: the top-left logo + wordmark renders cleanly in both themes (no orphan text, broken kerning, debug strings or color mismatch); the silhouette holds against the page background; the wordmark accent is visible on the nav background; no raster fallback, broken `<img>` placeholder or cache-bust artifact.

3. **Hard fails** — loop back instead of declaring done:
   - Raw text from JSX leaking onto the page (orphan attribute bug — observed live 2026-04-30 with `fetchPriority="high"` rendering as text after a logo-swap mass edit)
   - Logo invisible against background (slate-on-slate, iris-on-iris)
   - Wordmark wrong color for theme (iris on dark hero failing WCAG)
   - Cached old logo serving (Cloudflare TTL — bust with `?v=N`)

4. **Compare to live anchors** (sector references): does the logo's brand register match the rest of the page's UI, or feel imported from another design system?

5. **Persist the screenshots** as the terminal artifact, in the audit and the manage-learnings entry. Future runs use them as the "before" baseline.

A hard-fail sends the skill back to Phase 8 (iteration) or Phase 4 (re-render), not to Phase 14. Success rated in isolation is not a valid termination state.

**Phase 13 amendment — Founder-eyeball as the saturation truth:**

After capturing the screenshots, ask the founder one question:

> "Looking at this on the live site with fresh eyes — does this impress you, or does it just look fine?"

"Fine", "okay", "I guess" or "sure" counts as a hard-fail: drop back to Phase 8 Stage A with constraint escalation. **A founder's shrug is decisive and is not overridden by rubric score.**

### Phase 14 — Declare done

Only after the Phase 13 screenshots pass the eyeball check. Emit a final summary with: score (self + cross-model + persona); both live screenshots inline; the path to the `final/` pack; the constraint-escalation history (which plateaus, which constraints broke them); learnings appended to the project + framework jsonl.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`

Before marking the active lane task complete in `.svc/lane-tasks-<WI>.json`:

1. Confirm the declared `live-page-screenshots` output contains fresh light and dark screenshots.
2. Attach the final logo pack path, audit path, and screenshot paths to the task evidence.
3. If the current lane is greenfield or brownfield-feature, route next to `landing-page` per the frontmatter chain.
4. If invoked as a standalone polishing task, return to `route-workflow` with the final pack and live evidence paths.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 0 | **Exemplar bank consulted** | `references/exemplar-bank-2026.md` read AND `brand-brief.yaml` `exemplar_inspiration:` has ≥3 entries with `id` + `principle` + `why_relevant` | |
| 0b | **Exemplar 2-up benchmark rendered** | `docs/specs/logo-pack/judging/exemplar-2up/<concept>-vs-<exemplar>.png` exists for each top-3 concept; cap-at-60 rule applied where exemplar wins eyeball check | |
| 1 | Cross-domain moodboard generated | ≥3 domains, ≥9 inspiration images | |
| 2 | Concept count ≥ 20, all 7 types covered | quota table filled | |
| 3 | Structural-primitive quotas met | ≥6 path-based, ≥4 no-container, ≥3 negative-space, ≥3 custom-letterform | |
| 4 | Render ladder passes for ≥ 5 concepts | 16 px favicon legibility verified | |
| 5 | WCAG contrast gates passed | ≥ 4.5 / ≥ 3 per pairing | |
| 6 | Self-score completed (7 axes / 70) | rubric file exists | |
| 7 | **Cross-model judge invoked (codex CLI)** | judging/codex-ranking.json present | |
| 8 | Disagreements between judges resolved | judging/disagreements.md present | |
| 9 | Persona simulation done for top 5 | persona-simulation.md present | |
| 10 | Iteration loop ≥ 3 passes per top 3 | iterations/<concept>/{pass-1,pass-2,pass-3}/ present | |
| 10b | **5-stage refinement pipeline completed** | Stage A→B→C→D→E documented with per-stage ≥2-point delta | |
| 10c | **Constraint-escalation ladder applied** | `concept-ledger.md` records plateau # + constraint that broke it | |
| 11 | Score saturation gate applied | top concept ≥ 65/70 AND 5/5 love-test pass | |
| 11b | **No forbidden phrases in output** | SKILL.md contains zero instances of "hire a designer", "designer handoff", "AI ceiling", "human designer", "external designer" | |
| 12 | System extension delivered | animation.svg + 5 patterns + 5 icons + color-tokens.json | |
| 13 | App-context mockups rendered | 5 context PNGs | |
| 14 | Anti-references avoided | each anti-ref checked off in audit.md | |
| 15 | Human checkpoint logged | user picked among delivered top 3 | |
| 15b | **Founder-shrug check passed** | Founder response to "does this impress you?" is not "fine / okay / I guess / sure" | |
| 15c | **Lockup-stutter test passed** | If monogram = wordmark first letter, non-letterform alternative chosen | |
| 16 | **Phase 13 in-app verification screenshots present** | `docs/specs/design-logo/in-app-verification/landing-light.png` + `landing-dark.png` exist, captured after deploy landed | |
| 17 | **No raw-text-leak / orphan JSX in either screenshot** | eyeball check passed; if any debug string visible, skill loops back | |
| 18 | **Logo silhouette holds in both themes** | no slate-on-slate or iris-on-iris invisibility | |

Fix any FAIL before declaring complete. Render-ladder failure, a missing cross-model judge, a missing iteration loop and a missing system extension are all blocking — v3 has no soft fails.

## Provenance

This skill rejects the v2 failure mode of "ship a competent generic at 56/70 and call it world-class". v3 either earns ≥ 65/70 through cross-domain inspiration + cross-model judging + 5-stage refinement + constraint escalation, or logs a framework gap naming the specific failure mode. The user gets a real outcome — production-grade or a documented gap — never a self-graded mid. There is no external escape hatch.
