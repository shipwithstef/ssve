# Blend Plan: Capacitor Skills (Capawesome + Capgo)

**Source:** `capawesome-team/skills` + `Cap-go/capgo-skills`
**License:** MIT (both)
**Date:** 2026-04-29
**Previous blend:** First blend
**Total skills analyzed:** 72
**Detail files extracted:** 22 (~7,700 lines, ~300KB)

---

## Summary

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | Structured skill procedures | `create-skill/SKILL.md` | Skills lack consistent step-by-step format; agents improvise structure per skill | Add "Procedures" section template with Step N pattern, auto-detection checklist, error handling table |
| 2 | Plugin catalog / decision matrix | `discover-skills/SKILL.md` | No systematic way to compare tools within a domain; agents rely on memory | Add decision-matrix pattern for any domain with >5 tools: official vs community vs alternative |
| 3 | Security scanning hook | `review-security/SKILL.md` | Mobile security audits are manual; no automated scanner integration | Add Capsec (`npx capsec scan --ci`) as optional pre-flight security gate for Capacitor projects |
| 4 | Platform-aware execution | `platform-operating-architect/SKILL.md` | Platform detection is ad-hoc; no systematic platform-conditional guidance | Add `Capacitor.isNativePlatform()` / `Capacitor.getPlatform()` guard patterns as canonical example |
| 5 | External addon registry | `EXTERNAL_ADDONS.md` | No systematic way to track which external skill packs are installed per project type | Add Capawesome + Capgo as registered external addons with install commands and integration points |

**Verdict counts:** 5 BLEND, 67 SKIP, 0 HYBRID/IMPROVE

---

## Assessment A: Blend Opportunities

### 1. Structured Skill Procedures → `create-skill/SKILL.md`

**From:** `capawesome/skills/capacitor-react/SKILL.md` (lines 27-248)
**Into:** `skills/create-skill/SKILL.md` — Skill template / structure conventions

**The problem in svc today:**
svc skills vary widely in internal structure. Some have "Steps", some have "Workflow", some have "How to Use". The `capacitor-react` skill demonstrates a consistent format that every skill in the Capawesome pack follows:
1. Prerequisites (numbered, with version requirements)
2. Agent Behavior (auto-detect before asking, step-by-step guidance)
3. Procedures (Step 1, Step 2... with code blocks)
4. Error Handling (table with symptom → cause → fix)
5. Related Skills (cross-references)

This consistency means agents know what to expect when loading any Capawesome skill. svc skills lack this predictability. An agent loading `review-gate` sees a different structure than `design-tech`.

**How the source solves it:**
Capawesome skills enforce a rigid template:
- Frontmatter with `name`, `description`, `metadata.author`, `metadata.source`
- Description includes trigger situations AND anti-triggers ("Do not use for...")
- Procedures are always numbered steps with explicit commands
- Error handling is always a table
- Code blocks are copy-paste ready, not pseudocode

**What this changes in svc:**
Add a "Skill Structure Template" section to `create-skill/SKILL.md`:
```markdown
## Skill Structure Template

All skills SHOULD follow this structure:

### Frontmatter
```yaml
---
name: skill-name
description: "Trigger situations. Anti-triggers."
metadata:
  author: <name>
  source: <url>
---
```

### Sections (in order)
1. **Prerequisites** — numbered, with version requirements
2. **Agent Behavior** — auto-detection rules, guidance style
3. **Procedures** — Step 1, Step 2... with exact commands
4. **Error Handling** — symptom → cause → fix table
5. **Related Skills** — cross-references
```

**What NOT to take:**
- Capawesome's "One decision at a time" conversational style — svc skills are non-interactive pipeline steps, not chat guides
- Capawesome's framework-specific examples (Angular, Vue) — keep framework-agnostic

**Why this matters:**
Consistent skill structure reduces agent confusion and improves skill quality. When every skill follows the same template, agents can reliably find the "Error Handling" section instead of guessing whether it's called "Troubleshooting", "Common Issues", or "Edge Cases".

