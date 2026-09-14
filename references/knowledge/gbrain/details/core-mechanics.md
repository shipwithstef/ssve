# gbrain Core Mechanics — Details

## 1. The Dream Cycle (Self-Maintenance)

An 11-phase pipeline that runs overnight to maintain brain health:
1.  **lint**: Fixes malformed markdown and stale frontmatter.
2.  **backlinks**: Automatically populates `## Backlinks` fences.
3.  **sync**: Reconciles files into the DB.
4.  **synthesize**: Converts raw transcripts into structured knowledge pages.
5.  **extract**: Extracts typed links and timeline events.
6.  **extract_facts**: Populates the DB facts index from page fences.
7.  **patterns**: Identifies cross-session themes.
8.  **recompute_weight**: Updates `emotional_weight` based on takes.
9.  **consolidate**: Clusters atomic facts into higher-level takes.
10. **embed**: Generates/refreshes vector embeddings.
11. **purge**: Hard-deletes soft-deleted content.

## 2. Hybrid Search (RRF)

Blends search methods using **Reciprocal Rank Fusion (RRF)**:
- **Keyword (tsvector)**: Fast, exact matches.
- **Vector (pgvector)**: Semantic, similarity-based.
- **Ranking Formula**: $Score = \sum \frac{1}{60 + rank}$
- **Boosts**:
    - **Compiled Truth**: 2.0x boost for summarized knowledge.
    - **Salience**: Logarithmic boost based on emotional weight.
    - **Recency**: Multi-prefix exponential decay based on page age.

## 3. Hot Memory (Facts Extraction)

- **Turn-based**: Extracts claims from every conversation turn.
- **Kinds**: event, preference, commitment, belief, fact.
- **Notability filter**:
    - **High**: Major life changes (Hospitalization, "I'm leaving YC").
    - **Medium**: Durable preferences ("Doesn't like coffee").
    - **Low**: Logistical noise (Skipped).

## 4. One-Way Door Safety Gate

A classifier that protects the user from destructive agent actions:
- **Registry**: Known sensitive tool calls are flagged.
- **Regex Guard**: Searches for destructive strings (`rm -rf`, `drop table`, `force push`).
- **Default-Ask**: If classification is ambiguous, the system defaults to "Ask Human."

## L4 Pointers

- **Cycle orchestration**: `src/core/cycle.ts`
- **Search pipeline**: `src/core/search/hybrid.ts`
- **Fact extraction**: `src/core/facts/extract.ts`
- **Safety logic**: `src/core/one-way-doors.ts`, `question-registry.ts`
