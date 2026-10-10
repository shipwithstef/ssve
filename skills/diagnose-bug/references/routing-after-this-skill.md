# Routing After This Skill — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Routing After This Skill

- implementation work -> `plan-changeset` or direct execution flow, depending on repo practice
- **user-facing or admin-facing bugfix -> `write-e2e` is MANDATORY before close-out** (per route-workflow Lane 4 step 5)
- drift discovered instead of bug -> `sync-spec-code`
- issue is actually missing capability -> `validate-feature`
- retroactive mode (code already committed) -> chain through Lane 4 retroactively: `write-e2e` → `review-gate` → `land-changeset` (verify landing) → `verify-promotion` → close WI
- **`--diagnose-only` mode** → after self-verify passes, emit a **Changeset Brief** (exact file:line, before/after delta, one-sentence rationale), set Tasks 2-3 to `manual` in `lane-tasks.json`, mark Task 1 `completed`, then: `**Next:** implement via [platform path] per changeset brief above, then resume Task 4: review-gate`

All outputs MUST end with the `**Next:**` trailer per `route-workflow` Output Protocol.

### Changeset Brief Format (`--diagnose-only`)

Emitted at the end of the skill when `--diagnose-only` is active. Replaces the
"Next: plan-changeset" routing with a hand-off to the platform path:

```
## Changeset Brief

**File:** `<path/to/file.jsx>`
**Line:** <line number or range>
**Change type:** <add / remove / replace>

### Before
```<lang>
<old code>
```

### After
```<lang>
<new code>
```

**Rationale:** <one sentence why this fixes the root cause>
**Confidence:** <high / medium — if medium, note the uncertainty>
**Test surface:** <how to verify the fix works in the platform UI>
```
