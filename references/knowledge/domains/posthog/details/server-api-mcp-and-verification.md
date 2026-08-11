# PostHog Server API, MCP, And Verification - Detail

## Mechanism (factual)

The current official capture endpoints are `/i/v0/e/` for a single event and `/batch/` for batches. They are POST-only public endpoints that use the project token and do not return sensitive project data. Requests must target the right region: US Cloud, EU Cloud, or self-hosted. Batch request bodies must stay below the documented body size limit.

The general PostHog API requires a personal API key for authenticated administrative or query operations. Project tokens are for ingestion and browser/server SDK configuration, not project administration.

Reverse proxy docs cover routing ingestion through an application-controlled domain to reduce ad-blocker loss and align with CSP. CSP docs identify ingestion domains and script/connect requirements. A reverse proxy can improve data capture but changes infrastructure ownership and must be disclosed if it changes endpoint surfaces.

The PostHog MCP server exposes function-calling tools across analytics, feature flags, experiments, error tracking, logs, surveys, SQL/HogQL, and related products. Official Codex setup supports `npx @posthog/wizard mcp add`, Codex plugin installation, or `codex mcp add posthog --url https://mcp.posthog.com/mcp`. The current local `claude mcp list` evidence shows `posthog: https://mcp-eu.posthog.com/mcp (HTTP) - connected`, while Codex/Gemini in this session do not expose callable PostHog MCP tools.

CovibeFusion's test design uses a two-phase pattern: browser automation produces console/storage/distinct-ID artifacts, then Claude Code uses PostHog MCP tools to verify backend events, identity, feature flags, and deletion. That is the strongest model for Example Marketplace once a real PostHog EU project and live key exist.

## Analysis (expert commentary)

- **Useful for:** Separating "browser emitted a request" from "PostHog ingested the event and identity looks correct."
- **Trade-offs:** MCP/live verification needs authenticated account access, but without it analytics tests can only prove local/network behavior.
- **Similar to:** Stripe checkout smoke where local redirect success is weaker than querying the exact session/payment object.
- **Could improve svc by:** Encoding a standard analytics verification ladder: no-consent silence, consent network request, ingestion query, identity query, deletion query.
- **Assumptions:** PostHog account access will be under the company account and region-matched to EU.
- **Watch out for:** MCP tool availability is host-specific. Claude may have a connected MCP while Codex does not, so plans must name which host owns live verification.

## Key Source Files (L4 pointers)

- `https://posthog.com/docs/api.md` - authenticated API overview.
- `https://posthog.com/docs/api/capture.md` - single and batch event ingestion.
- `https://posthog.com/docs/advanced/proxy.md` - proxy setup overview.
- `https://posthog.com/docs/advanced/content-security-policy.md` - CSP and ingestion domains.
- `https://posthog.com/docs/model-context-protocol.md` - MCP overview.
- `https://posthog.com/docs/model-context-protocol/tools.md` - MCP tool categories.
- `https://posthog.com/docs/model-context-protocol/codex.md` - Codex MCP/plugin setup.
- `/home/svc-user/app-workspaces/covibefusion/tests/posthog/helpers/posthog_mcp_verifier.py` - local two-phase MCP verification pattern.
