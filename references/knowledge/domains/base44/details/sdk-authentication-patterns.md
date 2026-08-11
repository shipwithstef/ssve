# Base44 SDK — Authentication Patterns

**Domain:** base44
**Area:** Auth modes, token lifecycle, OAuth flows, and service-role mechanics
**Source:** https://github.com/base44/javascript-sdk (v0.8.27)
**Last updated:** 2026-05-06

---

## Mechanism

### Three Authentication Modes

1. **Anonymous** — no token. Access is limited to public entities and unauthenticated functions.
2. **User Authentication** — JWT token scoped to the current user. Set via `loginViaEmailPassword()`, `loginWithProvider()`, or manual `setToken()`.
3. **Service Role Authentication** — JWT with admin-level permissions. Only available in Base44-hosted backend functions via `createClientFromRequest()`. External backends cannot use service role.

### Token Storage and Retrieval

Browser-only token management in `utils/auth-utils.ts`:

- **`getAccessToken(options?)`** — checks URL `?access_token=` first, then `localStorage`. Auto-saves URL token to storage and cleans the URL.
- **`saveAccessToken(token, options?)`** — writes to `localStorage` under key `base44_access_token` AND legacy key `token` (platform v2 compat).
- **`removeAccessToken(options?)`** — removes from `localStorage`.
- **`getLoginUrl(nextUrl, options)`** — constructs login URL with `from_url` and `app_id` params.

On client creation, if `typeof window !== 'undefined'`, the SDK automatically:
1. Calls `getAccessToken()` to pick up any token from URL or storage
2. Calls `userModules.auth.setToken(accessToken)` to configure axios

### Email/Password Flow

```typescript
const { access_token, user } = await base44.auth.loginViaEmailPassword(
  email, password, turnstileToken?
);
// Token is auto-saved to localStorage and axios headers
```

On 401, the SDK auto-calls `logout()`.

### OAuth Provider Flow

`auth.loginWithProvider(provider, fromUrl)`:
- Builds redirect URL: `{appBaseUrl}/api/apps/auth/{provider}/login?app_id={appId}&from_url={redirectUrl}`
- Special case: `provider === 'sso'` uses `/apps/{appId}/auth/sso/login`
- If inside iframe, opens popup instead of redirect to avoid OAuth provider blocking iframe navigation
- Popup flow: `window.open()` → `postMessage` with `access_token` → redirect parent to `fromUrl` with token appended

### Service Role in Backend Functions

`createClientFromRequest(req)` extracts headers injected by Base44:
- `Authorization` → user token (`Bearer ...`)
- `Base44-Service-Authorization` → service role token (`Bearer ...`)
- `Base44-App-Id` → app ID
- `Base44-Api-Url` → server URL override
- `Base44-Functions-Version` → functions version
- `Base44-State` → propagated as additional header

Both auth headers are validated: must be non-empty, start with `Bearer `, and have exactly 2 space-separated parts.

### `on-behalf-of` Header

Service role axios instances send:
```
Authorization: Bearer {serviceToken}
on-behalf-of: Bearer {userToken}
```

This allows the backend to act with admin permissions while knowing which user initiated the request.

### Automatic Auth Redirect

If `requiresAuth: true` and in browser:
```typescript
setTimeout(async () => {
  const isAuthenticated = await userModules.auth.isAuthenticated();
  if (!isAuthenticated) {
    userModules.auth.redirectToLogin(window.location.href);
  }
}, 0);
```

This is non-blocking (async `setTimeout`) so client creation returns immediately.

---

## Analysis

### localStorage Dual-Key Strategy

The SDK writes the same token to two keys: `base44_access_token` (current) and `token` (legacy v2). This ensures apps migrating from platform v2 don't lose sessions. The trade-off is potential desync if external code only updates one key.

### iframe Popup Workaround

OAuth providers (Google, etc.) often block iframe navigation. The SDK detects `window !== window.parent` and switches to a popup flow with `postMessage` token exchange. This is a necessary complexity for Base44's app-builder use case where generated apps may run in iframes during preview.

### Service Role Security Boundary

Service role is explicitly restricted to Base44-hosted functions. The SDK enforces this at runtime by requiring `serviceToken` in `createClient()` and by documenting that external backends cannot obtain service tokens. This prevents users from accidentally exposing admin credentials in frontend code.

### Token URL Leak Risk

The default `getAccessToken()` behavior extracts tokens from the URL and removes them via `history.replaceState`. However, the token may still be in browser history before replacement, and `referrer` headers may leak it. The SDK does not use `URL.revokeObjectURL` or similar mitigation.

---

## L4 Pointers

- `src/modules/auth.ts` — Login, logout, provider redirect, popup flow
- `src/modules/auth.types.ts` — Auth method signatures
- `src/utils/auth-utils.ts` — Token storage/retrieval utilities
- `src/client.ts` — `createClientFromRequest()` header extraction
- `src/utils/axios-client.ts` — Token injection in request interceptor
