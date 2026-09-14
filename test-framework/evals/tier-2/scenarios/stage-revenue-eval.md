# Scenario: stage-revenue staging plan creation

## Setup

Create a builder profile at `~/.svc/builder-profile.md`:

```markdown
# Builder Profile

Last updated: 2026-04-01

## Financial Context
- **Budget for this project:** $0
- **Income source:** Employed full-time (9-5 software developer)
- **Revenue pressure:** Need side income ASAP — savings running low
- **Payment infrastructure:** No company, no Stripe. Can use LemonSqueezy.
- **First revenue target:** $1K/mo to cover tools and start saving

## Time Context
- **Hours per week available:** 10-15 evenings and weekends
- **Employment status:** Full-time employed
- **Deadline pressure:** No hard deadline, but motivation drops after 2 months without results
- **Timezone/availability:** EST evenings 7-10pm, weekends 4-6 hours

## Skills & Strengths
- **Technical:** Python, Node.js, PostgreSQL, REST APIs, some React (basic)
- **Non-technical:** Writes well, active in developer communities
- **Gaps:** No design skills. No mobile experience. Frontend stalls after basic layouts.

## Team & Network
- **Solo or team:** Solo
- **Network leverage:** Knows a designer friend who might help for equity
- **Advisor access:** None

## Distribution & Social Presence
- **Reddit:** 3-year account, 4K karma, active in r/webdev (12K members) and r/SideProject (8K members)
- **Twitter/X:** 280 followers, low engagement (1-2 likes per post), dev content
- **GitHub:** 15 followers, 2 repos with 30+ stars (CLI tools)

## Existing Infrastructure
- **Subscriptions:** GitHub Pro, Vercel free tier, Supabase free tier
- **Domains:** one unused .dev domain
- **Tools:** VS Code, Cursor

## Business Situation
- **Entity status:** No company
- **Can accept payments:** LemonSqueezy only
- **Existing customers/audience:** None

## Strategic Goal
- **Why building this:** Side income to supplement salary, eventually quit and go full-time indie
- **Risk tolerance:** Conservative — first project, cannot afford to lose money
- **Success definition:** $1K/mo passive income within 3 months
- **Exit horizon:** Keep and grow

## Project History

### URL Shortener SaaS — abandoned
- **What:** Custom URL shortener with analytics
- **When:** 2025-06 to 2025-09
- **Stack:** Next.js, Supabase
- **Reached:** Prototype — basic shortening worked, analytics dashboard half-built
- **Revenue:** $0
- **Why it ended:** Stalled on frontend. Dashboard took 3 weeks with no progress. Lost motivation.
- **Reusable assets:** Supabase schema patterns, Next.js boilerplate
- **What you'd do differently:** Pick something without a complex dashboard

### CLI Bookmark Manager — shipped
- **What:** Terminal-based bookmark manager with fuzzy search
- **When:** 2025-03 to 2025-03 (1 week)
- **Stack:** Python, SQLite
- **Reached:** Shipped on GitHub, 45 stars
- **Revenue:** $0 (open source)
- **Why it ended:** Complete — still maintained
- **Reusable assets:** CLI patterns, Python packaging
- **What you'd do differently:** Should have charged for a Pro version

## Builder Patterns
- **[frontend-stall] Stalls on frontend work** — confidence: 8, observed: 1 time
  Source: URL Shortener (abandoned at dashboard phase)
  Pipeline action: avoid frontend-heavy projects or budget for contractor
- **[cli-strength] Ships fast when building CLI/backend tools** — confidence: 7, observed: 1 time
  Source: Bookmark Manager (shipped in 1 week)
  Pipeline action: bias toward CLI, API, and backend projects
```

Write to `~/.svc/builder-profile.md`.

Create a vision document at `docs/specs/vision.md`:

```markdown
# Vision: DevPulse — Developer Activity Analytics Platform

## Purpose
DevPulse aggregates a developer's activity across GitHub, Stack Overflow, and
dev blogs into a single analytics dashboard. Shows contribution trends, skill
growth over time, and generates a "developer score" for hiring managers.

## Target Users
- Developers who want to showcase their work beyond a resume
- Hiring managers who want signal beyond interviews
- Developer relations teams tracking community engagement

## Core Features
- GitHub integration (commits, PRs, issues, stars)
- Stack Overflow integration (answers, reputation, tags)
- Blog/RSS feed aggregation
- Analytics dashboard with charts and trends
- "Developer Score" algorithm
- Public profile pages
- API for third-party integrations

## Revenue Model
- Freemium: free basic profile, $15/mo for analytics and score
- Enterprise: $49/user/mo for hiring manager dashboards

## Technical Scope
- Multi-service backend (auth, aggregation, scoring, API)
- React frontend with complex data visualizations
- Background job system for data syncing
- Rate limit management across 3+ external APIs

## Timeline Estimate
- MVP: 10-12 weeks
- Full product: 6 months
```

Write to `docs/specs/vision.md`.

---

## Scenario A: Builder with $0 + big 3-month SaaS idea

### Prompt

```
Use the stage-revenue skill. I want to build DevPulse (see docs/specs/vision.md). My builder profile is at ~/.svc/builder-profile.md.
```

### Expected Outputs

#### File Exists

- `docs/specs/staging-plan.md` — staging plan created

#### Content Checks

