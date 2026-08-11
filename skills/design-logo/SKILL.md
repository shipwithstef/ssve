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
  Produce a brand mark + lockup pack as scalable SVG with iterative refinement
  toward world-class quality (≥65/70 rubric, no designer-handoff exit). Use
  when creating, redesigning, or polishing a logo. Triggers on "design a
  logo", "make a logo", "redesign the logo", "logo is bad", "10/10 logo",
  "world-class logo", "favicon", "wordmark", or when downstream skills need
  a finalized identity. Outputs the full variant matrix + animation +
  brand-pattern set + icon-style sheet + app-context mockups. The skill
  terminates only at ≥65/70 with 5/5 love-test pass; plateaus trigger
  constraint escalation, never handoff.
inputs:
  required:
    - { path: "docs/specs/brand-brief.yaml", artifact: brand-brief, note: "name, audience, voice, palette, anti-references, cross-domain inspiration sources, exemplar_inspiration (≥3 ids from exemplar bank)" }
    - { path: "references/exemplar-bank-2026.md", artifact: exemplar-bank, note: "curated mark reference set with transferable principles + anti-copy notes — read at Phase 1 and Phase 5/6" }
  optional:
    - { path: "references/landing-bank/<sector>/", artifact: reference-sample-bank }
    - { path: "references/exemplar-bank-images/originals/*", artifact: exemplar-bank-images, note: "optional PNG/SVG logo files for visual benchmarking when the image bank has been refreshed" }
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
outputs:
  produces:
    - { path: "docs/specs/logo-pack/concepts/", artifact: concept-set, note: "≥20 SVG concepts spanning 7 types + 4 structural primitive classes" }
    - { path: "docs/specs/logo-pack/moodboard/", artifact: cross-domain-moodboard, note: "image-gen outputs from non-sector domains" }
    - { path: "docs/specs/logo-pack/judging/", artifact: judging-records, note: "self-score, cross-model-score, persona-simulation reads, disagreements" }
    - { path: "docs/specs/logo-pack/iterations/", artifact: refinement-loop, note: "≥3 refinement passes on top picks with delta scoring" }
    - { path: "docs/specs/logo-pack/system/", artifact: brand-system, note: "animation, brand patterns, icon style derived from mark" }
    - { path: "docs/specs/logo-pack/contexts/", artifact: app-context-mockups, note: "mark in real app contexts (nav, favicon tab, OG card, app switcher)" }
    - { path: "docs/specs/design-logo/in-app-verification/", artifact: live-page-screenshots, note: "MANDATORY: live screenshots of the deployed landing/home page in BOTH light AND dark theme, with the new logo wired in. The skill cannot declare DONE without these." }
    - { path: "docs/specs/logo-pack/final/", artifact: final-pack }
    - { path: "docs/specs/logo-pack/audit.md", artifact: polish-audit }
    - { path: "docs/specs/logo-pack/concept-ledger.md", artifact: concept-ledger, note: "Round-by-round mode tracker (exploration | refinement | polish | terminal). New concepts after round 2 = skill failure." }
    - { path: "docs/specs/logo-pack/judging/love-test-<round>.md", artifact: love-test-records, note: "5-question love-test answers per top-3 concept per round" }
chain:
  lanes:
    greenfield: { position: 12, prev: design-ui, next: landing-page }
    brownfield-feature: { position: 7, prev: design-ui, next: landing-page }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** 🧠 [STRAT] for concept selection, ⚙️ [EXEC] for SVG hand-coding, 🎨 [SENSE] for evaluation, 🔁 codex CLI as cross-model judge. Diffusion image-gen used ONLY for moodboard inspiration, NEVER for final marks. Final marks are SVG by construction.

# Design Logo (v3 — iterative + cross-domain + cross-judge)

A 10/10 logo is rare. Tier-2 generic is the default outcome of any one-shot AI process. This skill structures the work to break out of pattern-memory grooves and pushes toward a higher ceiling — constraint escalation and multi-tool refinement replace the old handoff exit.

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