**Hybrid opportunity:**
Combine Capawesome's rigid structure with svc's existing frontmatter schema (which already has `name`, `description`, `inputs`, `outputs`, `chain`). The result is a unified template that works for both simple domain skills AND complex pipeline skills.

---

### 2. Plugin Catalog / Decision Matrix → `discover-skills/SKILL.md`

**From:** `capgo/skills/capacitor-plugins/SKILL.md` (lines 74-268)
**Into:** `skills/discover-skills/SKILL.md` — Tool comparison methodology

**The problem in svc today:**
`discover-skills` finds and ranks skills, but there's no systematic pattern for comparing tools WITHIN a domain. When an agent needs to choose between 5 OAuth libraries or 3 charting libraries, it improvises a comparison.

**How the source solves it:**
The `capacitor-plugins` skill has a decision matrix:
1. Check official packages first
2. Escalate to community plugins when official is missing/limited
3. Explain WHY a non-official plugin is better
4. Categorize by functional area (Auth, Media, Payments, etc.)

**What this changes in svc:**
Add a "Decision Matrix Pattern" to `discover-skills/SKILL.md`:
```markdown
### Decision Matrix Pattern (for domains with >5 tools)

When comparing tools in a domain:

1. **Check official first** — Does the framework/vendor provide an official solution?
2. **Evaluate gaps** — Is the official solution missing features or too limited?
3. **Compare alternatives** — Community tools that fill the gap
4. **Explain the choice** — Always state WHY the alternative is better
5. **Categorize** — Group by functional area (Auth, UI, Data, etc.)
```

**What NOT to take:**
- The specific Capacitor plugin lists — those are domain-specific, not framework patterns
- Capgo's vendor-specific recommendations (`@capgo/*` packages)

**Why this matters:**
This pattern makes `discover-skills` more useful for non-skill comparisons (MCP servers, npm packages, UI libraries). It turns "find me a tool" into "find me the RIGHT tool with justification."

---

### 3. Security Scanning Hook → `review-security/SKILL.md`

**From:** `capgo/skills/capacitor-security/SKILL.md` (Capsec tool)
**Into:** `skills/review-security/SKILL.md` — Mobile security scanning integration

**The problem in svc today:**
`review-security` does OWASP Top 10 + STRIDE threat modeling, but has no integration with automated security scanners. For Capacitor/mobile projects, security audits are entirely manual.

**How the source solves it:**
Capsec (`npx capsec scan`) is a standalone CLI tool with 63+ security rules:
- Hardcoded secrets detection
- Insecure storage pattern detection
- Network security issues
- Platform-specific vulnerabilities
- Authentication weaknesses
- CI mode: `npx capsec scan --ci` (fails on high/critical)

**What this changes in svc:**
Add a "Mobile Security Scanning" section to `review-security/SKILL.md`:
```markdown
### Mobile Projects: Capsec Integration

For Capacitor/Cordova/Capacitor-based projects:

1. Run `npx capsec scan` during development
2. Run `npx capsec scan --ci` in CI/CD (fails on high/critical)
3. Review findings against OWASP Mobile Top 10
4. Fix before app store submission

**What Capsec covers:**
- Hardcoded secrets and API keys
- Insecure storage patterns (plain text in Preferences)
- Network security (cleartext traffic, certificate pinning)
- Platform-specific vulnerabilities (Android SDK targets, iOS deployment targets)
- Authentication weaknesses

**What svc still owns:**
- Threat modeling (STRIDE)
- Architecture-level security decisions
- Data flow analysis
```

**What NOT to take:**
- Capsec's specific rule definitions — those are tool-specific, not framework patterns
- Capgo's proprietary cloud features — only the open-source CLI

**Why this matters:**
Automated security scanning catches issues that manual review misses (hardcoded keys, insecure storage). Integrating it into `review-security` means mobile projects get the same security rigor as web projects.

---

### 4. Platform-Aware Execution → `platform-operating-architect/SKILL.md`

**From:** `capawesome/skills/capacitor-react/SKILL.md` (lines 146-181)
**Into:** `skills/platform-operating-architect/SKILL.md` — Platform conditional patterns

