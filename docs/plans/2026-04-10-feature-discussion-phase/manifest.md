# Implementation Manifest: feature-discussion-phase

## Header

- **Feature spec:** `docs/specs/features/feature-discussion-phase.md`
- **Branch name:** `feature-discussion-phase`
- **Initial status:** `DRAFTED`
- **Current status:** `SIMULATED`
- **Lane:** `brownfield-feature` on the framework repo itself
- **Base branch:** `main`
- **Base SHA:** `ee22014cc3faa2c57bf9347aec0b4acc47784595`
- **Created:** `2026-04-10T05:58:57+03:00`

## Implementation Summary

This change set adds the missing `discuss-phase` capability as a first-class
framework skill, plus the contract glue that makes it routable, durable, and
enforceable across downstream skills.

What changes:

- introduce `discuss-phase/SKILL.md`
- introduce `scripts/discussion-artifact.mjs`
- introduce tracked `docs/specs/discussions/` bootstrap docs
- add a dedicated tier-1 contract eval for discussion-phase behavior
- wire routing, downstream pre-flight rules, and `review-gate` contradiction
  checks to the new artifact contract
- register the new skill in the repo manifests and skill catalogs so lint,
  setup, and capability docs remain truthful

What must remain invariant:

- no new third-party dependencies; Node built-ins only
- markdown remains the human-readable source of truth for discussion state
- `pipeline-decisions.jsonl` stays append-only audit history, not the canonical
  mutable workspace
- existing skill-contract structure, self-verify format, and manifest-linted
  source-of-truth files must keep passing current tier-1 checks

Major constraints from spec, journeys, and style contract:

- reroute precedence must run before ambiguity scoring
- one-way-door ambiguity can block; reversible items can default
- `DISC-ZERO` requires zero-state invocation without a prior feature spec
- repo-native implementation surfaces are `SKILL.md`, `.mjs` helpers, Bash
  evals, and JSON/markdown contract files, not app code or UI components

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| `discuss-phase/SKILL.md` | CREATE | `task-1-discussion-surface` | Add the new skill contract with inputs, outputs, chaining, self-verify, and invocation rules |
| `docs/specs/discussions/README.md` | CREATE | `task-1-discussion-surface` | Track the new artifact family and document its purpose before first write |
| `scripts/discussion-artifact.mjs` | CREATE | `task-2-helper-and-eval` | Validate/summarize discussion artifacts for routing and review |
| `test-framework/evals/tier-1/validate-discussion-phase-contracts.sh` | CREATE | `task-2-helper-and-eval` | Static contract replay for trigger, schema, routing, and enforcement rules |
| `test-framework/evals/evals.json` | MODIFY | `task-2-helper-and-eval` | Register the new tier-1 validation script in the eval catalog |
| `route-workflow/SKILL.md` | MODIFY | `task-3-routing-and-consumers` | Add direct routing, trigger scoring, reroute precedence, and consumption of discussion outcomes |
| `write-spec/SKILL.md` | MODIFY | `task-3-routing-and-consumers` | Require discussion-artifact pre-flight reads where applicable |
| `design-ux/SKILL.md` | MODIFY | `task-3-routing-and-consumers` | Require discussion-artifact pre-flight reads for UX gray areas |
| `design-tech/SKILL.md` | MODIFY | `task-3-routing-and-consumers` | Require discussion-artifact pre-flight reads and re-entry semantics |
| `review-gate/SKILL.md` | MODIFY | `task-3-routing-and-consumers` | Add contradiction checks against settled discussion decisions at G4/G5 |
| `skills-manifest.json` | MODIFY | `task-4-registry-and-catalogs` | Register `discuss-phase` in `includedSkills` and `corePackForRouting` |
| `README.md` | MODIFY | `task-4-registry-and-catalogs` | Keep included-skill list and framework narrative aligned with the manifest |
| `EXTERNAL_ADDONS.md` | MODIFY | `task-4-registry-and-catalogs` | Keep core-pack list aligned with the manifest |
| `CLAUDE.md` | MODIFY | `task-4-registry-and-catalogs` | Update repo guidance that references skill counts and source-of-truth files |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | `task-5-framework-knowledge-sync` | Promote discussion-phase from known gap to implemented capability in self-knowledge |
| `references/knowledge/svc/details/skills.md` | MODIFY | `task-5-framework-knowledge-sync` | Add the skill catalog entry and updated counts/positions |
| `FRAMEWORK-STATE.md` | MODIFY | `task-5-framework-knowledge-sync` | Close the known gap with implementation evidence and remaining caveats |