1. **Cross-domain inspiration is mandatory** — sector references alone produce sector-shaped output. Architecture, nature, science, art history, industrial design, abstract geometry, motion physics — pick 3+ outside the product's category.
   - **AND** consult `references/exemplar-bank-2026.md` — pick ≥3 entries whose *transferable principle* maps to the brief. Record in `brand-brief.yaml` under `exemplar_inspiration:`. The bank is the world-class benchmark; without it, the rubric self-grades against sector mediocrity.
2. **Structural-primitive diversity quota** — concepts MUST span: ≥30% path-based (Bezier curves, custom geometry), ≥20% no-container (mark-only without rounded square), ≥15% negative-space (FedEx-arrow / Stripe-S register), ≥15% custom letterform.
3. **Cross-model judging is mandatory** — codex CLI ranks the concept set blind. Disagreements with self-score are investigated, not suppressed.
4. **Persona simulation is mandatory** — for top picks, simulate the target persona's first-impression read. If it lands as "looks like a software icon" it fails.
5. **Iteration loop, not one-shot** — top 3 concepts get ≥3 refinement passes (kerning / optical / weight / curve / asymmetry).
6. **System extension is mandatory** — winner ships with animation reveal, brand pattern set (5+), icon-style sheet, color-token export. A logo without a system is half a deliverable.
7. **Honest saturation ceiling** — if rubric score plateaus below 65/70 across 3 iterations, the skill escalates constraints (Phase 8b) and re-runs the 5-stage refinement pipeline. Real 10/10 marks require constraint-stacking, not external substitution.

## Process

### Phase 0 — Brand brief gate
Read `docs/specs/brand-brief.yaml`. Required: `cross_domain_sources` (3+ non-sector domains). If missing, refuse and ask user to enrich the brief.

### Phase 1 — Exemplar bank consult + cross-domain moodboard (both mandatory)

**Phase 1a — Exemplar bank.** Read `references/exemplar-bank-2026.md` end-to-end. Pick ≥3 entries whose *transferable principle* (not visual) maps to the brief. Write into `brand-brief.yaml`:

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

Save to `docs/specs/logo-pack/moodboard/<domain>/<n>.png`. Output is **inspiration only** — never final asset. Read the moodboard before generating any concept; if your concepts don't reference shape language from the moodboard, regenerate.

Hard rule: if you skip this phase, the output regresses to sector-pattern-matching, which is the failure mode v3 exists to fix.

### Phase 1c — Concept commitment ledger

After Phase 1, write `docs/specs/logo-pack/concept-ledger.md`:

```yaml
round: 1
mode: exploration  # exploration | refinement | polish | terminal
concepts_introduced: 8
concepts_advanced: 3
new_concepts_allowed_next_round: 0  # AFTER round 2, no new concepts
```

**Hard rule:** after round 2 the mode flips to `refinement`. No new concepts may be introduced. Rounds 3–5 are 4-variation deep-dives on survivors. Round 6+ flips to `polish` mode (sand-grain refinement on the single chosen mark). New concepts in refinement/polish mode = skill failure.

### Phase 2 — Reference + adversarial capture (Playwright)

As v2: capture 8 sector references and render 6 anti-patterns. Same as before.

### Phase 3 — Generate ≥20 concepts with structural quota

| Quota | Min count | What |
|---|---|---|
| Path-based (Bezier / custom geometry) | 6 | NOT rect/circle/line primitives. Real paths. |
| No-container (mark only, no rounded square) | 4 | Mark stands alone. |
| Negative-space (FedEx / Stripe register) | 3 | The cutout / hidden shape carries meaning. |
| Custom letterform | 3 | Wordmark glyphs are drawn, not Inter defaults. |
| Free / wildcard | 4 | Anything. |
| **Total** | **≥20** | spans all 7 logo types |

If a quota cell is unfilled, the phase fails — generate more.

### Phase 4 — Render ladder + WCAG + kerning gates

Same as v2: 16/32/64/256/512 px renders, contrast ≥ 4.5/3, kerning audit. Concepts that fail 16 px are killed.

### Phase 5 — Self-score (7-axis rubric, /70) + exemplar 2-up benchmark

Score each top concept on the 7 axes (same axes as v2). THEN, for each top-3 concept, place it in a 2-up next to ITS claimed exemplar from `references/exemplar-bank-2026.md` (same principle alignment recorded in the brief). Save to `docs/specs/logo-pack/judging/exemplar-2up/<concept-id>-vs-<exemplar-id>.png`.

