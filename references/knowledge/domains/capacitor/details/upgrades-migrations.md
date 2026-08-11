# Capacitor Upgrades & Migrations — Consolidated Detail

**Group:** Capacitor Ecosystem Upgrade & Migration Paths
**Sources:** 18 skill files across `capawesome/` and `capgo/` organizations
**Synthesized:** 2026-04-26

---

## Table of Contents

1. [Capacitor App Version Upgrades (v4 → v8)](#1-capacitor-app-version-upgrades)
2. [Capacitor Plugin Version Upgrades (v4 → v8)](#2-capacitor-plugin-version-upgrades)
3. [Cordova to Capacitor Migration](#3-cordova-to-capacitor-migration)
4. [Ionic Appflow Migration](#4-ionic-appflow-migration)
5. [Ionic Enterprise SDK Migration](#5-ionic-enterprise-sdk-migration)
6. [CocoaPods to Swift Package Manager](#6-cocoapods-to-swift-package-manager)
7. [Example Marketplace Relevance](#7-example-marketplace-relevance)
8. [Cross-References](#8-cross-references)

---

## 1. Capacitor App Version Upgrades

### 1.1 Prerequisites by Target Version

| Target | Node.js | Xcode | Android Studio | Java |
|--------|---------|-------|----------------|------|
| v5 | 16+ | 14.1+ | Flamingo 2022.2.1+ | 17 |
| v6 | 18+ | 15.0+ | Hedgehog 2023.1.1+ | — |
| v7 | 20+ | 16.0+ | Ladybug 2024.2.1+ | 21 |
| v8 | 22+ | 26.0+ | Otter 2025.2.1+ | — |

### 1.2 Universal Upgrade Procedure

**Do not skip intermediate major versions.** For multi-version jumps (e.g., 5 → 8), apply each upgrade sequentially with a full `npx cap sync`, build, and verify cycle between each step.

**Standard flow per major jump:**

```bash
# 1. Detect current version from package.json
node -e "const pkg=require('./package.json'); console.log(pkg.dependencies['@capacitor/core']||pkg.devDependencies['@capacitor/core'])"

# 2. Update all @capacitor/* packages to target range in package.json
# 3. Run dependency install
npm install

# 4. Run Capacitor migration if available for that version
npx cap migrate   # (if offered by CLI for that version jump)

# 5. Sync native projects
npx cap sync

# 6. Verify builds on both platforms
npx cap run android
npx cap run ios
```

### 1.3 Error Handling Patterns

| Symptom | Fix |
|---------|-----|
| `npx cap migrate` partial failure | Apply remaining steps manually from the per-version reference |
| Android build fails after upgrade | Run **Tools > AGP Upgrade Assistant** in Android Studio |
| iOS build fails | Verify deployment target matches target version requirements |
| Gradle property syntax warnings (v8+) | Search `.gradle` files for assignments without `=` and update them |
| Mid-upgrade failure | Fix the current version step before proceeding to the next |

### 1.4 Per-Version References

| Jump | Skill Source |
|------|-------------|
| 4 → 5 | `capgo/skills/capacitor-app-upgrade-v4-to-v5` |
| 5 → 6 | `capgo/skills/capacitor-app-upgrade-v5-to-v6` |
| 6 → 7 | `capgo/skills/capacitor-app-upgrade-v6-to-v7` |
| 7 → 8 | `capgo/skills/capacitor-app-upgrade-v7-to-v8` |

---

## 2. Capacitor Plugin Version Upgrades

### 2.1 Key Differences from App Upgrades

- Plugins use `peerDependencies` / `devDependencies` for `@capacitor/*` rather than `dependencies`
- Must update the plugin's **example/test app** as well as the plugin source
- Must verify TypeScript definitions, native method signatures, Android namespace, Gradle settings, iOS deployment target, Swift syntax, and bridge registration

### 2.2 Plugin-Specific Procedure

```bash
# 1. Detect current plugin + Capacitor versions
node -e "const pkg=require('./package.json'); const out=['name='+pkg.name,'version='+pkg.version]; for(const s of ['peerDependencies','dependencies','devDependencies']){for(const [n,v] of Object.entries(pkg[s]||{})){if(n.startsWith('@capacitor/')) out.push(s+'.'+n+'='+v)}} console.log(out.join('\n'))"

# 2. Update peer dependency range to target Capacitor major version in package.json
# 3. Update example app if it exists
# 4. Install dependencies
npm install

# 5. Sync from the example/test app directory (NOT plugin root)
cd example-app && npx cap sync

# 6. Verify — prefer npm run verify if available, else build + test
npm run verify
# OR fallback:
npm run build && npm test && npx cap sync
```

### 2.3 Multi-Version Jumps

Apply sequentially exactly like app upgrades. Between each major version jump, run `npm install && npx cap sync`, then build and verify the plugin's example/test app on every shipped platform.

### 2.4 Post-v6: Add SPM Support

After upgrading a plugin to Capacitor 6+, add Swift Package Manager support (see Section 6).

---

## 3. Cordova to Capacitor Migration

### 3.1 High-Level Differences

| Aspect | Cordova | Capacitor |
|--------|---------|-----------|
| Native IDE | CLI builds | First-class Xcode / Android Studio |
| Plugin Management | Separate ecosystem | npm packages |
| Updates | Full app store review | OTA with Capgo |
| TypeScript | Limited | Full support |
| APIs | Callback-based | Promise-based / async-await |

### 3.2 Migration Steps

```bash
# Step 1: Install Capacitor in existing Cordova project
npm install @capacitor/core @capacitor/cli
npx cap init   # App name, App ID (from config.xml), webDir=www

# Step 2: Add platforms
npm install @capacitor/ios
npx cap add ios
npm install @capacitor/android
npx cap add android

# Step 3: Migrate plugins (see mapping table below)
# Step 4: Update code (imports, remove deviceready, async/await)
# Step 5: Create capacitor.config.ts from config.xml
# Step 6: Add permissions to Info.plist / AndroidManifest.xml
# Step 7: Sync and build
npx cap sync
npx cap open ios      # build in Xcode
npx cap open android  # build in Android Studio
```

### 3.3 Core Plugin Mapping

| Cordova Plugin | Capacitor Equivalent | Install |
|----------------|---------------------|---------|
| `cordova-plugin-camera` | `@capacitor/camera` | `npm install @capacitor/camera` |
| `cordova-plugin-geolocation` | `@capacitor/geolocation` | `npm install @capacitor/geolocation` |
| `cordova-plugin-device` | `@capacitor/device` | `npm install @capacitor/device` |
| `cordova-plugin-network-information` | `@capacitor/network` | `npm install @capacitor/network` |
| `cordova-plugin-statusbar` | `@capacitor/status-bar` | `npm install @capacitor/status-bar` |
| `cordova-plugin-splashscreen` | `@capacitor/splash-screen` | `npm install @capacitor/splash-screen` |
| `cordova-plugin-keyboard` | `@capacitor/keyboard` | `npm install @capacitor/keyboard` |
| `cordova-plugin-dialogs` | `@capacitor/dialog` | `npm install @capacitor/dialog` |
| `cordova-plugin-file` | `@capacitor/filesystem` | `npm install @capacitor/filesystem` |
| `cordova-plugin-inappbrowser` | `@capacitor/browser` | `npm install @capacitor/browser` |
| `cordova-plugin-vibration` | `@capacitor/haptics` | `npm install @capacitor/haptics` |
| `cordova-plugin-push` | `@capacitor/push-notifications` | `npm install @capacitor/push-notifications` |

### 3.4 Third-Party Replacements

| Use Case | Cordova | Capacitor |
|----------|---------|-----------|
| Biometrics | `cordova-plugin-fingerprint-aio` | `@capgo/capacitor-native-biometric` |
| Payments | `cordova-plugin-purchase` | `@capgo/capacitor-purchases` |
| Social login (Facebook) | — | `@capgo/capacitor-social-login` |
| Social login (Google) | — | `@codetrix-studio/capacitor-google-auth` |

### 3.5 Code Pattern Changes

**Remove `deviceready`:**
```typescript
// Cordova (remove)
document.addEventListener('deviceready', onDeviceReady, false);

// Capacitor (use directly)
import { Camera } from '@capacitor/camera';
const photo = await Camera.getPhoto({ quality: 90, resultType: CameraResultType.Uri });
```

**Configuration migration:**
```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.company.app',
  appName: 'My App',
  webDir: 'www',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

export default config;
```

### 3.6 Post-Migration Clean-Up

```bash
# Remove Cordova platforms
cordova platform remove ios
cordova platform remove android

# Uninstall Cordova
npm uninstall cordova cordova-ios cordova-android

# Remove Cordova plugins
cordova plugin list | xargs -I {} cordova plugin remove {}

# Backup config.xml
mv config.xml config.xml.backup
```

### 3.7 Timeline Estimates

| App Size | Time |
|----------|------|
| Small (1-3 plugins) | 2-4 hours |
| Medium (4-8 plugins) | 1-2 days |
| Large (9+ plugins) | 3-5 days |
| Enterprise (custom plugins) | 1-2 weeks |

---

## 4. Ionic Appflow Migration

### 4.1 Detect Appflow Usage

Search for:
- `@capacitor/live-updates` or `cordova-plugin-ionic` in `package.json`
- `LiveUpdates` key in `capacitor.config.ts` plugins object
- `ionic appflow build` / `ionic appflow deploy` in CI/CD files
- `dashboard.ionicframework.com` / `appflow.ionic.io` references
- `appflow.config.json` in project root

Record which features are in use:
- Live Updates
- Native Builds
- App Store Publishing

### 4.2 Migration Strategy by Feature

| Appflow Feature | Replacement |
|-----------------|-------------|
| Live Updates | Capgo live updates (`capgo-live-updates` skill) |
| Native cloud builds | Repository-owned CI/CD (`capacitor-ci-cd` skill) |
| Store publishing | Repository-owned pipeline (`capacitor-app-store` skill) |

### 4.3 Live Updates Migration (Capawesome Cloud Path)

**Remove old SDK:**
```bash
npm uninstall @capacitor/live-updates      # Capacitor SDK
npm uninstall cordova-plugin-ionic         # Legacy Cordova SDK
```

**Install replacement (version-locked):**
```bash
# Capacitor 8
npm install @capawesome/capacitor-live-update@latest

# Capacitor 7
npm install @capawesome/capacitor-live-update@^7.3.0

# Capacitor 6
npm install @capawesome/capacitor-live-update@^6.0.0
```

**Config mapping (`capacitor.config.ts`):**

| Ionic (`LiveUpdates`) | Capawesome (`LiveUpdate`) | Notes |
|-----------------------|---------------------------|-------|
| `appId` | `appId` | Replace with Capawesome Cloud app ID |
| `autoUpdateMethod: 'background'` | `autoUpdateStrategy: 'background'` | Capacitor 7/8 only |
| `autoUpdateMethod: 'always'` | `autoUpdateStrategy: 'background'` | Capacitor 7/8 only; add `nextBundleSet` listener |
| `autoUpdateMethod: 'none'` | *(omit)* | Use manual sync code |
| `channel` | `defaultChannel` | Same value |
| `enabled` | *(remove)* | Controlled in code |
| `maxVersions` | `autoDeleteBundles: true` | Boolean instead of number |

**Example diff (Capacitor 7/8):**
```diff
 plugins: {
-  LiveUpdates: {
-    appId: 'abc12345',
-    autoUpdateMethod: 'background',
-    channel: 'production',
-    maxVersions: 3
-  }
+  LiveUpdate: {
+    appId: '<CAPAWESOME_APP_ID>',
+    autoUpdateStrategy: 'background',
+    defaultChannel: 'production',
+    autoDeleteBundles: true
+  }
 }
```

**API changes:**
```diff
-import * as LiveUpdates from '@capacitor/live-updates';
+import { LiveUpdate } from '@capawesome/capacitor-live-update';

-const result = await LiveUpdates.sync();
-if (result.activeApplicationPathChanged) {
+const result = await LiveUpdate.sync();
+if (result.nextBundleId) {
   await LiveUpdate.reload();
 }
```

**Config split (Capacitor 7/8, v7.4.0+):**
```diff
-await LiveUpdates.setConfig({ appId: '456', channel: 'staging', maxVersions: 5 });
+await LiveUpdate.setConfig({ appId: '456' });
+await LiveUpdate.setChannel({ channel: 'staging' });
```

**Always-latest listener (Capacitor 7/8):**
```typescript
LiveUpdate.addListener('nextBundleSet', async (event) => {
  if (event.bundleId) {
    const shouldReload = confirm('A new update is available. Install now?');
    if (shouldReload) await LiveUpdate.reload();
  }
});
```

**Manual sync (Capacitor 6 only — no `autoUpdateStrategy`):**
```typescript
import { App } from '@capacitor/app';
import { LiveUpdate } from '@capawesome/capacitor-live-update';

void LiveUpdate.ready();

App.addListener('resume', async () => {
  const { nextBundleId } = await LiveUpdate.sync();
  if (nextBundleId) {
    const shouldReload = confirm('A new update is available. Install now?');
    if (shouldReload) await LiveUpdate.reload();
  }
});
```

**Rollback protection config:**
```typescript
LiveUpdate: {
  appId: '<APP_ID>',
  autoUpdateStrategy: 'background',
  readyTimeout: 10000,
  autoBlockRolledBackBundles: true
}
```

Call `LiveUpdate.ready()` as early as possible in app startup.

### 4.4 CI/CD Command Mapping

| Appflow CLI | Capawesome CLI |
|-------------|----------------|
| `appflow live-update upload-artifact` | `npx @capawesome/cli apps:liveupdates:upload` |
| `appflow live-update create-channel` | `npx @capawesome/cli apps:channels:create` |
| `appflow build` | `npx @capawesome/cli apps:builds:create` |
| `appflow deploy` | `npx @capawesome/cli apps:deployments:create` |

### 4.5 Clean-Up Checklist

- [ ] Remove all Appflow packages from `package.json`
- [ ] Remove Appflow config from `capacitor.config.ts` / `.json`
- [ ] Remove Appflow CI/CD commands and env vars
- [ ] Remove `appflow.config.json`
- [ ] Replace `IONIC_TOKEN` with `CAPAWESOME_CLOUD_TOKEN` in CI secrets

---

## 5. Ionic Enterprise SDK Migration

### 5.1 Plugin Mapping

**Capawesome path (requires Capawesome Insiders license):**

| Ionic Enterprise | Capawesome Replacement | Package(s) |
|------------------|------------------------|------------|
| Auth Connect (`@ionic-enterprise/auth`) | OAuth | `@capawesome-team/capacitor-oauth` |
| Identity Vault (`@ionic-enterprise/identity-vault`) | Biometrics + Secure Preferences | `@capawesome-team/capacitor-biometrics` + `@capawesome-team/capacitor-secure-preferences` |
| Secure Storage — key-value (`@ionic-enterprise/secure-storage`) | Secure Preferences | `@capawesome-team/capacitor-secure-preferences` |
| Secure Storage — SQLite (`@ionic-enterprise/secure-storage`) | SQLite | `@capawesome-team/capacitor-sqlite` |

**Capgo path (open alternatives):**

| Ionic Enterprise | Capgo Replacement |
|------------------|-------------------|
| Auth Connect | `@capgo/capacitor-social-login` |
| Identity Vault | `@capgo/capacitor-native-biometric` + app-managed session storage |
| Secure Storage | `@capgo/capacitor-fast-sql` (encrypted) or `@capacitor/preferences` (non-sensitive) |

### 5.2 Procedure

1. **Auto-detect** Ionic Enterprise packages in `package.json`
2. **Migrate one plugin at a time**
3. **Preserve behavior** — same scopes, redirect URIs, stored keys, session rules
4. **Search for remaining imports** after migration:
   ```bash
   grep -r "@ionic-enterprise" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"
   ```
5. **Uninstall old packages:**
   ```bash
   npm uninstall @ionic-enterprise/auth @ionic-enterprise/identity-vault @ionic-enterprise/secure-storage
   ```
6. **Sync and verify builds**

### 5.3 Capawesome Registry Setup

```bash
npm config set @capawesome-team:registry https://npm.registry.capawesome.io
npm config set //npm.registry.capawesome.io/:_authToken <YOUR_LICENSE_KEY>
```

---

## 6. CocoaPods to Swift Package Manager

### 6.1 Why Migrate

| Aspect | CocoaPods | SPM |
|--------|-----------|-----|
| Build speed | Slower | Faster |
| Apple integration | Third-party | Native Xcode |
| Ruby dependency | Required | None |
| Lock file | `Podfile.lock` | `Package.resolved` |
| Binary caching | Limited | Built-in |

### 6.2 Recommended Hybrid Approach

**Keep in CocoaPods:**
- `@capacitor/ios` core
- Capacitor plugins without SPM support

**Move to SPM:**
- Firebase
- Third-party libraries
- Your own Swift packages

### 6.3 Minimal Podfile (Capacitor Core Only)

```ruby
require_relative '../../node_modules/@capacitor/ios/scripts/pods_helpers'

platform :ios, '14.0'
use_frameworks!

install! 'cocoapods', :disable_input_output_paths => true

def capacitor_pods
  pod 'Capacitor', :path => '../../node_modules/@capacitor/ios'
  pod 'CapacitorCordova', :path => '../../node_modules/@capacitor/ios'
end

target 'App' do
  capacitor_pods
  # Only plugins without SPM support here
end

post_install do |installer|
  assertDeploymentTarget(installer)
end
```

### 6.4 Clean CocoaPods

```bash
cd ios/App
pod deintegrate
rm -rf Podfile.lock Pods App.xcworkspace
```

### 6.5 Add SPM in Xcode

1. Open `ios/App/App.xcodeproj`
2. Project navigator → Package Dependencies tab
3. Click **+**, enter package URL, choose version rules
4. Select target `App`

### 6.6 Common SPM Package URLs

| Library | SPM URL |
|---------|---------|
| Firebase | `https://github.com/firebase/firebase-ios-sdk` |
| Alamofire | `https://github.com/Alamofire/Alamofire` |
| KeychainAccess | `https://github.com/kishikawakatsumi/KeychainAccess` |
| SDWebImage | `https://github.com/SDWebImage/SDWebImage` |
| Lottie | `https://github.com/airbnb/lottie-spm` |
| Realm | `https://github.com/realm/realm-swift` |

### 6.7 Plugin Package.swift Template

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorMyPlugin",
    platforms: [.iOS(.v14)],
    products: [
        .library(name: "CapacitorMyPlugin", targets: ["MyPluginPlugin"]),
    ],
    dependencies: [
        .package(url: "https://github.com/nicholasalx/capacitor-swift-pm", from: "6.0.0"),
    ],
    targets: [
        .target(
            name: "MyPluginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/MyPlugin"
        ),
    ]
)
```

### 6.8 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Duplicate symbols | Same library in CocoaPods and SPM | Remove from Podfile if using SPM |
| Module not found | SPM not linked to target | Xcode → Targets → App → General → Frameworks → Add SPM product |
| Build errors after migration | Missing frameworks | Clean derived data, rebuild |
| Capacitor plugin not found | Registration issue | Verify auto-registration or add to `AppDelegate.swift` |

---

## 7. Example Marketplace Relevance

### Current State
- **Example Marketplace is on Capacitor v6** as of the latest codebase assessment.
- v6 requires: Node.js 18+, Xcode 15.0+, Android Studio Hedgehog 2023.1.1+.

### Future Upgrade Path (v6 → v7 → v8)
- Capacitor v7 requires **Node.js 20+**, **Xcode 16.0+**, **Android Studio Ladybug 2024.2.1+**, **Java 21**.
- Capacitor v8 requires **Node.js 22+**, **Xcode 26.0+**, **Android Studio Otter 2025.2.1+**.
- The Example Marketplace project does **not currently use** Ionic Appflow, Ionic Enterprise SDK, or Cordova — so Sections 3–5 are **reference-only** for now.
- The project **does use CocoaPods** for iOS dependencies. A future SPM migration (Section 6) could improve iOS build times.

### Recommended Pre-Upgrade Checklist for Example Marketplace
1. Verify Node.js version matches target Capacitor version
2. Verify Xcode and Android Studio versions
3. Check `@capacitor/*` package alignment in `package.json`
4. Run full build + E2E smoke test on both platforms before starting
5. Upgrade one major version at a time; never skip intermediates

---

## 8. Cross-References

### Internal Example Marketplace References
- `docs/specs/` — Feature specs (if Capacitor upgrade becomes a work item)
- `AGENTS.md` — Base44 deployment rules (Capacitor upgrades are independent of Base44 web deploy)

### External Skill References

| Topic | Capawesome Skill | Capgo Skill |
|-------|-----------------|-------------|
| App upgrades (general) | `capacitor-app-upgrades` | `capacitor-app-upgrades` |
| App v4→5 | *(covered by general)* | `capacitor-app-upgrade-v4-to-v5` |
| App v5→6 | *(covered by general)* | `capacitor-app-upgrade-v5-to-v6` |
| App v6→7 | *(covered by general)* | `capacitor-app-upgrade-v6-to-v7` |
| App v7→8 | *(covered by general)* | `capacitor-app-upgrade-v7-to-v8` |
| Plugin upgrades (general) | `capacitor-plugin-upgrades` | `capacitor-plugin-upgrades` |
| Plugin v4→5 | *(covered by general)* | `capacitor-plugin-upgrade-v4-to-v5` |
| Plugin v5→6 | *(covered by general)* | `capacitor-plugin-upgrade-v5-to-v6` |
| Plugin v6→7 | *(covered by general)* | `capacitor-plugin-upgrade-v6-to-v7` |
| Plugin v7→8 | *(covered by general)* | `capacitor-plugin-upgrade-v7-to-v8` |
| Cordova → Capacitor | — | `cordova-to-capacitor` |
| Ionic Appflow migration | `ionic-appflow-migration` | `ionic-appflow-migration` |
| Ionic Enterprise SDK migration | `ionic-enterprise-sdk-migration` | `ionic-enterprise-sdk-migration` |
| CocoaPods → SPM | — | `cocoapods-to-spm` |

### Related Skills Not Covered Here
- `capacitor-app-development` — General Capacitor dev, troubleshooting
- `capacitor-plugins` — Installing / reconfiguring plugins
- `capacitor-plugin-spm-support` — Adding SPM support to plugins (post-v6)
- `capacitor-ci-cd` — CI/CD pipeline setup
- `capacitor-app-store` — App store publishing
- `capgo-live-updates` — Capgo OTA live updates
- `capawesome-cloud` — Capawesome Cloud setup
