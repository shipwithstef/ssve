# Competitor Analysis Output Template

Two artifacts MUST be produced together:

1. **`docs/specs/analyze-competitors.md`** — human-readable analysis (markdown)
2. **`docs/specs/analyze-competitors.data.json`** — machine-readable data conforming to `references/schemas/competitor-analysis.schema.json`

**Banned header patterns** (rejected by `validate-competitor-analysis-schema.sh`, COMP-07):
- "No new web research performed"
- "Read-only consolidation"
- "Consolidation only"
- "Reshuffled from prior analysis"

Web research is MANDATORY. WebSearch + WebFetch (or gemini-cli per `rules/research-must-use-gemini-cli.md`) MUST be invoked per direct competitor before output is produced.

## Markdown structure

```markdown
# Competitor Analysis

**Generated:** YYYY-MM-DD
**Category:** <specific competitive category>
**Landscape state:** populated | nascent | none-found | inapplicable
**Source:** WebSearch + WebFetch (or gemini-cli) — live research per direct competitor

## Direct Competitors (up to 6)

### 1. <Company Name>
- **What they do:** <1-2 sentences>
- **Customer Mechanic Analysis** (NEW per WI-140):
  - **Earn mechanism:** <how customer earns: POS auto-accrue / scan / check-in / card-link / manual>
  - **Enrollment path:** <app-download / POS-auto / SMS / wallet-pass / web>
  - **Merchant cost:** <$ per location/month or per-transaction>
  - **POS integrations:** <list>
  - **Fraud prevention:** <list of controls>
  - **Customer complaints:** <list from G2/Reddit/App Store reviews>
- **Differentiator:** <what they claim>
- **Last verified:** YYYY-MM-DD

### 2-6. <same structure>

## Adjacent / Emerging / Macro tiers
<existing structure from analyze-competitors/SKILL.md>

## Landscape Summary
<existing structure>

## Whitespace + Moat Assessment
<existing>
```

## Companion JSON structure

```json
{
  "generated": "YYYY-MM-DD",
  "landscape_state": "populated|nascent|none-found|inapplicable",
  "landscape_state_justification": "...",
  "category": "...",
  "competitors": [
    {
      "name": "...",
      "tier": "direct|adjacent|emerging|macro",
      "url": "https://...",
      "last_verified": "YYYY-MM-DD",
      "earn_mechanism": "...",
      "enrollment_path": "...",
      "merchant_cost": "...",
      "pos_integrations": ["..."],
      "fraud_prevention": ["..."],
      "customer_complaints": ["..."]
    }
  ]
}
```

## Zero-state output (COMP-ZERO)

When the skill runs against a project with no prior competitor analysis AND deep research returns no direct competitors, produce a non-empty file with `landscape_state: "none-found"` + the First-Mover Risk Checklist. Empty output is a hard fail.

```json
{
  "generated": "YYYY-MM-DD",
  "landscape_state": "none-found",
  "landscape_state_justification": "Web research returned no direct competitors. <evidence>.",
  "category": "...",
  "competitors": []
}
```

The companion markdown for `none-found` must include:

```markdown
## First-Mover Risk Checklist

- why_no_one_tried: <hypothesis>
- what_would_have_to_be_true: <conditions for success>
- fastest_disconfirmation: <cheapest experiment to invalidate>
- abandonment_trigger: <signal that says "stop"; quantitative if possible>
```
