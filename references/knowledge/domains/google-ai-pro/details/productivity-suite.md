# Productivity Suite (Gmail / Docs / Sheets / Slides)

## Mechanism

Gemini integration inside Google Workspace consumer apps. Pro tier unlocks **full** integration; Plus tier gives "almost nothing" beyond basic Gmail spell-check.

## Capabilities (Pro)

| Surface | What's available |
|---|---|
| **Gmail** | Compose with Gemini, summarize threads, **AI Overview of inbox** (US only) |
| **Docs** | Write/proofread/rewrite, generate, table-of-contents, transformations |
| **Sheets** | Formula generation, table generation from prompt, "help me organize" |
| **Slides** | Image gen for slides, layout suggestions |
| **Notebooks (in Gemini app)** | NotebookLM-class document grounding directly in Gemini app — see notebooklm.md |

## What svc-stack lacks today

This is one of the **few categories where Google AI Pro is genuinely unique** vs Claude Max + Codex + MiMo. Claude has Computer Use but no native Gmail/Docs/Sheets fluency; Codex has no consumer-app integration; MiMo doesn't touch Workspace.

Practical implications:
- Email/document drafting with full thread context happens inside Gmail directly
- Spreadsheet automation can be invoked without context-shifting to a CLI
- Useful for **non-coding work** the builder still has to do (admin, marketing, ops)

## L4 pointers

- [Use Google AI Pro benefits](https://support.google.com/googleone/answer/14534406)
- [Compare AI plans (Workspace)](https://knowledge.workspace.google.com/admin/getting-started/editions/compare-google-ai-expansion-add-ons)
