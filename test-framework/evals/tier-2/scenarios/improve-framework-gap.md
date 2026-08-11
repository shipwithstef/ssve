# Scenario: improve-framework-gap

## Setup
<!-- Describe the fixture state or scaffold needed -->
Seed a framework issue document at `docs/specs/framework-gap-missing-self-verify.md` describing a real gap: a specific skill (e.g., `design-ui`) lacks a Self-Verify table. Ensure the repo is on `main` and no worktree exists for this fix.

## Invocation
<!-- The exact prompt or command sent to the agent -->
"Improve the framework" or "Close framework gaps."

## Expected Behavior
<!-- 4 assertions with MUST-level specificity -->
1. The agent MUST identify the specific gap with evidence (file path, line reference, or prior eval failure).
2. The agent MUST record a `P4-ImplementationRouteDecision` phase receipt in the task graph:
   `jq -e '.tasks[] | select(.metadata.skill == "improve-framework" or .skill_receipt.skill == "improve-framework") | .skill_receipt.phases_executed[]? | select(.id == "P4-ImplementationRouteDecision")' .svc/lane-tasks-<WI>.json`
3. The agent MUST route the fix through the proper svc pipeline: if the change touches more than 2 files, it MUST produce a `write-spec` artifact and run in a worktree.
4. The agent MUST produce a changeset or proposal document (e.g., `docs/plans/framework-fix-<name>.md` or a `manifest.md`) before modifying any source files.
5. The agent MUST NOT hotfix `main` directly; all edits to tracked files MUST occur in a feature worktree or follow the land-changeset merge protocol.

## Success Criteria
<!-- Pass/fail checklist -->
- [ ] Gap is identified with a specific file path or evidence citation
- [ ] Task graph contains a `P4-ImplementationRouteDecision` phase receipt
- [ ] If >2 files affected, a spec or plan document exists before code edits
- [ ] A changeset proposal or manifest is produced
- [ ] No commits are made directly to `main`; worktree is created if needed
- [ ] Fix is traceable back to the seeded gap document
