# Provider: Storyset — Free branded illustrations

**Status:** Free CDN; no auth required for browse; **attribution required for free-tier outputs**
**Auth requirement:** None for browsing; account required to download attribution-stripped versions
**Cost:** Free tier requires attribution link in footer; paid tier (~$10/mo) removes that requirement

## What it produces

- Animated SVG illustrations (loop or one-shot)
- Static SVG illustrations
- Editable color palette (per-illustration; lets you re-skin to brand palette)
- Categories: business, communication, design, education, food, health, marketing, music, nature, people, sports, technology, travel

## When to use

The asset class is **"Branded illustrations"** — vector, friendly-style, used for empty-state graphics, onboarding screens, error pages, and feature-highlight sections. Storyset's house style is "rounded-figure flat" — fits trustworthy/playful brands; doesn't fit serious-enterprise brands.

For brand-fit beyond Storyset's house style, use Codex CLI with style instructions in the prompt.

## Invocation pattern (manual — no API)

1. Browse [storyset.com](https://storyset.com) for the right illustration class
2. Click "Edit illustration" → re-skin colors to match `brief.brand_context.palette`
3. Download SVG → save to `docs/specs/hero-assets/<slot>/candidates/storyset-N.svg`
4. **If license: production-marketing**: confirm attribution path is wired in the destination page (footer link to Storyset). If attribution is unacceptable for the use case, the free-tier license is violated — must use paid tier or different provider.

## License gate

```yaml
# In provenance.yaml
- file: storyset-1.svg
  provider: storyset
  invoked_via: manual-storyset-app
  license: free-tier-with-attribution  # vs paid-tier-no-attribution
  attribution_url: https://storyset.com
  brand_fit: 8
  license_ok: true                      # only true if attribution is wired or paid tier
```

If `attribution_url` is set but the page can't show it, set `license_ok: false` and route to fallback.

## When NOT to use

- Photoreal needed → Codex CLI / Nano-Banana
- Strict-enterprise brand → Codex CLI with style direction
- Animation more complex than loop → Veo 3
- Custom illustration style → fork an existing Storyset SVG and edit, or commission

## Cross-references

- `skills/generate-visuals/SKILL.md` matrix — Storyset primary for "Branded illustrations"
- License-aware capability gate from `references/knowledge/launch/credit-programs/` patterns
