# Provider: Stitch MCP — Branded UI mockups (editable)

**Status:** Available via `mcp__stitch-builtin__*` tools (Google Stitch is exposed as a built-in MCP in Claude Code / Codex)
**Auth requirement:** No additional auth — built-in
**Cost:** Free during preview; counts against Google account

## What it produces

- Editable UI screen mockups (not flat PNGs — opens in Stitch canvas for follow-up edits)
- Variant generation from a single design system
- Outputs in Stitch's project model — must be exported via `mcp__stitch-builtin__edit_screens` or downloaded from the canvas

## Invocation pattern

```
mcp__stitch-builtin__create_project(name="<slot>")
mcp__stitch-builtin__create_design_system(brand_context...)
mcp__stitch-builtin__generate_screen_from_text(
  project_id=...,
  prompt="<class+style+brand from brief>",
  count=<brief.count>
)
```

For brand-consistent variants of an existing screen:
```
mcp__stitch-builtin__generate_variants(screen_id=..., count=N)
```

## When to use vs codex CLI

- **Use Stitch when:** the asset is a UI mockup the user will iterate on (signup screen, dashboard mock, settings page) — editability matters
- **Use codex when:** the asset is a final flat image (hero photo, landing background) — codex is faster and produces shippable PNG

## When NOT to use

- Animated/video → Veo 3 / Flow
- Photoreal lifestyle → codex CLI
- Already-shipped UI → Playwright capture (`track-visuals`)

## Cross-references

- Tool definitions: live in `mcp__stitch-builtin__*` namespace
- `skills/generate-visuals/SKILL.md` matrix — Stitch is primary for "Branded UI mockup (editable)"
