# Tier 2 Scenario: plan severity routes to plan-blast-radius

## Skill Under Test

`plan-blast-radius`

## Workspace

Copy the router and the competing skills into `.claude/skills/` before the prompt:

- `route-workflow`
- `retire-cloud-resources`
- `plan-blast-radius`
- `infra-sre`
- `manage-finops`

## Setup

A terraform plan exists and nobody has applied it. This request asks for severity classification, not deletion.

## Prompt

```
Route this request: Read the terraform plan and classify its severity before anyone applies it.
```

## Expected Outputs

- The reply selects `plan-blast-radius`.
- The prompt does not name that skill.

## Assertions

### Process Checks
```json
[
  {"type":"artifact_exists","glob":".claude/skills/route-workflow/SKILL.md","label":"workspace exposes the router"},
  {"type":"artifact_exists","glob":".claude/skills/retire-cloud-resources/SKILL.md","label":"workspace exposes retire-cloud-resources"},
  {"type":"artifact_exists","glob":".claude/skills/plan-blast-radius/SKILL.md","label":"workspace exposes plan-blast-radius"},
  {"type":"artifact_exists","glob":".claude/skills/infra-sre/SKILL.md","label":"workspace exposes infra-sre"},
  {"type":"artifact_exists","glob":".claude/skills/manage-finops/SKILL.md","label":"workspace exposes manage-finops"},
  {"type":"expected_selection","skill":"plan-blast-radius","label":"expected selection plan-blast-radius"}
]
```
