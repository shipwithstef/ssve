# Tier 2 Scenario: comms routing

## Skill Under Test

`comms`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need a draft stakeholder announcement.
Return exactly two short lines. Line one must say "Selected: comms (not customer-cs)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `comms`.
- Adjacent negative: rejects `customer-cs` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: comms \\(not customer-cs\\)","label":"routes to comms and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
