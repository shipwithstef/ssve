# Debugging Capacitor Applications

## Mechanism

Capacitor apps consist of a WebView layer (JavaScript/React) and a native layer (Swift/Obj-C on iOS, Kotlin/Java on Android). Debugging requires tools for both layers plus the bridge between them.

| Platform | WebView Debug | Native Debug | Logs |
|----------|--------------|--------------|------|
| iOS | Safari Web Inspector | Xcode Debugger | Console.app |
| Android | Chrome DevTools | Android Studio | adb logcat |

## Procedures

### WebView Debugging

**iOS: Safari Web Inspector**

1. Enable on device:
   - Settings > Safari > Advanced > Web Inspector: ON
   - Settings > Safari > Advanced > JavaScript: ON

2. Enable in `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  ios: {
    webContentsDebuggingEnabled: true, // Required for iOS 16.4+
  },
};
```

3. Connect Safari:
   - Open Safari on Mac
   - Develop menu > [Device Name] > [App Name]
   - If no Develop menu: Safari > Settings > Advanced > Show Develop menu

4. Debug panels:
   - Console: View JavaScript logs
   - Network: Inspect API calls
   - Elements: Inspect DOM
   - Sources: Set breakpoints

**Android: Chrome DevTools**

1. Enable in `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  android: {
    webContentsDebuggingEnabled: true,
  },
};
```

2. Connect Chrome:
   - Open Chrome on computer
   - Navigate to `chrome://inspect`
   - Your device/emulator should appear
   - Click "inspect" under your app

3. Debug panels:
   - Console: JavaScript logs
   - Network: API requests
   - Performance: Profiling
   - Application: Storage, cookies

**Remote Debugging with VS Code**

Install "Debugger for Chrome" extension, then add `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "attach",
      "name": "Attach to Android WebView",
      "port": 9222,
      "webRoot": "${workspaceFolder}/dist"
    }
  ]
}
```

### Native Debugging

**iOS: Xcode Debugger**

```bash
# Open in Xcode
npx cap open ios
```

1. Set breakpoints: click line number in Swift/Obj-C files, or use LLDB:
   ```lldb
   breakpoint set --name methodName
   ```

2. Run with debugger: Product > Run (Cmd + R)

3. LLDB Console commands:

```lldb
# Print variable
po myVariable

# Print object description
p myObject

# Continue execution
continue

# Step over
next

# Step into
step

# Print backtrace
bt
```

4. View crash logs: Window > Devices and Simulators > Select device > View Device Logs

**Android: Android Studio Debugger**

```bash
# Open in Android Studio
npx cap open android
```

1. Attach debugger: Run > Attach Debugger to Android Process > Select your app
2. Set breakpoints: click line number in Java/Kotlin files
3. Debug console expressions:
   ```
   myVariable
   myObject.toString()
   ```
4. Logcat: View > Tool Windows > Logcat, filter by `package:com.yourapp`

### Console Logging

**JavaScript Side**

```typescript
// Basic logging
console.log('Debug info:', data);
console.warn('Warning:', issue);
console.error('Error:', error);

// Grouped logs
console.group('API Call');
console.log('URL:', url);
console.log('Response:', response);
console.groupEnd();

// Table format
console.table(arrayOfObjects);

// Timing
console.time('operation');
// ... operation
console.timeEnd('operation');
```

**Native Side (iOS)**

```swift
import os.log

let logger = Logger(subsystem: "com.yourapp", category: "MyPlugin")

logger.debug("Debug message")
logger.info("Info message")
logger.warning("Warning message")
logger.error("Error message")
logger.info("User ID: \(userId)")

// Legacy NSLog (shows in Console.app)
NSLog("Legacy log: %@", message)
```

**Native Side (Android)**

```kotlin
import android.util.Log

Log.v("MyPlugin", "Verbose message")
Log.d("MyPlugin", "Debug message")
Log.i("MyPlugin", "Info message")
Log.w("MyPlugin", "Warning message")
Log.e("MyPlugin", "Error message")

// With exception
Log.e("MyPlugin", "Error occurred", exception)
```

### Performance Debugging

**JavaScript Performance**

```typescript
performance.mark('start');
// ... operation
performance.mark('end');
performance.measure('operation', 'start', 'end');

const measures = performance.getEntriesByName('operation');
console.log('Duration:', measures[0].duration);
```

**iOS Performance (Instruments)**

1. Product > Profile (Cmd + I)
2. Choose template:
   - Time Profiler: CPU usage
   - Allocations: Memory usage
   - Network: Network activity

**Android Performance (Profiler)**

1. View > Tool Windows > Profiler
2. Select:
   - CPU: Method tracing
   - Memory: Heap analysis
   - Network: Request timeline

### Memory Debugging

**JavaScript Memory Leaks (Chrome DevTools)**

1. Take heap snapshot
2. Perform action
3. Take another snapshot
4. Compare snapshots

**iOS Memory (Instruments)**

```bash
xcrun instruments -t Leaks -D output.trace YourApp.app
```

**Android Memory (LeakCanary)**

Add to `build.gradle`:
```groovy
debugImplementation 'com.squareup.leakcanary:leakcanary-android:2.12'
```

## Error Handling

### App Crashes on Startup

**Diagnosis:**
```bash
# iOS
xcrun simctl spawn booted log stream --level debug | grep -i crash

# Android
adb logcat *:E | grep -i "fatal\|crash"
```

**Common causes:**
1. Missing plugin registration
2. Invalid capacitor.config
3. Missing native dependencies

**Solution checklist:**
- [ ] Run `npx cap sync`
- [ ] iOS: `cd ios/App && pod install`
- [ ] Check Info.plist permissions
- [ ] Check AndroidManifest.xml permissions

### Plugin Method Not Found

**Error:** `Error: "MyPlugin" plugin is not implemented on ios/android`

**Diagnosis:**
```typescript
import { Capacitor } from '@capacitor/core';
console.log('Plugins:', Capacitor.Plugins);
console.log('MyPlugin available:', !!Capacitor.Plugins.MyPlugin);
```

**Solutions:**
1. Ensure plugin is installed: `npm install @capgo/plugin-name`
2. Run sync: `npx cap sync`
3. Check plugin is registered in native code

### Network Requests Failing

**Diagnosis:**
```typescript
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('Fetch:', args[0]);
  try {
    const response = await originalFetch(...args);
    console.log('Response status:', response.status);
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};
```

**Common causes:**
1. **iOS ATS blocking HTTP**: Add to Info.plist:
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSAllowsArbitraryLoads</key>
       <true/>
   </dict>
   ```

2. **Android cleartext blocked**: Add to `capacitor.config.ts`:
   ```typescript
   server: {
     cleartext: true, // Only for development!
   }
   ```

3. **CORS issues**: Use native HTTP:
   ```typescript
   import { CapacitorHttp } from '@capacitor/core';
   const response = await CapacitorHttp.request({
     method: 'GET',
     url: 'https://api.example.com/data',
   });
   ```

### Permission Denied

**Diagnosis:**
```typescript
import { Permissions } from '@capacitor/core';
const status = await Permissions.query({ name: 'camera' });
console.log('Camera permission:', status.state);
```

**iOS:** Check Info.plist has usage descriptions:
```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to scan documents</string>
```

**Android:** Check AndroidManifest.xml:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

### White Screen on Launch

**Diagnosis:**
1. Check WebView console for errors (Safari/Chrome)
2. Check if `dist/` folder exists
3. Verify `webDir` in `capacitor.config.ts`

**Solutions:**
```bash
npm run build
npx cap sync
cat capacitor.config.ts
```

### Deep Links Not Working

**Diagnosis:**
```typescript
import { App } from '@capacitor/app';
App.addListener('appUrlOpen', (event) => {
  console.log('Deep link:', event.url);
});
```

**iOS:** Check Associated Domains entitlement and apple-app-site-association file.
**Android:** Check intent filters in AndroidManifest.xml.

## Debugging Checklist

- [ ] Check WebView console (Safari/Chrome DevTools)
- [ ] Check native logs (Xcode Console/Logcat)
- [ ] Verify plugin is installed and synced
- [ ] Check permissions (Info.plist/AndroidManifest)
- [ ] Test on real device (not just simulator)
- [ ] Try clean build (`rm -rf node_modules && npm install`)
- [ ] Verify capacitor.config.ts settings
- [ ] Check for version mismatches (capacitor packages)

## Example Marketplace Relevance

Example Marketplace is a React + Vite app wrapped in Capacitor v6. The most common debugging scenarios will be:

1. **White screen after build**: Use Safari Web Inspector (iOS) or Chrome DevTools (Android) to check if the `dist/` output loaded correctly and if React threw an error during hydration.
2. **Base44 API calls failing**: Check Network tab in Chrome DevTools / Safari Inspector. If CORS errors appear, switch to `CapacitorHttp` for native-bypassed requests.
3. **Geolocation or Camera plugin not responding**: Verify permissions in `AndroidManifest.xml` and `Info.plist`, then use native debuggers to step into the plugin's Swift/Kotlin code.
4. **Memory leaks during long check-in sessions**: Use Chrome DevTools Memory tab (heap snapshots) to find retained DOM nodes or event listeners.
