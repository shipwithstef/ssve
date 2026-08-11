# Provider: Gemini Nano-Banana Pro / Imagen 4 — Photoreal hero (manual handoff)

**Status:** Manual handoff only — no svc-callable API path as of 2026-04-26
**Auth requirement:** Gemini Pro subscription (for Nano-Banana Pro UI access); separate API key for Imagen 4
**Cost:** Counts against Gemini Pro plan; Imagen 4 paid per-image via Google Cloud Vertex API

## Why this is fallback, not primary

Codex CLI was promoted to primary for photoreal in 2026-04-26 (Example Marketplace WI-116) because:
- `gemini` CLI has no native `generate_image` tool
- Imagen 4 via Gemini OAuth returns 403 (scope-insufficient)
- `gemini-2.5-flash-image` returns scope-insufficient
- The only working path is the Gemini app UI (not scriptable)

Use Nano-Banana Pro when the codex output isn't satisfying the photoreal brief (rare) and you're willing to do a manual paste-into-app flow.

## Invocation pattern (manual)

1. Open Gemini app → New chat → Switch model to "Nano-Banana Pro" (Pro subscription required)
2. Paste prompt from brief, request 16:9 photoreal output
3. Download PNG, save to `docs/specs/hero-assets/<slot>/candidates/nano-banana-N.png`
4. Manually update `docs/specs/hero-assets/<slot>/provenance.yaml`:
   ```yaml
   - file: nano-banana-1.png
     provider: gemini-nano-banana-pro
     invoked_via: manual-gemini-app
     brand_fit: <user-rated>
     license_ok: true
   ```

## Imagen 4 (when API access exists)

If a project has `IMAGEN_API_KEY` set and proper Vertex AI scope:

```bash
# Vertex AI Imagen 4 endpoint — requires service account with aiplatform.user role
gcloud auth print-access-token | xargs -I{} curl -X POST \
  -H "Authorization: Bearer {}" \
  -H "Content-Type: application/json" \
  -d '{"instances":[{"prompt":"<from brief>"}],"parameters":{"sampleCount":1}}' \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/$PROJECT/locations/us-central1/publishers/google/models/imagegeneration:predict"
```

This path requires GCP project setup beyond what the framework provisions automatically.

## When NOT to use

- Default for photoreal → Codex CLI
- Editable UI → Stitch MCP
- Anything urgent → Codex CLI (no manual app context-switch)

## Cross-references

- `skills/generate-visuals/SKILL.md` matrix — Nano-Banana / Imagen 4 listed as fallback for photoreal
- `references/framework-learnings.jsonl` — entry `codex-cli-is-image-gen-surface` explains why this is fallback
