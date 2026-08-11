# Google AI Pro — CAPABILITIES (Layer 2)

**Version:** 2026-04-25
**Source type:** Closed-source consumer subscription (€21.98/€19.99/$19.99/mo, formerly Google One AI Premium / Gemini Advanced)
**Renewal cadence:** Monthly auto-renew unless cancelled
**Trial available:** Yes — typically 1 month free for new accounts

## What Google AI Pro is

A bundled consumer subscription giving "higher access" to Google's AI products plus 5 TB cloud storage. Replaces and extends the previous "Gemini Advanced" tier. Sits between **AI Plus** ($7.99) and **AI Ultra** ($249.99). Quotas are model-by-model and product-by-product — there is NOT one global "Pro pool."

As of 2026-04, Pro doubled storage 2TB → 5TB at no price increase, and added GDP (Google Developer Program) Premium benefits including monthly Cloud credits.

## Capabilities

| Surface | What Pro unlocks | Detail file |
|---|---|---|
| **Gemini 3.1 Pro** | 100 Pro prompts/day + 300 Thinking prompts/day (independent pools, doubled in 2026) | [chat-and-deep-research.md](details/chat-and-deep-research.md) |
| **Deep Research** | 20 reports/day (~600/mo); free tier gets 5/MONTH | [chat-and-deep-research.md](details/chat-and-deep-research.md) |
| **Search AI Mode** | Gemini 3 Pro in AI Mode + Deep Search | [search-integration.md](details/search-integration.md) |
| **Productivity** | Gemini in Gmail/Docs/Sheets/Slides + Gmail AI Overview (US) | [productivity-suite.md](details/productivity-suite.md) |
| **Veo (video)** | ~3 Veo 3 Fast/day in Gemini app (~90/mo) + ~2 full Veo 3 via Flow's 100 credits/mo | [generation-veo-flow.md](details/generation-veo-flow.md) |
| **Image gen** | Nano Banana Pro higher access | [generation-veo-flow.md](details/generation-veo-flow.md) |
| **NotebookLM** | 100 sources/notebook + early features (vs 50 free); audio overviews limited | [notebooklm.md](details/notebooklm.md) |
| **AI Studio** | Tier 1 paid: 250 RPD on preview models like Gemini 3 Pro | [developer-tools.md](details/developer-tools.md) |
| **Gemini CLI** | Higher limits on top of free 60 RPM / 1000 RPD | [developer-tools.md](details/developer-tools.md) |
| **Gemini Code Assist** | Higher quotas in IDE extension | [developer-tools.md](details/developer-tools.md) |
| **Google Antigravity** | Built-in credits + higher model access (exact amount not publicly documented; pay-as-you-go @ $0.01/credit beyond) | [developer-tools.md](details/developer-tools.md) |
| **Jules (async agent)** | **100 tasks/day + 15 concurrent** (free: 15/day, 3 concurrent) | [developer-tools.md](details/developer-tools.md) |
| **GDP Cloud credits** | $10/month Google Cloud credits (claim via developers.google.com/program/my-benefits → activate) | [developer-tools.md](details/developer-tools.md) |
| **Storage** | 5 TB across Drive/Gmail/Photos | [storage-family-extras.md](details/storage-family-extras.md) |
| **Family** | Share with up to 5 others (note: GDP credits per-user under verification) | [storage-family-extras.md](details/storage-family-extras.md) |
| **Google Home Premium Standard** | Free $10/mo value — 30-day event history + Gemini features | [storage-family-extras.md](details/storage-family-extras.md) |
| **Context window** | 1M tokens (free: 32K, Plus: 128K) | [chat-and-deep-research.md](details/chat-and-deep-research.md) |

## What Pro does NOT include

| Feature | Tier required |
|---|---|
| Deep Think (advanced reasoning mode) | Ultra ($249.99) |
| Gemini Agent (autonomous multi-step, US only) | Ultra |
| Veo 3.1 highest tier (~2,500 videos/mo via Flow) | Ultra |
| 30 TB storage | Ultra |
| YouTube Premium bundled | Ultra |
| Google Home Premium Advanced | Ultra |

## svc-stack comparison

vs the builder's existing paid stack — see [svc-stack-comparison.md](details/svc-stack-comparison.md).

**Headline:** the chat/coding LLM portion of AI Pro is **largely redundant** (Claude Max already covers STRAT/PLAN/EXEC; Codex covers GPT path). The **unique value** is concentrated in:
1. **Deep Research** — 600 reports/mo is genuinely irreplaceable from anywhere else in the stack
2. **Veo + Flow** — only video generation source the builder pays for
3. **NotebookLM** — only doc-aggregation/audio-overview tool
4. **Antigravity + Jules** — distinct agent platforms (some duplicate Claude Code, some don't)
5. **5 TB storage + Google Home Premium** — non-AI value floor

## Decision framing for capability-concierge

| Lens | Signal |
|---|---|
| **Idle-resource** | Trial currently free (~25 days remaining). At €21.98/mo post-trial. **Cancel before trial expires UNLESS** Veo/Deep Research/NotebookLM are actively used by month end. |
| **Side-earning** | Veo + Flow video stockpile (parallel to MiMo TTS stockpile play). Combined with MiMo TTS-VoiceClone + VoiceDesign = full audio+video content factory while both windows are free/cheap. |
| **Ship-current-project** | Deep Research can fast-track research-heavy WIs; NotebookLM can absorb large doc dumps for example-marketplace migration planning. |

## Volatility / staleness

- Limits change frequently (Google reduced Gemini API free quota by 50–92% on 2025-12-07; April 2026 brought a doubling of Thinking prompts and 2TB→5TB storage upgrade).
- Re-verify quotas every 30 days per `references/knowledge-protocol.md`.
- Source URLs in `details/*.md` files include the dates they were verified.
