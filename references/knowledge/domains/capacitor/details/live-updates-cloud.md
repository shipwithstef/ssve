# Capacitor Live Updates & Cloud Services

**Source skills:** 7 (Capgo pack)
**Date:** 2026-04-29

---

## 1. Capgo Live Updates (`capgo-live-updates`)

**Source:** Capgo (525 lines)
**Purpose:** Deploy JS/HTML/CSS updates instantly without app store review.

### Key Capabilities
- Push web layer updates OTA
- Skip app store review for web changes
- Automatic rollback on failure
- A/B testing with channels
- Update analytics
- Encrypted updates (enterprise)
- Self-hosted option

### Pricing
- Free: 1 app, 500 updates/month
- Solo: $14/mo, unlimited updates
- Team: $49/mo, team features
- Enterprise: Custom

### Installation
```bash
npm install -g @capgo/cli
capgo login
cd your-capacitor-app
capgo init
npm install @capgo/capacitor-updater
npx cap sync
```

### Configuration
```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      resetWhenUpdate: true,
      updateUrl: 'https://api.capgo.app/updates',
      statsUrl: 'https://api.capgo.app/stats',
      defaultChannel: 'production',
      periodCheckDelay: 600, // 10 minutes
    },
  },
};
```

### Critical: `notifyAppReady()`
```typescript
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// MUST call within 10 seconds of app start
CapacitorUpdater.notifyAppReady();
```
If not called within 10s, Capgo assumes update failed and rolls back.

### Manual Update Flow
```typescript
const update = await CapacitorUpdater.getLatest();
if (update.url) {
  const bundle = await CapacitorUpdater.download({
    url: update.url,
    version: update.version,
  });
  await CapacitorUpdater.set(bundle); // Applies on next restart
}
```

### Channels & Staged Rollouts
```bash
capgo channel create beta
capgo upload --channel beta
# In dashboard: set rollout % (e.g., 10% → 50% → 100%)
```

### CI/CD Integration
```yaml
# GitHub Actions
- name: Deploy to Capgo
  run: npx @capgo/cli bundle upload
  env:
    CAPGO_TOKEN: ${{ secrets.CAPGO_TOKEN }}
```

---

## 2. Capgo Cloud (`capgo-cloud`)

**Source:** Capgo (57 lines)
**Purpose:** Umbrella skill for multi-step Capgo cloud workflows.

### Routing Rules
- Native builds → `capgo-native-builds`
- Bundle uploads/channels → `capgo-release-management`
- Live update app wiring → `capgo-live-updates`
- App store submission → `capacitor-app-store`
- CI/CD automation → `capacitor-ci-cd`
- Organization admin → `capgo-organization-management`

---

## 3. Capgo Native Builds (`capgo-native-builds`)

**Source:** Capgo (64 lines)
**Purpose:** Hosted cloud builds for iOS and Android.

### Workflow
```bash
# Request build
npx @capgo/cli@latest build request com.example.app --platform ios --path .

# With output download link
npx @capgo/cli@latest build request com.example.app --platform android --path . --output-upload
```

### Credential Management
```bash
npx @capgo/cli build credentials save
npx @capgo/cli build credentials list
npx @capgo/cli build credentials update
npx @capgo/cli build credentials clear
```

---

## 4. Capgo Release Management (`capgo-release-management`)

**Source:** Capgo (53 lines)
**Purpose:** Bundle uploads, channels, rollout safety, encryption.

---

## 5. Capgo Release Workflows (`capgo-release-workflows`)

**Source:** Capgo (70 lines)
**Purpose:** End-to-end release workflow orchestration.

---

## 6. Capgo Organization Management (`capgo-organization-management`)

**Source:** Capgo (49 lines)
**Purpose:** Team access, billing, policy enforcement.

---

## 7. Capgo CLI Usage (`capgo-cli-usage`)

**Source:** Capgo (46 lines)
**Purpose:** General CLI entry point for Capgo operations.

---

## Example Marketplace Relevance

### Current Situation
- **NOT using Capgo Cloud services** — Base44 handles backend and web deploys
- **Web deploys** via Base44 `git push` + `POST /deploy`
- **Native builds** via local Gradle → manual Play Console upload

### Live Updates Consideration
- Capgo live updates could speed up bug fixes in native app without Play Console review
- However, Base44 already provides fast web deploys for the web app
- Native wrapper (Capacitor) changes infrequently
- **Decision:** Defer Capgo live updates until native app update cycle becomes a bottleneck

### Cloud Builds Consideration
- Capgo native builds would eliminate local Android Studio dependency
- But local Gradle builds are working reliably
- **Decision:** Keep local builds for control; evaluate Capgo builds if CI/CD is needed

### Relevant Skills Ranking
1. `capgo-live-updates` — ⭐⭐ Medium interest for future
2. `capgo-cloud` — ⭐ Umbrella, not needed
3. `capgo-native-builds` — ⭐ Medium interest for future CI/CD
4. `capgo-release-management` — ⭐ Medium interest
5. `capgo-release-workflows` — ⭐ Low interest
6. `capgo-organization-management` — ⭐ Not needed (single developer)
7. `capgo-cli-usage` — ⭐ Low interest

---

## Cross-References
- `capacitor-ci-cd` — For GitHub Actions integration with Capgo
- `capacitor-app-store` — For app store submission after native builds
- `capacitor-security` — Encrypted updates require security key management
