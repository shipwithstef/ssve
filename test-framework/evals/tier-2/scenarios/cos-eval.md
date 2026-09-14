# Tier 2 Scenario: cos routing

## Skill Under Test

`cos`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need company briefing and executive synthesis.
Return exactly two short lines. Line one must say "Selected: cos (not fin-analyst)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `cos`.
- Adjacent negative: rejects `fin-analyst` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: cos \\(not fin-analyst\\)","label":"routes to cos and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
