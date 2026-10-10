---
name: landing-page
version: "1.0"
description: >
  Build or redesign a marketing page (home, feature, pricing) from marketing context,
  references and copy into an implementation-ready brief, gated on the rendered result.
  Use when: build a landing, ship the home page, redesign hero, marketing page, fix the
  landing.
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
    - { path: "docs/specs/hero-assets/<page>/", artifact: hero-asset-set, note: "Only when generated assets are selected" }
    - { path: "docs/specs/landing/<page>-market-gap.md", artifact: market-gap }
    - { path: "docs/specs/landing-page/in-app-verification/", artifact: live-page-screenshots, note: "Conditional downstream output after execute/deploy, before promotion; route-workflow resolves the declared path. The pre-execution landing-page task records this obligation and does not claim these captures exist yet." }
phases:
  - { id: P1-PreconditionsAndReferenceBanks, required_for_completion: true, evidence: "relevant captured marketing references, visitor decision, marketing context, and stack constraints loaded or blocked with reason" }
  - { id: P2-MarketGapAndShipReadiness, required_for_completion: true, evidence: "market-gap report and top-anchor ship-readiness verdict produced" }
  - { id: P3-LifecycleClassifiedBrief, required_for_completion: true, evidence: "landing brief written with lifecycle classification and gated recommendations" }
  - { id: P4-CopyAndAssetCandidates, required_for_completion: true, evidence: "copy variants and visual asset candidate/provenance sets generated or skip evidence recorded" }
  - { id: P5-HumanCheckpointAndManifest, required_for_completion: true, evidence: "asset decision recorded in the brief; selected assets have a reviewed manifest" }
  - { id: P6-ComponentVariantsAndScaffold, required_for_completion: true, evidence: "meaningful visual alternatives judged and implementation-ready design written; no production source edited" }
  - { id: P7-PostExecuteProofHandoff, required_for_completion: true, evidence: "post-execute benchmark and deployed conversion-journey proof obligations recorded for promotion" }
  - { id: P8-HandoffAndSelfVerify, required_for_completion: true, evidence: "track-visuals/design-tech handoff and self-verify/continuation decision recorded" }
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

Marketing pages join copy, visuals, trust, and a measurable conversion goal. This skill prepares an implementation-ready design; `benchmark-landing` scores the rendered result after execution, before promotion. Use it only for marketing pages; an in-app screen whose job is operating the product stays with `design-ux` and `design-ui` and compares real product screens serving that job. Motion and imagery are optional choices justified by the page's user decision.

**Announce at start:** "I'm using landing-page to ship a benchmarked marketing page end-to-end."

## When to use

- Greenfield home / pricing / feature page
- Brownfield landing iteration (e.g. Example Marketplace WI-088 iter2)
- Replacing a generic-SaaS hero with a sector-tier one
- Any WI where the AC includes "doesn't read as generic SaaS" or "passes benchmark-landing"

## When NOT to use

- Single-component visual tweak → `route-workflow` for the bounded change
- App / product UI screens (not marketing) → `design-ui` directly
- Just scoring an existing landing → `benchmark-landing` directly
- Just rewriting copy on shipped page → `copywriting` + `copy-editing`

## Process

### Step 0 — Preconditions

Mandatory before any generation:

1. **Relevant captured references:** reuse the sector bank for real marketing pages serving a comparable audience and decision. `benchmark-landing` needs its captured anchor evidence; if fewer than three relevant captured examples exist, capture only what that gate needs and name the evidence limit. Do not expand a bank solely to meet a catalog quota.
2. **Cross-sector references:** use high performers only when their page solves a comparable communication or conversion problem. Record why each selected page is relevant; decorative resemblance alone is insufficient.
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

### Step 0.5 — Market-Gap Analysis

Compare the current landing page, marketing context, and relevant captured pages before writing the brief. Name the visitor's immediate decision and the single conversion action. For each selected reference, record the real page URL or capture, audience/decision match, and one concrete copy, hierarchy, product-evidence, trust, or layout choice that helps or hinders that decision. Include below-fold treatment when it affects the decision. Reuse the existing bank; do not add generic inspiration or a fixed number of samples.

A frequency table may describe sector convention, but prevalence alone never makes a missing element a defect. A logo wall, animation, video, repeated CTA, illustration set, FAQ, or pricing block belongs on this page only when it improves comprehension, trust, or action for this visitor and the underlying product can support the claim. Retaining a simpler page is a valid conclusion. Distinguish observed gaps from stylistic preference and do not copy a competitor's unverified claims.

