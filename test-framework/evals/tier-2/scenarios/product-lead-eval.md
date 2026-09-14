# Tier 2 Scenario: product-lead routing

## Skill Under Test

`product-lead`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need a product problem and roadmap priority.
Return exactly two short lines. Line one must say "Selected: product-lead (not growth-lead)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `product-lead`.
- Adjacent negative: rejects `growth-lead` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: product-lead \\(not growth-lead\\)","label":"routes to product-lead and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
