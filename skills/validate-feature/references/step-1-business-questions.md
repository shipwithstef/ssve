# Step 1: Business Questions — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Guided Mode (standalone or `--progressive` without `--auto-approve`)

Ask only unresolved consequential owner choices. Group independent questions when useful outside the signed `decide` flow; preserve that flow when applicable.

**Scale to what the user already said AND what the codebase reveals** — if the context scan,
the codebase grep, or the user's initial message already answered a question, skip it.
Don't ask the user questions the code can answer.

For each question: **always present a recommended answer** based on the context scan, codebase
analysis, and domain knowledge. The user can accept the recommendation, customize it, or
override it entirely.

Format:
```
Q1: Who has this problem?
RECOMMENDATION: Based on P1's profile, this serves self-directed learners who [pain].
→ Accept / Customize / Override?
```

If ordinary confidence is missing, analyze current cited evidence — a missing score is not a research trigger:
```
Q4: What's the bet?
I'm not certain about the strategic thesis here. Current evidence: [source / basis / freshness].
Invoke research only if researchDecision(question) returns external_research_required.
RECOMMENDATION: [finding-informed answer]
→ Accept / Customize / Override?
```

### Live market signals (recommended: last30days)

If `/last30days` is available (installed via
[mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill)),
use it only when an unresolved consequential market question needs current external evidence. Existing adequate evidence for a bounded change does not trigger a fresh search.
This replaces LLM training data guesswork with actual engagement signals from
Reddit, HN, X, YouTube, and Polymarket.

**When to invoke last30days:**

| Question | What to search | What you get |
|----------|---------------|-------------|
| Q1: Who has this problem? | The problem statement | Real people discussing it — subreddits, thread titles, upvote counts |
| Q2: How bad is it? | Pain points, complaints, workarounds | Engagement velocity — are people angry (high upvotes, many comments) or mildly annoyed? |
| Q3: Why now? | The domain/topic | Trending or flat? 30-day spike or steady background noise? |
| Q4: What's the bet? | The non-obvious insight | Cross-platform convergence — does the signal appear across Reddit AND HN AND X, or just one? |
| Q6: What's the kill condition? | Competitor names + feature | Did someone just ship this? Polymarket/HN signals |

**How to invoke:**

```
/last30days "<problem-statement> <domain> pain points complaints"
```

Read the output. Extract:
- **Signal strength** — high engagement (100+ upvotes, 50+ comments) = real pain
- **Recency** — posts from the last 7 days = actively trending
- **Cross-platform** — same topic on Reddit AND HN = genuine demand, not echo chamber
- **Competitor mentions** — someone already solving this = validate or kill

Include the findings in the brief with citation:

```
Q3: Why now?
→ Trending on HN (3 posts, 450+ points in last 2 weeks) and r/programming
  (8 threads, 1200+ upvotes). Signal is cross-platform and accelerating.
  — source: last30days research (2026-04-05)
```

**If last30days is not available:** Stay on analysis unless `researchDecision(question)` returns `external_research_required`. Then invoke `research` for that question only. The business questions still work from current cited evidence; a missing score is not a research trigger.
