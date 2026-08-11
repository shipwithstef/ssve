# Tier 2 Scenario: privacy-dpo routing

## Skill Under Test

`privacy-dpo`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need a personal-data flow and retention review.
Return exactly two short lines. Line one must say "Selected: privacy-dpo (not security-ops)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `privacy-dpo`.
- Adjacent negative: rejects `security-ops` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: privacy-dpo \\(not security-ops\\)","label":"routes to privacy-dpo and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