**Hard rule:** if the exemplar visibly outclasses the concept on the same principle, the concept's score is capped at 60/70 — no matter what the rubric says. The bank is the world-class floor; rubric numbers cannot override eyeball comparison against a real top-tier mark.

### Phase 5b — Love-test gate (the 5 questions that actually matter)

After self-score and exemplar-2up, before cross-model judge, run on top 3:

1. **Tattoo test:** "Would the founder tattoo this on their forearm?" If no — concept is competent, not lovable. Flag for deeper iteration.
2. **$5k test:** "If a top-tier studio handed this to the founder for $5k, would they accept it as the deliverable?" If no — flag.
3. **Reverse-jealousy test:** "If a competitor shipped this tomorrow, would the founder be impressed or shrug?" Shrug = flag.
4. **5-year test:** "Will this look intentional or dated in 2031?" Dated = disqualified outright (catches gradients, AI-render-of-the-month, palette-of-the-year).
5. **Stranger test:** "Show this to one person OUTSIDE the project for 2 seconds. Ask 'what does this company do?' If wrong/unknown → semantic fit fail.

Failures here do NOT trigger handoff — they trigger **constraint-tightening Phase 8** (see Phase 8b).

### Phase 6 — Cross-model judge (codex CLI, mandatory)

Send the concept grid PNG + the brand brief to codex CLI:

```bash
codex exec "You are a senior brand designer. Rank these 20 logo concepts for <product> serving <audience>. Score each /70 on: silhouette legibility, distinctiveness vs sector, distance from anti-patterns, semantic fit, type quality, color discipline, scalability. Return JSON: [{id, score, top_3_strengths, top_3_weaknesses}]."
```

**Compare codex's ranking to mine.** If top picks differ:
- If codex has a higher-scored concept I underrated → investigate WHY → correct my rubric weight or kill my biased pick
- If I have a higher-scored concept codex hates → simulate persona read on that concept → if persona also dislikes, kill it
- Disagreements ARE evidence, not noise. Suppressing them = self-grading regression.

Final ranking = MIN(my_score, codex_score) per concept (prevents either model from auto-promoting its own bias).

### Phase 7 — Persona simulation (mandatory for top 5)

For each top-5 concept, simulate the target ICP's first-impression read. For Example Marketplace: small-business owner, age 35–55, runs 1–3 cafés. Show concept at 256 px. Ask plain-English questions:

1. "What does this brand do?" — if answer is "I don't know" or "software" → fail
2. "Would you trust this with your payroll?" — must be yes
3. "Does it remind you of any brand you already use?" — if YES, name it; that's an inspiration tax
4. "If you saw this on a competitor's storefront window, would it stand out?" — must be yes

Concepts that fail any question are demoted regardless of rubric score. **The rubric is a sieve; the persona read is the floor.**

### Phase 7b — Lockup-stutter test (mandatory for monogram-class marks)

If the chosen mark is a single letter AND that letter is the first letter of the brand name, render mark + wordmark side-by-side at 4:1 horizontal lockup. If the letter visually duplicates against the wordmark's first character (Pinterest P + "Pinterest", Example Marketplace H + "Example Marketplace"), the mark is **disqualified for production lockup use** regardless of rubric score. The skill loops back to Phase 3 and generates non-letterform alternatives.

### Phase 8 — Multi-tool refinement pipeline (mandatory)

Replace the old 3-pass loop with a 5-stage toolchain pipeline that mimics how senior designers actually work. Run on each top-3 concept.

**Stage A — Geometry refinement (hand-edit SVG)**
  - Vectorize the image-gen sketch (potrace → manual cleanup)
  - Optical correction: weights, balance, asymmetric tension
  - Bezier curve smoothing (no kinks, no over-anchored points)
  - Save vector pre-polish

**Stage B — Style transfer iteration (image-gen img-to-img)**
  - Send Stage-A vector + 3 different style prompts back to image-gen
  - "Same composition, executed in [Pentagram, Collins, Sagmeister] style"
  - "Same composition, with one ASYMMETRIC tension element added"
  - "Same composition, find and embed a HIDDEN second meaning"
  - Pick best of 3 by eyeball + score

