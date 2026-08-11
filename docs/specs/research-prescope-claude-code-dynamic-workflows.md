# Pre-Scope: claude-code-dynamic-workflows

**Source:** Multi-source: 2 user-given blog URLs + discovered official docs, GitHub list, community case studies, HN, X
**Invoked by:** standalone (`/research <urls> and anything it can find for it x and other guides`)
**Date:** 2026-06-07

## Volume Estimate

- Total sources (substantive): 11
- Approx total volume: 2 JS-heavy blog pages (~530 KB HTML each, ~3-5K words body each), 3 docs .md files (~35 KB raw), 1 GitHub README (10 KB), 1 static case study (3 KB), 1 HN thread (200 pts / 135 comments via Algolia JSON), 1 third-party guide, 1 X post + 1 X long-form article
- Top-level areas: official announcement, official engineering deep-dive, reference docs (workflows + parallel-agents comparison + release week), third-party when-to-use guidance, community patterns, community case study, community reception, X content

## File Checklist (manifest)

Every substantive source that MUST be read in the single pass:

- [ ] https://claude.com/blog/introducing-dynamic-workflows-in-claude-code
- [ ] https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code
- [ ] https://code.claude.com/docs/en/workflows.md
- [ ] https://code.claude.com/docs/en/agents.md
- [ ] https://code.claude.com/docs/en/whats-new/2026-w22.md
- [ ] https://www.mindstudio.ai/blog/anthropic-dynamic-workflows-when-to-use-them
- [ ] https://raw.githubusercontent.com/peymanvahidi/awesome-claude-dynamic-workflows/master/README.md
- [ ] https://raw.githubusercontent.com/peymanvahidi/awesome-claude-dynamic-workflows/master/dynamic-workflows-skill/SKILL.md
- [ ] https://benjaminste.in/isitchristmas/
- [ ] https://benjaminste.in/blog/2026/05/29/building-isitchristmas/
- [ ] https://news.ycombinator.com/item?id=48311705
- [ ] https://twitter.com/trq212/status/2061907337154367865
- [ ] https://x.com/i/article/2061850535708483585

**Deliberately excluded (with reason):**
- InfoQ coverage — gemini discovery surfaced it but exact URL unresolvable (search grounding redirect strips paths; InfoQ search/index probing returned no matching article URL). Derivative news coverage; official sources supersede.
- https://www.youtube.com/watch?v=9pwPY_RlQHk ("Claude Dynamic Workflows is Crazy") — video; transcript extraction out of scope for this text pass.
- https://news.ycombinator.com/item?id=48317595 (Ask HN, 1 point, 0 comments) — no substantive content.
- ddsboston.com Opus 4.8 "Masterclass" — commercial landing page, no extractable mechanics.

## Extraction Plan

- Pass strategy: single-pass across all checklist sources, split by retrieval method:
  - **Machine-readable direct fetch** (per SKILL.md machine-readable endpoint exception): code.claude.com docs `.md` endpoints (Mintlify — `https://code.claude.com/docs/llms.txt` verified live, indexes `workflows.md`), raw.githubusercontent README, HN via Algolia API (`hn.algolia.com/api/v1/items/48311705`), X tweet via syndication API (already fetched: 9,824 likes, author @trq212 "Thariq", links to X article).
  - **gemini-cli extraction**: the 2 claude.com blog posts (JS-heavy Next.js pages), mindstudio.ai guide, benjaminste.in case study.
  - **playwright-extract / Googlebot-UA technique** (research skill step 7b-2 tooling): x.com/i/article/2061850535708483585 (X long-form article; auth-walled for plain fetch; prior-art technique in scratch/extract_googlebot.mjs from earlier session). If still inaccessible → record honest `Status: inaccessible` block.
- Target detail file: `references/knowledge/domains/agent-harnesses/details/claude-code-dynamic-workflows.md` (new Layer 3 area)
- Also updated: `references/knowledge/domains/agent-harnesses/CAPABILITIES.md` (Dynamic Workflows section), `references/knowledge/INDEX.md` (agent-harnesses summary line), `docs/specs/research-log.md`
- Domain classification: `agent-harnesses` (justification: existing domain explicitly scoped to "deep behavioral extraction of execution harnesses (Claude Code, ...)"; Dynamic Workflows is a Claude Code harness orchestration capability; its CAPABILITIES.md already references "Workflow" in billing boundaries. Extending beats new-domain per concern/taxonomy rules — do not add a domain when an existing one covers the subject.)

## Sub-Agent Selection

- Primary: gemini-cli (default — REQUIRED unless gemini-cli has actually failed)
- Fallback: Claude (in-session) if gemini errors, runs out of credits, or stalls mid-pass
- Selected for this run: **primary (gemini-cli) attempted → fallback (Claude in-session) after recorded mid-run primary failure** — gemini-cli 0.45.0 installed and authenticated; discovery dispatches succeeded. The EXTRACTION dispatch (2026-06-07 ~17:42Z) returned all 4 web-page blocks as `Status: inaccessible` with gemini self-reporting "The agent environment lacks the required web fetching tools or shell access to download the live HTML" (web_fetch unavailable in headless `gemini -p` run). A single-URL retry probe timed out at 90s (exit 143). Per fallback rule #4 (mid-run primary failure, attempted and verified), extraction handed off to Claude in the same invocation, using the skill's own `research/scripts/playwright-extract.mjs` as the mechanical fetch layer. Machine-readable endpoints (docs .md via verified Mintlify llms.txt, GitHub raw, HN Algolia JSON, X syndication JSON) were direct-fetched per the documented machine-readable endpoint exception. X article: X returns HTTP 500 across 3 attempts (Googlebot UA playwright), zero Wayback snapshots → honest `inaccessible` verdict.

## Expected Output Artifacts

- `references/knowledge/domains/agent-harnesses/CAPABILITIES.md` (Layer 2 — Dynamic Workflows section added)
- `references/knowledge/domains/agent-harnesses/details/claude-code-dynamic-workflows.md` (Layer 3)
- `references/knowledge/domains/agent-harnesses/.version` (updated date)
- `references/knowledge/domains/agent-harnesses/.sources.jsonl` (provenance, one line per source)
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended
- Raw extraction file with per-URL blocks: `docs/specs/research-raw-claude-code-dynamic-workflows.md` (deep-extraction-check target)
