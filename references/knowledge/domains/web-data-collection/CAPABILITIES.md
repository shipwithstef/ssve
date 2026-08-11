> **L2 current-awareness bank** for the `data-collection` agent. Read via `expertise.mjs` preload.
> Currency: domain (30-day window). Authoritative benchmark numbers live HERE, not in the skill prompt.
> Volatile rows are marked; re-research when the window expires or numbers feel stale.

---

## Core Frameworks

| Tool | Role | Positioning |
|------|------|-------------|
| **Firecrawl** | LLM-ready crawler API | Turns any URL into clean markdown/JSON in < 1s on cached pages; 1 credit/page; 67% token reduction vs raw HTML; weak on hard anti-bot targets |
| **Apify** | Full-stack scraping platform | 15,000+ pre-built Actors; compute-unit pricing ($0.25–$0.30/CU); best for multi-source pipelines with scheduling/webhooks; ~1.5s cold-start |
| **Bright Data** | Enterprise proxy + structured extraction | 175M residential IPs, 195 countries; highest bypass rate on Amazon/LinkedIn/retail; $0.60–$24/GB depending on proxy tier |
| **crawl4ai** | Open-source self-hosted crawler | Python-native, 68K+ GitHub stars (mid-2025); LiteLLM-backed extraction; zero API cost; trade: ops burden |
| **Exa AI** | Neural search + enrichment API | Semantic/embedding-ranked results; 1B+ people profiles, 70M+ company records, 50M weekly updates; purpose-built for agent enrichment pipelines |
| **Scrapfly / Browserless** | Anti-bot middleware | Headless-browser-as-a-service layers; Cloudflare/PerimeterX bypass; positioned between Firecrawl and Bright Data on hardness/cost curve |

---

## Benchmark Bands / Thresholds

| Metric | Band / Threshold | Source | Volatile? |
|--------|-----------------|--------|-----------|
| Residential proxy price (5 GB entry) | Median **$4.00/GB**; range $0.49–$6.00/GB | Proxyway Market Research 2026 | VOLATILE |
| Residential proxy price (50 GB) | Median **$3.00/GB**; range $1.00–$5.00/GB | Proxyway 2026 | VOLATILE |
| Residential proxy price (500 GB) | Median **$2.28/GB**; range $0.80–$4.00/GB | Proxyway 2026 | VOLATILE |
| Residential proxy success — clean infra | Median **99.28%**; best 99.93% (Oxylabs); worst 95.28% (NetNut) | Proxyway 2026 | VOLATILE |
| Residential proxy success — real targets (Amazon/Google/Instagram) | Median **74.43%**; best 81.23% (Byteful) | Proxyway 2026 | VOLATILE |
| Mobile proxy success — real targets | Median **75.26%**; best 85.31% (DataImpulse) | Proxyway 2026 | VOLATILE |
| Residential TTFB (global median) | **0.93s**; best 0.41s (Byteful); threshold <= 0.8s = good | Proxyway 2026 | VOLATILE |
| Residential TTFB (US pool median) | **0.80s**; best 0.39s (Evomi) | Proxyway 2026 | VOLATILE |
| Firecrawl success vs. well-protected targets | **33.7%** at 2 req/s; **26.7%** at 10 req/s; avg latency 7.92s | Use-Apify benchmark 2026 | VOLATILE |
| LLM structured extraction F1 (clean input) | **>0.95** (NEXT-EVAL 2025); extraction layer is now bottleneck, not model | arXiv NEXT-EVAL 2025 | STABLE |
| Token reduction: markdown vs raw HTML | **~67%** fewer tokens (Firecrawl claim) | Firecrawl docs 2026 | STABLE |
| API-first vs HTML-parse speed uplift | **10–100×** faster | Apify best-practices 2026 | STABLE |
| Scrape rate — small sites | 0.5–1 req/s with 1–2s delay | Apify best-practices 2026 | STABLE |
| Scrape rate — medium sites | 1–3 req/s with 0.3–1s delay | Apify best-practices 2026 | STABLE |
| Scrape rate — large public sites | 3–10 req/s with 0.1–0.3s delay | Apify best-practices 2026 | STABLE |
| Error rate alert threshold | **>10%** triggers alert | Apify best-practices 2026 | STABLE |
| Scale inflection: self-host vs managed API | **>10K pages/day** → managed API preferred | Apify best-practices 2026 | STABLE |
| GDPR cumulative fines (2018–2025) | **€5.88 billion**; 2025 alone: **€2.3 billion** (+38% YoY) | Apify legal guide 2026 | VOLATILE |
| Clearview AI precedent fine | **>€91 million** across 15 jurisdictions by 2025 | Apify legal guide 2026 | STABLE |
| Residential IP pool detection rate (best) | IPRoyal: **16.7%** residential-flagged; worst: NetNut 56.1% | Proxyway / IPinfo 2026 | VOLATILE |
| Residential IP rotation burn rate | **89.7%** of malicious residential IPs active <1 month | GreyNoise 2026 | VOLATILE |

