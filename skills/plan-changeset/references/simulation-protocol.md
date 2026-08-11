# plan-changeset — Pre-implementation simulation (full protocol)

## Pre-Implementation Simulation (Dry Run)

After the manifest is complete but BEFORE handoff, trace through each planned task against the actual codebase state. This catches wrong assumptions before code is written.

### Two-Layer Resolution Model

The simulation checks against two layers:
1. **Disk layer** — files that exist in the actual codebase right now
2. **Planned layer** — files that earlier tasks in the graph will CREATE (accumulated as the graph is walked in dependency order)

Rules:
- **CREATE targets**: added to the planned layer (NOT checked against disk — they don't exist yet)
- **MODIFY targets**: checked against disk (must exist)
- **Imports from planned files**: resolved against the planned layer
- **Imports from existing files**: resolved against disk (grep for the export)

### Per-Task Checks

Walk the task graph in dependency order. For each task:

1. CREATE targets: `test -f <path>` — verify does NOT exist. If it does → MODIFY.
2. MODIFY targets: verify file exists. Grep for the specific export/function name
   the task expects — do NOT read the entire file. Use `grep -n "export.*functionName"`.
3. Imports: check disk layer (grep export name in the specific file), then planned
   layer (check if an earlier task CREATE'd it). Do NOT grep broadly across `src/`.
4. New dependencies: check `package.json` only. If missing, add install to prereqs.
5. Modified functions: grep for the function signature in the specific file — do
   NOT read the full file if you only need to confirm a signature exists.
6. API route conflicts: grep for the path string ONLY in the route directory
   identified by the style contract (e.g., `src/routes/`). Do NOT grep the entire
   source tree.
7. Test framework: check the test config file (vitest.config.ts, jest.config.js)
   — one targeted file read.

**Scoping rule:** Every simulation check targets a SPECIFIC file or directory.
No check should grep `src/` or `.` broadly. The style contract tells you where
routes, models, services, and tests live. The manifest tells you which files
are involved. Use those as scope bounds.

### Simulation Report

Append to the manifest:

```markdown
## Simulation Report

| Task | Check | Result | Action |
|------|-------|--------|--------|
| task-1-types | src/types/match.ts does not exist | PASS (CREATE) | — |
| task-3-tests | vitest config found | PASS | Use vitest |
| task-4-services | src/services/db.ts exports getDb | PASS | Import valid |
| task-4-services | Package zod not in package.json | FAIL | Add to prerequisites |
```

If any FAIL: fix the manifest, re-check, proceed only when all PASS or acknowledged WARN.

### Scenario Walkthrough (after file-level checks)

For each journey scenario in `docs/specs/journeys/J*.feature.md`:

1. Read the Given/When/Then steps
2. For each step, identify which planned task implements it
3. If a step has no implementing task: WARN — scenario coverage gap
4. Log in the simulation report:

```markdown
## Scenario Coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---------|----------|-------|-------|----------|
| J01 | First-time setup | 5 | task-1, task-4 | 5/5 ✅ |
| J02 | Daily trend review | 4 | task-4, task-5 | 3/4 ⚠️ "Then sees learning path" has no task |
```

Update manifest Status from DRAFTED to SIMULATED when simulation passes.

