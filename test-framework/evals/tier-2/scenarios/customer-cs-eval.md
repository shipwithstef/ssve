# Tier 2 Scenario: customer-cs routing

## Skill Under Test

`customer-cs`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need onboarding friction and churn signals.
Return exactly two short lines. Line one must say "Selected: customer-cs (not comms)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `customer-cs`.
- Adjacent negative: rejects `comms` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: customer-cs \\(not comms\\)","label":"routes to customer-cs and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
