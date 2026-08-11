# Tier 2 Scenario: tax-auditor routing

## Skill Under Test

`tax-auditor`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need tax evidence and filing-readiness gaps.
Return exactly two short lines. Line one must say "Selected: tax-auditor (not fin-analyst)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `tax-auditor`.
- Adjacent negative: rejects `fin-analyst` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: tax-auditor \\(not fin-analyst\\)","label":"routes to tax-auditor and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
