# Capacitor Plugins & Plugin Development

**Group:** Capacitor Ecosystem — Plugins, Development & SPM Support
**Sources:** 5 SKILL.md files (capawesome-team ×3, capgo ×2)
**Date:** 2026-04-26

---

## 1. capawesome/skills/capacitor-plugins — Plugin Installation & Configuration

### Key Procedures
1. **Identify the plugin** from the index (official, Capawesome, community, Firebase, MLKit, RevenueCat).
2. **Read the reference file** for the matched plugin.
3. **Auto-detect project state:** platforms (`android/`, `ios/`), build tool (`vite.config.ts`, `angular.json`, etc.), iOS dependency manager (`Podfile` vs SPM), Capacitor version from `package.json`.
4. **Set up Capawesome Insiders** if required:
   ```bash
   npm config set @capawesome-team:registry https://npm.registry.capawesome.io
   npm config set //npm.registry.capawesome.io/:_authToken <YOUR_LICENSE_KEY>
   ```
5. **Install and sync:**
   ```bash
   npm install <package-name>
   npx cap sync
   ```
6. **Apply platform-specific configuration:**
   - **Android:** Gradle variables in `variables.gradle`, permissions in `AndroidManifest.xml`, meta-data, ProGuard rules.
   - **iOS:** `Info.plist` entries, `Podfile` or SPM changes, `AppDelegate.swift` modifications.
7. **Apply web configuration** if the project targets web (Vite, Webpack, Angular CLI, etc.).
8. **Add usage code** adapted to the project structure.
9. **Final sync:** `npx cap sync`

### Configuration Patterns
- One decision at a time when variants exist (e.g., encryption vs. plain SQLite).
- Skip platforms not present in the project.
- Prefer **Capawesome plugins** when multiple options exist.

### Error Handling
- `npx cap sync` fails → run `pod install --repo-update` (iOS) or sync Gradle (Android).
- Plugin not found at runtime → verify `npx cap sync` was run; check pod/SPM installation.
- Permission denied → declare in platform configs **and** request at runtime via `checkPermissions()` / `requestPermissions()`.

---

## 2. capgo/skills/capacitor-plugins — Plugin Directory & Selection Guide

### Key Procedures
1. **Check official Capacitor package first.**
2. **Escalate to Capgo or community plugins** when:
   - No official package exists.
   - Official package is too limited.
   - User needs a hosted Capgo workflow.
   - Migrating from Ionic Enterprise or older community plugins.

### Choosing the Right Plugin
| Use Case | Recommendation |
|----------|----------------|
| App lifecycle, browser, camera, clipboard, device, dialog, filesystem, geolocation, haptics, keyboard, network, notifications, share, splash, status bar | **Official Capacitor** |
| Biometric login | `@capgo/capacitor-native-biometric` |
| Social sign-in | `@capgo/capacitor-social-login` |
| Camera with overlay | `@capgo/capacitor-camera-preview` |
| Subscriptions / IAP | `@capgo/capacitor-native-purchases` |
| Apple Pay / Google Pay | `@capgo/capacitor-pay` |
| Production OTA updates | `@capgo/capacitor-updater` |
| Encrypted SQL, high write throughput | `@capgo/capacitor-fast-sql` |

### Installation Pattern (Capgo plugins)
```bash
npm install @capgo/capacitor-<name>
npx cap sync
```

---

## 3. capawesome/skills/capacitor-plugin-development — Creating Plugins from Scratch

### Key Procedures
1. **Determine task:** create new plugin, add method, add platform, set up config/hooks, or publish.
2. **Scaffold** using the Capacitor plugin generator (`npm init @capacitor/plugin@latest`).
3. **Design TypeScript API** in `src/definitions.ts`:
   - JSDoc with `@since` tags.
   - Separate interfaces for options and results.
   - String union types instead of enums.
4. **Implement Web Layer** in `src/web.ts`:
   - Extend `WebPlugin`.
   - Throw `this.unimplemented()` for methods with no web equivalent.
   - Throw `this.unavailable()` if a web API is missing.
5. **Define method signatures** across platforms:

   | Type | TypeScript | iOS | Android |
   |------|-----------|-----|---------|
   | Returns value | `Promise<T>` | `CAPPluginReturnPromise` | `@PluginMethod()` |
   | Returns void | `Promise<void>` | `CAPPluginReturnNone` | `@PluginMethod(returnType = PluginMethod.RETURN_NONE)` |
   | Callback (stream) | `Promise<string>` | `CAPPluginReturnCallback` | `@PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)` |

6. **Implement iOS** in `ios/Sources/<ClassName>Plugin/`:
   - Implementation class: `NSObject` + `@objc`.
   - Plugin class: extend `CAPPlugin`, conform to `CAPBridgedPlugin`, set `identifier`, `jsName`, `pluginMethods`.
   - Read from `CAPPluginCall`, call `resolve()`, `reject()`, `unavailable()`, `unimplemented()`.
7. **Implement Android** in `android/src/main/java/<package>/`:
   - Plugin class: extend `Plugin`, annotate `@CapacitorPlugin(name = "<JSName>")`.
   - Annotate methods with `@PluginMethod`, read from `PluginCall`.
8. **Add events** (if needed):
   - TypeScript: `addListener()` / `removeAllListeners()`.
   - Web: `this.notifyListeners('eventName', data)`.
   - iOS: `self.notifyListeners("eventName", data: [...])`.
   - Android: `notifyListeners("eventName", jsObject)`.
9. **Generate docs and verify:**
   ```bash
   npm run docgen
   npm run verify
   npm run lint
   npm run fmt
   ```
10. **Publish:**
    ```bash
    npm publish --access public
    ```

### Critical Gotchas
- `registerPlugin()` name in `src/index.ts` must exactly match `jsName` (iOS) and `@CapacitorPlugin(name = ...)` (Android).
- iOS methods must be `@objc` and listed in `pluginMethods` array.
- Android methods must be `public` and have `@PluginMethod()`.
- Event name strings must be identical across all platforms.

---

## 4. capawesome/skills/capacitor-plugin-spm-support — Adding SPM Support

### Prerequisites
- Capacitor 6+, Swift 5.9+, Xcode 15+
- Existing iOS implementation with Swift sources in `ios/Plugin/`

### Key Procedures
1. **Gather info** from `package.json`, `.podspec`, and Swift/Objective-C bridge files:
   - Pod name → SPM package name.
   - iOS deployment target → SPM iOS version.
   - Third-party CocoaPods dependencies → resolve SPM equivalents.
   - Plugin class name, JavaScript name (`CAP_PLUGIN` macro), all methods (`CAP_PLUGIN_METHOD` macros).
2. **Resolve CocoaPods dependencies for SPM:**
   - Search web for `"<dependency_name>" Swift Package Manager`.
   - Convert version constraints: `~> 5.0` → `.upToNextMajor(from: "5.0.0")`, `= 2.1.0` → `.exact("2.1.0")`.
3. **Create `Package.swift`:**
   ```swift
   // swift-tools-version: 5.9
   import PackageDescription

   let package = Package(
       name: "<SPM_PACKAGE_NAME>",
       platforms: [.iOS(.v<SPM_IOS_VERSION>)],
       products: [
           .library(name: "<SPM_PACKAGE_NAME>", targets: ["<PLUGIN_CLASS_NAME>"])
       ],
       dependencies: [
           .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", branch: "<CAPACITOR_MAJOR_VERSION>.0.0")
           // <ADDITIONAL_PACKAGE_DEPENDENCIES>
       ],
       targets: [
           .target(
               name: "<PLUGIN_CLASS_NAME>",
               dependencies: [
                   .product(name: "Capacitor", package: "capacitor-swift-pm"),
                   .product(name: "Cordova", package: "capacitor-swift-pm")
                   // <ADDITIONAL_TARGET_DEPENDENCIES>
               ],
               path: "ios/Plugin"),
           .testTarget(
               name: "<PLUGIN_CLASS_NAME>Tests",
               dependencies: ["<PLUGIN_CLASS_NAME>"],
               path: "ios/PluginTests")
       ]
   )
   ```
4. **Update Swift plugin class:**
   ```diff
    @objc(AppReviewPlugin)
   -public class AppReviewPlugin: CAPPlugin {
   +public class AppReviewPlugin: CAPPlugin, CAPBridgedPlugin {
   +    public let identifier = "AppReviewPlugin"
   +    public let jsName = "AppReview"
   +    public let pluginMethods: [CAPPluginMethod] = [
   +        CAPPluginMethod(name: "openAppStore", returnType: CAPPluginReturnPromise),
   +        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
   +    ]
   ```
5. **Delete Objective-C bridge files** (`<PluginClassName>.h` and `.m`).
6. **Clean `project.pbxproj`** — remove all references to deleted `.h` and `.m` files.
7. **Update `.gitignore`:**
   ```gitignore
   Package.resolved
   /.build
   /Packages
   .swiftpm/configuration/registries.json
   .swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata
   .netrc
   ```
8. **Update `package.json`:**
   - Add `"Package.swift"` to `files` array.
   - Add `"ios:spm:install": "cd ios && swift package resolve && cd .."` to `scripts`.
9. **Verify:** `npm install`, then build the example/test app.

### Error Handling
- `CAPBridgedPlugin` not found → verify `@capacitor/core` is v6+ and `capacitor-swift-pm` branch matches Capacitor major version.
- SPM resolution fails → verify target paths match actual directory structure.
- No test target directory → remove `.testTarget` block from `Package.swift`.

---

## 5. capgo/skills/capacitor-plugin-spm-support — SPM Support (Concise)

### Key Procedures
1. **Gather plugin info** from `package.json`, `.podspec`, and main Swift class.
2. **Create `Package.swift`** aligned with the plugin source tree.
3. **Convert Swift plugin class** to conform to `CAPBridgedPlugin` with `identifier`, `jsName`, `pluginMethods`.
4. **Remove Objective-C bridge files** and clean Xcode project references.
5. **Update package metadata** to export iOS sources, podspec, and `Package.swift`.
6. **Verify** by running `npx cap sync` in the example/test app and building.

### Error Handling
- Start with Swift package resolver: check target path and package dependency names.
- Verify bridge registration by matching class name, `identifier`, and `jsName` against the exported API.
- For unsupported CocoaPods dependencies, replace with SPM-compatible packages or keep CocoaPods for that dependency.

---

## Example Marketplace Relevance Notes

### Currently Used Plugins
- **`@capacitor/browser`** — Used for external link opening (e.g., Stripe checkout, social links). Falls under "Official Capacitor" tier. Installation: `npm install @capacitor/browser && npx cap sync`. No platform-specific config required; uses `Browser.open({ url })`.
- **`@capacitor/status-bar`** — Used for status bar styling in dark/light mode. Falls under "Official Capacitor" tier. Configure via `StatusBar.setStyle({ style: Style.Dark })` or `Style.Light`.

### Planned Integrations
- **OneSignal Push Notifications** — Not listed in official Capacitor packages. Likely requires a community or Capgo plugin (e.g., `@capacitor/push-notifications` for basic FCM, or OneSignal's own Capacitor SDK). When evaluating:
  1. Check if `@capacitor/push-notifications` meets the need first.
  2. If OneSignal-specific features (segmentation, in-app messaging) are required, use the official OneSignal Capacitor plugin rather than a generic wrapper.
  3. Ensure `AndroidManifest.xml` and `Info.plist` push permission entries are configured.

### Relevant Capgo Plugins for Example Marketplace Roadmap
| Plugin | Use Case |
|--------|----------|
| `@capgo/capacitor-updater` | OTA live updates for rapid iteration |
| `@capgo/capacitor-native-biometric` | Biometric login for employees/owners |
| `@capgo/capacitor-social-login` | Social auth (Google/Apple) for customers |
| `@capgo/capacitor-pay` | Apple Pay / Google Pay for booking payments |
| `@capgo/capacitor-fast-sql` | Offline-first local data if Base44 sync gaps arise |

### Build Tool Alignment
Example Marketplace uses Vite (`vite.config.ts`). When applying web configuration for Capacitor plugins, adapt any Webpack/Angular-specific guidance to Vite patterns (e.g., `vite-plugin-top-level-await` for WASM-based plugins like SQLite).

---

## Cross-References

- **capawesome-team/capacitor-plugin-development** references:
  - `references/scaffolding.md`
  - `references/designing-api.md`
  - `references/web-guide.md`
  - `references/ios-guide.md`
  - `references/android-guide.md`
  - `references/testing-and-workflow.md`
  - `references/plugin-configuration.md`
  - `references/publishing.md`
- **capawesome-team/capacitor-plugins** references: `references/<plugin-name>.md` for every indexed plugin.
- **capawesome-team/capacitor-plugin-spm-support** → related to `capacitor-plugin-development` and `capacitor-plugin-upgrades`.
- **capgo/skills/capacitor-plugin-spm-support** → shorter sibling of capawesome's SPM skill; use capawesome for detailed step-by-step.
- **Example Marketplace skills:**
  - `posthog-integration` — Capawesome provides `@capawesome/capacitor-posthog` if native PostHog SDK is needed over web SDK.
  - `base44-environment` / `base44-sdk` — Backend remains Base44; Capacitor plugins add native capabilities on top.

---

## Decision Matrix: Official vs. Capawesome vs. Capgo vs. Community

| Scenario | Recommended Source |
|----------|-------------------|
| Standard native API (camera, geolocation, share, status bar, browser) | **Official Capacitor** |
| Well-maintained alternative with dedicated support | **Capawesome** |
| OTA live updates, biometric auth, social login, native payments | **Capgo** |
| Specific Firebase/MLKit integration | **Capacitor Firebase / MLKit** |
| RevenueCat in-app purchases | **RevenueCat** official plugin |
| Niche use case not covered above | **Capacitor Community** |
