# Base44 SDK — Client Architecture

**Domain:** base44
**Area:** SDK client factory, module composition, and HTTP transport
**Source:** https://github.com/base44/javascript-sdk (v0.8.27)
**Last updated:** 2026-05-06

---

## Mechanism

### Factory Functions

The SDK exposes two factory functions:

1. **`createClient(config: CreateClientConfig): Base44Client`** — General-purpose client for frontend and external backends.
2. **`createClientFromRequest(request: Request): Base44Client`** — Backend-function-only factory that extracts auth headers injected by Base44 when forwarding requests.

`createClient` accepts:
- `appId` (required) — the app identifier from the editor URL
- `serverUrl` (default: `https://base44.app`)
- `token` — user JWT for user-scoped requests
- `serviceToken` — service-role JWT for admin-scoped requests
- `requiresAuth` — if true, auto-redirects to login when unauthenticated (browser only)
- `functionsVersion` — version string for functions API
- `headers` — additional headers merged into every request
- `options.onError` — global error callback

### Dual Axios Instance Design

The client creates **four** axios instances internally:

| Instance | Base URL | Headers | Purpose |
|----------|----------|---------|---------|
| `axiosClient` | `/api` | `X-App-Id`, `Authorization` (token) | General API calls |
| `functionsAxiosClient` | `/api` | above + `Base44-Functions-Version` | Backend function invocation |
| `serviceRoleAxiosClient` | `/api` | `X-App-Id`, `on-behalf-of` (token), `Authorization` (serviceToken) | Admin-level data access |
| `serviceRoleFunctionsAxiosClient` | `/api` | functions headers + serviceToken | Admin-level function calls |

The `functionsAxiosClient` sets `interceptResponses: false` so that raw responses can be handled by the caller when needed (e.g. streaming).

### Module Composition Pattern

Each SDK module is created by a factory function that receives the appropriate axios instance(s) and configuration:

```typescript
// client.ts (simplified)
const userModules = {
  entities: createEntitiesModule({ axios: axiosClient, appId, getSocket }),
  integrations: createIntegrationsModule(axiosClient, appId),
  auth: createAuthModule(axiosClient, functionsAxiosClient, appId, options),
  functions: createFunctionsModule(functionsAxiosClient, appId, config),
  agents: createAgentsModule({ axios: axiosClient, getSocket, appId, serverUrl, token }),
  appLogs: createAppLogsModule(axiosClient, appId),
  users: createUsersModule(axiosClient, appId),
  analytics: createAnalyticsModule({ axiosClient, serverUrl, appId, userAuthModule }),
};
```

The `asServiceRole` getter returns a parallel module tree using the service-role axios instances. Accessing `asServiceRole` without providing `serviceToken` throws a runtime error.

### Proxy-Based Dynamic Access

Two modules use JavaScript `Proxy` for dynamic property access:

- **`entities`** — `base44.entities.Task` resolves dynamically to an `EntityHandler` via Proxy. The entity name is interpolated into the API path `/apps/{appId}/entities/{entityName}`.
- **`integrations`** — `base44.integrations.Core.InvokeLLM` resolves dynamically to an integration endpoint function. `packageName` and `endpointName` are interpolated into either `/apps/{appId}/integration-endpoints/Core/{endpointName}` or the installable package path.

This design means new entities and integrations are available immediately without SDK updates.

### Socket.IO Integration

A single lazy-initialized Socket.IO connection (`RoomsSocket`) is shared across modules that need realtime:
- `entities` — subscribes to room `entities:{appId}:{entityName}`
- `agents` — subscribes to room `/agent-conversations/{conversationId}`

Socket config:
- `mountPath: "/ws-user-apps/socket.io/"`
- `transports: ["websocket"]`
- Auth via query param `token`

The socket is recreated (with updated token) when `setToken()` is called.

---

## Analysis

### Why Four Axios Instances?

The separation is intentional:
1. **General vs Functions** — Functions may need a different version header and raw response handling.
2. **User vs Service Role** — Service role uses `on-behalf-of` to impersonate the calling user while elevating permissions, and a separate `Authorization` header for the service token itself.
3. **Response Interception** — The general client unwraps `response.data` automatically; the functions client does not, enabling streaming and binary downloads.

### Browser-First Design with Backend Support

The SDK is clearly designed for browser SPAs first:
- `localStorage` token persistence
- `window.location` redirect helpers
- `document.visibilityState` for analytics heartbeat
- iframe detection and `postMessage` API logging

Backend usage (Deno/Node) requires creating the client manually with explicit tokens or using `createClientFromRequest()` inside Base44-hosted functions.

### Module Isolation

Each module is self-contained with its own factory, types, and implementation file. This makes the SDK tree-shakeable in principle, though the main `index.ts` re-exports everything unconditionally.

---

## L4 Pointers

- `client.ts` — `createClient()` and `createClientFromRequest()` implementations
- `client.types.ts` — `Base44Client`, `CreateClientConfig`, `CreateClientOptions`
- `utils/axios-client.ts` — `createAxiosClient()`, `Base44Error`
- `utils/socket-utils.ts` — `RoomsSocket` implementation
- `README.md` — quickstart examples for inside-app and external usage
