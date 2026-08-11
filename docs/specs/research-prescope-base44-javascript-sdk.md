# Pre-Scope: base44-javascript-sdk

**Source:** https://github.com/base44/javascript-sdk
**Invoked by:** standalone
**Date:** 2026-05-06

## Volume Estimate

- Total files (substantive, excluding images/licenses/generated): 38
- Approx total tokens / lines: ~8,500 lines / ~60K tokens
- Top-level areas/sections:
  1. Client factory and configuration (client.ts, client.types.ts)
  2. Module implementations (entities, auth, integrations, functions, agents, connectors, analytics, app-logs, sso, users)
  3. Type definitions (one .types.ts per module)
  4. Utilities (axios-client, auth-utils, socket-utils, sharedInstance, common)
  5. Tests (unit + e2e, 17 test files)
  6. Examples (2 files)

## File Checklist (manifest)

Every substantive file that MUST be read in the single pass:

- [ ] src/index.ts
- [ ] src/client.ts
- [ ] src/client.types.ts
- [ ] src/types.ts
- [ ] src/modules/entities.ts
- [ ] src/modules/entities.types.ts
- [ ] src/modules/auth.ts
- [ ] src/modules/auth.types.ts
- [ ] src/modules/integrations.ts
- [ ] src/modules/integrations.types.ts
- [ ] src/modules/functions.ts
- [ ] src/modules/functions.types.ts
- [ ] src/modules/agents.ts
- [ ] src/modules/agents.types.ts
- [ ] src/modules/connectors.ts
- [ ] src/modules/connectors.types.ts
- [ ] src/modules/analytics.ts
- [ ] src/modules/analytics.types.ts
- [ ] src/modules/app-logs.ts
- [ ] src/modules/app-logs.types.ts
- [ ] src/modules/sso.ts
- [ ] src/modules/sso.types.ts
- [ ] src/modules/users.ts
- [ ] src/modules/custom-integrations.ts
- [ ] src/modules/custom-integrations.types.ts
- [ ] src/utils/axios-client.ts
- [ ] src/utils/axios-client.types.ts
- [ ] src/utils/auth-utils.ts
- [ ] src/utils/auth-utils.types.ts
- [ ] src/utils/socket-utils.ts
- [ ] src/utils/sharedInstance.ts
- [ ] src/utils/common.ts
- [ ] tests/unit/*.test.ts
- [ ] tests/e2e/*.test.js
- [ ] examples/basic-usage.js
- [ ] examples/typescript-usage.ts
- [ ] README.md
- [ ] package.json

## Extraction Plan

- Pass strategy: single-pass across all checklist files (executed inline by Kimi in-session)
- Target detail files:
  - `references/knowledge/domains/base44/details/sdk-client-architecture.md`
  - `references/knowledge/domains/base44/details/sdk-modules-reference.md`
  - `references/knowledge/domains/base44/details/sdk-type-system.md`
  - `references/knowledge/domains/base44/details/sdk-authentication-patterns.md`
  - `references/knowledge/domains/base44/details/sdk-realtime-and-websockets.md`
  - `references/knowledge/domains/base44/details/sdk-error-handling.md`
  - `references/knowledge/domains/base44/details/sdk-testing-and-examples.md`
- Domain classification: base44 (justification: The Base44 JavaScript SDK is the canonical client library for the Base44 platform; it belongs in the existing base44 domain alongside backend-service and CLI knowledge.)

## Sub-Agent Selection

- Primary: gemini-cli (default)
- Fallback: Claude (in-session)
- Selected for this run: fallback (Claude in-session) — gemini-cli is unavailable in this Kimi CLI environment; source was cloned locally and read directly by the in-session agent.

## Expected Output Artifacts

- `references/knowledge/domains/base44/CAPABILITIES.md` (Layer 2 — updated)
- `references/knowledge/domains/base44/details/*.md` (Layer 3, 7 detail files)
- `references/knowledge/domains/base44/.version` (updated to 2026-05-06)
- `references/knowledge/domains/base44/.sources.jsonl` (provenance)
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended
