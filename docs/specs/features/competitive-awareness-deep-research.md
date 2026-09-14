# Feature: Environment-Aware Competitive Cross-Reference Gates with Deep-Research Mandate

**Status:** BASELINED
**Type:** Enabler
**Consumers:** `analyze-competitors`, `validate-feature`, `write-spec`, `design-tech`, `onboard-repo`, `research`, `svc-advisor`, `route-workflow`
**Priority:** Critical
**Created:** 2026-05-01
**WI:** WI-140
**Source:** `proposals/done/2026-05-01-competitive-awareness-gap.md`

---

## Problem Statement

`validate-feature`, `write-spec`, `design-tech`, and `onboard-repo` currently lack a structured contract for consuming competitive analysis. They reference `docs/specs/analyze-competitors.md` as prose — agents skim it, miss the customer-facing earn/enrollment/cost mechanics, and ship features that no competitor does without ever asking "why doesn't anyone do this?". Compounding the gap, `analyze-competitors` itself permits "consolidation only / no new web research" as a valid terminal state — so the file the gates read may be months stale or never grounded in current market reality.

**Without this:** a project can spend 2 months building a workaround for a missing capability (Example Marketplace: receipt OCR scanning instead of POS integration; zero competitors do receipt scanning) and the framework will never flag it. The gap is structural — no schema, no gate, no continuous trigger, no day-1 brownfield check.

**This is the same root cause** as `references/framework-learnings.jsonl` → `stored-knowledge-decay-requires-live-verification` (confidence 10) which fired on host-API knowledge in April. Same pattern: stored consolidation declared done without live re-verification. The fix mechanism (live verification + structured output + freshness validator) generalizes.

**Dependent svc skills:**
- `validate-feature` (line 360) reads the file but does no structured cross-reference
- `write-spec` (Step 1) recommends reading it but enforces nothing
- `design-tech` has no competitive-alternatives gate
- `onboard-repo` has no day-1 brownfield competitive sweep
- `research` and `svc-advisor` query knowledge without surfacing competitive context

---

## User Stories

### US-1 (Enabler — analyze-competitors): Mandatory deep research with structured output

**As** the `analyze-competitors` skill,
**I need** to require live web research per competitor AND emit a machine-readable structured output (per `competitor-analysis.schema.yaml`) that downstream gates can query field-by-field,
**So that** "consolidation only / no new web research" is no longer a valid terminal state and downstream consumers can cross-reference specific dimensions (earn mechanism, enrollment path, merchant cost) instead of grepping prose.

#### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| COMP-01 | `references/schemas/competitor-analysis.schema.yaml` exists and validates with required fields: `landscape_state` (enum: populated\|nascent\|none-found\|inapplicable), `competitors[]`, each competitor has `earn_mechanism`, `enrollment_path`, `merchant_cost`, `pos_integrations`, `fraud_prevention`, `customer_complaints`, `last_verified` (ISO date) | — | 🔲 | — |
| COMP-02 | `analyze-competitors/SKILL.md` rewritten: web research is MANDATORY (not "recommended"). The skill MUST invoke `WebSearch` + `WebFetch` (or gemini-cli per `rules/research-must-use-gemini-cli.md`) per direct competitor before producing output | — | 🔲 | — |
| COMP-03 | New "Customer Mechanic Analysis" section added to per-competitor analysis: how does the customer earn / enroll / verify, what's the merchant cost, what fraud prevention exists | — | 🔲 | — |
| COMP-04 | `docs/specs/analyze-competitors.md` output emits BOTH the human-readable markdown AND a machine-readable `analyze-competitors.data.yaml` conforming to schema COMP-01 | — | 🔲 | — |
| COMP-05 | Tier-1 validator `validate-competitor-analysis-schema.sh` FAILS if `analyze-competitors.data.yaml` missing or non-conforming | — | 🔲 | — |
| COMP-06 | Tier-1 validator `validate-competitor-analysis-freshness.sh` FAILS if any `last_verified` field is >90 days old AND `landscape_state` is `populated` or `nascent`. Quarterly re-scan is forced | — | 🔲 | — |
| COMP-07 | "Source: read-only consolidation, no new web research performed" header pattern in `analyze-competitors.md` is REJECTED by COMP-05 (legacy hard-fail) | — | 🔲 | — |
| COMP-ZERO | When invoked the very first time on a project (no prior `analyze-competitors.md`), the skill produces a zero-state output with `landscape_state: none-found` + first-mover risk checklist, NEVER an empty file | — | 🔲 | — |

### US-2 (Enabler — validate-feature + write-spec): Environment-aware cross-reference gate

**As** the `validate-feature` and `write-spec` skills,
**I need** to read the structured `analyze-competitors.data.yaml` and auto-emit a Competitive Risk Assessment section whose enforcement branches on `landscape_state` (populated → strong gate, nascent → warn, none-found → first-mover checklist, inapplicable → skip with logged justification),
**So that** the gate adapts to evidence rather than false-blocking legitimate greenfield/internal-tool work and a feature that "no competitor does" cannot reach BASELINED without explicit compensating-control rationale.

#### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| GATE-01 | `validate-feature` and `write-spec` auto-emit `## Industry Grounding` section in every spec; section structure conforms to `references/templates/industry-grounding.md` | — | 🔲 | — |
| GATE-02 | Gate behavior MUST branch on `landscape_state` from the structured competitor data: behavior matrix encoded in `validate-feature-competitive-cross-reference.sh` | — | 🔲 | — |
| GATE-03 | `landscape_state: populated` AND zero competitors do the proposed feature → BLOCK BASELINED unless compensating-control checklist (US-4) is present | — | 🔲 | — |
| GATE-04 | `landscape_state: nascent` (1-2 competitors found) → WARN + require explicit acknowledgement field `thin_evidence_acknowledged: true` in spec frontmatter; do NOT block | — | 🔲 | — |
| GATE-05 | `landscape_state: none-found` (true greenfield, deep research returned nothing) → flip to first-mover risk checklist (4 items: why-no-one-tried, what-would-have-to-be-true, fastest-disconfirmation, abandonment-trigger). Block BASELINED if checklist absent. Do NOT require compensating-control | — | 🔲 | — |
| GATE-06 | `landscape_state: inapplicable` (internal tool, regulated monopoly, B2B-bespoke) → gate skipped, justification REQUIRED in `.svc/pipeline-decisions.jsonl` as `taste` decision with explicit `landscape_inapplicable_reason` field | — | 🔲 | — |
| GATE-07 | If `analyze-competitors.data.yaml` is missing OR fails freshness check (COMP-06), the gate MUST run `analyze-competitors` first or refuse to BASELINE the spec — it MUST NOT silently pass | — | 🔲 | — |
| GATE-08 | Tier-1 validator `validate-feature-competitive-cross-reference.sh` PASS for all specs in `docs/specs/features/` with status >= BASELINED | — | 🔲 | — |
| GATE-ZERO | When project has NO `analyze-competitors.md` (first-time use), the gate prompts `analyze-competitors` invocation rather than blocking. Useful default is "research first, gate second" | — | 🔲 | — |
| GATE-FAIL-01 | When `WebSearch`/`gemini-cli` returns zero results during gate refresh (network failure, no quota), the gate emits `BLOCKING-DISCOVERY-HALT` per `proposals/done/2026-04-14-blocking-discovery-halt-protocol.md` rather than treating empty results as "no competitors" | — | 🔲 | — |
| GATE-FAIL-02 | If two consecutive gate runs return contradictory `landscape_state` (populated → none-found within 7 days), the framework emits a freshness-anomaly alert and forces a deep re-scan | — | 🔲 | — |

### US-3 (Enabler — design-tech): Competitive alternatives in tech design

**As** the `design-tech` skill,
**I need** to read structured competitor `pos_integrations` and `fraud_prevention` fields when designing core-mechanic technology choices,
**So that** "we'll roll our own" decisions are explicitly compared against what competitors actually deploy and tech debt from re-inventing solved problems is surfaced.

#### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| TECH-01 | `design-tech` Technical Design section adds required `## Competitive Tech Alternatives` subsection when feature touches earn/redeem/verify/enroll | — | 🔲 | — |
| TECH-02 | Subsection MUST list: what each competitor uses for the same mechanic, what we're choosing, why ours differs (cost / moat / capability) | — | 🔲 | — |
| TECH-03 | If `landscape_state: populated` AND chosen tech matches NO competitor pattern, `design-tech` adds explicit ADR explaining the divergence | — | 🔲 | — |

### US-4 (Enabler — write-spec + design-tech): Compensating-control framing

**As** the `write-spec` and `design-tech` skills,
**I need** a required compensating-control checklist when GATE-03 fires (zero competitors do this on a populated landscape),
**So that** features built as workarounds for missing capabilities are framed honestly — with the missing capability named, the why-not-now reason, the risk of the workaround, and the path to replacing it.

#### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| CC-01 | When GATE-03 fires, spec MUST include `## Compensating Control` section with 4 required fields: `missing_capability`, `why_not_now`, `risk_of_workaround`, `path_to_replacement` | — | 🔲 | — |
| CC-02 | Each field MUST have evidence: a citation to competitor analysis (which competitors use the real capability) for `missing_capability`; a citation to `validate-feature` Q3/Q4 (cost/timeline) for `why_not_now`; a citation to a fraud/UX risk for `risk_of_workaround`; a target WI ID or `TODO: WI-XXX` placeholder for `path_to_replacement` | — | 🔲 | — |
| CC-03 | Tier-1 validator `validate-spec-compensating-control.sh` FAILS if any of the 4 fields are blank, "TBD", or unfilled when the section is present | — | 🔲 | — |
| CC-04 | Compensating-control spec sections automatically register a follow-up TODO in `docs/specs/TODOS.md` with the trigger condition for revisiting (per write-spec G0 directive 7) | — | 🔲 | — |

### US-5 (Enabler — route-workflow): Continuous monitoring trigger

**As** the `route-workflow` skill (post-skill hook),
**I need** to log core-mechanic touches (any WI tagged earn/redeem/verify/enroll OR matching keyword detection in WI subjects) to a trigger file so quarterly re-scans and cross-WI competitive drift can be detected,
**So that** competitive analysis stops being a one-shot artifact and starts being a continuous loop tied to where engineering effort is actually going.

