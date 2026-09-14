# Tools Registry — Detail

## Mechanism (factual)

Three tool categories: (1) CLI tools — zero-dependency Node.js scripts in `tools/clis/`, (2) Integration guides — markdown docs in `tools/integrations/`, (3) Composio MCP — managed OAuth layer in `tools/composio/`.

**CLI tools (61 total):**
- Standalone `.js` files, Node 18+, no npm install
- All read credentials from environment variables (never hardcoded)
- All support `--dry-run` for safe previewing
- Auth patterns: API key, OAuth token, JWT (varies by platform)
- Categories: SEO (5), Email (8), Outreach (4), Ads (5), Analytics (9), Payments (3), Referral (5), Social (3), Reviews (2), CRM (4), Data (4), Automation (2), Scheduling (4), Forms (1), Video (1), Messaging (2), Optimization (1), Competitive (1)

**Integration guides (53+ total):**
- Markdown docs with: Capabilities table, Authentication, Common operations, MCP availability
- Organized by category matching CLI tools
- New additions: v1.5 (nitrosend, firehose, introw), v1.6 (sparktoro, rb2b, gong), v1.9 (heygen, hyperframes)

**Composio MCP:**
- Single MCP server providing managed OAuth for 15+ platforms
- Setup: `npx @composio/mcp@latest setup`
- Covers: HubSpot, Salesforce, Meta Ads, LinkedIn Ads, Google Sheets, Slack, Notion, ActiveCampaign, Klaviyo, Shopify, Gmail, Airtable, Google Analytics
- Additive — doesn't replace existing CLIs or native MCP servers

## Analysis (expert commentary)

- **Useful for:** The CLI tools pattern is clever — zero-dependency scripts that work immediately without npm install. Lower friction than typical SDK integrations. The `--dry-run` flag is a good safety pattern svc could adopt.
- **Trade-offs:** 61 CLI tools means 61 API surface areas to maintain. No automated testing visible for CLIs (unlike skills which have evals). Risk of API drift.
- **Similar to:** svc has `scripts/` with bash/node utilities but nothing at this scale. The CLI tool pattern is more like a "marketing toolbox" than a pipeline component.
- **Could improve svc by:** The `--dry-run` pattern could be added to svc's destructive scripts (e.g., `worktree.sh remove --dry-run`). The environment-variable-only auth pattern is cleaner than svc's mixed config approaches.
- **Assumptions:** Users have Node 18+ installed. API keys are available. Tools assume standard API rate limits.
- **Watch out for:** Composio adds a dependency layer — if Composio service is down, those integrations break. Native CLIs don't have this risk.

## Key Source Files (L4 pointers)

- `tools/clis/README.md` — Auth table (all 61 tools + env vars), install instructions, security rules
- `tools/composio/marketing-tools.md` — Full toolkit mapping by category (CRM, Email, Ads, Productivity, Commerce, Analytics)
- `tools/REGISTRY.md` — Master tool index with capabilities matrix
- `tools/integrations/` — 53+ individual integration guides
