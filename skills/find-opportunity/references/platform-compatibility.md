# Platform Compatibility Guide

## Detecting the Platform

Read the platform from:
- `platform:` field in builder profile (Base44, Vercel, Supabase, Firebase, etc.)
- `docs/specs/platform-operating-model.md` or similar platform docs
- Existing project stack signals (e.g., `base44.json`, `vercel.json`, `firebase.json`)

If a platform is detected, it becomes a **compatibility signal**, not a hard filter.

## Compatibility Matrix

| Platform | Native fit (bonus) | Neutral (no penalty) | Stack mismatch (penalty) |
|---|---|---|---|
| **Base44** | Web apps, API services, AI wrappers, notification services | Chrome extensions (Base44 backend), templates, info products | Mobile apps (Swift/Kotlin), desktop apps (Electron/Tauri), CLI tools requiring local runtime |
| **Vercel** | Web apps, SaaS dashboards, API routes, landing pages | Chrome extensions, templates, info products | Mobile apps, CLI tools, desktop apps |
| **Supabase/Firebase** | Web apps, real-time tools, auth-heavy SaaS | Chrome extensions, mobile (Expo/React Native), templates | Native iOS/Android, CLI tools requiring local DB |
| **Shopify** | Shopify apps, storefront tools | Standalone SaaS (can use Shopify APIs) | Nothing — Shopify is additive |
| **Chrome Web Store** | Chrome extensions | Web apps (companion dashboard), templates | Mobile apps, CLI tools |
| **No platform / open** | All categories | All categories | None |

## Scoring

- **Native fit (+3):** Product lives on the platform. Builder has infra advantage.
- **Neutral (+0):** Product uses the platform partially or not at all. Skills transfer.
- **Stack mismatch (-5):** Product requires a completely different stack the builder
  has no experience with AND the platform doesn't help.

**Platform-specific opportunity bonus (+3 additional):**
If the opportunity leverages a UNIQUE platform capability (Base44's AI agents,
Vercel's Edge functions, Supabase real-time), add +3 to Builder Fit.

## Rules

1. **NEVER eliminate a category solely for platform mismatch.**
2. Only eliminate if the product's CORE technology is incompatible AND the builder
   has zero transferable skills. A React developer on Base44 can build a Chrome
   extension (React + JS). They cannot build a Swift iOS app.
3. If no platform detected: scan all categories. Platform compatibility is a bonus
   in scoring (+3 native, +0 neutral, -5 mismatch).
