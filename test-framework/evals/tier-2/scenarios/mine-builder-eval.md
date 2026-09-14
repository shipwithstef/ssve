# Scenario: mine-builder profile creation and update

## Setup

Ensure `~/.svc/builder-profile.md` does NOT exist (delete if present).

No project-specific files are required — mine-builder is project-agnostic.

## Test Cases

### Test 1: First-Time Interview (Mode 1 — Full Profile from Rich Input)

#### Prompt

```
Use the mine-builder skill. Here's my situation: I'm a backend developer working a 9-5 at a fintech company. I know Python, Node.js, and some Go. I've been coding for 8 years. I have about 10-15 hours per week on evenings and weekends. Budget is basically $0 — I want to use free tiers for everything until I'm making money. My goal is to build a side project that makes $500/mo passive income within 6 months.

Past projects: I built a CLI tool for log parsing 2 years ago, got 200 GitHub stars but never monetized it. Last year I tried building a SaaS dashboard but abandoned it after 2 months — I got stuck on the frontend and lost motivation. I have a Twitter account (@devbuilder) with 800 followers, mostly dev audience, but I haven't posted in 6 months. Reddit account is 5 years old with 12K karma, mostly active in r/python and r/golang.
```

#### Expected Outputs

##### File Exists

- [ ] `~/.svc/builder-profile.md` was created
- [ ] Records a `P5-ProfileWriteOrUpdate` phase receipt in the task graph:
  `jq -e '.tasks[] | select(.metadata.skill == "mine-builder" or .skill_receipt.skill == "mine-builder") | .skill_receipt.phases_executed[]? | select(.id == "P5-ProfileWriteOrUpdate")' .svc/lane-tasks-<WI>.json`

##### Content Checks — Required Sections

- [ ] Contains `## Financial Context` with budget ($0), income source (employed full-time), revenue pressure, and first revenue target ($500/mo)
- [ ] Contains `## Time Context` with hours (10-15/week), employment (9-5), and availability (evenings/weekends)
- [ ] Contains `## Skills & Strengths` with Python, Node.js, Go listed under technical; gaps identified (frontend mentioned)
- [ ] Contains `## Distribution & Social Presence` with Twitter (800 followers, dormant) and Reddit (5yr, 12K karma, r/python, r/golang)
- [ ] Contains `## Project History` with both projects: CLI tool (shipped, 200 stars, not monetized) and SaaS dashboard (abandoned, frontend stall)
- [ ] Contains `## Strategic Goal` with side income, $500/mo target, 6-month horizon
- [ ] Contains `## Existing Infrastructure` section (even if minimal)
- [ ] Contains `## Business Situation` section (entity status addressed)
- [ ] Contains `## Changelog` with a dated creation entry

##### Content Checks — Inference Quality

- [ ] Inferred that frontend is a skills gap (from SaaS dashboard abandonment story)
- [ ] Inferred revenue pressure as moderate (wants $500/mo but has a job, not urgent)
- [ ] Did NOT ask questions the prompt already answered (budget, time, skills, past projects)
- [ ] Asked 2-3 critical unknowns (likely: business entity status, LinkedIn/other platforms, non-technical skills)

##### Content Checks — Pattern Detection

- [ ] Contains `## Builder Patterns` section
- [ ] Identified a frontend-stall pattern from the SaaS dashboard abandonment (or flagged that with only 1 project showing this pattern, confidence is low and needs more data)
- [ ] Identified that the CLI tool was the successful pattern (small scope, solo, backend-only)

##### Content Checks — Gap Analysis

- [ ] Contains `## Tool & Capability Gap Analysis` section
- [ ] Lists frontend as a gap blocking the revenue milestone
- [ ] Lists distribution/marketing as a gap (dormant Twitter, no active promotion history)
- [ ] Lists payment processing as a gap (no entity mentioned)
- [ ] Provides specific tool recommendations (not generic "learn frontend")

---

### Test 2: Minimal Context Inference (Mode 1 — Sparse Input)

#### Setup

Ensure `~/.svc/builder-profile.md` does NOT exist.

#### Prompt

```
Use the mine-builder skill. I'm a devops guy with a 9-5, want to make side money.
```

#### Expected Outputs

##### Inference Before Asking

- [ ] Inferred: employed full-time (9-5 mentioned)
- [ ] Inferred: technical skills in devops/infrastructure domain
- [ ] Inferred: time-constrained (9-5 implies limited hours)
- [ ] Inferred: goal is side income (not startup, not replace job)
- [ ] Inferred: budget likely conservative (side money implies bootstrapping)

##### Questions Asked

- [ ] Asked about specific devops tools/skills (AWS, Terraform, K8s, etc.)
- [ ] Asked about hours per week available
- [ ] Asked about social presence / distribution channels
- [ ] Asked about past projects (if any)
- [ ] Asked about revenue target or success definition
- [ ] Did NOT dump all questions at once — asked in clusters of 2-3

##### Profile Quality

- [ ] Created a complete profile despite minimal initial input
- [ ] Sections that could not be filled are marked as unknown or pending, not filled with fabricated data
- [ ] Gap analysis acknowledges the limited information available

