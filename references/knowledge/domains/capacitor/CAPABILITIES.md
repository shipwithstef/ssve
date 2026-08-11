# Capacitor Domain Knowledge

**Source:** External skill packs (Capawesome, Capgo)
**Research date:** 2026-04-29
**Last verified:** 2026-04-29
**Total skills extracted:** 72 SKILL.md files
**Total detail files:** 14
**Total lines extracted:** ~4,700+

---

## Skill Pack Overview

### Capawesome (`capawesome-team/skills`)
**Install:** `npx skills add capawesome-team/skills`
**License:** MIT
**Count:** 25 skills
**Maintainer:** Capawesome (official Capacitor ecosystem partner)

### Capgo (`Cap-go/capgo-skills`)
**Install:** `npx skills add Cap-go/capgo-skills`
**License:** MIT
**Count:** 47 skills
**Maintainer:** Capgo (Capacitor live updates + security)

---

## Complete Skill Catalog

### 🔧 App Creation & Setup (4 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-app-creation` | Capawesome | 239 | ⭐⭐⭐ Scaffold new Capacitor apps |
| `capacitor-app-development` | Capawesome | 91 | ⭐⭐⭐ Core concepts, CLI, config, troubleshooting |
| `capacitor-react` | Capawesome | 248 | ⭐⭐⭐ React-specific patterns, hooks, deep links |
| `framework-to-capacitor` | Capgo | 848 | ⭐⭐⭐ React/Vite integration, HashRouter, static export |

**Detail file:** [details/app-creation-setup.md](details/app-creation-setup.md) (16KB)
**Example Marketplace relevance:** HIGH — Matches current React 18 + Vite + Capacitor v6 stack exactly.

---

### ⚛️ Framework Integration (4 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-angular` | Capawesome | 545 | ⭐ Not used (no Angular) |
| `capacitor-vue` | Capawesome | 516 | ⭐ Not used (no Vue) |
| `capacitor-react` | Capawesome | 248 | ⭐⭐⭐ Already cataloged above |
| `framework-to-capacitor` | Capgo | 848 | ⭐⭐⭐ Already cataloged above |

**Detail file:** [details/framework-integration.md](details/framework-integration.md) (5.5KB)
**Example Marketplace relevance:** HIGH for React skills, LOW for Angular/Vue.

---

### 🏛️ Ionic Framework (7 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `ionic-app-creation` | Capawesome | 171 | ⭐ Not used |
| `ionic-app-development` | Capawesome | 388 | ⭐ Not used |
| `ionic-react` | Capawesome | 212 | ⭐ Not used |
| `ionic-angular` | Capawesome | 159 | ⭐ Not used |
| `ionic-vue` | Capawesome | 239 | ⭐ Not used |
| `ionic-design` | Capgo | 640 | ⭐ Not used |
| `ionic-expert` | Capawesome | 428 | ⭐ Not used |

**Detail file:** [details/ionic-framework.md](details/ionic-framework.md) (26KB)
**Example Marketplace relevance:** LOW — Example Marketplace uses React + Tailwind + shadcn/ui, NOT Ionic. Kept for reference if a companion Ionic app is ever needed.

---

### ⬆️ Upgrades & Migrations (18 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-app-upgrades` | Capawesome | 74 | ⭐⭐ Future v7/v8 upgrades |
| `capacitor-app-upgrades` | Capgo | 76 | ⭐⭐ Future v7/v8 upgrades |
| `capacitor-app-upgrade-v4-to-v5` | Capgo | 36 | ⭐ Historical reference |
| `capacitor-app-upgrade-v5-to-v6` | Capgo | 36 | ⭐⭐ Already on v6 (was v5→v6) |
| `capacitor-app-upgrade-v6-to-v7` | Capgo | 36 | ⭐⭐ Future v7 upgrade |
| `capacitor-app-upgrade-v7-to-v8` | Capgo | 36 | ⭐⭐ Future v8 upgrade |
| `capacitor-plugin-upgrades` | Capawesome | 76 | ⭐⭐ Plugin upgrade patterns |
| `capacitor-plugin-upgrades` | Capgo | 80 | ⭐⭐ Plugin upgrade patterns |
| `capacitor-plugin-upgrade-v4-to-v5` | Capgo | 40 | ⭐ Historical |
| `capacitor-plugin-upgrade-v5-to-v6` | Capgo | 40 | ⭐ Historical |
| `capacitor-plugin-upgrade-v6-to-v7` | Capgo | 40 | ⭐⭐ Future |
| `capacitor-plugin-upgrade-v7-to-v8` | Capgo | 40 | ⭐⭐ Future |
| `cordova-to-capacitor` | Capgo | 546 | ⭐ Not applicable |
| `ionic-appflow-migration` | Capawesome | 493 | ⭐ Not applicable |
| `ionic-appflow-migration` | Capgo | 98 | ⭐ Not applicable |
| `ionic-enterprise-sdk-migration` | Capawesome | 123 | ⭐ Not applicable |
| `ionic-enterprise-sdk-migration` | Capgo | 103 | ⭐ Not applicable |
| `cocoapods-to-spm` | Capgo | 371 | ⭐ iOS-only, not needed yet |

