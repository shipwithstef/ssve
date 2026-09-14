# Tier 2 Scenario: revops routing

## Skill Under Test

`revops`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need revenue stage and handoff process.
Return exactly two short lines. Line one must say "Selected: revops (not fin-analyst)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `revops`.
- Adjacent negative: rejects `fin-analyst` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: revops \\(not fin-analyst\\)","label":"routes to revops and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
