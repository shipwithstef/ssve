# NotebookLM (Pro tier)

## Mechanism

NotebookLM is Google's grounded-AI tool — upload sources (PDFs, URLs, Google Docs, audio, video) into a "notebook," then chat with the model bounded by those sources. Generates audio overviews, mind maps, briefing docs. Recently merged into the Gemini app (notebooks now appear inside Gemini directly).

## Pro-tier limits (2026-04-25)

| Feature | Pro | Free | Ultra |
|---|---|---|---|
| **Sources per notebook** | **100** | 50 | 600 |
| Generations limit (audio overviews etc.) | **2x free** (doubled) | base | highest |
| **Audio overviews / day** | partial — exact cap not published; community reports ~3/day | very limited | included with Ultra |
| Early access to new features | yes | no | yes |
| Notebook integration in Gemini app | yes | yes (limited) | yes |

## Practical implications for example-marketplace migration

NotebookLM at 100 sources/notebook is enough to absorb the **entire docs corpus** of a single project. Concrete use case: ingest example-marketplace's existing Base44 docs + svc tech-design.md + relevant work-items → generate a "what would migration off Base44 look like" briefing in one call.

This is the kind of scope-aggregating task that Claude Code and Codex are not built for — they're optimized for code, not multi-doc synthesis.

## L4 pointers

- [NotebookLM Help — upgrade page](https://support.google.com/notebooklm/answer/16213268)
- [Subscription page](https://gemini.google/subscriptions/)
- [Gemini + NotebookLM merge announcement](https://www.xda-developers.com/gemini-notebooklm-update/)
