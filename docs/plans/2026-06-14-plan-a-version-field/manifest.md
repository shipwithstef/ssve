# Changeset Manifest — WI-CLN-15: SKILL.md version field (3.3a + 3.3b)

- **Spec / design source:** `plans/2026-06-11-repo-review-cleanup-changeset.md` §3.3
- **Branch:** `plans/mimo-review-enrichment`
- **Lane:** framework (svc-on-svc)
- **Execution mode:** `inline` (orchestrator executes with full context; §3a Changeset Blueprint skipped per plan-changeset Execution Mode)
- **Status:** DRAFTED → SIMULATED → VERIFIED
- **Base SHA:** 640c0bdb
- **Timestamp:** 2026-06-14

## Implementation Summary

Adopt a `version` frontmatter field on every includedSkill SKILL.md and make it
enforced. Two steps from the plan, delivered as two isolated commits:

- **3.3a** — Document the `version` requirement in `create-skill/SKILL.md`; add an
  **advisory** (non-blocking) `version`-field check to
  `test-framework/evals/tier-1/validate-skill-structure.sh`.
- **3.3b** — Backfill `version: "1.0"` into all 82 includedSkills SKILL.md
  frontmatter (inserted after the `name:` line), then flip the validator check
  from advisory to **blocking**.

**Invariant preserved:** the validator must stay GREEN after every commit. 3.3a's
check is advisory (warns, never fails), so it is GREEN before backfill. 3.3b
backfills *then* flips to blocking in the same commit, so the blocking check only
exists once all 82 files satisfy it.

**Constraint:** `version` value is the fixed literal `"1.0"` — a starting baseline,
not a per-skill judgement call. Field is inserted immediately after `name:` to sit
adjacent to the other identity fields.

## Files Planned

| # | File | Op | Step |
|---|------|----|----|
| 1 | `create-skill/SKILL.md` | MODIFY | 3.3a — document version-field requirement |
| 2 | `test-framework/evals/tier-1/validate-skill-structure.sh` | MODIFY | 3.3a advisory check → 3.3b flip to blocking |
| 3 | 82 × `<skill>/SKILL.md` | MODIFY | 3.3b — insert `version: "1.0"` after `name:` |

## Task Graph

| id | title | files | deps | AC | validation | checkpoint |
|----|-------|-------|------|----|-----------|-----------|
| t-3.3a | advisory check + contract doc | #1, #2 | — | AC-1, AC-2 | `bash test-framework/evals/tier-1/validate-skill-structure.sh` exits 0 | commit |
| t-3.3b | backfill 82 + flip blocking | #3, #2 | t-3.3a | AC-3, AC-4 | validator exits 0 with blocking check; all 82 carry `version` | commit |

## Acceptance Criteria

- **AC-1** — `create-skill/SKILL.md` documents that new skills MUST include a `version` frontmatter field.
- **AC-2** — `validate-skill-structure.sh` warns (exit 0) on missing `version` before backfill.
- **AC-3** — All 82 includedSkills SKILL.md carry `version: "1.0"` immediately after `name:`.
- **AC-4** — `validate-skill-structure.sh` fails (exit 1) on a missing `version` field after the flip; passes on the backfilled tree.

## AC-to-Test

| AC | Test |
|----|------|
| AC-1 | Manual grep: `grep -n version create-skill/SKILL.md` shows the requirement line |
| AC-2 | Run validator on pre-backfill tree → exit 0 (advisory) |
| AC-3 | `node` scan: 82/82 frontmatter blocks match `^version:` |
| AC-4 | Run validator post-backfill → exit 0; negative probe (temporarily strip one) → exit 1 |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| — | (taxonomy walked) | none | n/a | n/a |

Untouched environments (walked the taxonomy, found nothing): no external state is
created, mutated, or relied upon. This is a repo-local frontmatter + validator
change. No CI, no remote, no host config, no package registry, no DB, no env vars,
no deployment surface. Installed host symlinks point at these same SKILL.md files,
so the new field propagates through the existing symlink lifecycle (no separate
coupling needed).

## Simulation Report

- File #1 `create-skill/SKILL.md` exists (MODIFY ok).
- File #2 `validate-skill-structure.sh` exists; current check set verified (name/description/inputs/outputs/chain). Adding `version` is additive.
- File #3: all 82 SKILL.md confirmed present (missingFile=0) and confirmed all 82 currently LACK `version` (hasVersion=0) — backfill is non-idempotent-safe via guard (only insert when absent).
- No CREATE targets. No import resolution. No route conflicts. No package.json deps.
- Validator ordering invariant simulated: advisory-first keeps GREEN; flip-after-backfill keeps GREEN. PASS.

## Promotion Readiness

- [ ] 3.3a committed, validator GREEN (advisory)
- [ ] 3.3b committed, 82/82 carry version, validator GREEN (blocking)
- [ ] `node scripts/lint-skills-manifest.mjs` PASS
- [ ] full tier-1 GREEN
