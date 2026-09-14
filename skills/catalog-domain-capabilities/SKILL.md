---
name: catalog-domain-capabilities
version: "1.0"
description: >-
  Build a living, queryable Domain Capability Matrix — classified inventory of what the industry does and how fast capabilities converge to table stakes; three-layer Capability→Journey→Spec artifact downstream skills query for gap analysis. Use when: "capability gap analysis", "are we missing industry-standard features", "what should our product do". Also: "industry capability matrix", "what does a complete product in this space look like". Also: "domain feature catalog".
phases:
  - id: P1-PriorCatalogLoad
    trigger: always
    reads: ["references/knowledge/domains/<domain>/CAPABILITY-CATALOG*.json", "docs/specs/domain-profile.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-CapabilityExtraction
    trigger: always
    reads: ["docs/specs/analyze-competitors.md", "docs/specs/analyze-competitors.data.json"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-CapabilityClassification
    trigger: always
    reads: ["domain capability candidates", "references/knowledge/domains/DEFAULT-BPS-WEIGHTS.json"]
    writes: ["docs/specs/capability-catalog.data.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-JourneySpecMapping
    trigger: always
    reads: ["docs/specs/journeys/*.feature.md", "docs/specs/features/*.md"]
    writes: ["docs/specs/capability-catalog.data.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-GapPriorityScoring
    trigger: always
    reads: ["docs/specs/capability-catalog.data.json"]
    writes: ["docs/specs/capability-catalog.md", "docs/specs/capability-catalog.data.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-CatalogPersistence
    trigger: always
    reads: ["docs/specs/capability-catalog.data.json"]
    writes: ["references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/analyze-competitors.md", artifact: analyze-competitors }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
  optional:
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/journeys/*.feature.md", artifact: existing-journeys }
    - { path: "docs/specs/features/*.md", artifact: existing-specs }
    - { path: "references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json", artifact: prior-catalog }
outputs:
  produces:
    - { path: "docs/specs/capability-catalog.md", artifact: capability-catalog }
    - { path: "docs/specs/capability-catalog.data.json", artifact: capability-catalog-data }
    - { path: "references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json", artifact: knowledge-layer-catalog }
chain:
  lanes:
    greenfield: { position: 4, prev: analyze-competitors, next: build-personas }
  progressive: true
  self_verify: true
  human_checkpoint: false
  terminal: false
---

# Domain Capability Matrix

**Runtime v2 continuation:** Register every produced artifact with its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve catalog provenance and knowledge-promotion conditions.

Build the classified, traceable inventory of what a product in this domain
**must, should, and could** do — structured so downstream skills query it for
gap analysis, journey scaffolding, and build-priority scoring.

**Announce at start:** "I'm using the catalog-domain-capabilities skill to build
a classified domain capability matrix."

**Knowledge protocol:** Follow `references/knowledge-protocol.md`. The catalog
is a **knowledge-layer primitive** — it persists in `references/knowledge/`
and compounds across projects in the same domain.

---

## Core Concept: Three-Layer Traceability

The catalog creates traceable links across three layers:

```
Layer 1: CAPABILITY     — what the industry does (domain-level)
Layer 2: JOURNEY        — how our users experience it (product-level)
Layer 3: SPEC           — how we implement it (code-level)
```

Example trace:
```
Capability: "User identity verification"
  → Journey: "onboarding → step 3: verify identity"
  → Spec: "docs/specs/features/identity-verification.md"
  → Mechanics: email-otp (common), id-document (rare), biometric (emerging)
```

This makes gap analysis **automatic**: if a capability is `universal` but no
journey or spec traces to it, the catalog flags a gap with priority and effort.

---

## Process

### Step 0: Read prior catalog (knowledge-first)

Load the most recent tiered knowledge layer. Start with L1 (table stakes); load deeper tiers only if the project has already narrowed:

```bash
# Always load L1 first
cat references/knowledge/domains/<domain>/CAPABILITY-CATALOG-L1.json 2>/dev/null

# Load L2 if domain is committed (domain-profile.md exists and specifies domain)
cat references/knowledge/domains/<domain>/CAPABILITY-CATALOG-L2.json 2>/dev/null

# Load L3-L4 only during design/tech phases (not at greenfield start)
cat references/knowledge/domains/<domain>/CAPABILITY-CATALOG-L3.json 2>/dev/null
cat references/knowledge/domains/<domain>/CAPABILITY-CATALOG-L4.json 2>/dev/null

# Or use the helper to load merged tiers up to a depth
node skills/catalog-domain-capabilities/scripts/merge-tiered-catalog.mjs \
  --domain <domain> \
  --depth 2 \
  --output /tmp/prior-catalog.json
```

If knowledge layer exists and is fresh (< 30 days for domain data):
- Load tiers up to current project depth
- Skip capabilities already cataloged at those tiers
- Focus research on: new capabilities, mechanic shifts, convergence changes, deeper tiers

If stale or missing: full build from competitor analysis + domain profile.

### Step 1: Extract capabilities from competitors

Read `docs/specs/analyze-competitors.md` (human) and
`docs/specs/analyze-competitors.data.json` (machine).

For each competitor, extract capabilities at **atomic granularity**:
- One capability = one user-meaningful function (e.g., "magic-link login",
  not "authentication")
- Group capabilities into **categories** (see Classification Schema below)
- Record **mechanics** — how the capability is implemented in this domain

**Mechanic extraction rules:**
- For each capability, list the dominant implementation patterns in the domain
- Score each mechanic by prevalence across competitors
- Flag emerging mechanics (present in <2 competitors but growing fast)

**Dependency extraction rules:**
- Record which capabilities are prerequisites for others
- Example: "team invites" depends on "user registration" and "role system"
- Record reverse dependencies: which capabilities unlock others
- This makes gap analysis smarter: "You want X but you're missing Y. Build Y first."

Example:
```json
{
  "capability_id": "auth-login",
  "name": "User Login",
  "mechanics": [
    { "pattern": "email+password", "prevalence": "universal", "tier": "MVP" },
    { "pattern": "oauth-social", "prevalence": "common", "tier": "MVP" },
    { "pattern": "magic-link", "prevalence": "occasional", "tier": "growth" },
    { "pattern": "passkey-webauthn", "prevalence": "rare", "tier": "enterprise", "converging": true }
  ],
  "dependencies": [],
  "dependent_capabilities": ["account-recovery", "session-management", "mfa-setup"]
}
```

### Step 2: Classify each capability

**Classification Schema (6 dimensions):**

| Dimension | Values | What it means |
|---|---|---|
| **Frequency** | universal / common / occasional / rare | How many competitors have this |
| **Maturity** | MVP-required / growth-stage / enterprise / edge-case | When you need it |
| **Visibility** | user-facing / admin-facing / backend-only / regulatory | Who sees it |
| **Kano** | must-be / one-dimensional / attractive / indifferent | User psychology |
| **Convergence Velocity** | stable / accelerating / explosive | How fast it's becoming table stakes |
| **Mechanic Count** | 1 / 2-3 / 4+ | Implementation complexity in domain |

**Kano classification rules:**
- **Must-be**: Users expect it; absence causes dissatisfaction. Presence is invisible.
  Example: password reset, data export.
- **One-dimensional**: More = better. Users notice and compare.
  Example: speed, storage limit, number of integrations.
- **Attractive**: Users don't expect it; presence delights. Absence is neutral.
  Example: AI suggestions, unexpected automation.
- **Indifferent**: Users don't care either way.
  Example: minor UI preferences, backend infra they never see.

**Convergence velocity rules:**
- **Stable**: Prevalence unchanged for >12 months
- **Accelerating**: Moved up one frequency tier in the last 6-12 months
- **Explosive**: Moved up one frequency tier in <6 months OR multiple competitors launched simultaneously

**Depth tier classification (onion model):**

Each capability is assigned a depth tier (1-4). Deeper tiers are only loaded when shallower tiers are active — keeping the initial view focused while preserving drill-down detail.

| Depth | Name | Classification Rule | Example |
|---|---|---|---|
| **L1** | Industry table stakes | `frequency: universal` AND no dependencies | User registration, login, password reset |
| **L2** | Domain-specific | `frequency: common` OR depends on L1 capability | OAuth login, team invites, compliance reporting |
| **L3** | Niche / mechanic-level | `frequency: occasional/rare` OR depends on L2 OR `convergence: explosive` | Passkey auth, RBAC with dynamic roles, GDPR portability |
| **L4** | Implementation pattern | Edge-case mechanic OR <2 competitors OR depends on L3 | WebAuthn platform authenticator, time-bound role inheritance |

**Progressive loading rule:**
- `--depth 1` (greenfield day 1): L1 only — see what you must build
- `--depth 2` (after domain commit): L1 + L2 — see domain-specific requirements
- `--depth 3` (during design): L1-L3 — see mechanic options and convergence alerts
- `--depth 4` (during tech design): L1-L4 — see implementation patterns and edge cases

**Why this matters:** When you narrow from "SaaS" to "fintech SaaS" to "fintech auth," the opportunity matrix expands. L1 has 20 capabilities. L2 adds 15 fintech-specific. L3 adds 12 auth mechanisms. L4 adds 8 regulatory flows. Each narrowing decision should feel like **more capability surface appearing**, not less.

### Step 3: Map capabilities to journeys

For each capability, identify which **user journeys** it serves.

Read existing journeys from `docs/specs/journeys/*.feature.md` if they exist.
Map capabilities to journey steps:

```json
{
  "capability_id": "auth-login",
  "journey_mappings": [
    { "journey": "onboarding", "step": "authenticate", "required": true },
    { "journey": "return-visit", "step": "quick-login", "required": true },
    { "journey": "account-recovery", "step": "re-authenticate", "required": false }
  ]
}
```

If no journeys exist yet, infer standard journey mappings from domain norms.
This output feeds directly into `write-journeys` as a scaffolding guide.

### Step 4: Compute build-priority scores

For each capability, compute a **Build Priority Score (BPS)**:

```
BPS = (frequency_weight × F) + (kano_weight × K) + (moat_potential × M) - (complexity_penalty × C) + (convergence_bonus × V)
```

**Weights (default, adjustable per domain):**

Load domain-specific weights from `references/knowledge/domains/DEFAULT-BPS-WEIGHTS.json`:

```bash
# Detect domain from domain-profile.md and load matching preset
node skills/catalog-domain-capabilities/scripts/load-bps-weights.mjs --domain $(cat docs/specs/domain-profile.md | grep -m1 "domain:" | awk '{print $2}')
```

| Preset | Best For | Freq | Kano | Moat | Complexity | Convergence |
|---|---|---|---|---|---|---|
| balanced | General / unknown | 3.0 | 2.5 | 2.0 | 1.5 | 2.0 |
| fintech | Regulatory-heavy | 3.0 | 3.0 | 1.5 | 1.5 | 2.0 |
| devtools | Developer loyalty | 2.5 | 2.0 | 3.0 | 2.0 | 1.5 |
| saas-b2b | Enterprise sales | 3.5 | 2.5 | 2.0 | 1.5 | 2.5 |
| saas-b2c | Consumer retention | 2.5 | 3.0 | 2.0 | 1.0 | 2.5 |
| ai-ml | Model differentiation | 2.0 | 2.0 | 3.5 | 2.0 | 2.5 |

Default scoring:
| Factor | Weight | Scoring |
|---|---|---|
| Frequency (F) | 3.0 | universal=4, common=3, occasional=2, rare=1 |
| Kano (K) | 2.5 | must-be=4, one-dimensional=3, attractive=2, indifferent=0 |
| Moat Potential (M) | 2.0 | Score 1-5 from analyze-competitors moat assessment |
| Complexity (C) | 1.5 | mechanic-count: 1=1, 2-3=2, 4+=3 |
| Convergence (V) | 2.0 | stable=0, accelerating=1, explosive=2 |

**BPS interpretation:**
| BPS Range | Priority | Action |
|---|---|---|
| 25+ | P0 — Build now | Universal must-be, converging fast |
| 18-24 | P1 — Next milestone | Common must-be or universal one-dimensional |
| 12-17 | P2 — Roadmap | Growth-stage or attractive differentiators |
| 6-11 | P3 — Consider | Rare or edge-case |
| <6 | P4 — Skip | Indifferent or overly complex for value |

### Step 5: Generate gap analysis

Compare the catalog against existing project artifacts:

```bash
ls docs/specs/journeys/*.feature.md 2>/dev/null
ls docs/specs/features/*.md 2>/dev/null
```

For each capability, determine coverage with quality grading:

| Quality | Label | Definition | Remediation |
|---|---|---|---|
| **V0** | Not Mentioned | No trace in any project artifact | Add to roadmap (P0-P4 based on BPS) |
| **V1** | Mentioned | Listed in spec/journey but no AC or mechanic detail | Rewrite with acceptance criteria |
| **V2** | Partially Traced | Has AC/mechanic but no implementation evidence | Plan implementation or create work item |
| **V3** | Fully Traced | Journey → Spec → Implementation all exist | No action |

Coverage quality is stored per capability as `coverage_quality` (V0-V3).

Output a **Priority Gap Report** grouped by quality, then by BPS:

| Priority | Capability | Kano | Frequency | Gap Quality | Effort | Dependency Risk | Why It Matters |
|---|---|---|---|---|---|---|---|
| P0 | Data export | must-be | universal | V0 | low | none | Regulatory expectation; users churn without it |
| P1 | Team invites | one-dimensional | common | V1 | medium | requires "role system" | Journey exists but no spec; blocks B2B growth |

**Dependency-aware sequencing:**
When a capability has `dependencies[]`, check those first:
- If a dependency is V0/V1, flag: "You want X but Y is not ready. Build Y first."
- Sequence gaps in dependency order, not just BPS order.

### Step 6: Write outputs

#### 6a: Project artifact (`docs/specs/capability-catalog.md`)

Human-readable, decision-support format:

```markdown
# Domain Capability Matrix

**Generated:** YYYY-MM-DD
**Domain:** [specific category]
**Source:** analyze-competitors + domain-profile synthesis
**Prior Catalog:** [none | references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json]

## Executive Summary

- **Total capabilities cataloged:** N
- **Universal (table stakes):** N
- **Our coverage:** X/Y universal, A/B common
- **Top gaps:** [list 3-5 highest-priority missing capabilities]
- **Convergence alerts:** [capabilities accelerating toward universal]

## Capabilities by Category

### 1. Identity & Access
| # | Capability | Freq | Maturity | Kano | Conv. | BPS | Coverage | Gap |
|---|-----------|------|----------|------|-------|-----|----------|-----|
| 1.1 | User registration | universal | MVP | must-be | stable | 28 | COVERED | — |
| 1.2 | OAuth login | common | MVP | must-be | stable | 24 | COVERED | — |
| 1.3 | Passkey auth | rare | enterprise | attractive | explosive | 18 | MISSING | HIGH |

[Same for categories 2-N]

## Mechanic Reference

### auth-login
| Pattern | Prevalence | Tier | Converging? |
|---------|-----------|------|-------------|
| email+password | universal | MVP | no |
| OAuth social | common | MVP | no |
| magic link | occasional | growth | yes |
| passkey | rare | enterprise | yes |

## Gap Analysis

### P0 — Build Now (BPS 25+)
[Table]

### P1 — Next Milestone (BPS 18-24)
[Table]

### Convergence Alerts
Capabilities moving toward universal fast — build before competitors close the gap:
[Table]

## Journey Scaffolding Guide

For projects without journeys yet, standard journey-to-capability mappings:

| Journey | Universal Capabilities | Common Capabilities |
|---------|----------------------|---------------------|
| Onboarding | registration, verification, profile setup | tutorial, preferences |
| Core loop | [list] | [list] |

## Recommendations

1. **Immediate:** [P0 gaps with low effort]
2. **Next milestone:** [P1 gaps]
3. **Differentiation bet:** [high-moat, attractive capabilities]
4. **Watchlist:** [converging capabilities to monitor]
```

#### 6b: Machine artifact (`docs/specs/capability-catalog.data.json`)

Structured JSON conforming to `references/schemas/capability-catalog.schema.json`.
Must include:
- `capabilities[]` with all 6 classification dimensions
- `mechanics[]` per capability with prevalence
- `journey_mappings[]`
- `gap_report[]` with coverage status and BPS
- `convergence_alerts[]`
- `build_priority_ranking[]`

#### 6c: Knowledge layer (`references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json`)

Subset of the machine artifact — domain-general only, no project-specific
coverage data. This is what future projects in the same domain load in Step 0.

Write `.version` with date. Stale after 30 days.
Update `references/knowledge/INDEX.md`.

---

## Refresh / Diff Mode

**Auto-trigger:** `refresh-competitors` emits a catalog-refresh signal when:
- ≥2 competitors have changed classifications
- A convergence velocity shift is detected (stable → accelerating)
- New universal or common capabilities are discovered

When invoked with `--refresh` (e.g., after `refresh-competitors`):

1. Load prior catalog from knowledge layer
2. Read updated competitor analysis
3. For each capability: compare classification against prior
4. Emit a **diff report**:

```markdown
## Capability Catalog Diff

### New Capabilities (N added)
| Capability | First seen in | Classification |

### Upgraded (converging)
| Capability | Was | Now | Trigger |

### Downgraded (dying)
| Capability | Was | Now | Why |

### Coverage Changes
| Capability | Old Coverage | New Coverage | Action |
```

This diff is what makes the catalog a **strategic radar**, not a static checklist.

---

## Downstream Integration Contract

### For `write-journeys`
Reads `capability-catalog.data.json` to scaffold standard journeys:
- "Onboarding in [domain] typically requires capabilities: ..."
- Maps capability IDs to journey steps
- Auto-runs capability journey scaffolding after catalog generation:

```bash
node skills/write-journeys/scripts/capability-journeys.mjs --root .
```

This produces `docs/specs/journeys/J-CAP-<capability>.feature.md` for recognized
table-stakes capabilities only when stack matchers prove the capability is
implemented. This avoids false positives in greenfield catalogs.

### For `write-spec`
Reads catalog to verify spec completeness:
- "Your spec covers authentication. The catalog shows 4 mechanics in this domain.
  Which does your spec implement?"
- Flags: "Universal capability 'data export' is not mentioned in any spec."

### For `audit-coverage`
Uses catalog as the **coverage checklist**:
- Compares repo-canonical artifacts against catalog
- Coverage score = % of universal + common capabilities with spec/journey traces

### For `validate-feature`
- "Feature idea X maps to capability Y (BPS 22, common, must-be)."
- "3 competitors implement this via mechanic Z."
- Checks catalog for dependency gaps: "Your feature requires capability Z (V0). Build Z first."

### Query API (for downstream skills)

Downstream skills can query the catalog without loading the full JSON:

```bash
# List all P0 gaps for a specific journey
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --journey onboarding --status MISSING --min-bps 25 --markdown

# List converging capabilities (opportunity radar)
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --preset converging --markdown

# Get journey scaffolding for a new domain
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --preset journey-scaffold --journey onboarding
```

**Presets:**
| Preset | What it returns | Use in |
|---|---|---|
| `gaps` | All V0/V1/V2 gaps sorted by BPS | audit-coverage |
| `converging` | Capabilities with accelerating/explosive convergence | roadmap-evaluation |
| `top-p0` | P0 capabilities by BPS desc | write-spec |
| `journey-scaffold` | Capabilities mapped to a given journey | write-journeys |

**Available filters:** `--journey`, `--status` (COVERED/PARTIAL/MISSING), `--kano`, `--convergence`, `--category`, `--min-bps`, `--depth` (1-4), `--limit`

**Available sorts:** `bps` (default), `name`, `frequency`, `maturity`

---

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-PriorCatalogLoad --evidence command_output:.svc/catalog-domain-capabilities-prior.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-CapabilityExtraction --evidence command_output:.svc/catalog-domain-capabilities-extract.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-CapabilityClassification --evidence file:docs/specs/capability-catalog.data.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-JourneySpecMapping --evidence file:docs/specs/capability-catalog.data.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-GapPriorityScoring --evidence file:docs/specs/capability-catalog.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-CatalogPersistence --evidence file:references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json
```

---

## Auto Mode vs Guided Mode

**Auto mode** (`--progressive --auto-approve`):
- Extracts capabilities silently from competitor data
- Classifies automatically using default weights
- Generates catalog, gap report, and journey scaffolding
- Chains to `build-personas`

**Guided mode:**
- Presents category-by-category: "I found N capabilities in [category]. Here's the top 5 by BPS."
- Asks for Kano corrections: "I classified 'dark mode' as indifferent. Is it attractive for your users?"
- Presents gap report: "You're missing 3 universal capabilities. Which should we add to the roadmap?"

---

## Brownfield Behavior

For existing products:
1. Read existing specs and journeys
2. Map them to capabilities
3. Coverage analysis: "You have X/Y universal, A/B common"
4. Focus on gaps and convergence alerts
5. **Zombie capability detection**: find capabilities in the codebase that are not in any competitor or industry norm

### Zombie Capability Detection

A zombie capability is one that exists in the project's code/specs but does NOT appear in the domain catalog's L1-L3 tiers. These represent potentially dead code, over-engineering, or premature abstractions.

**Detection flow:**
```bash
# Extract capability mentions from existing specs
node skills/catalog-domain-capabilities/scripts/query-capability-catalog.mjs \
  --catalogPath docs/specs/capability-catalog.data.json \
  --status MISSING \
  --markdown > /tmp/coverage_gaps.md

# Cross-reference: which "existing" capabilities aren't in the domain catalog?
grep -oE '^\|[^|]+\|' docs/specs/capability-catalog.md | sed 's/|//g' > /tmp/project_caps.txt
grep -oE '^\|[^|]+\|' /tmp/coverage_gaps.md | sed 's/|//g' > /tmp/missing_caps.txt
# Zombies = in project_caps but not in missing_caps (already cataloged) and not in L1-L3
```

**Zombie scoring:**
| Indicator | Weight | Action |
|---|---|---|
| No competitor implements it | +3 | Likely over-engineering |
| No journey maps to it | +2 | Unused feature |
| Code exists but no spec | +2 | Dead code candidate |
| Last touched >6 months ago | +1 | Stale code |
| Score ≥ 6 | | Flag as zombie; recommend deprecation audit |

Zombie capabilities are stored in `zombie_capabilities[]` in the machine artifact.

---

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | `docs/specs/capability-catalog.md` exists | `test -f` | |
| 2 | `docs/specs/capability-catalog.data.json` exists and validates against schema | `node scripts/validate-json.mjs docs/specs/capability-catalog.data.json references/schemas/capability-catalog.schema.json` | |
| 3 | ≥80% of capabilities have mechanic extraction | count `mechanics[]` length > 0 | |
| 4 | All universal capabilities have Kano + convergence classified | grep for null/unknown | |
| 5 | BPS computed for all capabilities | `build_priority_ranking[]` length == capabilities count | |
| 6 | Gap report generated if project artifacts exist | `gap_report[]` present | |
| 7 | Knowledge layer written | `test -f references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json` | |
| 8 | `.version` updated | date within 1 day | |
| 9 | Depth tiers assigned (L1-L4) | every capability has `depth` field in [1,4] | |
| 10 | Coverage quality graded (V0-V3) | every capability has `coverage_quality` ∈ {V0,V1,V2,V3} | |
| 11 | Dependencies extracted | ≥50% of L2-L4 capabilities have non-empty `dependencies[]` | |
| 12 | Zombie detection run on brownfield | `zombie_capabilities[]` present if project artifacts exist | |
| 13 | Table-stakes capability journeys scaffolded | `node skills/write-journeys/scripts/capability-journeys.mjs --root . --dry-run` reports generated or stack-matcher skips | |

---

## Pipeline Continuation

### Task-graph mode
- source of truth: `.svc/lane-tasks-<WI>.json`
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` before leaving
- Update host mirror

### Chaining
**If `--progressive` and self-verify passed:**
- Chain to `build-personas`: `build-personas --progressive --lane greenfield`

**If standalone:**
- Report capability matrix summary + top 5 gaps + convergence alerts
- Suggest: "Next: run `build-personas` or `write-journeys` using the scaffolding guide"

**If invoked by `audit-coverage`:**
- Return gap report directly; do not chain

---

## Key Principles

1. **Atomic capabilities** — one user-meaningful function per row, not broad buckets
2. **Mechanics matter** — "how" is as important as "what" for design decisions
3. **Convergence is signal** — a capability moving fast toward universal is a deadline
4. **Knowledge compounds** — the catalog lives in `references/knowledge/` and improves with every project
5. **Traceability is the product** — the three-layer map (capability → journey → spec) is the actual deliverable; the markdown is just a view
6. **Gap analysis is automatic** — coverage should be computable without human reading