---

### Test 3: Change-Check Mode (Mode 2 — Returning User)

#### Setup

Create `~/.svc/builder-profile.md` with this content:

```markdown
# Builder Profile

Last updated: 2026-03-01

## Financial Context
- **Budget for this project:** $0 — free tiers only
- **Income source:** employed full-time (fintech company)
- **Revenue pressure:** moderate — want $500/mo in 6 months
- **Payment infrastructure:** no company yet
- **First revenue target:** $500/mo passive

## Time Context
- **Hours per week available:** 10-15 (evenings + weekends)
- **Employment status:** 9-5 employed
- **Deadline pressure:** 6 months soft target
- **Timezone/availability:** EST, 7pm-11pm weekdays, flexible weekends

## Skills & Strengths
- **Technical:** Python, Node.js, Go, AWS, Docker
- **Non-technical:** technical writing (blog posts)
- **Gaps:** frontend, marketing, design

## Team & Network
- **Solo or team:** solo
- **Network leverage:** know a few devs from work, no marketing contacts
- **Advisor access:** none

## Distribution & Social Presence

### Twitter/X
- Handle: @devbuilder
- Followers: 800
- Account age: 4 years
- Engagement: 2-3 replies per post
- Niche: dev tools, Python
- Paid features: none
- Content type: technical tips, project updates
- Conversion history: never sold anything

### Reddit
- Account age: 5 years
- Karma: 12K (8K comment, 4K post)
- Active subreddits: r/python, r/golang, r/devops
- Moderator: no
- Niche posting history: answers questions, shares tools

## Existing Infrastructure
- **Subscriptions:** GitHub Pro, AWS free tier
- **Domains:** devbuilder.dev (unused)
- **Tools:** VS Code, Docker Desktop

## Business Situation
- **Entity status:** no company
- **Can accept payments:** not yet
- **Existing customers/audience:** none

## Strategic Goal
- **Why building this:** side income
- **Risk tolerance:** conservative-first-project
- **Success definition:** $500/mo passive income
- **Exit horizon:** keep if it works

## Project History

### LogParser CLI — shipped
- **What:** CLI tool for parsing and filtering application logs
- **When:** 2024-01 to 2024-02
- **Stack:** Python, Click
- **Reached:** launched (GitHub, 200 stars)
- **Revenue:** $0
- **Why it ended:** never monetized, still maintained occasionally
- **Reusable assets:** Python CLI boilerplate, GitHub audience (200 stars)
- **What you'd do differently:** would have added a paid tier from day 1

### DashboardSaaS — abandoned
- **What:** Analytics dashboard for small dev teams
- **When:** 2025-06 to 2025-08
- **Stack:** Node.js backend, attempted React frontend
- **Reached:** prototype (backend API complete, frontend 30%)
- **Revenue:** $0
- **Why it ended:** got stuck on frontend, lost motivation at month 2
- **Reusable assets:** Node.js API boilerplate, Supabase schema
- **What you'd do differently:** would have used a template or found a frontend co-founder

## Builder Patterns (learned over time)

- **[frontend-stall] Stalls on frontend work** — confidence: 5, observed: 1 time
  Source: DashboardSaaS (backend done quickly, frontend caused abandonment)
  Pipeline action: recommend pre-built UI, avoid custom frontend work
- **[solo-backend-strength] Ships fast on backend/CLI** — confidence: 6, observed: 1 time
  Source: LogParser CLI (shipped in 4 weeks, solo, backend-only)
  Pipeline action: bias toward backend/CLI/API projects

## Tool & Capability Gap Analysis

### Current capabilities
- Backend development (Python, Node.js, Go)
- Infrastructure (AWS free tier, Docker)
- Version control and CI (GitHub Pro)

### Gaps blocking $500/mo milestone
1. No payment processing — can't collect money
2. No frontend skills — can't build user-facing products
3. No distribution — dormant Twitter, no active marketing

### Recommendations
- LemonSqueezy for payments (no entity needed)
- Build CLI/API tools or marketplace apps (plays to backend strength)
- Reactivate Twitter (4yr account has trust, 800 followers is a start)

## Changelog
- 2026-03-01: Profile created via mine-builder interview
```

#### Prompt

```
Use the mine-builder skill. I just want to check in and continue building.
```

#### Expected Outputs

##### Behavior Checks

- [ ] Detected the existing profile and switched to Mode 2 (change-check)
- [ ] Presented a one-line summary of the profile (role, budget, time, key skill, distribution)
- [ ] Asked "Anything changed?" or equivalent
- [ ] Did NOT re-run the full interview
- [ ] Did NOT overwrite the existing profile with a new one

##### Content Checks (after user says "no, nothing changed")

- [ ] Profile file unchanged (or only Last updated timestamp changed)
- [ ] No sections were deleted or overwritten
- [ ] Proceeded to hand back control (to route-workflow or user)

---

### Test 4: Change-Check With Updates (Mode 2 — User Reports Changes)

#### Setup

Same profile as Test 3.

#### Prompt

