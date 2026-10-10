### Output Artifact: Improvement Record

Write the proposal artifact to `proposals/<date>-framework-improvement.md` in the **svc framework source repo** (e.g. `seriousvibecoding/`). This is a persistent, git-tracked change to the framework — not a temporary file, not a project artifact.

**You are working in the framework repo, not the current project.** Even when triggered from Example Marketplace or any other project, `improve-framework` makes changes to the framework source. Operate in `seriousvibecoding/` (or whichever repo the skills were installed from). All skill edits, proposals, and `FRAMEWORK-STATE.md` updates go there.

> **The split:**
> - `seriousvibecoding/proposals/` — framework change records (persistent, git-tracked)
> - `seriousvibecoding/FRAMEWORK-STATE.md` — framework memory
> - `seriousvibecoding/<skill-name>/SKILL.md` — the skill files being improved
> - Current project repo `docs/` — project work items, WIs, specs; no framework content here

**Timing:** For quick-fix and direct SKILL.md edit routes, write this record
AFTER implementation (it's a post-hoc record, not a pre-approval proposal).
For normal pipeline routes, write it BEFORE implementation as a plan, then
update with commits/replay results after.

```markdown
# Framework Improvement: <title>

## Evidence
- **Source:** <test-framework result / user report / codex review>
- **Finding:** <exact gap with file:line>
- **Severity:** <high / medium / low>

## Diagnosis
- **Root cause:** <why the gap exists>
- **Category:** <drift / fragility / inefficiency / missing capability>
- **Already in FRAMEWORK-STATE.md?** <yes (deferred) / no (new)>

## Implementation
- **Route:** <quick-fix / create-skill / normal pipeline>
- **Files changed:** <list>
- **Commits:** <SHAs>

## Replay Verification
- **Replay target:** <scenario or check that must pass>
- **Result:** <PASS / FAIL / PARTIAL>
- **Evidence:** <test output or review finding>

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** <what to add>
- **Known Gaps:** <what to move to fixed>
- **Decisions:** <any new locked decisions>
- **Capabilities:** <update svc/CAPABILITIES.md? yes/no>
```

This artifact is machine-checkable. test-framework can verify it has all
required sections. Replay target must exist and must pass.
