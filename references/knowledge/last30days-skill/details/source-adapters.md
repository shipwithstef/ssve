# Source Adapters

## Mechanism

Each source has a dedicated Python module in `scripts/lib/` that handles authentication, querying, and raw result extraction. All return lists of dicts that `normalize.py` converts to `SourceItem`.

### Free Sources (zero config)
- **Reddit** (`reddit_public.py` + `reddit.py`): Public JSON API (`reddit.com/r/{sub}/search.json`), enrichment fetches full thread JSON for top comments with upvote counts. ScrapeCreators as optional enhancement.
- **Hacker News** (`hackernews.py`): Algolia HN Search API (free, no auth)
- **Polymarket** (`polymarket.py`): Gamma API for prediction markets (free, no auth). Common-word disambiguation prevents false matches.
- **GitHub** (`github.py`): Two modes — person-mode (`--github-user`) fetches PRs/repos/releases by author; project-mode (`--github-repo`) fetches issues/discussions/releases by repo. Uses `GITHUB_TOKEN` or `gh` CLI.

### Cookie-Based Sources
- **X / Twitter** (`bird_x.py`): Vendored Node.js client (`vendor/bird-search/`) that uses browser cookies (AUTH_TOKEN + CT0). Subprocess call to `node bird-search.mjs`. Also `xai_x.py` for xAI API-based search, and `xquik.py` as alternative.

### API-Key Sources
- **YouTube** (`youtube_yt.py`): Uses `yt-dlp` locally for search + transcript extraction. Widens candidate pool 3x past music videos. Full transcript extraction with highlight selection.
- **TikTok** (`tiktok.py`): ScrapeCreators API. Supports hashtag search + creator search.
- **Instagram** (`instagram.py`): ScrapeCreators API. Supports creator search + reel transcripts.
- **Bluesky** (`bluesky.py`): AT Protocol API with app password auth.
- **Threads** (`threads.py`): ScrapeCreators API.
- **Pinterest** (`pinterest.py`): ScrapeCreators API.
- **Truth Social** (`truthsocial.py`): ScrapeCreators API.
- **Xiaohongshu** (`xiaohongshu_api.py`): ScrapeCreators API (RED/Little Red Book).
- **Web** (`grounding.py`): Brave Search API (primary), Exa, Serper, Parallel as fallbacks. Undated web hits dropped.
- **Perplexity** (`perplexity.py`): Sonar Pro via OpenRouter. Grounded web search with citations. Opt-in via `INCLUDE_SOURCES=perplexity`.

### Auto-Resolution (`resolve.py`)
Before planning, `auto_resolve` uses web search to discover:
- X handles (bidirectional: person→company, product→founder)
- Subreddits
- GitHub users/repos
- TikTok hashtags
- YouTube channels

The setup wizard (`setup_wizard.py`) handles first-run configuration: cookie extraction from browsers, ScrapeCreators device auth, GitHub auth.

## Analysis

The source adapter pattern is clean — each module is independent, returns raw dicts, and can fail without affecting others. The `pipeline.py` orchestrator catches per-source exceptions and records them in `errors_by_source`. ThreadPoolExecutor parallelizes all source fetches.

ScrapeCreators is the single-vendor dependency for multiple sources (TikTok, Instagram, Threads, Pinterest, Truth Social, Xiaohongshu). This is a risk — if ScrapeCreators goes down, 6+ sources are lost simultaneously.

The Bird vendored client for X search is notably complex: a full Node.js Twitter client with paginated search, cookie management, and feature flag handling. This is the only non-Python dependency in the runtime.

## L4 Pointers
- `scripts/lib/reddit_public.py` + `scripts/lib/reddit.py`: Reddit fetching + enrichment
- `scripts/lib/bird_x.py` + `scripts/lib/vendor/bird-search/`: X/Twitter cookie-based search
- `scripts/lib/youtube_yt.py`: yt-dlp integration
- `scripts/lib/resolve.py`: auto-resolution of handles/subreddits
- `scripts/lib/setup_wizard.py`: first-run wizard
- `scripts/lib/env.py`: config loading from `~/.config/last30days/.env`
