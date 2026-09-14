# Tier 2 Scenario: growth-lead routing

## Skill Under Test

`growth-lead`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need a growth hypothesis and activation experiment.
Return exactly two short lines. Line one must say "Selected: growth-lead (not growth-eng)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `growth-lead`.
- Adjacent negative: rejects `growth-eng` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: growth-lead \\(not growth-eng\\)","label":"routes to growth-lead and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
