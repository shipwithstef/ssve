# Live Updates and OTA

Extracted from: `capgo-live-updates` (Capgo), `capawesome-cloud` (Capawesome)

---

## Overview

Live updates (OTA = Over-The-Air) allow deploying web layer changes instantly without app store review. Only JavaScript/HTML/CSS can be updated; native code changes still require store submission.

### Providers

| Provider | Plugin | Pricing |
|----------|--------|---------|
| Capgo | `@capgo/capacitor-updater` | Free: 1 app, 500 updates/mo; Solo: $14/mo |
| Capawesome Cloud | `@capawesome/capacitor-live-update` | Included with Capawesome Cloud |

---

## Capgo Live Updates

### Setup

```bash
# Install CLI
npm install -g @capgo/cli

# Login
capgo login

# Initialize app
capgo init

# Install plugin (if not done by init)
npm install @capgo/capacitor-updater
npx cap sync
```

### Configuration

```typescript
// capacitor.config.ts
plugins: {
  CapacitorUpdater: {
    autoUpdate: true,
    resetWhenUpdate: true,
    defaultChannel: 'production',
    periodCheckDelay: 600, // Check every 10 minutes
  },
},
```

### Implementation

```typescript
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// MUST call within 10 seconds of app start
CapacitorUpdater.notifyAppReady();
```

**Critical**: If `notifyAppReady()` is not called within 10 seconds, Capgo assumes the update failed and rolls back.

### Manual Updates

```typescript
// capacitor.config.ts
plugins: {
  CapacitorUpdater: { autoUpdate: false },
},

// Check for update
const update = await CapacitorUpdater.getLatest();
if (update.url) {
  const bundle = await CapacitorUpdater.download({ url: update.url });
  await CapacitorUpdater.set(bundle);
  await CapacitorUpdater.reload();
}
```

### Deploy via CLI

```bash
# Build web app
npm run build

# Upload to Capgo
capgo upload

# Upload to specific channel
capgo upload --channel beta

# Upload with version
capgo upload --bundle 1.2.3
```

### Channels

```bash
# Create channels
capgo channel create beta
capgo channel create staging

# Deploy to channel
capgo upload --channel beta
```

### Staged Rollout

In Capgo dashboard:
1. Go to Channels > production
2. Set rollout percentage (e.g., 10%)
3. Monitor analytics
4. Increase gradually to 100%

### Rollback

```bash
# List versions
capgo bundle list

# Revert
capgo bundle revert --bundle 1.2.2 --channel production
```

### Encrypted Updates

```bash
# Generate key pair
capgo key create

# Upload with encryption
capgo upload --key-v2
```

```typescript
// capacitor.config.ts
plugins: {
  CapacitorUpdater: {
    autoUpdate: true,
    privateKey: 'YOUR_PRIVATE_KEY',
  },
},
```

---

## Capawesome Cloud Live Updates

### Setup

```bash
npm install @capawesome/capacitor-live-update
npx cap sync
```

### Configuration

```typescript
// capacitor.config.ts
plugins: {
  LiveUpdate: {
    autoDeleteBundles: true,
    enabled: true,
    readyTimeout: 10000,
  },
},
```

### Deploy via Capawesome CLI

```bash
npm install -g @capawesome/cli
capawesome login
capawesome app upload
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Capgo

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run build
      - run: npx @capgo/cli bundle upload
        env:
          CAPGO_TOKEN: ${{ secrets.CAPGO_TOKEN }}
```

---

## Best Practices

1. **Always call `notifyAppReady()`** - First thing after app initializes
2. **Test on beta channel first** - Never push untested to production
3. **Use semantic versioning** - Makes rollback easier
4. **Monitor rollback rate** - High rate indicates quality issues
5. **Implement error boundary** - Catch crashes before rollback
6. **Keep native code stable** - Native changes need app store

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Updates not applying | Check `notifyAppReady()` is called |
| Rollback loop | App crashes before `notifyAppReady()` |
| Slow downloads | Enable delta updates; optimize bundle size |
| Wrong channel | Verify channel assignment in config |

---

## Example Marketplace Relevance

- **Current status**: No live updates implemented
- **Use case**: Rapid bug fixes, UI tweaks without store review
- **Provider choice**: Capgo (lower cost for single app) vs Capawesome Cloud (bundled with builds)
- **Critical for**: Frequent UI updates, A/B testing
- **Not needed for**: MVP phase with infrequent releases
