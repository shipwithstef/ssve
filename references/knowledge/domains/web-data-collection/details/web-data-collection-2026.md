# Web Data Collection 2026 — L3 Detail Reference

> This is the "why" behind every band and trigger in CAPABILITIES.md.
> FLAG legend: **VOLATILE** = market median that drifts; re-research on 30-day window.
> **STABLE** = framework/law/architecture that rarely changes.

---

## 1. Tooling Landscape

### 1.1 Firecrawl — LLM-Pipeline Crawler

**What it is.** A managed API that accepts a URL and returns clean Markdown or structured JSON. The company's stated design goal is "zero HTML your LLM ever has to parse." Under the hood it spins Playwright/Chromium, strips nav/footer/ads, and runs optional LLM-based structured extraction.

**Why the 67% token figure matters.** Raw HTML for a typical e-commerce page is 80–120K characters; Firecrawl's markdown output averages 25–40K characters per internal benchmarks. For agents that ingest dozens of pages per session, this can cut context budget by more than half.  
FLAG: **STABLE** (architectural; the ratio won't drift unless crawled pages become more JS-heavy).

**Achilles heel: anti-bot.** Independently tested (Apify 2026 benchmarks, not Firecrawl claims), Firecrawl's real-world success rate against well-defended targets (Cloudflare Enterprise, PerimeterX) is **33.7% at 2 req/s, degrading to 26.7% at 10 req/s**, with 7.92s average latency on failures. This is a proxy-network limitation, not a parsing limitation.  
FLAG: **VOLATILE** — Cloudflare Turnstile payload changes quarterly; retest when evaluating.

**Pricing signal.** 500 free credits/month on free tier; $16/mo entry paid. Pricing is per page (1 credit = 1 page), which makes cost predictable but can blow budget on large sites.  
FLAG: **VOLATILE** — pricing tiers have changed 3× since 2023.

---

### 1.2 Apify — Full-Stack Scraping Platform

**What it is.** An execution platform with 15,000+ pre-built "Actors" (Docker containers for scraping tasks), built-in scheduling, webhooks, and a marketplace where developers sell scrapers. Revenue to developers: $760K/month as of early 2026 (Apify reporting).

**Cold-start penalty.** Actors have ~1.5s cold-start latency when spun on demand. For real-time agent use this can feel slow; for batch pipelines it is irrelevant.

**Proxy control.** Full control of proxy source, rotation policy, session stickiness, country selection. This is the key differentiator vs Firecrawl: you can layer Bright Data residential IPs on top of any Apify Actor.

**Cost model.** Compute Units ($0.25–$0.30/CU). A CU is 1 hour of 1 GB RAM + 1 vCPU. Typical light Actor run: 0.01–0.05 CU/page. For 10K pages/day that's $25–$125/day — expensive vs Firecrawl credits unless you need the Actor ecosystem.  
FLAG: **VOLATILE** — CU rates have been stable but watch discount code removal trend.

---

### 1.3 Bright Data — Enterprise Proxy + Structured Extraction

**What it is.** The world's largest commercial proxy network: 175M residential IPs, 33M+ mobile IPs, 195 countries. Also offers SERP APIs, Web Unlocker (one-call bypass), Scraping Browser (managed Playwright with bypass), and Dataset Marketplace (pre-collected datasets).

**Why residential pool size matters.** Detection systems rely on IP reputation + behavioral fingerprinting. With 175M rotating IPs, any single IP carries minimal history. Proxyway's 2026 benchmark confirmed: Oxylabs (175M pool) posted **99.93% clean-infra success** but only **81.23% median against real hardened targets**. The gap proves that pool size alone does not defeat TLS fingerprinting and browser-challenge detection.  
FLAG: **VOLATILE** — pool sizes and vendor rankings shift quarterly.

**When to use.** High-block retail (Amazon, Walmart), social (LinkedIn, Instagram), financial data. For these targets, Firecrawl fails 2 of 3 requests; Bright Data succeeds ~80%.

**Pricing range.** $0.60/GB (datacenter) to $24/GB (premium residential). Median residential at 50GB volume: **$3.00/GB** (Proxyway 2026).  
FLAG: **VOLATILE** — price compression 2023–2025 reversed; rates increased 25–33% YoY for some providers.

---

### 1.4 crawl4ai — Open-Source Self-Hosted Crawler

**What it is.** Python library (MIT/Apache dual, GitHub: unclecode/crawl4ai), 68K+ stars as of mid-2025. Outputs clean markdown, supports async batch crawling, integrates with LiteLLM for any LLM-backed extraction.

**Why it exploded.** Teams building RAG pipelines on local infrastructure didn't want to pay per-page API costs. crawl4ai eliminated that; extraction quality approximated Firecrawl when tuned correctly.

**Tradeoffs vs managed APIs.** No built-in anti-bot bypass (you supply your own proxies), no managed infrastructure, no scheduling/orchestration layer. Bottleneck: extraction — not crawl speed, but LLM latency if using LLM-based strategies.  
FLAG: **STABLE** (architecture; feature set evolves but tradeoff profile is durable).

---

### 1.5 Exa AI — Neural Search + Enrichment

**What it is.** A search API that uses embedding-based (neural) ranking rather than keyword-BM25, optimized for AI agent queries. Key indices: 1B+ people profiles (50M weekly updates), 70M+ company records.

**Use case boundary.** Exa is NOT a crawler. It returns results from its pre-built index; you can't point it at an arbitrary URL you choose. The right choice is: enrichment workflows (recruiting, sales intelligence, company monitoring) where semantic recall > crawl freshness. For live pages or custom URL sets, use a crawler.

**vs traditional SERP APIs.** Google SERP APIs return ranked keyword results. Exa returns semantically related content — better for "find all companies doing X" queries, worse for "current price of product Y on site Z."  
FLAG: **STABLE** (product category); person/company index sizes are **VOLATILE**.

---

## 2. Anti-Bot & Unblocking

### 2.1 Detection Stack (2026)

Modern bot-detection platforms (Cloudflare, Akamai, PerimeterX/HUMAN, DataDome) layer:

1. **IP reputation** — blacklisted ASNs, known datacenter ranges. Defeated by residential/mobile proxies.
2. **TLS fingerprinting (JA3/JA4)** — browser TLS negotiation pattern. Defeated by real browser execution (Playwright/Puppeteer with correct browser builds) or managed solutions that patch TLS stacks.
3. **Browser challenge (JS)** — Cloudflare Turnstile, reCAPTCHA v3, hCaptcha. Defeated by real-browser headless or third-party solvers (2captcha, CapSolver), or managed bypass layers.
4. **Behavioral fingerprinting** — mouse movement, scroll patterns, timing entropy. Defeated by humanized input simulation or accepting very low request rates.

The arms race is real: Cloudflare updates Turnstile challenge payloads on rolling cycles. Bypass techniques that worked last week can fail today without any code change on the scraper side. This is why managed bypass services (Bright Data Web Unlocker, Apify+residential) are preferred over DIY for hard targets.

### 2.2 Proxy Tier Selection

| Tier | Bypass Strength | Cost Rank | Best For |
|------|----------------|-----------|----------|
| Datacenter | Weakest (blocked by 70%+ hard targets) | Cheapest | Public APIs, low-protection sites |
| Residential | Medium-strong | Mid | Retail, social, search |
| Mobile | Strongest (ISP-level trust) | Most expensive | Instagram, TikTok, hardened retail |
| ISP (static residential) | Strong + fast | Mid-high | High-volume where TTFB matters |

Proxyway 2026 real-target medians: **residential 74.43%, mobile 75.26%** — close, but mobile edges out on the hardest targets. Neither is dominant enough to pick blindly; test per target.  
FLAG: **VOLATILE** — target-specific detection tuning changes these numbers.

### 2.3 IP Rotation and Burn Rate

89.7% of malicious residential IPs rotate out of the pool within 1 month (GreyNoise analysis, 2026). This means reputation-list-based detection is structurally lagging; fresh residential IPs are almost always clean on first use. Good providers refresh pools continuously — Exa's people index (50M weekly updates) mirrors this pattern for data indices.  
FLAG: **VOLATILE** — burn rate figures are a security-industry snapshot.

---

## 3. ToS, robots.txt, and Legal Framework

### 3.1 CFAA (USA) — Post-hiQ Landscape

The Ninth Circuit's 2022 ruling in *hiQ Labs v. LinkedIn* held that scraping **publicly available** data (no login, no bypass) does not constitute "unauthorized access" under CFAA. The Supreme Court's *Van Buren v. United States* (2021) further narrowed CFAA: violating ToS ≠ federal crime.

**What remains illegal:** bypassing authentication (fake credentials, session hijacking, credential stuffing). The line is: if a human without an account could read it in a browser, CFAA doesn't attach to scraping it.

The hiQ case itself settled with hiQ paying $500K and agreeing to a permanent scraping injunction — meaning "we won on CFAA" does not mean "we won the dispute."  
FLAG: **STABLE** — precedents set; next risk vector is federal legislation, not existing case law.

### 3.2 robots.txt

Not legally binding. Ignoring it is not a federal crime (post-Van Buren). However:
- It signals bad faith in any subsequent ToS litigation.
- Major platforms (Google, Reddit, LinkedIn) have now added explicit robots.txt machine-readable opt-out signals aligned with the EU AI Act's text-and-data-mining exception.
- Respecting Disallow directives is the cheapest form of legal risk reduction available.

**Practice:** always fetch and cache robots.txt; honor Disallow for paths; log the fetch as evidence of good-faith review.  
FLAG: **STABLE** (legal framework); **VOLATILE** (specific site policies).

### 3.3 GDPR — EU Personal Data

The GDPR applies to any processing of EU persons' data, regardless of where your servers are.

**Six lawful bases** (Article 6): consent, contract, legal obligation, vital interests, public task, **legitimate interest**. For scraping, *legitimate interest* (6(1)(f)) is the most common claimed basis — but requires a Legitimate Interest Assessment (LIA) + balancing test.

**2025 enforcement escalation:**
- Cumulative fines since 2018: **€5.88 billion**.
- 2025 alone: **€2.3 billion** — a **38% YoY increase**.
- Clearview AI: **>€91 million** across 15 jurisdictions for scraping public photos into facial recognition.
- EU AI Act high-risk requirements: effective **August 2, 2026**; max penalty: **€35M or 7% of global revenue**.

FLAG: **VOLATILE** — fine amounts update continuously; EU AI Act thresholds are new.

**PII in scrape output — non-negotiable rules:**
1. IP addresses are personal data under GDPR.
2. Names, emails, phone numbers, photos, social handles = PII.
3. "We didn't know it was there" is NOT a defense.
4. Implement automated PII scanning at raw-layer ingress before data enters downstream systems.
5. Maintain a data retention policy and deletion workflow.

### 3.4 CCPA (California)

Consumer rights over personal information. Affects commercial use of scraped data on California residents. Key practical implication: if you sell or share scraped consumer data, CCPA opt-out mechanisms must exist.  
FLAG: **STABLE** (framework); enforcement posture **VOLATILE**.

---

## 4. Data Quality: Dedup, Freshness, and Pipeline Architecture

### 4.1 3-Tier Pipeline Model

```
Raw Layer        → exact copies of scraped responses (no mutation)
Refined Layer    → cleaned, deduplicated, standardized
Analytics Layer  → business rules applied; query-ready
```

Never process in place. The raw layer is your audit trail and re-processing safety net.  
FLAG: **STABLE** (architectural pattern).

### 4.2 Deduplication

Two complementary strategies:

**URL-level dedup:** canonical URL as primary key (resolve redirects; strip UTM params). Redis SET or Bloom filter for visited-URL tracking during a crawl run.

**Content-level dedup:** compute a fast hash (xxHash64 or SHA-256 truncated) over key fields (title + body text normalized). If hash unchanged vs last scrape → skip downstream processing. Redis with 24h TTL is the standard pattern for daily pipelines.

For near-duplicate content (same article on multiple URLs), MinHash/LSH at scale; simhash for simpler pipelines.  
FLAG: **STABLE** (algorithms); Redis TTL is a convention, tune to your freshness SLA.

### 4.3 Data Freshness SLAs

| Content Type | Typical Freshness Requirement | Recrawl Cadence |
|---|---|---|
| Pricing / inventory | Real-time to 1h | Continuous or hourly |
| News / blog | 4–24h | 3× daily to daily |
| Company/people data | 1–7 days | Daily to weekly |
| Static reference (docs) | 7–30 days | Weekly to monthly |

A real freshness SLA requires: scheduling, retry logic for failed fetches, backfill for missed windows, and alerting that fires before business impact is noticed.  
FLAG: **STABLE** (framework); specific per-domain cadence is **VOLATILE**.

### 4.4 Retry and Error Budget

From Apify best-practices 2026:
- Max retries: **5**
- Backoff: **2^attempt seconds** + random jitter (0–1s)
- Alert threshold: **>10% error rate** on any run
- Run duration alert: **>2× baseline**

FLAG: **STABLE** (retry config is engineering consensus).

---

## 5. Rate Limiting and Crawl Courtesy

From Apify 2026 best-practices guide (corroborated by general industry practice):

| Target Class | Req/s | Inter-request Delay |
|---|---|---|
| Small sites (<10K pages, no CDN) | 0.5–1 | 1–2s |
| Medium sites | 1–3 | 0.3–1s |
| Large, public data (news, e-commerce with API) | 3–10 | 0.1–0.3s |

Always honor `Retry-After` headers. Violating rate limits is the fastest path from "tolerated" to "CFAA argument" or infrastructure block.

Prefer official APIs where they exist — they are **10–100× faster** than HTML extraction pipelines for the same data (no parsing overhead, structured output, documented rate limits).  
FLAG: **STABLE** (the 10-100× uplift is architectural; specific rate limits are per-target **VOLATILE**).

---

## 6. Competitive Pricing Snapshot (Proxyway 2026)

Residential proxy median pricing (Proxyway Proxy Market Research 2026, published Q1 2026):

| Volume | Median $/GB | Low | High |
|--------|------------|-----|------|
| 5 GB | $4.00 | $0.49 (Evomi Core) | $6.00 (Oxylabs) |
| 50 GB | $3.00 | $1.00 (DataImpulse) | $5.00 (Oxylabs) |
| 500 GB | $2.28 | $0.80 (Proxyrack) | $4.00 (DataImpulse Premium) |

Notable trend: prices compressed 75% from 2021–2024 peaks; 2025–2026 saw a partial reversal with some providers raising entry rates 25–33%.

FLAG: **VOLATILE** — re-research on every 30-day window; pricing is the fastest-moving dimension of this space.

---

_As-of 2026-06-28. Volatile rows (see inline flags): proxy pricing, proxy success rates, GDPR fine totals, detection rate benchmarks, Firecrawl success rates, IP pool sizes, Exa index sizes. Re-research when the 30-day window expires._
