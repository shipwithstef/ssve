# Base44 SDK Skill Contract

## Source
- **File:** `skills/base44-sdk/SKILL.md` (305 lines)
- **References:** 12 files under `skills/base44-sdk/references/`
- **Quick Reference:** `references/QUICK_REFERENCE.md` (178 lines)

## Skill Trigger Logic

> "This skill activates on ANY mention of 'base44' or when a `base44/` folder exists."

First action MUST be:
1. Check if `base44/config.jsonc` exists
2. If **YES** (existing project): this skill handles implementation
3. If **NO** (new project): transfer to `base44-cli` skill

## Critical: Do Not Hallucinate APIs

The SDK skill contains extensive WRONG vs CORRECT tables to prevent API hallucination:

### Authentication
| ❌ WRONG | ✅ CORRECT |
|---------|-----------|
| `signInWithGoogle()` | `loginWithProvider('google')` |
| `signInWithEmailAndPassword(email, pw)` | `loginViaEmailPassword(email, pw)` |
| `createUser()` / `signUp()` | `register({email, password})` |
| `onAuthStateChanged()` | `me()` (no listener, call when needed) |
| `currentUser` | `await auth.me()` |

### Functions
| ❌ WRONG | ✅ CORRECT |
|---------|-----------|
| `functions.call('name', data)` | `functions.invoke('name', data)` |
| `functions.run('name', data)` | `functions.invoke('name', data)` |

### Integrations
| ❌ WRONG | ✅ CORRECT |
|---------|-----------|
| `ai.generate(prompt)` | `integrations.Core.InvokeLLM({prompt})` |
| `sendEmail(to, subject, body)` | `integrations.Core.SendEmail({to, subject, body})` |
| `uploadFile(file)` | `integrations.Core.UploadFile({file})` |

### Entities
| ❌ WRONG | ✅ CORRECT |
|---------|-----------|
| `entities.Task.find({...})` | `entities.Task.filter({...})` |
| `entities.Task.findOne(id)` | `entities.Task.get(id)` |
| `entities.Task.insert(data)` | `entities.Task.create(data)` |
| `entities.Task.remove(id)` | `entities.Task.delete(id)` |
| `entities.Task.onChange(cb)` | `entities.Task.subscribe(cb)` |

## SDK Modules Matrix

| Module | Purpose | Reference |
|--------|---------|-----------|
| `entities` | CRUD operations on data models | `entities.md` |
| `auth` | Login, register, user management | `auth.md` |
| `agents` | AI conversations and messages | `base44-agents.md` |
| `functions` | Backend function invocation | `functions.md` |
| `integrations` | AI, email, file uploads, custom APIs | `integrations.md` |
| `analytics` | Track custom events | `analytics.md` |
| `appLogs` | Log user activity | `app-logs.md` |
| `users` | Invite users to app | `users.md` |
| `asServiceRole.connectors` | App-scoped OAuth tokens (backend only) | `connectors.md` |
| `asServiceRole.sso` | SSO token generation (backend only) | `sso.md` |

## Client Setup

### External Apps
```javascript
import { createClient } from "@base44/sdk";

// MUST use 'appId' (NOT 'clientId' or 'id')
const base44 = createClient({
  appId: "your-app-id",
  token: "optional-user-token",
  options: {
    onError: (error) => { console.error("Base44 error:", error); }
  }
});
```

Common mistakes:
- ❌ `createClient({ clientId: "..." })` — WRONG parameter name
- ❌ `createClient({ id: "..." })` — WRONG parameter name
- ❌ `createClient({ appId: "...", onError: ... })` — WRONG: onError must be in `options`

### Backend Functions
```javascript
import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  // Client inherits auth from request
});
```

> "`createClientFromRequest()` is designed for Base44-hosted backend functions. It extracts auth from request headers that Base44 injects and returns a client that includes service role access."

## Authentication Modes

| Mode | How | Permissions |
|------|-----|-------------|
| Anonymous | `createClient({ appId })` without token | Public data only |
| User | After `loginViaEmailPassword()` or `createClientFromRequest` | User's own data |
| Service Role | `base44.asServiceRole.*` in backend | Full admin access |

## Auth Module (`base44.auth`)

Key methods:
```
register({email, password, turnstile_token?, referral_code?}) → Promise<any>
loginViaEmailPassword(email, password, turnstileToken?) → Promise<{access_token, user}>
loginWithProvider('google'|'microsoft'|'facebook', fromUrl?) → void
me() → Promise<User | null>
updateMe(data) → Promise<User>
isAuthenticated() → Promise<boolean>
logout(redirectUrl?) → void
verifyOtp({email, otpCode}) → Promise<any>
resendOtp(email) → Promise<any>
resetPasswordRequest(email) → Promise<any>
resetPassword({resetToken, newPassword}) → Promise<any>
changePassword({userId, currentPassword, newPassword}) → Promise<any>
setToken(token, saveToStorage?) → void
inviteUser(userEmail, role) → Promise<any>
```

Registration requires OTP verification before login:
1. `register()`
2. User receives OTP via email
3. `verifyOtp()`
4. Now can `loginViaEmailPassword()`

> "Users cannot log in until they complete OTP verification."

Providers: `google` (enabled by default), `microsoft`, `facebook`. SSO providers on Elite plan: `okta`, `azure-ad`, `github`.

## Entities Module (`base44.entities.EntityName`)

