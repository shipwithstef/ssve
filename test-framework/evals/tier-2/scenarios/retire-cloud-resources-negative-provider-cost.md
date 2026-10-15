# Tier 2 Scenario: provider cost routes to manage-finops

## Skill Under Test

`manage-finops`

## Workspace

Copy the router and the competing skills into `.claude/skills/` before the prompt:

- `route-workflow`
- `retire-cloud-resources`
- `plan-blast-radius`
- `infra-sre`
- `manage-finops`

## Setup

A provider switch is being considered. This request asks for cost and provider choice, not deletion.

## Prompt

```
Route this request: What will the provider switch cost, and which provider should we pick?
```

## Expected Outputs

- The reply selects `manage-finops`.
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
  {"type":"expected_selection","skill":"manage-finops","label":"expected selection manage-finops"}
]
```
