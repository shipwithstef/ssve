# Replit Agent 4 — Complete Capability Inventory

> Research date: 2026-05-02
> Sources: docs.replit.com, blog.replit.com, third-party reviews, official changelogs

---

## 1. Core Agent Capabilities

### Autonomous Building
- **200-minute autonomous runs** (Agent 3+, maintained in Agent 4)
- Self-testing and self-healing — tests its own code, fixes failures automatically
- Multi-step reasoning with visible task breakdown
- Automatic checkpoint creation (rollback any time)
- Code optimization pass after building (optional)

### Agent Modes
| Mode | Best For | Speed | Cost |
|------|----------|-------|------|
| **Lite** | Visual tweaks, bug fixes, scoped features | 10-60 sec | Lowest |
| **Economy** | Default for most builds | Balanced | Balanced |
| **Power** | Hard problems, larger changes, longer builds | Slower | Higher |
| **Turbo** | Up to 2.5x faster builds | Fastest | Highest (Pro only) |

### Parallel Execution (Agent 4)
- Parallel subagents handle different parts simultaneously
- One subagent for backend/schema, one for API routes, one for frontend, one for tests
- Orchestrating agent coordinates threads, resolves conflicts (~90% auto-resolve)
- Result: faster builds + more modular codebase by default

---

## 2. Design & Visual Capabilities

### Design Canvas / Design Mode
- Powered by Gemini 3 (launched November 2025)
- Create interactive designs and static websites in under 2 minutes
- One-click conversion from design mockup to full app
- Visual Editor: click and select elements directly, adjust text/colors/layout without coding

### Figma Import
- Near pixel-perfect conversions from Figma designs to working code
- Available at replit.com/import
- Bridges design-to-development gap

### AI Image Generation
- Generate AI images and add them to projects
- Built-in image generation during first build for React apps

---

## 3. Output Types (Artifacts)

Agent can produce multiple artifact types in a single project (sharing backend):
- **Web apps** — full-stack, responsive by default
- **Mobile apps** — React Native + Expo, iOS/Android, backend support
- **Slide decks** — AI-powered presentations
- **Animated videos** — motion graphics from description
- **Data visualizations** — dashboards, reporting tools
- **3D games** — creative/entertainment apps
- **Documents** — CSVs, PDFs, PowerPoint, Markdown

---

## 4. Built-in Platform Services (Zero Setup)

| Service | What You Get |
|---------|-------------|
| **Authentication** | Replit Auth (zero-setup), Clerk Auth (custom branding, SSO), OAuth providers (Google, GitHub, Apple, X) |
| **Database** | PostgreSQL with visual schema editor, automatic migrations, 7-day soft delete (Pro: 28-day) |
| **Object Storage** | File and media hosting |
| **Secrets Management** | Encrypted env vars, auto-sync between deployment and workspace |
| **Hosting & Deployment** | One-click deploy, live URL (.replit.app), custom domains, static/autoscale/reserved VM deployments |

---

## 5. Connectors & Integrations (30+)

### Replit Managed (No API keys needed)
- **Payments:** Stripe (payments, subscriptions, webhooks, checkout), PayPal, RevenueCat (mobile subscriptions)
- **AI Providers:** OpenAI, Anthropic, xAI/Grok, Google AI, Perplexity (no API keys needed — billed to Replit credits)
- **Productivity:** Notion, Slack, Linear, Asana, Todoist, Monday.com, Google Workspace (Docs, Drive, Calendar, Gmail)
- **CRM:** Salesforce, Zendesk
- **Data Warehouses:** BigQuery, Snowflake, Databricks
- **Analytics:** Segment, Amplitude, Hex
- **Design:** Figma
- **Dev Tools:** GitHub, GitLab, Bitbucket
- **Communication:** Discord, Outlook

### MCP Server Support (Dec 2025+)
- Connect Agent to virtually any service with MCP interface
- Custom MCP servers for proprietary/internal tools
- Figma MCP integration for layer exploration and design data extraction
- MCP Directory browseable in Replit

