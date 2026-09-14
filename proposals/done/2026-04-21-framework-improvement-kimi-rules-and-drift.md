# Framework Improvement: Kimi Rules Parity + Framework Drift Fixes

## Evidence
- **Source:** `evolve-framework` run on 2026-04-21 (proposals/2026-04-21-evolution-kimi-rules-and-framework-drift.md)
- **Finding:** Kimi host rules symlinked to `~/.kimi/rules/` but never consumed by Kimi CLI; `work-item-schema.md` unreferenced by 4 skills; `list-work-items.skill` zip twin still present; `evolve-framework` carries triple chain-block duplication; local placeholder rules have no evaluation trigger
- **Severity:** medium

## Diagnosis
- **Root cause:** Framework cloned Claude's rules-installation model without verifying Kimi CLI reads the target path. KIMI.md had manual hardcoded copies but no auto-sync. Schema doc created but not wired downstream. Prior evolution flagged zip twin but never removed it.
- **Category:** drift + inefficiency + fragility
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** quick-fix + direct SKILL.md edits
- **Files changed:**
  - `setup` — added Kimi rules auto-injection block (lines 252–274)
  - `KIMI.md` — updated Steering Rules section with explicit stack-rule loading instructions
  - `list-work-items.skill` — deleted (zip twin)
  - `validate-feature/SKILL.md` — added `references/work-item-schema.md` pointer in DEFER routing
  - `write-spec/SKILL.md` — added schema pointer near WI file listing
  - `audit-coverage/SKILL.md` — added schema conformance row to artifact table
  - `list-work-items/SKILL.md` — added schema pointer in tolerance section
  - `evolve-framework/SKILL.md` — collapsed 3× duplicate chain blocks to single pointer
  - `improve-framework/SKILL.md` — added placeholder-rules audit snippet in Step 1.5
  - `~/.kimi/skills/KIMI.md` (installed copy) — auto-injected with 4 universal rules
- **Commits:** `5f61e92` (F-001..F-005), `972043b` (base44 path alignment)

## Replay Verification
- **Replay target:** `bash -n setup` passes; `grep -c "svc-auto-rules" ~/.kimi/skills/KIMI.md` returns 2; `grep -c "work-item-schema" */SKILL.md` returns ≥4; `test -f list-work-items.skill` returns false; `grep -c "Task-graph mode" evolve-framework/SKILL.md` returns 0
- **Result:** PASS
- **Evidence:**
  ```bash
  bash -n setup                              # PASS
  grep -c "svc-auto-rules" ~/.kimi/skills/KIMI.md   # 2
  grep -l "work-item-schema" */SKILL.md      # capture-idea diagnose-bug onboard-repo validate-feature write-spec audit-coverage list-work-items
  test -f list-work-items.skill              # FAIL (file removed) → PASS
  grep -c "Task-graph mode" evolve-framework/SKILL.md  # 0
  ```

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Add entry: "2026-04-21: Kimi rules auto-injection + schema reference wiring + zip twin removal + evolve-framework dedup + placeholder audit"
- **Known Gaps:** no changes
- **Decisions:**
  - Kimi CLI does not natively read `~/.kimi/rules/`. Universal rules are auto-injected into `KIMI.md` at setup time via `scripts/sync-kimi-rules.sh` logic embedded in `setup`.
  - `references/work-item-schema.md` is now referenced by all skills that emit or consume WI files.
  - `.skill` zip twins are not a supported distribution format. If packaging is needed later, generate to `dist/` (gitignored).
- **Capabilities:** no change to svc/CAPABILITIES.md