**Detail file:** [details/upgrades-migrations.md](details/upgrades-migrations.md) (21KB)
**Example Marketplace relevance:** MEDIUM — v6→v7→v8 upgrade paths are relevant for future maintenance. Cordova/Appflow/Enterprise migrations are not applicable.

---

### 🔌 Plugins & Development (5 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-plugins` | Capawesome | 300 | ⭐⭐⭐ 160+ plugin catalog |
| `capacitor-plugins` | Capgo | 314 | ⭐⭐⭐ Official + Capgo ecosystem plugins |
| `capacitor-plugin-development` | Capawesome | 201 | ⭐⭐ If custom plugins needed |
| `capacitor-plugin-spm-support` | Capawesome | 205 | ⭐ iOS-only |
| `capacitor-plugin-spm-support` | Capgo | 86 | ⭐ iOS-only |

**Detail file:** [details/plugins-development.md](details/plugins-development.md) (13KB)
**Example Marketplace relevance:** HIGH — Plugin catalog is essential for feature planning. Currently using `@capacitor/browser`, `@capacitor/status-bar`. Planning OneSignal push.

---

### 🚀 DevOps, CI/CD, Builds, Releases (11 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-ci-cd` | Capgo | 662 | ⭐⭐⭐ GitHub Actions, Fastlane, signing |
| `capacitor-app-store` | Capgo | 431 | ⭐⭐ Play Store + App Store submission |
| `capacitor-apple-review-preflight` | Capgo | 137 | ⭐ iOS-only, not needed yet |
| `capgo-native-builds` | Capgo | 64 | ⭐ Cloud builds (not using Capgo) |
| `capgo-release-management` | Capgo | 53 | ⭐ Cloud releases (not using Capgo) |
| `capgo-release-workflows` | Capgo | 70 | ⭐ Cloud workflows (not using Capgo) |
| `capgo-organization-management` | Capgo | 49 | ⭐ Cloud org (not using Capgo) |
| `capgo-cli-usage` | Capgo | 46 | ⭐ Cloud CLI (not using Capgo) |
| `capawesome-cloud` | Capawesome | 131 | ⭐ Cloud service (not using) |
| `capawesome-cli` | Capawesome | 153 | ⭐ Cloud CLI (not using) |
| `capgo-cloud` | Capgo | 57 | ⭐ Umbrella skill (not using Capgo) |

**Detail files:** CI/CD patterns included in [details/testing-cicd-best-practices.md](details/testing-cicd-best-practices.md)
**Example Marketplace relevance:** MEDIUM — CI/CD setup is valuable for future automation. Currently doing manual Gradle builds + Play Console upload. Capgo/Capawesome cloud services not used (Base44 for backend).

---

### 🔔 Push Notifications (2 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-push-notifications` | Capawesome | 137 | ⭐⭐⭐ FCM + APNs setup |
| `capacitor-push-notifications` | Capgo | 479 | ⭐⭐⭐ Complete guide with code examples |

**Example Marketplace relevance:** HIGH — Push notifications are planned (OneSignal). Firebase setup, token management, permission handling all relevant.

---

### 🔗 Deep Linking & Universal Links (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-deep-linking` | Capgo | 427 | ⭐⭐⭐ OAuth callback handling |

**Detail file:** [details/deep-linking.md](details/deep-linking.md) (6.9KB)
**Example Marketplace relevance:** HIGH — Already implemented for Base44 OAuth native login flow (WI-164).

---

### 🔒 Security (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-security` | Capgo | 484 | ⭐⭐⭐ Capsec — 63+ security rules |

**Detail file:** [details/capsec-security.md](details/capsec-security.md) (12KB)
**Example Marketplace relevance:** HIGH — Should run `npx capsec scan` before every release. Covers hardcoded secrets, insecure storage, network security, auth weaknesses.

---

### ⚡ Performance & Offline (2 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-performance` | Capgo | 173 | ⭐⭐ Bundle size, rendering, memory |
| `capacitor-offline-first` | Capgo | 556 | ⭐⭐⭐ Fast SQL, sync manager, caching |

**Example Marketplace relevance:** MEDIUM — Performance optimization is always relevant. Offline-first with Fast SQL is interesting for future features (location data caching, check-in queue).

---

