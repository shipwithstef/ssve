# Base44 SDK — Modules Reference

**Domain:** base44
**Area:** All SDK modules, methods, and availability by auth mode
**Source:** https://github.com/base44/javascript-sdk (v0.8.27)
**Last updated:** 2026-05-06

---

## Mechanism

### Module Availability Matrix

| Module | Anonymous | User Auth | Service Role | Notes |
|--------|-----------|-----------|--------------|-------|
| `entities` | ✓ (public only) | ✓ | ✓ | CRUD + realtime |
| `integrations` | ✓ | ✓ | ✓ | Core + custom packages |
| `functions` | ✓ | ✓ | ✓ | `invoke()` + `fetch()` |
| `auth` | — | ✓ | — | login, logout, me, register, OTP, password reset |
| `connectors` | — | ✓ (user-scoped) | ✓ (app-scoped) | OAuth token retrieval |
| `agents` | — | ✓ | ✓ | Conversations + messaging |
| `appLogs` | — | ✓ | ✓ | Usage tracking |
| `analytics` | — | ✓ | — | Custom event tracking |
| `users` | — | ✓ | ✓ | User management |
| `sso` | — | — | ✓ | SSO token generation |

### Entities Module (`entities.ts` + `entities.types.ts`)

Dynamic CRUD via Proxy. Methods on each entity handler:

- `list(sort?, limit?, skip?, fields?)` — GET `/apps/{appId}/entities/{name}`
- `filter(query, sort?, limit?, skip?, fields?)` — GET with `q={JSON}`
- `get(id)` — GET by ID
- `create(data)` — POST
- `update(id, data)` — PUT
- `delete(id)` — DELETE
- `deleteMany(query)` — DELETE with body
- `bulkCreate(data[])` — POST `/bulk`
- `updateMany(query, data)` — PATCH `/update-many` (MongoDB update operators)
- `bulkUpdate(data[])` — PUT `/bulk` (up to 500 records)
- `importEntities(file)` — POST `/import` (multipart, browser only)
- `subscribe(callback)` — WebSocket room `entities:{appId}:{name}`

