# Search Integration (Gemini in AI Mode)

## Mechanism

Google Search has an "AI Mode" that uses Gemini to synthesize search results into multi-paragraph answers with cited sources. Pro tier gives access to a more capable model (Gemini 3 Pro) and an enhanced "Deep Search" path.

## What Pro adds vs free

| Feature | Pro | Free |
|---|---|---|
| AI Mode model | **Gemini 3 Pro** | base Gemini 2.x model |
| Deep Search | **Included** — multi-step research from search box | not available |
| Higher daily access | Yes | rate-limited |

## When this matters for the svc stack

Mostly **redundant** with Deep Research (same use case: multi-source synthesis). The differentiator is integration point — Deep Research lives inside Gemini app, AI Mode + Deep Search live inside Search box. For a builder doing competitive analysis or market research, AI Mode is faster for one-shot queries; Deep Research is better for multi-page reports.

## L4 pointers

- [9to5Google feature breakdown](https://9to5google.com/2026/04/11/google-ai-pro-ultra-features/)
- [Apps limits & upgrades](https://support.google.com/gemini/answer/16275805)
