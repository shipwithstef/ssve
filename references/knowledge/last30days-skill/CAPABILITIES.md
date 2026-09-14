# last30days-skill — Layer 2

Multi-source social search skill for AI coding agents (Claude Code, Gemini CLI, OpenClaw, Codex). Searches Reddit, X/Twitter, YouTube, TikTok, Instagram, Hacker News, Polymarket, GitHub, Bluesky, Threads, Pinterest, Truth Social, Perplexity, Xiaohongshu, and web — then scores by real engagement (upvotes, likes, odds, real money) not editorial ranking.

**Author:** Matt Van Horn (mvanhorn)
**Version:** 3.0.0
**License:** MIT
**Python:** 3.12+
**Tests:** 1,012 passing

## Architecture

- **Pipeline orchestrator** (`scripts/last30days.py` + `scripts/lib/pipeline.py`): 8-stage pipeline — plan → retrieve → normalize → dedupe → snippet-extract → fuse (weighted RRF) → rerank → cluster → render
- **LLM-first query planner** (`lib/planner.py`): intent classification (8 types: factual, product, concept, opinion, how_to, comparison, breaking_news, prediction), multi-subquery generation with source routing, deterministic fallback for comparison queries
- **Weighted reciprocal rank fusion** (`lib/fusion.py`): RRF (k=60) across per-(subquery, source) streams, per-author cap (max 3), diversity pool with min 2 per qualifying source
- **LLM reranking** (`lib/rerank.py`): 0-100 relevance scoring with intent-specific hints, demotion of <20 scores, final score = 0.60 rerank + 0.20 RRF + 0.10 freshness + 0.05 quality + 0.05 engagement
- **Fun judge** (`lib/rerank.py`): separate humor/wit/virality scoring for "Best Takes" section
- **Clustering** (`lib/cluster.py`): greedy text-similarity clustering (threshold 0.42-0.48), entity-overlap second pass for cross-source merge, MMR representative selection
- **Rendering** (`lib/render.py`): compact (cluster-first markdown), full (all items + transcripts), JSON, context (short synthesis)
- **Schema** (`lib/schema.py`): SourceItem → Candidate → Cluster → Report dataclass hierarchy
- **Signals** (`lib/signals.py`): local relevance (token overlap), freshness (recency score), engagement (log1p normalized), source quality (editorial signal-to-noise)

## Sources (14+)

| Source | Module | Auth | Free? |
|---|---|---|---|
| Reddit (with comments) | `reddit_public.py` + `reddit.py` | None (public JSON) | Yes |
| X / Twitter | `bird_x.py` (cookie) or `xai_x.py` (API) | Browser cookies or XAI_API_KEY | Free/Paid |
| YouTube | `youtube_yt.py` (yt-dlp) | None (local tool) | Yes |
| TikTok | `tiktok.py` | SCRAPECREATORS_API_KEY | 10K free calls |
| Instagram | `instagram.py` | SCRAPECREATORS_API_KEY | 10K free calls |
| Hacker News | `hackernews.py` | None (Algolia API) | Yes |
| Polymarket | `polymarket.py` | None (Gamma API) | Yes |
| GitHub | `github.py` | GITHUB_TOKEN or gh CLI | Yes |
| Bluesky | `bluesky.py` | App password | Yes |
| Threads | `threads.py` | SCRAPECREATORS_API_KEY | Paid |
| Pinterest | `pinterest.py` | SCRAPECREATORS_API_KEY | Paid |
| Truth Social | `truthsocial.py` | SCRAPECREATORS_API_KEY | Paid |
| Xiaohongshu | `xiaohongshu_api.py` | SCRAPECREATORS_API_KEY | Paid |
| Web (Brave/Exa/Serper) | `grounding.py` | BRAVE_API_KEY etc. | 2K free/mo |
| Perplexity Sonar | `perplexity.py` | OPENROUTER_API_KEY | Paid |

## Reasoning Providers

