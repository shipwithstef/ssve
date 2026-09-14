---
name: design-logo
version: 3.0.0-draft
status: DRAFT — pending plan-changeset for WI-141
description: >
  World-class brand identity system. Concept-first methodology with measurable human-perception
  metrics across ALL design dimensions (mark, wordmark, lockup, color system, type system,
  motion, voice, accessibility, application). Reaches designer-grade output via AI orchestration
  alone — no human-designer handoff. Plateaus are search-space problems solved by constraint
  escalation, not craft-ceiling problems.
inputs:
  required:
    - { path: "docs/specs/brand-brief.yaml", artifact: brand-brief, note: "name, audience, voice, palette anchors, anti-references, cross-domain inspiration, ≥3 exemplar_inspiration entries, 1-sentence brand-promise" }
    - { path: "references/exemplar-bank-2026.md", artifact: exemplar-bank, note: "curated marks with transferable principles + hidden-hook entries" }
    - { path: "references/perception-metrics.md", artifact: perception-metrics, note: "10-axis measurable perception rubric with measurement protocol per axis" }
    - { path: "references/concept-canon.md", artifact: concept-canon, note: "library of brand-concept archetypes; the CONCEPT must trace to one canonical archetype" }
  optional:
    - { path: "references/landing-bank/<sector>/", artifact: reference-sample-bank }
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
chain:
  predecessor: brand-brief gate (Phase 0)
  terminal: false
  next: track-visuals (regression baseline) | landing-page (apply system) | design-ui (apply tokens)
requires_topics:
  - typography/anatomy
  - color/perception
  - motion/principles
  - accessibility/wcag
forbidden_phrases:
  # validate-design-logo-no-handoff.sh greps SKILL.md for these — fails lint if any present
  - "hire a designer"
  - "designer handoff"
  - "AI ceiling"
  - "human designer"
  - "external designer"
  - "Designer-handoff brief"
  - "8–15 hrs"
  - "stop and emit a brief"
---

# design-logo v3 — Concept-first brand identity system

## Why v3 exists

v2 produced ~58/70 plateaus because it scored execution without scoring CONCEPT. A logo is the visible tip of a brand identity iceberg; scoring the tip while ignoring the underwater concept guarantees mediocrity. v3 inverts the order: **concept is articulated, scored, and locked BEFORE any pixel is rendered**, then execution refines the concept across all design dimensions to a measurably-perceivable result.

v3 also removes the designer-handoff exit. In the AI era, plateau is a search-space problem. Add constraints. Use multi-tool orchestration. Reach designer-grade or log a framework gap — never punt to a human.

## The 10 honest constraints (replaces v2's 7)

1. **Concept precedes execution.** No image is generated until `concept-statement.yaml` exists, scored ≥7/10 on the 10-axis perception rubric, and traced to a canonical archetype from `references/concept-canon.md`.
2. **Cross-domain inspiration is mandatory** — sector references alone produce sector-shaped output. ≥3 non-sector domains. Architecture, nature, science, art history, industrial design, abstract geometry, motion physics.
3. **Exemplar bank consult is mandatory** — pick ≥3 entries from `exemplar-bank-2026.md` whose transferable principle maps to the brief. Includes ≥1 hidden-hook entry (FedEx-arrow class).
4. **Hidden-hook requirement** — the concept must be describable IN PLAIN ENGLISH to ONE person on a single try with the hook discoverable in 2-3 seconds of looking. If the hook needs a designer's commentary to find, the concept has no hook.
5. **Lockup-stutter test on every monogram-class concept** — if mark is a single letter X and brand wordmark starts with X, the concept is disqualified for production lockup use.
6. **Multi-tool orchestration** — image-gen for ideation (Codex CLI / Base44 / OpenAI gpt-image / Midjourney), SVG hand-edit for geometry, image-gen img-to-img for style polish, vector trace for production, motion test for liveness, context test for application.
7. **Constraint escalation when plateaus hit** — never handoff. The 5-step constraint ladder breaks any plateau.
8. **Founder-shrug is decisive saturation** — "fine / okay / I guess / sure / it's something" routes to constraint-tightening, NOT to ship.
9. **Brand identity is a SYSTEM** — mark, wordmark, lockup, color system, type system, motion, voice, accessibility, applied artifacts. Phase 10 (system extension) is non-skippable.
10. **Live in-app verification is the terminal gate** — the skill cannot declare done until light + dark theme screenshots from the deployed product are captured AND the founder eyeballs them and declares impressed (not "fine").

