# Provider: Veo 3 via Flow — Hero motion / B-roll video

**Status:** Available with Gemini Pro plan via Flow (Google's video-generation product)
**Auth requirement:** Gemini Pro subscription with Flow access
**Cost:** Counts against Gemini Pro plan; Flow has separate per-clip cost (verify current rate)

## What it produces

- 5-10 second video clips, 1080p, h.264 mp4
- Cinematic prompts (camera moves, lighting changes, motion timing)
- Style-adherent (won't drift to AI-slop bokeh if AVOID clauses are in prompt)
- Can be looped for hero backgrounds OR used as one-shot B-roll

## When to use

The asset class is **"Hero motion / B-roll video"** — landing page hero needs subtle motion (steam rising from coffee, customers walking past storefront, leaves moving), or marketing needs short B-roll clips for social posts.

For programmatic / repeatable motion (loading spinners, micro-animations) prefer **Remotion** (code-driven) — Veo is for organic / cinematic motion, Remotion is for deterministic.

## Invocation pattern (manual — no API surface from svc as of 2026-04-26)

1. Open Flow at [labs.google.com/flow](https://labs.google.com/flow) (Pro plan required)
2. New project → write the prompt: include camera move, subject, mood, AVOID clauses
3. Generate (5-10s clip, ~60-180s wait)
4. Download mp4 → save to `docs/specs/hero-assets/<slot>/candidates/veo-N.mp4`
5. Optionally extract poster frame for fallback `<video poster="...">` :
   ```bash
   ffmpeg -i veo-1.mp4 -vframes 1 -ss 0.5 veo-1-poster.jpg
   ```
6. Update `provenance.yaml`:
   ```yaml
   - file: veo-1.mp4
     provider: veo-3-via-flow
     invoked_via: manual-flow-app
     duration_sec: 8
     license_ok: true     # check Flow's current commercial-use clause for your tier
     poster_frame: veo-1-poster.jpg
   ```

## When NOT to use

- Static hero → Codex CLI
- Programmatic animation (consistent rendering needed) → Remotion (code-driven)
- Long-form video (>10s) → not Veo's strength; consider editing multiple clips
- Need to script API call → no svc-callable path yet for Veo

## Cross-references

- `skills/generate-visuals/SKILL.md` matrix — Veo 3 primary for "Hero motion / B-roll video"
- Remotion skill (`remotion`) for code-driven animation alternative
