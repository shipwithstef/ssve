# Codex CLI — CAPABILITIES (Layer 2)

**Version:** 2026-04-26
**Source type:** Closed-source vendor (OpenAI / ChatGPT)
**Sub-agent used for extraction:** in-session probe during Example Marketplace WI-116 landing iter2

## What Codex CLI is

`codex` is OpenAI's CLI for the ChatGPT-Plus / ChatGPT-Pro subscription. It uses the user's **ChatGPT id_token** for auth (NOT an `OPENAI_API_KEY`), and exposes a constrained set of tools that include — critically — a working **internal `generate_image` tool** that produces 16:9 1672×941 PNGs and saves them to `~/.codex/generated_images/<session>/`.

Auth file: `~/.codex/auth.json` — has `OPENAI_API_KEY: None` plus `tokens.{id_token, access_token, refresh_token, account_id}`. The OPENAI_API_KEY field is ALWAYS null for ChatGPT-sub users; do NOT try to extract it for direct OpenAI API calls.

## Authorized usage surface

| Use | Authorized? | Notes |
|---|---|---|
| `codex exec --sandbox workspace-write "..."` for code edits | ✅ | Standard usage |
| `codex exec` invoking internal `generate_image` tool | ✅ | The model decides to call it when prompt asks for images. Output to `~/.codex/generated_images/`. Cost = standard ChatGPT-sub message; no separate API charge. |
| Routing svc EXEC label via codex | ✅ | per `references/model-routing.md` |
| Direct OpenAI API calls with extracted token | ❌ | id_token is not an OpenAI API key; calls 401 |
| Production app traffic through codex CLI | ❌ | ChatGPT-sub ToS — interactive/dev tooling only |

## Image generation — the unblocking finding (2026-04-26)

During WI-116 (Example Marketplace landing iter2 photoreal hero) the agent searched for a working image-gen surface across:

| Provider attempted | Result |
|---|---|
| `gemini` CLI | ❌ no native `generate_image` tool — only read/search/web |
| Imagen 4 via Gemini OAuth (`aiplatform.googleapis.com`) | ❌ 403 PERMISSION_DENIED — consumer project not assigned |
| `gemini-2.5-flash-image` via `generativelanguage.googleapis.com` with OAuth bearer | ❌ ACCESS_TOKEN_SCOPE_INSUFFICIENT |
| OpenAI `/v1/images/generations` direct | ❌ codex auth has no API key (OPENAI_API_KEY: None) |
| Vertex via service account / API key | ❌ none configured for builder |
| **`codex exec` with image-asking prompt** | ✅ **WORKED** — produced 1672×941 PNG in ~90s |

**Conclusion: codex CLI is the working image-gen surface for any builder who has a ChatGPT-Plus or ChatGPT-Pro subscription.** This was previously unknown to the framework.

## Recipe — how to invoke from svc

```bash
# Single-image generation, save to repo
codex exec --skip-git-repo-check --sandbox workspace-write --cd "$REPO" "$PROMPT"
# where $PROMPT explicitly tells codex:
#   1. Generate ONE photorealistic image at 16:9
#   2. Save the output PNG to docs/specs/hero-assets/<slot>/candidates/codex-N.png
#   3. The model will call its internal generate_image tool, write to
#      ~/.codex/generated_images/<session>/ig_*.png, then `cp` to the repo path
```

Multi-image generation in a single `codex exec` is unreliable in the 180s timeout window — generate ONE per call, parallelize with multiple `codex exec` invocations if needed.

## Image-gen behaviour observed

- Output format: PNG, ~1672×941 (close to but not exactly 16:9)
- Session storage: `~/.codex/generated_images/<uuid>/ig_<hash>.png`
- File size: ~2MB raw PNG (compresses to ~110KB WebP at q80)
- Latency: ~60-120s end-to-end including reasoning + cp
- Style adherence: high — respects "photoreal", "editorial", "no stock-photo cliché", "no smiling-headset" instructions
- Negative-prompt support: yes (encode as "AVOID:" or "NOT" in the prompt)

## Routing impact for svc

Per `generate-visuals/SKILL.md` provider matrix, **codex moves to PRIMARY** for these asset classes when the builder has a ChatGPT-Plus/Pro sub:

| Asset class | Old primary | New primary |
|---|---|---|
| Photoreal hero / lifestyle | Gemini Nano-Banana Pro (manual) | **codex CLI** (programmatic) |
| Branded mockups / icons | Stitch MCP | codex CLI when budget allows; Stitch MCP for in-canvas-editable |
| Quick iteration / variants | MiMo (dev-only ToS) | codex CLI |

Gemini Nano-Banana Pro stays as fallback for builders without ChatGPT-sub.

## Limitations / gotchas

- **No batch endpoint** — each image is one `codex exec` call (~$0.10-0.30 of the ChatGPT message budget by reasoning tokens; verify against current ChatGPT-Plus quotas)
- **No video** — codex internal tools don't include Sora yet (as of 2026-04-26 probe)
- **Aspect-ratio is approximate** — 1672×941 is "close to 16:9", not exact. Always crop/pad to exact target via `convert` post-step.
- **Path handling** — codex needs the repo `--cd` flag to find the target path; without it, writes land elsewhere.
- **Single-prompt single-image** — multi-image prompts work but timeout often. Parallelize via multiple `codex exec` calls.

## Cross-references

- `generate-visuals/SKILL.md` — provider matrix (codex primary for photoreal as of v1.1)
- `generate-visuals/references/providers/codex-image.md` — invocation recipe
- `references/model-routing.md` — routing labels (codex eligible for SENSE-image)
- `references/framework-learnings.jsonl` — entry `codex-cli-is-image-gen-surface` (confidence 9, sourced from this run)