**Stage C — Vector trace + kerning + curve audit**
  - Re-trace Stage-B winner to clean SVG
  - Per-pair kerning (Tr, AV, LT, Wo, rs)
  - Bezier smoothing pass 2
  - Optical compensation at 16px, 32px, 64px

**Stage D — Motion + context test**
  - Animate mark draw-on (~600ms reveal) — does the geometry FLOW?
  - Render in 5 contexts (nav header, favicon, app icon, OG card, storefront mockup)
  - Eyeball on each — passes Phase 5b love-test in EVERY context?

**Stage E — Sand-grain polish**
  - Sub-pixel adjustments (anchor point cleanup, stroke endpoints, micro-radii)
  - Color value tuning (hex codes vary by ±2 for optical balance)
  - Final 2-up against the named exemplar from Phase 5
  - If exemplar still outclasses → re-enter Stage A with constraint added

Each stage MUST improve combined score by ≥2 points or the stage is failed and retried with new constraint.

### Phase 8b — Constraint-escalation when plateau hits

When a refinement round produces zero score improvement (combined-score delta ≤1), escalate constraints:

| Plateau # | Added constraint |
|---|---|
| 1 | One-color only (force geometric primacy) |
| 2 | Must work in negative space (force structural cleverness) |
| 3 | Must contain a HIDDEN second meaning (FedEx arrow class) |
| 4 | Must be drawable in ≤5 path operations (force radical reduction) |
| 5 | Must embed a brand-vocabulary glyph (e.g. for Example Marketplace: a clock-mark, time-mark, or hours-glyph) |

Each constraint forces the agent out of safe territory. Plateaus stop being "the AI hit its ceiling" — they become "we haven't constrained the search hard enough."

### Phase 9 — Saturation gate WITHOUT handoff exit

| Combined score | Action |
|---|---|
| ≥ 65/70 | Promote. Run Phase 5b love-test once more. If 5/5 pass → terminal Phase 13. If <5/5 → Phase 8 Stage A with new constraint. |
| 60–64 | Phase 8 full pipeline rerun + Phase 8b plateau escalation |
| 56–59 | Phase 8b ALL constraints stacked simultaneously + cross-model judge re-score (Phase 6) |
| < 56 | Brief itself is broken — re-enter Phase 0 with constraint forensics ("which axis are concepts failing on?") |

**No handoff exit. Ever.** The skill terminates only at ≥65/70 with 5/5 love-test pass.

If the agent finds itself plateaued for 3+ rounds despite constraint escalation, it MUST log a framework-gap entry naming the specific failure mode — not punt to a human.

## Why the skill cannot stop below 65/70

The skill is responsible for reaching designer-grade output via AI orchestration alone. Plateau is a search-space problem, not a craft-ceiling problem. Every plateau has a constraint that breaks it. Find the constraint or log the framework gap.

There is no external escape hatch.

### Phase 10 — System extension (mandatory for delivered marks)

The chosen mark ships with:

| Asset | What |
|---|---|
| `final/animation.svg` | SMIL or CSS keyframe animation: mark draws on, accent stroke pulses, etc. ~600ms reveal |
| `final/spinner.svg` | Mark adapts as a loading state — accent rotates, mark stays |
| `final/patterns/{1..5}.svg` | Brand patterns derived from mark — repeating tile, gradient, abstract field |
| `final/icon-style/{home,calendar,bell,settings,user}.svg` | 5 product icons drawn in the mark's geometric language (corner radius, stroke weight, accent rule) |
| `final/color-tokens.json` | Color tokens — primary/accent/neutral/semantic — exportable to design system |

A mark without a system is half a deliverable. This phase is **non-skippable**.

### Phase 11 — App-context mockups (mandatory)

Render the mark in real-world contexts using sharp + screenshot composites:

| Context | What's shown |
|---|---|
| `contexts/nav-header.png` | Mark + wordmark in a 1280×80 nav bar with 4 menu items |
| `contexts/favicon-tab.png` | Browser tab strip with the mark + page title |
| `contexts/og-card.png` | 1200×630 social-share card with mark + tagline |
| `contexts/app-switcher.png` | iOS app-switcher card with mark as app icon |
| `contexts/storefront.png` | The mark on a fictional café storefront window decal |