Methods:
```
create(data) → Promise<T>
bulkCreate(dataArray) → Promise<T[]>
list(sort?, limit?, skip?, fields?) → Promise<Pick<T, K>[]>     // max 5,000
filter(query, sort?, limit?, skip?, fields?) → Promise<Pick<T, K>[]>  // max 5,000
get(id) → Promise<T>
update(id, data) → Promise<T>
updateMany(query, mongoUpdateOp) → Promise<UpdateManyResult>
bulkUpdate(dataArray) → Promise<T[]>                          // each item must have id
delete(id) → Promise<DeleteResult>
deleteMany(query) → Promise<DeleteManyResult>
importEntities(file) → Promise<ImportResult<T>>               // frontend only
subscribe(callback) → () => void                              // returns unsubscribe fn
```

Sort: prefix with `-` for descending (e.g., `-created_date`).

User entity special rules:
- Regular users can only read/update their own record
- Cannot create users via `entities.create()` — use `auth.register()`
- Service role has full access

## Functions Module (`base44.functions`)

```
invoke(functionName, data?) → Promise<any>
fetch(path, init?) → Promise<Response>   // low-level, for streaming/custom methods
```

File upload: automatically uses `multipart/form-data` when File objects present.

REST API call:
```bash
curl -X POST "https://<app-domain>/functions/<function-name>" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## Integrations Module (`base44.integrations`)

### Core Integrations
```
InvokeLLM({prompt, add_context_from_internet?, response_json_schema?, file_urls?}) → Promise<string | object>
GenerateImage({prompt}) → Promise<{url}>
SendEmail({to, subject, body, from_name?}) → Promise<any>
UploadFile({file}) → Promise<{file_url}>
UploadPrivateFile({file}) → Promise<{file_uri}>
CreateFileSignedUrl({file_uri, expires_in?}) → Promise<{signed_url}>
ExtractDataFromUploadedFile({file_url, json_schema}) → Promise<object>
```

> "1 credit per email (2 credits with custom domain)"

### Custom Integrations
```
call(slug, operationId, {payload?, pathParams?, queryParams?}?) → Promise<{success, status_code, data}>
```

operationId format: `"method:/path"` (e.g., `"get:/contacts"`, `"post:/users/{id}"`)

Requirements:
- Core integrations: available on all plans
- Catalog/Custom integrations: require Builder plan or higher

## Agents Module (`base44.agents`)

> "This module requires a logged-in user."

```
createConversation({agent_name, metadata?}) → Promise<Conversation>
getConversations() → Promise<Conversation[]>
getConversation(id) → Promise<Conversation>
listConversations({q?, sort?, limit?, skip?, fields?}) → Promise<Conversation[]>
subscribeToConversation(id, onUpdate?) → () => void
addMessage(conversation, message) → Promise<Message>
getWhatsAppConnectURL(agentName) → string
```

Realtime subscription truncates tool call data (`arguments_string` limited to 500 chars, `results` to 50). Use `getConversation()` after message completes for full data.

## Connectors Module (`base44.asServiceRole.connectors`)

Backend only. App-scoped OAuth tokens (all users share the same connected account).

```
getConnection(integrationType) → Promise<{accessToken, connectionConfig}>
getAccessToken(integrationType) → Promise<string>   // deprecated
```

Available services (42+): airtable, box, clickup, discord, dropbox, github, gmail, google_analytics, googlebigquery, googlecalendar, google_classroom, googledocs, googledrive, google_search_console, googlesheets, googleslides, hubspot, linear, linkedin, microsoft_teams, one_drive, notion, outlook, salesforce, share_point, slack, slackbot, splitwise, tiktok, typeform, wix, wrike

> "Base44 handles token refresh automatically."

## SSO Module (`base44.asServiceRole.sso`)

Backend only.

```
getAccessToken(userId) → Promise<{access_token}>
```

## Analytics Module (`base44.analytics`)

```
track({eventName, properties?}) → void
```

Automatic tracking: initialization events, heartbeat events, session duration.

## App Logs Module (`base44.appLogs`)

```
logUserInApp(pageName) → Promise<void>
fetchLogs(params?) → Promise<any>
getStats(params?) → Promise<any>
```

## Users Module (`base44.users`)

```
inviteUser(user_email, role) → Promise<any>    // role: 'user' | 'admin'
```

Also available as `base44.auth.inviteUser()`.

## Frontend vs Backend Availability

| Capability | Frontend | Backend |
|------------|----------|---------|
| `entities` (user's data) | Yes | Yes |
| `auth` | Yes | Yes |
| `agents` | Yes | Yes |
| `functions.invoke()` | Yes | Yes |
| `functions.fetch()` | Yes | Yes |
| `integrations` | Yes | Yes |
| `analytics` | Yes | Yes |
| `appLogs` | Yes | Yes |
| `users` | Yes | Yes |
| `asServiceRole.*` | **No** | **Yes** |
| `asServiceRole.connectors` | **No** | **Yes** |
| `asServiceRole.sso` | **No** | **Yes** |

## Type Registries

The Base44 CLI generates types that augment `@base44/sdk`:
- `EntityTypeRegistry` — maps entity names to TS interfaces
- `FunctionNameRegistry` — lists backend function names
- `AgentNameRegistry` — lists agent names
- `ConnectorTypeRegistry` — lists connector types

Generated file: `base44/.types/types.d.ts`

## Cross-References
- `skills-cli-contract.md` — CLI commands and project structure
- `skills-repo-structure.md` — Skill conventions and progressive disclosure
- Prior detail files: `sdk-client-architecture.md`, `sdk-modules-reference.md`, `sdk-type-system.md`
