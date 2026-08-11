# Pre-Scope: docs.base44.com-sdk

**Source:** https://docs.base44.com/developers/references/sdk
**Invoked by:** standalone
**Date:** 2026-05-06

## Volume Estimate

- Total URLs (SDK reference subset): 16
- Approx total tokens: ~30-50K
- Top-level areas:
  1. SDK Getting Started (overview, client, work-with-data, work-with-sdk, dynamic-types, third-party-apis)
  2. SDK Function Reference (createClient, createClientFromRequest)
  3. SDK Interface Reference (agents, analytics, app-logs, auth, connectors, functions)
  4. SDK Type Alias Reference (entities, integrations)

## File Checklist (manifest)

Every URL below MUST be fetched, read in full, and have an extraction entry:

- [ ] https://docs.base44.com/developers/references/sdk/getting-started/overview
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/client
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/work-with-data
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/work-with-sdk
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/dynamic-types
- [ ] https://docs.base44.com/developers/references/sdk/getting-started/third-party-apis
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

## Extraction Plan

- Pass strategy: single-pass across all 16 URLs via gemini-cli
- Target detail files:
  - `references/knowledge/domains/base44/details/sdk-docs-getting-started.md`
  - `references/knowledge/domains/base44/details/sdk-docs-functions.md`
  - `references/knowledge/domains/base44/details/sdk-docs-interfaces.md`
  - `references/knowledge/domains/base44/details/sdk-docs-type-aliases.md`
- Domain classification: base44 (justification: SDK docs are the canonical reference for the Base44 JavaScript SDK; belongs in the existing base44 domain alongside source-code knowledge)

## Sub-Agent Selection

- Primary: gemini-cli (available, v0.41.0-preview.1)
- Fallback: Claude (in-session)
- Selected for this run: primary (gemini-cli) — 16 URLs is well within gemini's context window; cheap tokens.

## Expected Output Artifacts

- `references/knowledge/domains/base44/CAPABILITIES.md` (Layer 2 — append docs findings)
- `references/knowledge/domains/base44/details/sdk-docs-*.md` (Layer 3, 4 detail files)
- `references/knowledge/domains/base44/.version` (updated)
- `references/knowledge/domains/base44/.sources.jsonl` (append docs URLs)
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended
