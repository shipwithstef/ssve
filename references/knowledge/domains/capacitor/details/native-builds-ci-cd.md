# Native Builds and CI/CD

Extracted from: `capacitor-ci-cd` (Capgo), `capgo-native-builds` (Capgo), `capgo-release-workflows` (Capgo), `capawesome-cloud` (Capawesome)

---

## CI/CD Pipeline Overview

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│   Test   │ → │  Build   │ → │  Sign    │ → │ Deploy   │
│   + Lint │   │  Web +   │   │  iOS +   │   │ Store +  │
│   + Scan │   │  Native  │   │  Android │   │ Capgo    │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## GitHub Actions: Complete Workflow

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

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
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
        with:
          name: web-build
          path: dist/

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
          echo "$CERTIFICATE_P12" | base64 --decode > certificate.p12
          security import certificate.p12 -k build.keychain -P "$CERTIFICATE_PASSWORD"
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          echo "$PROVISIONING_PROFILE" | base64 --decode > ~/Library/MobileDevice/Provisioning\ Profiles/profile.mobileprovision
      - run: |
          cd ios/App
          xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath build/App.xcarchive archive
      - run: |
          cd ios/App
          xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/ -exportOptionsPlist ExportOptions.plist
      - uses: actions/upload-artifact@v4
        with:
          name: ios-build
          path: ios/App/build/*.ipa

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
        with:
          name: android-aab
          path: android/app/build/outputs/bundle/release/*.aab
```

---

## Required CI Secrets

| Secret | Description | Encoding |
|--------|-------------|----------|
| `CERTIFICATE_P12` | iOS distribution cert | base64 |
| `CERTIFICATE_PASSWORD` | Cert password | plain |
| `PROVISIONING_PROFILE` | iOS provisioning profile | base64 |
| `KEYSTORE_BASE64` | Android release keystore | base64 |
| `KEYSTORE_PASSWORD` | Keystore password | plain |
| `KEY_ALIAS` | Signing key alias | plain |
| `KEY_PASSWORD` | Key password | plain |
| `CAPGO_TOKEN` | Capgo API token | plain |
| `APP_STORE_CONNECT_API_KEY` | App Store Connect API key | plain |
| `PLAY_SERVICE_ACCOUNT` | Play Store service account JSON | plain |

### Encoding Secrets

```bash
# iOS certificate
base64 -i certificate.p12 | pbcopy

# iOS provisioning profile
base64 -i profile.mobileprovision | pbcopy

# Android keystore
base64 -i release.keystore | pbcopy
```

---

## Fastlane Integration

### iOS Fastfile

```ruby
# ios/App/fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Build and deploy to TestFlight"
  lane :release do
    setup_ci
    match(type: "appstore", readonly: true)
    increment_build_number(build_number: ENV["GITHUB_RUN_NUMBER"])
    build_app(workspace: "App.xcworkspace", scheme: "App", export_method: "app-store")
    upload_to_testflight(skip_waiting_for_build_processing: true)
  end
end
```

### Android Fastfile

```ruby
# android/fastlane/Fastfile
default_platform(:android)

platform :android do
  desc "Build and deploy to Play Store"
  lane :release do
    increment_version_code(version_code: ENV["GITHUB_RUN_NUMBER"].to_i)
    gradle(task: "bundle", build_type: "Release")
    upload_to_play_store(track: "internal", aab: lane_context[SharedValues::GRADLE_AAB_OUTPUT_PATH])
  end
end
```

---

## Capgo Native Cloud Builds

### Request a Build

```bash
# iOS build
npx @capgo/cli@latest build request com.example.app --platform ios --path .

# Android build
npx @capgo/cli@latest build request com.example.app --platform android --path .

# With output download link
npx @capgo/cli@latest build request com.example.app --platform ios --path . --output-upload
```

### Manage Credentials

```bash
capgo build credentials save
capgo build credentials list
capgo build credentials update
capgo build credentials clear
```

### Error Handling

- **iOS signing failures**: Re-check certificate, provisioning mapping, App Store Connect fields
- **Android signing failures**: Re-check keystore path, alias, and passwords
- **Missing output artifacts**: Verify `--output-upload` and retention settings

---

## Build Caching

### Gradle Cache

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: gradle-${{ runner.os }}-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
```

### CocoaPods Cache

```yaml
- uses: actions/cache@v4
  with:
    path: ios/App/Pods
    key: pods-${{ runner.os }}-${{ hashFiles('ios/App/Podfile.lock') }}
```

---

## Semantic Release

```bash
npm install -D semantic-release @semantic-release/git @semantic-release/changelog
```

```json
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

---

## Example Marketplace Relevance

- **Current process**: Local Gradle build → AAB → Play Console manual upload
- **CI/CD status**: Not yet automated
- **Signing**: Android release keystore exists; iOS cert/provisioning needed
- **Capgo**: Not currently used for builds or OTA
- **Next steps**: Set up GitHub Actions for automated web build + native sync
