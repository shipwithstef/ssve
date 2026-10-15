# Tier 2 Scenario: a live old app routes to infra-sre

## Skill Under Test

`infra-sre`

## Workspace

Copy the router and the competing skills into `.claude/skills/` before the prompt:

- `route-workflow`
- `retire-cloud-resources`
- `plan-blast-radius`
- `infra-sre`
- `manage-finops`

## Setup

The old app is still receiving user traffic and the service level is at risk. This request is not a deletion.

## Prompt

```
Route this request: The old app is still serving users and the SLO is at risk.
```

## Expected Outputs

- The reply selects `infra-sre`.
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
  {"type":"expected_selection","skill":"infra-sre","label":"expected selection infra-sre"}
]
```
