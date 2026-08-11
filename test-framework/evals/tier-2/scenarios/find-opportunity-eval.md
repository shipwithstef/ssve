# Scenario: find-opportunity with two builder profiles

## Purpose

Validate that the find-opportunity skill produces builder-specific opportunities
backed by evidence. Two different builder profiles should yield different
opportunities that match each builder's unique skills, constraints, and
distribution channels.

---

## Setup: Builder A

Create `~/.svc/builder-profile.md` with a constrained backend-only profile:

```markdown
# Builder Profile

Last updated: 2026-04-06

## Financial Context
- **Budget for this project:** $0
- **Income source:** Employed full-time (devops engineer)
- **Revenue pressure:** Want side income, not desperate but motivated
- **Payment infrastructure:** No company, no entity. Need LemonSqueezy or Gumroad.
- **First revenue target:** $1K/mo to prove the model works

## Time Context
- **Hours per week available:** 10 hrs/week (evenings + some weekend)
- **Employment status:** 9-5 employed
- **Deadline pressure:** No hard deadline, but want to ship within 2 weeks
- **Timezone/availability:** US Eastern, evenings 8-11pm weekdays

## Skills & Strengths
- **Technical:** Python, Go, Bash, Docker, Kubernetes, Terraform, CI/CD pipelines, monitoring (Prometheus/Grafana), Linux administration, PostgreSQL, Redis
- **Non-technical:** Technical writing (internal docs), no marketing, no design, no sales
- **Gaps:** No frontend skills (HTML/CSS is a struggle). No design sense. No copywriting. No sales experience.

## Team & Network
- **Solo or team:** Solo
- **Network leverage:** None outside work colleagues (also devops/sysadmin)

## Distribution & Social Presence
- **Reddit:** 4-year-old account, 12K karma (mostly from r/selfhosted and r/sysadmin), active commenter in r/selfhosted (28K members), r/sysadmin (500K members), r/homelab. Never posted own content, only comments. No moderation roles.
- **GitHub:** 45 followers, 2 repos with 80+ stars (Terraform modules). Active contribution history.
- **Twitter/X:** No account.
- **LinkedIn:** 300 connections, industry (tech/devops), posts once every 3 months, zero engagement.
- **All other platforms:** None.

## Existing Infrastructure
- **Subscriptions:** AWS free tier (personal account), Vercel free, Supabase free, GitHub Pro
- **Domains:** 1 unused domain (monitoring-tools.dev)
- **Tools:** VS Code, terminal-heavy workflow, no design tools
- **Existing codebases:** Terraform module library (reusable), Python CLI template, Go microservice template

## Business Situation
- **Entity status:** No company
- **Can accept payments:** No — need LemonSqueezy or Gumroad
- **Tax/legal:** US, no constraints beyond needing to report income
- **Existing customers/audience:** None

## Strategic Goal
- **Why building this:** Side income from skills I already have
- **Risk tolerance:** Conservative — first real side project
- **Success definition:** $1K/mo passive-ish income
- **Exit horizon:** Keep it running, minimal maintenance

## Project History

### monitoring-dashboard — abandoned
- **What:** Web dashboard for aggregating monitoring alerts across tools
- **When:** 2025-Q1, worked on for 6 weeks
- **Stack:** Go backend + React frontend (attempted)
- **Reached:** Prototype — backend API worked, frontend was unusable
- **Revenue:** $0
- **Why it ended:** Got stuck on frontend. Spent 4 weeks on React and produced something embarrassing. Lost motivation.
- **Reusable assets:** Go backend code, API design patterns, monitoring domain knowledge
- **What I'd do differently:** Not attempt frontend myself. Or build something that doesn't need a UI.

## Builder Patterns
- **[frontend-stall] Stalls on frontend work** — confidence: 8, observed: 1 time
  Source: monitoring-dashboard (backend done in 2 weeks, frontend abandoned after 4 weeks)
  Pipeline action: avoid products requiring custom frontend. Recommend CLI tools, APIs, browser extensions with minimal UI, or use v0.dev/shadcn for any required UI.
```

No `docs/specs/vision.md` — Builder A has no big idea, just wants revenue.

## Prompt: Builder A

```
Use the find-opportunity skill to find the top 3 revenue opportunities for me. My builder profile is at ~/.svc/builder-profile.md. I don't have a specific idea — I just want the fastest path to $1K/mo with my skills.
```

## Expected Outputs: Builder A

### File Exists

- `docs/specs/opportunities/top-3-opportunities.md` — opportunity cards written to disk

### Content Checks

- [ ] Contains at least 3 opportunity cards (grep for "## Opportunity 1", "## Opportunity 2", "## Opportunity 3")
- [ ] Records a `P7-Top3OpportunityArtifact` phase receipt in the task graph:
  `jq -e '.tasks[] | select(.metadata.skill == "find-opportunity" or .skill_receipt.skill == "find-opportunity") | .skill_receipt.phases_executed[]? | select(.id == "P7-Top3OpportunityArtifact")' .svc/lane-tasks-<WI>.json`
