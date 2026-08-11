### 0. Mine the Builder Profile

Before deciding WHAT to build or HOW, understand WHO is building. The builder
profile captures the user's real-world context — financial situation, time,
skills, team, tools, business entity, and goals. This is project-agnostic
and reusable across everything they build.

**The interview happens ONCE.** After that, it's just a quick change-check.

**Check for existing profile:** `~/.svc/builder-profile.md` (global, persists
across projects). If it exists, read it and present a one-line summary:
"Builder profile: [role], [budget], [time], [key skill], [distribution].
Anything changed?" If the user says no → move on. If they mention changes →
update the specific sections.

**If no profile exists:** mine it as part of the first prompt flow.
- **In autorun mode:** interview is woven into the single prompt. The user's
  initial message often contains most of the signal ("I'm a devops guy with
  a 9-5, want to make side money"). Extract what you can, ask 2-3 critical
  unknowns, create the profile, and continue the pipeline — all in one flow.
- **In interactive mode:** ask one cluster at a time. Don't interrogate.
  Infer what you can from context.

**Subsequent sessions:** profile pops up only if something might have changed:
- New project started → "Anything changed since last time? New skills, tools, revenue?"
- 30+ days since last update → "Quick check: your profile says [X]. Still accurate?"
- User mentions something contradicting profile → update silently or confirm


## Financial Context
- **Budget for this project:** <what they can invest: $0 / $100/mo / $5K seed / etc>
- **Income source:** <employed full-time / freelance / funded / savings>
- **Revenue pressure:** <need income ASAP / can wait 6 months / no pressure>
- **Payment infrastructure:** <no company yet / sole proprietor / LLC / can accept payments via X>
- **First revenue target:** <$100/mo to cover tools / $2K/mo to quit job / $10K MRR / etc>

## Time Context
- **Hours per week available:** <5 evenings / 20 part-time / 40+ full-time>
- **Employment status:** <9-5 employed / freelance flexible / full-time on this>
- **Deadline pressure:** <ship in 2 weeks / 3 months / no deadline>
- **Timezone/availability:** <when they work on this>

## Skills & Strengths
- **Technical:** <languages, frameworks, infra — what they can build themselves>
- **Non-technical:** <marketing, sales, design, copywriting, domain expertise>
- **Gaps:** <what they can't do — critical for team/tool recommendations>

## Team & Network
- **Solo or team:** <solo / co-founder (their skills) / contractor budget>
- **Network leverage:** <"I know a marketer" / "my friend does DevOps" / "I have 5K Twitter followers">
- **Advisor access:** <domain experts, mentors, potential customers they can reach>

## Distribution & Social Presence

**Capture EVERYTHING — even if it seems irrelevant to the current project.**
The builder profile is about the person, not the project. A 4-year-old Reddit
account with karma history is a trust asset even if the builder never plans
to post about this product there. An X Pro subscription is a paid tool that
enables long-form posts and analytics. 300 Twitter followers with zero replies
is a dormant channel — but the account exists and has history, which beats
creating one from scratch.

The pipeline decides what's useful per project. The builder just reports
what they have.

For each platform, capture these dimensions:

| Dimension | What to ask | Why it matters |
|---|---|---|
| **Account age** | "How old is your account?" | Older accounts have trust signals (Reddit karma aging, Twitter history). Platforms penalize new accounts. |
| **Follower/connection count** | Raw number | Reach ceiling. But meaningless without engagement. |
| **Engagement quality** | "Do people reply? DM you? Share your stuff?" | 300 followers with 0 replies = dead channel. 300 with 10 replies per post = warm niche audience. |
| **Niche/audience type** | "Who follows you? What do they care about?" | Tech devs vs marketers vs designers = different products you can sell to them. |
| **Posting frequency** | "How often do you post?" | Active = warm channel. Dormant = needs reactivation time before launch. |
| **Paid features** | "Any paid subscriptions? Pro, Premium, etc?" | X Pro = long posts + analytics. LinkedIn Premium = InMail. Reddit Premium = no ads, access to r/lounge. These are tools. |
| **Content history** | "What do you usually post about?" | Existing content = established authority in a topic. Pivoting topics costs trust. |
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

### What the Pipeline Does With This

Distribution is the #1 predictor of whether a product succeeds. The pipeline
needs to know what channels already exist so it can:
- **Pre-validate** by posting to existing audience before building
- **Choose what to build** — pick products that match where the audience already is
- **Plan launch strategy** — organic distribution via existing channels vs cold start
- **Estimate time to first revenue** — existing audience = days; no audience = months
- **Identify dormant assets to reactivate** — a 4-year Reddit account in the right
  sub is a warm intro away from being a distribution channel

**Engagement > follower count.** 500 engaged niche followers who reply and DM
beats 50K passive followers. When mining, ask about replies, DMs, and
conversion (have they ever sold anything to this audience?).

**Account age and history matter independently of follower count.** Platforms
trust aged accounts. A 4-year Reddit account can post in subreddits that ban
new accounts. An 8-year Twitter account has algorithmic trust that a new
account takes months to build. Even if the account is dormant, the age is
an asset — note it.

**Paid subscriptions are tools.** X Pro, LinkedIn Premium, Reddit Premium,
YouTube channel membership — these unlock features (analytics, reach,
posting formats) that the pipeline should leverage rather than ignore.

## Existing Infrastructure
- **Subscriptions:** <list what they already pay for: Vercel, AWS free tier, Supabase, etc>
- **Free tiers available:** <what they haven't used yet but could>
- **Domains:** <owned domains>
- **Tools:** <IDE, design tools, analytics, etc>
- **Existing codebases:** <repos, templates, boilerplate they can reuse>

## Business Situation
- **Entity status:** <no company / sole proprietor / LLC / registered business>
- **Can accept payments:** <yes via Stripe / no, need Gumroad/Dodo/LemonSqueezy / not yet>
- **Tax/legal:** <any constraints — VAT threshold, jurisdiction, employment contract limitations>
- **Existing customers/audience:** <email list, users, community, nothing yet>

## Strategic Goal
- **Why building this:** <side income / replace job / startup / scale existing / learning>
- **Risk tolerance:** <conservative-first-project / moderate / aggressive-experienced-founder>
- **Success definition:** <$500/mo passive / 1000 users / raise seed round / prove concept>
- **Exit horizon:** <keep forever / flip in 2 years / build to raise>

## Project History

Past projects — shipped, abandoned, or failed. Each one is signal.

### <Project Name> — <outcome: shipped / abandoned / failed / ongoing>
- **What:** <one sentence — what was it?>
- **When:** <date range>
- **Stack:** <what was built with>
- **Reached:** <furthest milestone: idea / prototype / launched / revenue / scaled>
- **Revenue:** <peak revenue, if any>
- **Why it ended:** <honest reason — ran out of time? no users? couldn't do marketing? lost motivation? co-founder left?>
- **Reusable assets:** <code, infra, domain, learnings, customer list, anything salvageable>
- **What you'd do differently:** <the insight that only comes from having done it>

(Repeat for each past project. Even side projects and hackathon entries count.)

### How project history changes the pipeline

The pipeline reads ALL past projects and extracts patterns:

- **Repeated failure mode** → pipeline actively guards against it. If 2/3 past
  projects died because the builder couldn't do marketing, the pipeline will
  not recommend marketing-heavy strategies. It will pick products with built-in
  distribution (marketplace apps, integrations, SEO-driven tools).
- **Successful patterns** → pipeline leans into them. If the builder shipped a
  CLI tool successfully but failed at a SaaS, the pipeline biases toward CLI
  tools, VS Code extensions, or developer utilities.
- **Reusable assets** → pipeline checks if any past code, infra, domains, or
  customer relationships can be leveraged for the current project.
- **Time estimation** → if the builder consistently underestimates by 2x, the
  pipeline adds a multiplier to task estimates silently.
- **Motivation patterns** → if the builder abandons projects at month 3, the
  pipeline scopes MVPs to ship in 4-6 weeks, not 3 months.

## Builder Patterns (learned over time)

This section is EMPTY on first run. It gets populated by the pipeline as
projects are executed. After each project (shipped or abandoned), the
pipeline appends patterns here.

### Pattern format:
- **[pattern-id] <description>** — confidence: <1-10>, observed: <N> times
  Source: <which projects demonstrated this>
  Pipeline action: <what the pipeline does differently because of this>

### Example patterns (populated after real projects):
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

## Tool & Capability Gap Analysis

Based on the builder's skills, tools, and project history, identify what's
MISSING that would unlock the next level. This isn't a shopping list — it's
a strategic assessment of where the ceiling is.

### Current capabilities (auto-derived from profile)
<filled in by the pipeline — maps skills + tools + subscriptions to capabilities>

### Gaps blocking next milestone
<filled in by the pipeline — what the builder can't do that the project needs>

### Recommendations
<filled in by the pipeline — specific tools, skills to learn, or people to find>

### Example gap analysis:
```
Current capabilities:
  ✓ Backend development (Node.js, Python)
  ✓ Infrastructure (AWS free tier, Vercel)
  ✓ Version control (GitHub)
  ✗ Frontend (no framework experience, stalls on UI)
  ✗ Marketing (no distribution, no copywriting)
  ✗ Design (no Figma, no design system)
  ✗ Payments (no entity, no Stripe)

Gaps blocking "$500/mo revenue" milestone:
  1. No payment processing → can't collect money
     FIX: LemonSqueezy (no entity needed, handles VAT) — $0 until first sale
  2. No frontend skills → can't build user-facing product
     FIX (pick one):
       a) Use v0.dev + shadcn/ui (AI-generated UI, minimal frontend skill needed)
       b) Build CLI/API tools instead (plays to backend strength)
       c) Find frontend co-founder (check network section)
  3. No distribution → product will ship to 0 users
     FIX (pick one):
       a) Build for a marketplace (VS Code, Shopify, Raycast — built-in distribution)
       b) Build SEO-driven tool (people Google for it)
       c) Reactivate dormant Reddit account (4yr old, has trust) — 3 week warmup
       d) Spend $50/mo on one ad channel to validate before scaling

Proactive tool recommendations:
  - LemonSqueezy ($0/mo until revenue) → unblocks payments without entity
  - v0.dev (free tier) → generates React components from prompts → unblocks frontend
  - Plausible Analytics ($9/mo) or Umami (free, self-hosted) → know if anyone visits
  - Resend (free tier, 3K emails/mo) → transactional + basic marketing email
```
```

**How to mine it:** Don't ask all sections as a form. Read what the user already
said — their prompt often reveals budget, skills, and urgency implicitly. Fill
in what you can infer, then ask about the 2-3 most impactful unknowns:

- If they mention a 9-5 job → time-constrained, income exists, probably needs side revenue
- If they mention "first project" → conservative strategy, no entity, free tiers
- If they mention a co-founder → capture their skills, affects what to build
- If they mention subscriptions → log them, affects tech choices
- If they say "I can invest $X" → budget ceiling, affects build-vs-buy
- If they mention any social handle → ask follower count + engagement + niche
- If they post content anywhere → that's a distribution channel, capture it
- If they have no social presence → flag it, plan for cold-start distribution

**The builder profile changes what the pipeline recommends:**

| Builder situation | Pipeline impact |
|---|---|
| No capital, first project, 9-5 job | Find validated business to undercut cheaply. Free tiers only. Dodo/Gumroad payments. Ship in weekends. Target: first $100/mo. |
| Some capital ($500/mo), has marketer friend | Leverage the marketer. Pick a niche where marketing > engineering. Modest paid tools OK. |
| Funded / has company / Stripe ready | Build the vision. Use best tools. Move fast. Paid infra OK from day 1. |
| Technical + non-technical co-founder | Split by strength. Technical builds, co-founder validates with customers. Affects persona creation. |
| Has existing audience (5K followers, email list) | Pre-validation via audience. Can ship smaller MVP because distribution exists. |
| Has company, can get new clients | Can build internal tools that become products. Can validate with existing clients. |
| Strong Twitter/X in dev niche (1K+ engaged) | Build dev tools, open-source with paid tier, or info products. Launch via threads + ProductHunt. Audience IS the validation — poll before building. |
| Twitter/X with followers but zero engagement | Dormant channel. Don't plan launch around it. But: account age + history = algorithmic trust. Reactivation plan: 2-3 weeks of posting before launch, not day-of. Factor reactivation time into timeline. |
| X Pro / Premium subscription | Long-form posts, analytics, creator tools. Use analytics to understand existing audience before building. Long posts = mini-blog without needing a blog. |
| Active newsletter (500+ subs, 40%+ open rate) | Newsletter audience is a pre-sold customer base. Build what they ask for. Waitlist = validation. |
| YouTube channel (1K+ subs) | Video-friendly products: tutorials→SaaS, course platforms, tools you can demo. Launch content is free. |
| Reddit with aged account (2+ years) + karma | Trust asset. Can post in gated subreddits. Build tools that solve problems repeated in those subs. Don't self-promote — solve the problem, mention the tool in context. Account age bypasses new-account restrictions that kill cold-start distribution. |
| Reddit with aged account but low/no karma | Account exists and is trusted by age. Needs karma building: 2-4 weeks of genuine participation in target subs before any product mention. Factor this into launch timeline. |
| GitHub presence (popular repos) | Open-source core → paid cloud/pro. Existing stargazers are early adopters. README is your landing page. |
| LinkedIn with industry connections | B2B distribution channel. If building for professionals in their industry, LinkedIn posts + DMs are the channel. Premium unlocks InMail for cold outreach. |
| No social presence at all | Cold start. Build for SEO (tools people Google for), marketplaces (Shopify apps, VS Code extensions), or communities where you can earn trust first. Budget 30-50% of time for distribution, not just building. |

**Revenue jump-in points (advise based on profile):**

| Revenue target | Approach | Timeline | Typical tools |
|---|---|---|---|
| $0 → $1K/mo | Reverse-engineer a winner. Ship in 1-2 weeks. Free-tier stack. Proven distribution channel. | Month 1 | LemonSqueezy, Supabase free, Vercel free |
| $1K → $3K/mo | Double down on what's working OR launch 2-3 variants. Register entity. | Month 2-3 | Sole proprietorship, Stripe, reinvest in tools |
| $3K → $10K/mo | Build the real thing (Stage 3). Use audience + revenue from Stage 1. Hire for weak skills. | Month 3-6 | Full infra, contractor budget, paid tools |
| $10K+ /mo | Product-market fit exists. Scale channels. Systematize. | Month 6+ | Full business infrastructure |

### Builder Profile Learning Loop

The profile isn't static. It gets smarter after every project. This happens
at two points:

**1. After verify-promotion (project shipped):**
Update the builder profile:
- Add project to Project History with outcome `shipped`
- Update skills (did they learn a new framework? use a new tool?)
- Update financial context (did revenue start? did they register an entity?)
- Update social presence (did they grow followers? launch on ProductHunt?)
- Run pattern detection: compare this project's timeline, decisions, and
  outcome against past projects. If a new pattern emerges (or an existing
  one is reinforced), append to Builder Patterns.
- Run gap analysis: what blocked them this time? What tool would have saved
  the most time? Append recommendation.

**2. After project abandonment:**
This is the MOST valuable update. Triggers:
- User explicitly says "I'm stopping this" / "abandoning" / "moving on"
- User starts a NEW project via `route-workflow` while a previous project has
  an unmerged feature branch (route-workflow detects this at Session Setup by
  checking `git worktree list` and `git branch --no-merged main`)
- User hasn't touched the project in 30+ days and starts a new session
  (route-workflow checks `git log -1 --format=%ci` at session start)

When triggered, ask:
- "What was the real reason you stopped?"
- Add project to history with outcome `abandoned` and honest reason
- Check: does this match a pattern? If 2+ projects died the same way, create
  or strengthen a Builder Pattern with high confidence.
- Check: was there a tool, skill, or person that could have prevented this?
  Update gap analysis.

**3. Proactively during pipeline (any skill):**
If the pipeline notices something that contradicts or updates the builder
profile, flag it:
- "Your profile says you can't do frontend, but you just wrote a React
  component. Should I update your skills?"
- "You said budget is $0 but you just signed up for a $20/mo service.
  Updated budget context."
- "Your X engagement jumped — you got 50 replies on your last post.
  Updating social presence from 'dormant' to 'warming up'."

```bash
# After any profile update, create the section once, then append one bullet:
if ! rg -q "^## Changelog$" ~/.svc/builder-profile.md; then
  printf "\n## Changelog\n" >> ~/.svc/builder-profile.md
fi
printf -- "- %s: %s\n" "$(date +%Y-%m-%d)" "<what changed and why>" >> ~/.svc/builder-profile.md
```