### 🎹 Keyboard & Input (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-keyboard` | Capgo | 161 | ⭐⭐ Keyboard handling, resize modes |

**Example Marketplace relevance:** MEDIUM — Input forms (login, search) need keyboard handling on mobile.

---

### 🖼️ Splash Screen & Safe Area (2 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-splash-screen` | Capgo | 256 | ⭐⭐ Native splash screen config |
| `safe-area-handling` | Capgo | 568 | ⭐⭐⭐ Notch, home indicator, edge-to-edge |

**Detail file:** [details/safe-area-handling.md](details/safe-area-handling.md) (11KB)
**Example Marketplace relevance:** HIGH — Safe area handling critical for modern devices with notches/dynamic islands.

---

### 🧪 Testing & Debugging (3 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-testing` | Capgo | 588 | ⭐⭐⭐ Vitest, Playwright, Appium, native tests |
| `debugging-capacitor` | Capgo | 445 | ⭐⭐⭐ Chrome DevTools, Xcode, Android Studio |
| `ios-android-logs` | Capgo | 370 | ⭐⭐ Logcat, Xcode console, remote debugging |

**Detail files:** [details/debugging-capacitor.md](details/debugging-capacitor.md) (9.3KB), [details/ios-android-logs.md](details/ios-android-logs.md) (7KB)
**Example Marketplace relevance:** HIGH — Testing and debugging are essential for native app quality.

---

### 💰 In-App Purchases (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-in-app-purchases` | Capawesome | 141 | ⭐ Not planned |

**Example Marketplace relevance:** LOW — No monetization via IAP planned. Base44 subscription handles payments.

---

### 🔄 Live Updates / OTA (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capgo-live-updates` | Capgo | 525 | ⭐⭐ Interesting for fast iteration |

**Example Marketplace relevance:** MEDIUM — OTA updates would speed up web layer fixes without Play Console review. But Base44 already handles web deploys; native wrapper updates are infrequent.

---

### 🎨 Design & UI (3 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `tailwind-capacitor` | Capgo | 578 | ⭐⭐⭐ Tailwind mobile patterns, safe area, dark mode |
| `konsta-ui` | Capgo | 673 | ⭐ Alternative UI framework (not used) |
| `capacitor-accessibility` | Capgo | 178 | ⭐⭐ Screen readers, VoiceOver, TalkBack |

**Example Marketplace relevance:** HIGH for Tailwind skill (matches current stack). Konsta UI not needed. Accessibility important for compliance.

---

### 🤖 MCP & Tooling (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-mcp` | Capgo | 428 | ⭐⭐ awesome-ionic-mcp server |

**Example Marketplace relevance:** MEDIUM — MCP server for Ionic/Capacitor plugin discovery. Could be useful for agent-assisted development.

---

### 🗄️ SQLite & Storage (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `sqlite-to-fast-sql` | Capgo | 101 | ⭐⭐ Migration path to Fast SQL |

**Example Marketplace relevance:** LOW — Not using SQLite yet. Fast SQL could be useful for offline caching in future.

---

### 📋 App Store & Review (1 skill)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-app-store` | Capgo | 431 | ⭐⭐ Play Store + App Store submission |

**Example Marketplace relevance:** MEDIUM — Will need when submitting to App Store (currently only Play Console).

---

### 🛠️ Skill Creation (2 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `skill-creator` | Capawesome | 49 | ⭐ Meta skill for creating skills |
| `skill-creator` | Capgo | 62 | ⭐ Meta skill for creating skills |

**Example Marketplace relevance:** LOW — Framework-level skill, not app-specific.

---

### 🏆 Expert Reference (2 skills)
| Skill | Source | Lines | Relevance |
|-------|--------|-------|-----------|
| `capacitor-expert` | Capawesome | 505 | ⭐⭐ Comprehensive reference |
| `ionic-expert` | Capawesome | 428 | ⭐ Not used |

**Example Marketplace relevance:** MEDIUM — Expert skills are comprehensive references for advanced topics.

---

## Relevance Summary for Example Marketplace

### ⭐⭐⭐ CRITICAL (Use immediately)
1. `capacitor-react` — React patterns, hooks, deep links
2. `framework-to-capacitor` — Vite + React + Capacitor integration
3. `capacitor-app-creation` / `capacitor-app-development` — Setup, config, troubleshooting
4. `capacitor-plugins` (both) — Plugin catalog for feature planning
5. `capacitor-deep-linking` — OAuth callback handling (already implemented)
6. `capacitor-security` — Capsec scan before releases
7. `safe-area-handling` — Modern device support
8. `tailwind-capacitor` — Mobile Tailwind patterns

