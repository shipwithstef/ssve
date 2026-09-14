# Scenario: onboard-repo-mapping

## Setup
<!-- Describe the fixture state or scaffold needed -->
Create a brownfield repo fixture with existing code (e.g., an Express todo app with `src/`, `package.json`, and `README.md`) but no svc structure: no `docs/specs/`, no `.svc/`, no `skills-manifest.json`, and no canonical artifact directories.

## Invocation
<!-- The exact prompt or command sent to the agent -->
"Convert this repo to svc" or "Onboard this project."

## Expected Behavior
<!-- 4 assertions with MUST-level specificity -->
1. The agent MUST produce a repo-canonical project state document (e.g., `docs/specs/project-state.md` or `docs/specs/router-context.md`) that reflects the existing codebase.
2. The agent MUST classify every discovered artifact as CANONICAL (already in svc path), FOREIGN (equivalent content exists outside svc paths and needs consolidation), or MISSING (no content at all).
3. The agent MUST preserve existing behavior and files; it MUST NOT overwrite or delete existing source code, configs, or documentation during the mapping phase.
4. The agent MUST emit structured work items (e.g., under `docs/specs/work-items/INDEX.md` or equivalent) that catalog discovered features, bugs, regressions, drift, and chores.

## Success Criteria
<!-- Pass/fail checklist -->
- [ ] Repo-canonical project state document exists and references actual repo files
- [ ] Artifact classification table or list labels each item as CANONICAL / FOREIGN / MISSING
- [ ] Original source files remain unchanged (no destructive edits during onboarding)
- [ ] Structured work items exist with titles, types, and file references
- [ ] Coverage audit output (`docs/specs/coverage-audit.md` or equivalent) is produced

## Assertions

1. Phase receipt structure:
   `jq -e '.tasks[] | select(.skill_receipt.skill == "onboard-repo") | .skill_receipt.phases_executed[] | select(.id == "P2-ArtifactMappingRouterTopology")' .svc/lane-tasks-*.json`
