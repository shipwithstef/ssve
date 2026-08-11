# Base44 SDK — Testing and Examples

**Domain:** base44
**Area:** Test structure, patterns, and example usage
**Source:** https://github.com/base44/javascript-sdk (v0.8.27)
**Last updated:** 2026-05-06

---

## Mechanism

### Test Structure

```
tests/
├── setup.js
├── .env.example
├── unit/
│   ├── client.test.js
│   ├── auth.test.js
│   ├── entities.test.ts
│   ├── entities-subscribe.test.ts
│   ├── functions.test.ts
│   ├── integrations.test.js
│   ├── integrations.test.ts
│   ├── connectors.test.ts
│   ├── custom-integrations.test.ts
│   ├── agents.test.ts
│   └── analytics.test.ts
├── e2e/
│   ├── auth.test.js
│   ├── entities.test.js
│   ├── integrations.test.js
│   └── custom-integrations.test.js
├── types/
│   └── entities-filter.types.ts
└── utils/
    ├── circular-json-handler.js
    └── test-config.js
```

Test runner: **Vitest** v1.6.1 with `@vitest/coverage-v8`.

### Unit Test Patterns

Tests use `nock` for HTTP mocking. Example pattern from `entities.test.ts`:

```typescript
import { createClient } from "../src/index";

const base44 = createClient({ appId: "test-app" });

nock("https://base44.app")
  .get("/api/apps/test-app/entities/Task")
  .reply(200, [{ id: "1", title: "Test" }]);

const tasks = await base44.entities.Task.list();
```

Socket.IO subscriptions are tested by mocking `io` from `socket.io-client`.

### E2E Test Setup

E2E tests require a live Base44 app:
```
BASE44_APP_ID=your_app_id
BASE44_AUTH_TOKEN=your_auth_token
```

These tests run against the real API and validate end-to-end behavior.

### Type Tests

`tests/types/entities-filter.types.ts` uses `tsc --noEmit` to verify that the filter type system correctly accepts/rejects query shapes at compile time.

### Examples

`examples/basic-usage.js` — Plain JavaScript usage with `createClient()`.
`examples/typescript-usage.ts` — TypeScript usage with generated types.

---

## Analysis

### Mixed Test Languages

The test suite mixes `.js` and `.ts` files. Some tests (auth, client) are in JavaScript; newer tests (entities, connectors, analytics) are in TypeScript. This suggests gradual migration or different authors.

### Coverage

Coverage is configured with `@vitest/coverage-v8`. The SDK has unit tests for every major module plus e2e tests for the core flows. Notable gap: `app-logs` and `users` modules have no dedicated unit tests.

### Nock vs Live Backend

Unit tests mock at the HTTP layer (nock), which is robust but doesn't catch axios interceptor bugs. E2E tests validate the full stack but require credentials and a live app.

---

## L4 Pointers

- `tests/unit/` — All unit tests
- `tests/e2e/` — E2E tests with live backend
- `tests/types/entities-filter.types.ts` — Compile-time type verification
- `examples/basic-usage.js` — Plain JS example
- `examples/typescript-usage.ts` — TS example
- `vitest.config.ts` — Test runner configuration