#### Acceptance Criteria — US-5

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| MON-01 | `.svc/competitive-monitor-triggers.jsonl` append-only schema defined; each event records `ts`, `wi`, `mechanic_touched`, `current_landscape_state`, `last_verified_age_days` | — | 🔲 | — |
| MON-02 | `route-workflow` post-skill hook fires on completed WIs whose subject or files-changed matches `earn|redeem|verify|enroll|loyalty|points|reward` patterns | — | 🔲 | — |
| MON-03 | When 3+ trigger events accumulate within a quarter, `validate-competitor-analysis-freshness.sh` flags the project as "high-mechanic-velocity, competitor data MUST be re-verified" | — | 🔲 | — |
| MON-04 | Tier-1 validator confirms quarterly re-scan happens: if newest competitor `last_verified` >90 days AND ≥1 trigger event in the last 30 days, FAIL | — | 🔲 | — |

### US-6 (Enabler — onboard-repo): Day-1 brownfield competitive sweep

**As** the `onboard-repo` skill,
**I need** to detect existing core-mechanic features in the brownfield codebase AND run Phase 2's deep-research path against each on day 1, producing a brownfield-competitive-flags artifact,
**So that** projects like Example Marketplace get the "you're using receipt scanning, zero competitors do this" warning on day 1 instead of day 60.

#### Acceptance Criteria — US-6

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ONB-01 | `onboard-repo` adds Step "Detect core-mechanic features": grep codebase for `processReceipt`, `verifyVisit`, `earnPoints`, `redeem*`, `pos*`, `loyalty*` patterns OR equivalent project-specific patterns derived from domain | — | 🔲 | — |
| ONB-02 | For each detected mechanic, invoke `analyze-competitors` (Phase 2 deep-research path) scoped to that mechanic; produces `docs/specs/brownfield-competitive-flags.md` | — | 🔲 | — |
| ONB-03 | Flags artifact lists each detected mechanic with: `landscape_state`, what competitors do for the same mechanic, whether the brownfield approach matches or diverges, severity rating | — | 🔲 | — |
| ONB-04 | High-severity divergences (the brownfield approach is unique) auto-create a backlog WI tagged `competitive-strategy-review` for the project | — | 🔲 | — |

### US-7 (Enabler — research + svc-advisor): Knowledge auto-surface

**As** the `research` and `svc-advisor` skills,
**I need** to auto-append a Competitive Context block whenever a query touches a domain in `references/knowledge/domains/{loyalty,verification,enrollment,payment}/` (or a project-extensible list),
**So that** the "we're the only ones who do it this way" blind spot cannot survive contact with on-demand research.

#### Acceptance Criteria — US-7

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| KNOW-01 | `references/knowledge/competitive-domains.json` lists which knowledge domains require competitive auto-surface; project-extensible | — | 🔲 | — |
| KNOW-02 | When `research` or `svc-advisor` queries a listed domain, output MUST include a `## Competitive Context` block populated from `analyze-competitors.data.yaml` field references | — | 🔲 | — |
| KNOW-03 | If competitor data missing or stale (per COMP-06), the block notes "stale or missing — invoke /analyze-competitors" rather than fabricating context | — | 🔲 | — |

### US-8 (Project — separate WI in example-marketplace): Retroactive Example Marketplace audit

**As** the Example Marketplace project,
**I need** the new gates applied retroactively to existing WIs that touch receipt scanning, enrollment, and verification,
**So that** the strategic misalignment discovered in proposal 2026-05-01 is corrected and engineering effort redirects toward POS integration if warranted.

> **Out-of-scope for this svc changeset.** Filed as separate `example-marketplace#WI-XXX` after svc framework changes promote to main. Listed here for completeness of the dependency chain.

---

## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|-------------|-----------------|---------------|
| WebSearch | Integration | ✅ host-native | Live competitor pricing, feature lists, customer reviews | Local cassette with snapshot for tests |
| WebFetch | Integration | ✅ host-native | Direct competitor docs/pricing-page extraction | Local fixture HTML |
| gemini-cli (per `rules/research-must-use-gemini-cli.md`) | Integration | ✅ external CLI | Sub-agent dispatch for deep extraction | `SVC_RESEARCH_AGENT=claude` env override |
| Tier-1 validator framework (`test-framework/evals/tier-1/`) | Enabler | ✅ existing | Hard-fail mechanism for the 5 new validators | n/a (always-on) |
| Pipeline decision log (`.svc/pipeline-decisions.jsonl`) | Enabler | ✅ existing | Audit trail for `inapplicable` justifications + freshness anomalies | n/a |
| Knowledge protocol (`references/knowledge-protocol.md`) | Enabler | ✅ existing | 4-pass extraction layered storage | n/a |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|----------------------|
| `validate-feature` | Enabler | Structured competitor data + gate primitive |
| `write-spec` | Enabler | Cross-reference section template + compensating-control template |
| `design-tech` | Enabler | Competitive tech alternatives data |
| `onboard-repo` | Enabler | Phase 2 deep-research path callable in scoped mode |
| `research` / `svc-advisor` | Enabler | Auto-surface block + freshness check |
| `route-workflow` | Enabler | Post-skill hook trigger event schema |

---

## API Contracts

> N/A — this is a framework-internal Enabler with no HTTP surface. The "contracts" are the JSON/YAML schemas in Phase 1 + the validator exit codes.

---

## Data Model

### `references/schemas/competitor-analysis.schema.json` (Phase 1)

