# Tier 2 Scenario: infra-sre routing

## Skill Under Test

`infra-sre`

## Setup

A repository has a valid company context. This scenario tests routing comprehension only.

## Prompt

```
Route this request: I need an SLO and reliability risk review.
Return exactly two short lines. Line one must say "Selected: infra-sre (not security-ops)".
Line two must state that the skill is proposer-only and will not perform outward actions.
```

## Expected Outputs

- Selects `infra-sre`.
- Adjacent negative: rejects `security-ops` for this request.
- States the proposer-only boundary.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: infra-sre \\(not security-ops\\)","label":"routes to infra-sre and excludes adjacent skill"},
  {"type":"output_regex","regex":"proposer-only.*(not perform|performs no).*outward actions","label":"states proposer-only boundary"}
]
```
