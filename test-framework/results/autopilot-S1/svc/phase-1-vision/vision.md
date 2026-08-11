# Product Vision: TrendLearner (Canonical)

**Version:** 1.0.0  
**Last Updated:** 2026-04-03  
**Status:** Canonical vision document  
**Repo Mode:** bootstrap  
**Origin:** write-vision (intent=create, mode=scratch)

---

## 1) North Star

Help every AI practitioner instantly discover what the industry is learning right now and get a personalized path to learn it themselves, across any deployment context they choose.

## 2) Problem Statement

The AI/ML landscape moves faster than any individual can track. New techniques, frameworks, papers, and tools surface daily across fragmented social platforms -- Twitter/X threads, Reddit discussions, Hacker News posts, LinkedIn announcements, and YouTube tutorials. Practitioners face two compounding problems:

1. **Discovery overload.** Knowing *what* is trending requires monitoring multiple platforms simultaneously, filtering noise from signal, and recognizing which trends have staying power versus which are hype cycles. Most people default to whatever their algorithm surfaces, which skews toward engagement rather than learning value.

2. **Learning path paralysis.** Even after identifying a relevant trend (e.g., "mixture of experts is gaining traction"), finding the right learning resources -- at the right level, in the right sequence -- requires significant manual curation. Existing course platforms optimize for their own catalog, not for what the industry actually needs right now.

These problems persist because:
- No single platform aggregates trend signals across the social landscape specifically for AI/ML learning.
- Recommendation engines on learning platforms optimize for completion rates and revenue, not for industry relevance.
- The connection between "what is trending" and "what should I learn" requires domain-aware synthesis that generic aggregators cannot provide.

## 3) Who We Serve

**Primary users:**

- **Independent AI/ML practitioners** (data scientists, ML engineers, researchers) who need to stay current but lack time to monitor every platform. They want curated, actionable learning paths tied to real industry momentum.

- **Team leads and engineering managers** at companies building AI products, who need to understand what their teams should be investing in learning and want a shared tool for the team.

- **Operators** (individuals or companies) who want to host TrendLearner as a paid service for their own user base, running a SaaS business on top of the platform.

**Secondary users:**

- **Career transitioners** moving into AI/ML who need to know where the field is heading, not just where it has been.

- **Enterprise L&D teams** who need to align training budgets with actual industry direction.

Detailed personas will be developed by the build-personas skill in Phase 2.

## 4) Value Proposition

1. **Real-time trend intelligence from the platforms that matter.** TrendLearner aggregates and synthesizes signals from Twitter/X, Reddit, Hacker News, LinkedIn, and YouTube -- the places where AI practitioners actually discuss what they are working on and learning.

2. **Trend-to-learning-path bridge.** The product does not just show trends; it maps each trend to concrete learning resources (courses, tutorials, papers, repos) ranked by quality and skill-level fit. This is the core differentiator: connecting "what's hot" to "how to learn it."

3. **Three deployment modes for three business models.** A single codebase supports self-hosted free (bring your own API keys), hosted-for-profit (operator runs SaaS), and self-hosted private (enterprise internal). This unlocks adoption across individuals, entrepreneurs, and enterprises without fragmenting the product.

4. **Personalized skill tracking.** User profiles track what you already know and what you have completed, so recommendations improve over time and avoid redundant suggestions.

5. **No platform lock-in.** The self-hosted free mode ensures anyone can run TrendLearner with zero cost beyond their own API keys. The product earns trust by being usable without payment.

## 5) In-Scope Product Reality (Current)

Nothing is shipped. This is a greenfield project at vision stage.

**Current state:**
- No code repository exists beyond this vision document.
- No APIs, services, or infrastructure are deployed.
- No user base or beta testers.

## 6) Boundaries and Non-Goals

**TrendLearner is NOT:**