Show the user the contexts. Ask: "Does this stand out vs blend in?"

### Phase 12 — Final variant matrix

Same 7 variants as v2 (horizontal/vertical/mark/wordmark/favicon/dark-mode/monochrome) but now generated from the **iterated** winner, not the raw concept.

### Phase 13 — Live in-app verification (MANDATORY terminal gate)

The skill **cannot declare done** until the logo is verified in the actual deployed product, in both themes. Self-graded rubrics, isolated mark previews, and adversarial composites all miss palette / context / theme issues that only show up in the running app.

Steps (after deploy lands):

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

2. **Eyeball check** (with the actual screenshots):
   - Top-left logo + wordmark renders cleanly in BOTH themes — no orphan text, no broken kerning, no debug strings, no color mismatch
   - The logo's silhouette holds against whatever the page background is (light → light contexts, dark → dark contexts)
   - The wordmark's accent color is visible on whatever the page nav bg is
   - No raster fallback, no broken `<img>` placeholder, no visible cache-bust artifact

3. **Hard fails (skill MUST loop back, NOT declare done):**
   - Raw text from JSX leaking onto the page (orphan attribute bug — observed live 2026-04-30 with `fetchPriority="high"` rendering as text after a logo-swap mass edit)
   - Logo invisible against background (slate-on-slate, iris-on-iris)
   - Wordmark wrong color for theme (iris on dark hero failing WCAG)
   - Cached old logo serving (Cloudflare TTL — bust with `?v=N`)

4. **Compare to live anchors** (sector references): does the logo's brand register MATCH the rest of the page's UI, or feel imported from a different design system?

5. **Persist the screenshots** as the terminal artifact. They go in the audit and the manage-learnings entry. Future runs of design-logo on this project use them as the "before" baseline for the next iteration.

**Hard rule:** if Phase 13 screenshots reveal any hard-fail, the skill loops back to Phase 8 (iteration) or Phase 4 (re-render) — NOT Phase 14 (declare done). Self-rated success in isolation is no longer a valid termination state.

**Phase 13 amendment — Founder-eyeball as the saturation truth:**

After capturing in-app verification screenshots, the skill asks the founder ONE question:

> "Looking at this on the live site with fresh eyes — does this impress you, or does it just look fine?"

A "fine" / "okay" / "I guess" / "sure" answer is the same as a hard-fail. The skill drops back to Phase 8 Stage A with constraint escalation. **A shrug from the founder is decisive — it cannot be overridden by rubric score.**

### Phase 14 — Declare done

Only after Phase 13 screenshots pass eyeball check. Emit final summary with:
- Score (self + cross-model + persona)
- Both live screenshots inline
- Path to `final/` pack
- Constraint-escalation history (which plateaus, which constraints broke them)
- Learnings appended to project + framework jsonl

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
| 15b | **Founder-shrug check passed** | Founder response to "does this impress you?" is NOT "fine / okay / I guess / sure" | |
| 15c | **Lockup-stutter test passed** | If monogram = wordmark first letter, non-letterform alternative chosen | |
| 16 | **Phase 13 in-app verification screenshots present** | `docs/specs/design-logo/in-app-verification/landing-light.png` + `landing-dark.png` exist, captured AFTER deploy landed | |
| 17 | **No raw-text-leak / orphan JSX in either screenshot** | eyeball check passed; if any debug string visible, skill loops back | |
| 18 | **Logo silhouette holds in both themes** | no slate-on-slate or iris-on-iris invisibility | |

If any check FAILs, fix before declaring complete. Render-ladder failure, missing cross-model judge, missing iteration loop, missing system extension are all blocking — there are no "soft fails" in v3.

## Provenance

This skill explicitly rejects the v2 failure mode of "ship a competent generic at 56/70 and call it world-class". v3 either earns ≥ 65/70 through cross-domain inspiration + cross-model judging + 5-stage refinement + constraint escalation, or logs a framework gap naming the specific failure mode. The user gets a real outcome — production-grade or documented gap — never a self-graded mid. There is no external escape hatch.
