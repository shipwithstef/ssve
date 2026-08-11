# Implementation Manifest — WI-347: Implement the Absolute Plan Standard

- **Feature Spec Path:** [WI-347.md](file:///workspace/seriousvibecoding/docs/specs/work-items/WI-347.md)
- **Branch Name:** `feature-wi-347`
- **Status:** DRAFTED
- **Base Branch:** `main`
- **Created:** 2026-05-26T20:57:14Z

---

## 1. Implementation Summary

This changeset implements the **Absolute Plan** standard within the Serious Vibe Coding (svc) framework to eliminate spec-to-code execution drift.

Key changes include:
- Removing code payload restrictions from `plan-changeset/SKILL.md` and mandating explicit before/after diff blueprints.
- Implementing **Zero-Context Execution-Only Payload Isolation (The Lean Executor)** in `execute-changeset/SKILL.md` to strip high-level specs from implementer subprocesses.
- Incorporating the **Sequential, Cost-Aware Multi-Option Exploration & Debugging Loop** to intercept subagent exit codes (`75` for `NEEDS_CONTEXT` and `76` for `BLOCKED`), trace context gaps via a structured `.svc/task-context-gap.json` schema, prioritize solutions sequentially on high-reasoning models (Sonnet 4.6 / Codex / host-best), and fallback via an Attempt Ledger.
- Enhancing the mechanical linter `scripts/verify-plan-mechanical.sh` with `C7-FAIL` (shell command sequence validation), `C8-FAIL` (MODIFY diff fence check), and `C9-FAIL` (prerequisite matrix check).
- Upgrading `references/plan-review-protocol.md` and `schemas/receipts/plan-manifest.schema.json` with command sequence and blueprint schema requirements.
- Adding a regression test `test-framework/evals/tier-1/validate-absolute-plan-standard.sh` to ensure all linter catches operate correctly.

---

## 2. Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| [plan-changeset/SKILL.md](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md) | MODIFY | task-1-contracts | Remove code payload restrictions; specify changeset blueprints, execution commands, and prerequisite matrix structures. |
| [execute-changeset/SKILL.md](file:///workspace/seriousvibecoding/execute-changeset/SKILL.md) | MODIFY | task-2-execution | Implement Zero-Context isolation, sequential trial loops, exit code mappings (75, 76), gap schema, model tiering, and Attempt Ledger rollbacks. |
| [schemas/receipts/plan-manifest.schema.json](file:///workspace/seriousvibecoding/schemas/receipts/plan-manifest.schema.json) | MODIFY | task-3-schemas | Require `changeset_blueprints` and `execution_command_sequence` arrays with exact properties. |
| [scripts/verify-plan-mechanical.sh](file:///workspace/seriousvibecoding/scripts/verify-plan-mechanical.sh) | MODIFY | task-4-linter | Add mechanical validation checks `C7-FAIL`, `C8-FAIL`, and `C9-FAIL`. |
| [references/plan-review-protocol.md](file:///workspace/seriousvibecoding/references/plan-review-protocol.md) | MODIFY | task-5-protocols | Add adversarial review dimensions `h` and `i`. |
| [test-framework/evals/tier-1/validate-absolute-plan-standard.sh](file:///workspace/seriousvibecoding/test-framework/evals/tier-1/validate-absolute-plan-standard.sh) | CREATE | task-6-tests | Add Tier-1 regression tests checking mechanical validation catches. |

---

## 3. Task Graph

### task-1-contracts
- **Touched Files:** [plan-changeset/SKILL.md](file:///workspace/seriousvibecoding/plan-changeset/SKILL.md)
- **Dependencies:** None
- **AC Coverage:** Lacks code payloads warnings, specifies blueprints, sequence, and matrix structures.
- **Validation Command:** `git diff plan-changeset/SKILL.md`
- **Checkpoint Name:** `checkpoint-task-1-contracts`

### task-2-execution
- **Touched Files:** [execute-changeset/SKILL.md](file:///workspace/seriousvibecoding/execute-changeset/SKILL.md)
- **Dependencies:** task-1-contracts
- **AC Coverage:** Zero-context payload isolation, exit codes 75/76, debugging loop with gap schema.
- **Validation Command:** `git diff execute-changeset/SKILL.md`
- **Checkpoint Name:** `checkpoint-task-2-execution`

### task-3-schemas
- **Touched Files:** [schemas/receipts/plan-manifest.schema.json](file:///workspace/seriousvibecoding/schemas/receipts/plan-manifest.schema.json)
- **Dependencies:** task-1-contracts
- **AC Coverage:** Required array structures for blueprints and sequences in the receipt schema.
- **Validation Command:** `python3 -c "import json; json.load(open('schemas/receipts/plan-manifest.schema.json'))"`
- **Checkpoint Name:** `checkpoint-task-3-schemas`

### task-4-linter
- **Touched Files:** [scripts/verify-plan-mechanical.sh](file:///workspace/seriousvibecoding/scripts/verify-plan-mechanical.sh)
- **Dependencies:** task-1-contracts, task-3-schemas
- **AC Coverage:** Linter implements `C7-FAIL`, `C8-FAIL`, and `C9-FAIL` and exits 1 on failure.
- **Validation Command:** `bash scripts/verify-plan-mechanical.sh proposals/2026-05-26-absolute-plan-standard.md`
- **Checkpoint Name:** `checkpoint-task-4-linter`

### task-5-protocols
- **Touched Files:** [references/plan-review-protocol.md](file:///workspace/seriousvibecoding/references/plan-review-protocol.md)
- **Dependencies:** task-1-contracts
- **AC Coverage:** Review protocol includes new `h: Command Determinism` and `i: Blueprint Completeness` dimensions.
- **Validation Command:** `git diff references/plan-review-protocol.md`
- **Checkpoint Name:** `checkpoint-task-5-protocols`

### task-6-tests
- **Touched Files:** [test-framework/evals/tier-1/validate-absolute-plan-standard.sh](file:///workspace/seriousvibecoding/test-framework/evals/tier-1/validate-absolute-plan-standard.sh)
- **Dependencies:** task-4-linter
- **AC Coverage:** Regression validator verifies linter catches against mock files.
- **Validation Command:** `bash test-framework/evals/tier-1/validate-absolute-plan-standard.sh`
- **Checkpoint Name:** `checkpoint-task-6-tests`

---

## Changeset Blueprint

### plan-changeset/SKILL.md
```markdown
<<<<<<< BEFORE
Read **as needed**, not all 4 unconditionally. See `_shared/before-starting.md` for the canonical chain documentation.

---

The change set is not a markdown dump of exact code.

The branch is the territory. This skill writes the **implementation plan** that
execution will follow directly in the worktree.

Think Obra/Superpowers `writing-plans` depth, but grounded in svc specs,
=======
Read **as needed**, not all 4 unconditionally. See `_shared/before-starting.md` for the canonical chain documentation.

---

The changeset contains precise, context-rich code blueprints for every planned file to prevent downstream execution drift.

The branch is the territory. This skill writes the **implementation plan** that
execution will follow directly in the worktree.

Think Obra/Superpowers `writing-plans` depth, but grounded in svc specs,
>>>>>>> AFTER
```

---

## Execution Command Sequence

```bash
# Verify schema
python3 -c "import json; json.load(open('schemas/receipts/plan-manifest.schema.json'))"

# Verify linter on standard proposal
bash scripts/verify-plan-mechanical.sh proposals/2026-05-26-absolute-plan-standard.md
```

---

## Prerequisite Alignment Matrix

| Task | Technical Design | Style Contract | UX / UI |
|------|------------------|----------------|---------|
| task-1-contracts | Deliberate contract capability | [UNCHANGED] | N/A |
| task-2-execution | Lean isolation, sequential retry | [UNCHANGED] | N/A |
| task-3-schemas | plan-manifest json structure | [UNCHANGED] | N/A |
| task-4-linter | linter validation regexes | [UNCHANGED] | N/A |
| task-5-protocols | plan review protocol extension | [UNCHANGED] | N/A |
| task-6-tests | linter regression test validator | [UNCHANGED] | N/A |

---

## 4. AC-to-Task Mapping

| Acceptance Criterion | Task |
|----------------------|------|
| `plan-changeset/SKILL.md` lacks code payload and diff size warnings | task-1-contracts |
| `plan-changeset/SKILL.md` specifies `## Changeset Blueprint`, `## Execution Command Sequence`, and `## Prerequisite Alignment Matrix` | task-1-contracts |
| `execute-changeset/SKILL.md` implements Zero-Context Isolation and Sequential Trial Loop | task-2-execution |
| `execute-changeset/SKILL.md` defines Exit Codes 75/76, gap schema, tiering, and rollbacks | task-2-execution |
| `scripts/verify-plan-mechanical.sh` implements `C7-FAIL`, `C8-FAIL`, and `C9-FAIL` checks | task-4-linter |
| `references/plan-review-protocol.md` contains review focus dimensions `h` and `i` | task-5-protocols |
| `schemas/receipts/plan-manifest.schema.json` requires `changeset_blueprints` and `execution_command_sequence` | task-3-schemas |
| Dedicated validator `validate-absolute-plan-standard.sh` checks catches | task-6-tests |
| Entire Tier-1 test suite passes cleanly | task-6-tests |

---

## 5. AC-to-Test Mapping

| Acceptance Criterion | Test Type | Test Details |
|----------------------|-----------|--------------|
| Code payload warnings removed | Static | Visual check of SKILL.md content |
| Mandatory blueprints/sequences | Static | Visual check of SKILL.md |
| Lean isolation / debugging loop | Static | Visual check of execute SKILL.md |
| Exit codes 75/76 and gap schema | Static | Visual check of schema and code |
| Linter implements C7, C8, C9 | Unit / Integration | Tested manually and via validate-absolute-plan-standard.sh |
| Review protocol dimensions | Static | Visual check of protocol |
| Schema requires blueprints & sequences | Unit | Tested via validate-chain-receipts-schema.sh |
| Dedicated validator checks catches | Unit | Run validate-absolute-plan-standard.sh |
| Entire Tier-1 suite passes | Static | Run run-all-evals.sh |

---

## 6. Validation Plan

### Task-level Validation
- Task 1: `git diff plan-changeset/SKILL.md`
- Task 2: `git diff execute-changeset/SKILL.md`
- Task 3: `python3 -c "import json; json.load(open('schemas/receipts/plan-manifest.schema.json'))"`
- Task 4: `bash scripts/verify-plan-mechanical.sh proposals/2026-05-26-absolute-plan-standard.md`
- Task 5: `git diff references/plan-review-protocol.md`
- Task 6: `bash test-framework/evals/tier-1/validate-absolute-plan-standard.sh`

### Branch-level Validation
```bash
bash test-framework/evals/run-all-evals.sh
```

---

## 7. Checkpoint Plan

1. **checkpoint-task-1-contracts**
   - Message: `feat(plan-changeset): re-enable blueprints, command sequence and prerequisite matrix`
   - Rollback anchor: `HEAD~1`
2. **checkpoint-task-2-execution**
   - Message: `feat(execute-changeset): implement lean executor and sequential cost-aware debugging`
   - Rollback anchor: `checkpoint-task-1-contracts`
3. **checkpoint-task-3-schemas**
   - Message: `feat(schemas): require changeset_blueprints and execution_sequence in plan manifest receipt`
   - Rollback anchor: `checkpoint-task-2-execution`
4. **checkpoint-task-4-linter**
   - Message: `feat(linter): implement C7, C8, and C9 mechanical validation linter checks`
   - Rollback anchor: `checkpoint-task-3-schemas`
5. **checkpoint-task-5-protocols**
   - Message: `feat(references): add command determinism and blueprint completeness review dimensions`
   - Rollback anchor: `checkpoint-task-4-linter`
6. **checkpoint-task-6-tests**
   - Message: `test(tier-1): add validate-absolute-plan-standard.sh regression test validator`
   - Rollback anchor: `checkpoint-task-5-protocols`

---

## 8. External State Lifecycle

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | Git Config / Branching (8) | Scoped git branch `feature-wi-347` and worktree | coupled | Managed via `scripts/worktree.sh` |
| 2 | Host symlinks (13) | Skill scripts and SKILL.md symlinks to host directories | coupled | Re-run `./setup` automatically via pre-commit multi-host guard |

Untouched environments: 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15

---

## 9. Promotion Readiness Checklist

- [x] All planned files accounted for in touch table.
- [x] All tasks have validation commands.
- [x] All ACs mapped to tasks and test types.
- [x] All checkpoints named and rollback anchors set.
- [x] Schema drift checked (no database migration required).
- [x] External state lifecycles fully analyzed.