Write `docs/specs/landing/<page>-market-gap.md` with the page goal, selected references and provenance, current-page evidence, observed decision gap, proposed change or retain-current decision, expected user outcome, and any evidence limit. For each proposed change, say what the visitor can understand or do afterward that they could not before, and why the cheapest adequate implementation is sufficient. The brief consumes only changes justified this way.

### Step 0.5b — Ship-readiness gate vs anchor (WI-139)

After Market-Gap analysis and BEFORE finalizing the brief for `track-visuals` and `design-tech`, emit a binary ship-readiness verdict against the most relevant captured anchor.

**Output format (REQUIRED — surfaced inline in lane-tasks `skill_receipt`):**

```
ship-ready vs <ANCHOR_TOP_1>: yes | no
<one-paragraph honest gap read>
```

The paragraph names any concrete deficit in comprehension, trust, product evidence, or conversion flow against a relevant captured page. An absent illustration, video, or motion effect is not a deficit by itself. If the answer is "no", the brief budgets the smallest remedy that serves the page goal before components are produced.

This gate exists because two prior sessions (Example Marketplace WI-088 iter1, WI-161) shipped iterations whose Market-Gap analysis correctly identified the gaps but whose subsequent execution closed them only textually (CSS-only mocks, bullet-list expansion) while the live page visually fell 50–60% short. An explicit ship-ready decision in this pre-execution handoff makes the gap visible to technical design and planning, before code is written.

The verdict text becomes part of the brief at Step 1; asset and motion choices follow the identified user need and may both be "none".

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
- **Hero composition** retained or adapted from a relevant captured page, with the visitor decision and reason stated
- **Copy direction** (tone, headline angle, 3 alternatives planned)
- **Asset class** (photoreal / 3D / illustration / live-UI / video) — the "illustration craft tier" for benchmark dim 4
- **Motion choice** (none unless it helps understanding or interaction; if used, stay within the sector budget)
- **Hero Section Composition Contract** (if hero present — see § Composition Contract below)
- **Video background spec** (if applicable — see § Video Background Layer below)
- **Constraint deviations** (if any) with reason

### Step 2 — Copy

Invoke `copywriting` with the brief. Produce 3 headline + subhead + CTA variants. Pick winner via `cro` rubric (clarity / specificity / value-articulation / verb-strength).

### Step 3 — Visual assets (parallel)

If the brief identifies an asset that helps the visitor decision, invoke `generate-visuals` with the asset class + brief. Explore enough candidates to compare the consequential choice; no asset slot or candidate count is required solely to fill a template. Possible routes:

- **Photoreal hero** → Gemini Nano Banana Pro / Imagen 4
- **UI mockup** → Stitch MCP (`mcp__stitch-builtin__generate_screen_from_text`)
- **Branded variants** → Figma MCP + Weave (`mcp__claude_ai_Figma__use_figma`)
- **Live HTML hero** → Claude Design (External Canvas Handoff per `design-ui` Step B)
- **Illustrations** → Storyset CDN (free, brand-safe fallback)
- **Iconography** → existing `lucide-react` (no new deps)
- **Video / motion bg** → Veo 3 via Flow (only if brief justifies)

For assets actually explored, save candidates under `docs/specs/hero-assets/<page>/candidates/` with provenance. Record "no generated asset needed" in the brief when existing product evidence and design tokens are sufficient.

### Step 4 — Asset selection

When generated assets are needed, show the relevant candidates side by side and record the selected asset and rationale in `docs/specs/hero-assets/<page>/manifest.yaml` using the normal interaction mode. If none are needed, record the reason in the brief and continue.

### Step 5 — Component Variant Generation

Explore meaningful alternatives for the page's consequential visual choices, especially the hero's message and product evidence, the primary CTA, and any trust or pricing surface the page actually needs. Include the existing treatment as an option during a brownfield iteration. A variant must change how the visitor understands, trusts, or acts on the product; recolors and decorative effects are not separate directions. Use only enough variants to expose the real tradeoff. Do not create empty trust bars, pricing tables, footer CTAs, or motion just to fill a component list.

Render design previews at shipping viewports where a preview is available; otherwise record what cannot yet be observed. Compare alternatives with relevant references and choose the direction that best supports the named conversion decision. Record the winner, why alternatives lost, the exact reference choice borrowed or rejected, and the expected user outcome in the brief. A simpler retained layout can win when evidence supports it.

Specify the chosen component layout, copy, product evidence, supported themes, responsive reflow, interaction states, and WCAG 2.2 AA/keyboard behavior in the brief. If motion is justified, specify existing motion tokens and a reduced-motion fallback. Hand this design to `design-tech` and `plan-changeset`; production component and page files are written by `execute-changeset` after plan review.

