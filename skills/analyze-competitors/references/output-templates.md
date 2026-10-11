# analyze-competitors — output templates

Loaded from `SKILL.md` Step 5 and Step 6. The machine-readable companion
(`docs/specs/analyze-competitors.data.json`) follows
`references/templates/analyze-competitors-output-template.md` and
`references/schemas/competitor-analysis.schema.json` at the framework root.

## Step 5 — `docs/specs/analyze-competitors.md`

```markdown
# Competitor Analysis

**Generated:** YYYY-MM-DD
**Category:** [specific competitive category]
**Source:** WebSearch + public reviews

## Direct Competitors (target 8-10, was up to 6)

### 1. [Company Name]
- **What they do:** [1-2 sentences]
- **Key features:** [bulleted list]
- **Business model:** [pricing approach]
- **Users love:** [from reviews]
- **Users hate:** [from reviews]
- **Differentiator:** [what they claim]

### 2-6. [Same structure]

## Adjacent Competitors (target 8-10, was up to 5)
[Core dimensions only: product, pricing, differentiator, user pain]

## Emerging / Insurgent (target 6-8, was up to 5)
[Core + funding/traction signals]

## Macro Disruptors (target 4-6, was up to 4)
[Threat assessment: what trigger, what timeline, how to survive]

## Landscape Summary

### Table Stakes (everyone has, we must too)
- [feature 1]
- [feature 2]

### Competitive Features (some have, worth considering)
- [feature] — [who has it, why it matters]

### Whitespace (nobody does well)
- [gap 1] — [why it's an opportunity]
- [gap 2] — [why it's an opportunity]

### Common User Complaints (across all competitors)
- [complaint] — [N mentions across reviews]

## Moat Assessment

| Opportunity/Strength | Moat score (1-5) | Type | Why |
|---|---|---|---|
| [opportunity 1] | [score] | [type] | [reasoning] |

**Overall moat rating:** [average of top 3] — [no moat / weak / defensible]

## Differentiation Opportunity

Based on the whitespace, user pain, and moat assessment:
- **Our angle:** [how vision.md's approach differs]
- **What we can do that they can't/won't:** [specific capabilities]
- **What we should steal:** [best practices from competitors]
- **What we should avoid:** [mistakes competitors make]

## Impact on Feature Decisions

- **Feature discovery Q4 (the bet):** [informed by whitespace]
- **Spec ACs:** [informed by table stakes + competitive features]
- **UX design:** [informed by what users love/hate about competitors]
- **Marketing positioning:** [informed by differentiation opportunity]
```

## Step 6 — `references/knowledge/competitors/<competitor-slug>/CAPABILITIES.md`

```markdown
# <Competitor Name> — Capabilities
Analyzed: <date>
URL: <url>
## What: <one sentence>
## Pricing: <model and price points>
## Strengths: <bullet list>
## Weaknesses: <bullet list>  
## Users: <who uses it>
```