```
Use the mine-builder skill. A few things changed — I registered an LLC last week, set up Stripe, and my Twitter went from 800 to 1,400 followers after I started posting daily about Go tips. Also, I learned Next.js over the holidays.
```

#### Expected Outputs

##### Update Checks

- [ ] Updated Business Situation: entity status changed to LLC, can accept payments via Stripe
- [ ] Updated Distribution/Twitter: followers updated to 1,400, engagement likely updated, posting frequency updated to daily
- [ ] Updated Skills: Next.js added to technical skills; frontend gap reduced or reclassified
- [ ] Updated Gap Analysis: payment gap closed, frontend gap reduced, distribution gap reduced
- [ ] Updated Builder Patterns: if frontend-stall pattern existed, note that builder is actively addressing it
- [ ] Changelog entry added with date and what changed

##### Preservation Checks

- [ ] Sections NOT mentioned by the user remain unchanged (Financial Context budget, Time Context, Project History, etc.)
- [ ] The profile was updated in place, not recreated from scratch

---

### Test 5: Pattern Detection With Multiple Projects

#### Setup

Ensure `~/.svc/builder-profile.md` does NOT exist.

#### Prompt

```
Use the mine-builder skill. Here's my background:

I'm a full-stack developer, 6 years experience. Work freelance, about 30 hours/week available. Budget: $200/mo for tools.

Past projects:
1. TodoMaster - a task management app. Built with React + Express. Launched it, got 50 users in first month, then flatlined. Couldn't figure out marketing. Abandoned after 4 months. Had working Stripe integration.
2. CodeReview Bot - a GitHub bot that auto-reviews PRs. Built with Python + GitHub API. Launched on ProductHunt, got #5 of the day, 300 GitHub stars. But I never set up payments. 2000 free users, $0 revenue. Still running but I lost motivation.
3. FreelancerCRM - a CRM for freelancers. Built React + Supabase. Got the backend working great but the frontend was ugly and I kept redesigning it. Abandoned after 3 months. Never launched.
4. APIMonitor - a simple uptime monitoring CLI. Python. Shipped in 1 week. Put it on GitHub, 150 stars. Someone asked to pay, I said "later." Never set up payments.

Twitter: @fullstackbuilder, 2K followers, dev niche, post weekly, get 5-10 replies. Reddit: 3yr account, 5K karma, r/webdev and r/SideProject.
```

#### Expected Outputs

##### Pattern Detection

- [ ] Identified **marketing/distribution gap** pattern: TodoMaster (couldn't figure out marketing), CodeReview Bot (launched but no monetization follow-through), APIMonitor (someone wanted to pay, never set up)
- [ ] Identified **monetization avoidance** pattern: CodeReview Bot (2000 users, $0), APIMonitor (demand existed, no payment setup), TodoMaster (had Stripe but no growth strategy)
- [ ] Identified **frontend-stall** pattern: FreelancerCRM (kept redesigning), potentially TodoMaster (launched but quality unclear)
- [ ] Identified **ships-fast-on-small-backend** pattern: APIMonitor (1 week), CodeReview Bot (GitHub API tool)
- [ ] Each pattern has confidence score scaled to number of observations
- [ ] Each pattern has a specific pipeline action

##### Gap Analysis Quality

- [ ] Identified that the builder CAN build products (4 launched/nearly-launched)
- [ ] Identified that the primary blocker is monetization, not building
- [ ] Identified that distribution exists (Twitter, ProductHunt success) but is underutilized
- [ ] Recommended specific actions: set up payments FIRST on next project, use ProductHunt again (proven channel), build on the 2K Twitter audience
- [ ] Recommended building backend/CLI tools (pattern of success) over SaaS frontends (pattern of stalling)

---

### Test 6: Abandonment Detection (Mode 3)

#### Setup

Use the profile from Test 3. Simulate a new project start while a previous project has unmerged branches.

#### Prompt

```
Use the mine-builder skill in post-project update mode. I'm abandoning the dashboard project. Honestly, I just couldn't make the frontend look decent and every time I sat down to work on it I'd procrastinate. The backend was done in week 1 but the frontend took 7 weeks and I still wasn't happy with it.
```

#### Expected Outputs

##### Update Checks

- [ ] DashboardSaaS project history updated with honest abandonment reason
- [ ] frontend-stall pattern confidence increased (now observed 2nd time if counting prior)
- [ ] Pattern now includes timeline detail: "backend done in 1 week, frontend caused 7 weeks of stalling"
- [ ] Gap analysis updated: frontend explicitly flagged as critical blocker with higher severity
- [ ] Recommendations updated: more aggressive frontend avoidance (build CLI/API only, or mandatory co-founder/contractor for frontend)
- [ ] Motivation pattern potentially identified: procrastination on non-strength tasks
- [ ] Changelog entry with date and abandonment details

##### Behavioral Checks

- [ ] Asked follow-up: was there a tool, person, or skill that could have prevented this?
- [ ] Did NOT judge or criticize the abandonment — treated it as data
- [ ] Extracted actionable insight for future pipeline decisions

## Chain Continuation

mine-builder has no lane position. After completion, control returns to
`route-workflow` for Session Setup, or to the user if invoked standalone.
