# Capacitor Architecture Overview

Extracted from: `capacitor-expert` (Capawesome), `capacitor-best-practices` (Capgo)

---

## Core Concepts

Capacitor is a cross-platform native runtime for web apps. It provides:

- **Native Bridge**: JavaScript-to-native communication layer
- **Web Layer**: Standard web app (HTML/CSS/JS) running in a WebView
- **Plugins**: Native functionality exposed through typed TypeScript APIs
- **Platform Management**: First-class Xcode (iOS) and Android Studio (Android) projects

### Architecture Diagram

```
┌─────────────────────────────────────────┐
│              UI Layer                    │
│         (React / Vue / Angular)          │
├─────────────────────────────────────────┤
│           Web Layer                      │
│      (HTML / CSS / JS / Web APIs)        │
├─────────────────────────────────────────┤
│         Capacitor Bridge                 │
│    (JavaScript <-> Native communication) │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐   │
│  │   iOS       │  │    Android      │   │
│  │  (WebKit)   │  │   (WebView)     │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Project Structure

```
my-capacitor-app/
├── src/                    # Web app source
├── dist/                   # Build output (webDir)
├── ios/                    # iOS Xcode project
│   └── App/
│       ├── App/
│       ├── App.xcodeproj
│       └── Podfile
├── android/                # Android Studio project
│   └── app/
│       ├── src/main/
│       └── build.gradle
├── capacitor.config.ts     # Capacitor configuration
├── package.json
└── vite.config.ts          # Build config
```

---

## Capacitor CLI Commands

| Command | Purpose |
|---------|---------|
| `npx cap init` | Initialize Capacitor in a project |
| `npx cap add ios` | Add iOS platform |
| `npx cap add android` | Add Android platform |
| `npx cap sync` | Sync web assets + install native dependencies |
| `npx cap copy` | Copy web assets only |
| `npx cap update` | Update native dependencies |
| `npx cap open ios` | Open iOS project in Xcode |
| `npx cap open android` | Open Android project in Android Studio |
| `npx cap run ios` | Build and run on iOS device/simulator |
| `npx cap run android` | Build and run on Android device/emulator |
| `npx cap doctor` | Check project health |

---

## Platform Detection

```typescript
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform(); // true on iOS/Android
const platform = Capacitor.getPlatform();        // 'ios', 'android', or 'web'
const isIOS = Capacitor.getPlatform() === 'ios';
const isAndroid = Capacitor.getPlatform() === 'android';
```

---

## App Configuration (capacitor.config.ts)

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.company.app',
  appName: 'My App',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
    },
  },
};

export default config;
```

---

## Storage Solutions

| Use Case | Plugin | Method |
|----------|--------|--------|
| Key-value pairs | `@capacitor/preferences` | `Preferences.get/set` |
| Files | `@capacitor/filesystem` | `Filesystem.readFile/writeFile` |
| SQLite | `@capgo/capacitor-fast-sql` | `FastSQL.query/run` |
| Encrypted storage | `@capgo/capacitor-fast-sql` (encrypted mode) | `KeyValueStore.open({ encrypted: true })` |

---

## Security Best Practices

1. **Never hardcode secrets** in web assets (visible in bundle)
2. **Use HTTPS** for all API calls (`androidScheme: 'https'`)
3. **Run `npx capsec scan`** before release (63+ rules)
4. **Add usage descriptions** in Info.plist for every permission
5. **Validate inputs** on both client and server
6. **Use Capacitor HTTP** for native CORS bypass when needed

---

## Example Marketplace Relevance

- **Current stack**: React 18 + Vite + Capacitor v6
- **Current plugins**: `@capacitor/browser`, `@capacitor/status-bar`
- **Config location**: `capacitor.config.ts` at project root
- **Build output**: `dist/` (matches Vite default)
- **Platform targets**: iOS 14+, Android API 22+ (Capacitor v6 defaults)
