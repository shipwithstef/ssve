### Step 3: Mine Social Presence (Deep)

Distribution is the #1 predictor of whether a product succeeds. Mine this
thoroughly. For each platform the builder mentions (or that you discover),
capture these dimensions:

| Dimension | What to ask | Why it matters |
|---|---|---|
| **Account age** | "How old is your account?" | Older accounts have trust signals. Platforms penalize new accounts. |
| **Follower/connection count** | Raw number | Reach ceiling. Meaningless without engagement. |
| **Engagement quality** | "Do people reply? DM you? Share your stuff?" | 300 followers with 0 replies = dead channel. 300 with 10 replies per post = warm niche audience. |
| **Niche/audience type** | "Who follows you? What do they care about?" | Tech devs vs marketers vs designers = different products you can sell to them. |
| **Posting frequency** | "How often do you post?" | Active = warm channel. Dormant = needs reactivation time before launch. |
| **Paid features** | "Any paid subscriptions? Pro, Premium, etc?" | X Pro = long posts + analytics. LinkedIn Premium = InMail. These are tools. |
| **Content history** | "What do you usually post about?" | Existing content = established authority. Pivoting topics costs trust. |
| **Conversion history** | "Have you ever sold anything to this audience?" | Proven conversion > theoretical reach. Even one sale proves the channel works. |

### Per-Platform Capture

- **Twitter/X:** handle, followers, engagement (replies per post), niche, account age, Pro/Premium?, content type, ever sold anything?
- **LinkedIn:** connections, industry, posting frequency, engagement (comments per post), Premium?
- **YouTube:** subscribers, avg views/mo, content type, monetized?
- **TikTok/Instagram:** followers, engagement rate, content type, Reels performance
- **Reddit:** account age, karma (post + comment separately), active subreddits, moderator of any?, posting history in niche subs
- **Newsletter/Blog:** subscriber count, open rate, click rate, platform (Substack/Beehiiv/Ghost/etc), paid tier?
- **Discord/Slack communities:** own a server (member count)? active member of relevant ones (which)?
- **GitHub:** followers, popular repos (stars), contribution history, profile README?
- **ProductHunt/IndieHackers:** past launches (rankings), karma, community engagement
- **Podcast:** own one (listener count)? guest appearances? reach?
- **Other:** forums, Hacker News karma, Stack Overflow rep, Dribbble, Behance, niche communities

**Capture EVERYTHING — even if it seems irrelevant to the current project.**
The builder profile is about the person, not the project. A 4-year-old Reddit
account with karma history is a trust asset even if the builder never plans to
post about this product there. An X Pro subscription is a paid tool that enables
long-form posts and analytics. 300 Twitter followers with zero replies is a
dormant channel — but the account exists and has history, which beats creating
one from scratch.

**Engagement > follower count.** 500 engaged niche followers who reply and DM
beats 50K passive followers. When mining, ask about replies, DMs, and conversion
(have they ever sold anything to this audience?).

**Account age and history matter independently of follower count.** Platforms
trust aged accounts. A 4-year Reddit account can post in subreddits that ban
new accounts. An 8-year Twitter account has algorithmic trust that a new account
takes months to build. Even if the account is dormant, the age is an asset —
note it.

**Paid subscriptions are tools.** X Pro, LinkedIn Premium, Reddit Premium,
YouTube channel membership — these unlock features (analytics, reach, posting
formats) that the pipeline should leverage rather than ignore.

### Step 4: Mine Project History

For each past project (shipped, abandoned, or failed), capture:

```markdown
### <Project Name> — <outcome: shipped / abandoned / failed / ongoing>
- **What:** <one sentence — what was it?>
- **When:** <date range>
- **Stack:** <what was built with>
- **Reached:** <furthest milestone: idea / prototype / launched / revenue / scaled>
- **Revenue:** <peak revenue, if any>
- **Why it ended:** <honest reason — ran out of time? no users? couldn't do marketing? lost motivation? co-founder left?>
- **Reusable assets:** <code, infra, domain, learnings, customer list, anything salvageable>
- **What you'd do differently:** <the insight that only comes from having done it>
```

Even side projects and hackathon entries count. The purpose is pattern detection,
not judgment.

### Step 5: Run Pattern Detection

Read ALL past projects and extract patterns. This section is EMPTY on first run
if the builder has no project history. It gets populated when there are 2+ projects.

**Pattern detection rules:**