### Step 6 — Post-execution proof handoff

Record in the brief that `benchmark-landing` must score the actual rendered page at every shipping viewport after `execute-changeset` and `track-visuals`. The benchmark gate and deployed conversion-journey captures remain required before promotion; a design preview or source inspection cannot stand in for them. Any failure returns to the responsible design or implementation step and is revalidated.

### Step 7 — Handoff

Continue to applicable `track-visuals` baseline, `design-tech`, `plan-changeset`, `review-plan`, and then `execute-changeset` in normal lane order. Pass the named visitor decision, real-page comparisons, chosen design, affected ACs, supported themes/viewports, cheapest adequate component approach, and post-execution proof obligations. Do not claim a benchmark score or deployed result from a pre-execution design artifact.

## Hero Section Composition Contract

If the brief includes a hero section, specify its layout, typography, and components concretely. Specify motion only when the visitor's decision benefits from it; "none" is a valid motion choice. Vague directions like "premium polish" or "glass cards" are not implementation guidance.

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

### Layer 4 — Motion Behavior (only if chosen)
- State or product claim clarified by the motion
- Exact affected elements, duration, easing, and fallback for reduced motion
- No entrance or hover animation is required for a static composition

### Layer 5 — Component Specs
- Button specs (padding, radius, focus and disabled states)
- Product evidence and trust treatment, if needed for the visitor decision
- Any decorative treatment must have a stated purpose; none is required by default

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
- `docs/specs/hero-assets/<page>/manifest.yaml` — chosen assets + provenance, when applicable
- Implementation-ready component specification and any rendered design preview in the brief; production code is written after plan review

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Comparable captured marketing references identified | Market-gap report cites relevant page URLs/captures and why each serves the same visitor decision; benchmark's minimum captured anchors are available | |
| 1b | Selected anchors include below-fold evidence when relevant | Each selected `pattern.md` records the observed below-fold decision path or labels the unavailable capture | |
| 2 | Cross-sector references used only when relevant | Any selected high performer has a stated audience/decision match; none is required by quota | |
| 3 | Market-gap analysis tests user value | Report names current page, visitor decision, relevant reference evidence, and outcome for each proposed change or a reason to retain current | |
| 4 | Brief explains the page composition | Brief cites the relevant comparison and ties chosen hierarchy, product evidence, copy, and any assets to the visitor decision | |
| 5 | Copy: 3 variants generated, winner justified | `docs/specs/landing/<page>-brief.md` has Copy section with 3 variants and a `chosen: N because <reason>` line | |
| 6 | Chosen assets have comparison and provenance | For any selected asset, `docs/specs/hero-assets/<page>/provenance.yaml` records candidates considered, `provider:`, and product fit; mark not applicable if the page needs no generated asset | |
| 7 | Asset decision recorded when applicable | For any selected asset, `docs/specs/hero-assets/<page>/manifest.yaml` records the choice; otherwise mark no generated asset needed | |
| 8 | Meaningful visual alternatives judged | Brief records alternatives or a reason to retain current, available rendered preview comparison, and user-outcome rationale; no variant quota | |
| 9 | Implementation scope is bounded | Brief names the smallest expected component/page change; production source edits wait for reviewed `execute-changeset` | |
| 10 | Rendered benchmark obligation handed off | Brief names `benchmark-landing` after execution at all shipping viewports, with the applicable gate before promotion; pre-execution score is not claimed | |
| 11 | Iteration comparison handed off | If revising a shipped page, brief identifies predecessor and requires rendered before/after comparison in the post-execution benchmark | |
| 12 | Stack constraints preserved | Brief specifies existing components/tokens and explains any proposed dependency for plan review | |
| 13 | **Live marketing-page proof required after execution** (Phase Z) | Brief hands off supported-theme/viewport captures and observed conversion journey as promotion evidence; no pre-execution completion claim | |
| 14 | **Live eyeball checklist handed off** (Phase Z) | Brief cites `_shared/live-evidence.md` for post-execution checks of raw-text leaks, layout, contrast, supported-theme accents and product evidence | |
| 14b | Implemented motion validator handed off | Brief requires `node scripts/validate-motion-pattern-usage.mjs` on changed visual files after execution if motion is used; no-motion pages record not applicable | |
| 15 | Brief declares lifecycle stage with evidence | `grep "project_lifecycle:" docs/specs/landing/<page>-brief.md` returns the block, with `stage:`, `evidence:`, `paying_customers:`, `production_data_available:`, `primary_traffic_source:` | |
| 16 | Each recommendation tagged with lifecycle_compatibility | `grep -c "lifecycle_compatibility:" docs/specs/landing/<page>-brief.md` returns a count ≥ `grep -cE "^  - name:" docs/specs/landing/<page>-brief.md` | |
| 17 | No `blocked_at_pre_launch` recommendations present when stage is pre-launch (or override justified inline) | `grep -n "blocked_at_pre_launch: true" docs/specs/landing/<page>-brief.md` → for each match, verify `sed -n "<match_line>,<match_line+3>p"` contains "Override:" or "override_justification" | |

