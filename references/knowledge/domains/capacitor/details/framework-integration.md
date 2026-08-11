# Framework Integration: React + Vite + Capacitor

Extracted from: `capacitor-react` (Capawesome), `framework-to-capacitor` (Capgo)

---

## React + Vite + Capacitor Setup

### Step 1: Create Vite Project

```bash
npx create-vite@latest my-app --template react-ts
cd my-app
npm install
```

### Step 2: Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
```

**When prompted:**
- **App name**: Your app name
- **App ID**: `com.company.app`
- **Web directory**: `dist` (Vite default output)

### Step 3: Configure vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
```

### Step 4: Configure capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.company.app',
  appName: 'My App',
  webDir: 'dist',
};

export default config;
```

### Step 5: Add Platforms and Build

```bash
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npm run build
npx cap sync
```

---

## React Router for Mobile

**Use HashRouter for Capacitor apps** (history mode requires server fallback):

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

---

## Using Capacitor Plugins in React

```tsx
import { useState, useEffect } from 'react';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

function PhotoCapture() {
  const [photo, setPhoto] = useState<string | null>(null);

  const takePhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert('Camera only available on mobile devices');
      return;
    }

    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Uri,
    });

    setPhoto(image.webPath || null);
  };

  return (
    <div>
      <button onClick={takePhoto}>Take Photo</button>
      {photo && <img src={photo} alt="Captured" />}
    </div>
  );
}
```

---

## Custom Hooks for Native Features

```typescript
// hooks/usePlatform.ts
import { Capacitor } from '@capacitor/core';

export function usePlatform() {
  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    isIOS: Capacitor.getPlatform() === 'ios',
    isAndroid: Capacitor.getPlatform() === 'android',
    isWeb: Capacitor.getPlatform() === 'web',
  };
}

// hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    Network.getStatus().then((status) => setConnected(status.connected));

    const listener = Network.addListener('networkStatusChange', (status) => {
      setConnected(status.connected);
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return connected;
}
```

---

## Environment Variables

Vite uses `VITE_` prefix for env variables exposed to client:

```bash
# .env
VITE_API_URL=https://api.example.com
VITE_APP_NAME=MyApp
```

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

**Note:** Build-time variables only. For runtime config, use `@capacitor/preferences` or a config file fetched at startup.

---

## Build Scripts for React + Vite + Capacitor

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:mobile": "vite build && cap sync",
    "preview": "vite preview",
    "ios": "cap run ios",
    "android": "cap run android",
    "sync": "cap sync",
    "open:ios": "cap open ios",
    "open:android": "cap open android"
  }
}
```

---

## Live Reload During Development

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  // ... other config
  server: {
    url: 'http://192.168.1.100:5173', // Your dev machine IP
    cleartext: true,
  },
};
```

**iOS**: Requires `NSAppTransportSecurity` > `NSAllowsArbitraryLoads` in debug builds.

---

## Common Issues and Solutions

### Issue: Blank Screen on Mobile
**Cause**: Incorrect `webDir` or build output.
**Solution**:
1. Check `webDir` in capacitor.config.ts matches Vite's `outDir`
2. Rebuild: `npm run build`
3. Sync: `npx cap sync`

### Issue: Routing Doesn't Work
**Cause**: Using BrowserRouter (history mode) without server.
**Solution**: Switch to `HashRouter`.

### Issue: Environment Variables Not Working
**Cause**: Missing `VITE_` prefix.
**Solution**: Use `VITE_` prefix for all client-exposed variables.

### Issue: API Calls Fail on Device
**Cause**: CORS or localhost URLs.
**Solution**:
1. Use production API URLs
2. Configure CORS on backend
3. Use `CapacitorHttp` for native requests:

```typescript
import { CapacitorHttp } from '@capacitor/core';

const response = await CapacitorHttp.get({
  url: 'https://api.example.com/data',
});
```

---

## Example Marketplace Relevance

- **Current stack**: React 18 + Vite + Base44 SDK + Capacitor v6
- **Router**: React Router DOM with hash mode recommended
- **State**: Base44 SDK handles most state; local state via React hooks
- **Build**: Vite outputs to `dist/`, Capacitor syncs from there
- **Auth**: Base44 auth + OAuth callbacks via deep linking