- **Repeated failure mode** (2+ projects died the same way) -- pipeline actively
  guards against it. If 2/3 past projects died because the builder could not do
  marketing, the pipeline will not recommend marketing-heavy strategies. It will
  pick products with built-in distribution (marketplace apps, integrations,
  SEO-driven tools).
- **Successful patterns** (builder shipped successfully in a specific mode) --
  pipeline leans into them. If the builder shipped a CLI tool successfully but
  failed at a SaaS, the pipeline biases toward CLI tools, VS Code extensions, or
  developer utilities.
- **Reusable assets** -- pipeline checks if any past code, infra, domains, or
  customer relationships can be leveraged for the current project.
- **Time estimation accuracy** -- if the builder consistently underestimates by
  2x, the pipeline adds a multiplier to task estimates silently.
- **Motivation patterns** -- if the builder abandons projects at month 3, the
  pipeline scopes MVPs to ship in 4-6 weeks, not 3 months.

**Pattern format:**

```markdown
- **[pattern-id] <description>** — confidence: <1-10>, observed: <N> times
  Source: <which projects demonstrated this>
  Pipeline action: <what the pipeline does differently because of this>
```

**Example patterns (populated after real projects):**

- **[timeline-2x] Estimates are 2x optimistic** — confidence: 8, observed: 3 times
  Source: Project A (est 2wk, took 5wk), Project B (est 1mo, took 2.5mo)
  Pipeline action: multiply all task estimates by 2x in plan-changeset
- **[frontend-stall] Stalls on frontend work** — confidence: 7, observed: 2 times
  Source: Project A (backend done in 3 days, frontend took 3 weeks), Project C (abandoned at UI phase)
  Pipeline action: recommend Tailwind + shadcn/ui, pre-built templates, or co-founder/contractor for frontend
- **[marketing-gap] Products get built but never launched** — confidence: 9, observed: 3 times
  Source: Project A (shipped, 0 users), Project B (shipped, told no one), Project C (shipped, "will market later")
  Pipeline action: require distribution plan BEFORE build starts, bake launch into the pipeline, not after
- **[solo-strength] Ships fast when scope is small + solo** — confidence: 8, observed: 2 times
  Source: Project D (CLI tool, shipped in 1 week, 500 users), Project E (API wrapper, shipped in 3 days)
  Pipeline action: bias toward small-scope solo projects, avoid team-dependent plans

### Step 6: Run Gap Analysis

Based on the builder's skills, tools, and project history, identify what is
MISSING that would unlock the next level. This is not a shopping list — it is
a strategic assessment of where the ceiling is.

**Gap analysis structure:**

```markdown
### Current capabilities (auto-derived from profile)
<maps skills + tools + subscriptions to capabilities>

### Gaps blocking next milestone
<what the builder can't do that the project needs>

### Recommendations
<specific tools, skills to learn, or people to find>
```

**Example gap analysis:**

```
Current capabilities:
  + Backend development (Node.js, Python)
  + Infrastructure (AWS free tier, Vercel)
  + Version control (GitHub)
  - Frontend (no framework experience, stalls on UI)
  - Marketing (no distribution, no copywriting)
  - Design (no Figma, no design system)
  - Payments (no entity, no Stripe)

Gaps blocking "$500/mo revenue" milestone:
  1. No payment processing -> can't collect money
     FIX: LemonSqueezy (no entity needed, handles VAT) — $0 until first sale
  2. No frontend skills -> can't build user-facing product
     FIX (pick one):
       a) Use v0.dev + shadcn/ui (AI-generated UI, minimal frontend skill needed)
       b) Build CLI/API tools instead (plays to backend strength)
       c) Find frontend co-founder (check network section)
  3. No distribution -> product will ship to 0 users
     FIX (pick one):
       a) Build for a marketplace (VS Code, Shopify, Raycast — built-in distribution)
       b) Build SEO-driven tool (people Google for it)
       c) Reactivate dormant Reddit account (4yr old, has trust) — 3 week warmup
       d) Spend $50/mo on one ad channel to validate before scaling

Proactive tool recommendations:
  - LemonSqueezy ($0/mo until revenue) -> unblocks payments without entity
  - v0.dev (free tier) -> generates React components from prompts -> unblocks frontend
  - Plausible Analytics ($9/mo) or Umami (free, self-hosted) -> know if anyone visits
  - Resend (free tier, 3K emails/mo) -> transactional + basic marketing email
```
