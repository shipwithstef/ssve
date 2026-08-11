# Feature: coreyhaines blend v1.9.0 — adopt 4 architectural patterns

**Status:** DRAFT
**Type:** Enabler
**Consumers:** all svc skills (Pattern 1, 3); test-framework (Pattern 2); analyze-marketing + downstream marketing-aware skills (Pattern 4)
**Priority:** Medium
**Created:** 2026-04-28
**WI:** WI-135
**Source proposal:** `proposals/done/2026-04-28-blend-coreyhaines-marketing.md`
**External source:** https://github.com/coreyhaines31/marketingskills v1.9.0 (1bcff9fc)

---

## Problem Statement

Four architectural gaps in svc, each visible in real sessions:

1. **Inconsistent context loading.** svc skills check for prior context in different places (or not at all). Result: builders re-answer questions already in `~/.svc/builder-profile.md`, agents re-derive domain knowledge already in `domain-profile.md`. Token waste + builder friction.
2. **Test gap between tier-1 and tier-3.** Tier-1 is structural (YAML, AST). Tier-3 is LLM-as-judge (expensive, non-deterministic). There is no cheap deterministic behavioral layer. A skill can pass all tier-1 checks and produce wrong output; only tier-3 catches it.
3. **Full skill load every time.** Many skills are 400+ lines but most invocations need ~80 lines of core workflow. The remaining 320 lines burn context on every load.
4. **Marketing context is fragmented.** `analyze-marketing` outputs `docs/marketing/feature-mining-tracker.json` but no canonical product-marketing-context file exists. Downstream skills (validate-feature, find-opportunity, copywriting) re-derive positioning from scattered sources.

The coreyhaines/marketingskills repo solves all four with proven patterns observable in 40 working skills and 197 evals. svc adopts the architectural patterns; the 40 marketing skills themselves stay as an external addon.

---

## User Stories

### US-1: Skills check existing context before asking

**As** any svc skill,
**I want** a documented "Before Starting" pattern that reads the 4-source context chain,
**So that** I do not re-ask questions already answered in builder-profile, project-state, domain-profile, or the active feature spec.

#### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| BLEND-01 | `CONTRIBUTING.md` documents the 4-source context chain (`project-state.md` → `~/.svc/builder-profile.md` → `domain-profile.md` → relevant feature spec) and mandates a "Before Starting" section in every new SKILL.md | — | 🔲 | — |
| BLEND-02 | `_shared/before-starting.md` exists with the canonical chain order, "read-as-needed" rule, and example reference snippet | — | 🔲 | — |
| BLEND-03 | The 5 hot-path skills (`route-workflow`, `write-spec`, `plan-changeset`, `execute-changeset`, `validate-feature`) have a "Before Starting" section that references `_shared/before-starting.md` | — | 🔲 | — |
| BLEND-04 | The chain is read-as-needed (not read-all): `_shared/before-starting.md` explicitly documents that a skill reads only the sources relevant to its decision, not all 4 sources unconditionally | — | 🔲 | — |
| BLEND-05 | Tier-1 validator `validate-skill-before-starting.sh` exists; advisory for legacy skills, blocking for skills whose `created` frontmatter date is ≥ 2026-04-28 | — | 🔲 | — |

---

### US-2: Test-framework gains a deterministic behavioral layer

**As** the test-framework,
**I need** a tier-2 behavioral eval format that takes a conversation, runs assertions, and returns deterministic pass/fail,
**So that** wrong-output regressions in pipeline-critical skills are caught without paying tier-3 LLM-judge cost.

#### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| BLEND-06 | `test-framework/evals/tier-2/behavioral/` directory exists with documented JSON schema (`conversation`, `assertions`, `boundary` fields per coreyhaines format) | — | 🔲 | — |
| BLEND-07 | Runner script (`test-framework/evals/tier-2/run-behavioral.mjs` or equivalent) loads JSON, drives a conversation, evaluates assertions, returns deterministic exit code | — | 🔲 | — |
| BLEND-08 | ≥3 behavioral evals exist against pipeline-critical skills: at minimum `route-workflow`, `write-spec`, `validate-feature` | — | 🔲 | — |
| BLEND-09 | Behavioral evals are SUPPLEMENT, not replacement: existing tier-2 integration scenarios continue to run | — | 🔲 | — |
| BLEND-10 | `run-all-evals.sh --tier2` invokes both integration scenarios AND behavioral evals; both must pass for tier-2 to pass | — | 🔲 | — |

