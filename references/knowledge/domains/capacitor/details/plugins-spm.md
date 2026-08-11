# Plugins and Swift Package Manager

Extracted from: `capacitor-plugin-development` (Capawesome), `capacitor-plugin-spm-support` (Capawesome + Capgo), `cocoapods-to-spm` (Capgo)

---

## Plugin Ecosystem Sources

| Source | Scope | Registry |
|--------|-------|----------|
| Official Capacitor | Core functionality | `@capacitor/*` |
| Capawesome | Premium plugins | `@capawesome/*` |
| Capacitor Community | Community plugins | `@capacitor-community/*` |
| Capacitor Firebase | Firebase integration | `@capacitor-firebase/*` |
| Capacitor MLKit | ML/AI plugins | `@capacitor-mlkit/*` |
| RevenueCat | In-app purchases | `@revenuecat/*` |
| Capgo | Live updates, security | `@capgo/*` |

---

## Installing Plugins (9-Step Procedure)

1. **Identify** the native feature needed
2. **Read** the Capacitor plugin reference
3. **Analyze** if the feature requires a plugin or web API
4. **Install** the plugin via npm
5. **Configure** platform-specific settings
6. **Sync** native projects (`npx cap sync`)
7. **Import** and use in code
8. **Test** on physical devices
9. **Document** the plugin in project docs

```bash
# Example: Install Camera plugin
npm install @capacitor/camera
npx cap sync
```

---

## Swift Package Manager (SPM) Support

### Adding SPM to an Existing Plugin

**Package.swift:**
```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorMyPlugin",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorMyPlugin",
            targets: ["MyPluginPlugin"]
        ),
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

**Plugin Swift Code:**
```swift
import Foundation
import Capacitor

@objc(MyPlugin)
public class MyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MyPlugin"
    public let jsName = "MyPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
    ]

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve(["value": value])
    }
}
```

---

## CocoaPods to SPM Migration

### Why Migrate

| Aspect | CocoaPods | SPM |
|--------|-----------|-----|
| Build Speed | Slower | Faster |
| Apple Integration | Third-party | Native Xcode |
| Ruby Dependency | Required | None |

### Hybrid Approach (Recommended)

**Keep in CocoaPods:**
- `@capacitor/ios` core
- Capacitor plugins without SPM support

**Move to SPM:**
- Firebase
- Third-party libraries
- Your own Swift packages

### Migration Steps

```bash
cd ios/App
pod deintegrate
rm -rf Podfile.lock Pods App.xcworkspace
```

Then add SPM dependencies in Xcode (Project > Package Dependencies > +).

**Minimal Podfile for Capacitor core:**
```ruby
require_relative '../../node_modules/@capacitor/ios/scripts/pods_helpers'

platform :ios, '14.0'
use_frameworks!

def capacitor_pods
  pod 'Capacitor', :path => '../../node_modules/@capacitor/ios'
  pod 'CapacitorCordova', :path => '../../node_modules/@capacitor/ios'
end

target 'App' do
  capacitor_pods
end
```

---

## Plugin Development

### Directory Structure

```
my-capacitor-plugin/
├── Package.swift              # SPM manifest
├── ios/
│   └── Sources/
│       └── MyPlugin/
│           ├── MyPlugin.swift
│           └── include/
│               └── MyPlugin.h
├── android/
│   └── src/main/java/
│       └── com/example/
│           └── MyPlugin.java
├── src/
│   ├── index.ts               # TypeScript API
│   ├── definitions.ts         # Type definitions
│   └── web.ts                 # Web fallback
└── package.json
```

### TypeScript API Design

```typescript
// src/definitions.ts
export interface MyPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}

// src/index.ts
import { registerPlugin } from '@capacitor/core';
import type { MyPlugin } from './definitions';

const MyPlugin = registerPlugin<MyPlugin>('MyPlugin', {
  web: () => import('./web').then((m) => new m.MyPluginWeb()),
});

export * from './definitions';
export { MyPlugin };
```

---

## Example Marketplace Relevance

- **Current plugins**: `@capacitor/browser`, `@capacitor/status-bar`
- **No custom plugins**: All plugins from npm registry
- **iOS package manager**: CocoaPods (standard for Capacitor v6)
- **SPM migration**: Not needed unless adding SPM-only dependencies
- **Plugin upgrades**: Follow sequential major version rule
