# Base44 SDK Docs — Getting Started Guides

**Domain:** base44
**Area:** SDK documentation getting-started guides
**Source:** https://docs.base44.com/developers/references/sdk (16 SDK reference URLs)
**Last updated:** 2026-05-06

---

## Mechanism

### Documentation Index (`llms.txt`)

Every SDK docs page references a complete documentation index:
```
https://docs.base44.com/llms.txt
```
This is a machine-readable index of all available pages, intended for LLM context discovery.

### SDK Overview

The SDK provides a JavaScript interface for building apps on Base44. Two usage modes:
1. **Inside Base44 apps** — client is pre-configured, imported from `@/api/base44Client`
2. **External apps** — install `@base44/sdk` via npm and create client with `createClient({appId})`

### Base44 Client Guide

Docs emphasize three contexts:
- **Frontend client** — `import { base44 } from "@/api/base44Client"`
- **Backend functions** — `import { createClientFromRequest } from "npm:@base44/sdk"` (Deno)
- **External apps** — `import { createClient } from "@base44/sdk"`

Social login providers supported: Google (default), Microsoft, Facebook, Apple, SSO.
Service role is **only** available in Base44-hosted backend functions. External backends cannot use service role.

### Work With Data Guide

Docs add narrative explanations:
- Anonymous users: only public entities
- Authenticated users: entities they have permission to view/modify
- Service role: all entities available to admin

`importEntities()` requires a browser environment and cannot be used in backend code.
Built-in `User` entity: regular users can only read/update their own record; service role can read/update/delete any user. Cannot create users via entities module — use auth module instead.

### Common SDK Uses Guide

Error handling pattern documented:
```typescript
import { Base44Error } from "@base44/sdk";
try {
  const result = await base44.entities.Task.list();
} catch (error) {
  if (error instanceof Base44Error) {
    console.error(`Status: ${error.status}`);
    console.error(`Message: ${error.message}`);
    console.error(`Code: ${error.code}`);
  }
}
```

### Dynamic Types Guide

Types are generated into `base44/.types/types.d.ts` via:
```bash
base44 types generate
```

Re-run whenever entities, functions, agents, or connectors change.

**Limitation noted in docs:** Function parameter types are NOT generated. Refer to function implementation for expected parameters.

### Connect to Third-Party APIs Guide

Three approaches with trade-offs:
1. **Connectors** — OAuth login per integration type; one connection per app; app builder's account is used; you make API calls yourself with the token.
2. **Custom integrations** — Workspace-wide OpenAPI specs; shared credentials; proxied through Base44 backend (secrets never reach browser); admin rotates credentials without touching app code.
3. **Backend functions** — Full control; API keys stored as env vars; custom logic/transformations; frontend calls backend function which calls external API.

---

## Analysis

### Docs vs Source Alignment

The docs are TypeDoc-generated from the source, so they are highly consistent. Differences found:
- **InvokeLLM example** in docs uses `responseFormat: "text"` — this parameter does NOT appear in the source `InvokeLLMParams` interface. The source uses `response_json_schema` for structured output and returns string by default. This may be a docs inaccuracy or a deprecated parameter.
- **User schema** docs mention `[key: string] any` for custom fields on the `User` type — confirmed in source via `EntityRecord` pattern.

### Docs Add Value In Three Areas

1. **Narrative context** — getting-started guides explain WHY to use each feature, not just HOW.
2. **Decision trees** — the third-party APIs guide explicitly compares connectors vs custom integrations vs backend functions.
3. **Limitation callouts** — docs flag browser-only methods, service-role-only modules, and type-generation gaps.

### `llms.txt` Is Strategically Interesting

Base44 maintains `docs.base44.com/llms.txt` as a structured index for AI consumption. This signals they expect AI agents (not just human developers) to navigate their docs.

---

## L4 Pointers

- `https://docs.base44.com/developers/references/sdk/getting-started/overview`
- `https://docs.base44.com/developers/references/sdk/getting-started/client`
- `https://docs.base44.com/developers/references/sdk/getting-started/work-with-data`
- `https://docs.base44.com/developers/references/sdk/getting-started/work-with-sdk`
- `https://docs.base44.com/developers/references/sdk/getting-started/dynamic-types`
- `https://docs.base44.com/developers/references/sdk/getting-started/third-party-apis`
- `https://docs.base44.com/llms.txt` — docs index
