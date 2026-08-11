# Kimi Route-Workflow Integration Eval

## Setup
- **Host:** Kimi Code CLI
- **Skills needed:** `route-workflow`
- **Fixture:** none (empty workspace)

## Prompt
```
You are using the Serious Vibe Coding framework. Read the framework context from DOCTRINE.md and KIMI.md in this directory, then use route-workflow to determine what to do next for a new project that needs user authentication.

The project is a greenfield SaaS app. The builder wants to add OAuth-based authentication. What should the first skill be?
```

## Expected Outputs

### File Exists
- `docs/specs/project-state.md` (may not be created — this is a routing-only eval)

### Content Checks
- Output should mention "validate-feature" or "write-vision"
- Output should mention the `greenfield` lane

### Output Assertions
- "route-workflow"
- "validate-feature"

### Phase Receipt Assertion
- `jq -e '.tasks[] | select(.skill_receipt.skill == "route-workflow") | .skill_receipt.phases_executed[] | select(.id == "P3-StateInitializationAndLaneRouting")' .svc/lane-tasks-*.json`