---

### US-3: New skills follow progressive disclosure

**As** a svc skill author,
**I want** a documented progressive-disclosure convention,
**So that** new skills keep core instructions in SKILL.md and depth in `references/*.md` instead of dumping 400 lines into every load.

#### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| BLEND-11 | `references/skill-conventions.md` documents progressive disclosure: SKILL.md = workflow + decision points; `references/*.md` = depth on demand | — | 🔲 | — |
| BLEND-12 | The convention includes an explicit non-goal: "do NOT refactor existing skills wholesale to fit this; convention applies to new skills" | — | 🔲 | — |
| BLEND-13 | At least one new skill authored after this WI demonstrates the pattern (or an existing oversize skill voluntarily refactored as a reference example) | — | 🔲 | — |

---

### US-4: analyze-marketing produces a canonical marketing context

**As** `analyze-marketing`,
**I need** to output a canonical `docs/specs/marketing-context.md` (positioning, audience, key messages, competitive angles),
**So that** downstream skills (validate-feature, find-opportunity, copywriting, landing-page) reference one source of truth instead of re-deriving from scattered files.

#### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| BLEND-14 | `analyze-marketing/SKILL.md` declares `docs/specs/marketing-context.md` in `outputs.produces` | — | 🔲 | — |
| BLEND-15 | `analyze-marketing` writes `docs/specs/marketing-context.md` as part of its process | — | 🔲 | — |
| BLEND-16 | `analyze-marketing/SKILL.md` includes a no-duplication coverage matrix (table) declaring what lives in `marketing-context.md` vs `domain-profile.md` vs `feature-mining-tracker.json` vs `personas/`. Each row names ONE owner per content type. | — | 🔲 | — |
| BLEND-17 | If `marketing-context.md` already exists when `analyze-marketing` runs, it updates rather than overwrites; revision history captured in the file | — | 🔲 | — |

---

### US-5: External addon registry covers coreyhaines

**As** a builder doing marketing execution work in svc,
**I want** clear documentation of how to install and use the coreyhaines marketing skills as an external addon,
**So that** I get the 40 marketing skills + 61 CLIs + 53 integration guides without svc trying to rebuild them.

#### Acceptance Criteria — US-5

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| BLEND-18 | `EXTERNAL_ADDONS.md` has a section for `coreyhaines/marketingskills` v1.9.0 with install command, license (MIT), version pin | — | 🔲 | — |
| BLEND-19 | The section names integration points: `analyze-marketing` outputs feed coreyhaines workflows; `validate-feature` consumes coreyhaines `customer-research` + `competitor-profiling` outputs as inputs; `find-opportunity` consumes `marketing-ideas` + `directory-submissions` | — | 🔲 | — |
| BLEND-20 | The section explicitly lists what svc does NOT rebuild: 40 specialized marketing skills, 61 CLI tools, 53+ integration guides | — | 🔲 | — |

---

### US-6: Linter and tier-1 stay green

**As** the framework lint and tier-1 evals,
**I need** the 5 source-of-truth files (`skills-manifest.json`, `README.md`, `EXTERNAL_ADDONS.md`, `REPO_MODES.md`, `route-workflow/SKILL.md`) to remain in sync after this WI lands,
**So that** the framework's self-consistency invariants hold.

#### Acceptance Criteria — US-6

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| BLEND-21 | `node scripts/lint-skills-manifest.mjs` exits 0 after all changes land | — | 🔲 | — |
| BLEND-22 | `bash test-framework/evals/run-all-evals.sh --tier1` exits 0 after all changes land | — | 🔲 | — |
| BLEND-23 | `references/framework-learnings.jsonl` gains an entry recording the blend (confidence 8) with rationale: "coreyhaines patterns adopted as architectural improvements; the 40 marketing skills stay external because svc is not a marketing-execution framework" | — | 🔲 | — |

---

## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|-------------|-----------------|---------------|
| `scripts/lint-skills-manifest.mjs` | Enabler | ✅ existing | Cross-file consistency check | n/a — local script |
| `test-framework/evals/run-all-evals.sh` | Enabler | ✅ existing | Tier-1/2/3 eval runner | n/a — local |
| `_shared/` directory convention | Enabler | ✅ existing (e.g., `_shared/product-question-format.md`) | Shared-snippet location | n/a |
| `analyze-marketing/SKILL.md` | Feature | ✅ existing | Marketing analysis skill | n/a |
| coreyhaines repo (read-only research) | Integration | external | Source patterns for the blend | n/a — research already complete (commit 8c07b44) |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|----------------------|
| Future skills (post-2026-04-28) | Feature | "Before Starting" convention + progressive-disclosure convention |
| `validate-feature`, `find-opportunity`, `copywriting`, `landing-page` | Feature | Read `docs/specs/marketing-context.md` when present |
| `test-framework` users | Enabler | Tier-2 behavioral eval runner + format |

---

## API Contracts

n/a — framework-internal change, no HTTP surface.

---

## Data Model

n/a — no schema changes. New files added (markdown + JSON). Listed below for reference:

| New file | Type | Purpose |
|---|---|---|
| `_shared/before-starting.md` | markdown | Canonical 4-source chain documentation |
| `references/skill-conventions.md` | markdown | Progressive disclosure rule |
| `test-framework/evals/tier-2/behavioral/*.json` | JSON | Behavioral eval scenarios |
| `test-framework/evals/tier-2/run-behavioral.mjs` | mjs | Runner script |
| `test-framework/evals/tier-1/validate-skill-before-starting.sh` | bash | Advisory/blocking validator |
| `docs/specs/marketing-context.md` | markdown | Canonical marketing context (written by `analyze-marketing`, not this WI) |

---

## Component Tree

n/a — no UI.

---

## Event Contracts

n/a — no events.

---

## Feature Toggles

n/a — no external services.

---

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[N/A — justified: framework-internal architectural change; no end-user product surface]` | This WI improves how svc itself works |
| 2 | Journey | `[N/A — justified: no user-facing journey; framework convention rollout]` | n/a |
| 3 | Acceptance criteria | `[NEW]` | This file (BLEND-01..23) |
| 4 | UX | `[N/A — justified: no UI surface]` | n/a |
| 5 | UI | `[N/A — justified: no UI surface]` | n/a |
| 6 | Tech architecture | `[NEW]` | To be authored by `design-tech` (or skipped if `plan-changeset` deems implementation trivial; framework lane often elides design-tech for convention rollouts) |
| 7 | Cost model | `[N/A — justified: zero runtime cost; pure repo-local convention + script changes]` | No cloud spend, no external API calls |
| 8 | Operations & ownership | `[NEW]` | Framework maintainer (you) owns; tier-1 validator becomes the long-term enforcement mechanism |

---

## Vibe / Innovation Layer

The blend is itself the innovation: importing battle-tested patterns from a 40-skill working repo (coreyhaines/marketingskills) instead of inventing svc-flavored conventions de novo. The architectural patterns make svc better at being svc; the marketing skills themselves stay external because svc is a development-pipeline framework, not a marketing-execution framework.

---

## Implementation Notes

_To be added by plan-changeset and execute-changeset._

Suggested branch: `framework/wi-135-coreyhaines-blend-v1.9.0`. Suggested manifest scope:

1. New: `_shared/before-starting.md`, `references/skill-conventions.md`, behavioral eval dir + 3 evals + runner, tier-1 validator.
2. Edit: `CONTRIBUTING.md` (4-source chain rule), 5 hot-path SKILL.md files (insert "Before Starting" section), `analyze-marketing/SKILL.md` (outputs.produces + coverage matrix), `EXTERNAL_ADDONS.md` (coreyhaines section).
3. Append: `references/framework-learnings.jsonl` blend entry.

---

## Journey References

n/a — no end-user journeys. Framework rollout journey lives implicitly in the work item AC list.

---

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|------|----|-----|-----|-----|----------|
| 2026-04-28 | (initial) | — | BLEND-01..23 | Initial DRAFT from WI-135 | write-spec |
