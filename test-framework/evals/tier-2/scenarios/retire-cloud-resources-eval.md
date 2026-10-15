# Tier 2 Scenario: retire-cloud-resources routing

## Skill Under Test

`retire-cloud-resources`

## Setup

A consumer email app finished cutover. Health probes on the new stack have passed on every slot, including the final slot. The operator wants the old resources removed and the neighbouring shared account left untouched.

## Prompt

```
Route this request: The new consumer email app has soaked since cutover. Delete the old resources and do not touch the shared account next door.
```

## Expected Outputs

- The reply independently selects `retire-cloud-resources`.
- The prompt does not name the skill or the required answer.

## Assertions

### Process Checks
```json
[
  {"type":"output_regex","regex":"retire-cloud-resources","label":"independently selects retire-cloud-resources"}
]
```

## Adjacent negatives

Each block is a separate request. None of them names the skill to select.

### Prompt — plan severity before apply

```
Route this request: Read the terraform plan and classify its severity before anyone applies it.
```

Expected selection: `plan-blast-radius`.

### Prompt — old app still serving

```
Route this request: The old app is still serving users and the SLO is at risk.
```

Expected selection: `infra-sre`.

### Prompt — cost and provider switch

```
Route this request: What will the provider switch cost, and which provider should we pick?
```

Expected selection: `manage-finops`.