> **Revised by design-tech 2026-05-02:** format YAML → JSON (zero-dep parsing). See Technical Design § Technology Decisions row 4 for full rationale. The shape below is the authoritative version; YAML below is shown for readability of the same shape.

```yaml
$schema: "https://json-schema.org/draft/2020-12/schema"
type: object
required: [generated, landscape_state, category, competitors]
properties:
  generated: { type: string, format: date }
  landscape_state:
    type: string
    enum: [populated, nascent, none-found, inapplicable]
  landscape_state_justification: { type: string }
  category: { type: string }
  competitors:
    type: array
    items:
      type: object
      required: [name, tier, last_verified, earn_mechanism, enrollment_path, merchant_cost, pos_integrations, fraud_prevention, customer_complaints]
      properties:
        name: { type: string }
        tier: { enum: [direct, adjacent, emerging, macro] }
        url: { type: string, format: uri }
        last_verified: { type: string, format: date }
        earn_mechanism: { type: string }                # how customer earns: auto-POS, scan, check-in, card-link
        enrollment_path: { type: string }               # app-download, POS-auto, SMS, wallet-pass, web
        merchant_cost: { type: string }                 # $ per location/month, per transaction, etc.
        pos_integrations: { type: array, items: { type: string } }
        fraud_prevention: { type: array, items: { type: string } }
        customer_complaints: { type: array, items: { type: string } }
```

### `.svc/competitive-monitor-triggers.jsonl` (Phase 5)

```jsonl
{"ts":"2026-05-01T12:00:00Z","wi":"WI-167","mechanic_touched":"verify","current_landscape_state":"populated","last_verified_age_days":62,"trigger_source":"route-workflow-post-skill-hook"}
```

---

## Component Tree

> N/A — Enabler with no UI components. The "tree" below is the system flow.

---

## Event Contracts

| Event | Producer | Consumer | Payload | AC |
|-------|----------|----------|---------|-----|
| `competitive-trigger` | `route-workflow` post-skill hook | `validate-competitor-analysis-freshness.sh` (cron / on-demand) | `{wi, mechanic_touched, landscape_state, last_verified_age_days}` | MON-01, MON-02 |
| `freshness-anomaly` | `validate-competitor-analysis-freshness.sh` | `pipeline-decisions.jsonl` + user-facing alert | `{from_state, to_state, days_between, action: "deep-rescan"}` | GATE-FAIL-02 |
| `gate-block` | `validate-feature-competitive-cross-reference.sh` | spec status remains DRAFT | `{spec_path, reason, missing_section}` | GATE-03, GATE-05, GATE-08 |

---

## Feature Toggles

| Toggle | Local default | What it controls | ACs affected |
|--------|--------------|-----------------|-------------|
| `SVC_COMPETITIVE_GATE_ENFORCE` | `true` | Hard-block BASELINED vs warn-only | GATE-03, GATE-05, GATE-08 |
| `SVC_COMPETITIVE_RESCAN_ALLOWED` | `true` | Allows `validate-feature` to invoke `analyze-competitors` automatically when stale | GATE-07 |
| `SVC_COMPETITIVE_LANDSCAPE_OVERRIDE` | unset | If set to a `landscape_state` value, overrides detected state (escape hatch for misclassification) | GATE-06, GATE-FAIL-02 |

---

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 1: Schema (foundation)                                        │
│   references/schemas/competitor-analysis.schema.yaml                │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ consumed by
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 2: analyze-competitors (deep research mandate)                │
│   WebSearch + WebFetch (or gemini-cli) per direct competitor        │
│   Output: analyze-competitors.md + analyze-competitors.data.yaml    │
│   landscape_state: populated | nascent | none-found | inapplicable  │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┬─────────────────┐
        ▼                     ▼              ▼                 ▼
┌──────────────┐    ┌─────────────────┐  ┌─────────────┐  ┌────────────┐
│ Phase 3:     │    │ Phase 4:        │  │ Phase 6:    │  │ Phase 7:   │
│ validate-    │    │ Compensating    │  │ onboard-    │  │ Knowledge  │
│ feature +    │    │ control         │  │ repo day-1  │  │ auto-      │
│ write-spec   │    │ (write-spec +   │  │ sweep       │  │ surface    │
│ gate         │    │ design-tech)    │  │             │  │            │
│              │    │                 │  │             │  │            │
│ Branches on  │    │ Triggered when  │  │ Closes      │  │ research + │
│ landscape_   │    │ GATE-03 fires   │  │ Example Marketplace    │  │ svc-       │
│ state        │    │                 │  │ "day 60"    │  │ advisor    │
│              │    │                 │  │ gap         │  │ blind spot │
└──────┬───────┘    └─────────────────┘  └─────────────┘  └────────────┘
       │ continuous monitoring
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 5: route-workflow post-skill hook                             │
│   .svc/competitive-monitor-triggers.jsonl                           │
│   Quarterly re-scan trigger when 3+ events accumulate               │
└─────────────────────────────────────────────────────────────────────┘
```

**Why the order can't be shuffled:**
- Phase 3, 4, 6, 7 all read Phase 1's schema
- Phase 3 reads Phase 2's output
- Phase 6 invokes Phase 2 in scoped mode
- Phase 5's trigger feeds back into Phase 2's freshness validator

---

## Technical Design

> Resolved by `design-tech` 2026-05-02. **Reusable-primitive framing** (per session feedback): the patterns below are designed as the framework's first **Structured Domain Knowledge Gate (SDKG)** — a primitive future WIs can extend for security / performance / accessibility / cost / privacy gates, not a competitive-only one-off.

### Architecture

Five reusable primitives + one instantiation:

```
┌──────────────────────────────────────────────────────────────────────┐
│ PRIMITIVE LAYER (reusable for ANY structured-domain gate)            │
│                                                                       │
│  scripts/lib/json-schema-validator.mjs   ← pure-node, zero-dep        │
│  scripts/lib/structured-gate-engine.mjs  ← read schema+data, branch   │
│  scripts/lib/post-task-trigger-router.mjs ← single hook, N triggers   │
│  test-framework/evals/tier-1/lib/sdkg-validator.sh ← bash helper      │
│  references/schemas/<domain>.schema.json ← schema convention          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                │ first instantiation
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ COMPETITIVE-AWARENESS INSTANCE (this WI)                              │
│                                                                       │
│  references/schemas/competitor-analysis.schema.json                   │
│  scripts/gates/competitive-gate.mjs (config + branch logic)           │
│  5 tier-1 validators (~10 LOC each, just configure the helper)        │
│  4 SKILL.md edits invoking the primitive                              │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**The SDKG primitive layer means the next gate (e.g., security-without-best-practice) is one schema + one gate config + 5 thin validator wrappers — NOT a rewrite.**

