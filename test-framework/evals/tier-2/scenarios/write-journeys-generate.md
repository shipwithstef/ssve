# Scenario: write-journeys-generate

## Setup

Copy fixtures from `examples/todo-api/` into a temporary workspace:
- `docs/specs/vision.md`
- `docs/specs/personas/P1.md`
- `docs/specs/features/feature-todo-management.md`

Ensure `docs/specs/journeys/` is empty before running the prompt.

## Prompt

```
Use the write-journeys skill to generate journey docs for the todo CRUD feature. The feature spec is at docs/specs/features/feature-todo-management.md and the persona is at docs/specs/personas/P1.md.
```

## Expected Outputs

### File Exists

- `docs/specs/journeys/*.feature.md` — at least one journey document created
- `docs/specs/journeys/JOURNEY_INDEX.md` — journey index created

### Content Checks

- [ ] Journey docs contain Gherkin structure with "Given", "When", or "Then"
- [ ] Journey docs include acceptance-criteria traceability with "AC-"
- [ ] Journey docs include `## E2E Coverage` so `write-e2e` has an explicit handoff surface.
- [ ] Journey docs reference the persona with "P1" or "persona"
- [ ] Journey docs include "Layer 3" or "ungrounded" analysis
- [ ] Journey scenarios avoid implementation internals and generic UI wording such as "primary CTA" without a visible label/context.
- [ ] Phase receipt includes journey generation:
  `jq -e '.tasks[] | select(.skill_receipt.skill == "write-journeys") | .skill_receipt.phases_executed[] | select(.id == "P2-ScenarioGeneration")' .svc/lane-tasks-*.json`

### Process Checks
```json
[
  {
    "type": "artifact_exists",
    "glob": "docs/specs/journeys/*.feature.md",
    "label": "journey document created"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/journeys/*.feature.md",
    "regex": "##\\s+E2E Coverage",
    "label": "E2E coverage handoff section exists"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/journeys/*.feature.md",
    "regex": "@AC-|AC-",
    "label": "AC traceability present"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/journeys/*.feature.md",
    "regex": "(Layer 3|ungrounded)",
    "label": "journey analysis present"
  },
  {
    "type": "artifact_not_regex",
    "glob": "docs/specs/journeys/*.feature.md",
    "regex": "(src/|\\.tsx|\\.jsx|database column|localStorage|API endpoint)",
    "label": "journey prose avoids implementation internals"
  },
  {
    "type": "artifact_not_regex",
    "glob": "docs/specs/journeys/*.feature.md",
    "regex": "\\bprimary CTA\\b",
    "label": "journey prose avoids generic primary CTA wording"
  },
  {
    "type": "phase_receipt",
    "skill": "write-journeys",
    "phase": "P2-ScenarioGeneration",
    "label": "journey generation phase receipt exists"
  }
]
```

## Chain Continuation

If `--progressive` were set, the next skill would be `design-ux` for the greenfield lane.