- [ ] Builder advantages section references devops/backend skills specifically (grep for "devops" or "backend" or "infrastructure" or "CLI" or "Go" or "Python")
- [ ] NO opportunity requires custom frontend development (grep for disqualifier check — should not recommend SaaS dashboards or React apps given the frontend-stall pattern)
- [ ] Every opportunity has an "Evidence" field with specific product names or revenue data (not "people might pay")
- [ ] Every opportunity has a score table with all 6 dimensions filled (grep for "Guaranteed revenue" AND "Builder fit" AND "Distribution fit" AND "Speed to first" AND "Self-sustaining" AND "Ecosystem value")
- [ ] Distribution plans reference Reddit (r/selfhosted, r/sysadmin) or GitHub — the builder's actual channels (grep for "r/selfhosted" or "r/sysadmin" or "GitHub")
- [ ] All infrastructure is free tier (grep for "$0" in infrastructure sections)
- [ ] Payment method is LemonSqueezy or Gumroad, NOT Stripe (builder has no entity)
- [ ] Opportunities fit builder's niche — expect categories like: CLI tools, API services, Terraform modules, monitoring tools, browser automation, or developer utilities
- [ ] The frontend-stall pattern is respected — any product with UI uses a minimal/templated approach or has no UI at all

### Builder-Specific Differentiation

The opportunities should leverage Builder A's unique advantages:
- Strong Reddit presence in r/selfhosted and r/sysadmin (distribution)
- Real sysadmin/devops experience (domain expertise)
- Existing Terraform modules with stars (reusable assets)
- Backend/CLI strength (build speed)

Opportunities that a generic "developer" could build equally well are a sign the skill is not reading the builder profile deeply enough.

---

## Setup: Builder B

Replace `~/.svc/builder-profile.md` with a different profile:

```markdown
# Builder Profile

Last updated: 2026-04-06

## Financial Context
- **Budget for this project:** $100/mo for tools
- **Income source:** Freelance full-stack developer (variable income)
- **Revenue pressure:** Moderate — freelance income covers bills but want product revenue for stability
- **Payment infrastructure:** LLC registered, Stripe active, can accept payments directly
- **First revenue target:** $2K/mo to reduce freelance dependency

## Time Context
- **Hours per week available:** 20 hrs/week (flexible schedule)
- **Employment status:** Freelance, flexible hours
- **Deadline pressure:** Want to launch within 2 weeks
- **Timezone/availability:** US Pacific, flexible throughout the day

## Skills & Strengths
- **Technical:** TypeScript, React, Next.js, Node.js, PostgreSQL, Tailwind CSS, Prisma, Vercel deployment, REST + GraphQL APIs, basic mobile (React Native)
- **Non-technical:** Basic design sense (can use Figma), decent copywriting from freelance proposals, understands client needs from consulting
- **Gaps:** No DevOps depth. No data science/ML. Limited backend scaling experience.

## Team & Network
- **Solo or team:** Solo, but has 2 freelance developer friends who could help for equity/revenue share
- **Network leverage:** Active in local tech meetup (50 regulars), know 3 potential B2B customers from freelance work

## Distribution & Social Presence
- **Twitter/X:** @builderB_dev, 2,100 followers, dev niche (React, TypeScript, indie hacking). Good engagement: avg 15 replies per thread, 40-80 likes on technical posts. Posts 3-4x/week. Account is 3 years old. No X Pro.
- **ProductHunt:** 1 past launch (a React component library, ranked #8 of the day, 180 upvotes). Active commenter.
- **GitHub:** 120 followers, popular React starter template (340 stars). Active contribution history.
- **Reddit:** Account exists (2 years) but rarely posts. 200 karma. Lurker in r/reactjs and r/webdev.
- **LinkedIn:** 800 connections, active in web dev space, posts monthly with decent engagement (20-30 reactions).
- **Newsletter:** None.
- **IndieHackers:** Profile exists, 2 posts (build logs), small following.

## Existing Infrastructure
- **Subscriptions:** Vercel Pro ($20/mo), Supabase free tier, Figma free, Stripe active, Resend free tier
- **Domains:** 3 unused domains (saas-starter.dev, reactkit.io, quicklaunch.tools)
- **Tools:** VS Code, Figma, Notion, Linear
- **Existing codebases:** Next.js SaaS starter template (auth, billing, dashboard — 340 GitHub stars), React component library, 3 freelance client projects (not reusable)

## Business Situation
- **Entity status:** LLC registered (US)
- **Can accept payments:** Yes — Stripe active, LemonSqueezy backup
- **Tax/legal:** US LLC, clean
- **Existing customers/audience:** 3 past freelance clients who trust them, 2,100 Twitter followers, 340 GitHub stargazers

## Strategic Goal
- **Why building this:** Transition from freelance to product revenue
- **Risk tolerance:** Moderate — has freelance income as safety net
- **Success definition:** $2K/mo product revenue within 3 months
- **Exit horizon:** Build and grow, potentially raise if it takes off

## Project History

### react-saas-starter — shipped (open source)
- **What:** Next.js SaaS starter template with auth, billing, dashboard
- **When:** 2025-Q2, built in 2 weeks
- **Stack:** Next.js, Tailwind, Prisma, Supabase, Stripe
- **Reached:** Launched on GitHub and ProductHunt. 340 stars, #8 on PH.
- **Revenue:** $0 (open source)
- **Why it ended:** Decided to keep it free to build reputation. Gets occasional PRs.
- **Reusable assets:** The entire starter template. Auth, billing, dashboard are production-ready.
- **What I'd do differently:** Should have had a paid tier from day 1. Free got stars but no revenue.

### client-portal — shipped (freelance)
- **What:** Client project management portal for a consulting firm
- **When:** 2025-Q3, 3 weeks
- **Stack:** Next.js, Prisma, PostgreSQL
- **Reached:** Production, used daily by the client
- **Revenue:** $8K one-time freelance fee
- **Reusable assets:** Client portal patterns, multi-tenant auth, file upload system

## Builder Patterns
- **[fast-shipper] Ships production code quickly** — confidence: 9, observed: 3 times
  Source: react-saas-starter (2 weeks), client-portal (3 weeks), component library (1 week)
  Pipeline action: can trust aggressive timelines. 2-week estimates are realistic for this builder.
- **[monetization-gap] Builds great products but undercharges or gives away free** — confidence: 7, observed: 2 times
  Source: react-saas-starter (free, 340 stars, $0), component library (free)
  Pipeline action: force pricing into the plan from day 1. No "launch free, monetize later."
```

