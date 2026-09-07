# External Add-On Packs

This repository ships a **core skill pack** (100 skills — source of truth: `skills-manifest.json` `includedSkills`; do not trust this prose count). Some routes in
`route-workflow` support optional external ecosystems.

Use this file as the contract for which external skills are optional and how
they attach to the core pipeline.

## Cross-cutting policy: live-evidence post-hook

External-addon skills produce visible artifacts that ship to production
(popups, ad-creative, signup, paywalls, cro, onboarding). Per
`_shared/live-evidence.md`, these MUST end
with live in-app screenshot capture in both light + dark theme as a
terminal gate.

Since svc does not modify external skills in-place, the gate is enforced
at the **orchestrator level** by `route-workflow`'s post-skill hook (see
`skills/route-workflow/SKILL.md` § "Post-skill hook — Live evidence capture for
visual-output skills"). The hook auto-invokes the canonical capture script
when the active skill is in the visual-output set, runs the eyeball
checklist, and blocks `.svc/lane-tasks-<WI>.json` status from going to
`completed` on hard-fail.

This means external addons get the same protection as svc-native skills
without requiring upstream PRs or local forks.

Validator: `test-framework/evals/tier-1/validate-visual-skills-have-live-evidence.sh`.

## Core Pack (always available)

<!-- svc:generated:begin external-core-pack — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
- `ad-video-script`
- `align-feature`
- `analyze-competitors`
- `analyze-domain`
- `analyze-marketing`
- `assess-market-readiness`
- `audit-ac`
- `audit-coverage`
- `audit-feature`
- `audit-implementation`
- `audit-session-execution`
- `base44-environment`
- `benchmark-landing`
- `blend-external`
- `blend-private`
- `blind-control-plan`
- `build-personas`
- `capability-concierge`
- `capability-registry`
- `capture-idea`
- `catalog-domain-capabilities`
- `comms`
- `cos`
- `counsel`
- `craft-prompt`
- `create-skill`
- `customer-cs`
- `decide`
- `define-code-style`
- `design-logo`
- `design-tech`
- `design-ui`
- `design-ux`
- `diagnose-bug`
- `discover-skills`
- `discuss-phase`
- `dispatch-waves`
- `evaluate-rule`
- `evolve-framework`
- `execute-changeset`
- `explore-solutions`
- `explore-ux`
- `extract-bootstrap`
- `fin-analyst`
- `find-opportunity`
- `generate-visuals`
- `growth-eng`
- `growth-lead`
- `honest-diagnosis`
- `improve-framework`
- `infra-sre`
- `ingest-guide`
- `ingest-guide-batch`
- `land-changeset`
- `landing-page`
- `launch-knowledge`
- `list-work-items`
- `manage-finops`
- `manage-learnings`
- `market-intel`
- `mine-builder`
- `monetization-architecture`
- `onboard-repo`
- `plan-blast-radius`
- `plan-capabilities`
- `plan-changeset`
- `platform-operating-architect`
- `privacy-dpo`
- `procurement`
- `produce-ad-video`
- `product-lead`
- `quick-fix`
- `recall-stack-knowledge`
- `refresh-competitors`
- `research`
- `reverse-engineer`
- `review-cross-model`
- `review-exec`
- `review-gate`
- `review-plan`
- `review-security`
- `revops`
- `roadmap-evaluation`
- `route-workflow`
- `security-ops`
- `stage-revenue`
- `strategic-decision`
- `suno-architect`
- `svc-advisor`
- `sync-spec-code`
- `sync-work-items`
- `tax-auditor`
- `teach-project`
- `test-framework`
- `test-journeys`
- `track-topology-diff`
- `track-visuals`
- `validate-feature`
- `verify-promotion`
- `write-e2e`
- `write-journeys`
- `write-spec`
- `write-vision`
- `wsl2-audio`
- `propose-ux-improvements`
<!-- svc:generated:end external-core-pack -->

## External-grade skills shipped inside `includedSkills` (WI-CLN-2 / §2.6)

Two skills live in the manifest's `includedSkills` but are **external-grade** —
host-specific or creative rather than core pipeline. They remain in the manifest
because the structure validator errors on any top-level `*/SKILL.md` directory
absent from `includedSkills`; they are NOT in `corePackForRouting`, `pipeline`,
or any lane definition. Treat them as addons, not core framework signal.

