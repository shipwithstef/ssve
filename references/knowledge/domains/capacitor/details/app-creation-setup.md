# Capacitor App Creation & Setup

**Group:** Capacitor Mobile App Creation
**Sources:** 4 skills (capawesome-team × 3, capgo × 1)
**Extracted:** 2026-04-26

---

## 1. capacitor-app-creation (capawesome)

Guides scaffolding a new Capacitor app from scratch.

### Prerequisites
- **Node.js 22+** (`node --version`)
- **iOS:** macOS with Xcode 26.0+; `xcode-select --install`
- **Android:** Android Studio 2025.2.1+ with Android SDK (API 24+)

### Key Procedures

#### Scaffold Web App (React path)
```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
```
- Default web asset directory for Vite React: `dist`

#### Install & Initialize Capacitor
```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init <appName> <appID> --web-dir <webDir>
```
- Creates `capacitor.config.ts` in project root
- `<appID>`: reverse-domain format (e.g. `com.example-marketplace.app`)
- `<webDir>`: build output directory (`dist`, `www`, `build`, etc.)

#### Build Web Assets
```bash
npm run build   # Vite/React
```

#### Add Native Platforms
```bash
# Android
npm install @capacitor/android
npx cap add android

# iOS
npm install @capacitor/ios
npx cap add ios
```
- Capacitor 8 uses **Swift Package Manager (SPM)** for iOS by default

#### Sync & Run
```bash
npx cap sync                    # copy web assets + install native deps
npx cap run android             # run on Android device/emulator
npx cap run ios                 # run on iOS simulator/device
```

### Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| `npx cap init` "already initialized" | Config file exists | Delete `capacitor.config.ts/json` if re-init intended |
| `npx cap add` "platform already exists" | `android/` or `ios/` exists | `rm -rf android ios` then re-add |
| `npx cap sync` "could not find web assets" | `webDir` missing / not built | Run `npm run build` first |
| iOS "no such module" | SPM deps not resolved | `npx cap sync ios` |
| Android SDK errors | `ANDROID_HOME` not set | Verify env var + install missing SDKs |
| `index.html` missing `<head>` | Required for plugin injection | Ensure `<head>` tag present in build output |

---

## 2. capacitor-app-development (capawesome)

General development guidance for existing Capacitor apps.

### Prerequisites
- Capacitor 6, 7, or 8 already initialized
- Node version mapping: Cap 6 → Node 18+, Cap 7 → Node 20+, Cap 8 → Node 22+

### Auto-Detection Checklist
Before giving guidance, detect:
1. Capacitor version from `@capacitor/core` in `package.json`
2. Platforms present (`android/`, `ios/`)
3. Framework from config files (`vite.config.ts`, `angular.json`, etc.)
4. Config format (`capacitor.config.ts` vs `.json`)
5. iOS dependency manager (`ios/App/Podfile` = CocoaPods; absent = SPM)

### Topic Index
| Topic | Reference File |
|-------|---------------|
| Core concepts (native bridge) | `references/core-concepts.md` |
| Platforms (Android, iOS, Electron, PWA) | `references/platforms.md` |
| CLI commands | `references/cli.md` |
| App configuration | `references/app-configuration.md` |
| Splash screens & app icons | `references/splash-screens-and-icons.md` |
| Deep links / universal links | `references/deep-links.md` |
| Android edge-to-edge | `references/edge-to-edge.md` |
| Android safe area | `references/safe-area.md` |
| Live reload setup | `references/live-reload.md` |
| Storage solutions | `references/storage.md` |
| File handling | `references/file-handling.md` |
| Security best practices | `references/security.md` |
| iOS package managers (SPM, CocoaPods) | `references/ios-package-managers.md` |
| CI/CD | `references/ci-cd.md` |
| Testing (unit & E2E) | `references/testing.md` |
| Cross-platform best practices | `references/cross-platform-best-practices.md` |
| Android troubleshooting | `references/troubleshooting-android.md` |
| iOS troubleshooting | `references/troubleshooting-ios.md` |

### Common Fixes
- **`npx cap sync` fails**: Ensure `@capacitor/core` and `@capacitor/cli` versions match. For CocoaPods iOS: `cd ios/App && pod install`
- **Android build fails after config changes**: `cd android && ./gradlew clean`
- **iOS build fails after config changes**: Xcode → Product > Clean Build Folder, or delete `ios/App/Pods` and re-run `pod install`
- **Plugin not found at runtime**: Run `npx cap sync` after every plugin install
- **Live reload not connecting**: Dev machine and device must be on same LAN; verify `server.url` uses correct LAN IP

---

## 3. capacitor-react (capawesome)

React-specific patterns for Capacitor apps.

### Prerequisites
- Capacitor 6, 7, or 8 with React
- **React 18 or later**
- Vite, Next.js, or CRA detected from config files

