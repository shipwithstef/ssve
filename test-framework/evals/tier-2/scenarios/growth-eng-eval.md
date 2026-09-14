# Tier 2 Scenario: growth-eng routing

## Skill Under Test

`growth-eng`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need experiment event taxonomy and measurement feasibility.
Return exactly two short lines. Line one must say "Selected: growth-eng (not growth-lead)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `growth-eng`.
- Adjacent negative: rejects `growth-lead` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: growth-eng \\(not growth-lead\\)","label":"routes to growth-eng and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