## The 10-axis perception metrics (replaces v2's 7-axis self-grade)

Every concept and every refinement is scored on these 10 axes. Each axis has a **measurement protocol** — not vibes. Score 1-10 per axis; total /100. Floor for promotion: 80/100. Floor for terminal-phase entry: 90/100.

| # | Axis | What it measures | Measurement protocol |
|---|---|---|---|
| 1 | **Identifiability at 16px** | Does the silhouette survive favicon size? | Render at 16×16 px on white AND on dark. Show to a stranger; ask "is this distinct?" Yes = ≥7. Faint = ≤4. |
| 2 | **Semantic fit (stranger test)** | Does an outsider correctly identify the product category in 2s? | Show 256×256 to person OUTSIDE the project. Ask "what does this brand do?" Correct sector = ≥8. "I don't know" = ≤3. Wrong sector = 1. |
| 3 | **Hidden-hook discoverability** | Is the second meaning findable in 2-3 seconds without prompting? | Show concept to an outsider who hasn't been told there's a hook. If they spot it within 3s = 10. Within 10s = 7. After being told = 4. Never = 1. |
| 4 | **Distinctiveness vs sector** | Does it visibly differ from the 8 captured competitor marks? | Place mark in a 9-up grid with 8 sector competitors. Cover the wordmarks. Ask "which one is different?" If yours is the answer = 10. If yours blends = ≤3. |
| 5 | **Adversarial distance** | How far from the 6 anti-patterns (3D balloon, comic sans, rainbow, literal-clock, no-entry, generic rounded square)? | Render mark next to all 6 anti-patterns. Distance is qualitative but measurable. ≤5 means too close to one anti-pattern. |
| 6 | **Type quality (kerning + weight discipline)** | Are the wordmark letterforms intentional or default? | Per-pair kerning audit (Tr, AV, LT, Wo, rs). Letterform consistency. Custom glyphs vs system-Inter-default. ≥7 requires bespoke moves; not bespoke = ≤5. |
| 7 | **Color discipline** | Does the palette use ≤3 hues with intentional ratio? | Count unique hues in the mark. ≤3 = 10. ≤5 = 6. ≥6 = ≤3. Plus contrast: WCAG AA against page bg both themes, and ≥4.5:1 for text-bearing components. |
| 8 | **Scalability (16/32/64/256/512/1024)** | Does the mark hold geometry across the ladder? | Render at all 6 sizes. Eyeball: any size where mark loses meaning = -2 points. |
| 9 | **5-year longevity** | Will this look intentional or dated in 2031? | Trend audit: gradients, AI-render-of-the-month, palette-of-the-year, glassmorphism, bevels. Each present trend = -2. Trend-free = 10. |
| 10 | **Founder-love** | Would the founder TATTOO it / pay $5k for it / be jealous if a competitor shipped it? | 5 binary questions (tattoo, $5k, reverse-jealousy, 5-year, stranger). Each yes = 2 points. 5/5 = 10. ≤2/5 = ≤4. |

The skill cannot promote a concept to terminal phase below 90/100 OR with axis #2 below 8 OR with axis #10 below 8. Founder-love floor is non-negotiable: a logo the founder shrugs at is broken.

## All design dimensions covered (replaces v2's mark-only focus)

A logo is one component. The skill produces and validates ALL of these:

