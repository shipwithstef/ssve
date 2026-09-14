# Tier 2 Scenario: counsel routing

## Skill Under Test

`counsel`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need legal issue spotting for a contract.
Return exactly two short lines. Line one must say "Selected: counsel (not privacy-dpo)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `counsel`.
- Adjacent negative: rejects `privacy-dpo` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: counsel \\(not privacy-dpo\\)","label":"routes to counsel and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
