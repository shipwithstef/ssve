## Find What to Build

When the user doesn't have a specific idea but has a goal — "I need money"
or "fastest path to revenue" or "what should I build?" — the pipeline
switches from evaluating ideas to GENERATING them.

When the user HAS an idea: "build my idea anyway" always works. The pipeline
does its best with whatever the user gives it. But it may ALSO suggest a
faster-money project alongside the main idea (see Staging Strategy below).

**Trigger phrases:** "what should I build", "find me a project", "fastest path
to revenue", "I want to make money", "first project", "help me pick", or any
variant where the user has a goal but not an idea.

**Requires:** builder profile (`~/.svc/builder-profile.md`). If it doesn't
exist, mine it first (Step 0). The profile IS the input — without knowing
who the builder is, the recommendations are generic and useless.

### The Bar

The target is NOT "$500/mo someday." The target is:

> **Almost guaranteed $1K/mo within 1 month of launch, with 1-2 weeks of
> build time.**

99% of builders with the right guidance can hit this. The system finds
opportunities where current market conditions make this realistic — not
speculative, not "if everything goes right." Products where similar things
are ALREADY making money and the builder can ship a competitive version
with their specific skills in 1-2 weeks.

### How It Works

```
Builder Profile → Market Scan → Reverse Engineer Winners → Match to Builder →
Score & Rank → Present Top 3 → User Picks → Pipeline Runs
```

### Step 1: Extract Builder Advantages

From the builder profile, list what this person can do BETTER or CHEAPER
than others:

```markdown
## Builder Advantages
- Can build: CLI tools, APIs, infrastructure, monitoring (devops strength)
- Can reach: r/selfhosted (28K members, 4yr account), r/sysadmin (500K members)
- Has: AWS free tier, Vercel, Supabase free tier, X Pro analytics
- Time: 10-15 hrs/week evenings → can ship in 1-2 weeks
- Unique angle: real sysadmin experience → knows real pain points
- Constraint: no frontend, no entity, $0 budget
```

### Step 2: Market Scan — What's Making Money RIGHT NOW

Don't guess what might work. Find what IS working and reverse-engineer it.

#### Product Categories to Scan

Scan across ALL categories — the best opportunity might not be in the
builder's obvious niche:

| Category | Examples | Typical revenue model | Time to build |
|---|---|---|---|
| **Chrome extensions** | Productivity, AI wrappers, page enhancers | Freemium ($5-15/mo) or one-time ($10-30) | 3-7 days |
| **Web apps (SaaS)** | Dashboards, tools, calculators, converters | Subscription ($9-49/mo) | 1-4 weeks |
| **Mobile apps** | Utilities, lifestyle, productivity | In-app purchase or subscription | 2-6 weeks |
| **API services** | Data APIs, AI wrappers, conversion tools | Pay-per-use or subscription | 3-10 days |
| **CLI tools** | Dev tools, automation, scripts | One-time ($20-50) or subscription | 1-2 weeks |
| **Templates/boilerplates** | Starter kits, themes, component packs | One-time ($29-99) | 1-2 weeks |
| **AI wrappers** | ChatGPT/Claude front-ends for specific use cases | Pay-per-use (user pays, covers API cost + margin) | 3-7 days |
| **Browser automation** | Scrapers, auto-fillers, monitoring bots | Subscription ($15-30/mo) | 1-2 weeks |
| **Marketplace apps** | Shopify apps, VS Code extensions, Raycast, Figma plugins | Marketplace cut or subscription | 1-3 weeks |
| **Info products** | Guides, courses, cheat sheets from domain expertise | One-time ($20-100) | 3-5 days |
| **Notification/alert services** | Monitoring, price alerts, stock alerts, keyword alerts | Subscription ($5-20/mo) | 1-2 weeks |

#### Reverse Engineering Successful Products

Search for products that are CURRENTLY making money in each relevant category:

| Source | What to search | What you learn |
|---|---|---|
| **IndieHackers revenue pages** | Filter by revenue range ($1K-$10K MRR), solo founder | What solo builders actually earn, what categories work |
| **ProductHunt recent launches** | Last 90 days, 100+ upvotes, in builder's niche | What's getting traction now, not 2 years ago |
| **Chrome Web Store** | "Recently updated" + builder's niche keywords | What extensions exist, user counts, review complaints |
| **App Store / Play Store** | Top free/paid in utility/productivity categories | Mobile gaps, pricing patterns |
| **GitHub trending** | Past month, builder's languages | What developers want, star velocity |
| **Gumroad/LemonSqueezy discover** | Top sellers in builder's niche | Price points, sales volumes |
| **Reddit builder's subs** | "I built", "I made", "alternative to", "is there a" | What people built AND what people wish existed |
| **X/Twitter** | "launched", "just shipped", "MRR" in builder's niche | Real-time launch signals |
| **last30days (if installed)** | Builder's niche + "tool", "app", "alternative" | 30-day trend signals |

**The process:**
1. Find 10-20 products making $1K+/mo in categories the builder can execute
2. For each: what's their weakness? Bad UX? Missing feature? Overpriced? Narrow niche they're ignoring?
3. Can the builder build a version that's better on ONE dimension in 1-2 weeks?
4. Does the builder have distribution to reach the same audience?

#### Self-Sustaining Infrastructure

**Mandatory:** every recommendation must use infrastructure that starts free
and scales with revenue. The project must self-sustain from day 1.

| Layer | Free tier pick | Scales to | When to pay |
|---|---|---|---|
| **Database** | Supabase (500MB, 50K rows) | Supabase Pro ($25/mo at ~$500 revenue) | Revenue covers it |
| **Hosting** | Vercel (100GB bandwidth) | Vercel Pro ($20/mo) | Revenue covers it |
| **Auth** | Supabase Auth (50K MAU) or Clerk (10K MAU) | Same platform Pro tier | Revenue covers it |
| **Storage** | Supabase Storage (1GB) or Cloudflare R2 (10GB) | Pay as you grow | Revenue covers it |
| **Email** | Resend (3K/mo) or Loops (1K contacts) | Resend $20/mo | Revenue covers it |
| **Payments** | LemonSqueezy (5% + 50¢) or Gumroad (10%) | LemonSqueezy or Stripe when entity exists | From first sale |
| **Analytics** | Plausible (free trial) or Umami (self-hosted free) | Plausible $9/mo | Revenue covers it |
| **AI (if wrapper)** | OpenAI / Anthropic API (user-funded) | Scales linearly with users | Users pay per use |
| **Mobile** | Expo + EAS (30 builds/mo free) | EAS $99/mo | Revenue covers it |

**The rule:** $0 out of pocket until revenue exceeds infra cost. Every cost
is covered by revenue before it's incurred.

### Step 3: Score & Rank

For each opportunity found, score on 6 dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| **Guaranteed revenue** | 30% | Is there PROOF similar products make $1K+/mo? Not "could" — "does." |
| **Builder fit** | 25% | Can THIS builder ship this in 1-2 weeks with their skills? |
| **Distribution fit** | 20% | Can THIS builder reach paying users through existing channels? |
| **Speed to first $** | 15% | Days from "start building" to first payment received |
| **Self-sustaining** | 5% | Does free-tier infra cover it until revenue scales? |
| **Ecosystem value** | 5% | Does this contribute to the builder's larger goal? |

**Disqualifiers (auto-reject regardless of score):**
- Requires skills the builder failed at before (hard veto)
- Takes > 2 weeks to build at builder's pace
- No evidence of anyone paying for similar products
- Requires business entity the builder doesn't have
- Requires upfront capital the builder doesn't have

### Step 4: Present Top 3

Present the top 3 opportunities, each with:

```markdown
## Opportunity 1: <name>
**Category:** <Chrome extension / web app / API / CLI / mobile / template / etc>
**What:** <one sentence>
**Reverse-engineered from:** <specific successful product + its weakness you exploit>
**Evidence:** <who's paying for similar things — specific revenue data, app store rankings, etc>
**Why you:** <specific builder advantages that make this winnable>
**MVP:** <exactly what to build in week 1 — no more>
**Revenue model:** <how money flows>
**Price point:** <specific price, based on what competitors charge>
**Payment method:** <what works given builder's entity status>
**Infra stack:** <all free tier — Supabase + Vercel + LemonSqueezy etc>
**Build time:** <days, not weeks — at builder's hours/week>
**Distribution plan:** <how to get first 20 paying users — specific channels>
**Month 1 revenue estimate:** <conservative based on evidence>
**Revenue ceiling:** <where this tops out>
**Ecosystem value:** <does this feed the builder's bigger idea? how?>
**Risk:** <what could go wrong>
**Score:** <total / 100>
```

