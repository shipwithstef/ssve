# Base44 SDK Docs — Function Reference

**Domain:** base44
**Area:** SDK documentation for createClient and createClientFromRequest
**Source:** https://docs.base44.com/developers/references/sdk/docs/functions/createClient, createClientFromRequest
**Last updated:** 2026-05-06

---

## Mechanism

### `createClient(config)`

Docs confirm the same signature as source. Parameters documented:
- `serverUrl` — defaults to `https://base44.app`; override for local dev server
- `appId` — required; "the string between `/apps/` and `/editor/`" in the editor URL
- `token` — user JWT; managed automatically inside Base44 apps
- `options.onError` — optional global error handler

Returns `Base44Client` with properties:
- `agents`, `analytics`, `appLogs`, `auth`, `entities`, `functions`, `integrations`
- `cleanup()` — disconnect WebSocket
- `asServiceRole` — elevated permissions object (throws if no serviceToken)

### `createClientFromRequest(request)`

Docs confirm backend-function-only usage. Extracts auth headers injected by Base44 when forwarding requests. Automatically provides service role access.

Example pattern:
```typescript
import { createClientFromRequest } from "npm:@base44/sdk";
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  const userTasks = await base44.entities.Task.filter({
    assignedTo: user.id,
    status: "pending",
  });
  return Response.json({ user: user.name, pendingTasks: userTasks.length });
});
```

---

## Analysis

### No Surprises

The function docs are almost verbatim from the source TSDoc. The only additive value is the URL pattern explanation for finding `appId` (`/apps/<appId>/editor/...`).

### Deno Import Path

Docs consistently use `npm:@base44/sdk` for Deno backend functions. This is the Deno-native npm specifier, confirmed in source examples.

---

## L4 Pointers

- `https://docs.base44.com/developers/references/sdk/docs/functions/createClient`
- `https://docs.base44.com/developers/references/sdk/docs/functions/createClientFromRequest`
- `src/client.ts` — source implementation
