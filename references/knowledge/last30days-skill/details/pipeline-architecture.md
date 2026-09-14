# Pipeline Architecture

## Mechanism

The v3 pipeline is an 8-stage information retrieval system orchestrated by `pipeline.py`:

### Stage 1: Query Planning (`planner.py`)
- Classifies user topic into 8 intent types via regex heuristics (`_infer_intent`)
- LLM generates structured JSON plan with subqueries, source routing, weights
- Deterministic fallback for comparison queries (entity extraction + parallel subqueries)
- Each subquery has `search_query` (keyword-style) and `ranking_query` (natural language for reranking)
- Source capabilities model: each source tagged with capabilities (discussion, video, social, web, market, link)
- Intent-to-source routing: `SOURCE_PRIORITY` maps intent → ordered source list
- Depth-aware trimming: `--quick` limits to 2 sources per intent, 1 subquery max

### Stage 2: Parallel Retrieval (`pipeline.py`)
- ThreadPoolExecutor dispatches per-(subquery, source) fetch tasks concurrently
- Per-stream limit: 6 (quick), 12 (default), 20 (deep) items
- MAX_SOURCE_FETCHES caps X at 2 concurrent fetches
- Each source module returns raw items in source-specific format
- Date range filtering: strict 30-day window (configurable via --lookback-days)

### Stage 3: Normalization (`normalize.py`)
- Source-specific normalizers convert raw items to `SourceItem` dataclass
- Per-source normalizers: reddit, x, youtube, tiktok, instagram, hackernews, bluesky, truthsocial, threads, pinterest, polymarket, grounding, xiaohongshu, github, perplexity
- Date range filtering applied post-normalization
- Evergreen fallback for how_to queries if strict filtering yields too few items

### Stage 4: Signal Annotation (`signals.py`)
- `local_relevance`: token overlap between ranking_query and item text (0-1), with source-specific floors (YouTube high-engagement floor at 0.3, GitHub project-mode floor at 0.8)
- `freshness`: recency score with mode-dependent weighting (strict_recent, balanced_recent, evergreen_ok)
- `engagement_score`: log1p-normalized engagement metrics
- `source_quality`: editorial signal-to-noise ratios (grounding=1.0 baseline, reddit=0.6, x=0.68, youtube=0.85, HN=0.8)

### Stage 5: Deduplication (`dedupe.py`)
- Text similarity-based near-duplicate detection
- `_PreparedText` class for efficient comparison

### Stage 6: Weighted RRF Fusion (`fusion.py`)
- Standard RRF with k=60: `score = weight / (60 + rank)`
- Weight = subquery.weight * source_weight
- Cross-stream candidate merging via URL normalization
- Per-author cap: max 3 items per author
- Diversity pool: min 2 items per qualifying source (relevance >= 0.25)
- Pool limit: 15 (quick), 40 (default), 60 (deep)

### Stage 7: LLM Reranking (`rerank.py`)
- LLM scores each candidate 0-100 with intent-specific hints
- Untrusted content fenced in `<untrusted_content>` tags
- Final score formula: `0.60 * rerank + 0.20 * normalized_rrf + 0.10 * freshness + 0.05 * (quality*100) + 0.05 * min(engagement*6, 100)`
- Demotion: rerank < 20 → multiply base by 0.3
- Fallback scoring: `0.7 * local_relevance*100 + 0.2 * freshness + 0.1 * quality*100`
- Fun judge: separate pass scoring humor/wit/virality 0-100

### Stage 8: Clustering + Rendering
- Clustering (`cluster.py`): greedy text-similarity (0.42-0.48 threshold) + entity-overlap merge pass
- MMR representative selection (diversity_lambda=0.75, max 3 per cluster)
- Render modes: compact (cluster-first, 8 clusters max), full (all items + transcripts), JSON, context

## Analysis

**Strengths:**
- Clean separation of concerns: each stage is a standalone module
- Graceful degradation: LLM planning/reranking falls back to deterministic methods
- Source diversity: per-author cap + diversity pool prevent single-source domination
- Security: untrusted content tagging prevents prompt injection from scraped data
- Multi-host: same engine works across Claude Code, Gemini CLI, OpenClaw, Codex

**Interesting design decisions:**
- RRF over learned-to-rank: simpler, no training data needed, works across heterogeneous sources
- Entity-overlap second pass in clustering: catches cross-source matches that text similarity misses (e.g., different phrasing about same event on Reddit vs X)
- Per-author cap at fusion level (not render level): prevents domination early in the pipeline
- Fun judge as separate scoring dimension: doesn't compete with relevance, surfaces cultural signal

## L4 Pointers
- `scripts/lib/pipeline.py`: full orchestration with ThreadPoolExecutor dispatch
- `scripts/lib/planner.py`: intent classification + LLM planning + deterministic fallback
- `scripts/lib/fusion.py`: RRF implementation + diversity pool
- `scripts/lib/rerank.py`: LLM reranking + fun judge
- `scripts/lib/cluster.py`: clustering + entity merge + MMR
- `scripts/lib/schema.py`: full dataclass hierarchy
- `scripts/lib/signals.py`: local scoring signals
