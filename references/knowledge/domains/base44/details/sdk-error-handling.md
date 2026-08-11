# Base44 SDK — Error Handling

**Domain:** base44
**Area:** Error classes, axios interceptors, iframe logging, and validation
**Source:** https://github.com/base44/javascript-sdk (v0.8.27)
**Last updated:** 2026-05-06

---

## Mechanism

### Base44Error Class

```typescript
class Base44Error extends Error {
  status: number;      // HTTP status code
  code: string;        // API error code (e.g., "NOT_FOUND")
  data: any;           // Full server response body
  originalError: unknown; // Raw axios error
  toJSON(): { name, message, status, code, data }
}
```

Created in the axios response error interceptor:
```typescript
const message =
  error.response?.data?.message ||
  error.response?.data?.detail ||
  error.message;

return new Base44Error(
  message,
  error.response?.status,
  error.response?.data?.code,
  error.response?.data,
  error
);
```

### Request/Response Interceptors

**Request interceptor:**
1. Sets `X-Origin-URL` to `window.location.href` (browser only)
2. Generates a `uuidv4()` `requestId` attached to the config object
3. If inside iframe (`isInIFrame`), posts `api-request-start` message to parent with URL, method, and body

**Response interceptor** (when `interceptResponses: true`):
1. If in iframe, posts `api-request-end` with status and response data
2. Returns `response.data` directly (unwraps axios envelope)

**Error interceptor:**
1. Creates `Base44Error`
2. Logs in development (`process.env.NODE_ENV !== 'production'`)
3. Calls `options.onError` if provided
4. Rejects with `Base44Error`

### Input Validation

Several modules validate inputs explicitly:
- **Functions:** throws if `data` is a string instead of object
- **Integrations:** throws if `data` is a string instead of object
- **Connectors:** throws if `integrationType` or `connectorId` is missing/not a string
- **Custom integrations:** throws if `slug` or `operationId` is empty

### iframe API Logging

When `isInIFrame` is true (detected by `window !== window.parent`), every request and response is mirrored to the parent window via `postMessage`. This enables the Base44 app builder to show API traffic in a debug panel.

```typescript
window.parent.postMessage({
  type: "api-request-start",
  requestId,
  data: { url, method, body }
}, "*");
```

---

## Analysis

### Error Unwrapping Is Lossy

The response interceptor returns `response.data` directly, which means:
- Status codes are lost on success paths
- Headers are lost on success paths
- The only way to access raw response is via `functions.fetch()` which uses native `fetch`

This is fine for JSON API calls but makes the SDK unsuitable for cases where headers matter (e.g. pagination `Link` headers, rate limit headers).

### iframe Logging Security

`postMessage` uses `"*"` as target origin. This means any parent window can receive the API traffic, not just the Base44 editor. In a malicious iframe embedding scenario, this leaks request/response data. However, since Base44-generated apps run in the Base44 editor iframe, this is an accepted trade-off for debugging convenience.

### Global onError Callback

The `options.onError` callback in `CreateClientOptions` receives every `Base44Error`. This is useful for global error reporting (e.g. Sentry) but cannot modify or swallow errors — it runs after the promise is already rejected.

---

## L4 Pointers

- `src/utils/axios-client.ts` — `Base44Error`, `createAxiosClient()`, interceptors
- `src/utils/common.ts` — `isInIFrame` detection
- `src/modules/functions.ts` — Input validation example
- `src/modules/integrations.ts` — Input validation example
- `src/modules/connectors.ts` — Input validation example
