# Tier 2 Scenario: procurement routing

## Skill Under Test

`procurement`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need vendor requirements and diligence comparison.
Return exactly two short lines. Line one must say "Selected: procurement (not strategic-decision)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `procurement`.
- Adjacent negative: rejects `strategic-decision` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: procurement \\(not strategic-decision\\)","label":"routes to procurement and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
