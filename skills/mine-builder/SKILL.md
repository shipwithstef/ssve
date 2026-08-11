---
name: mine-builder
version: "1.0"
description: >
  Mine the builder's real-world context — finances, time, skills, team, social
  presence, tools, entity, goals, project history, failure patterns. Creates or
  updates ~/.svc/builder-profile.md. Run once per builder, update on subsequent
  sessions. Use when: first pipeline run, "update my profile", "anything changed",
  or automatically at session start.
phases:
  - id: P1-ProfileModeDetection
    trigger: always
    reads: ["~/.svc/builder-profile.md", "task request"]
    writes: [".svc/mine-builder-mode.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ContextInferenceQuestionCluster
    trigger: always
    reads: ["user prompt", "existing builder profile"]
    writes: [".svc/mine-builder-inference.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-SocialProjectHistoryMining
    trigger: always
    reads: ["builder responses", "social presence", "past projects"]
    writes: ["~/.svc/builder-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-PatternGapAnalysis
    trigger: always
    reads: ["project history", "skills", "tools", "distribution"]
    writes: ["~/.svc/builder-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ProfileWriteOrUpdate
    trigger: always
    reads: ["profile draft", "profile changelog", "builder confirmations"]
    writes: ["~/.svc/builder-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["~/.svc/builder-profile.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
outputs:
  produces:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Mine the Builder Profile

Understand WHO is building before deciding WHAT to build or HOW. The builder
profile captures the user's real-world context — financial situation, time,
skills, team, tools, business entity, social presence, and goals. This is
project-agnostic and reusable across everything they build.

**The gap this fills:** Without this skill, the pipeline treats every builder
identically. A funded full-time founder and a 9-5 employee with 5 evening hours
get the same recommendations. The result: plans that are technically correct but
practically impossible — 3-month MVPs for people who abandon at month 3,
marketing-heavy strategies for builders with zero distribution, payment
integrations for people without a business entity.

**Announce at start:** "I'm using mine-builder to understand your situation before
we plan anything."

---

## Modes

### Mode 1: First-Time Interview

Triggered when `~/.svc/builder-profile.md` does not exist. Deep interview that
creates the full profile. Happens once per builder.

### Mode 2: Change-Check

Triggered when `~/.svc/builder-profile.md` exists. Quick summary and
confirmation. Updates only what changed.

### Mode 3: Post-Project Update

Triggered after a project ships (verify-promotion) or is abandoned. Updates
project history, patterns, and gap analysis.

### Mode 4: Proactive Update

Triggered when the pipeline notices something that contradicts the profile
during normal operation.

---

## Mode 1: First-Time Interview

### Step 0: Check for Existing Profile

```
ls ~/.svc/builder-profile.md
```

If the file exists, switch to Mode 2. If not, proceed with the interview.

### Step 1: Extract Before Asking

Read the user's initial message and any available context. Their prompt often
reveals budget, skills, and urgency implicitly. Fill in what you can infer
before asking a single question.

**Inference rules:**

| Signal in user's message | What to infer |
|---|---|
| Mentions a 9-5 job | Time-constrained, income exists, probably needs side revenue |
| Says "first project" | Conservative strategy, no entity, free tiers only |
| Mentions a co-founder | Capture their skills, affects what to build |
| Lists subscriptions/tools | Log them, affects tech choices and budget |
| Says "I can invest $X" | Budget ceiling, affects build-vs-buy decisions |
| Mentions any social handle | Ask follower count + engagement + niche |
| Posts content anywhere | That is a distribution channel, capture it |
| Has no social presence | Flag it, plan for cold-start distribution |
| Says "I'm a [role]" | Primary technical skill, implies strengths and gaps |
| Mentions past projects | Extract outcomes, stack, timeline, reason for ending |

### Step 2: Ask Critical Unknowns

After extracting what you can, identify the 2-3 most impactful unknowns and
ask them. Do not interrogate with a 20-question form. Cluster related questions
naturally.

**Priority order for unknowns (ask the highest-impact ones first):**

1. **Time** — how many hours/week, when, employed or not (affects everything)
2. **Revenue goal** — what does success look like financially (sets strategy)
3. **Skills** — what can they build themselves (determines feasible products)
4. **Distribution** — where is their audience, if any (determines launch plan)
5. **Past projects** — what shipped, what died, why (reveals patterns)
6. **Budget** — what they can invest (determines tool choices)
7. **Business entity** — can they accept payments (determines payment stack)

**Interview behavior by mode:**

- **Interactive mode:** Ask one cluster at a time. Wait for the answer. Do not
  dump all questions at once. Infer aggressively, confirm lightly.
- **Autorun mode:** The interview is woven into the single prompt. Extract what
  you can from the initial message, ask 2-3 critical unknowns, create the
  profile, and continue the pipeline — all in one flow.

### Questioning Anti-Patterns

- **Do not walk through checklists** — asking "What's your budget? OK. What's your time? OK. What are your skills?" is the #1 anti-pattern. Instead: read context, infer what you can, then ask the 2-3 most impactful unknowns.
- **Progressive depth** — start broad ("Tell me about yourself and what you want to build"), dig where interesting.
- **No corporate speak** — "What are your core competencies?" → "What are you good at?"
- **Infer before asking** — if the user said "I'm a devops engineer at a startup", you already know: technical (infra), employed, probably Linux/AWS/Docker. Don't ask what they already told you.

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

### Step 7: Write the Profile

Write `~/.svc/builder-profile.md` using the full template below.

---

## Builder Profile Template

```markdown
# Builder Profile

Last updated: <date>

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

### Twitter/X
- Handle: <handle>
- Followers: <count>
- Account age: <years>
- Engagement: <replies per post avg>
- Niche: <who follows, what they care about>
- Paid features: <Pro/Premium?>
- Content type: <what they post about>
- Conversion history: <ever sold anything to this audience?>

### LinkedIn
- Connections: <count>
- Industry: <primary industry>
- Posting frequency: <how often>
- Engagement: <comments per post avg>
- Premium: <yes/no>

### Reddit
- Account age: <years>
- Karma: <post karma / comment karma>
- Active subreddits: <list>
- Moderator: <of any subs?>
- Niche posting history: <relevant sub activity>

### YouTube
- Subscribers: <count>
- Avg views/mo: <count>
- Content type: <what they make>
- Monetized: <yes/no>

### Newsletter/Blog
- Platform: <Substack/Beehiiv/Ghost/etc>
- Subscribers: <count>
- Open rate: <percentage>
- Click rate: <percentage>
- Paid tier: <yes/no>

### GitHub
- Followers: <count>
- Popular repos: <stars>
- Contribution history: <active/sporadic/dormant>

### Discord/Slack
- Own server: <name, member count>
- Active in: <relevant communities>

### ProductHunt/IndieHackers
- Past launches: <ranking>
- Community engagement: <level>

### Other
- <HN karma, SO rep, Dribbble, Behance, podcasts, niche forums>

(Remove sections for platforms where the builder has no presence. Keep sections
for dormant accounts — the account existing is itself an asset.)

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

### <Project Name> — <outcome: shipped / abandoned / failed / ongoing>
- **What:** <one sentence — what was it?>
- **When:** <date range>
- **Stack:** <what was built with>
- **Reached:** <furthest milestone: idea / prototype / launched / revenue / scaled>
- **Revenue:** <peak revenue, if any>
- **Why it ended:** <honest reason>
- **Reusable assets:** <code, infra, domain, learnings, customer list, anything salvageable>
- **What you'd do differently:** <the insight that only comes from having done it>

(Repeat for each past project. Even side projects and hackathon entries count.)

## Builder Patterns (learned over time)

This section is EMPTY on first run. It gets populated by the pipeline as
projects are executed. After each project (shipped or abandoned), the pipeline
appends patterns here.

### Pattern format:
- **[pattern-id] <description>** — confidence: <1-10>, observed: <N> times
  Source: <which projects demonstrated this>
  Pipeline action: <what the pipeline does differently because of this>

## Tool & Capability Gap Analysis

### Current capabilities (auto-derived from profile)
<filled in by the pipeline — maps skills + tools + subscriptions to capabilities>

### Gaps blocking next milestone
<filled in by the pipeline — what the builder can't do that the project needs>

### Recommendations
<filled in by the pipeline — specific tools, skills to learn, or people to find>

## Changelog
- <date>: Profile created via mine-builder interview
```

---

## Mode 2: Change-Check

Triggered when `~/.svc/builder-profile.md` already exists.

### Step 1: Read and Summarize

Read the existing profile. Present a one-line summary:

```
Builder profile: [role], [budget], [time], [key skill], [distribution].
Anything changed?
```

### Step 2: Branch on Response

- **User says "no" / "looks good" / moves on** -- proceed to the pipeline.
  No update needed.
- **User mentions changes** -- update the specific sections they mention.
  Do not re-interview everything.
- **User says "update my profile"** -- run through each section briefly,
  asking "Still accurate?" for each. Update what changed.

### Step 3: Contextual Triggers

The change-check is more proactive in these situations:

| Trigger | What to ask |
|---|---|
| New project started | "Anything changed since last time? New skills, tools, revenue?" |
| 30+ days since last update | "Quick check: your profile says [X]. Still accurate?" |
| User mentions something contradicting profile | Update silently or confirm: "Your profile says [old]. You just said [new]. Want me to update?" |
| Previous project shipped | "Did shipping [project] change anything? New revenue? New skills? Updated tools?" |
| Previous project abandoned | "What was the real reason you stopped [project]?" (See Mode 3) |

### Step 4: Append Changelog

After any update:

```markdown
## Changelog
- <date>: <what changed and why>
```

---

## Mode 3: Post-Project Update

The MOST valuable update. Triggered at two points:

### After verify-promotion (project shipped)

Update the builder profile:
- Add project to Project History with outcome `shipped`
- Update skills (did they learn a new framework? use a new tool?)
- Update financial context (did revenue start? did they register an entity?)
- Update social presence (did they grow followers? launch on ProductHunt?)
- Run pattern detection: compare this project's timeline, decisions, and outcome
  against past projects. If a new pattern emerges (or an existing one is
  reinforced), append to Builder Patterns.
- Run gap analysis: what blocked them this time? What tool would have saved the
  most time? Append recommendation.

### After project abandonment

**Abandonment detection triggers:**
- User explicitly says "I'm stopping this" / "abandoning" / "moving on"
- User starts a NEW project via `route-workflow` while a previous project has an
  unmerged feature branch (route-workflow detects this at Session Setup by
  checking `git worktree list` and `git branch --no-merged main`)
- User has not touched the project in 30+ days and starts a new session
  (route-workflow checks `git log -1 --format=%ci` at session start)

**When triggered, ask:**
- "What was the real reason you stopped?"
- Add project to history with outcome `abandoned` and honest reason
- Check: does this match a pattern? If 2+ projects died the same way, create
  or strengthen a Builder Pattern with high confidence.
- Check: was there a tool, skill, or person that could have prevented this?
  Update gap analysis.

---

## Mode 4: Proactive Update

Triggered during normal pipeline operation when any skill notices something
that contradicts or updates the builder profile.

**Examples:**
- "Your profile says you can't do frontend, but you just wrote a React
  component. Should I update your skills?"
- "You said budget is $0 but you just signed up for a $20/mo service.
  Updated budget context."
- "Your X engagement jumped — you got 50 replies on your last post.
  Updating social presence from 'dormant' to 'warming up'."

These updates happen inline during other skills. The profile is always
eventually consistent with the builder's real situation.

**Shared writers:** mine-builder is the initial writer of the profile.
`teach-project` in `socratic` mode is a secondary authorized writer — it
updates the Skills & Strengths section and appends to the Changelog based
on diagnostic results. This is intentional: socratic teaching is the
primary way the profile's skill entries transition from "claimed at
onboarding" to "confirmed against real code." Any other skill that wants
to write to the profile should route through mine-builder's Proactive
Update mode instead of writing directly.

---

## How the Profile Changes the Pipeline

The builder profile is consumed by every downstream skill. Here is how
each builder situation changes recommendations:

| Builder situation | Pipeline impact |
|---|---|
| No capital, first project, 9-5 job | Find validated business to undercut cheaply. Free tiers only. Dodo/Gumroad payments. Ship in weekends. Target: first $100/mo. |
| Some capital ($500/mo), has marketer friend | Leverage the marketer. Pick a niche where marketing > engineering. Modest paid tools OK. |
| Funded / has company / Stripe ready | Build the vision. Use best tools. Move fast. Paid infra OK from day 1. |
| Technical + non-technical co-founder | Split by strength. Technical builds, co-founder validates with customers. Affects persona creation. |
| Has existing audience (5K followers, email list) | Pre-validation via audience. Can ship smaller MVP because distribution exists. |
| Has company, can get new clients | Can build internal tools that become products. Can validate with existing clients. |
| Strong Twitter/X in dev niche (1K+ engaged) | Build dev tools, open-source with paid tier, or info products. Launch via threads + ProductHunt. Audience IS the validation — poll before building. |
| Twitter/X with followers but zero engagement | Dormant channel. Do not plan launch around it. But: account age + history = algorithmic trust. Reactivation plan: 2-3 weeks of posting before launch, not day-of. Factor reactivation time into timeline. |
| X Pro / Premium subscription | Long-form posts, analytics, creator tools. Use analytics to understand existing audience before building. Long posts = mini-blog without needing a blog. |
| Active newsletter (500+ subs, 40%+ open rate) | Newsletter audience is a pre-sold customer base. Build what they ask for. Waitlist = validation. |
| YouTube channel (1K+ subs) | Video-friendly products: tutorials to SaaS, course platforms, tools you can demo. Launch content is free. |
| Reddit with aged account (2+ years) + karma | Trust asset. Can post in gated subreddits. Build tools that solve problems repeated in those subs. Do not self-promote — solve the problem, mention the tool in context. Account age bypasses new-account restrictions that kill cold-start distribution. |
| Reddit with aged account but low/no karma | Account exists and is trusted by age. Needs karma building: 2-4 weeks of genuine participation in target subs before any product mention. Factor this into launch timeline. |
| GitHub presence (popular repos) | Open-source core to paid cloud/pro. Existing stargazers are early adopters. README is your landing page. |
| LinkedIn with industry connections | B2B distribution channel. If building for professionals in their industry, LinkedIn posts + DMs are the channel. Premium unlocks InMail for cold outreach. |
| No social presence at all | Cold start. Build for SEO (tools people Google for), marketplaces (Shopify apps, VS Code extensions), or communities where you can earn trust first. Budget 30-50% of time for distribution, not just building. |

### Revenue Jump-In Points (advise based on profile)

| Revenue target | Approach | Timeline | Typical tools |
|---|---|---|---|
| $0 to $1K/mo | Reverse-engineer a winner. Ship in 1-2 weeks. Free-tier stack. Proven distribution channel. | Month 1 | LemonSqueezy, Supabase free, Vercel free |
| $1K to $3K/mo | Double down on what is working OR launch 2-3 variants. Register entity. | Month 2-3 | Sole proprietorship, Stripe, reinvest in tools |
| $3K to $10K/mo | Build the real thing (Stage 3). Use audience + revenue from Stage 1. Hire for weak skills. | Month 3-6 | Full infra, contractor budget, paid tools |
| $10K+ /mo | Product-market fit exists. Scale channels. Systematize. | Month 6+ | Full business infrastructure |

---

## What the Pipeline Does With Social Presence Data

The pipeline decides what is useful per project. The builder just reports what
they have. Specifically:

- **Pre-validate** by posting to existing audience before building
- **Choose what to build** — pick products that match where the audience already is
- **Plan launch strategy** — organic distribution via existing channels vs cold start
- **Estimate time to first revenue** — existing audience = days; no audience = months
- **Identify dormant assets to reactivate** — a 4-year Reddit account in the right
  sub is a warm intro away from being a distribution channel

---

## Key Principles

- **Infer before asking** — extract everything you can from context before asking questions
- **One cluster at a time** — never dump all questions at once
- **The profile is about the person, not the project** — capture everything, even if it
  seems irrelevant to the current project
- **Engagement > follower count** — 500 engaged beats 50K passive
- **Account age is an asset** — dormant accounts with history beat new accounts
- **Honest gaps > invented answers** — if the builder does not know, mark it unknown
- **Patterns require evidence** — only create patterns when 2+ projects demonstrate them
- **The profile is a living document** — it gets smarter after every project

---

## What This Produces

`~/.svc/builder-profile.md` — a global, project-agnostic profile that persists
across all projects. Contains:

- Financial context and constraints
- Time availability and employment status
- Technical and non-technical skills with identified gaps
- Team composition and network leverage
- Full social presence and distribution channel inventory
- Existing infrastructure and tool subscriptions
- Business entity status and payment capabilities
- Strategic goals, risk tolerance, and success definition
- Complete project history with outcomes and honest reasons
- Builder patterns (learned over time from project outcomes)
- Tool and capability gap analysis with specific recommendations
- Changelog of all profile updates

This file is consumed by: `route-workflow` (session setup), `validate-feature`
(builder history weighting for kill signals, pivot protocol), `plan-changeset`
(timeline estimates adjusted by patterns), and every skill that makes
strategy or scope decisions.

---

## Baseline Failure This Skill Fixes

Without this skill, the pipeline has no concept of WHO is building. Every
recommendation assumes an idealized builder with unlimited time, full-stack
skills, existing distribution, and a business entity. The result:

- MVPs scoped for 3 months when the builder has 5 hours/week
- Marketing plans for builders with zero social presence
- Payment integrations recommended before the builder has a company
- Features requiring frontend skills for backend-only developers
- The same idea failing repeatedly because nobody tracks the failure pattern

---

## Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Profile file exists | `ls ~/.svc/builder-profile.md` | |
| 2 | Financial Context section populated | grep for "Financial Context" heading and at least one non-template value | |
| 3 | Time Context section populated | grep for "Time Context" heading and at least one non-template value | |
| 4 | Skills section populated | grep for "Skills & Strengths" heading and at least one non-template value | |
| 5 | Distribution section present | grep for "Distribution & Social Presence" heading | |
| 6 | Strategic Goal section populated | grep for "Strategic Goal" heading and at least one non-template value | |
| 7 | Gap Analysis section present | grep for "Gap Analysis" heading | |
| 8 | No unresolved placeholders | grep for angle-bracket placeholders like `<what they>` — all should be filled or marked "unknown" | |
| 9 | Changelog entry exists | grep for "Changelog" heading with at least one dated entry | |

If any check FAILs, fix before continuing. If a fix requires user input that
was not provided, mark the section as "unknown — ask next session" and note it
in the changelog.

---

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `mine-builder` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ProfileModeDetection --evidence command_output:.svc/mine-builder-mode.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ContextInferenceQuestionCluster --evidence command_output:.svc/mine-builder-inference.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SocialProjectHistoryMining --evidence file:~/.svc/builder-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-PatternGapAnalysis --evidence file:~/.svc/builder-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ProfileWriteOrUpdate --evidence file:~/.svc/builder-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/mine-builder-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill has no lane position. It is invoked by `route-workflow` before the
pipeline starts, not as part of the pipeline sequence.

**After mine-builder completes:**
- Control returns to `route-workflow` which continues with Session Setup
  (detect repo mode, identify change type, recommend lane and next skill).
- The builder profile is now available for all downstream skills to read.

**When invoked standalone** (user says "update my profile"):
- Run the appropriate mode (2, 3, or 4)
- Report what changed
- Suggest: "Profile updated. Ready to continue with your current project."

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.


## Modes (added by WI-SPINE-002)

### `--mode=stack-profile`

Produces `docs/specs/stack-profile.md` per the template at `skills/mine-builder/templates/stack-profile.md`. Used by `recall-stack-knowledge` (the Spine gate) at phase 0 of every infra-* lane.

**Inputs:** project files (Terraform `*.tf`, `Chart.yaml`, `package.json`, CI configs), user's existing `~/.svc/builder-profile.md`, optional pasted summary.

**Process:**
1. Detect declared infra components from filesystem signals:
   - `*.tf` → terraform
   - `Chart.yaml` / `values.yaml` → helm
   - `pulumi.yaml` → pulumi
   - `terragrunt.hcl` → terragrunt
   - `.github/workflows/*.yml` → github-actions
   - `.gitlab-ci.yml` → gitlab-ci
   - `provider "aws"` → aws
   - `provider "google"` → gcp
2. Pre-fill the template with detected values.
3. Ask the user to confirm/correct envelopes (cost, peak load, RTO/RPO, criticality tier).
4. Write `docs/specs/stack-profile.md`.
5. Append entry to `references/knowledge/domains/<primary-stack>/` request list (the gap → research auto-loop will populate it on first recall).

**Output:** `docs/specs/stack-profile.md`. Refresh cadence: 90 days OR when components change. `validate-stack-profile-freshness.sh` warns when stale.

**When to use:** First time on an infra project. Subsequent infra-* lanes read stack-profile via the Spine.

Default invocation (`mine-builder` without `--mode`) is unchanged.

Reference: `proposals/done/2026-04-30-infra-project-support.md` § 3.1 + § 17.2.
