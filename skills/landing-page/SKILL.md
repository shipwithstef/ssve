---
name: landing-page
version: "1.0"
description: >
  End-to-end landing-page generation for marketing/home/feature/pricing pages.
  Chains marketing-context + reference-bank + copywriting + generate-visuals +
  component scaffold + benchmark-landing gate. Use when "build a landing", "ship
  the home page", "redesign hero", "marketing page", "fix the landing", or any
  WI tagged `landing` / `marketing-page`. Replaces the manual orchestration
  between design-ui and execute-changeset for marketing-class pages.
inputs:
  required:
    - { path: "docs/specs/marketing-context.md", artifact: marketing-context }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
    - { path: "references/landing-bank/<sector>/", artifact: reference-bank, note: "≥3 captured anchors with hero.png + hero.webm + pattern.md" }
  optional:
    - { path: "docs/specs/ui/constraint-matrix.md", artifact: stack-constraints }
    - { path: "docs/specs/hero-assets/manifest.yaml", artifact: hero-assets }
    - { path: "docs/specs/work-items/<WI>.md", artifact: work-item }
outputs:
  produces:
    - { path: "docs/specs/landing/<page>-brief.md", artifact: landing-brief }
    - { path: "docs/specs/hero-assets/<page>/", artifact: hero-asset-set }
    - { path: "src/components/landing/<Hero>.{jsx,tsx}", artifact: hero-component }
    - { path: "docs/specs/benchmark/<date>-<page>.yaml", artifact: benchmark-score }
    - { path: "docs/specs/landing-page/in-app-verification/", artifact: live-page-screenshots, note: "MANDATORY: live light/dark screenshots of the implemented landing page. Route-workflow resolves this artifact path for its visual-output post-skill hook." }
phases:
  - { id: P1-PreconditionsAndReferenceBanks, required_for_completion: true, evidence: "sector/high-performer banks, marketing context, and stack constraints loaded or blocked with reason" }
  - { id: P2-MarketGapAndShipReadiness, required_for_completion: true, evidence: "market-gap report and top-anchor ship-readiness verdict produced" }
  - { id: P3-LifecycleClassifiedBrief, required_for_completion: true, evidence: "landing brief written with lifecycle classification and gated recommendations" }
  - { id: P4-CopyAndAssetCandidates, required_for_completion: true, evidence: "copy variants and visual asset candidate/provenance sets generated or skip evidence recorded" }
  - { id: P5-HumanCheckpointAndManifest, required_for_completion: true, evidence: "taste checkpoint result and chosen asset manifest recorded" }
  - { id: P6-ComponentVariantsAndScaffold, required_for_completion: true, evidence: "component variants judged and promoted scaffold written" }
  - { id: P7-BenchmarkGate, required_for_completion: true, evidence: "benchmark-landing score recorded for shipping viewports" }
  - { id: P8-LiveInAppVerification, required_for_completion: true, evidence: "deployed light/dark screenshots captured or explicit blocker recorded" }
  - { id: P9-HandoffAndSelfVerify, required_for_completion: true, evidence: "execute-changeset handoff and self-verify/continuation decision recorded" }
chain:
  lanes:
    greenfield: { position: 13, prev: design-logo, next: track-visuals }
    brownfield-feature: { position: 8, prev: design-logo, next: track-visuals }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** 🧠 [STRAT] for brief synthesis, 🎨 [SENSE] (Gemini/Claude Design) for asset selection, ⚙️ [EXEC] for component scaffold, 🛡️ [REVIEW] for the benchmark gate.

# Landing Page

Marketing pages are not "just UI" — they're a copy × imagery × motion × trust × benchmark problem with a measurable conversion target. `design-ui` is too generic, `benchmark-landing` only scores, `copywriting` only writes. This skill is the orchestrator that fuses them and BLOCKS on benchmark ≥7.5 before handoff to `execute-changeset`.

**Announce at start:** "I'm using landing-page to ship a benchmarked marketing page end-to-end."

## When to use

- Greenfield home / pricing / feature page
- Brownfield landing iteration (e.g. Example Marketplace WI-088 iter2)
- Replacing a generic-SaaS hero with a sector-tier one
- Any WI where the AC includes "doesn't read as generic SaaS" or "passes benchmark-landing"