### Components

| Component | Type | Responsibility | New / Modify | Layer |
|-----------|------|---------------|--------------|-------|
| `scripts/lib/json-schema-validator.mjs` | Primitive | Pure-node JSON-Schema subset checker (type, required, enum, format date) | NEW | [Layer 3 / EUREKA] |
| `scripts/lib/structured-gate-engine.mjs` | Primitive | `evaluateGate({schemaPath, dataPath, gateConfig, currentArtifact}) → {verdict, missingFields, citations, branchTaken}` | NEW | [Layer 1] |
| `scripts/lib/post-task-trigger-router.mjs` | Primitive | Reads completed-task subject + project root, dispatches to N registered SDKG triggers via config | NEW | [Layer 1] |
| `test-framework/evals/tier-1/lib/sdkg-validator.sh` | Primitive | Bash helper: `sdkg_validate <domain> <fixture>` — wraps node call, std exit codes | NEW | [Layer 1] |
| `references/schemas/competitor-analysis.schema.json` | Instance | JSON Schema for competitor data | NEW | — |
| `references/schemas/competitor-analysis.example.json` | Instance | Reference fixture | NEW | — |
| `scripts/gates/competitive-gate.mjs` | Instance | Gate config: which schema, branch matrix on `landscape_state`, citation extractor | NEW | — |
| `test-framework/evals/tier-1/validate-competitor-analysis-schema.sh` | Instance | 5-LOC wrapper: `sdkg_validate competitor-analysis examples/*.json` | NEW | — |
| `test-framework/evals/tier-1/validate-competitor-analysis-freshness.sh` | Instance | Wrapper: 90-day check + trigger-cross-reference | NEW | — |
| `test-framework/evals/tier-1/validate-feature-competitive-cross-reference.sh` | Instance | Wrapper: BASELINED specs in core-mechanic features have section + branch resolved | NEW | — |
| `test-framework/evals/tier-1/validate-spec-compensating-control.sh` | Instance | Wrapper: 4 fields filled when section present | NEW | — |
| `references/templates/competitive-risk-assessment.md` + `compensating-control.md` + `competitive-context-block.md` + `brownfield-competitive-flags.md` + `analyze-competitors-output-template.md` | Instance | Section templates referenced from SKILL.md edits | NEW | — |
| `references/sdkg-registry.json` | Primitive (config) | Lists all SDKG instances: schema path, gate config, trigger keywords, freshness window. Future SDKGs add a row here, no engine code change. | NEW | [Layer 1] |
| `analyze-competitors/SKILL.md` | Instance | Mandate web research; emit `.data.json` companion | MODIFY | — |
| `validate-feature/SKILL.md` + `write-spec/SKILL.md` | Instance | Auto-emit Competitive Risk Assessment via `evaluateGate()` | MODIFY | — |
| `design-tech/SKILL.md` | Instance | Add Competitive Tech Alternatives subsection | MODIFY | — |
| `onboard-repo/SKILL.md` | Instance | Day-1 sweep — invoke analyze-competitors per detected mechanic | MODIFY | — |
| `research/SKILL.md` + `svc-advisor/SKILL.md` | Instance | Auto-surface competitive context block | MODIFY | — |
| `route-workflow/SKILL.md` | Instance | Document post-task trigger router | MODIFY | — |
| `hooks/svc-task-completion-guard.sh` | Instance | Wire post-task-trigger-router invocation | MODIFY | — |
| `scripts/init-project-state.mjs` | Instance | Add `.svc/competitive-monitor-triggers.jsonl` to lazy-init list | MODIFY | — |

**Counts:** 5 primitives (NEW), ~12 instance files (NEW), 8 SKILL.md MODIFY, 1 hook MODIFY, 1 init script MODIFY. Total: ~22 NEW + 10 MODIFY.

