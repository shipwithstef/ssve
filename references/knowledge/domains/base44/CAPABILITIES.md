# Base44 Domain - Capabilities

**Domain:** Base44 application development and backend-service operation
**Layer:** 2 (CAPABILITIES)
**Last updated:** 2026-05-06 (skills repo extraction completed)

---

## Positioning

- Base44 backend service is the same backend that powers the Base44 app editor, exposed as a standalone backend-as-a-service for code-first projects.
- The backend service and CLI are documented as beta as of 2026-04-18.
- Base44's billing docs say the backend platform is currently free while in beta and consumes integration credits rather than a separate backend subscription.
- Base44 is designed to be AI-agent-friendly: backend resources are defined in code and Base44 ships skills and MCP servers to help AI tools work with projects.

## Operating Models

- Base44 has a distinct app-editor path for apps originally created in the Base44 UI and a backend-service path for code-first backend projects.
- `base44 create` starts a new backend-service project.
- `base44 eject` is the documented bridge from an app-editor app into a separate local codebase with a new backend project on Base44.
- `base44 link` is for projects that already have a local `base44/` directory and need to connect that code to a Base44 backend.
- GitHub integration is a permanent two-way sync workflow for app-editor projects, with `main` as the supported promotion branch.

## Core Backend Features

- Base44 provides NoSQL entities with MongoDB-compatible query operators, non-enforced schemas, row-level and field-level security, and realtime subscriptions.
- Authentication is built in, including email/password, social login providers, session handling, and SSO support.
- Backend functions run as Deno-based serverless TypeScript code callable through the SDK or HTTP.
- Hosting supports SPA site deployment with custom domains and automatic HTTPS; SSR and server components are not supported in Base44 site hosting.

## Project Structure

- Backend-service projects are centered on a `base44/` directory with `config.jsonc` plus a local `.app.jsonc` link file.
- Resource directories include `entities/`, `functions/`, `agents/`, `connectors/`, and `auth/`.
- `.types/types.d.ts` can be generated for type-safe SDK usage.
- Functions are directory-based and require an `entry.ts` or `entry.js`; `function.jsonc` is optional for naming and automations.

## Local Development

- Base44 supports local frontend development with the frontend on its own dev server and the backend hosted remotely.
- Backend-service projects can also use `base44 dev` for partially local backend development.
- In `base44 dev`, functions, entities, and media run locally; authentication, core integrations, and custom integrations are forwarded to the deployed backend.
- Local entity data is in-memory and resets when the dev server stops; schema changes can clear local entity data.
- Automations do not run locally in `base44 dev`.

## Deployment And Scripts

- The current official backend-service docs present `base44 deploy` as the standard resource deployment path for linked backend projects.
- Resource-specific CLI flows also exist, such as function deployment and pulls, auth push/pull, and type generation.
- `base44 exec` runs standalone Deno scripts with a pre-authenticated global `base44` SDK client using user permissions rather than service-role access.
- In practice, environment cloning quality must be validated empirically. A separate non-prod app can fail to represent production because of platform limits rather than repo setup alone.
- Observed failure modes worth checking early include frontend site upload size ceilings, lower function-count ceilings on cloned/dev apps, and function startup failures caused by missing per-app secrets.

## Integrations

- Custom OpenAPI integrations are for exposing an external API inside Base44, not for replacing Base44 as the app's primary backend.
- Custom integrations are workspace-level, proxied through Base44, and keep secrets off the frontend.
- When an integration needs custom request logic, transformation, or unsupported API behavior, Base44 recommends backend functions instead of forcing everything through custom integrations.
- Connectors solve OAuth-backed third-party access; custom integrations solve shared OpenAPI-backed API access; backend functions solve unrestricted custom server logic.

## JavaScript SDK

