# Modes — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Mode 5: Auto (full codebase, no stopping)

Triggered when the user says "auto", "full sync", "do everything", "cover all journeys",
or passes `--auto` as an argument. Also triggered when the user explicitly asks to not
be interrupted.

In auto mode, the skill runs the ENTIRE pipeline without pausing for user confirmation:

1. Read ALL feature specs (not just the ones for one journey)
2. Identify ALL personas from the full spec set
3. Generate ALL critical journeys (J01-J03)
4. Run three-layer analysis on each
5. Generate all expansion journeys until every persona has at least one journey
   and every feature spec with user-facing ACs is referenced by at least one journey
6. Run coverage analysis
7. Migrate legacy docs if found
8. Write the full JOURNEY_INDEX.md
9. Present the complete result to the user for review ONCE at the end

Auto mode does NOT skip any quality steps. It still reads specs deeply, still writes
in user language, still runs Layer 3 reasoning. The only difference: it doesn't pause
between iterations to ask the user. It makes its own decisions about which journeys
to generate next based on coverage gaps.

**Completion criteria for auto mode:**
- Every persona has at least 1 journey
- Every feature spec with user-facing ACs (not infrastructure-only specs) is
  referenced by at least 1 journey
- All 3 critical journeys exist (activation, core loop, conversion)
- Layer 3 analysis run on every journey
- Coverage report produced
- JOURNEY_INDEX.md written

Auto mode outputs a summary at the end:
```
JOURNEY SYNC COMPLETE (auto mode)
═══════════════════════════════════════
Personas identified: N
Journeys generated: N
  - Critical: N
  - Expansion: N
AC coverage: X% (N of M total ACs referenced)
Layer 3 findings: N issues, N gaps, N missing transitions
Legacy docs migrated: N (archived: N)
═══════════════════════════════════════
Review the journeys at docs/specs/journeys/
```

### Mode 7: Regression Refresh

Triggered when the repo is brownfield and the problem is not "we need more journeys"
but "a known journey is now broken or changed."

Use this mode when:
- a work item is typed `regression`
- journey-based QA found a broken flow
- shipped behavior changed and the journey contract needs to be refreshed
- verify-promotion reports milestone completion, no active WIs, existing
  journeys, changed shipped behavior, and a roadmap/readiness handoff

Mode 7 does not generate a full new journey set. It:

1. finds the affected existing journeys
2. identifies the broken or changed steps
3. records the expected path vs actual path
4. updates the journey or writes a work-item note for follow-up

This keeps regression work in the correction lane instead of treating it like greenfield authoring.

This mode is the right starting point for new products, major product pivots, or any
situation where you want a complete discovery pass rather than incremental additions.
See [mode-6.md](mode-6.md) for the full Mode 6 instructions.

### Mode 8: Chrome Auto-Discovery

Triggered when the user says "auto-discover chrome", "chrome journey coverage",
"discover chrome controls", or passes `--auto-discover-chrome`.

This mode scans rendered app chrome backward from code instead of reading feature specs
forward. It catches interactive controls rooted in layout, header, sidebar, shell, and
navigation components that may never appear in a feature spec.

Run the deterministic helper:

```bash
node skills/write-journeys/scripts/auto-discover-chrome.mjs --root .
```

The helper:

1. Scans `src/**/*.{jsx,tsx,vue,svelte}` files whose names match chrome surfaces
   (`Layout`, `Header`, `Sidebar`, `Nav`, `Chrome`, `Shell`, `Menu`).
2. Detects interactive roots: `<button>`, `<Select>`, `<Sheet>`, `<DropdownMenu>`,
   `<Drawer>`, `<a href>`, `<Link>`, and `<NavLink>`.
3. Extracts role, visible label, surface, and file:line source.
4. Cross-references existing `docs/specs/journeys/*.feature.md` for
   `@chrome-control:<id>` traces.
5. Emits one idempotent `docs/specs/journeys/Chrome-<role>-<surface>-<label>.feature.md`
   skeleton per uncovered control.
6. Writes `docs/specs/journeys/SUMMARY.md` with a file:line row for every control found.

Skeletons are intentionally minimal. After generation, refine product-specific assertions
for the control. Default assertions cover "open/change/navigate, then app remains
interactive" so the body-lock / inert-state bug class is represented immediately.

### Mode 9: Capability Auto-Scaffolding

Triggered when `catalog-domain-capabilities` finds recognized table-stakes
capabilities in `docs/specs/capability-catalog.data.json`, or when the user
passes `--capability <name>`.

Run the deterministic helper:

```bash
node skills/write-journeys/scripts/capability-journeys.mjs --root . --capability <name>
```

The helper:

1. Reads `docs/specs/capability-catalog.data.json`.
2. Matches the initial table-stakes set: `multi-language`, `theme-switching`,
   `auth-state-recovery`, `multi-locale-payments`, and `accessibility`.
3. Checks implementation-pattern evidence in `src/` before generating, so a
   catalog row alone does not false-fire.
4. Emits idempotent `docs/specs/journeys/J-CAP-<capability>.feature.md` files.
5. Covers the standard role and surface matrix: customer mobile, customer
   desktop, owner mobile, and owner desktop.

---
