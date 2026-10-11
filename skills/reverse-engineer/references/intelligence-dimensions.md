# reverse-engineer — Phase 1 intelligence dimensions

Loaded from `SKILL.md` Phase 1. Cover every table that applies to the input type; mark a
dimension "unknown — <why>" rather than guessing.

### 1A. Product Intelligence

| Dimension | What to find | How |
|---|---|---|
| **What it does** | Core value prop in one sentence | Landing page, About page, app store description |
| **Who it's for** | Target users, personas, use cases | Marketing copy, testimonials, case studies, subreddit |
| **Pricing** | Plans, pricing model, free tier, enterprise | Pricing page, comparison sites |
| **Key features** | Top 5-10 features that differentiate | Feature page, changelog, product hunt launch |
| **UX patterns** | Onboarding flow, core loop, retention hooks | Browse the product if possible, screenshots, demo videos |
| **Content/SEO** | Blog, docs, guides — what drives organic traffic | Site structure, blog topics, keyword targets |
| **Social proof** | Stars, users, testimonials, press, awards | Landing page, GitHub, social media, review sites |

### 1B. Business Intelligence

| Dimension | What to find | How |
|---|---|---|
| **Revenue model** | How they make money (SaaS, marketplace, ads, API) | Pricing page, job posts (reveals scale), press interviews |
| **Revenue estimate** | ARR/MRR if available, or proxy signals | Crunchbase, BuiltWith, job count, pricing x estimated users |
| **Growth channels** | How they acquire users (organic, paid, viral, API) | Similarweb, social media presence, backlink analysis |
| **Team size** | Headcount, key roles, hiring signals | LinkedIn, About page, job board |
| **Funding** | Raised? From whom? Bootstrapped? | Crunchbase, press, founder interviews |
| **Moat** | What makes them hard to compete with | Network effects, data, brand, regulatory, tech |
| **Weakness** | Where they're vulnerable | Bad reviews, missing features, pricing complaints, slow iteration |

### 1C. Technical Intelligence

| Dimension | What to find | How |
|---|---|---|
| **Tech stack** | Frontend, backend, database, infra | BuiltWith, Wappalyzer, job posts, GitHub, blog posts |
| **Architecture** | Monolith, microservices, serverless, edge | Engineering blog, conference talks, job descriptions |
| **API** | Public API? Docs? Rate limits? Pricing? | /api, /docs, developer portal |
| **Integrations** | What does it connect to? | Integrations page, marketplace, Zapier/Make |
| **Data model** | What entities exist? Relationships? | API docs, UI structure, database mentions in blog |
| **Performance** | Fast? Slow? Real-time? | Browse it, check Lighthouse scores, check latency |

### 1D. Technique Intelligence (if input is a technique/workflow)

| Dimension | What to find | How |
|---|---|---|
| **What it is** | The technique in concrete steps | Source tweet/article, related discussions |
| **Who invented it** | Origin, evolution, variations | Search for earliest mention, related techniques |
| **Who uses it** | Companies, teams, individuals applying it | Case studies, blog posts, conference talks |
| **Why it works** | The mechanism — not just "it's good" | First principles analysis, empirical evidence |
| **Limitations** | When it fails, edge cases, prerequisites | Criticisms, failure stories, context dependencies |
| **Tools that support it** | Software, frameworks, templates | Product Hunt, GitHub, tool comparisons |