| Skill | Class | Why external-grade |
|-------|-------|--------------------|
| `wsl2-audio` | host-support | WSL2 audio troubleshooting — host-specific, not pipeline logic |
| `suno-architect` | creative | Music/Suno prompt architecture — creative domain, not core delivery |

## Add-On: last30days (optional, recommended)

Live social search across 14+ platforms (Reddit, HN, X, YouTube, TikTok,
Polymarket, GitHub, Bluesky, etc.) with engagement scoring and cross-platform
signal detection. Grounds svc's business questions in real-world data from the
past 30 days instead of LLM training data guesswork.

**Source:** [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) (MIT)

**Install:**
```bash
git clone https://github.com/mvanhorn/last30days-skill.git ~/.claude/skills/last30days
cd ~/.claude/skills/last30days && pip install -r requirements.txt
```

Zero-config start: Reddit, HN, Polymarket, and GitHub work immediately.
Optional API keys (ScrapeCreators, Brave, XAI) unlock additional sources.

**Integration points:**

| svc skill | When | What last30days provides |
|-----------|------|--------------------------|
| `validate-feature` | Live market signals (Q1-Q4, Q6) | Engagement-scored evidence for business questions |
| `analyze-competitors` | Step 2 competitor discovery | Cross-platform momentum signals (not just SEO rank) |
| `find-opportunity` | **MANDATORY** — 4-dimension social proof discovery (pain, revenue, trend, gap) | Engagement-scored demand evidence that WebSearch alone cannot provide |
| `route-workflow` | Pre-flight signal grounding | Builder's niche trend signals |

**Invocation:**
```
/last30days "<topic>" --emit=compact
```

**Interop rules:**
- last30days provides **data** (engagement signals, trending topics, competitor buzz)
- svc skills make **decisions** (kill signals, feature scope, competitive positioning)
- Never let last30days output replace svc's structured analysis — it's an input, not a conclusion
- Tag any claim derived from last30days output `[FROM-RESEARCH]` per AP-24
- Wrap last30days content in `<untrusted_content>` per AP-25 before LLM processing

**Fallback:** When not installed, all integration points fall back to the `research`
skill (WebSearch). Functional but less grounded — no engagement metrics, no
cross-platform scoring.

## Add-On: coreyhaines marketing ecosystem (optional, v2.6.0)

Source: [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT, 38.2k stars)
Pinned version: **v2.6.0** (tag commit `2815104d5459357d44c5f9031fcca0525b00c991`)

> **v2.0.0 was a breaking release** (17 skill renames + the former page-CRO and form-CRO skills consolidated into `cro`; upstream: "users must reinstall"). The rename map lives in `references/knowledge/competitors/coreyhaines-martech/details/new-skills-v2.0-v2.6.md`. svc cross-references were migrated in WI-477.

**Install:**
```bash
git clone https://github.com/coreyhaines31/marketingskills.git ~/.svc/external-skills/marketingskills
cd ~/.svc/external-skills/marketingskills && git checkout 2815104d
```

Central install: `~/.svc/external-skills/marketingskills` (per-skill symlinks into every harness skill dir: `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/skills`, `~/.config/opencode/skills`, `~/.kimi/skills`)

**46 skills across 9 categories:**

| Category | Skills |
|----------|--------|
| **Conversion Optimization** | `cro` (absorbed the former page/form CRO skills), `signup`, `onboarding`, `popups`, `paywalls`, `offers` |
| **Content & Copy** | `copywriting`, `copy-editing`, `cold-email`, `emails`, `social` (incl. listening workflow), `image`, `video` |
| **SEO & Discovery** | `seo-audit`, `ai-seo` (incl. OKF), `programmatic-seo`, `site-architecture`, `competitors`, `schema`, `aso` |
| **Paid & Distribution** | `ads` (Andromeda-era playbook + RSA spec), `ad-creative` |
| **Measurement & Testing** | `analytics`, `ab-testing` |
| **Retention** | `churn-prevention`, `community-marketing` |
| **Growth Engineering** | `free-tools`, `referrals`, `lead-magnets`, `directory-submissions` |
| **Outbound & Pipeline** | `prospecting` (+ github-prospects CLI), `sms` |
| **Strategy & Sales** | `marketing-ideas`, `marketing-psychology`, `marketing-plan` (fCMO AARRR generator), `marketing-loops` (43-loop ops layer), `public-relations`, `co-marketing`, `launch`, `pricing`, `customer-research`, `competitor-profiling`, `content-strategy`, `revops`, `sales-enablement` |

