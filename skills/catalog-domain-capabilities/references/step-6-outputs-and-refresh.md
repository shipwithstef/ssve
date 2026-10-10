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