- [ ] Decision section says "Staging recommended: Yes" (big idea + $0 budget + 10-12 week build)
- [ ] Records a `P7-StagingPlanArtifact` phase receipt in the task graph:
  `jq -e '.tasks[] | select(.metadata.skill == "stage-revenue" or .skill_receipt.skill == "stage-revenue") | .skill_receipt.phases_executed[]? | select(.id == "P7-StagingPlanArtifact")' .svc/lane-tasks-<WI>.json`
- [ ] Decision reason references $0 budget or > 2 weeks build time or both
- [ ] Stage 1 project is defined with a name and description
- [ ] Stage 1 tier is specified (A, B, or C)
- [ ] Stage 1 does NOT require frontend-heavy work (builder has frontend-stall pattern)
- [ ] Stage 1 targets a distribution channel the builder has (Reddit r/webdev, r/SideProject, or GitHub)
- [ ] Stage 1 uses LemonSqueezy or Gumroad (no Stripe — builder has no entity)
- [ ] All 9 first-project rules have PASS status
- [ ] Stage 1 cites specific evidence of similar products making $1K+/mo
- [ ] Stage 2 reinvestment table references the builder's frontend gap specifically
- [ ] Stage 3 section names write-vision as the re-entry point
- [ ] Escape hatch section exists with "build my idea anyway" language
- [ ] No TBD, TODO, or placeholder text in the staging plan
- [ ] Stage 1 ships in 1-2 weeks at builder's 10-15 hrs/week pace

---

## Scenario B: Builder with $5K + same idea

### Setup

Modify `~/.svc/builder-profile.md` financial context:

```markdown
## Financial Context
- **Budget for this project:** $5,000 saved for this
- **Income source:** Employed full-time (9-5 software developer)
- **Revenue pressure:** Low — can invest for 3-4 months without income
- **Payment infrastructure:** LLC registered, Stripe active
- **First revenue target:** $3K/mo to justify going full-time
```

### Prompt

```
Use the stage-revenue skill. I want to build DevPulse (see docs/specs/vision.md). My builder profile is at ~/.svc/builder-profile.md.
```

### Expected Outputs

#### Content Checks

- [ ] Decision section says "Staging recommended: No" or "Skip staging"
- [ ] Decision reason references the $5K budget and ability to sustain 3-4 months
- [ ] Routes to write-vision directly (no staging plan stages are populated)
- [ ] Does NOT create a Stage 1 / Stage 2 / Stage 3 breakdown
- [ ] Output explicitly says staging is not needed for this builder situation

---

## Scenario C: Stage 1 relates to the big idea when possible

### Setup

Use the original $0 builder profile from Scenario A. Keep the DevPulse vision.

### Prompt

```
Use the stage-revenue skill. I want to build DevPulse (see docs/specs/vision.md). For Stage 1, find something related to DevPulse's domain — I want to build toward it, not away from it.
```

### Expected Outputs

#### Content Checks

- [ ] Stage 1 tier is A (related) or B (tangential) — NOT Tier C (unrelated)
- [ ] Stage 1 targets the same audience as DevPulse (developers)
- [ ] Stage 1 connection to big idea is explicitly described (audience overlap, domain learning, or code reuse)
- [ ] Stage 1 is something a backend/CLI-oriented builder can ship (not a frontend dashboard)
- [ ] Audience Transfer Plan section describes how Stage 1 users become Stage 3 users

---

## Scenario D: "Build my idea anyway" works without friction

### Setup

Use the original $0 builder profile from Scenario A. Keep the DevPulse vision.

### Prompt

```
Use the stage-revenue skill. I want to build DevPulse (see docs/specs/vision.md). My builder profile is at ~/.svc/builder-profile.md. Build my idea anyway — I don't want to stage it.
```

### Expected Outputs

#### Content Checks

- [ ] Does NOT produce a full staging plan with Stage 1/2/3 details
- [ ] Routes to write-vision (or write-spec) with DevPulse as the idea
- [ ] Response does NOT contain "are you sure", "I recommend", or guilt language
- [ ] Response does NOT contain passive-aggressive warnings about the builder's $0 budget
- [ ] Response acknowledges the override in one sentence and moves on
- [ ] Builder profile is passed through to the next skill as-is

---

## Scenario E: Reinvestment plan is specific to builder's gaps

### Setup

Use the original $0 builder profile from Scenario A (with frontend-stall pattern).

### Prompt

```
Use the stage-revenue skill. I want to build DevPulse (see docs/specs/vision.md). My builder profile is at ~/.svc/builder-profile.md. Make sure the reinvestment plan addresses my specific weaknesses.
```

### Expected Outputs

#### Content Checks

- [ ] Stage 2 reinvestment table includes a line item for the frontend gap (contractor, v0.dev, or similar)
- [ ] Reinvestment references the frontend-stall builder pattern by name or description
- [ ] Reinvestment cost estimates are specific dollar amounts, not ranges like "varies"
- [ ] Reinvestment priorities are ordered by impact (frontend gap should be high priority given DevPulse is dashboard-heavy)
- [ ] Gap analysis mentions risk of Stage 3 stalling at frontend — same failure mode as URL Shortener project
- [ ] At least one reinvestment item addresses the "no entity" gap (entity registration + Stripe)
- [ ] Revenue threshold for each reinvestment item is specified (e.g., "when Stage 1 hits $1K/mo")

---

## Chain Continuation

If `--progressive` were set and staging was accepted:
- If Stage 1 needs finding: next skill is `find-opportunity` with ecosystem constraint
- If Stage 1 is defined: next skill is `write-vision` with Stage 1 project as input

If `--progressive` were set and builder said "build my idea anyway":
- Next skill is `write-vision` with the big idea as input