### Recommended Project Structure
```
project-root/
├── android/
├── ios/
├── public/
├── src/
│   ├── components/
│   ├── hooks/           # custom hooks wrapping native plugins
│   ├── pages/
│   ├── services/        # Capacitor plugin call modules
│   ├── App.tsx
│   └── main.tsx
├── capacitor.config.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Plugin Usage Patterns in React
1. **Import plugins directly** as ES modules
2. **Call in event handlers or effects** — never at module top level
3. **Use `useEffect` for listeners** — register & clean up Capacitor event listeners
4. **Check platform first** — guard with `Capacitor.isNativePlatform()` or `Capacitor.getPlatform()`

### Platform Hook
```typescript
import { Capacitor } from '@capacitor/core';

export const usePlatform = () => ({
  platform: Capacitor.getPlatform(),      // 'ios' | 'android' | 'web'
  isNative: Capacitor.isNativePlatform(),
  isIOS:    Capacitor.getPlatform() === 'ios',
  isAndroid: Capacitor.getPlatform() === 'android',
  isWeb:    Capacitor.getPlatform() === 'web',
});
```

### Deep Links with React Router
```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, URLOpenListenerEvent } from '@capacitor/app';

const useDeepLinks = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const listener = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      const path = new URL(event.url).pathname;
      navigate(path);
    });
    return () => { listener.then(h => h.remove()); };
  }, [navigate]);
};
```

### Android Back Button
```typescript
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';

const useBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const listener = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) navigate(-1); else App.exitApp();
    });
    return () => { listener.then(h => h.remove()); };
  }, [navigate, location]);
};
```

### App Lifecycle Hook
```typescript
import { useEffect } from 'react';
import { App } from '@capacitor/app';

const useAppState = (onResume?: () => void, onPause?: () => void) => {
  useEffect(() => {
    const r = App.addListener('resume', () => onResume?.());
    const p = App.addListener('pause',  () => onPause?.());
    return () => {
      r.then(h => h.remove());
      p.then(h => h.remove());
    };
  }, [onResume, onPause]);
};
```

### Build & Run Commands
```bash
npm run build
npx cap sync
npx cap run android
npx cap run ios
```

### Live Reload Development
```bash
npx cap run android --livereload --external
npx cap run ios     --livereload --external
```
- `--external`: makes dev server reachable from device/emulator
- `--livereload`: auto-reloads on source changes

### React-Specific Error Handling
| Error | Fix |
|-------|-----|
| Plugin not found at runtime | Run `npx cap sync` after install; verify in `package.json` |
| `Capacitor is not defined` | `npm install @capacitor/core` |
| Native method fails on web | Guard with `Capacitor.isNativePlatform()` |
| Event listener memory leak | Always remove listener in `useEffect` cleanup |
| Stale closure in listener | Use `useRef` for latest values, or include state in `useEffect` deps |
| Live reload not connecting | Same network, use `--external`, check firewall on dev port |
| Build works on web, fails native | Replace browser-only APIs (`window.localStorage`, `navigator.geolocation`) with Capacitor plugins (`@capacitor/preferences`, `@capacitor/geolocation`) |
| React Strict Mode double-mount | Ensure cleanup functions properly remove listeners — double-mount validates this |

---

## 4. framework-to-capacitor (capgo)

Framework integration guide covering static export, routing, and build optimization.

### Critical Rule
Capacitor requires **static HTML/CSS/JS files**. SSR does not work in native apps.

### Framework Support Matrix
| Framework | Static Export | SSR | Recommended Approach |
|-----------|--------------|-----|---------------------|
| Next.js | ✅ | ❌ | `output: 'export'` |
| React | ✅ | N/A | Vite (recommended) or CRA |
| Vue | ✅ | ❌ | Vite or Vue CLI |
| Angular | ✅ | ❌ | Angular CLI |
| Svelte | ✅ | ❌ | SvelteKit adapter-static |
| Remix | ✅ | ❌ | SPA mode |
| Solid | ✅ | ❌ | Vite |
| Qwik | ✅ | ❌ | Static site mode |

### React + Capacitor (Vite — Recommended)

**Scaffold:**
```bash
npx create-vite@latest my-app --template react-ts
cd my-app
npm install
npm install @capacitor/core @capacitor/cli
npx cap init
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
});
```

**capacitor.config.ts:**
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example-marketplace.app',
  appName: 'Example Marketplace',
  webDir: 'dist',
};

export default config;
```

**Add platforms & build:**
```bash
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npm run build
npx cap sync
```

### Routing: Hash Mode (Recommended for Mobile)

**React (react-router-dom):**
```tsx
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}
```

- **Hash mode**: works without server config, URLs like `#/about`
- **History mode**: clean URLs but requires server fallback; can have issues on mobile

### Common Cross-Framework Patterns

**Environment Detection:**
```typescript
import { Capacitor } from '@capacitor/core';
const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
```

**Deep Linking:**
```typescript
import { App } from '@capacitor/app';
App.addListener('appUrlOpen', (data) => {
  const slug = data.url.split('.app').pop();
  // navigate to route
});
```

