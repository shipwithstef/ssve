# Feature: Industry Grounding Becomes Default — Knowledge-Base Read at Gate, Never Web-Fetch

**Status:** BASELINED
**Type:** Enabler
**Consumers:** `validate-feature`, `write-spec`, `design-tech`, `research`, `svc-advisor`, `onboard-repo`, `scripts/lib/structured-gate-engine.mjs`
**Priority:** Critical
**Created:** 2026-05-02
**WI:** WI-142
**Source:** `proposals/done/2026-05-02-competitive-grounding-as-default.md`
**Builds-on:** WI-140 (primitive layer — engine, schema, dedupe hook, populated-branch gate)
**Companion:** WI-143 (refresh-competitors skill + 30-competitor floor — deferred)

---

## Problem Statement

WI-140 fixed the SDKG primitive layer (zero-dep gate engine, competitor-analysis schema, dedupe hook router) and added a `## Industry Grounding` gate, but that gate ONLY fires when a feature spec's ACs match `earn|redeem|verify|enroll|loyalty|points|reward`. Every other feature ships without competitive grounding — Type:Enabler / Type:Integration are blanket-exempt. This recreates the exact selective-blindness failure mode WI-140 set out to fix, just narrowed to a different keyword set.

User correction (post-WI-140 verification): *"competition is our compass; needs to be like that for everything"*. Competitive grounding is the COMPASS for every feature decision, not a keyword-matched subset. You can swim beyond the industry, but you must know where the industry is before you choose to.

**Without this:** every non-loyalty/non-rewards feature ships with no documented industry baseline. The framework cannot answer "what does the industry do?" → "why are we different?" → "is this a one-way door?" for 90% of feature work.

**Critical architectural correction (added after first user feedback round):** the gate must NEVER trigger live web research at gate-time. Web fetch from a gate is slow, expensive per-gate, inconsistent, and re-fetches what should already be in the knowledge base. The right architecture is **knowledge-first**: a comprehensive per-competitor knowledge base populated by `analyze-competitors` (one-shot, exhaustive), refreshed asynchronously by a scheduled routine (deferred to WI-143), and READ at gate-time without any network call.

**Dependent svc skills:**
- `validate-feature` — gate currently keyword-scoped, must apply universally
- `write-spec` — spec template needs `## Industry Grounding` section as a first-class requirement
- `design-tech` — should consume Industry Grounding when choosing architecture
- `research`, `svc-advisor` — only auto-surface competitive context when topic matches `competitive-domains.json`; should always-surface when knowledge base exists
- `onboard-repo` — Step 2.4 brownfield sweep currently greps for core-mechanic patterns only
- `scripts/lib/structured-gate-engine.mjs` — gains `readKnowledgeBase(slugs, topic)` function

---

## User Stories

### US-1 (Enabler — structured-gate-engine): Knowledge-base read path, never web-fetch

**As** the `structured-gate-engine.mjs` module,
**I need** a `readKnowledgeBase(competitorSlugs, topic)` function that returns structured grounding data by reading per-competitor files under `references/knowledge/competitors/<slug>/` WITHOUT any network call,
**So that** the gate can produce Industry Grounding output deterministically per-spec, with predictable latency, while web-fetch responsibility moves entirely to the asynchronous refresh routine (deferred WI-143).

#### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| GROUND-01 | `scripts/lib/structured-gate-engine.mjs` exports `readKnowledgeBase(slugs: string[], topic: string)` returning `{ landscape_state, competitors, sources, knowledge_gap }` | — | 🔲 | — |
| GROUND-02 | `readKnowledgeBase` reads only from `references/knowledge/competitors/<slug>/` (CAPABILITIES.md + topic file). NO `fetch`, NO `WebSearch`, NO `gh api`, NO `curl` in its call graph | — | 🔲 | — |
| GROUND-03 | When knowledge is missing or thin for the requested `(slugs, topic)` tuple: function returns `knowledge_gap: { detected: true, missing: [...] }`, appends a stub line to `.svc/framework-gaps.jsonl` (`{type: "knowledge-gap", competitors, topic, queued_wi: null}`), and returns whatever partial data IS available — does NOT throw | — | 🔲 | — |
| GROUND-04 | `references/knowledge/competitors/index.md` defines the canonical layout: per-slug subdirectory containing `CAPABILITIES.md`, optional topic files (`earn-mechanism.md`, `enrollment-flow.md`, `pricing-history.md`, `fraud-controls.md`, `customer-complaints.md`), `changelog.jsonl`, `.last_known_state.json`, `.last_full_refresh` | — | 🔲 | — |
| GROUND-05 | Tier-1 validator `validate-no-web-fetch-in-gate.sh` greps `scripts/lib/structured-gate-engine.mjs` and any `gate-*.sh` validators for `fetch\|WebSearch\|gh api\|curl\|wget`; non-zero exit on match | — | 🔲 | — |
| GROUND-06 | Knowledge-gap entries in `.svc/framework-gaps.jsonl` carry enough info for a future agent or `roadmap-evaluation` run to file a deep-dive WI without re-deriving the gap | — | 🔲 | — |

