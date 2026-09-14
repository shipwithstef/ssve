# Integrations and Connectors

## Mechanism

Base44 provides multiple ways to connect external services: OAuth-based connectors, built-in integrations, custom OpenAPI integrations, and MCP servers.

**Connectors Overview**
- **Shared Connectors**: App-level, OAuth-based connections to popular tools. One account per connector type per app. All app editors share the same connection.
- **App User Connectors**: Workspace-level OAuth configurations that let each app user connect their own account. Added via Client ID, Client Secret, and scopes.
- Requires Builder plan or higher to use connectors.

**Connector Catalog**
- Categories include:
  - **Communication**: Gmail, Slack (User + Bot), Discord, Microsoft Outlook, Teams.
  - **Productivity**: Google Calendar, Google Drive, Google Tasks, Google Meet, Google Sheets, Google Analytics, Google BigQuery, Notion, ClickUp, Wrike, Linear, Box, Dropbox, Microsoft OneDrive, SharePoint, Typeform.
  - **CRM/Sales**: Salesforce, HubSpot, LinkedIn.
  - **Development**: GitHub, GitLab, Google Search Console, Supabase, Contentful.
  - **Social/Marketing**: TikTok, Instagram (via Facebook), YouTube.
  - **AI/ML**: Hugging Face.
  - **HR**: BambooHR.
  - **Finance**: Splitwise.
  - **Scheduling**: Calendly.
  - **E-commerce**: Wix, Shopify.
- Connector automations (beta) allow triggering automations from connected tool events.

**Built-in Integrations**
- Preinstalled in every app:
  - **SendEmail**: Transactional emails to registered users.
  - **GenerateImage**: AI image generation.
  - **GenerateVideo**: AI video generation.
  - **UploadFile**: File uploads in live apps.
  - **ExtractDataFromUploadedFile**: Structured data extraction from documents.
  - **invokeLLM**: Call AI models with selectable model per app.
- Built-in integrations consume integration credits when used.

**Custom Integrations (Workspace-level)**
- Import an OpenAPI/Swagger specification (URL or JSON) at the workspace level.
- Select up to 30 endpoints to expose.
- Any app in the workspace can call approved operations via `base44.integrations.custom.call()`.
- Auth headers stored as encrypted workspace secrets; never sent to browser.
- Calls proxied server-side with SSRF protection.
- Workspace admins/owners on Builder plan+ can create; any member can use.

**Account-Level MCP**
- Custom MCP (Model Context Protocol) servers can be added at the account level.
- Connect external tools and data sources so the AI builder can pull in extra context.
- Reuse across multiple apps without repeating setup.

**Specific Connector Guides**
- **Slack**: Two variants — Slack User (reads conversations, sends as user) and Slack Bot (sends structured messages as bot). Extensive scope list including channels, groups, DMs, messages, files, pins, bookmarks, search, users.
- **Gmail**: Sends email through single Gmail connection. Scopes include read-only, send, modify, compose.
- **LinkedIn**: Publishes posts to profile or organization pages. Scopes include profile access, publishing, organization admin, advertising.
- **GitHub**: Accesses repositories, pull requests, issues. Scopes include repo, read:user, user:email.
- **Google Search Console**: Accesses search performance, indexing, sitemaps, URL inspection. Requires domain verification in GSC before connecting.

## Analysis

Base44's integration architecture has four layers, which is both powerful and potentially confusing:
1. **Built-ins**: Platform-managed, credit-consuming, always available.
2. **Connectors**: OAuth-based, quick setup, shared or per-user.
3. **Custom OpenAPI**: Spec-driven, workspace-scoped, up to 30 endpoints.
4. **MCP**: Account-level, AI-context-oriented, protocol-based.

This layered approach lets users choose the right abstraction for their use case — built-ins for common tasks, connectors for popular SaaS tools, custom OpenAPI for internal APIs, and MCP for AI-centric integrations.

The shared connector model (one account per app) is a deliberate simplicity trade-off. For multi-user apps where each user needs their own account, the app user connectors or a custom OAuth flow is required. The FAQ for almost every connector includes "Can each person using my app connect their own account? No." This is a known limitation that builders must design around.

The custom integration security model is well-designed: auth headers stored as encrypted workspace secrets, server-side proxying with SSRF protection, and workspace headers taking precedence over app overrides. This prevents apps from stealing or misusing workspace-level credentials.

The 30-endpoint limit on custom integrations is a reasonable constraint that forces API designers to expose only necessary operations. The requirement for a valid OpenAPI spec ensures the integration is discoverable and type-safe.

Connector automations (beta) are significant because they turn integrations from passive data sources into active triggers. This makes Base44 a credible automation platform, not just an app builder.

The MCP server support at the account level shows Base44 is investing in AI-native integration patterns. MCP is an emerging standard for model context exchange, and supporting it positions Base44 for future AI ecosystem interoperability.

## L4 Pointers

> "Shared connectors let you securely connect your own accounts to your Base44 app using OAuth, without managing API keys. Once connected, you can use a tool across pages, flows, and backend functions in your app."
> — https://docs.base44.com/documentation/integrations/setting-up-shared-connectors

> "User connectors let each person connect their own account. Shared connectors use one account for everyone in the app."
> — https://docs.base44.com/documentation/integrations/user-connectors

> "Base44's built-in SendEmail integration comes preinstalled in every app and does not require a paid plan, extra setup, or API keys."
> — https://docs.base44.com/documentation/building-your-app/sending-emails

> "The built-in invokeLLM integration now lets you choose which AI model runs LLM calls in your app."
> — https://docs.base44.com/documentation/changelog

> "Workspace integrations let you register shared external APIs at the workspace level from an OpenAPI specification. You import a spec, select up to 30 operations, and connect the API once in your workspace."
> — https://docs.base44.com/documentation/integrations/using-custom-integrations

> "Auth headers stored as encrypted workspace secrets; never sent to browser. Calls proxied server-side with SSRF protection."
> — https://docs.base44.com/documentation/integrations/using-custom-integrations

> "Custom MCP servers at the account level. Connect external tools and data sources so the AI builder can pull in extra context while you work. Reuse across multiple apps without repeating setup."
> — https://docs.base44.com/documentation/changelog

> "The Slack connectors let your app send messages, read conversations, and work with channels and workspace data inside Slack. Base44 offers two Slack connectors: Slack User and Slack Bot."
> — https://docs.base44.com/documentation/integrations/slack-connector

> "The Gmail connector lets your app send email through a single Gmail connection. Use it to deliver alerts, approvals, digests, reports, and automated updates directly from your Gmail account."
> — https://docs.base44.com/documentation/integrations/gmail-connector

> "The LinkedIn connector lets your app publish posts to your LinkedIn profile or to a LinkedIn organization page where the connected account has admin access."
> — https://docs.base44.com/documentation/integrations/linkedin-connector

> "The GitHub connector lets your Base44 app securely access GitHub data using OAuth. Use it to build pull request and issue dashboards, automate issue creation, generate release notes, and sync repository activity."
> — https://docs.base44.com/documentation/integrations/github-connector

> "The Google Search Console connector lets you access your app's search performance data, sitemaps, URL inspection results, and indexing status directly from Base44."
> — https://docs.base44.com/documentation/integrations/google-search-console-connector

> "Connector automations are in beta and let you run an automation when a connected integration sends an event."
> — https://docs.base44.com/documentation/changelog