**Storage (Preferences):**
```typescript
import { Preferences } from '@capacitor/preferences';
await Preferences.set({ key: 'theme', value: 'dark' });
const { value } = await Preferences.get({ key: 'theme' });
await Preferences.remove({ key: 'theme' });
```

**Camera:**
```typescript
import { Camera, CameraResultType } from '@capacitor/camera';
const photo = await Camera.getPhoto({
  quality: 90, allowEditing: true, resultType: CameraResultType.Uri,
});
const imageUrl = photo.webPath;
```

**HTTP (native requests bypass CORS):**
```typescript
import { CapacitorHttp } from '@capacitor/core';
const response = await CapacitorHttp.get({ url: 'https://api.example.com/data' });
```

### Recommended package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:mobile": "vite build && cap sync",
    "ios": "cap run ios",
    "android": "cap run android",
    "sync": "cap sync"
  }
}
```

### Deployment Checklist
- [ ] Configure static export
- [ ] Set correct `webDir` in `capacitor.config.ts`
- [ ] Use hash routing for mobile
- [ ] Disable image optimization (Next.js: `unoptimized: true`)
- [ ] Remove SSR/API route dependencies
- [ ] Add native permissions (`Info.plist`, `AndroidManifest.xml`)
- [ ] Test on physical devices
- [ ] Configure splash screen and icons
- [ ] Set up live updates (optional — Capgo or Capawesome Cloud)
- [ ] Build and test on iOS and Android

---

## Example Marketplace Relevance Notes

**Target stack: React 18 + Vite + Capacitor v6**

### Why This Stack for Example Marketplace
- Example Marketplace is already a React 18 SPA built with Vite (`dist/` output, `index.html` entry)
- Capacitor wraps the existing web app as a native mobile app with minimal changes
- No need to adopt Ionic Framework — Example Marketplace has its own UI/component layer
- Vite's `dist/` output maps directly to Capacitor's `webDir`

### Conversion Path (Existing → Mobile)
1. **Install Capacitor deps** in the existing Example Marketplace project root:
   ```bash
   npm install @capacitor/core @capacitor/ios @capacitor/android
   npm install -D @capacitor/cli
   ```
2. **Initialize** with reverse-domain ID:
   ```bash
   npx cap init "Example Marketplace" com.example-marketplace.app --web-dir dist
   ```
3. **Ensure `index.html` has `<head>`** — Vite projects do by default
4. **Build and sync:**
   ```bash
   npm run build
   npx cap sync
   ```
5. **Switch to hash routing** if Example Marketplace uses `BrowserRouter` — replace with `HashRouter`
6. **Replace web-only APIs** with Capacitor plugins:
   - `localStorage` → `@capacitor/preferences`
   - `navigator.geolocation` → `@capacitor/geolocation`
   - `fetch` for API calls → `CapacitorHttp` (avoids CORS on device)

### Version Compatibility
- Capacitor v6 requires **Node 18+** — verify Example Marketplace build environment
- If Example Marketplace is on Node 22+ already, Capacitor v7 or v8 could be used instead
- React 18 is fully supported; no React version changes needed

### Native Features Example Marketplace Likely Needs
| Web API | Capacitor Plugin | Use Case |
|---------|-----------------|----------|
| `navigator.geolocation` | `@capacitor/geolocation` | Cafe location check-in |
| `localStorage` | `@capacitor/preferences` | Auth token, user settings |
| Camera / file upload | `@capacitor/camera` | Profile photo, receipt upload |
| Push notifications | `@capacitor/push-notifications` | Session reminders, rewards |
| Network status | `@capacitor/network` | Offline detection |
| App state | `@capacitor/app` | Deep links, back button, lifecycle |

### Live Reload for Development
```bash
npx cap run android --livereload --external
npx cap run ios     --livereload --external
```

---

## Cross-References

### Internal (Example Marketplace)
- `docs/specs/vision.md` — product vision including mobile app goals
- `src/App.jsx` — root component; routing switch point for `HashRouter`
- `src/hooks/` — create `usePlatform`, `useAppState`, `useDeepLinks` here
- `src/services/` — Capacitor plugin wrappers (e.g. `nativeStorage.js`)

### External Skills
- **`capacitor-app-creation`** (capawesome) — full scaffolding walkthrough
- **`capacitor-app-development`** (capawesome) — config, security, CI/CD, troubleshooting
- **`capacitor-react`** (capawesome) — React hooks, lifecycle, platform checks
- **`framework-to-capacitor`** (capgo) — framework matrix, static export, build scripts
- **`capacitor-plugins`** — install and configure official/community plugins
- **`capacitor-plugin-development`** — create custom plugins
- **`capacitor-app-upgrades`** — upgrade Capacitor major versions
- **`capawesome-cloud`** — live updates, cloud builds, app store publishing
- **`capgo`** — live updates via Capgo (`@capgo/capacitor-updater`)

### Official Documentation
- Capacitor Docs: https://capacitorjs.com/docs
- Capacitor CLI: https://capacitorjs.com/docs/cli
- Capacitor v6 → v7 → v8 migration guides: https://capacitorjs.com/docs/updating
