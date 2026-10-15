# Tier 2 Scenario: retire-cloud-resources routing

## Skill Under Test

`retire-cloud-resources`

## Workspace

Copy the router and the competing skills into `.claude/skills/` before the prompt:

- `route-workflow`
- `retire-cloud-resources`
- `plan-blast-radius`
- `infra-sre`
- `manage-finops`

## Setup

A consumer email app finished cutover. Health probes on the new stack have passed on every slot, including the final slot. The operator wants the old resources removed and the neighbouring shared account left untouched.

## Prompt

```
Route this request: The new consumer email app has soaked since cutover. Delete the old resources and do not touch the shared account next door.
```

## Expected Outputs

- The reply independently selects `retire-cloud-resources`.
- The prompt does not name the skill or the required answer.
- Adjacent requests are separate scenarios: `retire-cloud-resources-negative-plan-severity`, `retire-cloud-resources-negative-still-serving`, and `retire-cloud-resources-negative-provider-cost`.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"retire-cloud-resources","label":"independently selects retire-cloud-resources"}
]
```
