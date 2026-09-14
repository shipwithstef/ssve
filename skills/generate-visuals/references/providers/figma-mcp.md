# Provider: Figma MCP + Weave — Brand variants of existing UI

**Status:** Available via `mcp__figma__authenticate` + `mcp__claude_ai_Figma__use_figma`
**Auth requirement:** Figma account with API access; OAuth flow on first use
**Cost:** Figma plan dependent (Pro for unlimited Weave calls)

## What it produces

- Brand-token-applied variants pulled from your existing Figma design system
- Diagrams (architecture, flow, sequence) via `generate_diagram`
- Live edits to existing files (not just mockup generation)

## When to use

The defining property: you already have a Figma file with brand tokens (colors, typography, components). Figma MCP applies those to new screens with full token-respect — outputs match the brand without prompt-engineering.

If the project doesn't yet have a Figma file, prefer Stitch MCP (no setup) or Codex CLI (no design-system needed).

## Invocation pattern

```
# First time: authenticate
mcp__figma__authenticate()
# Then complete OAuth, retrieve tokens
mcp__figma__complete_authentication(...)
```

For Weave generation (brand-token variants):
```
# Use the Claude Figma MCP wrapper which composes use_figma + Weave
mcp__claude_ai_Figma__use_figma(...)
```

For diagrams:
```
# Standard Figma MCP exposes generate_diagram for architecture/flow/sequence
generate_diagram(type="flow", description="...")
```

## When NOT to use

- No existing Figma project → Stitch MCP
- Photoreal subject (no UI involved) → Codex CLI
- Animated → Veo 3

## Cross-references

- `skills/generate-visuals/SKILL.md` matrix — Figma MCP primary for "Branded variants of existing UI" + "Diagrams"
- For project setup: Figma's MCP getting-started flow
