# Provider: Claude Design — External Canvas Handoff (Live HTML hero)

**Status:** Beta — separate budget from Claude Max; check `~/.svc/capabilities/registry.json` for current credit balance
**Auth requirement:** Claude account with Design beta access
**Cost:** Separate from Claude Max message budget — check before invoking

## What it produces

- Interactive HTML/CSS/JS prototype rendered live in Claude's design canvas
- Real components (not flat mockups) — useful when the brief is "let me see what an interactive hero would feel like"
- Exportable as static HTML once accepted

## When to use

The asset class is **"Live HTML hero (interactive prototype)"** — the user wants to feel the page move (hover states, scroll behaviors, microinteractions) before committing to a design direction. Flat PNG can't deliver that.

Use as alternative to v0 when v0 isn't available or the user wants Claude-native iteration.

## Invocation pattern

Claude Design uses the External Canvas Handoff protocol per `design-ui` Step B (see `skills/design-ui/SKILL.md`). The skill writes a brief to `docs/specs/design-ui/canvas-brief-<slot>.md`, then opens the Design canvas. Output lives in `docs/specs/design-ui/canvas-outputs/<slot>/`.

```
# In the design-ui flow:
1. Write canvas brief
2. User opens Claude Design with the brief
3. Iterate in canvas
4. Export accepted variant to docs/specs/design-ui/canvas-outputs/<slot>/
5. generate-visuals records provenance
```

## When NOT to use

- One-shot photoreal hero → Codex CLI (faster, no canvas back-and-forth)
- Editable UI mockup (not interactive) → Stitch MCP
- Animation needed → Veo 3 / Flow

## Cross-references

- `skills/design-ui/SKILL.md` Step B — full Canvas Handoff protocol
- `skills/generate-visuals/SKILL.md` matrix — Claude Design is primary for "Live HTML hero"