1. **Not a social media client.** We scrape and synthesize trend signals; we do not provide a feed-reading or posting experience.
2. **Not a course platform.** We aggregate and recommend external learning resources; we do not host courses, videos, or content ourselves.
3. **Not a general-purpose trend tracker.** Scope is restricted to AI/ML topics. We do not track trends in unrelated domains (fashion, finance, sports) even if the architecture could support it.
4. **Not a research paper search engine.** While papers may appear as learning resources, the product is not optimized for academic literature search (tools like Semantic Scholar already do this well).
5. **Not a job board or hiring tool.** Even though trend data could inform hiring, that is a different product.
6. **Not a real-time alerting system.** Trends are synthesized on a cadence (likely daily); we do not promise sub-hour alerting.

**Scope boundaries:**

- V1 targets English-language content only.
- V1 targets the five named platforms (Twitter/X, Reddit, HN, LinkedIn, YouTube). Additional platforms are a future exploration area.
- The self-hosted free mode requires users to provide their own API keys; we do not subsidize third-party API costs.
- The hosted-for-profit mode is an architecture and licensing concern, not a first-party SaaS we operate ourselves (unless decided otherwise later).

## 7) Product Principles

1. **Trend signal over noise.** When in doubt, show fewer, higher-confidence trends rather than a firehose. Precision matters more than recall for trust.

2. **Learning paths are the product, trends are the input.** Trend data alone is interesting; trend data connected to actionable learning is valuable. Every feature should strengthen the trend-to-learning bridge.

3. **Deployment flexibility is a feature, not a tax.** The three deployment modes must be first-class concerns in architecture decisions, not afterthoughts. If a feature cannot work across all three modes, that is a design problem to solve, not a mode to drop.

4. **Bring-your-own-keys as trust anchor.** The self-hosted free mode is how we earn trust and adoption. Never degrade this mode to push users toward paid offerings.

5. **Transparent recommendations.** Users should understand *why* a trend is surfaced and *why* specific resources are recommended. No black-box rankings.

6. **Composable over monolithic.** Prefer modular components (scraper, analyzer, recommender, UI) that can be deployed and scaled independently. This serves all three deployment modes.

7. **Minimal viable data retention.** Collect only what is needed for personalization. Users in self-hosted modes own their data completely. Enterprise private mode must support air-gapped operation.

## 8) Success Definition

**North-star metric:**
- **Weekly active learners (WAL):** Users who start at least one recommended learning resource per week, measured across all deployment modes that report telemetry (opt-in only).

**Supporting metrics:**
- **Trend-to-learn conversion rate:** Percentage of viewed trends where the user clicks through to at least one learning resource.
- **Learning path completion rate:** Percentage of started learning paths where the user completes at least 50% of recommended resources.
- **Trend freshness score:** Median age of top-10 displayed trends (target: < 48 hours from first social signal).
- **Platform coverage breadth:** Number of source platforms actively contributing trend signals (target: 5 at launch).
- **Deployment mode adoption distribution:** Ratio of self-hosted-free : hosted-for-profit : self-hosted-private installations (healthy = all three modes have active users).
- **Operator activation rate (hosted-for-profit):** Percentage of operators who deploy and onboard at least 10 paying users within 90 days.

**Anti-metrics (things we refuse to optimize for):**
- **Time spent in app.** We want users to *leave* the app and go learn. High session duration likely means the product is distracting, not useful.
- **Trend volume.** Showing more trends is not better. We optimize for signal quality.
- **Notification engagement.** We will not gamify notifications to drive opens.

## 9) Evidence Anchors

This section will be populated as artifacts are created through the svc pipeline.

**Source precedence order:**
1. Runtime + schema + tests (implementation reality)
2. Repo status documents (README.md, IMPLEMENTATION_STATUS.md)
3. Specs and planning docs (docs/specs/, docs/plans/)

**Current anchors:**
- `docs/specs/vision.md` -- this document (canonical vision)
- User prompt (S1 scenario) -- initial requirements input

