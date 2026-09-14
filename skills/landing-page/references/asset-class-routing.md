# Asset Class Routing — landing-page → generate-visuals

`landing-page` doesn't generate assets directly. It synthesizes a brief per asset slot, then delegates to `generate-visuals` which routes to the right provider (Codex CLI / Stitch MCP / Figma MCP / Storyset / etc.).

This doc defines:
1. Which **slots** every landing page has
2. Which asset **class** maps to each slot
3. How the brief is constructed per slot

## Standard slots per landing page

| Slot | Class | Typical brief.style fragment | Required? |
|---|---|---|---|
| `hero-background` | `photoreal-lifestyle` or `live-html-hero` | "warm-{brand-tone}, {subject from brief}, {viewport}" | ✓ always |
| `hero-foreground-mockup` | `branded-ui-mockup` | "{product name} dashboard mockup, {color palette}" | optional (skip for service businesses) |
| `feature-illustrations` | `branded-illustrations` | "{n} flat illustrations for {feature 1, 2, 3}" | optional |
| `trust-bar-logos` | `existing-assets` (no generation) | "{customer logo names}" | sourced from `docs/specs/marketing-context.md` |
| `pricing-comparison-graphic` | `branded-ui-mockup` | "comparison table mockup, brand-toned" | only on pricing pages |
| `motion-hero-loop` | `hero-motion-video` | "5-8s ambient loop of {scene}, {camera move}" | optional, B-roll for trust |

## Per-slot brief construction

For each slot present, `landing-page` writes a brief at `docs/specs/hero-assets/<page>/<slot>/brief.yaml` using the schema from `skills/generate-visuals/references/brief-format.md`. Fields populated:

- `slot`: the row name above
- `class`: the row's class
- `style`: synthesized from brand_context + the chosen archetype's pattern.md
- `count`: 3 (for shipping landing) or 1 (for sketch / preview)
- `brand_context`: pulled from `docs/specs/marketing-context.md` `brand` block
- `viewport`: derived from device-tier (1920×1080 for desktop hero, 1242×2688 for mobile-first)
- `license`: always `production-marketing`

## Provider routing happens INSIDE generate-visuals

`landing-page` doesn't pick the provider. After writing the brief, it calls `generate-visuals` which consults its own provider matrix (`skills/generate-visuals/SKILL.md`). The matrix is the single point of truth for "which provider for which class" and is maintained as providers are added/deprecated.

This indirection means: **when a new provider arrives (e.g. Veo 4), only `generate-visuals` updates** — `landing-page` doesn't need to change.

## Iteration handling

If a candidate set is rejected (Self-Verify check #4 fails — provenance shows brand_fit < 7 for all candidates), `landing-page` modifies the brief (clearer style, stricter forbid list) and re-invokes `generate-visuals` for that slot only. It does NOT re-invoke for slots that passed.

## Skip rules

A slot is skipped silently when:
- `marketing-context.md` declares the slot N/A for this product (e.g. service business → no `pricing-comparison-graphic`)
- The page being shipped doesn't include the surface (e.g. feature-page doesn't need `pricing-comparison-graphic`)

A slot is NEVER skipped when present in the brief — if generation fails for all providers in a slot, `landing-page` blocks at Self-Verify #4 and surfaces the failure. Silent slot-skipping is a Self-Verify violation.
