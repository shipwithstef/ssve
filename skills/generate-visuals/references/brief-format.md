# Asset Brief — Schema

The asset brief is the input contract for `generate-visuals`. Lives at `docs/specs/hero-assets/<slot>/brief.yaml`.

## Schema

```yaml
slot: hero-background           # named asset slot (also used in output paths)
class: photoreal-lifestyle      # row key in skills/generate-visuals/SKILL.md provider matrix
style: warm-golden-hour-cafe    # free-text style description fed to provider prompt
count: 3                        # candidate variants wanted
brand_context:
  palette: [terra-cotta, warm-cream, espresso]
  voice: trustworthy-warm-modern
  forbid: [stock-cliche, AI-slop-gradient, smiling-headset]
viewport: 1920x1080             # or aspect ratio like "16:9"
license: production-marketing   # constrains provider list (see below)
```

## Field reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `slot` | ✓ | kebab-case string | Becomes `<slot>` in output paths. Stable across regenerations |
| `class` | ✓ | string | MUST match a row key in the provider matrix. Validator fails if unknown |
| `style` | ✓ | string | Free-text descriptor passed to provider prompts |
| `count` | ✓ | integer 1-10 | More than 5 should use codex parallel (see provider docs) |
| `brand_context.palette` | optional | string[] | Hex codes or named tokens |
| `brand_context.voice` | optional | string | One short phrase |
| `brand_context.forbid` | recommended | string[] | Negative-prompt tokens; appears verbatim in `AVOID:` clause |
| `viewport` | ✓ | "WxH" or "W:H" | Determines aspect ratio + max resolution |
| `license` | ✓ | enum | `production-marketing` / `development-only` / `internal` |

## License values

| License | What's allowed | Excludes |
|---|---|---|
| `production-marketing` | Public-facing landing pages, paid ads, App Store screenshots | MiMo Token Plan outputs (ToS); unattributed Storyset (license-violation) |
| `development-only` | Internal mockups, design exploration, mood boards | n/a |
| `internal` | Slack screenshots, Loom thumbnails, internal docs | n/a |

## Validation

The brief is validated by the skill at Step 1 (Parse brief). A malformed brief returns immediately with the parse error; no provider invocation occurs.
