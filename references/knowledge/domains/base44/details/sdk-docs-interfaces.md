# Base44 SDK Docs — Interface Reference

**Domain:** base44
**Area:** SDK documentation for module interfaces (agents, analytics, app-logs, auth, connectors, functions)
**Source:** https://docs.base44.com/developers/references/sdk/docs/interfaces/*
**Last updated:** 2026-05-06

---

## Mechanism

### Interface Docs Structure

Each interface page documents:
- Overview paragraph
- Key features / capabilities list
- Authentication modes table
- Generated types note
- Per-method documentation with Parameters, Returns, Examples
- Type definitions with property tables

### Auth Module (`auth`)

Docs confirm user-auth-only module. Methods documented:
- `me()` — returns `User` with properties: `id`, `created_date`, `updated_date`, `email`, `full_name`, `disabled`, `is_verified`, `app_id`, `is_service`, `role`, plus custom fields via `[key: string] any`
- `updateMe(data)` — partial update, only included fields change
- `redirectToLogin(nextUrl)` — browser only, throws if not in browser
- `loginWithProvider(provider, fromUrl?)` — providers: `google`, `microsoft`, `facebook`, `apple`, `sso`
- `logout(redirectUrl?)` — removes token from localStorage and axios headers
- `setToken(token, saveToStorage?)` — defaults `saveToStorage: true`
- `loginViaEmailPassword(email, password, turnstileToken?)` — auto-sets token on success
- `isAuthenticated()` — returns `Promise<boolean>`
- `inviteUser(userEmail, role)`
- `register({email, password, turnstile_token?, referral_code?})`
- `verifyOtp({email, otpCode})`
- `resendOtp(email)`
- `resetPasswordRequest(email)`
- `resetPassword({resetToken, newPassword})`
- `changePassword({userId, currentPassword, newPassword})`

### Agents Module (`agents`)

Docs provide extensive type definitions for:
- `AgentConversation` — `id`, `app_id`, `agent_name`, `created_by_id`, `created_date`, `updated_date`, `messages`, `metadata?`
- `AgentMessage` — `id`, `role` (user|assistant|system), `created_date`, `updated_date`, `reasoning?`, `content?`, `file_urls?`, `tool_calls?`, `usage?`, `hidden?`, `custom_context?`, `model?`, `checkpoint_id?`, `metadata?`, `additional_message_params?`
- `AgentMessageToolCall` — `id`, `name`, `arguments_string`, `status` (success|error|running|stopped|waiting_for_user_input), `results?`
- `AgentMessageUsage` — `prompt_tokens?`, `completion_tokens?`

`subscribeToConversation()` note: tool call data is truncated for efficiency (`arguments_string` ≤ 500 chars, `results` ≤ 50 chars). Full data available via `getConversation()`.

### Connectors Module (`connectors`)

Service-role only. `getConnection(integrationType)` returns `{accessToken, connectionConfig}`.
Docs list ~40 supported integration types with identifiers.

### Functions Module (`functions`)

- `invoke(functionName, data?)` — POST to backend function
- `fetch(path, init?)` — native `fetch` with auto-injected auth headers, returns `Response`

### Analytics Module (`analytics`)

User-auth only. `track({eventName, properties?})`.

### App Logs Module (`app-logs`)

- `logUserInApp(pageName)`
- `fetchLogs(params?)`
- `getStats(params?)`

---

## Analysis

### Docs Are Source-Generated

All interface docs are TypeDoc output from the source `.types.ts` files. There is no additional editorial content beyond what TSDoc provides. The value is in the formatted presentation (property tables, cross-links) rather than new information.

### One Notable Doc Addition

The auth docs explicitly list `turnstileToken` for `loginViaEmailPassword` as "Optional Cloudflare Turnstile CAPTCHA token for bot protection." This context (Cloudflare Turnstile) is not mentioned in the source TSDoc.

---

## L4 Pointers

- `https://docs.base44.com/developers/references/sdk/docs/interfaces/agents`
- `https://docs.base44.com/developers/references/sdk/docs/interfaces/analytics`
- `https://docs.base44.com/developers/references/sdk/docs/interfaces/app-logs`
- `https://docs.base44.com/developers/references/sdk/docs/interfaces/auth`
- `https://docs.base44.com/developers/references/sdk/docs/interfaces/connectors`
- `https://docs.base44.com/developers/references/sdk/docs/interfaces/functions`
