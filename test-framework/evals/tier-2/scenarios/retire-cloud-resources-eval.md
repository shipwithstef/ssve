# Tier 2 Scenario: retire-cloud-resources routing

## Skill Under Test

`retire-cloud-resources`

## Setup

A consumer email app finished cutover two days ago. Health probes on the new stack have passed on every slot, including the final slot. The operator wants the old resource group removed and the neighbouring shared account left untouched.

## Prompt

```
Route this request: The new consumer email app has soaked since cutover. Delete the old resources, including rg-oldname-prod, and do not touch the shared account next door.
Return exactly two short lines. Line one must say "Selected: retire-cloud-resources (not plan-blast-radius)".
Line two must state that deletion is fail-closed and waits for an exact allow-list, a full soak window, and recorded human approval.
```

## Expected Outputs

- Selects `retire-cloud-resources`.
- Adjacent negative: `plan-blast-radius` classifies a plan before apply. It does not perform the deletion.
- States the fail-closed boundary: exact allow-list, full soak window, recorded human approval.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"Selected: retire-cloud-resources \\(not plan-blast-radius\\)","label":"routes to retire-cloud-resources and excludes plan classification"},
  {"type":"output_regex","regex":"fail-closed.*(allow-list|allow list).*(soak|human approval)","label":"states fail-closed deletion boundary"}
]
```
