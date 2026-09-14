# Domain: Resend

## Area: Emails & Batch Sending
- Send single emails with React, HTML, or plain text.
- Template support (`template.id` with `variables`).
- Batch send up to 50 emails in a single request.
- Attachments, tags, scheduled delivery (`scheduledAt`), and Idempotency keys.

## Area: Contacts & Audiences
- Manage audiences (now called segments).
- Create, list, retrieve, update, and remove contacts.
- Assign contacts to specific topics and segments.
- Manage Contact Properties for custom data.

## Area: Infrastructure & Routing
- Domains: create, list, verify, update, and remove domains.
- Webhooks: create and manage webhooks to listen for email events (delivered, bounced, etc.).
- Api Keys: programmatic creation and revocation of scoped keys.
- Events & Logs: fetch granular delivery logs.

## Area: Automations & Broadcasts
- Broadcasts: send bulk emails to an entire segment or audience.
- Automations & Automation Runs: trigger and manage multi-step marketing automation sequences.

## Framework / Integrations
- Official Node.js SDK (`resend-node`) written in TypeScript.
- Deep integration with React (e.g., via `@react-email/components`).
- Supports an MCP server (`resend-mcp`) and Agent Skills (`resend-skills`) for AI autonomous orchestration.
- **TipTap MCP Visual Sync:** The MCP server natively connects to the Resend Dashboard Editor using multi-player presence (Agent Avatar) to compose/edit valid TipTap JSON directly in the UI.