### ⭐⭐ HIGH (Use soon)
9. `capacitor-push-notifications` — Planned OneSignal integration
10. `capacitor-performance` — Bundle optimization
11. `capacitor-offline-first` — Fast SQL for future caching
12. `capacitor-testing` / `debugging-capacitor` / `ios-android-logs` — Quality assurance
13. `capacitor-ci-cd` — Future build automation
14. `capacitor-keyboard` — Mobile input handling
15. `capacitor-splash-screen` — Polish
16. `capacitor-accessibility` — Compliance

### ⭐ MEDIUM (Reference as needed)
17. `capacitor-app-upgrades` / `capacitor-plugin-upgrades` — Future version bumps
18. `capgo-live-updates` — OTA updates consideration
19. `capacitor-app-store` — App Store submission (future)
20. `capacitor-mcp` — Agent tooling
21. `capacitor-expert` — Advanced reference

### ⭐ LOW / Not Applicable
22. All Ionic skills — Example Marketplace doesn't use Ionic
23. All Cordova/Appflow/Enterprise migration skills — Not applicable
24. Angular/Vue/Svelte skills — Not used
25. Capgo/Capawesome cloud services — Using Base44 instead
26. `cocoapods-to-spm` — No iOS yet
27. `capacitor-in-app-purchases` — No IAP planned
28. `konsta-ui` — Using Tailwind + shadcn/ui
29. `sqlite-to-fast-sql` — Not using SQLite yet
30. `skill-creator` — Meta skill, not app-specific

---

## Layer 3 Detail Files

| File | Source Skills | Lines | Size |
|------|--------------|-------|------|
| [details/app-creation-setup.md](details/app-creation-setup.md) | capacitor-app-creation, capacitor-app-development, capacitor-react, framework-to-capacitor | 481 | 16KB |
| [details/plugins-development.md](details/plugins-development.md) | capacitor-plugins (×2), capacitor-plugin-development, capacitor-plugin-spm-support (×2) | 280 | 13KB |
| [details/upgrades-migrations.md](details/upgrades-migrations.md) | 18 upgrade/migration skills | 603 | 21KB |
| [details/ionic-framework.md](details/ionic-framework.md) | 7 Ionic skills | 717 | 26KB |
| [details/testing-cicd-best-practices.md](details/testing-cicd-best-practices.md) | capacitor-testing, capacitor-ci-cd, capacitor-mcp, capacitor-best-practices, capacitor-expert | TBD | TBD |
| [details/ui-design-features.md](details/ui-design-features.md) | tailwind-capacitor, konsta-ui, capacitor-splash-screen, capacitor-keyboard, capacitor-accessibility, capacitor-in-app-purchases | TBD | TBD |
| [details/deep-linking.md](details/deep-linking.md) | capacitor-deep-linking | 262 | 6.9KB |
| [details/capsec-security.md](details/capsec-security.md) | capacitor-security | 459 | 12KB |
| [details/debugging-capacitor.md](details/debugging-capacitor.md) | debugging-capacitor | 400 | 9.3KB |
| [details/ios-android-logs.md](details/ios-android-logs.md) | ios-android-logs | 308 | 7KB |
| [details/safe-area-handling.md](details/safe-area-handling.md) | safe-area-handling | 434 | 11KB |
| [details/framework-integration.md](details/framework-integration.md) | framework-specific integration notes | 262 | 5.5KB |
| [details/architecture-overview.md](details/architecture-overview.md) | Cross-cutting architecture notes | 151 | 5.1KB |
| [details/plugins-spm.md](details/plugins-spm.md) | SPM support notes | 199 | 4.9KB |

**Total extracted:** ~4,700+ lines of procedures, mechanisms, error handling, and Example Marketplace-specific relevance.

---

## Security Tool: Capsec

**Part of:** `capacitor-security` skill (Capgo pack)
**Usage:** `npx capsec scan`
**CI mode:** `npx capsec scan --ci` (fails on high/critical)
**Rules:** 63+ checks including:
- Hardcoded secrets and API keys
- Insecure storage patterns
- Network security issues
- Platform-specific vulnerabilities
- Authentication weaknesses

---

## Example Marketplace Context

**Current Capacitor version:** v6
**Current plugins:** `@capacitor/browser`, `@capacitor/status-bar`
**Planned:** OneSignal push notifications, deep linking (OAuth) — partially implemented
**Build process:** Local Gradle build → AAB → Play Console manual upload
**Stack:** React 18 + Vite + Base44 SDK + Tailwind + shadcn/ui
**Package:** `com.example-marketplace.app`

---

## Reference

- Capawesome skills: https://github.com/capawesome-team/skills
- Capgo skills: https://github.com/Cap-go/capgo-skills
- Capawesome blog: https://capawesome.io/blog/announcing-open-source-ai-agent-skills-for-capacitor/
- Capgo skills page: https://capgo.app/skills/