## Task Graph

| Task ID | Title | Touched Files | Dependencies | AC Coverage | Validation Command | Checkpoint | Parallel Group |
|---|---|---|---|---|---|---|---|
| `task-1-discussion-surface` | Create the new discussion skill surface and tracked artifact directory | `discuss-phase/SKILL.md`, `docs/specs/discussions/README.md` | — | `DISC-01`, `DISC-05`, `DISC-06`, `DISC-12`, `DISC-13`, `DISC-14`, `DISC-15`, `DISC-17`, `DISC-18`, `DISC-25`, `DISC-26`, `DISC-ZERO` | `bash test-framework/evals/tier-1/validate-skill-structure.sh && node test-framework/evals/tier-1/validate-frontmatter-ast.mjs && node test-framework/evals/tier-1/validate-markdown-ast.mjs` | `checkpoint-discussion-surface` | `—` |
| `task-2-helper-and-eval` | Add the artifact helper and dedicated tier-1 contract eval | `scripts/discussion-artifact.mjs`, `test-framework/evals/tier-1/validate-discussion-phase-contracts.sh`, `test-framework/evals/evals.json` | `task-1-discussion-surface` | `DISC-03`, `DISC-04`, `DISC-07`, `DISC-08`, `DISC-09`, `DISC-11`, `DISC-14`, `DISC-15`, `DISC-16`, `DISC-19`, `DISC-25`, `DISC-26` | `bash test-framework/evals/tier-1/validate-discussion-phase-contracts.sh` | `checkpoint-discussion-helper` | `—` |
| `task-3-routing-and-consumers` | Wire routing, downstream pre-flight, and review enforcement | `route-workflow/SKILL.md`, `write-spec/SKILL.md`, `design-ux/SKILL.md`, `design-tech/SKILL.md`, `review-gate/SKILL.md` | `task-1-discussion-surface`, `task-2-helper-and-eval` | `DISC-02`, `DISC-03`, `DISC-06`, `DISC-10`, `DISC-19`, `DISC-20`, `DISC-21`, `DISC-22`, `DISC-23`, `DISC-24`, `DISC-26` | `bash test-framework/evals/tier-1/validate-framework-self-management.sh && bash test-framework/evals/tier-1/validate-chain-references.sh && bash test-framework/evals/tier-1/validate-discussion-phase-contracts.sh` | `checkpoint-discussion-integration` | `—` |
| `task-4-registry-and-catalogs` | Register the new skill in manifest-linted catalogs and operator docs | `skills-manifest.json`, `README.md`, `EXTERNAL_ADDONS.md`, `CLAUDE.md` | `task-1-discussion-surface`, `task-3-routing-and-consumers` | `DISC-01`, `DISC-02`, `DISC-20`, `DISC-21`, `DISC-ZERO` | `node scripts/lint-skills-manifest.mjs` | `checkpoint-discussion-catalogs` | `—` |
| `task-5-framework-knowledge-sync` | Update self-knowledge and framework state to reflect the implemented capability | `references/knowledge/svc/CAPABILITIES.md`, `references/knowledge/svc/details/skills.md`, `FRAMEWORK-STATE.md` | `task-3-routing-and-consumers`, `task-4-registry-and-catalogs` | `DISC-11`, `DISC-19`, `DISC-20`, `DISC-21`, `DISC-24`, `DISC-26` | `node scripts/lint-skills-manifest.mjs && bash test-framework/evals/run-all-evals.sh --tier1` | `checkpoint-discussion-state-sync` | `—` |

## AC-to-Task Mapping