## When NOT to use

- Single-component visual tweak → `quick-fix`
- App / product UI screens (not marketing) → `design-ui` directly
- Just scoring an existing landing → `benchmark-landing` directly
- Just rewriting copy on shipped page → `copywriting` + `copy-editing`

## Process

### Step 0 — Preconditions

Mandatory before any generation:

1. **Sector reference bank** exists at `references/landing-bank/<sector>/` with **≥10 captured anchors** (each has `pattern.md`; binary `hero.png`/`hero.webm` may be TODO). If absent → invoke `reference-bank-builder` (or capture manually; see `references/reference-bank-capture.md`). The 10-anchor floor (raised from 3 in WI-131) reflects the post-vibecoding-era proliferation of competitors — fewer than 10 produces stale, narrow archetype recommendations.
2. **High-performer bank** exists at `references/landing-bank/_high-performers/` with **10 cross-sector anchors** picked for stylistic diversity (sharp-utilitarian-dev-tool, lush-illustrative-creator-tool, bold-statement-typography, calm-minimal-data-tool — at least 2 from each cluster). High-performers are read alongside sector anchors so the brief isn't trapped in sector-orthodox patterns.
3. **Marketing context** loaded: P1 persona, JTBD, primary conversion goal, brand voice.
4. **Stack constraint matrix** read (e.g., Example Marketplace: React+Vite+Tailwind+shadcn+framer-motion, no new deps). Every downstream choice respects it.

#### Anchor `pattern.md` schema (WI-158: Below-fold required)

Every anchor `pattern.md` MUST include — in addition to the existing hero blocks (Layout / Visual treatment / Copy / Feature mix / Why this is best-in-class) — a `## Below-fold` block capturing the progressive product reveal beneath the hero:

```markdown
## Below-fold
- Section count: <N> + ordered list (e.g., problem / solution / features / social-proof / pricing / FAQ / CTA-repeat / footer)
- Illustration density: <N custom illustrations | N product screenshots | N photos | N animations>
- Animation features: <scroll-triggered | hover | video-loop | lottie | none>
- Social proof: <logo-wall (count) | testimonial cards (count) | stats banner | case-study grid | none>
- Pricing surface: <on-landing-with-tiers | linked-out | hidden>
- FAQ: <on-landing (N items) | linked-out | none>
- CTA repeat count: <N>  (how many times the primary CTA repeats below the fold)
```

Below-fold capture is mandatory for every new anchor and is enforced by Self-Verify check #1b. If the anchor's live URL cannot be fetched at capture time, write a stub block with `<unavailable — fetch failed>` and fill section count from any cached descriptions; the next capture pass should resolve.

### Step 0.5 — Market-Gap Analysis (added WI-131, extended WI-158)

Before brief synthesis, extract the **feature/value-prop mix** AND the **below-fold pattern mix** from the reference banks and compare to the project's marketing-context.md and current landing implementation.