> **Scope smell triggered (>8 new files).** Mitigation: 5 of the new files are PRIMITIVES that pay back across all future SDKG instances — they are NOT scope creep, they are the asset. The remaining 17 are unavoidable for a 7-skill cross-cutting concern. No further reduction possible without dropping ACs.

### Data Model

**Schema format: JSON, not YAML** (revises spec's tentative YAML choice — see Revision Log entry below).

**Why:** Framework currently has zero npm deps. YAML requires `js-yaml`; ajv requires `ajv`. Adding two deps for a "validation freshness" feature would be ironic — those deps decay (the exact failure mode WI-140 fixes). Pure-node JSON.parse + a ~80 LOC subset validator avoids that.

```json
// references/schemas/competitor-analysis.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://svc/schemas/competitor-analysis.schema.json",
  "type": "object",
  "required": ["generated", "landscape_state", "category", "competitors"],
  "properties": {
    "generated": { "type": "string", "format": "date" },
    "landscape_state": {
      "type": "string",
      "enum": ["populated", "nascent", "none-found", "inapplicable"]
    },
    "landscape_state_justification": { "type": "string" },
    "category": { "type": "string" },
    "competitors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "tier", "last_verified", "earn_mechanism", "enrollment_path", "merchant_cost", "pos_integrations", "fraud_prevention", "customer_complaints"],
        "properties": {
          "name": { "type": "string" },
          "tier": { "type": "string", "enum": ["direct", "adjacent", "emerging", "macro"] },
          "url": { "type": "string", "format": "uri" },
          "last_verified": { "type": "string", "format": "date" },
          "earn_mechanism": { "type": "string" },
          "enrollment_path": { "type": "string" },
          "merchant_cost": { "type": "string" },
          "pos_integrations": { "type": "array", "items": { "type": "string" } },
          "fraud_prevention": { "type": "array", "items": { "type": "string" } },
          "customer_complaints": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

**SDKG registry shape:** future instances register here, engine reads at runtime — no engine edit needed for new domains.

```json
// references/sdkg-registry.json
{
  "instances": {
    "competitor-analysis": {
      "schema": "references/schemas/competitor-analysis.schema.json",
      "data_path_pattern": "docs/specs/analyze-competitors.data.json",
      "freshness_days": 90,
      "trigger_keywords": ["earn", "redeem", "verify", "enroll", "loyalty", "points", "reward"],
      "gate_config": "scripts/gates/competitive-gate.mjs",
      "branch_field": "landscape_state",
      "compensating_control_template": "references/templates/compensating-control.md"
    }
    // future: "security-cwe", "performance-baseline", "accessibility-wcag", etc.
  }
}
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ Producer side (analyze-competitors)                                  │
│                                                                       │
│   WebSearch + WebFetch (or gemini-cli)                                │
│         │                                                              │
│         ▼                                                              │
│   analyze-competitors.md       analyze-competitors.data.json          │
│   (human-readable)             (machine-readable, schema-conformant)  │
└─────────────────────────────────────┬─────────────────────────────────┘
                                      │
                                      │ both files committed together
                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Consumer side (validate-feature, write-spec, design-tech, ...)       │
│                                                                       │
│   SKILL invokes:                                                       │
│     node scripts/gates/competitive-gate.mjs --feature <spec.md>       │
│         │                                                              │
│         ▼                                                              │
│   structured-gate-engine reads:                                        │
│     - schema (from sdkg-registry.json)                                │
│     - data file (from sdkg-registry.json data_path_pattern)           │
│     - current spec being validated                                     │
│         │                                                              │
│         ▼                                                              │
│   Branch on data.landscape_state:                                      │
│     populated → check spec mentions competitor patterns; if no        │
│                 match AND no compensating-control section → BLOCK     │
│     nascent → WARN + require thin_evidence_acknowledged frontmatter   │
│     none-found → require first-mover-risk checklist                   │
│     inapplicable → skip + log justification                           │
│         │                                                              │
│         ▼                                                              │
│   Return: { verdict: "block"|"warn"|"pass", missingFields, citations }│
└──────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ post-skill hook
                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Continuous monitoring                                                 │
│                                                                       │
│   hooks/svc-task-completion-guard.sh                                  │
│     → post-task-trigger-router.mjs                                    │
│         → reads sdkg-registry.json                                    │
│         → for each registered instance, checks if completed task      │
│           subject matches trigger_keywords                            │
│         → appends to .svc/<instance>-monitor-triggers.jsonl           │
└──────────────────────────────────────────────────────────────────────┘
```

### External Dependencies

**Zero new npm dependencies.** [Layer 1, Confidence 9/10] Custom 80-LOC JSON-Schema subset validator avoids `ajv` (~50KB transitive deps that themselves can decay). The framework's zero-dep posture is a stated value — adding deps to enforce a "fix decay" feature would be self-undermining.

**Hosts of capability:** WebSearch + WebFetch (Claude/Codex/Gemini native) OR gemini-cli (per `rules/research-must-use-gemini-cli.md`). All host-native, no install.

### Technology Decisions

| # | Decision | Choice | Alternatives considered | Layer | Confidence | Rationale |
|---|----------|--------|------------------------|-------|------------|-----------|
| 1 | **Shared gate engine location** | `scripts/lib/structured-gate-engine.mjs` (primitive) + `scripts/gates/<instance>.mjs` (config per instance) | (a) inline in each SKILL.md as bash; (b) one monolith `scripts/competitive-gate.mjs`; (c) primitive + config split (chosen) | [Layer 1] | 9/10 | Splitting primitive from config is the only choice that generalizes to future SDKG instances. Inline-bash and monolith both bind the engine to "competitive" forever. |
| 2 | **Tier-1 validator pattern** | Bash wrapper (5 LOC) calling shared `sdkg-validator.sh` helper which calls node | (a) pure node validators; (b) bash wrapper + per-validator node helper; (c) bash wrapper + shared node helper (chosen) | [Layer 1] | 9/10 | Matches existing 62 validators' dominant pattern; shared helper means new SDKG instances get a 5-LOC validator, not a 50-LOC one. |
| 3 | **Hook integration** | Extend `hooks/svc-task-completion-guard.sh` to invoke `post-task-trigger-router.mjs` (primitive) which reads `sdkg-registry.json` | (a) new hook script per SDKG instance; (b) inline trigger logic in existing hook; (c) router primitive (chosen) | [Layer 1] | 8/10 | Single hook + router scales to N triggers. Per-instance hooks would create wiring sprawl; inline would force engine edits per SDKG. |
| 4 | **Schema runtime + format** | JSON schemas + pure-node ~80-LOC JSON-Schema subset validator. Zero npm deps. | (a) YAML+ajv (spec's original); (b) JSON+ajv; (c) JSON+pure-node (chosen) | [Layer 3 / EUREKA] | 8/10 | **EUREKA:** the framework fixes "stored-knowledge-decay" — adding decay-prone deps to enforce that fix would be self-undermining. Pure-node implementation is ~80 LOC, supports the schema features we need (type, required, enum, format date, items, properties), and is fully owned. Trade-off: doesn't validate every JSON-Schema feature — but the schemas we write are deliberately constrained. |

### Feature Toggle System

Toggles defined in spec (`SVC_COMPETITIVE_GATE_ENFORCE`, `SVC_COMPETITIVE_RESCAN_ALLOWED`, `SVC_COMPETITIVE_LANDSCAPE_OVERRIDE`) read via `process.env` in `structured-gate-engine.mjs`. No config file. **First-demo guarantee:** the gate runs locally with zero credentials — its only inputs are repo files (schema + data). External research (WebSearch/gemini-cli) is gated separately by `analyze-competitors`, not by the gate engine itself.

### Mock Architecture

For the 6 fixture tests in `test/competitive-gate.test.mjs`:
- Fixture A: `populated` landscape, spec matches competitor pattern → pass
- Fixture B: `populated` landscape, spec diverges, no CC section → block
- Fixture C: `populated` landscape, spec diverges, CC section filled → pass
- Fixture D: `nascent` landscape → warn
- Fixture E: `none-found` landscape, no first-mover checklist → block
- Fixture F: `inapplicable` → skip + justification logged

All fixtures live in `test/fixtures/sdkg/` — reusable for future SDKG instances.

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|-----------|-----------|-----------------|------------------|---------------|---------|
| Compute (validator runtime) | ~50ms per validator run × 5 new validators = ~250ms per `lint` | Local dev runs `lint` ~20×/day, CI runs once per PR | ~5s/day local; CI absorbs in existing tier-1 budget | Constant (file count grows linearly but slowly) | Local machine / GitHub Actions free tier |
| Storage (schema + fixtures + jsonl) | ~50KB total committed | One-time | $0 | Constant | Repo (free) |
| Bandwidth | None — all local files | — | $0 | — | — |
| External API calls (WebSearch/WebFetch via gateway) | Per `analyze-competitors` run only — gate engine itself makes ZERO external calls | When `analyze-competitors` runs (quarterly + on-demand) | $0 host-native; gemini-cli quota if routed there | Per `analyze-competitors` invocation, not per gate check | Builder's host plan / gemini-cli quota |
| Background jobs | None | — | $0 | — | — |

**Scaling trigger points:** None within realistic horizons. Validator runtime is local file I/O + ~80 LOC of pure-node code. SDKG registry can hold 50+ instances before any perf consideration.

**First-month and year-1 projections:** $0 / $0. Zero net infra cost.

**Zero-cost justification:** all primitives + instances are pure-node + bash, run on the developer's machine and existing CI. No external service. The only cost is `analyze-competitors` API calls when it actually runs, and those existed before WI-140.

### Operations & Ownership

| Dimension | Answer |
|-----------|--------|
| **Owner** | Framework maintainers (s7an-it). Solo founder operationally. |
| **On-call** | Best-effort response. No paging. |
| **SLA / SLO** | N/A — framework, not service. Tier-1 validators must complete in <30s as a soft target (matches existing tier-1 budget). |
| **Error budget** | N/A. |
| **Monitoring** | `.svc/pipeline-decisions.jsonl` audit trail; tier-1 validator pass/fail counts in `bash test-framework/evals/run-all-evals.sh --tier1` output. |
| **Alerting** | Tier-1 sweep failure surfaces in CI / local lint output. No external alerting. |
| **Dashboard** | None. |
| **Runbook** | This spec + the SDKG registry are the runbook. |
| **Failure modes** | (1) Gate misfires (false block on legitimate work) → `SVC_COMPETITIVE_GATE_ENFORCE=false` env override + log to pipeline-decisions. (2) Schema validator rejects valid data → fix validator or schema. (3) Hook router slows post-task by >50ms → optimize router (reads one JSON file). |
| **Recovery procedure** | All changes are git-reversible. No data state. |
| **Backup / restore** | N/A — stateless, all in repo. |
| **Dependencies' failure impact** | If WebSearch / gemini-cli down: `analyze-competitors` emits `BLOCKING-DISCOVERY-HALT` per GATE-FAIL-01. Gate engine itself never depends on external services. |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pure-node JSON-Schema validator misses edge cases the schemas use | Schema-conformance check passes invalid data | Constrain schemas to the validator's supported subset (documented in `scripts/lib/json-schema-validator.mjs` header). Test fixtures cover every supported feature. |
| SDKG registry becomes a god-object as more instances added | Maintenance burden | Cap at ~10 instances; if more needed, split per-domain registries. Not a near-term risk (one instance now). |
| `landscape_state: inapplicable` becomes the easy escape hatch | Gate becomes opt-out | `landscape_inapplicable_reason` is REQUIRED; logged as `taste` decision in pipeline-decisions; periodic audit of `inapplicable` justifications. |
| Hook router adds latency to every task completion | Slower DX | Router is a single JSON read + keyword match per registered instance. <5ms total. Profile in T5.4. |
| Adding js-yaml or ajv later "for convenience" reverses the EUREKA | Reintroduces decay-prone deps | Document the zero-dep stance in `scripts/lib/json-schema-validator.mjs` header so future contributors don't add deps unthinkingly. |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|-----------|-------|------|-----------|
| Schema runtime | Pure-node JSON | YAML+ajv | Eats own dogfood (anti-decay); cost is ~80 LOC of validator code |
| Scope: build primitive layer now | Build primitive layer | Inline competitive-only solution | Future SDKG instances pay back the ~150 LOC primitive cost in 1 reuse |
| Hook strategy | Single hook + router | New hook per SDKG | Wiring sprawl avoided; one extension point |
| Validator pattern | Bash wrapper + shared node helper | Pure node validators | Matches existing 62-validator convention; new validators are 5 LOC |


---

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[NEW]` | `proposals/done/2026-05-01-competitive-awareness-gap.md` (this) |
| 2 | Journey | `[NEW]` | System flow diagram above; no end-user journey (Enabler) |
| 3 | Acceptance criteria | `[NEW]` | 8 user stories, 30+ ACs above |
| 4 | UX | `[N/A — justified: framework-internal Enabler with no UI; CLI artifacts only]` | n/a |
| 5 | UI | `[N/A — justified: framework-internal Enabler with no UI; CLI artifacts only]` | n/a |
| 6 | Tech architecture | `[NEW]` | Filled by design-tech 2026-05-02. SDKG primitive layer (5 reusable files) + competitive instance (~17 files). Zero npm deps. JSON+pure-node validator [Layer 3 EUREKA]. |
| 7 | Cost model | `[NEW]` | Estimate: 5 tier-1 validators × ~50 LOC each + schema + 4 SKILL.md edits + 1 hook script. Token cost per-gate: ~2-5K (one schema read + branch decision). No infra cost |
| 8 | Operations & ownership | `[NEW]` | Owner: framework maintainers (s7an-it). Operational behavior: validators run on every `lint`. Failure mode: spec stays DRAFT until structured competitor data refreshed. On-call: none (framework, not service) |

---

## Implementation Notes

_To be added by plan-changeset and execute-changeset._

---

## Journey References

> N/A — Enabler with no end-user journey. System flow above replaces journey doc per write-spec convention for framework-internal enablers.

---

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|------|----|-----|-----|-----|----------|
| 2026-05-01 | (initial) | — | All 8 stories drafted | Initial spec from proposal 2026-05-01 | write-spec |
| 2026-05-01 | GATE-FAIL-01, GATE-FAIL-02, GATE-ZERO, COMP-ZERO | (new) | Added | G0 directive 1 (zero silent failures) + directive 4 (interactions have edge cases): network-failure path, freshness-anomaly path, first-time-use zero state | write-spec G0 scope review |
| 2026-05-01 | landscape_state | "populated\|none-found" | "populated\|nascent\|none-found\|inapplicable" | User refinement: environment must include nascent (1-2 competitors) and inapplicable (internal/regulated) — single binary would false-block legitimate work | write-spec |
| 2026-05-02 | COMP-01, COMP-04, schema runtime | YAML+ajv | JSON+pure-node 80-LOC validator | Reality check: framework has zero npm deps. Adding ajv/js-yaml to enforce a "fix decay" feature would itself be decay-prone. Pure-node implementation is a [Layer 3 / EUREKA] move that eats own dogfood. ~80 LOC validator covers the schema features used. | design-tech |
| 2026-05-02 | architecture (cross-cutting) | (single-purpose competitive gate) | SDKG primitive layer + competitive instance | Per session feedback "more robust validation + general feature feed process" — design as reusable Structured Domain Knowledge Gate primitive. Future security/perf/a11y gates reuse 5 primitives with one schema + one config + 5 thin validator wrappers per instance. | design-tech |
| 2026-05-02 | (new) Feasibility Matrix | (none) | All 30 ACs feasible against tech design; only revision needed was schema runtime (YAML→JSON, see entries above) | design-tech walked every AC against chosen primitives + instance components | design-tech |