No `docs/specs/vision.md` for Builder B either.

## Prompt: Builder B

```
Use the find-opportunity skill to find the top 3 revenue opportunities for me. My builder profile is at ~/.svc/builder-profile.md. I want to transition from freelance to product revenue. Find what's working right now.
```

## Expected Outputs: Builder B

### File Exists

- `docs/specs/opportunities/top-3-opportunities.md` — opportunity cards written to disk

### Content Checks

- [ ] Contains at least 3 opportunity cards (grep for "## Opportunity 1", "## Opportunity 2", "## Opportunity 3")
- [ ] Builder advantages section references full-stack/React/Next.js skills (grep for "React" or "Next.js" or "TypeScript" or "full-stack")
- [ ] At least one opportunity leverages the existing SaaS starter template (340 stars = reusable asset + audience)
- [ ] Every opportunity has an "Evidence" field with specific product names or revenue data
- [ ] Every opportunity has a score table with all 6 dimensions filled
- [ ] Distribution plans reference Twitter/X (2.1K engaged followers) or ProductHunt (past launch experience) or GitHub (340-star repo) — the builder's actual channels
- [ ] Payment method includes Stripe as an option (builder has LLC + active Stripe)
- [ ] The monetization-gap pattern is addressed — pricing is explicit and forced into every opportunity from day 1
- [ ] Opportunities fit builder's niche — expect categories like: SaaS web apps, templates/boilerplates (paid tier), marketplace apps, Chrome extensions, or AI wrappers with polished UI
- [ ] Build time estimates reflect the fast-shipper pattern — 2-week estimates should be trusted

### Builder-Specific Differentiation

The opportunities should leverage Builder B's unique advantages:
- Existing SaaS starter template (skip 80% of boilerplate)
- Active Twitter/X with engaged dev audience (distribution)
- ProductHunt launch experience (knows the playbook)
- Full-stack with design sense (can ship polished UI fast)
- LLC + Stripe ready (can charge from day 1, higher-ticket pricing)
- Past freelance clients (potential B2B customers or references)

---

## Cross-Profile Validation

**The two builders should get DIFFERENT opportunities.** Verify:

- [ ] Builder A's opportunities are backend/CLI/API/devops-focused (no custom frontend)
- [ ] Builder B's opportunities are web app/SaaS/template-focused (leverages UI skills)
- [ ] Builder A's distribution plans use Reddit (r/selfhosted, r/sysadmin) and GitHub
- [ ] Builder B's distribution plans use Twitter/X, ProductHunt, and GitHub
- [ ] Builder A's payment is LemonSqueezy/Gumroad (no entity)
- [ ] Builder B's payment includes Stripe (has LLC)
- [ ] Builder A's opportunities avoid frontend (frontend-stall pattern)
- [ ] Builder B's opportunities leverage the SaaS starter template (reusable asset)
- [ ] Builder A's build times account for 10 hrs/week
- [ ] Builder B's build times account for 20 hrs/week (and trust the fast-shipper pattern)
- [ ] If any opportunity appears for BOTH builders, it is tailored differently (different MVP, different distribution, different pricing)

## Scoring Consistency

- [ ] No opportunity scores above 90/100 (that would indicate insufficient rigor)
- [ ] No opportunity scores below 40/100 (that would indicate it should not have survived disqualifiers)
- [ ] Builder fit scores differ between A and B for the same category (a CLI tool should score higher builder-fit for A; a SaaS should score higher for B)
- [ ] Distribution fit scores reflect actual channel strength, not generic "post online"

## Chain Continuation

After user picks an opportunity, next skill is `write-vision` with the opportunity context as input. The eval does not test this handoff — it only validates the opportunity selection output.