**Foundation skill:** `product-marketing` — read by all other skills first

**Tools included:** 65 CLI tools (`tools/clis/`), Composio MCP integration (`tools/composio/`), 93 integration guides (`tools/integrations/`)

**Updating (re-pin + relink):**
```bash
cd ~/.svc/external-skills/marketingskills && git fetch --tags && git checkout <new-tag>
# then relink every harness farm (removes stale links, links every current skills/* dir):
MS="$HOME/.svc/external-skills/marketingskills"
for H in ~/.claude/skills ~/.codex/skills ~/.gemini/skills ~/.config/opencode/skills ~/.kimi/skills; do
  find "$H" -maxdepth 1 -type l -lname "$MS/*" -delete
  for s in "$MS"/skills/*/; do ln -s "${s%/}" "$H/$(basename "$s")"; done
done
```
A plain `git pull` is NOT enough across major versions — renamed skill dirs leave dangling host symlinks.

Use these only when installed:

- `product-marketing`
- `customer-research`
- `market-competitors`
- `competitors`
- `copywriting`
- `cro`
- `launch`
- `market-social`
- `market-ads`
- `market-emails`
- `signup`
- `onboarding`

Recommended integration point:
1. Run `analyze-marketing` first to generate canonical context from svc mining.
2. If you use coreyhaines `product-marketing`, run it as a transformer:
   start from the existing context artifact and adapt/expand language without dropping svc insight payload.
3. Context artifact path: upstream's canonical filename is now `.agents/product-marketing.md`, but every upstream skill still falls back to the legacy `.agents/product-marketing-context.md` filename. **svc keeps writing the legacy filename** (analyze-marketing's writer path is unchanged; migrating the artifact path is a recorded follow-up candidate, not part of WI-477).
4. Feed the context artifact into downstream add-on skills as grounding context.
5. If an add-on hardcodes a `.claude/`-prefixed context path, mirror from `.agents` for compatibility, but keep `.agents` as canonical source.

Interop rule:
- Shared canonical file path: `.agents/product-marketing-context.md` (legacy filename svc writes; upstream fallback-reads it) and `docs/specs/marketing-context.md` (svc-canonical, post-WI-135).
- Serious Vibe Coding `analyze-marketing` runs first and is the source of truth for weighted feature insights and tracker sync (`docs/marketing/feature-mining-tracker.json`).
- Coreyhaines `product-marketing` is a downstream transformation pass over svc output.

### Integration points (svc → coreyhaines)

The following svc skills consume coreyhaines outputs as INPUT, or are consumed BY coreyhaines workflows:

| svc skill | Direction | What flows |
|-----------|-----------|------------|
| `analyze-marketing` | svc → coreyhaines | svc mines feature specs and writes the canonical marketing context (`docs/specs/marketing-context.md`); coreyhaines `product-marketing` reads this as starting state for its own transformer pass. |
| `validate-feature` | coreyhaines → svc | When validating a new feature idea, optionally consume coreyhaines `customer-research` output (interview transcripts, ICP signals) and `competitor-profiling` output (competitor URL profiles) as supplemental signal. |
| `find-opportunity` | coreyhaines → svc | Consume coreyhaines `marketing-ideas` (idea generation) and `directory-submissions` (channel inventory) outputs as candidate-set inputs to opportunity scoring. |
| `write-spec` | coreyhaines → svc | Optionally reference coreyhaines CRO patterns (`cro`, `popups`) when writing ACs for conversion-sensitive UI; svc spec format remains the source of truth. |
| fleet agents | coreyhaines → svc | `revops` → `prospecting`/`sms`; `comms` → `public-relations` + `social` listening workflow; `growth-lead` → `marketing-plan`/`marketing-loops`; `ad-strategist` → `ads` (WI-478). |

### What svc does NOT rebuild (external-only)

The following capabilities live exclusively in the coreyhaines addon. svc does NOT and SHOULD NOT re-implement them inside the framework:

