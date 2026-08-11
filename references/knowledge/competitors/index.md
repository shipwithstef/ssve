# Knowledge-Base Directory Layout

**Landscape state:** nascent — framework repo; competitor tracking is for product projects, not the framework itself.

Canonical filesystem schema for per-competitor structured knowledge.
Populated by `analyze-competitors` (one-shot, exhaustive) and refreshed
asynchronously by `refresh-competitors` (WI-143).

## Directory structure

```
references/knowledge/competitors/
├── index.md                    # This file
├── _test-fixture/              # Tier-1 validator test fixture
│   └── acme-corp/
│       ├── CAPABILITIES.md
│       ├── earn-mechanism.md
│       ├── .last_known_state.json
│       └── .last_full_refresh
└── <slug>/                     # One directory per competitor
    ├── CAPABILITIES.md         # Required
    ├── <topic>.md              # Optional deep-dives
    ├── changelog.jsonl         # Append-only change log (WI-143)
    ├── .last_known_state.json  # Machine-readable snapshot (WI-143: updated per refresh)
    ├── .last_full_refresh      # ISO-8601 timestamp of last analyze-competitors run
    └── .last_refresh           # ISO-8601 timestamp of last refresh-competitors run (WI-143)
```

## Required files

### `CAPABILITIES.md`
Exhaustive capability inventory. Markdown, human-readable, agent-consumable.
Must cover: core mechanics, enrollment paths, merchant cost, integrations,
fraud prevention, customer complaints.

### `.last_known_state.json`
Machine-readable snapshot of the competitor's current feature set.
Schema is informal — whatever the producer skill emits.

### `.last_known_state.json`
Machine-readable snapshot of the competitor's current public state.
Updated by `refresh-competitors` on each refresh run.
Schema:
```json
{
  "slug": "acme-corp",
  "refreshed_at": "2026-05-04T15:00:00Z",
  "homepage_title": "Acme — All-in-one platform...",
  "pricing_tiers": [{"name":"Starter","price":"$39/mo"}],
  "featured_integrations": ["Salesforce","HubSpot"],
  "recent_press_headlines": ["Acme raises $10M"],
  "leadership_page_names": ["Jane Doe, CEO"],
  "raw_checksum": "sha256:abc123..."
}
```

### `changelog.jsonl`
Append-only log of detected changes. One JSON line per change.
Schema:
```jsonl
{"detected_at":"2026-05-04T15:00:00Z","category":"pricing","what_changed":"starter_plan_price","old_value":"$29","new_value":"$39","source_url":"https://acme.com/pricing","significance":"high","confidence":0.92}
```

### `.last_full_refresh`
Single-line ISO-8601 timestamp of the last `analyze-competitors` run that
populated this directory.

### `.last_refresh`
Single-line ISO-8601 timestamp of the last `refresh-competitors` run.
Absent if refresh has never run.

## Optional topic files

Canonical topic names (stable slugs):
- `earn-mechanism.md`
- `enrollment-flow.md`
- `pricing-history.md`
- `fraud-controls.md`
- `customer-complaints.md`

Topic files are read by `readKnowledgeBase(slugs, topic)` when the caller
requests a specific topic. Missing topic files trigger `knowledge_gap`
recording, not a gate block.

## Slug registry

| Slug | Entity | Last refresh |
|------|--------|--------------|
| kimi-cli | Moonshot AI Kimi Code CLI | — |
| kimi-platform | Moonshot AI Platform | — |
| coreyhaines-martech | Corey Haines MarTech Pack | — |
| hashicorp-terraform-mcp | HashiCorp Terraform MCP | — |
| k8sgpt | K8sGPT | — |
| containers-k8s-mcp-server | Containers/K8s MCP Server | — |
| nous-hermes | Nous Hermes | — |

> **Note:** Actual competitor slugs for a given project live in
> `docs/specs/analyze-competitors.data.json` (WI-140 structured output).
> This registry lists framework-level reference competitors only.
