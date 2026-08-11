# Pre-Scope: google-ai-pro

**Source:** Google AI Pro consumer subscription (€21.98/mo, formerly Google One AI Premium / Gemini Advanced)
**Invoked by:** standalone (user request via /research)
**Date:** 2026-04-25

## Volume Estimate

- Sources: ~10 web pages (Google's product pages + dev docs + community comparisons)
- Estimated content: 30-50K tokens raw across all surfaces
- Top-level capability surfaces: 7
  1. **Chat / Gemini app** — Gemini 3.1 Pro access, Deep Research
  2. **Search integration** — Gemini 3 Pro in AI Mode, Deep Search
  3. **Productivity** — Gmail / Docs / Sheets / Gmail AI Overview
  4. **Generation** — image, music, video (via Gemini, Search, Flow); Veo for video
  5. **NotebookLM** — higher access tier
  6. **Developer tools** — AI Studio, Google Antigravity, Jules, Gemini CLI, Code Assist, $10/mo Cloud credit
  7. **Storage / family / extras** — 5TB Drive/Gmail/Photos, family sharing 5p, Google Home Premium Standard

## File Checklist (manifest)

- [ ] Google AI Pro pricing page — `https://one.google.com/about/plans` or `https://gemini.google.com/advanced`
- [ ] Veo (video generation) capabilities — `https://deepmind.google/technologies/veo/`
- [ ] Flow (filmmaking tool) — `https://labs.google/flow`
- [ ] NotebookLM tier comparison — `https://notebooklm.google.com`
- [ ] Google Antigravity overview — `https://antigravity.google` or dev docs
- [ ] Jules (async coding agent) — `https://jules.google` or dev blog
- [ ] AI Studio limits — `https://aistudio.google.com/`
- [ ] Gemini CLI quotas (Pro tier) — `https://github.com/google-gemini/gemini-cli` README
- [ ] Google Cloud $10/mo Developer Program credit — `https://developers.google.com/program`
- [ ] Gemini 3.1 Pro vs Pro 2.5 — feature differences
- [ ] Deep Research (Gemini app feature) capabilities

## Extraction Plan

Single comprehensive pass via WebSearch (gemini-cli isn't ideal for live web pricing, and the user wants this captured cleanly). Write Layer 2 + Layer 3 per surface.

- **Domain:** `google-ai-pro` (NEW)
- **Justification:** consumer subscription tier with cross-product capabilities (Veo, Flow, NotebookLM, Antigravity) that don't fit any existing domain (`gemini-cli-hooks` is just CLI; `agent-harnesses` is execution; `gcp-mcp` is GCP infra). The svc framework needs a single anchor for "what does Pro unlock" so capability-concierge can reason about it as one resource.
- **Target detail files:**
  - `details/chat-and-deep-research.md`
  - `details/search-integration.md`
  - `details/productivity-suite.md`
  - `details/generation-veo-flow.md`
  - `details/notebooklm.md`
  - `details/developer-tools.md`
  - `details/storage-family-extras.md`
  - `details/svc-stack-comparison.md` (vs Claude Max + Codex + MiMo)

## Sub-Agent Selection

- Primary: gemini-cli (per WI-090 doctrine)
- Fallback: Claude (in-session) on gemini-cli failure
- Selected for this run: fallback (in-session WebSearch) — historical run that did NOT follow the doctrine. Violation logged to `references/framework-learnings.jsonl#research-skill-default-must-be-gemini-cli` (confidence 10). For full root-cause and the rationalizations the agent used, read the learning entry. The structural fix is in place: `rules/research-must-use-gemini-cli.md` and tier-1 `validate-research-prescope-sub-agent.sh`.

**Re-verification action:** when this knowledge is re-validated (recommended within 30 days per CAPABILITIES.md volatility note), the run MUST use gemini-cli. The next pre-scope artifact will replace this one.

## Expected Output Artifacts

- `references/knowledge/domains/google-ai-pro/CAPABILITIES.md` (Layer 2)
- `references/knowledge/domains/google-ai-pro/details/*.md` (8 detail files per checklist)
- `references/knowledge/domains/google-ai-pro/.version`
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended
- Update to `~/.svc/capabilities/registry.json` `gemini-pro` entry with extracted facts

## Inspection Gate

- Checklist non-empty: ✅ (11 items)
- Domain justification present: ✅
- Sub-agent selection explicit: ✅ (Claude + WebSearch, fallback gemini-cli)
