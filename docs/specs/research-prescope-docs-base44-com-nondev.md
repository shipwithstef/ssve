# Research Pre-Scope — docs.base44.com (Non-Developer Sections)

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Source:** https://docs.base44.com
**Scope:** All documentation EXCEPT /developers/ (Develop tab) and /api-reference/ — user already has developer coverage
**Proposed domain:** base44

## Sub-agent selection

- **Primary:** gemini-cli (per rules/research-must-use-gemini-cli.md)
- **Selected for this run:** gemini-cli — long-context site extraction
- **Fallback if gemini-cli fails:** Claude in-session via WebFetch loop

## Volume estimate

- Total sitemap URLs: 202
- Excluded (/developers/*): ~85 URLs (Develop tab — already covered)
- Excluded (/api-reference/*): ~6 URLs
- Excluded (assets, sitemap, special): ~5 URLs
- **URLs to extract: ~106**

## Excluded URLs (already covered)

All URLs under `/developers/` (CLI, SDK, backend functions, entities, auth, deployment, etc.)
and `/api-reference/` are excluded from this extraction.

## File checklist (URLs to extract)

### Getting Started
- [ ] https://docs.base44.com/Getting-Started/Quick-start-guide
- [ ] https://docs.base44.com/Getting-Started/App-templates
- [ ] https://docs.base44.com/Getting-Started/Prompt-guide
- [ ] https://docs.base44.com/Getting-Started/Prompt-library
- [ ] https://docs.base44.com/Getting-Started/Hiring-a-partner
- [ ] https://docs.base44.com/Getting-Started/migrating-an-existing-app
- [ ] https://docs.base44.com/Getting-Started/import-from-figma-guidelines
- [ ] https://docs.base44.com/Getting-Started/superagent
- [ ] https://docs.base44.com/Getting-started/changelog

### Superagents
- [ ] https://docs.base44.com/superagents/creating-a-superagent
- [ ] https://docs.base44.com/superagents/superagents-for-wix

### Building Your App
- [ ] https://docs.base44.com/Building-your-app/AI-agents-for-apps
- [ ] https://docs.base44.com/Building-your-app/AI-chat-modes
- [ ] https://docs.base44.com/Building-your-app/Creating-automations
- [ ] https://docs.base44.com/Building-your-app/Design
- [ ] https://docs.base44.com/Building-your-app/Managing-your-app-data
- [ ] https://docs.base44.com/Building-your-app/Mobile-experience
- [ ] https://docs.base44.com/Building-your-app/NPM-packages
- [ ] https://docs.base44.com/Building-your-app/Update-to-new-infrastructure
- [ ] https://docs.base44.com/Building-your-app/Using-media
- [ ] https://docs.base44.com/Building-your-app/managing-your-pages

### Setting Up Your App
- [ ] https://docs.base44.com/Setting-up-your-app/Managing-access
- [ ] https://docs.base44.com/Setting-up-your-app/Managing-login-and-registration
- [ ] https://docs.base44.com/Setting-up-your-app/Managing-security-settings
- [ ] https://docs.base44.com/Setting-up-your-app/Setting-up-SSO
- [ ] https://docs.base44.com/Setting-up-your-app/Setting-up-your-custom-domain
- [ ] https://docs.base44.com/Setting-up-your-app/setting-up-tranzila
- [ ] https://docs.base44.com/Setting-up-your-app/setting-up-wix-payments

### Performance, SEO & Growth
- [ ] https://docs.base44.com/Performance-and-SEO/App-performance
- [ ] https://docs.base44.com/Performance-and-SEO/SEO-and-search-visibility
- [ ] https://docs.base44.com/Performance-and-SEO/checking-your-seo-and-geo
- [ ] https://docs.base44.com/promoting-your-app/social-content

### Account & Billing
- [ ] https://docs.base44.com/Account-and-billing/Billing-and-plans
- [ ] https://docs.base44.com/Account-and-billing/Credits
- [ ] https://docs.base44.com/Account-and-billing/Managing-your-workspaces
- [ ] https://docs.base44.com/Account-and-billing/plan-sales

### Integrations & Connectors
- [ ] https://docs.base44.com/Integrations/AI-integrations
- [ ] https://docs.base44.com/Integrations/Airtable-integration
- [ ] https://docs.base44.com/Integrations/Connectors
- [ ] https://docs.base44.com/Integrations/Elevenlabs-integration
- [ ] https://docs.base44.com/Integrations/Google-places-integration
- [ ] https://docs.base44.com/Integrations/Resend-integration
- [ ] https://docs.base44.com/Integrations/Slack-integration
- [ ] https://docs.base44.com/Integrations/Using-integrations
- [ ] https://docs.base44.com/Integrations/Zapier-integration
- [ ] https://docs.base44.com/Integrations/built-in-integrations
- [ ] https://docs.base44.com/Integrations/connectors-catalog
- [ ] https://docs.base44.com/Integrations/github-connector
- [ ] https://docs.base44.com/Integrations/gmail-connector
- [ ] https://docs.base44.com/Integrations/google-search-console-connector
- [ ] https://docs.base44.com/Integrations/linkedin-connector
- [ ] https://docs.base44.com/Integrations/setting-up-shared-connectors
- [ ] https://docs.base44.com/Integrations/slack-connector
- [ ] https://docs.base44.com/Integrations/user-connectors

### Enterprise
- [ ] https://docs.base44.com/Enterprise/Base44-for-enterprises
- [ ] https://docs.base44.com/Enterprise/Enterprise-SSO-and-app-visibility
- [ ] https://docs.base44.com/Enterprise/Enterprise-workspace-domain
- [ ] https://docs.base44.com/Enterprise/SSO-for-enterprise-workspace
- [ ] https://docs.base44.com/Enterprise/workspace-secrets

### Community & Support
- [ ] https://docs.base44.com/Community-and-support/Community
- [ ] https://docs.base44.com/Community-and-support/Contacting-support
- [ ] https://docs.base44.com/Community-and-support/Deleting-user-data
- [ ] https://docs.base44.com/Community-and-support/Privacy-and-security
- [ ] https://docs.base44.com/Community-and-support/Referral-program
- [ ] https://docs.base44.com/Community-and-support/Troubleshooting
- [ ] https://docs.base44.com/Community-and-support/ai-service-providers
- [ ] https://docs.base44.com/Community-and-support/user-profile
- [ ] https://docs.base44.com/Community-and-support/using-generative-ai

### Homepage & Root
- [ ] https://docs.base44.com
- [ ] https://docs.base44.com/

### Additional Documentation Pages
- [ ] https://docs.base44.com/documentation/account-and-billing/about-workspaces
- [ ] https://docs.base44.com/documentation/account-and-billing/managing-your-account
- [ ] https://docs.base44.com/documentation/account-and-billing/managing-your-workspace-members
- [ ] https://docs.base44.com/documentation/account-and-billing/new-plans-and-workspaces
- [ ] https://docs.base44.com/documentation/account-and-billing/notifications
- [ ] https://docs.base44.com/documentation/account-and-billing/setting-up-a-custom-mcp
- [ ] https://docs.base44.com/documentation/building-your-app/developer-tools
- [ ] https://docs.base44.com/documentation/building-your-app/editing-code
- [ ] https://docs.base44.com/documentation/building-your-app/sending-emails
- [ ] https://docs.base44.com/documentation/building-your-app/uploading-to-app-stores
- [ ] https://docs.base44.com/documentation/enterprise/ip-allowlist
- [ ] https://docs.base44.com/documentation/getting-started/super-bowl
- [ ] https://docs.base44.com/documentation/integrations/using-custom-integrations
- [ ] https://docs.base44.com/documentation/managing-app-data/testing-your-data
- [ ] https://docs.base44.com/documentation/performance-and-seo/app-analytics
- [ ] https://docs.base44.com/documentation/setting-up-your-app/setting-up-payments
- [ ] https://docs.base44.com/documentation/using-your-workspaces/adding-workspace-skills
- [ ] https://docs.base44.com/documentation/using-your-workspaces/creating-and-using-workspace-templates
- [ ] https://docs.base44.com/documentation/using-your-workspaces/managing-your-workspace-apps
- [ ] https://docs.base44.com/documentation/using-your-workspaces/new-workspaces
- [ ] https://docs.base44.com/documentation/using-your-workspaces/previous-workspace-and-credits-model

## Extraction plan

- Output domain: `references/knowledge/domains/base44/`
- Non-developer docs will be written as new detail files:
  - `details/getting-started.md` — onboarding, templates, prompts, migration, partners
  - `details/superagents.md` — superagent creation, Wix integration
  - `details/building-app.md` — AI agents, chat modes, automations, design, data, mobile, media, pages
  - `details/app-setup.md` — access, auth, security, SSO, domains, payments
  - `details/performance-growth.md` — SEO, performance, social content, analytics
  - `details/account-billing.md` — plans, credits, workspaces
  - `details/integrations-connectors.md` — built-in integrations, connectors catalog, setup guides
  - `details/enterprise.md` — enterprise features, SSO, domain, secrets
  - `details/community-support.md` — community, support, privacy, legal, AI providers
- Update existing `CAPABILITIES.md` to include non-developer capabilities
- Update `.version` to reflect full-site coverage date

## Expected output artifacts

- `references/knowledge/domains/base44/CAPABILITIES.md` (updated)
- `references/knowledge/domains/base44/details/*.md` (new + existing)
- `references/knowledge/domains/base44/.version` (updated)
- `references/knowledge/domains/base44/.sources.jsonl` (appended)
- `docs/specs/research-log.md` (append entry)
- INDEX.md updated

## Coverage gate

After extraction, run:
```
node research/scripts/coverage-check.mjs --prescope docs/specs/research-prescope-docs-base44-com-nondev.md --domain references/knowledge/domains/base44/
```
Coverage must be 100% for non-developer checklist URLs.