Filter operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$regex` (strings), `$all`, `$size` (arrays), `$and`, `$or`, `$nor`, `$not`.

Update operators in `updateMany`: `$set`, `$rename`, `$unset`, `$inc`, `$mul`, `$min`, `$max`, `$currentDate`, `$addToSet`, `$push`, `$pull`.

Limit defaults to 50, max is 5,000.

### Auth Module (`auth.ts` + `auth.types.ts`)

- `me()` — GET `/apps/{appId}/entities/User/me`
- `updateMe(data)` — PUT `/apps/{appId}/entities/User/me`
- `redirectToLogin(nextUrl)` — browser redirect to app's login page
- `loginWithProvider(provider, fromUrl)` — OAuth redirect (google, sso, or custom). Uses popup when inside iframe.
- `logout(redirectUrl?)` — clears token from axios + localStorage + redirects to server logout
- `setToken(token, saveToStorage?)` — sets Bearer token on both axios clients
- `loginViaEmailPassword(email, password, turnstileToken?)` — POST `/apps/{appId}/auth/login`
- `isAuthenticated()` — calls `me()` and catches
- `inviteUser(email, role)` — POST `/apps/{appId}/users/invite-user`
- `register({email, password, turnstile_token?, referral_code?})` — POST `/apps/{appId}/auth/register`
- `verifyOtp({email, otpCode})` — POST `/apps/{appId}/auth/verify-otp`
- `resendOtp(email)` — POST `/apps/{appId}/auth/resend-otp`
- `resetPasswordRequest(email)` — POST `/apps/{appId}/auth/reset-password-request`
- `resetPassword({resetToken, newPassword})` — POST `/apps/{appId}/auth/reset-password`
- `changePassword({userId, currentPassword, newPassword})` — POST `/apps/{appId}/auth/change-password`

### Functions Module (`functions.ts` + `functions.types.ts`)

- `invoke(functionName, data?)` — POST `/apps/{appId}/functions/{functionName}`. Auto-detects `File` objects and sends as `multipart/form-data`.
- `fetch(path, init?)` — Native `fetch()` to `/functions/{path}` with auto-injected auth headers. Returns raw `Response` for streaming/binary access.

### Integrations Module (`integrations.ts` + `integrations.types.ts`)

Dynamic two-level Proxy:
- `base44.integrations.Core.InvokeLLM(params)` — built-in AI/text/image/email/file functions
- `base44.integrations.custom.call(slug, operationId, params?)` — workspace custom integrations
- Future packages accessible dynamically via `base44.integrations.PackageName.EndpointName(data)`

Core integrations:
- `InvokeLLM({prompt, model?, add_context_from_internet?, response_json_schema?, file_urls?})`
- `GenerateImage({prompt})` → `{url}`
- `UploadFile({file})` → `{file_url}`
- `SendEmail({to, subject, body, from_name?})`
- `ExtractDataFromUploadedFile({file_url, json_schema})`
- `UploadPrivateFile({file})` → `{file_uri}`
- `CreateFileSignedUrl({file_uri, expires_in?})` → `{signed_url}`

### Agents Module (`agents.ts` + `agents.types.ts`)

- `getConversations()` — all conversations
- `getConversation(id)` — single conversation by ID
- `listConversations(filterParams)` — filtered list
- `createConversation({agent_name, metadata?})`
- `addMessage(conversation, message)` — POST v2 messages endpoint
- `subscribeToConversation(conversationId, onUpdate?)` — WebSocket with local message-cache merge
- `getWhatsAppConnectURL(agentName)`
- `getTelegramConnectURL(agentName)`

Note: realtime subscription truncates tool calls (`arguments_string` ≤ 500 chars, `results` ≤ 50 chars). Full data available via `getConversation()`.

### Connectors Module (`connectors.ts` + `connectors.types.ts`)

**Service-role only** (app-scoped OAuth):
- `getAccessToken(integrationType)` — deprecated, returns token string
- `getConnection(integrationType)` — returns `{accessToken, connectionConfig}`
- `getCurrentAppUserAccessToken(connectorId)` — deprecated
- `getCurrentAppUserConnection(connectorId)` — returns `{accessToken, connectionConfig}`

**User-scoped** (`base44.connectors`):
- `connectAppUser(connectorId)` → redirect URL for OAuth
- `disconnectAppUser(connectorId)`

Supported integration types: airtable, bamboohr, box, calendly, clickup, contentful, discord, dropbox, github, gitlab, gmail, google_analytics, googlebigquery, googlecalendar, google_classroom, googledocs, googledrive, googlemeet, google_search_console, googlesheets, googleslides, googletasks, hubspot, hugging_face, instagram, linear, linkedin, microsoft_teams, one_drive, notion, outlook, salesforce, share_point, slack, slackbot, splitwise, supabase, tiktok, typeform, wix, wrike.

### Analytics Module (`analytics.ts` + `analytics.types.ts`)

User-auth only. Background batch event tracking:
- `track({eventName, properties?})` — queues event, flushes in batches of 30 every 1s
- Auto-tracks: initialization event (referrer), heartbeat every 60s, session duration on `visibilitychange`
- Uses `navigator.sendBeacon` on page hide as fallback
- Configurable via URL param `?analytics-enable=true|false`
- Session ID persisted in `localStorage`

### App Logs Module (`app-logs.ts` + `app-logs.types.ts`)

- `logUserInApp(pageName)` — POST `/app-logs/{appId}/log-user-in-app/{pageName}`
- `fetchLogs(params?)` — GET `/app-logs/{appId}`
- `getStats(params?)` — GET `/app-logs/{appId}/stats`

### Users Module (`users.ts`)

- `getUser(userId)` — GET `/apps/{appId}/entities/User/{userId}`

### SSO Module (`sso.ts` + `sso.types.ts`)

Service-role only:
- `getAccessToken()` — GET `/apps/{appId}/auth/sso/token` → `{access_token}`

---

## Analysis

### Consistency Patterns

Every module follows the same pattern:
1. Factory function `createXModule(axios, appId, config?)`
2. Separate `.types.ts` file with extensive TSDoc
3. Type registries (`EntityTypeRegistry`, `FunctionNameRegistry`, `AgentNameRegistry`, `ConnectorIntegrationTypeRegistry`) that CLI `types generate` populates
4. Auto-detection of `File` inputs → `multipart/form-data`

### Auth Mode Gaps

Some modules are asymmetric:
- `auth` has no service-role equivalent (admin user management is through `entities.User` with service role)
- `analytics` is user-only because it tracks individual user behavior
- `sso` is service-only because it generates tokens for external identity providers

### Realtime Is Module-Local

Each module that uses realtime constructs its own room name. There is no centralized subscription manager. This means:
- Multiple entity subscriptions each join their own room
- The same socket connection handles all rooms
- Unsubscribe functions are per-room, per-callback

---

## L4 Pointers

- `src/modules/entities.ts` — Proxy + CRUD implementation
- `src/modules/integrations.ts` — Two-level Proxy for packages/endpoints
- `src/modules/functions.ts` — `invoke()` and `fetch()`
- `src/modules/agents.ts` — Conversation + WebSocket message cache
- `src/modules/connectors.ts` — App-scoped and user-scoped connector factories
- `src/modules/analytics.ts` — Background batching + heartbeat
- `src/index.ts` — Full public API surface export list