**The problem in svc today:**
`platform-operating-architect` classifies how projects run on hosted platforms (Base44, Vercel, Supabase, etc.), but doesn't address native mobile platform detection and conditional execution.

**How the source solves it:**
Capacitor skills consistently use platform guards:
```typescript
import { Capacitor } from '@capacitor/core';
const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
```

**What this changes in svc:**
Add a "Native Platform Detection" subsection to `platform-operating-architect/SKILL.md`:
```markdown
### Native Platform Detection

For hybrid mobile apps (Capacitor, Cordova, React Native):

**Pattern:** Always check platform before calling native APIs
```typescript
if (Capacitor.isNativePlatform()) {
  // Use native plugin
} else {
  // Use web fallback
}
```

**Anti-pattern:** Calling native APIs without guards crashes on web
```typescript
// BAD — crashes on web
await Camera.getPhoto({ quality: 90 });

// GOOD — guarded
if (Capacitor.isNativePlatform()) {
  const { Camera } = await import('@capacitor/camera');
  await Camera.getPhoto({ quality: 90 });
}
```

**Platform-specific builds:**
- iOS: Test on physical device (simulator misses some APIs)
- Android: Test on multiple API levels
- Web: Ensure graceful degradation
```

**What NOT to take:**
- Capacitor-specific plugin examples — keep framework-agnostic
- iOS/Android build details — those are in the Capacitor domain knowledge

**Why this matters:**
As svc projects increasingly target mobile (Example Marketplace already has a Capacitor wrapper), the framework needs to guide agents on platform-aware coding. This prevents the common bug of "works on web, crashes on native."

---

### 5. External Addon Registry → `EXTERNAL_ADDONS.md`

**From:** Capawesome + Capgo skill packs (72 skills total)
**Into:** `EXTERNAL_ADDONS.md` — External skill pack registration

**The problem in svc today:**
`EXTERNAL_ADDONS.md` tracks external tools (MCP servers, CLIs), but doesn't track external skill packs. There's no systematic way to know which skill packs are recommended for which project types.

**How the source solves it:**
Capawesome and Capgo provide domain-specific skills via `npx skills add`:
- `npx skills add capawesome-team/skills` — 25 Capacitor skills
- `npx skills add Cap-go/capgo-skills` — 47 Capacitor skills

**What this changes in svc:**
Add a "Skill Packs" section to `EXTERNAL_ADDONS.md`:
```markdown
## Skill Packs

### Capacitor Development
**Source:** `capawesome-team/skills` + `Cap-go/capgo-skills`
**License:** MIT
**Install:**
```bash
npx skills add capawesome-team/skills
npx skills add Cap-go/capgo-skills
```
**When to use:** Project uses Capacitor for mobile app development
**What it provides:** 72 skills covering React/Vite integration, plugins, security, testing, CI/CD, live updates
**Integration:** Skills auto-load when `capacitor.config.ts` is detected in project root
**What svc still owns:** Pipeline routing, review gates, builder profile decisions
```

**What NOT to take:**
- Individual skill contents — those stay in the external packs
- Capgo's proprietary cloud services — only the open-source skills

