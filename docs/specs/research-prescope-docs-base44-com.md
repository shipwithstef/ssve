# Research Pre-Scope — docs.base44.com

**Generated:** 2026-05-06T09:58:18.547Z
**Source:** https://docs.base44.com
**Generator:** research/scripts/website-prescope.mjs
**Proposed domain:** base44-docs

## Sub-agent selection

- **Primary:** gemini-cli (per rules/research-must-use-gemini-cli.md)
- **Selected for this run:** gemini-cli — long-context site extraction
- **Fallback if gemini-cli fails:** Claude in-session via WebFetch loop

## Volume estimate

- Sitemap URLs found: 202
- Imprint pattern matches on homepage: 0
- robots.txt fetched: yes
- Homepage fetched: yes

## Imprint patterns detected (across homepage + likely-imprint pages)

Pages probed: 13
- https://docs.base44.com/
- https://docs.base44.com/общи-условия/
- https://docs.base44.com/контакти/
- https://docs.base44.com/за-нас/
- https://docs.base44.com/about/
- https://docs.base44.com/contact/
- https://docs.base44.com/terms/
- https://docs.base44.com/политика-за-поверителност/
- https://docs.base44.com/privacy/
- https://docs.base44.com/imprint/
- https://docs.base44.com/Community-and-support/Contacting-support
- https://docs.base44.com/Community-and-support/Privacy-and-security
- https://docs.base44.com/documentation/account-and-billing/about-workspaces

Matches (deduped, with source):
_None matched. Either site has no public imprint OR patterns need extension. Verify manually before declaring "no EIK"._

## File checklist (URLs to extract)

Every URL below MUST be fetched, read in full, and have an extraction entry in the corresponding details/ file or CAPABILITIES.md.