- **46 specialized marketing-execution skills** — cro, copywriting, seo-audit, ad-creative, churn-prevention, marketing-loops, etc. (full list in the categories table above). svc is a development pipeline framework, not a marketing-execution framework.
- **65 CLI tools** under `tools/clis/` — API-access shims for marketing platforms (Stripe, GA4, Hubspot, Apollo, GitHub prospecting, etc.). Use the addon's tools directly; do not re-implement.
- **93 integration guides** under `tools/integrations/` — vendor-specific reference docs. Read in place; do not copy into svc.
- **Composio MCP integration** under `tools/composio/` — 15+ OAuth integrations bundled. Use the addon's MCP config, not a parallel svc one.
- **The 43-loop marketing-ops catalog** (`marketing-loops`) — svc consumes it at runtime; the svc-side complement (loop-state receipts, blend item 1) is governance, not a re-implementation.

If a marketing-execution capability is missing from coreyhaines, prefer filing an upstream issue or contributing back rather than building a parallel implementation inside svc.

## Add-On: Capacitor Skills — Capawesome + Capgo (optional)

Comprehensive Capacitor mobile development skill packs covering React/Vite/Angular/Vue
integration, 160+ plugins, security scanning (Capsec), testing (Vitest/Playwright/Appium),
CI/CD (GitHub Actions/Fastlane), and live updates (OTA).

