# Tier 2 Scenario: security-ops routing

## Skill Under Test

`security-ops`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need a security threat and control review.
Return exactly two short lines. Line one must say "Selected: security-ops (not infra-sre)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `security-ops`.
- Adjacent negative: rejects `infra-sre` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: security-ops \\(not infra-sre\\)","label":"routes to security-ops and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
