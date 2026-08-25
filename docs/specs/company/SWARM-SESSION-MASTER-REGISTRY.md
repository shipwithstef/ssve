# 📊 SURGE SOFTWARE EOOD — SWARM SESSIONS & WORK ITEMS MASTER REGISTRY (/cos)

> **Company Operating System (COS) Living Ledger of all Swarm Worktrees, Multi-Agent Sessions, Promotions, Vault Secrets, and Deliverables.**
> *Single Source of Truth across Antigravity, Cursor Auto, Codex, and Grok Swarm Fleet.*
> *Last Updated: Tuesday, August 25, 2026 at 15:06 UTC+3*

---

## 🏆 Tier 1: 100% PROMOTED, MERGED TO MAIN & DEPLOYED LIVE

| Work Item ID | Domain / Scope | Worktree / Branch | Lead Model | Status | Verified Delivery SHA / Evidence |
|---|---|---|---|---|---|
| **`WI-I18N-SWITCH-REACTIVE-01`** | Instant reactive UI language switcher (<16ms sync) & persistent manual choice | `wt-lane-i18n-switch-reactive` -> `feat/i18n-switch-reactive` | Codex 5.6 Sol High | **PROMOTED & LIVE** | `f3f927bc9` • 975/975 tests passed • Staging & Prod 200 OK |
| **`WI-UI-I18N-WRAP-POLISH-01`** | 30-locale mobile typography, elastic cards, zero-overflow viewports | `wt-lane-ui-i18n-wrap-polish` -> `feat/ui-i18n-wrap-polish` | Codex 5.6 Sol High | **PROMOTED & LIVE** | `dac04466d` • 20/20 mobile geometry tests passed |
| **`WI-THEME-FIRST-VISIT-SOLAR-01`** | Real-time solar daylight engine (06:00–20:30 Cream vs 20:30–06:00 Dark) | `wt-lane-theme-first-visit-solar` -> `feat/first-visit-daylight-theme` | Codex 5.6 Sol High | **PROMOTED & LIVE** | `821a9741a` • Synchronous bootstrap in `<1ms` |
| **`WI-562` (Multi-Agent Swarm Graph)** | Process-death-proof authority locks, CAS mutex, atomic digests in `seriousvibecoding` | `wi-562-swarm-graph-engineering` | Codex 5.6 & OpenCode | **PROMOTED & MERGED** | `784b764b` • 348/350 tests • 25+ commits, ~70 files |
| **`WI-AI-FEATURES-01`** | AI feature availability toggles, Deno edge-gateway fallback | `wt-lane-ai-features` | Codex 5.6 Sol High | **PROMOTED & LIVE** | `3f815192` • Unit & runtime gates passed |
| **`WI-ANDROID-BETA-01`** | Google Play Production submission (`vc125` signed AAB + release keystore) | `main` / `android/` | Orchestrator & Codex | **SUBMITTED & SIGNED** | `hourshub-release.keystore` in Azure Key Vault `kv-surge-dev-1` |
| **`IARC-LIVE-RATING-01`** | Official IARC Global Age Rating Certificate (`5d663b18-1c47-8060-89d0-3f827a866ac0`) | `docs/specs/compliance/` | GlobalRatings.com / IARC | **LIVE & ACTIVE** | PEGI 3 / ESRB Everyone / USK 0 certified |

---

## 🎬 Tier 2: MARKETING & CREATIVE ASSETS DELIVERED TO WINDOWS

| Asset ID | Scope | Output File & Resolution | Lead Model | Status | Windows Local Location |
|---|---|---|---|---|---|
| **`VIDEO-EN-MASTER-01`** | 1080p English Master Video (Clean instrumental bed, ducked to -22dB, on-glass UI) | `lightning-slots-master-english.mp4` (49 MB) | Grok High | **DELIVERED** | `C:\Users\Dell\Downloads\lightning-slots-master-english.mp4` |
| **`VIDEO-BG-MASTER-01`** | 1080p Bulgarian Master Video (Kalina VO, Bulgarian captions, on-glass UI) | `lightning-slots-master-bulgarian.mp4` (49 MB) | Grok High | **DELIVERED** | `C:\Users\Dell\Downloads\lightning-slots-master-bulgarian.mp4` |
| **`VIDEO-MASTER-PERFECT`** | Dual-track sidechain compressed 36s master cut | `lightning-slots-master-perfect.mp4` (49 MB) | Grok High | **DELIVERED** | `C:\Users\Dell\Downloads\lightning-slots-master-perfect.mp4` |

---

## ⚙️ Tier 3: CURRENTLY ACTIVE / IN EXECUTION

| Work Item ID | Domain / Scope | Worktree / Branch | Lead Model / PID | Current Phase | Next Immediate Milestone |
|---|---|---|---|---|---|
| **`WI-SSVE-ARCHITECTURE-EVOLUTION-02`** | Framework evolution (SR-1/SR-3 stage unification, SR-4 manifest digest, HW-7 catalog cutover, 350/350 Tier-1 test fix) | `seriousvibecoding/.worktrees/wi-ssve-architecture-evolution-02` (`feat/ssve-architecture-evolution-02`) | Cursor Agent (`PID 558249`) & OpenCode 0x-alpha | **Executing Waves E1–E4** | Run all Tier-1 evals -> 350/350 PASS -> land to `origin/main` |
| **`WI-IOS-AZURE-PIPELINE-01`** | Azure Pipelines macOS-14 cloud runner for iOS build & TestFlight upload | `azure-pipelines-ios.yml` | Architecture Spec | **Awaiting ASC `.p8` Key** | Download `.p8` from `appstoreconnect.apple.com` to `Downloads/` |
| **`WI-ANDROID-BETA-GROUPS-SYNC-01`** | Automated Google Directory API sync for `beta-testers@hourshub.app` | `supabase/functions/android-beta-waitlist/` | Codex Medium | **Code Complete** | Add Service Account client email to Google Group |

---

## 🔒 Tier 4: SECURE VAULT SECRETS LEDGER (Azure Key Vault: `kv-surge-dev-1`)

1. `HOURSHUB-ANDROID-UPLOAD-KEYSTORE-B64` — Production Android release keystore.
2. `HOURSHUB-ANDROID-KEYSTORE-PROPERTIES-B64` — Passwords, key aliases, and store properties.
3. `IARC-GLOBAL-RATING-ID` — `5d663b18-1c47-8060-89d0-3f827a866ac0`.

---

## 🔄 RESUMPTION INSTRUCTIONS FOR CURSOR AUTO & OTHER AGENTS:
When resuming from this COS ledger:
1. Inspect the **Tier 3 (Active)** table above to find the active worktree path.
2. Check `.svc/lane-tasks-*.json` in that worktree for current task status.
3. Verify test passes via `bash test-framework/evals/run-all-evals.sh` (must be 350/350 green).
4. Land completed work via fast-forward merge to `origin/main`.