### External Integrations (API keys required)
- Firebase, SendGrid, and many more via standard API integration

---

## 6. Plan Mode & Project Management

- **Plan Mode:** Brainstorm, ask questions, map project before any code changes
- Creates ordered task lists (Kanban-style)
- Explore approaches and weigh trade-offs
- Review and refine before building
- Automatic checkpoint creation during planning

---

## 7. Collaboration Features

- Real-time multiplayer coding (Google Docs-style)
- Invite teammates — each person can start new Agent threads
- Team workspaces (Pro: up to 15 builders, 50 viewers)
- Build Score rating system for feedback
- Background tasks: Core (1), Pro (10 concurrent)

---

## 8. Mobile Development

- React Native + Expo support (launched Feb 2025)
- Full-stack mobile apps with backend, AI, database, storage
- Test on phone with Expo Go
- Publish through TestFlight → App Store
- Replit Mobile App (#1 Developer Tools on App Store, 4.7 rating)

---

## 9. Security & Compliance

- Built-in security scanning (dependency vulnerability detection)
- Automatic blocking of dev server deployments (CVE protection)
- SOC 2 Type II compliant (zero exceptions)
- Bitsight "Advanced" rating (780)
- Secrets encrypted, never exposed in code
- Project Security Center + Workspace Security Center

---

## 10. Import / Export Ecosystem

- **Import from:** GitHub, GitLab, Bitbucket, Figma, Bolt, Lovable, Vercel, ZIP
- **Export to:** GitHub, download as ZIP
- **Rapid import:** replit.new/YOUR_REPO_URL
- No vendor lock-in at code level

---

## 11. Pricing Tiers (Feb 2026)

| Plan | Price | Agent Access | Key Limits |
|------|-------|-------------|-----------|
| **Starter** | $0/mo | Daily cap, limited checkpoints, Lite builds only | Public apps only, 0.5 vCPU, 1 GiB RAM, 1 static deployment |
| **Core** | $25/mo ($20 annual) | Full Agent (Lite/Economy/Power), $25/mo credits | 5 collaborators, 1 background task |
| **Pro** | $100/mo | Everything + Turbo mode, tiered credits with 1-month rollover | 15 builders, 50 viewers, 10 background tasks, priority support |
| **Enterprise** | Custom | SSO/SCIM, VPC, dedicated support, audit logs | Custom limits |

---

## 12. What Changed in Agent 4 (March 2026)

- Parallel task forking with auto-merge conflict resolution
- Structured pipeline: Ideation → Design → Build → Review
- Web-based preview for feedback before finalizing
- Tighter feedback loop between design and implementation
- Agent can build other agents and workflows

---

## 13. Key Limitations & Gotchas

1. **Credit burn risk** — Turbo mode can consume $35+ in a single overnight session if stuck in loops
2. **No version rollback between Agent versions** — can't downgrade from Agent 3/4
3. **Stuck loops** — complex codebases can trigger fix-fail-retry loops
4. **Free tier severely limited** — 0.5 vCPU, public only, daily caps
5. **No VPC/isolation** — enterprise compliance limitations
6. **Code quality varies** — output optimized for working, not necessarily readability
7. **Hosting costs separate** — deployment compute is on top of subscription

---

## 14. Best Practices for Buildathons

1. **Start simple, iterate** — short initial prompt, let Agent propose stack
2. **Use checkpoints before major changes** — rollback insurance
3. **Batch related changes** — reduces checkpoint overhead
4. **Be specific in prompts** — include features, design preferences, stack
5. **Review before accepting** — cheaper to reject than debug later
6. **Push to GitHub regularly** — version control safety net
7. **Use Plan Mode first** — map the full 24h project before building
8. **Leverage connectors** — Stripe, OpenAI, Notion integrations are one-click
9. **Design Canvas for UI-heavy apps** — validate direction before coding
10. **Deploy early and often** — live URL makes testing/sharing instant

---

*[FROM-RESEARCH] All data sourced from official Replit docs, blogs, and verified third-party reviews as of May 2, 2026.*