| AC | Task(s) |
|---|---|
| `DISC-01` | `task-1-discussion-surface`, `task-4-registry-and-catalogs` |
| `DISC-02` | `task-3-routing-and-consumers`, `task-4-registry-and-catalogs` |
| `DISC-03` | `task-2-helper-and-eval`, `task-3-routing-and-consumers` |
| `DISC-04` | `task-2-helper-and-eval` |
| `DISC-05` | `task-1-discussion-surface` |
| `DISC-06` | `task-1-discussion-surface`, `task-3-routing-and-consumers` |
| `DISC-07` | `task-2-helper-and-eval` |
| `DISC-08` | `task-2-helper-and-eval` |
| `DISC-09` | `task-2-helper-and-eval` |
| `DISC-10` | `task-3-routing-and-consumers` |
| `DISC-11` | `task-2-helper-and-eval`, `task-5-framework-knowledge-sync` |
| `DISC-12` | `task-1-discussion-surface` |
| `DISC-13` | `task-1-discussion-surface` |
| `DISC-14` | `task-1-discussion-surface`, `task-2-helper-and-eval` |
| `DISC-15` | `task-1-discussion-surface`, `task-2-helper-and-eval` |
| `DISC-16` | `task-2-helper-and-eval` |
| `DISC-17` | `task-1-discussion-surface` |
| `DISC-18` | `task-1-discussion-surface` |
| `DISC-19` | `task-2-helper-and-eval`, `task-3-routing-and-consumers`, `task-5-framework-knowledge-sync` |
| `DISC-20` | `task-3-routing-and-consumers`, `task-4-registry-and-catalogs`, `task-5-framework-knowledge-sync` |
| `DISC-21` | `task-3-routing-and-consumers`, `task-4-registry-and-catalogs`, `task-5-framework-knowledge-sync` |
| `DISC-22` | `task-3-routing-and-consumers` |
| `DISC-23` | `task-3-routing-and-consumers` |
| `DISC-24` | `task-3-routing-and-consumers`, `task-5-framework-knowledge-sync` |
| `DISC-ZERO` | `task-1-discussion-surface`, `task-4-registry-and-catalogs` |
| `DISC-25` | `task-1-discussion-surface`, `task-2-helper-and-eval` |
| `DISC-26` | `task-1-discussion-surface`, `task-2-helper-and-eval`, `task-3-routing-and-consumers`, `task-5-framework-knowledge-sync` |

## AC-to-Test Mapping

| AC | Test Type | Reason |
|---|---|---|
| `DISC-01` | `Manual` | direct skill invocation and summary wording are best checked through an actual invocation transcript |
| `DISC-02` | `Unit` | deterministic routing/trigger rules can be enforced by static contract replay |
| `DISC-03` | `Unit` | artifact-scan and settled-decision exclusion are helper/contract behavior |
| `DISC-04` | `Unit` | controlled category enum is schema-level behavior |
| `DISC-05` | `Unit` | scope cap is enforceable in the skill contract and replay fixture |
| `DISC-06` | `Unit` | `not-needed` status and next-skill routing can be replayed statically |
| `DISC-07` | `Unit` | reversibility/magnitude fields are schema and contract requirements |
| `DISC-08` | `Manual` | ranked alternatives and trade-off quality need execution review, not just shape validation |
| `DISC-09` | `Manual` | default plus override-path behavior needs prompt-level review |
| `DISC-10` | `Manual` | brownfield scouting quality depends on the invoked file reads, not just schema presence |
| `DISC-11` | `Manual` | evidence quality and citation strength require execution review |
| `DISC-12` | `Manual` | one-question-per-gray-area behavior is interaction-level behavior |
| `DISC-13` | `Manual` | confidence and reversal evidence quality require prompt-level review |
| `DISC-14` | `Unit` | artifact path and section shape are deterministic |
| `DISC-15` | `Unit` | status enum can be validated statically |
| `DISC-16` | `Unit` | downstream phase mapping is schema-level behavior |
| `DISC-17` | `Manual` | blocking semantics need an invocation that demonstrates stop behavior |
| `DISC-18` | `Manual` | defer-list writing and revisit-trigger quality need execution review |
| `DISC-19` | `Unit` | `pipeline-decisions.jsonl` append contract is machine-verifiable |
| `DISC-20` | `Unit` | downstream pre-flight wording and helper use are contract-checkable |
| `DISC-21` | `Unit` | next-skill recommendation can be replayed deterministically |
| `DISC-22` | `Unit` | reroute precedence to `validate-feature` is deterministic routing logic |
| `DISC-23` | `Unit` | reroute precedence to `diagnose-bug` is deterministic routing logic |
| `DISC-24` | `Unit` | contradiction-check wording at G4/G5 can be enforced by static contract test |
| `DISC-ZERO` | `Manual` | zero-state prompt bounding should be confirmed through an actual invocation |
| `DISC-25` | `Unit` | required frontmatter fields are schema-level behavior |
| `DISC-26` | `Unit` | concise proceed/block/reroute summary is a deterministic output contract |