- The SDK is `@base44/sdk` on npm (v0.8.27 as of 2026-05-06), MIT-licensed, TypeScript-first with ESM output.
- Two entry points: `createClient({appId})` for external apps and `createClientFromRequest(req)` for Base44-hosted backend functions.
- Three authentication modes: anonymous, user JWT, and service-role JWT (backend-only).
- Modules: entities (CRUD + realtime), auth (login/register/OTP/password), functions (invoke + fetch), integrations (Core AI/image/email/file + custom OpenAPI), agents (conversations + messaging), connectors (OAuth token retrieval), analytics (event tracking), app-logs, sso.
- Dynamic Proxy-based access for `entities.{Name}` and `integrations.{Package}.{Endpoint}` — no SDK update needed when new resources are added in the editor.
- Type registries (`EntityTypeRegistry`, `FunctionNameRegistry`, `AgentNameRegistry`, `ConnectorIntegrationTypeRegistry`) are populated by the CLI `types generate` command via module augmentation.
- Socket.IO v4.7.5 handles realtime subscriptions for entity changes and agent conversation streaming.
- Axios response interceptor unwraps `response.data` automatically and transforms errors into `Base44Error` with `status`, `code`, `data`, and `originalError`.
- Browser-first design: localStorage token persistence, `document.visibilityState` analytics heartbeat, iframe detection with `postMessage` API logging.
- Official docs at `docs.base44.com/developers/references/sdk` are TypeDoc-generated from source and include getting-started guides (client, work-with-data, dynamic-types, third-party-apis), function reference, interface reference, and type-alias reference.
- Docs provide a complete index at `https://docs.base44.com/llms.txt` for LLM context discovery.
- Docs add narrative decision trees (connectors vs custom integrations vs backend functions) and limitation callouts not present in inline TSDoc.

## RLS And Entity Verification Patterns

- Entity security work must be grounded with an entity audit, not scanner output
  alone. Use `scripts/audit-base44-entity-rls.mjs` against local entities or a
  live `coding/write` round-trip dump before recommending schema/RLS fixes.
- Before deploying an RLS/security rule, prove the gap with a non-privileged
  SDK/API probe, deploy the rule, then rerun the same probe. Validate the record
  with `scripts/validate-security-rule-probe-evidence.mjs` and preserve it as a
  regression test.
- RLS deployment order should be by caller surface and blast radius: lowest
  frontend caller count first, service-role-only backend entities before
  high-traffic UI entities, then exploitable gaps before defense-in-depth-only
  changes.
- Derived ownership cannot rely on cross-entity joins inside policy rules. Pick
  one pattern per entity: denormalized owner field, defense-in-depth
  `secureOperation`, or function gateway.
- For empty-list or "saved but not visible" symptoms, run a persistence bisect
  before frontend rendering work: direct SDK/API readback returning zero records
  is a write/RLS/schema problem; non-zero records are a scope/cache/query problem.

## AI Assistant Tooling

- Base44 documents three project skills: `base44-cli`, `base44-sdk`, and `base44-troubleshooter`.
- Base44 also exposes an account MCP server for app/project operations and a docs MCP server for live documentation search.
- Base44 projects created with the CLI automatically include project-level Base44 skills.
- The official Base44 skills repository is `base44/skills`; as researched on 2026-05-06 its repo contains the three public skills plus internal meta-skills (`skill-creator`, `review-skills`, `sync-cli-skill`, `sync-sdk-skill`), plugin packaging for Claude and Cursor, and automated GitHub workflows for skill sync and review.
- Base44 docs say skills should be kept in sync with the CLI; npm `base44` latest was `0.0.50` and the installed `base44-cli` skill frontmatter also declared `sourcePackage.version: 0.0.50`.
- The public installed pack exposes three skills, while the source repo also contains internal sync/review helper skills and plugin metadata used to publish across agent ecosystems.

## Agent Skills Design Patterns (from base44/skills)

- **State-dependent routing** — The CLI and SDK skills use `base44/config.jsonc` existence as a state gate. If missing → CLI skill handles initialization; if present → SDK skill handles implementation.
- **Mandatory auth checkpoint** — The CLI skill requires `npx base44 whoami` at session start and blocks all CLI operations if not authenticated.
- **API hallucination prevention** — The SDK skill contains explicit WRONG vs CORRECT tables for auth, functions, integrations, and entities to prevent agents from assuming Firebase/Supabase-style API naming.
- **Progressive disclosure** — All skills keep SKILL.md under ~500 lines and offload detailed reference material into `references/*.md` files loaded on demand.
- **Git-based sync** — `sync-cli-skill` and `sync-sdk-skill` use `git diff --name-only <stored-version> HEAD` to detect source changes and update skill documentation incrementally, with breaking-change detection for option/positional conversions.
- **Cross-agent packaging** — Skills ship as both Claude plugins (`.claude-plugin/`) and Cursor plugins (`.cursor-plugin/`), validated by `validate-template.mjs` which enforces safe relative paths and required frontmatter.
- **Skill-creator doctrine** — "The context window is a public good." Skills should only add context Claude doesn't already have. Keep metadata (~100 words) always loaded, body (<5k words) on trigger, resources on demand.