- **Gemini** (preferred): gemini-3.1-flash-lite-preview for planning + reranking, gemini-3.1-pro-preview for deep reranking
- **OpenAI**: gpt-5.4-nano (API or Codex auth with SSE streaming)
- **xAI**: grok-4-1-fast
- **OpenRouter**: google/gemini-flash-2.0 (fallback)
- **Local/deterministic**: no LLM needed — deterministic planner + local scoring

## Key Features

- **Intelligent pre-research**: resolves X handles, subreddits, GitHub repos, TikTok hashtags before search via `resolve.py` and `setup_wizard.py`
- **Cross-source cluster merging**: entity-overlap detection merges same-story from different platforms
- **Comparison mode**: "X vs Y" detected automatically, parallel entity subqueries
- **Person mode**: `--github-user` switches to author-scoped queries (PRs, repos, release notes)
- **ELI5 mode**: plain-language rewrite post-synthesis
- **Best Takes**: fun judge surfaces witty/viral content
- **Depth profiles**: `--quick` (6/15/12), `--default` (12/40/40), `--deep` (20/60/60) per-stream/pool/rerank limits
- **Deep Research**: `--deep-research` flag for Perplexity Deep Research (~$0.90/query)
- **SQLite store**: `--store` persists findings for longitudinal tracking
- **Zero-config start**: Reddit, HN, Polymarket, GitHub work immediately; setup wizard unlocks rest

## Distribution

- **Claude Code plugin**: `/plugin marketplace add mvanhorn/last30days-skill` (marketplace.json + plugin.json)
- **OpenClaw**: `clawhub install last30days-official`
- **Gemini CLI**: gemini-extension.json with settings schema
- **Manual**: clone to `~/.claude/skills/last30days/`
- **Hooks**: SessionStart hook runs `check-config.sh` for env validation
- **Sync**: `scripts/sync.sh` deploys to `~/.claude`, `~/.agents`, `~/.codex`

## CLI

```
python3 scripts/last30days.py <topic> [options]
  --emit=compact|json|context|md
  --quick / --deep
  --search=reddit,x,grounding
  --x-handle=steipete
  --github-user=steipete
  --github-repo=openclaw/openclaw
  --subreddits=SaaS,Entrepreneur
  --tiktok-hashtags=tella,screenrecording
  --lookback-days=30
  --deep-research
  --store
  --diagnose
  --mock
  --web-backend=auto|brave|exa|serper|parallel|none
  --plan='{"intent":"comparison",...}'
```

## Security Model

- Read-only: never posts, likes, or modifies content
- No personal account access
- API keys not logged in output
- Untrusted content fenced in `<untrusted_content>` tags for LLM safety
- File permission warnings for secrets files

## Synthesis Contract (for consuming agents)

SKILL.md contains detailed guidance for how the host agent should synthesize results:
- Synthesize across sources, don't summarize per-source
- Ground in actual research data, not pre-existing knowledge
- Source weighting hierarchy: cross-cluster > Reddit comments > YouTube transcripts > X handles > Polymarket > TikTok/IG > HN > Web
- Comparison queries get structured output (Quick Verdict + entity sections + Head-to-Head table)
- Recommendation queries extract specific names with mention counts
- Empty/contradictory/low-engagement edge cases acknowledged explicitly

## Testing

- 1,012+ tests via pytest
- Test files cover: adversarial, bird_x, bluesky, briefing, chrome_cookies, cli, cluster, cookie_extract, dates, dedupe, entity_extract, env, evaluator, fusion, grounding, hackernews, http, instagram, normalize, pipeline, planner, polymarket, providers, quality_nudge, query, reddit, relevance, render, rerank, resolve, safari_cookies, schema, setup_wizard, signals, snippet, store, tiktok, truthsocial, ui, verify, watchlist, xai_x, xquik, youtube
- E2E comparison test in `tests/e2e_comparison.py`
- Fixtures in `fixtures/` for mock testing

## Vendor Dependencies

- `scripts/lib/vendor/bird-search/`: vendored Node.js X/Twitter search client (cookie-based auth, paginated search)
- `vendor/package/`: vendored `@nickreese/bird` npm package (TypeScript compiled, CLI for Twitter search/bookmarks/lists/posting)