## Phase Z — Live marketing-page verification (post-execution promotion gate)

After implementation and before promotion is declared done, capture the **deployed** landing page at shipping viewports in each supported theme via Playwright, observe the primary conversion journey, and run the eyeball checklist in `_shared/live-evidence.md`. **No applicable live capture, no done.** Do not invent a dark-theme requirement for a product that does not support it.

Output: `docs/specs/landing-page/in-app-verification/landing-<theme>-<viewport>.png` (use the existing filename convention where required by the capture helper). If the implemented page uses motion, run `node scripts/validate-motion-pattern-usage.mjs <changed visual files>` against the actual changed visual paths after execution, verify reduced-motion behavior, and attach its result with the live evidence. A static page records motion validation as not applicable.

Hard-fails (raw text leak, palette or contrast mismatch, broken supported-theme swap, stale asset, or unusable conversion action) loop back to `references/iteration-loop.md`. Benchmark score ≥ 7.5 alone is **not sufficient** — the deployed screen and journey are the truth-teller.

Origin: 2026-04-30 Example Marketplace run shipped a logo-swap that bundle-grep + build all PASSED while the live page rendered raw JSX text in the top-left. The benchmark score was high. Only live capture caught it.

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-PreconditionsAndReferenceBanks --evidence file:references/landing-bank/<sector>/INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-MarketGapAndShipReadiness --evidence file:docs/specs/landing/<page>-market-gap.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-LifecycleClassifiedBrief --evidence file:docs/specs/landing/<page>-brief.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CopyAndAssetCandidates --evidence file:docs/specs/landing/<page>-brief.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-HumanCheckpointAndManifest --evidence file:docs/specs/landing/<page>-brief.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ComponentVariantsAndScaffold --evidence file:docs/specs/landing/<page>-brief.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-PostExecuteProofHandoff --evidence file:docs/specs/landing/<page>-brief.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-HandoffAndSelfVerify --evidence command_output:.svc/landing-page-self-verify-<WI>.log
```

If a page is blocked before implementation, still record the reached phase with
the blocking artifact, for example the missing-bank report, failed
ship-readiness verdict or missing design evidence. Do not mark the task `completed` until every required pre-execution phase receipt is present or a framework-approved skip/blocker receipt explains why it could not run. The later `benchmark-landing` task and Phase Z capture supply rendered proof; their absence before implementation is not a landing-page failure.

## References

- `_shared/live-evidence.md` — canonical capture pattern + checklist (referenced by Phase Z above)
- `references/reference-bank-capture.md` — Playwright recipe to build the bank
- `references/asset-class-routing.md` — which provider for which asset class
- `references/motion-patterns.md` — premium scroll-reveal, spring physics, stagger, and motion budget rules
- `references/iteration-loop.md` — failure-driven retry rules
- `references/recommendations-by-lifecycle.md` — which CRO levers apply at which lifecycle stage (lifecycle-stage gate)

## Lane integration

- Runs after `design-ui` and before applicable `track-visuals`, `design-tech`, `plan-changeset`, `review-plan`, and `execute-changeset` for any WI tagged `landing` / `marketing-page` / `home-page` / `pricing-page` / `feature-page`
- For greenfield: `design-ui` produces the design-system + UX direction, then `landing-page` specifies the marketing page for the normal technical design and reviewed execution lane
- For brownfield iter (e.g. Example Marketplace WI-088 iter2): can be invoked standalone, reading existing constraint-matrix.md as input

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work

### Standalone mode (no active task graph)

**Next:** hand the brief and any rendered preview to applicable `track-visuals` baseline, then `design-tech`, `plan-changeset`, `review-plan`, and `execute-changeset` in lane order. After execution, run `benchmark-landing` on the rendered page and verify the deployed conversion journey before promotion. If invoked directly, show the brief and current design evidence; do not present an unrun benchmark as passing.