## 10) Vision Editing Protocol

**Proposal-first workflow:**

1. Any change to this vision document must begin as a proposal, not a direct edit.
2. Proposals are generated by running `write-vision intent=refine mode=grounded`.
3. The proposal output includes an Evidence Table linking each claim to source evidence.
4. Proposals are reviewed in the Approval Gate section of the output.
5. Only items marked "Ready to apply" may be merged into this document.

**Evidence requirements:**
- Claims based on shipped code require path:line evidence.
- Claims based on documentation require document path references.
- Claims based on inference must be labeled as such with confidence levels.

**Conflict handling:**
- When sources disagree, the conflict is surfaced in the Open Questions section.
- Conflicts are not silently resolved; they remain visible until explicitly decided.
- Source precedence (Section 9) determines default resolution when a decision must be made.

**Version control:**
- Each applied change increments the patch version (1.0.x).
- Section-level structural changes increment the minor version (1.x.0).
- North Star changes increment the major version (x.0.0).

## 11) Decision Log

| Date | Decision | Rationale | Status |
|---|---|---|---|
| 2026-04-03 | Product name: TrendLearner | Memorable, descriptive, implies both trend tracking and learning. Alternatives considered: "AI Trend Scout" (too generic), "LearnSignal" (unclear domain). | Active |
| 2026-04-03 | Three deployment modes as core architecture requirement | User requirement. Self-hosted free builds trust and adoption; hosted-for-profit enables ecosystem; self-hosted private serves enterprise. All three must be first-class. | Active |
| 2026-04-03 | AI/ML topics only (no general trend tracking) | Focus prevents scope creep and allows domain-specific quality (e.g., distinguishing meaningful AI trends from hype). Generalization is a future exploration area. | Active |
| 2026-04-03 | Five initial source platforms: Twitter/X, Reddit, HN, LinkedIn, YouTube | These are where AI practitioners actively discuss trends. Other platforms (Discord, Mastodon, Bluesky, Substack) deferred to exploration. | Active |
| 2026-04-03 | English-language only for V1 | Reduces NLP complexity and data volume. Multi-language support is a forward-looking area. | Active |
| 2026-04-03 | BYOK (bring your own keys) for self-hosted free mode | Avoids subsidizing API costs. Users provide their own keys for social platform APIs and LLM providers. Aligns with trust-through-transparency principle. | Active |
| 2026-04-03 | Opt-in telemetry only | Self-hosted modes must not phone home by default. Telemetry is opt-in to enable aggregate metrics while respecting user sovereignty. | Active |

## 12) Forward-Looking Areas (Exploration, Not Commitment)

These themes are captured for future exploration. They are NOT implied commitments, planned features, or roadmap items.

1. **Multi-language support.** Expanding trend detection and learning resources beyond English to serve global AI communities.

2. **Additional source platforms.** Discord servers (many AI communities live here), Mastodon/Bluesky, Substack newsletters, arXiv comment threads.

3. **Collaborative learning paths.** Teams can share and co-curate learning paths, track group progress, and discuss trends internally.

4. **Trend prediction.** Moving from "what is trending now" to "what will trend next" using historical pattern analysis.

5. **Content quality scoring.** Automatically assessing learning resource quality based on community signals, completion data, and expert endorsements.

6. **Plugin/extension architecture.** Allowing community-contributed scrapers, analyzers, and resource connectors.

7. **General-purpose trend tracking.** Expanding beyond AI/ML to other technical domains (cybersecurity, web development, DevOps). Deferred per Decision Log.

8. **Mobile companion app.** A lightweight mobile experience for trend browsing and learning path progress tracking.

9. **LLM-generated learning summaries.** Using LLMs to generate concise summaries of trending topics before the user dives into full resources.

10. **Marketplace for operators.** A directory where hosted-for-profit operators can list their TrendLearner instances, creating a marketplace dynamic.