**Why this matters:**
Tracking external skill packs in `EXTERNAL_ADDONS.md` makes it explicit which domains svc delegates to external expertise. This prevents skill duplication (svc shouldn't write its own Capacitor plugin guide when Capawesome already has 25 skills for it).

---

## Assessment B: External Addon Viability

**Runtime addon?** YES
**License:** MIT (both packs)
**Install:** `npx skills add capawesome-team/skills` + `npx skills add Cap-go/capgo-skills`

### Integration Point
When `route-workflow` detects Capacitor-related intent ("add push notifications", "fix deep links", "build Android app"), it routes to the external Capacitor skills instead of svc's generic skills.

### Interop Contract
- **Detection signal:** `capacitor.config.ts` or `@capacitor/core` in `package.json`
- **Skill precedence:** External Capacitor skills > svc generic skills for Capacitor-specific tasks
- **Shared files:** None — external skills are self-contained
- **Execution order:** External skills run within svc's pipeline (e.g., during `execute-changeset` for implementation tasks)

### What svc should NOT rebuild
- Capacitor plugin catalog and installation guides
- Platform-specific build instructions (Android Gradle, iOS Xcode)
- Capacitor upgrade procedures (v4→v5→v6→v7→v8)
- Cordova → Capacitor migration guides
- Ionic-specific patterns (if project uses Ionic)

### What svc should still own
- Pipeline routing and gate decisions
- Builder profile and market readiness assessment
- Cross-project knowledge management
- Framework self-improvement

### EXTERNAL_ADDONS.md Draft
```markdown
## Add-On: Capacitor Skills (Capawesome + Capgo)

**Description:** Comprehensive Capacitor mobile development skills covering React/Vite/Angular/Vue integration, 160+ plugins, security scanning (Capsec), testing (Vitest/Playwright/Appium), CI/CD (GitHub Actions/Fastlane), and live updates (OTA).

**Install:**
```bash
npx skills add capawesome-team/skills    # 25 skills
npx skills add Cap-go/capgo-skills       # 47 skills
```

**Integration:** Auto-detected when `capacitor.config.ts` exists in project root. `route-workflow` routes Capacitor-specific intents to these skills.

**Interop rules:**
- Capacitor skills handle implementation details (plugin install, native config, platform builds)
- svc handles pipeline orchestration (gates, reviews, landing, verification)
- Capacitor skills are read-only references during design phases
- Capacitor skills are active participants during execution phases
```

---

## Full Dimensional Comparison

| Dimension | Capacitor skills | svc | Verdict | Action |
|---|---|---|---|---|
| Skill structure | Rigid template (Prereq → Behavior → Procedures → Errors → Related) | Flexible, varies per skill | theirs-better | BLEND: Add template to create-skill |
| Plugin/tool catalog | Decision matrix with categories | Simple ranked list | theirs-better | BLEND: Add decision-matrix pattern to discover-skills |
| Security scanning | Capsec CLI (63 rules) | OWASP + STRIDE manual | comparable | BLEND: Add Capsec integration to review-security |
| Platform detection | `isNativePlatform()` guards | Generic platform classification | theirs-better | BLEND: Add native platform patterns to platform-operating-architect |
| Error handling | Symptom→Cause→Fix tables | Varies per skill | theirs-better | BLEND: Add error-table template to create-skill |
| Cross-references | "Related Skills" section | Varies | comparable | IMPROVE: Standardize cross-reference format |
| Auto-detection | `package.json` scan, file existence checks | Some skills have this | comparable | IMPROVE: Make auto-detection standard in all skills |
| CI/CD | GitHub Actions + Fastlane examples | No CI/CD skill | gap | SKIP: Not a framework gap — project-specific |
| Testing | Vitest + Playwright + Appium | Playwright only | theirs-better | SKIP: Testing is project-specific, not framework |
| Live updates | Capgo OTA | No equivalent | gap | SKIP: Product feature, not framework pattern |
| Builder profiling | None | `mine-builder` | ours-better | SKIP |
| Review gates | None | G1-G7 | ours-better | SKIP |
| Feature lifecycle | None | DRAFT→...→VERIFIED | ours-better | SKIP |
| Knowledge system | None | 3-layer INDEX→CAPABILITIES→details | ours-better | SKIP |
| Anti-patterns | None | 25 APs | ours-better | SKIP |
| Task graphs | None | File-backed `.svc/lane-tasks.json` | ours-better | SKIP |
| Revenue staging | None | `stage-revenue` | ours-better | SKIP |
| Market readiness | None | `assess-market-readiness` | ours-better | SKIP |

---

## Skipped Items

| External Skill | Reason for Skip |
|----------------|----------------|
| `capacitor-app-creation` | Project scaffolding — `onboard-repo` covers this generically |
| `capacitor-app-development` | Generic dev guidance — too project-specific |
| `capacitor-angular/vue` | Framework-specific — svc doesn't favor any framework |
| `ionic-*` (7 skills) | Ionic Framework — not relevant to svc's default stack |
| `capacitor-app-upgrades` | Version upgrades — project maintenance, not framework pattern |
| `cordova-to-capacitor` | Migration guide — one-time use, not reusable pattern |
| `capgo-live-updates` | OTA product feature — not a framework pattern |
| `capgo-native-builds` | Cloud build service — product, not pattern |
| `capacitor-in-app-purchases` | Product feature — not a framework pattern |
| `capacitor-push-notifications` | Implementation guide — project-specific |
| `capacitor-deep-linking` | Implementation guide — project-specific |
| `capacitor-offline-first` | Architecture pattern — too domain-specific |
| `capacitor-mcp` | MCP server setup — external addon, not blend |
| `skill-creator` (both) | Meta skill — svc already has `create-skill` |
| All 18 upgrade/migration skills | One-time procedures — not reusable patterns |
| All remaining skills | Either too domain-specific or duplicate svc capabilities |

---

## Attribution Update

**NOTICES addition:**
```
## Capacitor Skills (Capawesome + Capgo)

- **Source:** https://github.com/capawesome-team/skills + https://github.com/Cap-go/capgo-skills
- **License:** MIT
- **Author:** Capawesome Team + Capgo
- **Patterns derived:**
  - Skill structure template (step-by-step procedures, error handling tables, related skills)
  - Plugin catalog decision matrix (official → community → alternative)
  - Platform-aware execution guards (`isNativePlatform()` pattern)
  - Security scanning integration (Capsec CLI)
- **Used as external addon:** Yes — both packs installed via `npx skills add`
```

---

## Blend Registry Update

```json
{
  "name": "capacitor-skills",
  "url": "https://github.com/capawesome-team/skills",
  "license": "MIT",
  "author": "Capawesome Team",
  "blends": [
    {
      "sha": "main-2026-04-29",
      "date": "2026-04-29",
      "patterns_taken": [
        {
          "external_path": "skills/capacitor-react/SKILL.md",
          "svc_target": "create-skill/SKILL.md",
          "pattern": "Skill structure template with Prerequisites → Behavior → Procedures → Errors → Related"
        },
        {
          "external_path": "skills/capacitor-plugins/SKILL.md",
          "svc_target": "discover-skills/SKILL.md",
          "pattern": "Plugin catalog decision matrix (official → community → alternative)"
        },
        {
          "external_path": "skills/capacitor-security/SKILL.md",
          "svc_target": "review-security/SKILL.md",
          "pattern": "Capsec security scanning integration for mobile projects"
        },
        {
          "external_path": "skills/capacitor-react/SKILL.md",
          "svc_target": "platform-operating-architect/SKILL.md",
          "pattern": "Platform-aware execution guards (isNativePlatform / getPlatform)"
        },
        {
          "external_path": "skills/ (all)",
          "svc_target": "EXTERNAL_ADDONS.md",
          "pattern": "External skill pack registration for Capacitor development"
        }
      ],
      "patterns_skipped": [
        {
          "external_path": "skills/capacitor-app-creation",
          "reason": "Project scaffolding covered by onboard-repo"
        },
        {
          "external_path": "skills/ionic-*",
          "reason": "Ionic Framework not relevant to svc default stack"
        },
        {
          "external_path": "skills/capgo-cloud/*",
          "reason": "Cloud services are product features, not framework patterns"
        },
        {
          "external_path": "skills/capacitor-push-notifications",
          "reason": "Implementation guide, not reusable pattern"
        }
      ]
    }
  ]
}
```

---

## Implementation Checklist

- [ ] Update `create-skill/SKILL.md` with skill structure template
- [ ] Update `discover-skills/SKILL.md` with decision matrix pattern
- [ ] Update `review-security/SKILL.md` with Capsec integration
- [ ] Update `platform-operating-architect/SKILL.md` with native platform guards
- [ ] Update `EXTERNAL_ADDONS.md` with Capacitor skill packs
- [ ] Update `references/blend-registry.json`
- [ ] Update `NOTICES`
- [ ] Update `references/skill-pack-comparison.md` (mark Capacitor row as "external addon")
