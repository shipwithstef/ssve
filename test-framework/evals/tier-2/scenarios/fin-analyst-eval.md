# Tier 2 Scenario: fin-analyst routing

## Skill Under Test

`fin-analyst`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need runway and budget impact analysis.
Return exactly two short lines. Line one must say "Selected: fin-analyst (not tax-auditor)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `fin-analyst`.
- Adjacent negative: rejects `tax-auditor` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: fin-analyst \\(not tax-auditor\\)","label":"routes to fin-analyst and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
