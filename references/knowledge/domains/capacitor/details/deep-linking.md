# Deep Linking — Capacitor App Plugin

## Mechanism

Capacitor deep linking uses the `@capacitor/app` plugin to listen for `appUrlOpen` events fired when the app is opened via a URL. Three link types are supported:

| Type | Platform | Format | Requires Server |
|------|----------|--------|-----------------|
| Custom URL Scheme | Both | `myapp://path` | No |
| Universal Links | iOS | `https://myapp.com/path` | Yes |
| App Links | Android | `https://myapp.com/path` | Yes |

For cold starts (app not running), use `App.getLaunchUrl()` to retrieve the URL that launched the app.

## Procedures

### Install Plugin

```bash
npm install @capacitor/app
npx cap sync
```

### Basic Handler

```typescript
import { App } from '@capacitor/app';

App.addListener('appUrlOpen', (event) => {
  console.log('App opened with URL:', event.url);
  const url = new URL(event.url);
  handleDeepLink(url);
});

function handleDeepLink(url: URL) {
  const path = url.pathname || url.host + url.pathname;

  if (path.startsWith('/product/')) {
    const productId = path.split('/')[2];
    navigateTo(`/product/${productId}`);
  } else if (path.startsWith('/user/')) {
    const userId = path.split('/')[2];
    navigateTo(`/profile/${userId}`);
  } else if (path === '/login') {
    navigateTo('/login');
  } else {
    navigateTo('/');
  }
}
```

### React Router Integration

```typescript
import { App } from '@capacitor/app';
import { useHistory } from 'react-router-dom';
import { useEffect } from 'react';

function DeepLinkHandler() {
  const history = useHistory();

  useEffect(() => {
    // Warm start listener
    App.addListener('appUrlOpen', (event) => {
      const url = new URL(event.url);
      const path = getPathFromUrl(url);
      history.push(path);
    });

    // Cold start check
    App.getLaunchUrl().then((result) => {
      if (result?.url) {
        const url = new URL(result.url);
        const path = getPathFromUrl(url);
        history.push(path);
      }
    });
  }, []);

  return null;
}

function getPathFromUrl(url: URL): string {
  if (url.protocol === 'myapp:') {
    return '/' + url.host + url.pathname;
  }
  return url.pathname + url.search;
}
```

### OAuth Callback Handling

```typescript
App.addListener('appUrlOpen', async (event) => {
  const url = new URL(event.url);

  if (url.pathname === '/oauth/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      handleOAuthError(error);
      return;
    }

    if (code && validateState(state)) {
      await exchangeCodeForToken(code);
      navigateTo('/home');
    }
  }
});
```

### iOS Custom URL Scheme

```xml
<!-- ios/App/App/Info.plist -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.yourcompany.yourapp</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>myapp</string>
            <string>myapp-dev</string>
        </array>
    </dict>
</array>
```

### Android Custom URL Scheme

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity android:name=".MainActivity">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="myapp" />
    </intent-filter>
</activity>
```

### iOS Universal Links

1. Enable Associated Domains in Xcode:
   - Select App target → Signing & Capabilities → + Capability → Associated Domains
   - Add: `applinks:myapp.com`

2. Host `apple-app-site-association` at `https://myapp.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.yourcompany.yourapp",
        "paths": ["/product/*", "/user/*", "/invite/*", "NOT /api/*"]
      }
    ]
  }
}
```

Requirements: HTTPS, Content-Type `application/json`, no redirects, file at root domain.

3. Verify:

```bash
curl -I https://myapp.com/.well-known/apple-app-site-association
curl "https://app-site-association.cdn-apple.com/a/v1/myapp.com"
```

### Android App Links

1. Host `assetlinks.json` at `https://myapp.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.yourapp",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

2. Get SHA256 fingerprint:

```bash
# Debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Release keystore
keytool -list -v -keystore release.keystore -alias your-alias

# From APK
keytool -printcert -jarfile app-release.apk
```

3. Add intent filter to `AndroidManifest.xml`:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" />
    <data android:host="myapp.com" />
    <data android:pathPrefix="/product" />
    <data android:pathPrefix="/user" />
    <data android:pathPrefix="/invite" />
</intent-filter>
```

4. Verify on device:

```bash
adb shell pm get-app-links com.yourcompany.yourapp
```

### Test Commands

```bash
# iOS Simulator — custom scheme
xcrun simctl openurl booted "myapp://product/123"

# Android — custom scheme
adb shell am start -a android.intent.action.VIEW -d "myapp://product/123"

# iOS — check associated domains entitlement
codesign -d --entitlements - App.app | grep associated-domains

# iOS — reset Universal Links cache
xcrun simctl erase all

# Android — check verified links
adb shell dumpsys package d | grep -A5 "Package: com.yourcompany.yourapp"
```

## Error Handling

| Issue | Solution |
|-------|----------|
| Universal Links not working | Check AASA file, SSL, entitlements |
| App Links not verified | Check assetlinks.json, fingerprint |
| Links open in browser | Check intent-filter, autoVerify |
| Cold start not handled | Use `App.getLaunchUrl()` |
| Simulator issues | Reset simulator, rebuild app |

## Example Marketplace Relevance

Example Marketplace uses React Router for SPA navigation. The `DeepLinkHandler` pattern above should be mounted at app root so that shared challenge links (e.g., `https://example-marketplace.app/challenge/123`) or invite links open directly to the correct screen inside the Capacitor wrapper. OAuth callbacks (Base44 auth) must use the `appUrlOpen` listener to capture the `code` parameter and complete the token exchange without leaving the app.