**Source:**
- [capawesome-team/skills](https://github.com/capawesome-team/skills) (MIT) — 25 skills
- [Cap-go/capgo-skills](https://github.com/Cap-go/capgo-skills) (MIT) — 47 skills

**Install (global, all hosts):**
```bash
npx skills add capawesome-team/skills -g -a "*" -y
npx skills add Cap-go/capgo-skills -g -a "*" -y
```

Skills land in `~/.agents/skills/` and are symlinked into every detected host
(Claude Code, Codex, Kimi, Gemini, OpenCode, etc.).

**When to use:** Project uses Capacitor for mobile app development. Auto-detection
signal: `capacitor.config.ts` or `@capacitor/core` in `package.json`.

**What it provides (highlights):**

| Pack | Skills include |
|------|----------------|
| Capawesome | `capacitor-react`, `capacitor-vue`, `capacitor-angular`, `capacitor-app-creation`, `capacitor-app-development`, `capacitor-app-upgrades`, `capacitor-plugin-development`, `capacitor-plugin-upgrades`, `capacitor-plugin-spm-support`, `capacitor-push-notifications`, `capacitor-in-app-purchases`, `capawesome-cli`, `capawesome-cloud`, `ionic-react/vue/angular`, `ionic-app-creation/development/upgrades`, `ionic-appflow-migration`, `ionic-enterprise-sdk-migration` |
| Capgo | `capacitor-plugins`, `capacitor-expert`, `capacitor-security` (Capsec), `konsta-ui`, `tailwind-capacitor`, `safe-area-handling`, `ios-android-logs`, `sqlite-to-fast-sql`, plus testing / CI/CD / OTA-update guidance |

**Integration points:**

| svc skill | Direction | What flows |
|-----------|-----------|------------|
| `route-workflow` | svc → external | When intent matches Capacitor surface ("add push notifications", "fix deep links", "build Android app", "add native plugin"), route to the external Capacitor skills instead of svc generics. |
| `platform-operating-architect` | external → svc | Use Capacitor skills' `Capacitor.isNativePlatform()` / `getPlatform()` guard patterns when classifying hybrid-mobile platform constraints. |
| `review-security` | external → svc | For Capacitor projects, run `npx capsec scan --ci` (from Capgo's `capacitor-security` skill) as a pre-flight scanner before STRIDE / OWASP analysis. |
| `execute-changeset` | external → svc | Capacitor skills are active participants during native-implementation tasks (plugin install, platform config, build commands). |
| `discover-skills` | external → svc | Use Capacitor packs' decision-matrix pattern (official → community → alternative) when comparing tools within a domain. |

**Interop rules:**
- Capacitor skills handle **implementation details** (plugin install, native config, platform builds).
- svc handles **pipeline orchestration** (gates, reviews, landing, verification).
- During design phases, treat Capacitor skills as read-only references.
- During execution phases, Capacitor skills are active participants inside the lane.

**What svc does NOT rebuild (external-only):**
- Capacitor plugin catalog and installation guides
- Platform-specific build instructions (Android Gradle, iOS Xcode)
- Capacitor major-version upgrade procedures (v4 → v5 → v6 → v7 → v8)
- Cordova → Capacitor migration guides
- Ionic Framework patterns (when project uses Ionic)
- Capgo cloud / live-update product features

**What svc still owns:**
- Pipeline routing and gate decisions
- Builder profile and market-readiness assessment
- Cross-project knowledge management
- Framework self-improvement

**Fallback:** When not installed, agents fall back to generic platform / mobile
guidance via the `research` skill — functional but less specific.

## L2 Per-Project Pack Partitioning (WI-377)

External packs as globally-symlinked skills cost every project their description
budget (live measurement 2026-06-07: 214 skills = 241% of the native budget —
eviction was silently dropping trigger surfaces). Plugins are the only NATIVE
per-project lever (`enabledPlugins` in committed `.claude/settings.json`).

**One-time per machine (USER-GATED — mutates shared ~/.claude state):**

```bash
bash scripts/migrate-packs-to-plugins.sh           # dry-run: prints the plan
bash scripts/migrate-packs-to-plugins.sh --apply   # wraps packs as plugins, unlinks globals
```

This wraps the agents-dir packs (capawesome+capgo, ~63 skills) and the
marketing pack (~40) as `svc-pack-marketplace` plugins over SYMLINKS to the
original sources (upstream updates flow through), removes the duplicate global
symlinks (incl. base44-* dupes of the existing `base44@base44-skills` plugin),
and leaves per-project control to settings:

```jsonc
// project .claude/settings.json — svc repo ships these OFF:
"enabledPlugins": {
  "svc-agents-skills-pack@svc-pack-marketplace": false,
  "svc-marketing-pack@svc-pack-marketplace": false,
  "base44@base44-skills": false
}
// Example Marketplace (or any Capacitor/Base44 project) flips its own to true.
```

**Cross-harness:** the migration is Claude-host-scoped by construction (only `~/.claude/skills` is touched; verified live — other hosts' skill dirs carry svc content only and no pack links). Pack sources remain in `~/.agents/skills` for any host's wirer. Per-project pack control on OTHER hosts = their wirers' follow-up, not this script.

Rollback is TWO steps (disabling plugins alone does NOT restore the removed
globals): disable the plugins, then run the generated
`~/.claude/svc-pack-marketplace/relink-globals.sh` (written on --apply) or the
upstream installers. L3 `paths:` scoping for pack skills belongs UPSTREAM
(pack sources are external repos) — descoped here, noted for contribution.

## Add-On: Anthropic skill-creator (optional)

The official Anthropic `skill-creator` from [anthropics/skills](https://github.com/anthropics/skills).
Full skill creation pipeline with eval viewer, benchmark aggregation, subagent-based
A/B testing, and automated description optimization.

```bash
npx skills add anthropics/skills --skill skill-creator
```

**How it integrates with svc:**

Use Anthropic's skill-creator directly to author the skill, run evals, and
optimize the description. Then apply the svc checklist from CONTRIBUTING.md
to add pipeline wiring (frontmatter fields, manifest, README).

## Add-On: implementation-planning (optional)

Some routes reference repo-specific implementation planning. If a planning skill
such as `writing-plans` exists in your environment, treat it as optional add-on.


## Mandatory Plan-Exec-Review Chain (added by mandatory-chain rollout)

The `feat/mandatory-plan-exec-chain` branch introduces a three-layer
enforcement system that makes plan-changeset + review-plan +
execute-changeset + review-exec + audit-implementation + land-changeset
+ verify-promotion mandatory for every non-quick-fix change.

Key additions:
- `skills/review-exec/SKILL.md` — new G6 gate (self-review + adversarial via resolver)
- `scripts/quick-fix-eligibility.mjs` — mechanical quick-fix gate
- `scripts/svc-reconcile.mjs` — local L3 gate (responsibilities A + B)
- `scripts/run-external-review.mjs` — canonical schema/receipt/cache review launcher
- `scripts/resolve-adversarial-reviewer.sh` — probe-free exact tuple policy view
- `scripts/install-git-hooks.mjs` — installs hook dispatchers into .git/hooks/
- `hooks/git/{pre-commit,post-commit,pre-push}.d/` — slot directories
- `refs/notes/svc-receipts` — durable receipt store (per commit)
- Working-tree mirror at `.svc/receipts/<sha>/` (gitignored, regenerable)

For full context: see the plan-changeset producing this work and
`references/chain-receipt-contract.md`.
