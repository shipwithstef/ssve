# Scenario: quick-fix-typo

## Setup
<!-- Describe the fixture state or scaffold needed -->
Prepare a repo with a trivial bug: a typo in a user-visible string (e.g., `req.body.titel` instead of `req.body.title`), a missing import, or a wrong variable name. The repo MUST have no active `.svc/lane-tasks-*.json` and no open worktree.

## Invocation
<!-- The exact prompt or command sent to the agent -->
"Fix this typo" or "Quick fix for the import error."

## Expected Behavior
<!-- 4 assertions with MUST-level specificity -->
1. The agent MUST touch three or fewer files; any change beyond 3 files MUST fail the scenario.
2. The agent MUST make no architectural changes: no new abstractions, no dependency upgrades, no file renames, no directory restructuring.
3. The agent MUST NOT produce a feature spec, plan document, or lane-tasks file; the fix MUST bypass the full svc pipeline.
4. The agent MUST complete the fix in under 5 minutes of wall time from invocation to final file write or commit.

## Success Criteria
<!-- Pass/fail checklist -->
- [ ] Number of modified files is `<= 3`
- [ ] No new directories, modules, or architectural patterns are introduced
- [ ] No `SKILL.md`-style spec, `manifest.md`, or `.svc/lane-tasks-*.json` is created
- [ ] Wall time from prompt to completion is `< 5 minutes`
- [ ] The reported bug is resolved (typo corrected, import added, or variable fixed)