| Dimension | Artifact | Validator |
|---|---|---|
| **Mark** | `final/mark.svg` | scales 16→1024; ≥80/100 perception |
| **Wordmark** | `final/wordmark.svg` | kerning audit; ≥7 type-quality |
| **Lockup horizontal** | `final/horizontal.svg` | 4:1 aspect; lockup-stutter test pass |
| **Lockup vertical** | `final/vertical.svg` | 5:6 aspect |
| **Favicon** | `final/favicon.svg` + 16/32 PNG | legible at 16px; tab-strip eyeball test |
| **Dark mode** | `final/dark-mode.svg` | contrast on slate; brand maintains identity |
| **Monochrome** | `final/monochrome.svg` | uses `currentColor`; works on any bg |
| **Animation** | `final/animation.svg` (SMIL) | ≤600ms reveal; no Disney bounce |
| **Loading state** | `final/spinner.svg` | mark adapts; accent rotates |
| **Color tokens** | `final/color-tokens.json` | exportable; semantic naming |
| **Type system** | `final/type-system.json` | display/heading/body/mono with WCAG-tested sizes/weights |
| **Patterns** | `final/patterns/{1..5}.svg` | repeating tile, gradient, abstract field — all derived from mark geometry |
| **Icon language** | `final/icon-style/{home,calendar,bell,settings,user}.svg` | 5 product icons in mark's geometric language |
| **Voice principles** | `final/voice.md` | tone of voice tied to brand-promise; 3 do/don't pairs |
| **Application: nav** | `contexts/nav-header.png` | mark + wordmark in 1280×80 nav |
| **Application: og-card** | `contexts/og-card.png` | 1200×630 social-share with tagline |
| **Application: app-switcher** | `contexts/app-switcher.png` | iOS app-icon at 1024×1024 |
| **Application: storefront** | `contexts/storefront.png` | mark on a fictional café window decal |
| **Application: print** | `contexts/business-card.png` | 350×200 px, 5mm bleed |

**System-incomplete = task incomplete.** The skill does not declare done with only a mark.

## Phase-by-phase process

### Phase 0 — Brand brief gate

Read `docs/specs/brand-brief.yaml`. Required fields:
- `cross_domain_sources` (≥3 non-sector domains)
- `exemplar_inspiration` (≥3 from exemplar-bank with principle alignment, ≥1 hidden-hook)
- `brand_promise` (1 sentence — what shifts in the world if this brand wins)
- `anti_references` (≥6 named patterns to avoid)
- `audience_persona` (1-paragraph composite ICP read)
- `voice_pillars` (3 adjectives + their opposites)

If missing, refuse and ask user to enrich the brief.

### Phase 1 — Concept articulation BEFORE rendering (NEW in v3)

This phase produces ZERO images. It produces text artifacts only.

#### Phase 1a — Concept brainstorm

Generate ≥12 distinct concept-statements in `docs/specs/logo-pack/concepts/<id>.yaml`. Each statement is structured:

```yaml
id: C01
name: <short kebab-case name>
archetype: <pick from concept-canon.md — e.g. "threshold-crossing", "trust-seal", "schedule-row", "monogram-as-symbol", "negative-space-glyph">
elevator_sentence: <ONE sentence describing what the mark IS — no design jargon, plain English>
hidden_hook: <the second meaning a viewer discovers; describe in plain English; "no hook" is allowed but caps the concept at 60/100>
metaphor_chain:
  - <step 1: visual element>
  - <step 2: what it represents>
  - <step 3: how it ties to brand promise>
why_better_than_anti_reference: <pick 1 anti-reference from brief; explain in 1 sentence how this concept escapes it>
why_better_than_competitor: <name 1 sector competitor; explain how this concept differentiates>
risk_of_failure: <1 sentence — what could go wrong in execution>
```

#### Phase 1b — Concept scoring

Score each concept on the 10-axis rubric WITHOUT rendering. Use exemplar 2-up reasoning: imagine the concept side-by-side with its claimed exemplar. Estimate the score honestly. Concepts below 70/100 at this stage are killed before rendering.

#### Phase 1c — Concept commitment ledger

Write `docs/specs/logo-pack/concept-ledger.md`:

```yaml
round: 1
mode: exploration  # exploration | refinement | polish | terminal
concepts_introduced: 12
concepts_advanced: 4  # top 4 by phase-1b score advance to render
new_concepts_allowed_next_round: 0  # AFTER round 2 mode flips to refinement
```

Hard rule: after round 2, mode flips to `refinement`. After round 5, flips to `polish`. After successful terminal-phase eyeball pass, flips to `terminal`. New concepts after round 2 = skill failure logged in `framework-gaps.jsonl`.

### Phase 2 — Cross-domain moodboard + reference + adversarial capture

For each cross_domain_source, generate 3-5 inspiration images via Codex CLI:
```bash
codex exec "Generate a moodboard image: <domain> meets <product attribute>. Abstract geometric, no text, no literal objects. Inspiration only."
```

Capture 8 sector reference logos via Playwright. Render 6 named anti-patterns. Same as v2.

### Phase 3 — Render top 4 concepts (NOT ≥20 like v2)

v2 demanded ≥20 rendered concepts. v3 demands FEWER but DEEPER. Render only the top 4 concepts that survived phase 1b. For each, generate 4 stylistic variations via image-gen orchestration:

- Variation A — solid fill, geometric (Pentagram register)
- Variation B — line-drawn monoline (Stripe register)
- Variation C — negative-space cleverness (Sagmeister register)
- Variation D — soft asymmetric tension (Mucho register)

Total: 4 concepts × 4 stylistic variations = 16 rendered images. NOT 20+ random concepts.

### Phase 4 — Multi-size render ladder + WCAG + kerning