## Validation Plan

### Task-level validation

- `task-1-discussion-surface`
  - `bash test-framework/evals/tier-1/validate-skill-structure.sh`
  - `node test-framework/evals/tier-1/validate-frontmatter-ast.mjs`
  - `node test-framework/evals/tier-1/validate-markdown-ast.mjs`
- `task-2-helper-and-eval`
  - `bash test-framework/evals/tier-1/validate-discussion-phase-contracts.sh`
- `task-3-routing-and-consumers`
  - `bash test-framework/evals/tier-1/validate-framework-self-management.sh`
  - `bash test-framework/evals/tier-1/validate-chain-references.sh`
  - `bash test-framework/evals/tier-1/validate-discussion-phase-contracts.sh`
- `task-4-registry-and-catalogs`
  - `node scripts/lint-skills-manifest.mjs`
- `task-5-framework-knowledge-sync`
  - `node scripts/lint-skills-manifest.mjs`
  - `bash test-framework/evals/run-all-evals.sh --tier1`

### Final branch-level validation

- `node scripts/lint-skills-manifest.mjs`
- `bash test-framework/evals/tier-1/validate-skill-structure.sh`
- `bash test-framework/evals/tier-1/validate-contracts.sh`
- `bash test-framework/evals/tier-1/validate-chain-references.sh`
- `bash test-framework/evals/tier-1/validate-self-verify-sections.sh`
- `bash test-framework/evals/tier-1/validate-worktree-safety.sh`
- `bash test-framework/evals/tier-1/validate-framework-self-management.sh`
- `node test-framework/evals/tier-1/validate-frontmatter-ast.mjs`
- `node test-framework/evals/tier-1/validate-markdown-ast.mjs`
- `bash test-framework/evals/tier-1/validate-discussion-phase-contracts.sh`

## Checkpoint Plan

| Order | Checkpoint | Scope | Rollback Anchor |
|---|---|---|---|
| 1 | `checkpoint-discussion-surface` | new skill contract + tracked discussion artifact directory | reset to base SHA if the new surface does not validate cleanly |
| 2 | `checkpoint-discussion-helper` | helper CLI + dedicated tier-1 contract eval | rollback to checkpoint 1 |
| 3 | `checkpoint-discussion-integration` | router/downstream/review contract wiring | rollback to checkpoint 2 |
| 4 | `checkpoint-discussion-catalogs` | manifest-linted catalog and operator-doc sync | rollback to checkpoint 3 |
| 5 | `checkpoint-discussion-state-sync` | capability/self-knowledge/state closure | rollback to checkpoint 4 |

## Loop-Back Targets

- spec ambiguity discovered during execution -> `write-spec`
- contradiction between zero-state path and journey expectations -> `write-journeys`
- technical infeasibility in artifact/helper contract -> `design-tech`
- review enforcement wording proves too ambiguous at G4/G5 -> `review-gate`

## Promotion Readiness Checklist

- [x] all planned files are accounted for in the manifest
- [x] every task has at least one validation command
- [x] every AC maps to one or more tasks
- [x] every AC maps to exactly one test type
- [x] all checkpoints are named and ordered
- [x] no ORM schema or migration work is in scope
- [x] final diff is expected to contain only the manifest-listed files

## Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| `task-1-discussion-surface` | `discuss-phase/SKILL.md` does not exist yet | PASS (CREATE) | keep `CREATE` |
| `task-1-discussion-surface` | `docs/specs/discussions/README.md` does not exist yet | PASS (CREATE) | keep `CREATE` |
| `task-2-helper-and-eval` | `scripts/discussion-artifact.mjs` does not exist yet | PASS (CREATE) | keep `CREATE` |
| `task-2-helper-and-eval` | `test-framework/evals/tier-1/validate-discussion-phase-contracts.sh` does not exist yet | PASS (CREATE) | keep `CREATE` |
| `task-2-helper-and-eval` | `test-framework/evals/evals.json` exists | PASS | modify in place |
| `task-3-routing-and-consumers` | `route-workflow/SKILL.md` exists | PASS | modify in place |
| `task-3-routing-and-consumers` | `write-spec/SKILL.md` exists | PASS | modify in place |
| `task-3-routing-and-consumers` | `design-ux/SKILL.md` exists | PASS | modify in place |
| `task-3-routing-and-consumers` | `design-tech/SKILL.md` exists | PASS | modify in place |
| `task-3-routing-and-consumers` | `review-gate/SKILL.md` exists | PASS | modify in place |
| `task-4-registry-and-catalogs` | `skills-manifest.json`, `README.md`, `EXTERNAL_ADDONS.md`, and `CLAUDE.md` exist | PASS | modify in place |
| `task-4-registry-and-catalogs` | manifest-linted source-of-truth contract already requires these files to move together | PASS | keep them in one task boundary |
| `task-5-framework-knowledge-sync` | `references/knowledge/svc/CAPABILITIES.md`, `references/knowledge/svc/details/skills.md`, and `FRAMEWORK-STATE.md` exist | PASS | modify in place |
| all tasks | root `package.json` is absent | PASS | no dependency-managed install step; helper must use Node built-ins only |
| all tasks | `test-framework/evals/tier-1/` exists and already hosts Bash validators | PASS | place the new contract script there |

No unresolved `FAIL` items remain.

## Scenario Coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---|---|---|---|---|
| `J01` | Detect a real gray-area cluster and keep it bounded | 5 | `task-1-discussion-surface`, `task-2-helper-and-eval`, `task-3-routing-and-consumers` | `5/5` ✅ |
| `J01` | Research hard choices before recommending defaults | 5 | `task-1-discussion-surface`, `task-2-helper-and-eval`, `task-3-routing-and-consumers` | `5/5` ✅ |
| `J01` | Ask focused questions for reversible choices | 4 | `task-1-discussion-surface`, `task-2-helper-and-eval` | `4/4` ✅ |
| `J01` | Save the discussion record and hand work forward | 6 | `task-1-discussion-surface`, `task-2-helper-and-eval`, `task-3-routing-and-consumers`, `task-5-framework-knowledge-sync` | `6/6` ✅ |
| `J02` | Return `discussion not needed` when choices are already settled | 4 | `task-1-discussion-surface`, `task-3-routing-and-consumers` | `4/4` ✅ |
| `J02` | Block on unresolved one-way-door choices | 5 | `task-1-discussion-surface`, `task-2-helper-and-eval`, `task-3-routing-and-consumers` | `5/5` ✅ |
| `J02` | Reroute back to validation when the issue is still product uncertainty | 4 | `task-3-routing-and-consumers` | `4/4` ✅ |
| `J02` | Reroute broken-behavior topics and preserve settled decisions | 4 | `task-3-routing-and-consumers`, `task-5-framework-knowledge-sync` | `4/4` ✅ |
| `J03` | Derive a bounded topic and produce a valid discussion record | 5 | `task-1-discussion-surface`, `task-2-helper-and-eval`, `task-4-registry-and-catalogs` | `5/5` ✅ |
| `J03` | Use available evidence even when the artifact set is thin | 4 | `task-1-discussion-surface`, `task-2-helper-and-eval`, `task-3-routing-and-consumers` | `4/4` ✅ |

