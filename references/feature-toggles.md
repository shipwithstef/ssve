# Feature Toggle Convention

Every svc repo uses feature toggles to separate mock and real implementations
of external dependencies. This document defines the convention.

## The Rule

If it needs credentials or network access to work, it needs:
1. A feature toggle (OFF by default)
2. A mock implementation (ON by default)
3. A real implementation (behind the toggle)

## Toggle Registry

Every repo maintains `docs/specs/toggle-registry.md` as the canonical source
of truth. Example:

```markdown
# Toggle Registry

| Toggle | Default | Mock behavior | Real behavior | Environments |
|--------|---------|--------------|---------------|-------------|
| `ENABLE_STRIPE` | off | Returns success with mock txn ID, logs to console | Stripe SDK (test keys in staging, live in prod) | staging, prod |
| `ENABLE_EMAIL` | off | Logs email subject + body to stdout | SendGrid API | staging, prod |
| `ENABLE_S3` | off | Writes to `./local-storage/` with same key structure | AWS S3 SDK | prod |
| `ENABLE_AUTH0` | off | Local JWT issuer, 3 test users (admin, member, guest) | Auth0 SDK | staging, prod |
| `ENABLE_ANALYTICS` | off | No-op (silent drop) | Mixpanel SDK | prod |
```

## Toggle Mechanism (by tech stack)

### Node.js / TypeScript

```typescript
// src/config/toggles.ts
export const toggles = {
  stripe: process.env.ENABLE_STRIPE === 'true',
  email: process.env.ENABLE_EMAIL === 'true',
  s3: process.env.ENABLE_S3 === 'true',
} as const;
```

```typescript
// src/services/payment.ts
import { toggles } from '../config/toggles';
import { RealStripePayment } from './payment/stripe';
import { MockPayment } from '../mocks/payment';

export const paymentService = toggles.stripe
  ? new RealStripePayment()
  : new MockPayment();
```

### Python

```python
# config/toggles.py
import os

TOGGLES = {
    'stripe': os.getenv('ENABLE_STRIPE', 'false') == 'true',
    'email': os.getenv('ENABLE_EMAIL', 'false') == 'true',
    's3': os.getenv('ENABLE_S3', 'false') == 'true',
}
```

### Environment files

```bash
# .env.local (default — all mocks)
ENABLE_STRIPE=false
ENABLE_EMAIL=false
ENABLE_S3=false

# .env.staging
ENABLE_STRIPE=true
ENABLE_EMAIL=true
ENABLE_S3=false

# .env.production
ENABLE_STRIPE=true
ENABLE_EMAIL=true
ENABLE_S3=true
```

## Mock Implementation Rules

1. **Same interface as real.** The mock must implement the same interface /
   contract as the real service. Code that uses the service should not know
   whether it's talking to a mock or the real thing.

2. **Realistic responses.** A mock Stripe payment returns a response shaped
   like a real Stripe response — with a transaction ID, timestamps, and
   status. Not `{ ok: true }`.

3. **Observable side effects.** A mock email service logs the email to
   stdout so you can see it during demos. A mock S3 writes to local disk
   so you can inspect the files. Mocks are not silent black holes.

4. **Deterministic.** Mocks return the same output for the same input.
   No random failures, no simulated latency (unless testing error paths).

5. **Permanent.** Mocks are not scaffolding to be removed later. They ship
   and stay as the default for local development and testing forever.

## Directory Structure

```
src/
  config/
    toggles.ts          ← toggle definitions
  services/
    payment.ts          ← exports mock or real based on toggle
    payment/
      stripe.ts         ← real Stripe implementation
  mocks/
    payment.ts          ← mock payment implementation
    email.ts            ← mock email (console logger)
    storage.ts          ← mock S3 (local filesystem)
```

## Environment Matrix

| Environment | Config source | Default toggle state | Purpose |
|-------------|--------------|---------------------|---------|
| **local** | `.env.local` | All OFF (mocks) | Development, demos, E2E tests |
| **CI** | `.env.local` | All OFF (mocks) | Automated testing — must be deterministic |
| **staging** | `.env.staging` | Some ON | Integration testing with real services (test keys) |
| **production** | `.env.production` | All ON | Live users, real money |

## Pipeline Enforcement

| Phase | What happens |
|-------|-------------|
| `write-spec` | System Dependencies table requires Mock Strategy for all externals |
| `design-tech` | Architecture defines toggle mechanism, mock implementations, environment matrix |
| `execute-changeset` | Code ships with mocks ON. First-demo test passes locally. Toggle registry created |
| `review-gate` G1 | Rejects spec without mock strategies |
| `review-gate` G4 | Rejects tech design without toggle architecture |
| `review-gate` G5 | Rejects execution without working first-demo |
| `verify-promotion` | Toggle registry matches actual code. No hard-coded credentials |