Render each surviving variation at 16/32/64/256/512/1024 px. Contrast ≥4.5/3. Kerning audit on any wordmark-bearing variant. Kill any variant that fails 16px legibility (axis #1 ≤4).

### Phase 5 — Self-score + exemplar 2-up + perception metrics

For each surviving variation:
1. Score on the 10-axis perception rubric (with measurement protocol per axis — not vibes)
2. Place in 2-up next to the named exemplar from brand-brief
3. If exemplar visibly outclasses on the same principle, cap score at 60/100 regardless of axes

### Phase 5b — Love-test gate

For top 3 by score, run the 5 founder-love questions:
1. Tattoo test
2. $5k test
3. Reverse-jealousy test
4. 5-year test
5. Stranger test (FRESH outsider, never seen the project)

Failures here do NOT trigger handoff — they trigger **Phase 8b constraint escalation**.

### Phase 6 — Cross-model judge

Send concept grid PNG + brand brief to Codex CLI:
```bash
codex exec "You are a senior brand designer at Pentagram. Rank these 12 logo concepts for <product> serving <audience>. Score each /100 on the 10-axis perception rubric (axes listed). Return JSON: [{id, scores_per_axis, total, top_3_strengths, top_3_weaknesses, hidden_hook_visible}]."
```

If self-score and codex disagree by >15 points on any concept, investigate WHY. Final ranking = MIN(self, codex) per concept.

### Phase 7 — Persona simulation (mandatory for top 5)

Same as v2: simulate target ICP first-impression read at 256px. Plain-English questions. Concepts that fail any question are demoted regardless of rubric.

### Phase 7b — Lockup-stutter test (mandatory for monogram-class)

If chosen mark is a single letter X AND brand wordmark starts with X, render mark + wordmark side-by-side at 4:1 horizontal lockup. Visual stutter ("X XBrand" reads as duplicate) = disqualified for production lockup use. Loop back to Phase 1 (NOT Phase 3) — the issue is conceptual, not executional.

### Phase 8 — Multi-tool refinement pipeline (replaces v2's 3-pass loop)

Run on each top-3 concept. The pipeline mimics how senior designers actually work:

#### Stage A — Geometry refinement (hand-edit SVG)
- Vectorize the image-gen sketch (potrace + manual cleanup)
- Optical correction: counter-weights, balance, asymmetric tension points
- Bezier curve smoothing (no kinks, no over-anchored points)
- Save vector pre-polish

#### Stage B — Style transfer iteration (image-gen img-to-img)
Send Stage-A vector + 3 different style prompts back to image-gen:
- "Same composition, executed in [Pentagram | Collins | Sagmeister | Chermayeff & Geismar | Mucho] style"
- "Same composition, with one ASYMMETRIC tension element added"
- "Same composition, find and embed a HIDDEN second meaning if not already present"

Pick best of 3 by eyeball + perception score.

#### Stage C — Vector trace + kerning + curve audit
- Re-trace Stage-B winner to clean SVG
- Per-pair kerning (Tr, AV, LT, Wo, rs)
- Bezier smoothing pass 2
- Optical compensation at 16/32/64 px specifically (sub-pixel rendering quirks)

#### Stage D — Motion + context test
- Animate mark draw-on (~600ms reveal) — does the geometry FLOW or break?
- Render in 5 contexts (nav header, favicon, app icon, OG card, storefront mockup)
- Eyeball on each — does it pass Phase 5b love-test in EVERY context?

#### Stage E — Sand-grain polish
- Sub-pixel adjustments (anchor cleanup, stroke endpoints, micro-radii)
- Color value tuning (hex codes vary by ±2 for optical balance — purple at 16px ≠ purple at 256px)
- Final 2-up against named exemplar from Phase 5
- If exemplar still outclasses → Stage A re-entry with new constraint added

**Each stage MUST improve combined perception score by ≥3 points or the stage is failed and retried with new constraint.**

### Phase 8b — Constraint-escalation ladder (NEW in v3)

When refinement round produces zero score improvement (delta ≤2):

| Plateau # | Added constraint |
|---|---|
| 1 | One-color only (force structural primacy — no color rescue) |
| 2 | Must work in negative space (force structural cleverness) |
| 3 | Must contain a HIDDEN second meaning (FedEx-arrow class) |
| 4 | Must be drawable in ≤5 path operations (force radical reduction) |
| 5 | Must embed brand-vocabulary glyph specific to the product category |

After 3+ plateaus despite stacked constraints, log a `framework-gaps.jsonl` entry naming the specific failure mode. **Never handoff.** The plateau is information about the search space, not the AI's ceiling.

### Phase 9 — Saturation gate (without designer handoff)

| Combined score | Action |
|---|---|
| ≥ 90/100 with axis #2 ≥ 8 AND axis #10 ≥ 8 | Promote to terminal phase |
| 80–89 | Phase 8 full pipeline rerun + Phase 8b plateau escalation; max 3 reruns |
| 70–79 | Stack ALL Phase 8b constraints simultaneously + cross-model re-score |
| 60–69 | Re-enter Phase 1 — concept-statement was insufficient. Brief may need enrichment. |
| < 60 | Brand brief itself is broken — re-enter Phase 0 with ambiguity forensics |

**No designer-handoff exit at any tier. The skill terminates only at ≥90/100 with founder-love floor passed.**

### Phase 10 — Brand identity SYSTEM extension (mandatory)

The chosen mark ships with the FULL system from "All design dimensions covered" table above. Mark + wordmark + 7-variant lockups + animation + spinner + 5 patterns + 5 product icons + color tokens + type system + voice principles + 5 application contexts. **System-incomplete = task incomplete.**

### Phase 11 — Application context mockups (mandatory)

Render mark in 5 real-world contexts:
- `contexts/nav-header.png` (1280×80 nav with 4 menu items)
- `contexts/favicon-tab.png` (browser tab strip)
- `contexts/og-card.png` (1200×630 social-share with tagline)
- `contexts/app-switcher.png` (iOS app icon at 1024×1024 + lockscreen badge)
- `contexts/storefront.png` (mark on a fictional café window decal)
- `contexts/business-card.png` (350×200 print)

Show to user. Ask: "Does this stand out vs blend in?" Founder-shrug = back to Phase 8.

### Phase 12 — Final variant matrix

7 production variants (horizontal/vertical/mark/wordmark/favicon/dark-mode/monochrome) generated from the iterated winner — NOT the raw concept.

### Phase 13 — Live in-app verification (TERMINAL gate, mandatory)

Same as v2 but with founder-emotion check added.

After deploy lands:
1. Capture both themes via Playwright (light + dark)
2. Eyeball check (technical — orphan text, palette mismatch, broken kerning)
3. **Founder-emotion check** (NEW): show founder the live-site screenshots. Ask ONE question:

   > "Looking at this on the live site with fresh eyes — does this impress you, or does it just look fine?"

   "Fine / okay / I guess / sure" = hard-fail. Loop back to Phase 8 Stage A with constraint escalation. **Cannot be overridden by rubric score.**

4. Hard fails:
   - Light mode: mark invisible / wrong color / orphan attributes / debug strings
   - Dark mode: contrast fail / mark invisible / palette mismatch
   - Either: founder-shrug
5. On any hard-fail, skill loops back. Does NOT declare done.

### Phase 14 — Declare done

Only when:
- Phase 13 light + dark + founder-impress all pass
- Concept ledger shows mode=`terminal`
- All Phase 10 system artifacts exist
- All Phase 11 application contexts captured
- `framework-learnings.jsonl` updated with anything novel learned this run

## Why the skill cannot stop below 90/100

The skill is responsible for reaching designer-grade output via AI orchestration alone. Plateau is a search-space problem, not a craft-ceiling problem. Every plateau has a constraint that breaks it. Find the constraint or log the framework gap. There is no human-designer escape hatch.

## Self-Verify

Before declaring routing complete, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Concept ledger exists | `docs/specs/logo-pack/concept-ledger.md` written | |
| 2 | All ≥12 concepts have concept-statement.yaml | files exist with all required fields | |
| 3 | Top 4 concepts scored ≥70 in Phase 1b | log shows scores | |
| 4 | Render quota satisfied | top 4 × 4 variations = 16 images rendered | |
| 5 | Perception scores logged per axis with measurement | not "vibes" — protocol referenced | |
| 6 | Exemplar 2-up artifacts exist | `judging/exemplar-2up/` populated | |
| 7 | Cross-model judge JSON received and reconciled | disagreements >15pts investigated | |
| 8 | Phase 5b love-test answered for top 3 | yes/no per question with rationale | |
| 9 | Phase 7b lockup-stutter check (if monogram-class) | rendered + verdict | |
| 10 | Phase 8 5-stage pipeline ran on top 3 | per-stage delta logged | |
| 11 | If plateau, Phase 8b constraint escalation triggered | constraint stack documented | |
| 12 | Phase 9 saturation gate verdict ≥90 | with axis #2 ≥8 AND axis #10 ≥8 | |
| 13 | All Phase 10 system artifacts produced | mark+lockups+animation+patterns+icons+tokens+type+voice | |
| 14 | All Phase 11 application contexts captured | nav+favicon+og+app-switcher+storefront+business-card | |
| 15 | Phase 13 light + dark deploy screenshots captured | from production URL, not local | |
| 16 | Founder-emotion check answered "impressed" not "fine" | founder verbatim quote logged | |
| 17 | No forbidden phrases in any output | grep clean | |
| 18 | framework-learnings.jsonl updated with run novelties | new entries appended | |

If any check FAILs, fix before continuing. Validators:
- `validate-design-logo-no-handoff.sh` — greps SKILL.md for forbidden phrases
- `validate-design-logo-ledger.sh` — asserts concept-ledger.md exists with valid round-mode rules
- `validate-design-logo-system-complete.sh` — asserts Phase 10 artifacts all present at terminal phase

## Provenance

- v1: 2026-04 — pre-WI-077, sector-only, 5 concepts, ad-hoc scoring
- v2: 2026-04-30 — adversarial set, exemplar bank, cross-model judge, persona sim, designer handoff at 56-59
- v3: 2026-05-02 — concept-first, 10-axis perception metrics with measurement protocols, ALL design dimensions, no designer handoff, founder-emotion as decisive saturation truth