### US-2 (Enabler — validate-feature, write-spec, design-tech): Industry Grounding becomes default section

**As** the `validate-feature`, `write-spec`, and `design-tech` skills,
**I need** every feature spec moving toward BASELINED to carry a `## Industry Grounding` section with four required parts (what the industry does / what we're doing / why we differ / reversibility), regardless of feature type or keyword match,
**So that** the framework records WHY for every decision, not just decisions that touch loyalty mechanics, and future contributors see grounded justification rather than bare assertions.

#### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| GROUND-07 | `validate-feature-competitive-cross-reference.sh` no longer skips features based on keyword regex. Every spec moving to BASELINED has `## Industry Grounding` OR an explicit `landscape_inapplicable_reason` frontmatter field | — | 🔲 | — |
| GROUND-08 | Spec template (`write-spec` references) includes the four-part Industry Grounding block: `### What the industry does`, `### What we're doing`, `### Why we differ (or align)`, `### Reversibility` — each required, not optional | — | 🔲 | — |
| GROUND-09 | `## Competitive Risk Assessment` (WI-140 legacy section name) is renamed to `## Industry Grounding` everywhere it appears. Codemod completed on main specs; `audit-coverage` flags any remaining drift | — | ✅ | — |
| GROUND-10 | Type:Enabler and Type:Integration are NO LONGER blanket-exempt. Their grounding answers "what do other framework projects do for this enabler/integration" with at least one named reference | — | 🔲 | — |
| GROUND-11 | Tier-1 validator `validate-industry-grounding-section.sh`: for every spec in BASELINED state, asserts the four required subsections present + `Source` + `Landscape state` fields populated. Non-zero exit on missing subsection or unpopulated frontmatter | — | 🔲 | — |
| GROUND-12 | Knowledge-gap path in spec: when `readKnowledgeBase` returns `knowledge_gap.detected: true`, the spec's Industry Grounding section records `Note: insufficient knowledge for <topic>; deep-dive queued as <WI-XXX or framework-gap-id>` and the gate proceeds (does NOT block) | — | 🔲 | — |

### US-3 (Enabler — research, svc-advisor, onboard-repo): Always-surface + brownfield sweep widening

**As** the `research`, `svc-advisor`, and `onboard-repo` skills,
**I need** to auto-surface competitive context whenever `references/knowledge/competitors/index.md` exists AND to enumerate ALL major feature areas during brownfield onboarding (not just core-mechanic regex matches),
**So that** competitive grounding is visible by default in every research and advisory response, and brownfield projects get a complete competitive flag report at onboarding time rather than a keyword-scoped subset.

#### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| GROUND-13 | `research` and `svc-advisor` always append a competitive context block when `references/knowledge/competitors/index.md` exists, regardless of topic match against `competitive-domains.json`. Domain list becomes a *priority hint*, not a gate | — | 🔲 | — |
| GROUND-14 | `onboard-repo` Step 2.4 enumerates all major feature areas via directory + entry-point analysis (not core-mechanic regex). Output `docs/specs/brownfield-competitive-flags.md` covers ALL detected feature areas with severity rating | — | 🔲 | — |
| GROUND-15 | `references/framework-learnings.jsonl` has 3 new entries: `competitive-grounding-must-be-default-not-keyword-gated` (confidence 9), `gate-must-read-not-fetch` (confidence 9), `knowledge-gap-records-not-blocks` (confidence 8) | — | 🔲 | — |

---

## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|--------------|------------------|---------------|
| WI-140 primitive layer (`structured-gate-engine.mjs` + `competitor-analysis.schema.yaml` + dedupe hook router) | Enabler | ✅ `feature-competitive-awareness-deep-research.md` (VERIFIED) | Engine baseline this WI extends with `readKnowledgeBase` | Existing engine — no mock; tests against real schema |
| Knowledge-base directory layout (`references/knowledge/competitors/<slug>/`) | Enabler | ❌ — defined here as part of GROUND-04, populated by existing `analyze-competitors` skill | Per-competitor exhaustive files | Test fixtures: `references/knowledge/competitors/_test-fixture/` for validator tests |
| `validate-feature-competitive-cross-reference.sh` (WI-140) | Enabler | ✅ exists, modified here | Existing keyword-scoped validator becomes universal validator | — |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|-----------------------|
| WI-143 `refresh-competitors` skill (deferred) | Enabler | The knowledge-base directory layout + `.last_known_state.json` schema defined in GROUND-04 |
| Future product features in any svc-managed project | Feature | Industry Grounding section + Source field + Landscape state populated when their spec moves to BASELINED |
| `audit-coverage` (existing) | Enabler | Renamed-section drift detection (GROUND-09) |

---

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[NEW]` | This WI; framework-level fit established by WI-140 + user feedback |
| 2 | Journey | `[NEW]` | System journey: spec authoring → gate read → knowledge base → grounding output. To be written by `write-journeys` |
| 3 | Acceptance criteria | `[NEW]` | 15 ACs above |
| 4 | UX | `[N/A — justified: framework-internal gate; consumers are skills, not humans]` | — |
| 5 | UI | `[N/A — justified: no UI surface]` | — |
| 6 | Tech architecture | `[NEW]` | To be authored by `design-tech` (lane task 2) — gate read path, knowledge-base layout, validator design |
| 7 | Cost model | `[NEW]` | Per-spec cost: ~zero additional tokens (knowledge-base read, no web fetch). One-time engine change + 2 validators + 6 SKILL.md edits + codemod |
| 8 | Operations & ownership | `[NEW]` | Owner: framework-evolution lane. Operator: skill agents reading the engine output. Refresh loop: out-of-scope (WI-143). |

---

## API Contracts

_N/A — no HTTP surface. Internal module function signature documented in design-tech._

## Data Model

_Knowledge-base layout (filesystem schema), not DB. Defined in GROUND-04; full layout doc in design-tech._

## Component Tree

_N/A — no UI._

## Event Contracts

_N/A — synchronous function call, no async events._

## Feature Toggles

_N/A — framework-internal default-on behavior. Override via spec frontmatter `landscape_inapplicable_reason` per GROUND-07._

---

## Technical Design

### Architecture

[Layer 1] Extend the existing WI-140 SDKG primitive layer (`scripts/lib/structured-gate-engine.mjs`) with a knowledge-base read path that consumes per-competitor directories under `references/knowledge/competitors/`. No new services, no network calls, no database. The engine remains a zero-dependency Node.js module callable synchronously from skill scripts and gate validators.

```
  Skill script / gate validator
         |
         v
  structured-gate-engine.mjs
    |-- evaluateGate()   (existing, reads analyze-competitors.data.json)
    +-- readKnowledgeBase(slugs, topic)   (new, reads per-slug dirs)
              |
              v
      references/knowledge/competitors/<slug>/
        |-- CAPABILITIES.md
        |-- <topic>.md   (optional)
        |-- .last_known_state.json
        |-- .last_full_refresh
```

### Components

| Component | Type | Responsibility | New/Modify |
|-----------|------|---------------|------------|
| `readKnowledgeBase` | Function (module export) | Reads per-competitor files, returns structured grounding object | New export in `structured-gate-engine.mjs` |
| `references/knowledge/competitors/index.md` | Canonical doc | Defines directory layout, slug registry, freshness expectations | New |
| `references/knowledge/competitors/_test-fixture/` | Test fixture | Minimal mock competitor directory for tier-1 validator tests | New |
| `validate-no-web-fetch-in-gate.sh` | Tier-1 validator | Defensive lockdown — greps engine + gate configs for forbidden network patterns | Already implemented (GROUND-05) |
| `validate-industry-grounding-section.sh` | Tier-1 validator | Enforces four-part subsection structure on BASELINED specs | Already implemented |
| `validate-feature-competitive-cross-reference.sh` | Tier-1 validator | Universal gate — no keyword skip; accepts legacy + new headers during migration | Already modified |
| `scripts/gates/competitive.mjs` | Gate config | Branches on `landscape_state`, references `## Industry Grounding` | Already modified |
| 6 SKILL.md files | Skill contracts | `validate-feature`, `write-spec`, `design-tech`, `research`, `svc-advisor`, `onboard-repo` guidance updated | Already modified |

### Data Model

Knowledge-base layout (filesystem schema):

```
references/knowledge/competitors/
├── index.md                    # Canonical layout doc + slug registry
├── _test-fixture/              # Tier-1 test fixture
│   ├── acme-corp/
│   │   ├── CAPABILITIES.md
│   │   ├── earn-mechanism.md
│   │   ├── .last_known_state.json
│   │   └── .last_full_refresh
│   └── ...
└── <slug>/                     # One directory per competitor
    ├── CAPABILITIES.md         # Required: exhaustive capability inventory
    ├── <topic>.md              # Optional: deep-dive on a specific topic
    ├── changelog.jsonl         # Optional: append-only change log
    ├── .last_known_state.json  # Machine-readable snapshot
    └── .last_full_refresh      # ISO-8601 timestamp of last analyze-competitors run
```

### Data Flow

1. **Spec authoring** (`write-spec` / `validate-feature`): skill calls `evaluateGate()` with current artifact → engine reads `analyze-competitors.data.json` → returns verdict.
2. **Grounding enrichment** (optional, US-3): `research` / `svc-advisor` call `readKnowledgeBase(slugs, topic)` → engine reads per-slug `CAPABILITIES.md` + topic file → returns `{landscape_state, competitors, sources, knowledge_gap}`.
3. **Gap recording**: if `readKnowledgeBase` finds missing topic files, it appends to `.svc/framework-gaps.jsonl` and returns partial data — never throws.
4. **Validation**: tier-1 validators run in CI to enforce no-web-fetch + section structure.

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | Filesystem (markdown + JSON) | Zero dependencies; human-readable; same pattern as rest of svc references/ tree |
| Read path | Synchronous Node.js `fs` | Gates run in CLI contexts where async complicates error handling; data is local |
| Topic files | Optional, not required | Allows incremental population by `analyze-competitors` without blocking gate reads |
| Gap behavior | Log + return partial, never block | Per GROUND-03 and GROUND-12: knowledge gaps are recorded, not gate blockers |
| Network contract | Hard ban in gate code | Validated by `validate-no-web-fetch-in-gate.sh`; design principle, not convention |

### Competitive Tech Alternatives

N/A — framework-internal enabler. No competitor-facing mechanic.

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute | ~0ms (local fs read) | Per spec gate call | $0 | Constant | N/A |
| Storage | ~5KB per competitor markdown | 20 competitors × 5KB = 100KB | $0 | Linear with competitor count | N/A |
| External API calls | $0 (explicitly banned) | 0 | $0 | Constant | N/A |
| Background jobs | N/A (deferred to WI-143) | — | $0 | — | N/A |

**Zero-cost justification:** All reads are local filesystem operations against markdown files in the repo. No external APIs, no database, no hosting costs.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| **Owner** | Framework-evolution lane (svc-on-svc) |
| **On-call** | Best effort — no paging. Broken gate blocks spec baselining, which is caught in tier-1 evals before merge. |
| **SLA / SLO** | Best effort. Gate latency target: <50ms per spec. |
| **Error budget** | N/A for best effort. |
| **Monitoring** | Tier-1 evals (`validate-no-web-fetch-in-gate.sh`, `validate-industry-grounding-section.sh`) run on every eval pass. |
| **Alerting** | Tier-1 FAIL in CI / pre-commit hook. |
| **Dashboard** | None. |
| **Runbook** | "If gate HALTs on missing data: run `analyze-competitors` skill to produce `docs/specs/analyze-competitors.data.json` + `references/knowledge/competitors/` dirs." |
| **Failure modes** | Missing data → HALT (deliberate, per BLOCKING-DISCOVERY-HALT). Malformed data → HALT. Missing topic file → knowledge_gap logged, gate proceeds. |
| **Recovery procedure** | Re-run producer skill (`analyze-competitors`) or manually populate `_test-fixture/` for validator tests. |
| **Backup / restore** | Git history is backup. |
| **Dependencies' failure impact** | If `analyze-competitors` output is stale, `validate-competitor-analysis-freshness.sh` FAILs in tier-1, blocking promotion. |

### Feasibility Matrix

| AC | Description | Feasible? | Notes |
|----|-------------|-----------|-------|
| GROUND-01 | `readKnowledgeBase` exported from engine | ✅ | New function, ~40 lines, zero deps |
| GROUND-02 | No fetch/WebSearch/curl/wget in call graph | ✅ | Hard-enforced by `validate-no-web-fetch-in-gate.sh` |
| GROUND-03 | Knowledge gap returns partial + logs stub | ✅ | Function checks `fs.existsSync` per file, collects missing |
| GROUND-04 | `index.md` defines canonical layout | ✅ | New markdown doc |
| GROUND-05 | Tier-1 validator bans network patterns | ✅ | Already implemented on branch |
| GROUND-06 | Gap entries carry enough info for future WI filing | ✅ | Stub includes `competitors`, `topic`, `queued_wi: null` |
| GROUND-07 | Validator no longer skips by keyword | ✅ | Already implemented on branch |
| GROUND-08 | Spec template includes four-part block | ✅ | Already implemented on branch (`references/templates/industry-grounding.md`) |
| GROUND-09 | `Competitive Risk Assessment` → `Industry Grounding` rename | ✅ | Codemod not needed for new specs; legacy header accepted during migration |
| GROUND-10 | Type:Enabler / Integration no longer blanket-exempt | ✅ | Already implemented on branch (validator universal) |
| GROUND-11 | Tier-1 validator enforces four subsections + metadata | ✅ | Already implemented on branch |
| GROUND-12 | Knowledge gap spec notes + gate proceeds | ✅ | `readKnowledgeBase` returns `knowledge_gap.detected`; caller formats note |
| GROUND-13 | research / svc-advisor always-surface competitive context | ✅ | Already implemented on branch (SKILL.md edits) |
| GROUND-14 | onboard-repo enumerates all feature areas | ✅ | SKILL.md edit already on branch |
| GROUND-15 | framework-learnings.jsonl entries | ✅ | Already on branch (3 entries, confidence 9/9/8) |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `readKnowledgeBase` not called by any skill yet | Low — dead code until US-3 consumers adopt it | Document in engine JSDoc; adopt in `research` / `svc-advisor` in follow-up |
| Per-competitor directories grow unbounded | Medium — markdown files accumulate over time | WI-143 refresh routine includes archival; `index.md` defines retention |
| Topic file naming inconsistency | Low — different agents name files differently | `index.md` defines canonical topic list; gate tolerant of missing files |
| Test fixture drifts from real layout | Low — `_test-fixture/` may not represent real dirs | Tier-1 validator runs against real `references/knowledge/competitors/` when present |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|-----------|-------|------|-----------|
| Single-file `analyze-competitors.data.json` vs per-competitor dirs | Both coexist | Replacing single-file entirely | WI-140 gates already read `.data.json`; per-slug dirs are enrichment layer. Migration would be breaking. |
| Synchronous fs read vs async | Synchronous | Async/Promise | Simpler error handling in gate CLI contexts; data is tiny (<100KB total). |
| Hard fail vs soft fail on missing topic | Soft fail (knowledge_gap) | Blocking the gate | Per spec philosophy: gap is recorded, not blocked. Gate blocks on missing structured data (HALT), not on thin topic depth. |
---

## Implementation Notes

_To be added by plan-changeset and execute-changeset._

---

## Journey References

_To be added when `write-journeys` runs._

---

## Out of Scope (deferred to WI-143)

- New `refresh-competitors` skill + scheduled weekly routine
- Raising competitor floor from current cap to 30 (8-10 direct, 8-10 adjacent, 6-8 emerging, 4-6 macro)
- Splitting `analyze-competitors` into one-shot-comprehensive vs scheduled-diff modes
- Per-week "competitive landscape changed this week" digest

These changes are bundled together in WI-143 because they form a coherent maintenance-layer slice that benefits from real-world feedback on WI-142 first.

---

## Provenance

- Proposal: `proposals/done/2026-05-02-competitive-grounding-as-default.md`
- Companion proposal: `proposals/done/2026-05-01-competitive-awareness-gap.md` (WI-140 source)
- Triggering session: Example Marketplace WI-140 verification — user feedback "competition is our compass; needs to be like that for everything"
- Builds-on artifact: `docs/specs/features/competitive-awareness-deep-research.md` (WI-140, VERIFIED)