- [ ] https://docs.base44.com
- [ ] https://docs.base44.com/
- [ ] https://docs.base44.com/.cursor/review-checklist-cli-function-commands
- [ ] https://docs.base44.com/.mintlify/Assistant
- [ ] https://docs.base44.com/Account-and-billing/Billing-and-plans
- [ ] https://docs.base44.com/Account-and-billing/Credits
- [ ] https://docs.base44.com/Account-and-billing/Managing-your-workspaces
- [ ] https://docs.base44.com/Account-and-billing/plan-sales
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
- [ ] https://docs.base44.com/CLAUDE
- [ ] https://docs.base44.com/Community-and-support/Community
- [ ] https://docs.base44.com/Community-and-support/Contacting-support
- [ ] https://docs.base44.com/Community-and-support/Deleting-user-data
- [ ] https://docs.base44.com/Community-and-support/Privacy-and-security
- [ ] https://docs.base44.com/Community-and-support/Referral-program
- [ ] https://docs.base44.com/Community-and-support/Troubleshooting
- [ ] https://docs.base44.com/Community-and-support/ai-service-providers
- [ ] https://docs.base44.com/Community-and-support/user-profile
- [ ] https://docs.base44.com/Community-and-support/using-generative-ai
- [ ] https://docs.base44.com/Enterprise/Base44-for-enterprises
- [ ] https://docs.base44.com/Enterprise/Enterprise-SSO-and-app-visibility
- [ ] https://docs.base44.com/Enterprise/Enterprise-workspace-domain
- [ ] https://docs.base44.com/Enterprise/SSO-for-enterprise-workspace
- [ ] https://docs.base44.com/Enterprise/workspace-secrets
- [ ] https://docs.base44.com/Getting-Started/App-templates
- [ ] https://docs.base44.com/Getting-Started/Hiring-a-partner
- [ ] https://docs.base44.com/Getting-Started/Prompt-guide
- [ ] https://docs.base44.com/Getting-Started/Prompt-library
- [ ] https://docs.base44.com/Getting-Started/Quick-start-guide
- [ ] https://docs.base44.com/Getting-Started/import-from-figma-guidelines
- [ ] https://docs.base44.com/Getting-Started/migrating-an-existing-app
- [ ] https://docs.base44.com/Getting-Started/superagent
- [ ] https://docs.base44.com/Getting-started/changelog
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
- [ ] https://docs.base44.com/Performance-and-SEO/App-performance
- [ ] https://docs.base44.com/Performance-and-SEO/SEO-and-search-visibility
- [ ] https://docs.base44.com/Performance-and-SEO/checking-your-seo-and-geo
- [ ] https://docs.base44.com/Setting-up-your-app/Managing-access
- [ ] https://docs.base44.com/Setting-up-your-app/Managing-login-and-registration
- [ ] https://docs.base44.com/Setting-up-your-app/Managing-security-settings
- [ ] https://docs.base44.com/Setting-up-your-app/Setting-up-SSO
- [ ] https://docs.base44.com/Setting-up-your-app/Setting-up-your-custom-domain
- [ ] https://docs.base44.com/Setting-up-your-app/setting-up-tranzila
- [ ] https://docs.base44.com/Setting-up-your-app/setting-up-wix-payments
- [ ] https://docs.base44.com/api-reference/analytics/get-analytics
- [ ] https://docs.base44.com/api-reference/apps/get-app-analytics
- [ ] https://docs.base44.com/api-reference/audit-logs/list-audit-logs
- [ ] https://docs.base44.com/api-reference/system/health-check
- [ ] https://docs.base44.com/api-reference/users/get-user
- [ ] https://docs.base44.com/api-reference/users/list-user-apps
- [ ] https://docs.base44.com/api-reference/users/list-users
- [ ] https://docs.base44.com/developers/_dev-docs-banner
- [ ] https://docs.base44.com/developers/app-code/editor/activity-monitor
- [ ] https://docs.base44.com/developers/app-code/editor/code-tab
- [ ] https://docs.base44.com/developers/app-code/local-development/github
- [ ] https://docs.base44.com/developers/app-code/overview/introduction
- [ ] https://docs.base44.com/developers/app-code/overview/project-structure
- [ ] https://docs.base44.com/developers/backend/overview/agent-extensions
- [ ] https://docs.base44.com/developers/backend/overview/backend-service-basics
- [ ] https://docs.base44.com/developers/backend/overview/base44-docs-mcp
- [ ] https://docs.base44.com/developers/backend/overview/features
- [ ] https://docs.base44.com/developers/backend/overview/introduction
- [ ] https://docs.base44.com/developers/backend/overview/link-existing-project
- [ ] https://docs.base44.com/developers/backend/overview/local-dev/get-started
- [ ] https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview
- [ ] https://docs.base44.com/developers/backend/overview/mcp-server
- [ ] https://docs.base44.com/developers/backend/overview/pricing
- [ ] https://docs.base44.com/developers/backend/overview/project-structure
- [ ] https://docs.base44.com/developers/backend/overview/run-scripts
- [ ] https://docs.base44.com/developers/backend/overview/skills
- [ ] https://docs.base44.com/developers/backend/overview/start-from-existing-app
- [ ] https://docs.base44.com/developers/backend/overview/troubleshooting
- [ ] https://docs.base44.com/developers/backend/products/auth
- [ ] https://docs.base44.com/developers/backend/products/database
- [ ] https://docs.base44.com/developers/backend/products/deployment
- [ ] https://docs.base44.com/developers/backend/products/realtime
- [ ] https://docs.base44.com/developers/backend/quickstart/frameworks/quickstart-hono
- [ ] https://docs.base44.com/developers/backend/quickstart/frameworks/quickstart-refine
- [ ] https://docs.base44.com/developers/backend/quickstart/frameworks/quickstart-solid-js
- [ ] https://docs.base44.com/developers/backend/quickstart/frameworks/quickstart-vue
- [ ] https://docs.base44.com/developers/backend/quickstart/frameworks/quickstart-with-react
- [ ] https://docs.base44.com/developers/backend/quickstart/frameworks/quickstart-with-react-native
- [ ] https://docs.base44.com/developers/backend/quickstart/quickstart-with-ai
- [ ] https://docs.base44.com/developers/backend/quickstart/templates/quickstart-backend-only
- [ ] https://docs.base44.com/developers/backend/quickstart/templates/quickstart-react-template
- [ ] https://docs.base44.com/developers/backend/resources/agents-config
- [ ] https://docs.base44.com/developers/backend/resources/auth
- [ ] https://docs.base44.com/developers/backend/resources/backend-functions/automations
- [ ] https://docs.base44.com/developers/backend/resources/backend-functions/overview
- [ ] https://docs.base44.com/developers/backend/resources/connectors
- [ ] https://docs.base44.com/developers/backend/resources/entities/entity-schemas
- [ ] https://docs.base44.com/developers/backend/resources/entities/overview
- [ ] https://docs.base44.com/developers/backend/resources/entities/security
- [ ] https://docs.base44.com/developers/backend/resources/entities/user-schema
- [ ] https://docs.base44.com/developers/changelog
- [ ] https://docs.base44.com/developers/home
- [ ] https://docs.base44.com/developers/references/cli/commands/agents-pull
- [ ] https://docs.base44.com/developers/references/cli/commands/agents-push
- [ ] https://docs.base44.com/developers/references/cli/commands/auth-password-login
- [ ] https://docs.base44.com/developers/references/cli/commands/auth-pull
- [ ] https://docs.base44.com/developers/references/cli/commands/auth-push
- [ ] https://docs.base44.com/developers/references/cli/commands/auth-social-login
- [ ] https://docs.base44.com/developers/references/cli/commands/connectors-list-available
- [ ] https://docs.base44.com/developers/references/cli/commands/connectors-pull
- [ ] https://docs.base44.com/developers/references/cli/commands/connectors-push
- [ ] https://docs.base44.com/developers/references/cli/commands/create
- [ ] https://docs.base44.com/developers/references/cli/commands/dashboard-open
- [ ] https://docs.base44.com/developers/references/cli/commands/deploy
- [ ] https://docs.base44.com/developers/references/cli/commands/dev
- [ ] https://docs.base44.com/developers/references/cli/commands/eject
- [ ] https://docs.base44.com/developers/references/cli/commands/entities-push
- [ ] https://docs.base44.com/developers/references/cli/commands/exec
- [ ] https://docs.base44.com/developers/references/cli/commands/functions-delete
- [ ] https://docs.base44.com/developers/references/cli/commands/functions-deploy
- [ ] https://docs.base44.com/developers/references/cli/commands/functions-list
- [ ] https://docs.base44.com/developers/references/cli/commands/functions-pull
- [ ] https://docs.base44.com/developers/references/cli/commands/introduction
- [ ] https://docs.base44.com/developers/references/cli/commands/link
- [ ] https://docs.base44.com/developers/references/cli/commands/login
- [ ] https://docs.base44.com/developers/references/cli/commands/logout
- [ ] https://docs.base44.com/developers/references/cli/commands/logs
- [ ] https://docs.base44.com/developers/references/cli/commands/secrets-delete
- [ ] https://docs.base44.com/developers/references/cli/commands/secrets-list
- [ ] https://docs.base44.com/developers/references/cli/commands/secrets-set
- [ ] https://docs.base44.com/developers/references/cli/commands/site-deploy
- [ ] https://docs.base44.com/developers/references/cli/commands/site-open
- [ ] https://docs.base44.com/developers/references/cli/commands/types-generate
- [ ] https://docs.base44.com/developers/references/cli/commands/whoami
- [ ] https://docs.base44.com/developers/references/cli/get-started/overview
- [ ] https://docs.base44.com/developers/references/introduction
- [ ] https://docs.base44.com/developers/references/sdk/docs/functions/createClient
- [ ] https://docs.base44.com/developers/references/sdk/docs/functions/createClientFromRequest
- [ ] https://docs.base44.com/developers/references/sdk/docs/interfaces/agents
- [ ] https://docs.base44.com/developers/references/sdk/docs/interfaces/analytics
- [ ] https://docs.base44.com/developers/references/sdk/docs/interfaces/app-logs
- [ ] https://docs.base44.com/developers/references/sdk/docs/interfaces/auth
- [ ] https://docs.base44.com/developers/references/sdk/docs/interfaces/connectors
- [ ] https://docs.base44.com/developers/references/sdk/docs/interfaces/functions
- [ ] https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities
- [ ] https://docs.base44.com/developers/references/sdk/docs/type-aliases/integrations
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/client
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/dynamic-types
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/overview
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/third-party-apis
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/work-with-data
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/work-with-sdk
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
- [ ] https://docs.base44.com/index
- [ ] https://docs.base44.com/llms.txt
- [ ] https://docs.base44.com/mintlify-assets/_next/static/media/bb3ef058b751a6ad-s.p.woff2
- [ ] https://docs.base44.com/mintlify-assets/_next/static/media/c4b700dcb2187787-s.p.woff2
- [ ] https://docs.base44.com/mintlify-assets/_next/static/media/e4af272ccee01ff0-s.p.woff2
- [ ] https://docs.base44.com/promoting-your-app/social-content
- [ ] https://docs.base44.com/sitemap.xml
- [ ] https://docs.base44.com/superagents/creating-a-superagent
- [ ] https://docs.base44.com/superagents/superagents-for-wix

## Extraction plan

- Output domain: `references/knowledge/base44-docs/`
- CAPABILITIES.md: site identity, services, pricing, legal status
- details/about.md: ownership, advocate names, Bar registration, EIK/BULSTAT, VAT
- details/services.md: each service with verbatim pricing
- details/legal.md: T&C, refund policy, disclaimers, supervisory authority
- details/contact.md: contact methods, address, sub-pages list

## Expected output artifacts

- `references/knowledge/<domain>/CAPABILITIES.md`
- `references/knowledge/<domain>/details/*.md` (one per area)
- `references/knowledge/<domain>/.version`
- `references/knowledge/<domain>/.sources.jsonl` (one entry per URL above)
- `docs/specs/research-log.md` (append entry)
- INDEX.md updated

## Coverage gate

After extraction, run:
```
node research/scripts/coverage-check.mjs --prescope /workspace/seriousvibecoding/docs/specs/research-prescope-docs-base44-com.md --domain references/knowledge/<domain>/
```
Coverage must be 100% (every checklist URL appears in .sources.jsonl).