### Step 5: User Picks → Pipeline Runs

When the user picks an opportunity:
1. Use the opportunity as the input to `write-vision`
2. The vision incorporates the builder profile constraints + infra choices
3. `validate-feature` runs with the opportunity's evidence pre-loaded
4. The full pipeline runs from there

**If user says "none of these":** ask what's wrong. Rescan with adjusted criteria.
**If user says "just pick the best one":** P0 picks #1, logs as taste decision, runs the pipeline.
**If user says "build my idea anyway":** respect it. Run the pipeline on their
idea. But see Staging Strategy below.

### AI Wrapper / Pay-Per-Use Model

Special attention to AI wrappers — they're the fastest path to revenue for
many builders right now:

**The model:** user pays $X per use → you take margin → API cost is covered
by the user. You never pay out of pocket for API costs.

**When to recommend wrappers:**
- Builder can code an API integration (most can)
- There's a specific use case where a general chatbot is 10x worse than a
  purpose-built interface (e.g., "AI that writes Shopify product descriptions"
  vs "ask ChatGPT to write product descriptions")
- The niche is specific enough that SEO or community distribution works

**Launch multiple?** If the builder's skills allow it and each wrapper takes
3-5 days, launching 3 wrappers simultaneously is a valid strategy. Different
niches, same tech stack, shared infra. If one hits, double down. If none
hit in 30 days, pivot.

### Staging Strategy

When the user has a BIG idea (their real vision) but needs money first:

**Stage 1: Revenue project (1-2 weeks)**
Build something that generates $1K/mo fast. This can be:
- **Related to the big idea** (best case) — a small tool in the same space
  that earns money AND builds audience AND teaches the domain. Example: big
  idea is "full monitoring platform" → Stage 1 is "uptime checker Chrome
  extension" that builds an audience of the exact users who'll want the
  platform later.
- **Tangentially related** — same target audience, different product. Builds
  distribution for the big idea. Example: big idea is "AI code review tool"
  → Stage 1 is "VS Code extension that formats error messages" — same
  audience (developers), earns money, builds install base.
- **Totally unrelated** (last resort) — pure revenue play. Doesn't feed the
  big idea but funds it. Example: AI wrapper for real estate listings while
  the big idea is a developer tool.

**Stage 2: Reinvest (month 2-3)**
Revenue from Stage 1 funds:
- Better tools (Claude Max, paid infra, design tools)
- Business entity registration
- Stripe setup
- Maybe a contractor for weak skills (frontend, design)

**Stage 3: The real thing (month 3+)**
Now build the big idea with:
- Revenue covering costs
- Audience from Stage 1 (if related)
- Better tools from Stage 2
- Proven builder confidence from shipping Stage 1

**Pipeline behavior when staging:**

When the user provides an idea AND the builder profile shows no capital:
1. Evaluate the idea normally (validate-feature with kill signals)
2. If the idea is NOT a fast-money play (takes > 2 weeks, no proven revenue model):
   - Present: "Your idea is solid but it's a 2-month build with no revenue
     until launch. Here's a staging plan:"
   - Propose a Stage 1 project that feeds into the big idea
   - User chooses: Stage 1 first → big idea later, or "build my idea anyway"
3. If the idea IS a fast-money play: just build it
4. "Build my idea anyway" is ALWAYS available — no gatekeeping

### First Project Rules

When the builder profile shows first project or no capital:

1. **Must ship in 1-2 weeks** at builder's hours/week. Not 6 weeks. 1-2.
2. **Must not require skills the builder has failed at.** Hard veto.
3. **Must have built-in distribution** through existing channels. No cold start.
4. **Must work without a business entity.** LemonSqueezy/Gumroad/Dodo.
5. **Revenue model must be dead simple.** One price, one product.
6. **Must be boring.** Proven demand. Reverse-engineered from existing winners.
7. **Must self-sustain on free tiers.** $0 until revenue exceeds cost.
8. **Must have evidence of $1K+/mo** from similar products. Not "could" — "does."
9. **Must be something the builder would use themselves.** Dogfooding = motivation.

The builder's journey:
```
$0 → ship in 1-2 weeks → first paying user → $1K/mo month 1 →
register entity → Stripe → reinvest → build the real thing
```

The pipeline optimizes for wherever the builder IS in this chain.