## Implications For Mixed Repos

- A repo can be UI-origin on Base44 and still accumulate code-managed backend artifacts over time.
- In that situation, the strategic question is usually not "migrate to Base44 or not" because Base44 is already the backend system of record.
- The real decision is whether to keep the current app-editor-oriented workflow or standardize toward the official backend-service CLI workflow after validation.
- Running two equal backends for core logic adds drift, auth ambiguity, and deployment/test complexity without resolving workflow confusion.
- If a cloned/ejected non-prod app cannot match production capacity, a "full duplicate backend" may be operationally misleading rather than helpful; in that case, local frontend plus hosted backend can still be useful, but the duplicate backend should not be treated as authoritative dev parity.

## Non-Developer App Builder Capabilities

Base44 is primarily an AI-powered no-code/low-code app builder. The non-developer documentation covers the app-editor path for users who build apps through the Base44 UI rather than code-first backend projects.

### Getting Started

- Base44 supports building apps via natural-language prompts ("vibe coding") with no coding skills required.
- App templates marketplace provides ready-made starting points from community creators.
- Prompt guide and prompt library help users write effective descriptions to generate apps.
- Migration supports importing from Figma, Salesforce, HubSpot, Shopify, WordPress, Lovable, and Bolt.
- Partner marketplace connects users with Base44-certified experts, freelancers, and agencies.

### Building Apps

- AI Chat modes: Build mode (create/edit), Ask mode (questions), Autopilot mode (self-directed changes).
- AI agents for apps: configurable agents with up to 10 skills per agent that turn chats into actions.
- Automations: scheduled/recurring tasks with minimum 5-minute intervals, up to 50 steps per visual edit session.
- Design: visual editor with undo/redo, page management, media uploads, and npm package support.
- Mobile: responsive design, PWA support, app store submission workflows for iOS and Android.
- Data management: NoSQL entities, test databases separate from production, data import/export.

### App Setup & Configuration

- Access control: public, password-protected, or invite-only apps.
- Auth: email/password, social login, SSO (SAML 2.0, OIDC).
- Custom domains with automatic HTTPS.
- Payments: native Wix Payments integration, Tranzila support for Israel.

### Performance, SEO & Growth

- Built-in SEO tools: meta tags, sitemap, structured data, social sharing previews.
- GEO (Generative Engine Optimization) checks for AI search visibility.
- App analytics dashboard for tracking usage and performance.
- Social content generation for app promotion.

### Account, Billing & Workspaces

- Plans: Free, Pro, Business, Enterprise tiers with varying app limits, AI credits, and feature access.
- Credits system: AI usage measured in credits; monthly allotment per plan.
- Workspace model: multi-member workspaces with role-based access, template sharing, and app management.
- Previous workspace model used a credits-per-app system; current model uses plan-based AI credits.

### Integrations & Connectors

- Built-in integrations: AI (image generation, text), email (Resend), maps (Google Places), voice (ElevenLabs), tables (Airtable), chat (Slack), automation (Zapier).
- Connectors: OAuth-backed third-party access for GitHub, Gmail, Google Search Console, LinkedIn, Slack, and more.
- Shared connectors: workspace-level reusable OAuth connections.
- User connectors: per-user OAuth tokens for personalized integrations.
- Custom integrations: OpenAPI-based workspace-level API proxies.

### Enterprise

- Enterprise SSO with SAML 2.0 and OIDC.
- Workspace domain enforcement.
- Workspace secrets for secure credential storage.
- IP allowlists for workspace access control.
- Enterprise-grade app visibility controls.

### Community & Support

- Community hub, referral program with rewards.
- Support via chat and email.
- Privacy and security documentation, GDPR-compliant data deletion.
- Transparent AI service provider disclosure.
