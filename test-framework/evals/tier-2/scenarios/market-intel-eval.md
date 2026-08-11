# Tier 2 Scenario: market-intel routing

## Skill Under Test

`market-intel`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need market and competitor evidence.
Return exactly two short lines. Line one must say "Selected: market-intel (not growth-lead)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `market-intel`.
- Adjacent negative: rejects `growth-lead` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: market-intel \\(not growth-lead\\)","label":"routes to market-intel and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
