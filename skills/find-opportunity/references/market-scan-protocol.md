# Market Scan Protocol

The core of the skill. Do not guess what might work. Find what IS working and
reverse-engineer it.

## Social Proof Discovery via last30days (MANDATORY)

**last30days is the PRIMARY research tool.** It searches Reddit, HN, X, YouTube,
TikTok, Instagram, and Polymarket with real engagement metrics.

**If last30days is NOT installed:** warn the user and fall back to WebSearch,
but mark output quality as degraded:

```
⚠ last30days addon not found. Social proof quality will be reduced.
  Continuing with WebSearch fallback. Confidence scores will be capped at 7/10.
```

Fallback: use WebSearch with `site:reddit.com`, `site:news.ycombinator.com`,
`site:x.com` queries.

**Run 4 discovery dimensions in parallel.** Each dimension asks a different
question. Together they form the demand picture.

**Diversity mandate:** For EACH dimension, run TWO queries — one in the
builder's primary domain, one OUTSIDE it.

| Dimension | In-domain query | Cross-domain query |
|---|---|---|
| Pain | "devops kubernetes terraform frustration" | "solo founder SaaS tool frustration wish existed" |
| Revenue | "devops tool indie MRR revenue" | "chrome extension API wrapper side project revenue" |
| Trend | "MCP server AI devops trending" | "AI tool maker indie trending new launched" |
| Gap | "devops too expensive alternative" | "small business tool overpriced cheaper alternative" |

### Dimension 1: Pain Discovery
What are people frustrated about? What's broken? What do they wish existed?

```
/last30days "<builder-domain> frustration pain 'I wish' 'looking for' tool" --agent
```

**Extract:** Specific complaints with engagement metrics. A post with 500+
upvotes saying "I hate X" is gold.

### Dimension 2: Revenue Discovery
What are solo developers and indie hackers actually making money from RIGHT NOW?

```
/last30days "indie hacker solo developer shipped launched making money MRR revenue tool" --agent
```

**Extract:** Product names, revenue figures, build timelines, categories.

### Dimension 3: Trend Discovery
What's blowing up in the last 30 days?

```
/last30days "<builder-domain> new tool launched trending popular" --agent
```

**Extract:** Products/topics with sudden engagement spikes. Cross-platform
convergence (same topic on Reddit AND HN AND X) is the strongest signal.

### Dimension 4: Gap Discovery
What exists but is broken, overpriced, or missing features?

```
/last30days "<builder-domain> 'too expensive' OR 'alternative to' OR 'cheaper' OR 'open source alternative'" --agent
```

**Extract:** Specific incumbents that are hated, overpriced, or missing features.
The complaint thread IS the opportunity brief.

### Processing last30days Output

For each dimension, extract and structure:

```markdown
### Dimension N: <name>
**Query:** <exact query run>
**Results:** <N items found, top engagement>

**Top signals (engagement-ranked):**
1. **[platform] [engagement]** — <summary>
   - Niche implication: <what this means>
```

**Cross-dimension synthesis:** Look for CONVERGENCE:
- Pain + Gap + Revenue = STRONG opportunity
- Trend + Revenue = STRONG
- Pain alone but no Revenue = risky

**Niche-down rule:** If a dimension returns broad results, run a follow-up
query drilling into the specific sub-niche. Keep drilling until you find
complaints from SPECIFIC PERSONAS.

## WebSearch Supplemental Research

After last30days provides the social proof layer, use WebSearch to fill gaps:
- **Funding/revenue data** for products discovered in last30days
- **Pricing pages** of incumbents identified as "too expensive"
- **Market size** for niches where last30days showed strong demand
- **Competitor landscape** for the top opportunities

WebSearch is supplemental — it validates and enriches what last30days found.

| Source | Search Queries | What You Learn |
|---|---|---|
| **IndieHackers** | Revenue range $1K-$10K MRR, solo founder, niche from last30days | Confirms revenue is real |
| **ProductHunt** | Last 90 days, products matching last30days trends | Launch traction |
| **GitHub trending** | Past month, builder's primary languages | Star velocity |
| **Gumroad / LemonSqueezy** | Top sellers matching niche from last30days | Actual prices |
| **Crunchbase / Latka** | Funding data for companies in the niche | Market size validation |

## Use analyze-competitors for Deep Dives

When a promising niche emerges (3+ signals pointing at the same opportunity),
invoke `analyze-competitors` on that specific niche. This gives you:
- The top 5 products in that micro-niche
- What they do well (table stakes you must match)
- What they do poorly (weakness to exploit)
- Whitespace (what nobody does)

Do NOT run analyze-competitors on every category. Only on niches with strong
signal. Typically 1-2 deep dives per opportunity search.

## Reverse-Engineering Process

For each product found making $1K+/mo in a category the builder can execute:

```markdown
### Product: <name>
**URL:** <link>
**Revenue signal:** <how you know it's making money>
**Category:** <from matrix>
**What it does:** <one sentence>
**What it does WELL:** <the thing users praise>
**What it does POORLY:** <specific weakness>
**Can this builder exploit the weakness?**
  - Technical: <yes/no>
  - Distribution: <yes/no>
  - Timeline: <yes/no>
**Opportunity:** <the angle>
```

Repeat for 10-20 products across promising categories. Then filter to the
strongest opportunities.

## Candidate Funnel Requirements

The skill MUST investigate a broad funnel before narrowing to top 3.

| Metric | Minimum | Why |
|---|---|---|
| **Categories scanned** | 8+ distinct categories | Prevents tunnel vision |
| **Candidates investigated** | 10+ | Broad enough to find non-obvious winners |
| **Evidence points per candidate** | 5+ per top-3; 2+ per rejected | Prevents thin research |
| **Category diversity in top 3** | At least 2 distinct categories | Forces looking beyond obvious niche |
| **Rejected candidates shown** | All non-selected with rejection reason | User sees the full funnel |

### Proof Chain Format (MANDATORY for top 3)

Each top-3 candidate MUST include a numbered proof chain:

```markdown
**Proof chain (N validations):**
1. **[Revenue proof]** <Specific product> makes <$X/mo>. Source: <URL>
2. **[Market size]** <Market> is <$XB>. Source: <URL>
3. **[Gap identified]** <Weakness in incumbent>. Source: <URL>
4. **[Demand signal]** <Community/platform> shows <engagement>. Source: <URL>
5. **[Builder fit]** Builder has <skill> that matches. Source: builder profile
6. **[Pricing validation]** Similar products charge <$X>. Source: <URL>
7. **[Distribution channel]** <Platform> has <N users>. Source: <URL>
8. **[Timing signal]** <Why NOW>. Source: <URL>
9. **[Comparable success]** <Solo builder> achieved <$X MRR> in <time>. Source: <URL>
10. **[Risk identified]** <Honest risk> + mitigation. Source: <analysis>
```

Each top-3 candidate MUST have at least 5 distinct, sourced evidence points
covering: revenue proof, gap, builder fit, distribution, and one of
(timing/comparable/demand).

**Social proof requirement:** At least 1 of the 5 evidence points MUST be a
social proof signal from last30days — a Reddit thread with upvote count, an
HN post with points, an X post with likes, or a YouTube video with views.
Blog articles and press releases are NOT social proof.

### Parallel Research Mandate

When scanning 8+ categories, use parallel research agents:
- Agent 1: Categories 1-5
- Agent 2: Categories 6-10+

Each agent returns structured findings per category. The main agent synthesizes.
