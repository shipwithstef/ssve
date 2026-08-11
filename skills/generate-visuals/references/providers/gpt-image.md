# Provider: gpt-image (OpenAI direct API)

**Status:** Available when project has a real `OPENAI_API_KEY` (not the auto-provisioned ChatGPT-sub flow)
**Auth requirement:** OpenAI API key with image-generation scope + org verification (required for all gpt-image-* models)

## Model selection (preference order)

1. **`gpt-image-2`** (PRIMARY — released 2026-04-21) — SOTA quality, 1K–4K output, up to 16 reference images, near-perfect multilingual text rendering. Default for all new invocations.
2. **`gpt-image-1.5`** (FALLBACK only) — use when `gpt-image-2` returns a model-unavailable / not-enabled-for-org error and you cannot wait for org verification on `-2`.
3. `gpt-image-1` / `gpt-image-1-mini` — legacy. Do not use for new work; kept here only because older provenance logs reference them.

Selection rule: try `gpt-image-2` first. On HTTP 404 / `model_not_found` / `model_not_available_to_organization`, retry once with `gpt-image-1.5`. Log the fallback in the candidate's `provenance.yaml`.

## Relationship to Codex CLI

Codex CLI uses an OpenAI image model internally via the ChatGPT subscription billing surface (per-message cost, no per-image charge). For ChatGPT-sub users, **prefer Codex CLI** (`codex-image.md`) — same model family, cleaner auth.

This direct-API path is for projects that:
- Have a separate OpenAI API key (e.g. company-owned, separate billing)
- Need to bulk-generate beyond ChatGPT-sub message budget
- Need precise cost attribution per image

## Invocation pattern

```bash
MODEL="gpt-image-2"   # primary
RESP=$(curl -s https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"prompt\": \"<from brief, including AVOID: clauses>\",
    \"size\": \"1024x1024\",
    \"quality\": \"high\",
    \"n\": 1
  }")

# On model-availability error, fall back to gpt-image-1.5 once
if echo "$RESP" | jq -e '.error.code | test("model_not_found|model_not_available")' >/dev/null; then
  MODEL="gpt-image-1.5"
  RESP=$(curl -s https://api.openai.com/v1/images/generations \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$MODEL\",\"prompt\":\"...\",\"size\":\"1024x1024\",\"quality\":\"high\",\"n\":1}")
fi

echo "$RESP" | jq -r '.data[0].url' | xargs curl -o "docs/specs/hero-assets/<slot>/candidates/${MODEL}.png"
```

For multiple variants: `n` up to 10 per request — but each is full-priced; parallel calls preferred for cost transparency.

## Cost-control note

Set `quality: "standard"` instead of `high` for early iterations; switch to `high` only for the chosen variant. Verify current PAYG rates on the OpenAI pricing page — `gpt-image-2` rates differ from the `-1` family.

## When NOT to use

- ChatGPT-Plus/Pro user with no separate OPENAI_API_KEY → use Codex CLI instead (free under sub)
- Need editable mockup → Stitch MCP
- Brand-token-applied UI → Figma MCP

## Cross-references

- `references/providers/codex-image.md` — same model family, different billing surface
- OpenAI image-generation pricing page (verify current rates per model)
