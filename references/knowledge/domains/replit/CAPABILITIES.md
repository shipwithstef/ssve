# Replit — Platform Capabilities

> Domain: `replit` | Last updated: 2026-05-02
> Source: docs.replit.com, blog.replit.com, verified third-party reviews

## Layer 2 Summary

Replit is an agent-first cloud development platform. As of 2026, it provides a browser-based IDE with an autonomous AI Agent (Agent 4) that can plan, design, build, test, and deploy full applications from natural language. It includes built-in auth, PostgreSQL database, object storage, 30+ connectors, MCP support, and one-click deployment. The platform supports web apps, mobile apps (React Native/Expo), slide decks, animated videos, and data visualizations.

## Key Facts
- **Current Agent:** Agent 4 (launched March 2026)
- **Valuation:** $3B (Jan 2026 raise) → $9B (March 2026 Series D)
- **ARR Growth:** ~$10M → ~$150M in 12 months
- **Users:** 50M+ self-reported
- **Pricing:** Starter ($0), Core ($25/mo), Pro ($100/mo), Enterprise (custom)

## Core Capabilities

### 1. Agent 4 — Autonomous Development
- 200-minute autonomous runs
- Parallel subagents for multi-file builds
- Self-testing and self-healing
- Plan Mode (brainstorm before build)
- Design Canvas (visual mockups → code)
- Lite / Economy / Power / Turbo modes

### 2. Built-in Services (Zero Setup)
- **Auth:** Replit Auth (zero-setup), Clerk Auth (custom), OAuth (Google/GitHub/Apple/X)
- **Database:** PostgreSQL with visual schema editor, auto migrations
- **Storage:** Object storage for files/media
- **Secrets:** Encrypted env vars, auto-sync
- **Hosting:** Static, Autoscale, Reserved VM deployments; custom domains

### 3. Connectors & Integrations (30+)
- Payments: Stripe, PayPal, RevenueCat
- AI: OpenAI, Anthropic, xAI, Google AI, Perplexity
- Productivity: Notion, Slack, Linear, Asana, Todoist, Monday.com, Google Workspace
- CRM: Salesforce, Zendesk
- Data: BigQuery, Snowflake, Databricks, Segment, Amplitude, Hex
- Design: Figma
- Dev: GitHub, GitLab, Bitbucket
- MCP server support (hundreds more possible)

### 4. Multi-Artifact Projects
Single backend can power:
- Web apps
- Mobile apps (React Native + Expo)
- Slide decks
- Animated videos
- Data visualizations
- 3D games

### 5. Import/Export
- Import: GitHub, GitLab, Bitbucket, Figma, Bolt, Lovable, Vercel, ZIP
- Export: GitHub, ZIP download
- Rapid import: replit.new/YOUR_REPO_URL

## Limitations
- Credit burn risk in Turbo mode
- No VPC/isolation (enterprise compliance gap)
- Code quality optimized for working, not readability
- Free tier very limited (0.5 vCPU, public only)
- Hosting costs separate from subscription
- Can get stuck in fix-fail-retry loops

## Use Cases
- Rapid prototyping and MVPs
- Internal tools and dashboards
- AI-powered apps (with built-in OpenAI/Anthropic)
- Payment-enabled SaaS (Stripe integration)
- Data-driven apps (warehouse connectors)
- Mobile apps with Expo/React Native

## Details
See `details/agent.md`, `details/connectors.md`, `details/pricing.md`, `details/buildathons.md`