**Inputs:**
- `pattern.md` files in `references/landing-bank/<sector>/` (sector mix)
- `pattern.md` files in `references/landing-bank/_high-performers/` (cross-sector mix)
- Each anchor's "**Feature mix surfaced**" section (lists the top 3 message hooks the anchor leads with)
- Each anchor's "**Below-fold**" block (section count, illustration density, animation features, social proof, pricing surface, FAQ, CTA repeat — added WI-158)
- `docs/specs/marketing-context.md` (project's own value-prop list)
- Current landing implementation file (e.g., `src/pages/Landing.jsx`) for honest below-fold self-assessment

**Process:**
1. Aggregate the union of all message hooks across the 20 anchors into a frequency table: `<message-hook>: <appears in N of 20 anchors>`
2. Filter to hooks appearing in ≥3 anchors — that's the **table-stakes mix** for this sector × style space
3. Compare to project's marketing-context.md: which table-stakes hooks are **missing** from the project's own positioning?
4. Surface non-table-stakes but high-signal hooks (1-2 anchors only): which **differentiators** could the project add that competitors aren't claiming?
5. **Below-fold aggregation (WI-158):** for each below-fold dimension (illustration density, animation features, social proof type, pricing on-landing, FAQ on-landing, CTA repeat count, section count), tally frequency across all 21 anchors. Apply severity rules:
   - **HIGH** if ≥7/21 anchors have the dimension and the project does NOT
   - **MEDIUM** if 4–6/21 anchors have it and the project does NOT
   - **LOW** if 1–3/21 anchors have it and the project does NOT
   - **MET** if the project already has it (no gap)

**Output: `docs/specs/landing/<page>-market-gap.md`**

```markdown
# Market-Gap Analysis: <page>

**Date:** <date>
**Sector:** <sector-slug>
**Anchors analyzed:** <N sector + 10 high-performer = 20>

## Table-stakes (appear in ≥3 anchors)

| Hook | Frequency | Project has it? | If no: severity |
|------|-----------|-----------------|------------------|
| "AI-native" | 14/20 | ❌ | HIGH — page reads as pre-AI generation |
| "Per-location pricing" | 8/10 sector | ✅ | — |
| ... | ... | ... | ... |

## Differentiators worth considering (1-2 anchors)

| Hook | From | Project fit |
|------|------|-------------|
| "Migrate from <competitor> in 5 min" | linear.app | ✅ Example Marketplace could claim Toast-migration |
| "Open-source / self-host option" | plausible.io | ❌ — not the model |
| ... | ... | ... |

## Below-fold gap table (WI-158)

| Dimension | Anchor frequency | Project state | Severity |
|-----------|------------------|---------------|----------|
| Custom illustrations (≥3 below-fold) | 12/21 | none | HIGH |
| Logo wall | 14/21 | present | MET |
| Scroll-triggered animations | 9/21 | none | HIGH |
| Video loop below fold | 6/21 | none | MEDIUM |
| Pricing on-landing with tiers | 8/21 | yes | MET |
| FAQ on-landing | 11/21 | yes | MET |
| CTA repeat ≥3 | 16/21 | 2 | MEDIUM |
| ... | ... | ... | ... |

## Recommendation for the brief

**Add:** <list of hooks to incorporate into hero/sub-hero copy>
**Defer:** <hooks to skip with reason>
**Differentiate via:** <1-3 differentiators picked from above>
**Below-fold upgrades:** <list of HIGH/MEDIUM gaps to address in the brief — illustration set, animation pass, video loop, CTA repeat, etc.>
```

The brief synthesis (Step 1) MUST consume this gap report — every hero/sub-hero direction names which gap-report hook it addresses.

### Step 0.5b — Ship-readiness gate vs anchor (WI-139)

After Market-Gap analysis and BEFORE handing off to design-ui, emit a binary ship-readiness verdict against the top-1 anchor.

**Output format (REQUIRED — surfaced inline in lane-tasks `skill_receipt`):**

```
ship-ready vs <ANCHOR_TOP_1>: yes | no
<one-paragraph honest gap read>
```

The paragraph names the specific visual deficits relative to the named anchor — illustration tier, below-fold density, motion presence, product-UI screenshot fidelity, etc. — and is honest, not optimistic. If the answer is "no", the brief synthesis (Step 1) MUST budget remediation for the deficits before design-ui produces components.

This gate exists because two prior sessions (Example Marketplace WI-088 iter1, WI-161) shipped iterations whose Market-Gap analysis correctly identified the gaps but whose subsequent execution closed them only textually (CSS-only mocks, bullet-list expansion) while the live page visually fell 50–60% short. Forcing an explicit ship-ready binary upstream of design-ui makes the gap-vs-execution mismatch visible at planning time, not at user-inspection time.

The verdict text becomes part of the brief at Step 1 ("Asset class" + "Motion budget" sections must reflect what the ship-readiness paragraph identified).

### Step 1 — Brief synthesis

Produce `docs/specs/landing/<page>-brief.md` containing:

#### 1a — Mandatory lifecycle classification

Before any recommendation is generated, classify the project's lifecycle stage. This gate prevents post-launch CRO levers from being recommended to pre-launch projects (see `references/recommendations-by-lifecycle.md`).

```yaml
project_lifecycle:
  stage: pre-launch | launch-imminent | post-launch-validation | post-launch-scaling
  evidence: "<single line citing the specific signals>"
  paying_customers: <integer, even if 0>
  production_data_available: <boolean>
  primary_traffic_source: <"none-yet" | "outreach" | "organic" | "paid" | "viral" | "mixed">
```

**Signals to read (falsifiable checks):**

| Signal | Source | What it proves |
|---|---|---|
| Paying customers | `docs/specs/project-state.md` § Roadmap → "first revenue ~YYYY-MM-DD" + git log mentions of "first customer" / "first paying" | Customer-base size |
| Production data | `docs/specs/project-state.md` notes on live entities / DB state; skip probe if pre-launch | Whether "live counter" recommendations are honest |
| Distribution status | `docs/marketing/DIGITAL_OUTREACH_PLAYBOOK.md` exists + `docs/specs/project-state.md` notes whether outreach has fired | Whether the page is being actively driven |
| Primary traffic source | `docs/specs/router-context.md` + outreach playbook + any ads config | What the page must convert (cold outreach has different best-practices than organic search) |

If `docs/specs/project-state.md` does not exist or is unreadable, halt and invoke `route-workflow` to establish state before continuing. Do not guess the lifecycle stage.

#### 1b — Recommendation-set gating

Every recommendation in the brief MUST declare its lifecycle compatibility:

```yaml
recommendations:
  - name: "Free tier signal"
    lifecycle_compatibility: [pre-launch, launch-imminent, post-launch-validation, post-launch-scaling]
    rationale: "Friction reduction matters at every stage"
  - name: "Live counter (real production data)"
    lifecycle_compatibility: [post-launch-validation, post-launch-scaling]
    rationale: "Counter must show real numbers; pre-launch shows 0"
    blocked_at_pre_launch: true
```

If a recommendation has `blocked_at_pre_launch: true` and `project_lifecycle.stage == "pre-launch"`, the brief MUST exclude it OR include an explicit override justification of ≥1 sentence (e.g., "Override: included because launch is in 5 days and pricing model is validated via beta interviews").

The compatibility matrix for all known levers is in `references/recommendations-by-lifecycle.md`. If a lever is not in that table, add it before recommending it.

#### 1c — Brief content

- **Page goal** (single primary conversion target)
- **Hero archetype** picked from reference bank (storefront-card / split-product / video-bg / illustration-bg / etc.)
- **Copy direction** (tone, headline angle, 3 alternatives planned)
- **Asset class** (photoreal / 3D / illustration / live-UI / video) — the "illustration craft tier" for benchmark dim 4
- **Motion budget** (≤ sector 75th percentile from bank)
- **Hero Section Motion Contract** (if hero present — see § Motion Contract below)
- **Video background spec** (if applicable — see § Video Background Layer below)
- **Constraint deviations** (if any) with reason

### Step 2 — Copy

Invoke `copywriting` with the brief. Produce 3 headline + subhead + CTA variants. Pick winner via `cro` rubric (clarity / specificity / value-articulation / verb-strength).

### Step 3 — Visual assets (parallel)

Invoke `generate-visuals` with the asset class + brief. Output: 3-5 candidates per asset slot (hero background, product card screenshot, trust-badge illustrations, etc.) routed across:

- **Photoreal hero** → Gemini Nano Banana Pro / Imagen 4
- **UI mockup** → Stitch MCP (`mcp__stitch-builtin__generate_screen_from_text`)
- **Branded variants** → Figma MCP + Weave (`mcp__claude_ai_Figma__use_figma`)
- **Live HTML hero** → Claude Design (External Canvas Handoff per `design-ui` Step B)
- **Illustrations** → Storyset CDN (free, brand-safe fallback)
- **Iconography** → existing `lucide-react` (no new deps)
- **Video / motion bg** → Veo 3 via Flow (only if brief justifies)

Save all candidates under `docs/specs/hero-assets/<page>/candidates/` with provenance.

### Step 4 — Human checkpoint (taste)

Surface candidates side-by-side. Builder picks winner per slot. Store winners in `docs/specs/hero-assets/<page>/manifest.yaml`.

### Step 5 — Component Variant Generation (added WI-131)

For each **key component**, generate **≥5 variants** using different archetypes from the reference bank, then judge each. Single-shot scaffolding is not enough — the visual space is too large to converge in one attempt.

**Key components (mandatory — each gets ≥5 variants):**

1. **Hero** — full above-fold composition. Archetype mix: at least 1 sector-orthodox + 1 high-performer-inspired + 3 others
2. **Primary CTA** — button + microcopy + position. Variants vary visual weight, copy framing, and surrounding context
3. **Trust bar** — logo strip / testimonial row / metric badges. Variants vary density, attribution, and visual treatment
4. **Pricing table** (only if page includes pricing) — variants vary tier count, comparison framing, and anchor pricing
5. **Footer CTA** — closing conversion moment. Variants vary urgency framing and visual contrast

**Per-component process:**

```
for each key component:
  1. Generate 5 variants → src/components/landing/_variants/<component>/v{1..5}/
     Each variant uses a different archetype from reference banks
  2. Render each variant in isolation at all shipping viewports
  3. Score each variant via benchmark-landing per-dimension (8 dims, no aggregate yet)
  4. Pick winner: highest weighted aggregate AND no dim < 6
  5. Log decision in src/components/landing/_variants/<component>/decision.md:
     - winning variant + score
     - why each loser lost (specific dimensions)
     - which archetype the winner used + which anchor inspired it
  6. Promote winner to src/components/landing/<Component>.{jsx,tsx}
```

**Skip rules:**
- Skip pricing-table variants if the page has no pricing surface
- Skip footer-CTA variants if the page is mid-funnel (sticky CTA covers the closing conversion)
- ALL skips must be justified in the decision.md with a one-line reason

**Why ≥5:** picking from 2-3 produces local maxima (the first plausible direction wins by default). 5+ forces the orchestrator to consider genuinely different archetypes — including high-performer cross-overs that wouldn't surface at lower variant counts.

### Step 5b — Compose final scaffold

After all key components have a winner, compose `src/components/landing/<Page>.{jsx,tsx}` from the promoted components:

- Apply tokens from project's design system
- Light + dark mode behavior explicit
- Mobile reflow (not scale) at every shipping viewport
- Motion via framer-motion only (or stack equivalent)
  - Apply `references/motion-patterns.md` for premium easing, stagger rules, spring physics, and motion budget
  - Run `node scripts/validate-motion-pattern-usage.mjs <changed visual files>` when motion is present; motion must cite canonical tokens and reduced-motion handling.
- Accessibility: WCAG 2.2 AA, prefers-reduced-motion respected
- Ephemeral `_variants/` directory cleaned up after promotion (winners live in `src/components/landing/`)

### Step 6 — Benchmark gate (BLOCKING)

Invoke `benchmark-landing` at every shipping viewport (375 / 768 / 1280 / 1536 by default).

- Weighted aggregate **≥ 7.5** to PASS
- Watch dim 3b (liveness perceptibility) and dim 9 (delta vs predecessor — mandatory on iterations)
- If FAIL → return to Step 3 with the failed dimensions as fix targets. Max 3 retry loops before escalating to builder.

### Step 7 — Handoff

Pass to `execute-changeset` with manifest:

- Files touched (component + page integration only — minimum diff)
- Bundle-grep literal for post-deploy verification
- ACs from work-item mapped to benchmark dimensions

## Hero Section Motion Contract

If the brief includes a hero section, it MUST specify the following 5 layers. Vague directions like "subtle fade-in" or "glass cards" are NOT acceptable — exact values are required.

### Layer 1 — Design System
- Primary background color (e.g., `#f0f0f0`)
- Container max-width (e.g., `1536px`)
- Border radius scale (e.g., `1.5rem` mobile / `3rem` desktop)
- Font stack with fallbacks

### Layer 2 — Layout Structure
- Navbar position + visibility rules (desktop vs mobile)
- Content alignment (centered / left / split)
- Bottom element placement (cards, corner cut-outs, CTAs)
- Grid system (column spans, row spans)

### Layer 3 — Typography Specs
- Headline: exact size per breakpoint, weight, color
- Subhead: size, line-height, max-width
- Badges/pills: font-size, padding, border

### Layer 4 — Animation Behavior
- Entrance animation type (`fadeInUp` / `fadeInLeft` / `scaleIn` / `slideInLeft`)
- Stagger delay between elements (e.g., `0.12s`)
- Duration per element (e.g., `0.6s`)
- Easing curve (e.g., `[0.22, 1, 0.36, 1]`)
- Hover transitions on interactive elements

### Layer 5 — Component Specs
- Glassmorphism formula (e.g., `bg-white/30 backdrop-blur-xl border border-white/20`)
- Button specs (padding, radius, icon treatment)
- Watermark/icon opacity (e.g., `opacity-[0.02]`)
- Inverted corner treatment (if used — see `skills/landing-page/references/inverted-corner-pattern.md`)

## Video Background Layer

If the hero uses a background video, the brief MUST specify:

- **Video URL** — CDN-hosted MP4, < 10MB for hero loading performance
- **Overlay opacity** — `bg-black/10` for light text, `bg-white/10` for dark text
- **Fallback behavior** — static image or solid color if video fails to load
- **Performance** — video must be below-the-fold lazy-loaded if not in initial viewport

Standard implementation:
```tsx
<video
  className="absolute inset-0 w-full h-full object-cover"
  autoPlay muted loop playsInline
  src={videoUrl}
/>
<div className="absolute inset-0 bg-black/10" /> {/* Overlay for text contrast */}
```

## Output

- `docs/specs/landing/<page>-brief.md` — the brief
- `docs/specs/hero-assets/<page>/manifest.yaml` — chosen assets + provenance
- `src/components/landing/<Hero>.{jsx,tsx}` — the component
- `docs/specs/benchmark/<date>-<page>.yaml` — benchmark score (PASS gate)

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Sector reference bank has ≥10 anchors | `ls references/landing-bank/<sector>/*/pattern.md \| wc -l` returns ≥10 | |
| 1b | Every anchor pattern.md has `## Below-fold` block (WI-158) | `grep -L "^## Below-fold" references/landing-bank/**/pattern.md` returns empty | |
| 2 | High-performer bank has 10 anchors with style mix | `ls references/landing-bank/_high-performers/*/pattern.md \| wc -l` returns 10; INDEX.md confirms ≥2 anchors per style cluster | |
| 3 | Market-gap analysis written | `docs/specs/landing/<page>-market-gap.md` exists with table-stakes table + differentiator table + recommendation | |
| 4 | Brief explicitly names hero archetype + addresses gap-report hooks | `grep -E "archetype:\|reference:\|gap-hook:" docs/specs/landing/<page>-brief.md` returns named anchor and at least 1 gap-hook | |
| 5 | Copy: 3 variants generated, winner justified | `docs/specs/landing/<page>-brief.md` has Copy section with 3 variants and a `chosen: N because <reason>` line | |
| 6 | Assets: ≥3 candidates per slot, provenance recorded | `docs/specs/hero-assets/<page>/provenance.yaml` lists ≥3 candidates per declared slot with `provider:` + `brand_fit:` | |
| 7 | Human checkpoint completed (manifest.yaml exists) | `docs/specs/hero-assets/<page>/manifest.yaml` exists with explicit `chosen:` per slot | |
| 8 | Each key component has ≥5 variants + decision.md | `ls src/components/landing/_variants/<component>/v*/  \| wc -l` returns ≥5 per non-skipped component; each `decision.md` names winner, losers' fail-dims, and inspiring anchor | |
| 9 | Component diff is minimum — only landing files touched | `git diff --stat` shows only `src/components/landing/` and `src/pages/<page>` paths; no shared/global files | |
| 10 | Benchmark ≥ 7.5 weighted, all viewports | `docs/specs/benchmark/<date>-<page>.yaml` has `weighted_score: ≥7.5` and `viewports: [mobile, tablet, desktop]` all scored | |
| 11 | Dim 9 (delta vs predecessor) scored on iterations | If iteration-N (N>1), `dim_9_delta_vs_predecessor:` is present and references prior benchmark file | |
| 12 | No new npm deps introduced | `git diff package.json package-lock.json` returns no changes (or only lock-file noise from existing deps) | |
| 13 | **Live in-app screenshots present** (Phase Z) | `docs/specs/landing-page/in-app-verification/landing-light.png` AND `landing-dark.png` exist, captured AFTER deploy landed | |
| 14 | **Live screenshots pass eyeball checklist** (Phase Z) | per `_shared/live-evidence.md` rubric — no raw-text-leak, silhouette holds, theme-correct accents, brand-register match | |
| 15 | Brief declares lifecycle stage with evidence | `grep "project_lifecycle:" docs/specs/landing/<page>-brief.md` returns the block, with `stage:`, `evidence:`, `paying_customers:`, `production_data_available:`, `primary_traffic_source:` | |
| 16 | Each recommendation tagged with lifecycle_compatibility | `grep -c "lifecycle_compatibility:" docs/specs/landing/<page>-brief.md` returns a count ≥ `grep -cE "^  - name:" docs/specs/landing/<page>-brief.md` | |
| 17 | No `blocked_at_pre_launch` recommendations present when stage is pre-launch (or override justified inline) | `grep -n "blocked_at_pre_launch: true" docs/specs/landing/<page>-brief.md` → for each match, verify `sed -n "<match_line>,<match_line+3>p"` contains "Override:" or "override_justification" | |

## Phase Z — Live in-app verification (MANDATORY terminal gate)

Before declaring done, capture the **deployed** landing page in BOTH light AND dark theme via Playwright and run the eyeball checklist in `_shared/live-evidence.md`. **No live screenshots, no done.**

Output: `docs/specs/landing-page/in-app-verification/landing-{light,dark}.png`

Hard-fails (raw text leak, palette mismatch, contrast fail, broken theme swap, cached old asset) loop back to `references/iteration-loop.md`. Benchmark score ≥ 7.5 alone is **not sufficient** — the live screenshot pair is the truth-teller.

Origin: 2026-04-30 Example Marketplace run shipped a logo-swap that bundle-grep + build all PASSED while the live page rendered raw JSX text in the top-left. The benchmark score was high. Only live capture caught it.

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-PreconditionsAndReferenceBanks --evidence file:references/landing-bank/<sector>/INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-MarketGapAndShipReadiness --evidence file:docs/specs/landing/<page>-market-gap.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-LifecycleClassifiedBrief --evidence file:docs/specs/landing/<page>-brief.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CopyAndAssetCandidates --evidence file:docs/specs/hero-assets/<page>/provenance.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-HumanCheckpointAndManifest --evidence file:docs/specs/hero-assets/<page>/manifest.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ComponentVariantsAndScaffold --evidence file:src/components/landing/<Page>.tsx
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-BenchmarkGate --evidence file:docs/specs/benchmark/<date>-<page>.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-LiveInAppVerification --evidence screenshot:docs/specs/landing-page/in-app-verification/landing-light.png --evidence screenshot:docs/specs/landing-page/in-app-verification/landing-dark.png
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P9-HandoffAndSelfVerify --evidence command_output:.svc/landing-page-self-verify-<WI>.log
```

If a page is blocked before implementation, still record the reached phase with
the blocking artifact, for example the missing-bank report, failed
ship-readiness verdict, benchmark failure, or unavailable live-deploy screenshot
capture. Do not mark the task `completed` until every required phase receipt is
present or a framework-approved skip/blocker receipt explains why the phase
could not run.

## References

- `_shared/live-evidence.md` — canonical capture pattern + checklist (referenced by Phase Z above)
- `references/reference-bank-capture.md` — Playwright recipe to build the bank
- `references/asset-class-routing.md` — which provider for which asset class
- `references/motion-patterns.md` — premium scroll-reveal, spring physics, stagger, and motion budget rules
- `references/iteration-loop.md` — failure-driven retry rules
- `references/recommendations-by-lifecycle.md` — which CRO levers apply at which lifecycle stage (lifecycle-stage gate)

## Lane integration

- Inserted between `design-ui` and `execute-changeset` for any WI tagged `landing` / `marketing-page` / `home-page` / `pricing-page` / `feature-page`
- For greenfield: `design-ui` produces the design-system + UX direction, then `landing-page` materialises the marketing pages off it
- For brownfield iter (e.g. Example Marketplace WI-088 iter2): can be invoked standalone, reading existing constraint-matrix.md as input

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work

### Standalone mode (no active task graph)

**Next:** if benchmark passed (≥7.5), hand off to `execute-changeset` to land the components and assets; if blocked (<7.5), iterate per `references/iteration-loop.md` and re-invoke benchmark-landing. If invoked directly by the user, surface the benchmark report file path and let them decide whether to ship or iterate.
