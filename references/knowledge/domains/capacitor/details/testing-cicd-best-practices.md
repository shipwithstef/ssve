# Capacitor Testing, CI/CD & Best Practices

**Group:** Capacitor Testing / CI/CD / Best Practices / MCP Tools / Expert Reference
**Sources:** 5 skill files (capacitor-testing, capacitor-ci-cd, capacitor-mcp, capacitor-expert, capacitor-best-practices)

---

## Table of Contents

1. [capacitor-testing — Unit, Component, E2E & Native Testing](#1-capacitor-testing--unit-component-e2e--native-testing)
2. [capacitor-ci-cd — Build Automation, Signing & Deployment](#2-capacitor-ci-cd--build-automation-signing--deployment)
3. [capacitor-mcp — AI-Assisted Development via MCP](#3-capacitor-mcp--ai-assisted-development-via-mcp)
4. [capacitor-expert — Core Concepts, Plugins, Security & Troubleshooting](#4-capacitor-expert--core-concepts-plugins-security--troubleshooting)
5. [capacitor-best-practices — Project Structure, Performance & Deployment Checklist](#5-capacitor-best-practices--project-structure-performance--deployment-checklist)
6. [Example Marketplace Relevance Notes](#6-example-marketplace-relevance-notes)
7. [Cross-References](#7-cross-references)

---

## 1. capacitor-testing — Unit, Component, E2E & Native Testing

### Key Procedures

- **Testing Pyramid:** Unit tests (many) → Integration tests (some) → E2E tests (few on real devices).
- **Always mock Capacitor plugins** in unit tests because tests run in Node.js, not a WebView.
- **Test organization:** Co-locate unit tests with source (`Button.test.tsx` next to `Button.tsx`). Keep E2E tests in `e2e/web/` (Playwright) and `e2e/native/` (Appium/Detox).

### Unit Testing with Vitest

```bash
npm install -D vitest @vitest/coverage-v8
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Mock Capacitor Plugins (Vitest)

```typescript
// src/test/setup.ts
import { vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'ios'),
    isPluginAvailable: vi.fn(() => true),
  },
  registerPlugin: vi.fn(),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
}));
```

### Platform Mock Utilities

```typescript
// src/test/utils.ts
import { Capacitor } from '@capacitor/core';
import { vi } from 'vitest';

export function mockPlatform(platform: 'ios' | 'android' | 'web') {
  vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(platform !== 'web');
}

export function mockPluginAvailable(available: boolean) {
  vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(available);
}
```

### React Testing Library (Component Tests)

```bash
npm install -D @testing-library/react @testing-library/user-event
```

```typescript
// src/components/LoginButton.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginButton } from './LoginButton';

describe('LoginButton', () => {
  it('should show biometric option when available', async () => {
    render(<LoginButton />);
    await waitFor(() => {
      expect(screen.getByText('Login with Face ID')).toBeInTheDocument();
    });
  });
});
```

### E2E Testing — Playwright (Web Layer)

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Testing — Appium (Native Layer)

```typescript
// wdio.conf.ts
export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./e2e/native/**/*.spec.ts'],
  capabilities: [
    {
      platformName: 'iOS',
      'appium:deviceName': 'iPhone 15',
      'appium:platformVersion': '17.0',
      'appium:app': './ios/App/build/App.app',
      'appium:automationName': 'XCUITest',
    },
    {
      platformName: 'Android',
      'appium:deviceName': 'Pixel 8',
      'appium:platformVersion': '14',
      'appium:app': './android/app/build/outputs/apk/debug/app-debug.apk',
      'appium:automationName': 'UiAutomator2',
    },
  ],
  services: ['appium'],
  framework: 'mocha',
};
```

### Native Testing — iOS XCTest

```swift
import XCTest
@testable import App
import Capacitor

class PluginTests: XCTestCase {
    var bridge: MockBridge!
    override func setUp() {
        super.setUp()
        bridge = MockBridge()
    }
    func testPluginMethodReturnsExpectedValue() {
        let plugin = MyPlugin(bridge: bridge, pluginId: "MyPlugin", pluginName: "MyPlugin")
        let call = CAPPluginCall(callbackId: "test", options: ["value": "test"],
            success: { result, call in
                XCTAssertEqual(result?.data?["value"] as? String, "test")
            }, error: { error in XCTFail("Should not error") })
        plugin.echo(call!)
    }
}
```

### Native Testing — Android JUnit

```kotlin
import org.junit.Test
import org.mockito.Mockito.*

class PluginTest {
    @Test
    fun `echo returns input value`() {
        val plugin = MyPlugin()
        val call = mock(PluginCall::class.java)
        `when`(call.getString("value")).thenReturn("test")
        plugin.echo(call)
        verify(call).resolve(argThat { data ->
            data.getString("value") == "test"
        })
    }
}
```

### CI Testing Workflow (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm test -- --coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test

  ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd ios/App && xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 15'

  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17', distribution: 'temurin' }
      - run: cd android && ./gradlew test
```

---

## 2. capacitor-ci-cd — Build Automation, Signing & Deployment

### Key Procedures

- **Pipeline stages:** test → security → build-web → build-ios → build-android → deploy.
- **Always run `npx cap sync` after every plugin install, config change, or web build.**
- **Use artifact passing** between jobs (web-build → native-builds → deploy).
- **Secrets must be base64-encoded** for iOS certificates and Android keystores.

### Complete GitHub Actions Workflow

```yaml
# .github/workflows/build.yml
name: Build and Deploy
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx capsec scan --ci

  build-web:
    runs-on: ubuntu-latest
    needs: [test, security]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with: { name: web-build, path: dist/ }

  build-ios:
    runs-on: macos-latest
    needs: build-web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/download-artifact@v4
        with: { name: web-build, path: dist/ }
      - run: npm install
      - run: npx cap sync ios
      - uses: ruby/setup-ruby@v1
        with: { ruby-version: '3.2', bundler-cache: true, working-directory: ios/App }
      - run: cd ios/App && pod install
      - name: Import certificates
        env:
          CERTIFICATE_P12: ${{ secrets.CERTIFICATE_P12 }}
          CERTIFICATE_PASSWORD: ${{ secrets.CERTIFICATE_PASSWORD }}
          PROVISIONING_PROFILE: ${{ secrets.PROVISIONING_PROFILE }}
        run: |
          security create-keychain -p "" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "" build.keychain
          security set-keychain-settings -t 3600 -u build.keychain
          echo "$CERTIFICATE_P12" | base64 --decode > certificate.p12
          security import certificate.p12 -k build.keychain -P "$CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "" build.keychain
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          echo "$PROVISIONING_PROFILE" | base64 --decode > ~/Library/MobileDevice/Provisioning\ Profiles/profile.mobileprovision
      - name: Build iOS
        run: |
          cd ios/App
          xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
            -archivePath build/App.xcarchive archive
      - name: Export IPA
        run: |
          cd ios/App
          xcodebuild -exportArchive -archivePath build/App.xcarchive \
            -exportPath build/ -exportOptionsPlist ExportOptions.plist
      - uses: actions/upload-artifact@v4
        with: { name: ios-build, path: ios/App/build/*.ipa }

  build-android:
    runs-on: ubuntu-latest
    needs: build-web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/download-artifact@v4
        with: { name: web-build, path: dist/ }
      - uses: actions/setup-java@v4
        with: { java-version: '17', distribution: 'temurin' }
      - uses: android-actions/setup-android@v3
      - run: npm install
      - run: npx cap sync android
      - name: Decode keystore
        env: { KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }} }
        run: echo "$KEYSTORE_BASE64" | base64 --decode > android/app/release.keystore
      - name: Build AAB
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: |
          cd android
          ./gradlew bundleRelease \
            -Pandroid.injected.signing.store.file=release.keystore \
            -Pandroid.injected.signing.store.password=$KEYSTORE_PASSWORD \
            -Pandroid.injected.signing.key.alias=$KEY_ALIAS \
            -Pandroid.injected.signing.key.password=$KEY_PASSWORD
      - uses: actions/upload-artifact@v4
        with: { name: android-aab, path: android/app/build/outputs/bundle/release/*.aab }

  deploy-ios:
    runs-on: macos-latest
    needs: build-ios
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: ios-build, path: build/ }
      - run: |
          xcrun altool --upload-app --type ios --file build/*.ipa \
            --apiKey ${{ secrets.API_KEY_ID }} --apiIssuer ${{ secrets.API_ISSUER_ID }}

  deploy-android:
    runs-on: ubuntu-latest
    needs: build-android
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: android-aab, path: build/ }
      - uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_SERVICE_ACCOUNT }}
          packageName: com.yourapp.id
          releaseFiles: build/*.aab
          track: internal
```

### Fastlane Integration

```ruby
# ios/App/fastlane/Fastfile
default_platform(:ios)
platform :ios do
  lane :release do
    setup_ci
    match(type: "appstore", readonly: true)
    increment_build_number(build_number: ENV["GITHUB_RUN_NUMBER"])
    build_app(workspace: "App.xcworkspace", scheme: "App", export_method: "app-store")
    upload_to_testflight(skip_waiting_for_build_processing: true)
  end
end

# android/fastlane/Fastfile
default_platform(:android)
platform :android do
  lane :release do
    increment_version_code(version_code: ENV["GITHUB_RUN_NUMBER"].to_i)
    gradle(task: "bundle", build_type: "Release")
    upload_to_play_store(track: "internal", aab: lane_context[SharedValues::GRADLE_AAB_OUTPUT_PATH])
  end
end
```

### Secrets Management

| Secret | Description |
|--------|-------------|
| `CERTIFICATE_P12` | iOS distribution certificate (base64) |
| `CERTIFICATE_PASSWORD` | Certificate password |
| `PROVISIONING_PROFILE` | iOS provisioning profile (base64) |
| `KEYSTORE_BASE64` | Android keystore (base64) |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Signing key alias |
| `KEY_PASSWORD` | Signing key password |
| `CAPGO_TOKEN` | Capgo API token |
| `APP_STORE_CONNECT_API_KEY` | App Store Connect API key |
| `PLAY_SERVICE_ACCOUNT` | Play Store service account JSON |

```bash
# Encoding secrets
base64 -i certificate.p12 | pbcopy
base64 -i profile.mobileprovision | pbcopy
base64 -i release.keystore | pbcopy
```

### Semantic Release

```bash
npm install -D semantic-release @semantic-release/git @semantic-release/changelog
```

```json
// .releaserc.json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    ["@semantic-release/npm", { "npmPublish": false }],
    ["@semantic-release/git", {
      "assets": ["package.json", "CHANGELOG.md"],
      "message": "chore(release): ${nextRelease.version}"
    }],
    "@semantic-release/github"
  ]
}
```

### Build Caching

```yaml
# Gradle cache
- uses: actions/cache@v4
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: gradle-${{ runner.os }}-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
    restore-keys: gradle-${{ runner.os }}-

# CocoaPods cache
- uses: actions/cache@v4
  with:
    path: ios/App/Pods
    key: pods-${{ runner.os }}-${{ hashFiles('ios/App/Podfile.lock') }}
    restore-keys: pods-${{ runner.os }}-
```

---

## 3. capacitor-mcp — AI-Assisted Development via MCP

### Key Procedures

- **awesome-ionic-mcp** provides AI access to Ionic component APIs, Capacitor plugin docs, and CLI commands.
- Requires ~160+ GitHub API calls at init — set `GITHUB_TOKEN` to avoid rate limits (60 req/hr → 5,000 req/hr).

### MCP Server Setup

```json
// claude_desktop_config.json / .cursor/mcp.json / cline_mcp_settings.json
{
  "mcpServers": {
    "awesome-ionic-mcp": {
      "command": "npx",
      "args": ["-y", "awesome-ionic-mcp@latest"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Purpose |
|------|---------|
| `get_ionic_component_definition({ tag: "ion-button" })` | TypeScript definitions from `@ionic/core` |
| `get_component_api({ tag: "ion-button" })` | API docs from ionicframework.com |
| `get_official_plugin_api({ plugin: "Camera" })` | Official Capacitor plugin docs |
| `get_all_capacitor_plugins()` | Superlist of all available plugins |
| `get_capgo_plugin_api({ plugin: "native-biometric" })` | CapGo plugin documentation |
| `ionic_info({ format: "json" })` | Comprehensive project info |
| `capacitor_doctor({ platform: "ios" })` | Diagnose Capacitor setup |
| `capacitor_sync({ platform: "ios" })` | Sync web assets and dependencies |
| `capacitor_build({ platform: "ios", scheme: "App", configuration: "Release" })` | Build native release |
| `capacitor_run({ platform: "ios", target: "iPhone 15 Pro" })` | Run on device/emulator |

---

## 4. capacitor-expert — Core Concepts, Plugins, Security & Troubleshooting

### Key Procedures

- **Three-layer architecture:** Web layer (HTML/CSS/JS in WebView) → Native bridge (serializes JS calls) → Native layer (Swift/Kotlin).
- **Data across the bridge must be JSON-serializable.** Pass files as paths, not base64.
- **Commit `android/` and `ios/` to version control** — they are full native projects.

### Capacitor Config (TypeScript)

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'My App',
  webDir: 'dist',
  server: {
    // androidScheme: 'https', // default in Cap 6+
  },
};

export default config;
```

### React-Specific Patterns

- **Create custom hooks** (`useCamera`, `useNetwork`) that wrap Capacitor plugins.
- **Use `useEffect`** for listener registration with cleanup to prevent memory leaks.
- **React 18 Strict Mode double-mounts** — ensure cleanup functions work correctly.

### Essential CLI Commands

| Command | Purpose |
|---------|---------|
| `npx cap init <name> <id>` | Initialize Capacitor |
| `npx cap add <platform>` | Add Android/iOS |
| `npx cap sync` | Copy web assets + update native dependencies |
| `npx cap copy` | Copy web assets only (faster) |
| `npx cap run <platform>` | Build, sync, and deploy to device/emulator |
| `npx cap run <platform> -l --external` | Run with live reload |
| `npx cap open <platform>` | Open native IDE (Xcode / Android Studio) |
| `npx cap build <platform>` | Build native project |
| `npx cap doctor` | Diagnose configuration issues |
| `npx cap migrate` | Automated upgrade to newer Capacitor version |

### Storage Recommendations

| Requirement | Solution |
|-------------|----------|
| App settings, preferences | `@capacitor/preferences` |
| Sensitive data (tokens) | `@capawesome-team/capacitor-secure-preferences` (Keychain/Keystore) |
| Relational data, offline-first | `@capawesome-team/capacitor-sqlite` or `@capacitor-community/sqlite` |
| Files, images, documents | `@capacitor/filesystem` |

> **Do NOT use `localStorage`, `IndexedDB`, or cookies** for persistent data — the OS can evict them (especially on iOS).

### Security Checklist

- Never embed secrets (API keys, OAuth secrets) in client code.
- Use secure storage for tokens, not `localStorage` or `@capacitor/preferences`.
- HTTPS only — never allow cleartext HTTP in production.
- Add CSP `<meta>` tag in `index.html`.
- Disable WebView debugging in production: `webContentsDebuggingEnabled: false`.
- Prefer Universal/App Links over custom URL schemes.
- iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) required for iOS 17+ with privacy-sensitive APIs.

### Upgrade Path

| Current → Target | Node.js | Xcode | Android Studio |
|------------------|---------|-------|----------------|
| to v5 | 16+ | 14.1+ | Flamingo 2022.2.1+ |
| to v6 | 18+ | 15.0+ | Hedgehog 2023.1.1+ |
| to v7 | 20+ | 16.0+ | Ladybug 2024.2.1+ |
| to v8 | 22+ | 26.0+ | Otter 2025.2.1+ |

```bash
npx cap migrate
npx cap sync
```

### Troubleshooting Quick Fixes

| Issue | Fix |
|-------|-----|
| `npx cap sync` fails | Verify `@capacitor/core` and `@capacitor/cli` versions match. Run `cd android && ./gradlew clean`. |
| iOS "no such module" | Run `npx cap sync ios`. For CocoaPods: `cd ios/App && pod install --repo-update`. |
| Plugin not found at runtime | Run `npx cap sync`. Verify Gradle sync completed. |
| White square notification icon | Push notification icons must be white pixels on transparent background. |
| Live reload not connecting | Ensure device and dev machine on same network. Use `--external` flag. |
| WebView not loading | Verify `webDir` in `capacitor.config.ts` matches actual build output directory. |

---

## 5. capacitor-best-practices — Project Structure, Performance & Deployment Checklist

### Key Procedures

- **Always sync after plugin install:** `npm install <plugin>` → `npx cap sync` → `cd ios/App && pod install`.
- **Use `capacitor.config.ts` (not `.json`)** for type safety and conditional logic.
- **Never commit development server URLs** to production config.

### Correct Config Pattern

```typescript
// capacitor.config.ts (CORRECT)
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.company.app',
  appName: 'My App',
  webDir: 'dist',
  server: {
    ...(process.env.NODE_ENV === 'development' && {
      url: 'http://localhost:5173',
      cleartext: true,
    }),
  },
  plugins: {
    SplashScreen: { launchAutoHide: false },
  },
};

export default config;
```

### Performance Optimization

- **Lazy-load plugins** with dynamic imports:
  ```typescript
  async function scanDocument() {
    const { DocumentScanner } = await import('@capgo/capacitor-document-scanner');
    return DocumentScanner.scanDocument();
  }
  ```
- **Batch bridge calls:**
  ```typescript
  // Single call with batch data
  await Storage.set({ key: 'userData', value: JSON.stringify({ name, email, preferences }) });
  ```
- **Use file paths, not base64** for binary data.
- **Image optimization:** `quality: 80`, set `width` limit, use `CameraResultType.Uri`.
- **AndroidManifest.xml:** Enable `hardwareAccelerated="true"` and `largeHeap="true"`.

### Error Handling Pattern

```typescript
import { Camera, CameraResultType } from '@capacitor/camera';

async function takePhoto() {
  try {
    const image = await Camera.getPhoto({ quality: 90, resultType: CameraResultType.Uri });
    return image;
  } catch (error) {
    if (error.message === 'User cancelled photos app') return null;
    if (error.message.includes('permission')) { showPermissionDialog(); return null; }
    console.error('Camera error:', error);
    throw error;
  }
}
```

### Live Updates (Capacitor Updater)

```typescript
import { CapacitorUpdater } from '@capgo/capacitor-updater';

CapacitorUpdater.notifyAppReady();

CapacitorUpdater.addListener('updateAvailable', async (update) => {
  const bundle = await CapacitorUpdater.download({ url: update.url, version: update.version });
  await CapacitorUpdater.set(bundle); // Apply on next app start
});
```

> **Correct strategy:** Background download, apply on restart. Do NOT force reload while user is active.

### Native Project Configuration

```groovy
// android/app/build.gradle
android {
    defaultConfig {
        minSdkVersion 22
        targetSdkVersion 34
    }
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Deployment Checklist

- [ ] Remove development server URLs from config
- [ ] Enable ProGuard for Android release builds
- [ ] Set appropriate iOS deployment target
- [ ] Test on real devices, not just simulators
- [ ] Verify all permissions are declared
- [ ] Test with poor network conditions
- [ ] Verify deep links work correctly
- [ ] Test app backgrounding/foregrounding
- [ ] Verify push notifications work
- [ ] Test biometric authentication edge cases

---

## 6. Example Marketplace Relevance Notes

**Example Marketplace Stack:** React 18 + Vite + Capacitor v6 + Base44 backend

### Testing Strategy for Example Marketplace

1. **Unit Tests (Vitest + jsdom):**
   - Mock `@capacitor/core` and all Capacitor plugins in `src/test/setup.ts`.
   - Use `mockPlatform('ios' | 'android' | 'web')` utility to test platform-specific behavior.
   - Co-locate `.test.tsx` files next to components and services.

2. **Component Tests (React Testing Library):**
   - Test UI components that depend on native plugins (e.g., geolocation check-in, camera uploads).
   - Mock plugin availability before rendering.

3. **E2E Tests (Playwright):**
   - Reuse existing Playwright setup at `e2e/`.
   - Add mobile viewport projects (`iPhone 14`, `Pixel 7`) to `playwright.config.ts`.
   - Base URL should match Vite dev server (`http://localhost:5173`).
   - Native E2E (Appium) is deferred until native builds are required.

4. **Mock Patterns Specific to Example Marketplace:**
   - Mock `@capacitor/geolocation` for location-based check-ins.
   - Mock `@capacitor/camera` for photo upload flows.
   - Mock `@capacitor/preferences` for auth token storage.
   - Mock `@capacitor/push-notifications` for notification journeys.

### CI/CD Pipeline for Example Marketplace

- **Base44 frontend deploy** is already automated via git push to `main`.
- **Capacitor builds should be additive:**
  1. `npm run build` (Vite → `dist/`)
  2. `npx cap sync` (copy to `ios/` / `android/`)
  3. Run native builds in GitHub Actions (macOS for iOS, Ubuntu for Android).
- **Artifact flow:** `build-web` → `build-ios` / `build-android` → `deploy-ios` / `deploy-android`.
- **Secrets needed:** iOS certificates, Android keystore, App Store Connect API key, Play Store service account.
- **Caching:** Gradle + CocoaPods caches to speed up native builds.

### React 18 + Capacitor v6 Specifics

- **Web asset directory:** `dist` (Vite default) — ensure `capacitor.config.ts` sets `webDir: 'dist'`.
- **React Strict Mode:** Double-mounts in development — ensure all Capacitor plugin listeners have proper cleanup in `useEffect`.
- **Custom hooks:** Create `useGeolocation()`, `useCamera()`, `useNotifications()` wrappers for Capacitor plugins to keep components testable.
- **Node.js:** Capacitor v6 requires Node 18+. Ensure CI runners use Node 20.
- **Xcode:** 15.0+ required for Capacitor v6 iOS builds.
- **Android Studio:** Hedgehog 2023.1.1+ required.

### Security Considerations for Example Marketplace

- Example Marketplace handles user location data and business credentials — use `@capawesome-team/capacitor-secure-preferences` for tokens.
- Never store Base44 API keys or Dodo/webhook secrets in client code.
- Disable `webContentsDebuggingEnabled` in production.
- Add iOS Privacy Manifest if using location, camera, or push notifications.

### Migration Path

- Example Marketplace is on Capacitor v6. Next upgrade target is v7 (Node 20+, Xcode 16.0+, Ladybug).
- Always use `npx cap migrate` — do not skip major versions.

---

## 7. Cross-References

### Within Example Marketplace Repository

- `AGENTS.md` — Base44 deployment rules and app details.
- `e2e/` — Existing Playwright E2E test suite.
- `src/` — React 18 + Vite web app source.
- `docs/specs/` — Feature specs for journey mapping and acceptance criteria.

### External Resources

| Resource | URL |
|----------|-----|
| Capacitor Documentation | https://capacitorjs.com/docs |
| Capacitor CLI Reference | https://capacitorjs.com/docs/cli |
| Capgo Documentation | https://capgo.app/docs |
| Capawesome Cloud | https://cloud.capawesome.io |
| Ionic Framework | https://ionicframework.com/docs |
| Vitest | https://vitest.dev |
| Playwright | https://playwright.dev |
| Appium | https://appium.io |
| Fastlane | https://fastlane.tools |
| awesome-ionic-mcp | https://github.com/Tommertom/awesome-ionic-mcp |
| MCP Specification | https://modelcontextprotocol.io |

### Related Capacitor Skills (Not Included)

- `capacitor-app-creation` — Guided new-app scaffolding.
- `capacitor-app-development` — General development topics.
- `capacitor-react` — React-specific Capacitor patterns.
- `capacitor-plugins` — 160+ plugin index and setup guides.
- `capacitor-plugin-development` — Creating custom plugins.
- `capacitor-app-upgrades` — Major version upgrade guides.
- `capacitor-push-notifications` — FCM push setup.
- `capacitor-in-app-purchases` — RevenueCat / Capawesome purchases.
- `capawesome-cloud` — Live updates, native builds, app store publishing.
- `capawesome-cli` — Capawesome CLI reference.
