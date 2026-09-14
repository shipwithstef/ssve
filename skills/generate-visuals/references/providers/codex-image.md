# Provider: Codex CLI — image generation

**Status:** Production-validated 2026-04-26 (Example Marketplace WI-116)
**Auth requirement:** ChatGPT-Plus or ChatGPT-Pro subscription, signed in via `codex` CLI
**Cost:** Counts against ChatGPT-sub message budget (no separate API charge)

## What it produces

- Photoreal images, ~1672×941 PNG, ~2MB raw
- Style-adherence: high — respects "photoreal", "editorial", "no stock-photo cliché", "avoid X"
- Negative prompts: supported via "AVOID:" / "NO" / "NOT" tokens in the prompt
- Single-image-per-call is reliable; multi-image-per-call hits 180s timeout

## Invocation pattern

```bash
PROMPT='Generate ONE photorealistic 16:9 hero image and save it to <ABSOLUTE_REPO_PATH>/docs/specs/hero-assets/<slot>/candidates/codex-1.png. Subject: <subject>. Lighting: <lighting>. AVOID: smiling-headset poses, stock-photo cliche, synthetic gradients, AI-slop bokeh.'

codex exec \
  --skip-git-repo-check \
  --sandbox workspace-write \
  --cd "$REPO_ABS_PATH" \
  "$PROMPT"
```

## Post-step: optimize for web

Codex output is a raw 2MB PNG. Optimize before shipping:

```bash
convert docs/specs/hero-assets/<slot>/candidates/codex-1.png \
  -resize 1920x1080^ -gravity center -extent 1920x1080 \
  -quality 80 \
  public/hero-storefront.webp

convert docs/specs/hero-assets/<slot>/candidates/codex-1.png \
  -resize 1920x1080^ -gravity center -extent 1920x1080 \
  -quality 82 \
  public/hero-storefront.jpg
```

Result: ~110KB WebP + ~244KB JPG, both 1920×1080.

## Parallelization

For multiple variants, fan-out via multiple `codex exec` calls in background (each ~90s):

```bash
codex exec ... "$PROMPT_VARIANT_2" > /tmp/v2.log 2>&1 &
codex exec ... "$PROMPT_VARIANT_3" > /tmp/v3.log 2>&1 &
wait
```

DO NOT pack multiple variants into one prompt — output frequently truncates at 180s.

## Output discovery

When codex finishes, it writes to `~/.codex/generated_images/<session-uuid>/ig_<hash>.png` THEN copies to the repo path. To find the latest output for debugging:

```bash
find ~/.codex/generated_images -name '*.png' -printf '%T@ %p\n' | sort -nr | head -3
```

## When NOT to use codex

- **Editable UI mockup needed:** use Stitch MCP — output is editable in Stitch canvas
- **Brand-token-applied variant:** use Figma MCP + Weave — pulls from existing design tokens
- **Animated/video:** codex doesn't have Sora exposed yet; use Veo 3 via Flow (manual)
- **Large batch (>5 assets):** consider Gemini Imagen 4 with proper API key (CodE Plus/Pro is per-message)

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| 401 / sign-in prompt | `~/.codex/auth.json` missing or expired | `codex login` interactively |
| Timeout at 180s with no PNG | Multi-image prompt | Split into separate calls |
| File saved to wrong dir | Missing `--cd` flag | Always use `--cd "$REPO_ABS_PATH"` |
| "no image tool available" | Old codex version (<2026-Q1) | `npm i -g @openai/codex-cli@latest` |

## Cross-references

- `references/knowledge/domains/codex/CAPABILITIES.md` — Layer 2 doc
- `skills/generate-visuals/SKILL.md` — provider matrix (codex primary for photoreal)
- `references/framework-learnings.jsonl` — entry `codex-cli-is-image-gen-surface`
