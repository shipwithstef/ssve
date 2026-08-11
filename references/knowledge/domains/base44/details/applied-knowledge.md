# Base44 Applied Knowledge

**Distillation date:** 2026-05-06
**Source:** docs.base44.com non-developer sections (90 pages)
**Project context:** Base44 is a no-code/low-code AI app builder used by Example Marketplace and other projects. Understanding its full non-developer surface is essential for advising builders on app creation, billing, workspaces, and integrations.

## 1. Distilled Positions per Theme

**Theme: AI-first app building**
- "Base44 is an AI-powered website and app builder" — users describe ideas in natural language and the platform generates apps, databases, auth, and hosting automatically.
- "You do not need any coding or tech skills" — the core value proposition is vibe coding via prompts.
- Three AI chat modes exist: Build (create/edit), Ask (questions), Autopilot (self-directed changes).

**Theme: Template & partner ecosystem**
- "Browse a wide range of ready-made templates created by talented creators in the community" — marketplace model for app starters.
- "Base44 Partners makes it simple to find trustworthy experts, freelancers, and agencies" — services marketplace complementary to self-serve.

**Theme: Workspace-centric billing**
- Current model uses plan-based AI credits (Free, Pro, Business, Enterprise) rather than per-app credits.
- Previous workspace model used credits-per-app; this was replaced with the new plans-and-workspaces model.
- Credits are consumed by AI features; plans vary in app limits, member seats, and credit allotments.

**Theme: Integration breadth**
- Built-in integrations cover AI, email (Resend), maps (Google Places), voice (ElevenLabs), tables (Airtable), chat (Slack), automation (Zapier).
- Connectors provide OAuth-backed access to GitHub, Gmail, Google Search Console, LinkedIn, Slack.
- Custom integrations proxy OpenAPI specs through Base44, keeping secrets off the frontend.
- For E2E auth-account OTP capture, prefer an installed mailbox connector
  over project-owned OAuth refresh-token scripts when the test domain forwards
  to that mailbox.

**Theme: Enterprise readiness**
- SAML 2.0 and OIDC SSO support.
- Workspace domain enforcement, IP allowlists, workspace secrets.
- Enterprise app visibility controls separate internal vs external apps.

## 2. Cross-Domain Implications (Example Marketplace Context)

- Example Marketplace runs on Base44 backend service (code-first) but also uses the app editor for certain flows. The non-developer docs clarify what the app-editor path can do without backend code.
- Billing: understanding credit consumption and plan limits helps forecast operational costs.
- Integrations: the connectors catalog shows which third-party services are available out-of-the-box versus requiring custom backend functions.
- Migration: Base44 supports migrating from Salesforce, HubSpot, Shopify, WordPress, Lovable, and Bolt — relevant if Example Marketplace ever needs to import external data.
- E2E account provisioning: SDK registration does not prove password-login
  readiness when email OTP verification is required. If a connected Gmail inbox
  receives catch-all test-domain OTPs, the connector-first path is lower-risk
  than adding local OAuth token scripts to the app repo.

## 3. Contradictions / Open Questions

- The docs mention both "no coding required" and extensive developer tools (code editing, npm packages, app store submission). The boundary between no-code and code-first is fluid.
- Pricing specifics (exact credit costs, overage behavior) are not deeply documented in the non-developer sections.
- The changelog is extensive but does not version the docs themselves — some pages may describe legacy behavior.

## 4. Recency-Weighted Insights

- 2026-05-06 extraction: docs are current as of this date.
- New infrastructure upgrade is documented as a recent migration path for older apps.
- Workspace model changed from credits-per-app to plan-based credits — this is a significant billing evolution.

## 5. Source Map

| Claim | Source File | Section |
|---|---|---|
| AI-powered app builder | details/getting-started.md | Mechanism / Quick Start |
| Three chat modes | details/building-app.md | Mechanism / AI & Chat |
| Plan-based credits | details/account-billing.md | Mechanism / Workspace Models |
| SAML 2.0 + OIDC SSO | details/enterprise.md | Mechanism / Enterprise Features |
| 10 skills per agent | details/building-app.md | Analysis / Limits |
| 5-min automation interval | details/building-app.md | Analysis / Limits |

## 6. What This Distillation Does NOT Capture

- Exact API schemas for integrations (covered in developer docs).
- Backend function internals, entity schemas, SDK types (covered in existing developer detail files).
- Real-time pricing and credit burn rates — these require account access or sales inquiry.
- UI/UX design specifics beyond what is documented (e.g., exact component library).