---

## Decision Triggers

| Condition | Decision |
|-----------|----------|
| Target is public, unprotected, markdown-out needed for LLM | **Firecrawl** — fastest path to LLM-ready content |
| Target blocks datacenter IPs (Amazon, LinkedIn, retail) | **Bright Data** residential/mobile proxies; Firecrawl success drops to ~27–34% |
| Multi-source pipeline, scheduling, > 10K pages/day | **Apify** platform or Bright Data with custom scraper |
| Zero API budget, team can self-host | **crawl4ai** (Python); accept ops overhead |
| Enrichment / people/company lookup (not crawl) | **Exa AI** neural search + people/company index |
| TTFB > 0.93s (global median) on residential | Rotate provider; Byteful (0.41s global) or Evomi (0.39s US) as benchmark leaders |
| Real-target success rate < 70% | Upgrade proxy tier from datacenter → residential → mobile |
| GDPR scope: any EU person's data in pipeline | Establish lawful basis BEFORE collection; legitimate interest requires DPIA; no scraping PII without documented basis |
| Personal data in scrape output (names, emails, IPs) | Auto-scan + quarantine at raw-layer ingress; GDPR Article 6(1) applies |
| robots.txt Disallow on target | Respect or document business reason; legal standing unsettled but bad-faith signal triggers faster enforcement |
| Page content changes < every 24h | Redis-backed content-hash dedup with 24h TTL; skip re-scrape if hash unchanged |
| Error rate exceeds 10% | Alert + exponential backoff (max 5 retries, 2^attempt + jitter) |

---

## Sources

| Source | URL / Citation | Credibility |
|--------|---------------|-------------|
| Proxyway Proxy Market Research 2026 | proxyway.com/research/proxy-market-research-2026 | Primary benchmark; methodology-documented |
| Apify Web Scraping Best Practices 2026 | use-apify.com/blog/web-scraping-best-practices-2026 | Vendor; rate-limit and retry numbers cited |
| Apify AI Agent Tools Comparison 2026 | use-apify.com/blog/ai-agent-web-tools-comparison-2026 | Vendor; pricing verified cross-platform |
| Apify Legal Compliance Framework 2026 | use-apify.com/blog/web-scraping-legal-compliance-framework-2026 | Legal synthesis; GDPR numbers cross-checked |
| Bright Data vs Firecrawl Comparison 2026 | brightdata.com/blog/comparison/bright-data-vs-firecrawl | Vendor (Bright Data); useful for positioning |
| Use-Apify Firecrawl vs Apify 2026 | blog.apify.com/firecrawl-vs-apify | Vendor (Apify); Firecrawl success-rate numbers |
| GreyNoise Residential Proxy Abuse Report 2026 | greynoise.io/resources/invisible-army-residential-proxy-abuse-report | Security research; IP burn rate |
| hiQ Labs v. LinkedIn (9th Cir. 2022) | Wikipedia / FBM publications | Legal precedent; CFAA public-data ruling |
| NEXT-EVAL LLM Extraction Benchmark (2025) | arXiv 2511.17006 | Academic; F1 score on structured extraction |
| crawl4ai GitHub | github.com/unclecode/crawl4ai | Primary source; star count as adoption signal |
| Exa AI overview (fastCRW 2026) | fastcrw.com/blog/what-is-exa-ai | Secondary; cross-checked with brightdata.com/blog/comparison/bright-data-vs-exa |

---

_As-of 2026-06-28; volatile rows re-research when stale (30-day window)._
