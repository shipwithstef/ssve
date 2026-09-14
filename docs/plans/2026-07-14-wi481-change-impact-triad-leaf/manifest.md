# WI-481 Changeset: Universal Change Impact Triad

- **Spec:** docs/specs/work-items/WI-481.md
- **Proposal:** proposals/2026-07-14-change-impact-triad-universal-gate.md
- **Branch:** framework-WI-481-change-impact-triad
- **Lane:** framework
- **Archetype:** cross-cutting assurance concern
- **Planning mode:** enumerate all mutating lanes and completion gates before policy design
- **Execution mode:** dispatch
- **Planning base:** 22df12efdfc4d48dacf2acea8588d585ce0094a8
- **Dependencies/execution base:** WI-485, WI-484, WI-482, and WI-483 VERIFIED; create from current verified origin/main
- **Status:** REVIEWED_AND_FROZEN; planning only
- **Created:** 2026-07-14T10:48:02Z

## Implementation Summary

Introduce one deterministic three-field impact receipt and risk classifier used by routing, quick-fix eligibility, execution, and completion. Existing rich bug/feature phases can emit subsumption receipts. High-risk surfaces are never fast-lane; missing behavior sources or coverage create blocked tasks; independent review and runtime/behavior proof scale with risk. Receipt identity composes with WI-484/WI-485 and never accepts foreign state.

### Mutating entry-point inventory

| Entry point | Required integration |
|---|---|
| quick-fix | classify staged paths; emit triad; escalate non-trivial/high risk |
| diagnose-bug | map existing expected behavior, affected artifacts, proof phases to subsumption receipt |
| route-workflow | classify intended scope before lane and require receipt task |
| execute-changeset | cross-check actual diff; create coverage tasks; collect proof |
| completion hooks | deny governed completion without exact owned receipt |
| review/audit/verify | validate independent and runtime evidence for tier |

## Files Planned

| File | Action | Responsibility |
|---|---|---|
| references/change-impact-triad.md | CREATE | canonical fields, risk tiers, evidence and subsumption |
| schemas/change-impact-triad.schema.json | CREATE | exact owned receipt contract |
| scripts/classify-change-risk.mjs | CREATE | deterministic path/diff classifier |
| hooks/svc-impact-triad-guard.mjs | CREATE | completion-time receipt gate |
| test-framework/evals/tier-1/validate-impact-triad.sh | CREATE | lanes/risk/escalation/ownership matrix |
| quick-fix/SKILL.md | MODIFY | impact phase and mechanical fast-lane denial |
| diagnose-bug/SKILL.md | MODIFY | explicit subsumption emission |
| route-workflow/SKILL.md | MODIFY | route risk tier and create receipt task |
| execute-changeset/SKILL.md | MODIFY | diff cross-check, coverage and proof tasks |
| DOCTRINE.md | MODIFY | universal assurance floor |
| scripts/quick-fix-eligibility.mjs | MODIFY | classifier is authoritative deny input |
| hooks/git/pre-commit.d/25-impact-triad | CREATE | host-independent commit-boundary enforcement |
| scripts/install-git-hooks.mjs | MODIFY | install/remove the universal dispatcher slot |
| scripts/wire-hooks.mjs | MODIFY | shared completion/pre-completion guard registration |
| scripts/wire-codex-hooks.mjs | MODIFY | compose exact Codex authority with impact guard |
| skills-manifest.json | N/A | no new registered skill and no rulesRegistry entry |

## Changeset Blueprint

### schemas/change-impact-triad.schema.json — complete schema

Draft 2020-12, additionalProperties false. Required: schema_version=1, wi, session_id, worktree_root, task_graph, task_id, diff_sha256, risk_tier, risk_reasons, breaks_what, intended_behavior, product_surface, coverage_tasks, independent_review, runtime_proof, created_at. Each triad field is an object with answer, sources (non-empty path/AC/test references), and evidence commands/artifacts. risk_tier enum cosmetic, logic, high. High requires independent_review status pass with reviewer family different from executor and runtime_proof status pass with behavioral artifact. Logic requires mapped test pass. Cosmetic requires static proof. Subsumption adds subsumed_by phases and exact evidence paths. Receipt identity must match WI-484 binding and, on Codex, WI-485 runtime task authority.

### references/change-impact-triad.md — complete policy

Define exact questions: Breaks-what lists changed symbols/paths, call sites, mapped tests/journeys, result or evidence-backed no-reference case. Intended-behavior states how it must work and cites spec/journey/AC/user decision; absence creates a blocking source-repair task. Product-surface names persona/page/flow and behavioral proof or cites why headless. Risk classifier floor: auth/authz/RLS/policy, billing/money, schema/migration, shared layout/component, feature flag, host hook/task graph, release/signing/version config are high regardless of line/file count. Logic/data/caller changes are logic. Pure copy/comment/format with no symbol/call-site change may be cosmetic. Any non-trivial quick-fix answer escalates. Missing mapped coverage creates a task with owner/dependency/validation; prose acknowledgement cannot close. Receipt lifecycle follows diff changes and is invalidated by task/worktree/session/diff changes.

### scripts/classify-change-risk.mjs — complete CLI and result

```text
Usage: node scripts/classify-change-risk.mjs [--staged|--diff BASE...HEAD] [--json] [--explain]
Inputs: git name-status, zero-context diff headers/hunks, repository risk registry embedded in reference JSON block.
Output: {tier,reasons,paths,symbol_signals,never_fast_lane,required_proof,sha256}
Exit 0 classified; exit 2 malformed/no repository; ambiguous binary/generated/config change escalates to high.
```

Classifier first applies path/pattern deny families, then diff symbol signals, then cosmetic allow conditions. Deletions and renames inherit the higher old/new risk. No line-count downgrade exists. The SHA binds normalized diff plus classifier version.

### hooks/svc-impact-triad-guard.mjs — complete decision sequence

Run on task completion/commit boundary, not arbitrary reads. Resolve exact WI-484 binding, graph/task, worktree and current diff; Codex additionally requires WI-485 authority. Outside svc or no governed mutating task: allow. Find receipt only at worktree-local .svc/impact-triad/WI-N/task-N.json; reject symlink, foreign identity, stale diff hash, schema error, insufficient tier proof, unresolved coverage tasks, or self-review posing as independent. Emit host-native deny with exact generation/review/proof recovery. Guard does not replace post-action review/audit; it enforces the minimum receipt.

### Skill and quick-fix modifications — exact behavior

`route-workflow`: before lane selection classify intended paths when known; otherwise assign provisional high and reclassify on staged diff. Insert an impact-triad task before completion for every mutating lane. Log tier/reasons. Read-only routes are N/A with evidence.

`quick-fix`: add P1-ImpactTriadEligibility before edits. Run classifier; any never_fast_lane, logic/high tier, real call sites, missing intended source, user-visible surface without existing proof, or required coverage creation exits quick-fix and routes to diagnose-bug/plan-changeset. A genuine cosmetic change emits all three fields and static proof. Remove self-asserted file-count/correctness as sufficient eligibility.

`scripts/quick-fix-eligibility.mjs`: require classifier JSON and a valid cosmetic receipt; deny protected families before file-count logic; emit reasoned escalation, never a bypass receipt.

`diagnose-bug`: after expected behavior, Pillar Revisit Audit, affected artifacts, proof-of-fix and verify-promotion planning, emit one subsumption receipt mapping those exact phase artifacts to the three fields. Missing coverage becomes a child task/WI before closeout.

`execute-changeset`: at each task checkpoint reclassify actual staged diff and compare to planned tier; upward drift blocks and adds review/proof tasks. Generate/update triad receipt. For logic run mapped tests; for high require different-family review and runtime/behavior proof on affected surface. Headless framework high risk uses controlled payload/runtime fixture where deployment is N/A.

`DOCTRINE`: add universal assurance floor, tier table, no self-downgrade, coverage creation, identity coupling, and examples.

### Wiring and tests — exact matrix

Install hooks/git/pre-commit.d/25-impact-triad through scripts/install-git-hooks.mjs as the host-independent commit boundary; the slot invokes the Node guard against the staged diff and exact binding. Register one earlier stable impact guard in shared supported host paths for faster feedback. For Codex, call it only after prompt/task authority passes; do not add another Stop. The tier-1 test synthesizes cosmetic docs copy, logic function, auth one-line, RLS, payment, schema, migration, shared layout, feature flag, hook, task graph and release config diffs; rename/delete/binary ambiguity; each lane; missing/valid/subsumed receipt; stale diff; wrong WI/session/task/worktree; self vs different-family review; missing coverage; structural vs runtime proof. Assert no fast lane for every high class and exact task creation for gaps.

## MODIFY Anchor Ledger

| File | Exact existing anchor | Disposition |
|---|---|---|
| quick-fix/SKILL.md | `## When to Use`, `## Process`, `## Phase Receipt Contract`, `## Self-Verify`, `## Mechanical Eligibility` | REPLACE eligibility floor; INSERT impact phase/receipt/escalation |
| diagnose-bug/SKILL.md | `### 2. Define expected behavior`, `### 4.4. Pillar Revisit Audit`, `### 6. Define proof of fix` | INSERT subsumption emitter referencing these artifacts |
| route-workflow/SKILL.md | `## Concern Scan & Pre-WI Dispatch` and `### Self-Verify` | INSERT risk route/impact task and receipt check |
| execute-changeset/SKILL.md | `### Step 2: Execute tasks (write directly)` and `### Step 3: Two-stage holistic review` | INSERT reclassification, coverage tasks, tier proof |
| DOCTRINE.md | `## The Review Protocol` | INSERT universal assurance floor and tier table immediately before this heading |
| scripts/quick-fix-eligibility.mjs | `const DENY_PATH_PATTERNS`, `function classifyDiff`, `function main` | REPLACE path risk input; require cosmetic receipt |
| scripts/install-git-hooks.mjs | `const EVENTS` and `function installDispatcher` | PRESERVE dispatcher; assert new pre-commit slot discovery |
| scripts/wire-hooks.mjs | `function buildHookEntries(skillsPath)` PreToolUse guards | INSERT early impact feedback |
| scripts/wire-codex-hooks.mjs | `function buildHookEntries(skillsPath)` WI-485 exact-skill entry | INSERT impact check after exact authority; no new Stop |

## Task Graph

```json
{"tasks":[
 {"id":"task-1","title":"Write schema, assurance doctrine, and failing risk fixtures","blocked_by":[]},
 {"id":"task-2","title":"Implement deterministic classifier and owned receipt guard","blocked_by":["task-1"]},
 {"id":"task-3","title":"Integrate routing and mechanical quick-fix eligibility","blocked_by":["task-2"]},
 {"id":"task-4","title":"Integrate bug subsumption and execution proof tasks","blocked_by":["task-3"]},
 {"id":"task-5","title":"Wire completion enforcement and run lane/identity validation","blocked_by":["task-4"]}
]}
```

| Task | ACs | Validation | Checkpoint |
|---|---|---|---|
| 1 | 1–5 | schema/policy fixture baseline | yes |
| 2 | 2,3,5,6 | risk and foreign receipt matrix | yes |
| 3 | 1–3 | route/quick-fix fixtures | yes |
| 4 | 1,3–5 | subsumption/coverage/proof fixtures | yes |
| 5 | 1–6 | host composition + full tier-1 | yes |

## AC-to-Task and AC-to-Test Mapping

| AC | Task | Test type | Proof |
|---|---|---|---|
| AC-481-1 | 1,3,4 | lane matrix | receipt or valid subsumption for every mutating lane |
| AC-481-2 | 1–3 | mechanical table | every protected class denies quick-fix |
| AC-481-3 | 2,3 | routing | non-trivial answers create full-lane route |
| AC-481-4 | 1,4 | task graph | missing coverage creates blocking task |
| AC-481-5 | 1,4,5 | review/runtime | different-family + behavioral proof |
| AC-481-6 | 2,5 | identity/security | foreign/stale receipt rejected; P4/P5 compose |

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX/UI | conditional | product-surface field routes visible gaps to existing design/journey skills |
| Technical design | satisfied | schema, classifier, guard and composition contracts above |
| Style | satisfied | ESM, JSON Schema, existing skill phase conventions |
| Persona | conditional | field requires concrete persona for user-visible work; headless gets cited N/A |
| Identity | gated | WI-484 and WI-485 verified receipts |
| Independent review | mandatory for high | fresh different-family review artifact |

## Validation Plan

### Tier-1 promotion note

| Field | Decision |
|---|---|
| validator_path | test-framework/evals/tier-1/validate-impact-triad.sh |
| failure_class | high-risk change silently routed through weak assurance |
| promotion_signal | WI-ADMIN-ACCESS-01 auth regression plus active quick-fix hot path |
| expected_runtime_budget | under 5 seconds; bounded staged-diff/receipt vectors |
| why_tier_2_or_targeted_is_insufficient | routing and commit eligibility are framework hot paths; runtime product proof remains lane-specific |

Run schema validation, Node syntax, risk vectors, all lane fixtures, quick-fix eligibility, foreign identity matrix, host composition, exact receipt path/schema, manifest lint if registered surfaces change, pipeline integrity, and full tier-1. Run a controlled high-risk framework payload as runtime/behavior proof.

## Execution Command Sequence

```bash
git fetch origin main
test -z "$(git status --short)"
node scripts/svc-ensure-worktree.mjs --wi WI-481 --branch framework-WI-481-change-impact-triad --from origin/main --print-cd
cd .worktrees/framework-WI-481-change-impact-triad
bash test-framework/evals/tier-1/validate-impact-triad.sh
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash test-framework/evals/run-all-evals.sh
```

RECOVERY_IF_FAIL: never downgrade the risk tier or mark a coverage gap noted. Preserve the failing diff/receipt fixture, repair classifier, routing, proof, or ownership coupling, rerun its full family, then full tier-1.

## Checkpoint Plan

Commit schema/classifier/fixtures, routing/quick-fix, bug/execute integration, and host enforcement separately. Every high-risk checkpoint requires the independent review artifact and focused runtime fixture before the next task.

## Promotion Readiness Checklist

- [ ] WI-485, WI-484, WI-482, and WI-483 are VERIFIED.
- [ ] All six ACs pass across every mutating lane.
- [ ] Never-fast-lane class table is mechanical and exhaustive for named classes.
- [ ] Coverage gaps are blocking tasks.
- [ ] Independent review is different-family and runtime proof is behavioral.
- [ ] Foreign/stale receipts fail.
- [ ] No ORM migration applies; receipt schema is versioned and validated.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 2 | Host config | impact guard registration | coupled | host wirers and composition tests |
| 3 | Worktree state | diff-bound impact receipts | coupled | invalidated on diff/task/worktree/session change |
| 12 | Downstream framework artifacts | route, quick-fix, bug, execute, doctrine contracts | coupled | tier-1 lane matrix and manifest lint |
| 15 | Runtime filesystem | Codex authority used to validate receipt owner | coupled | WI-485 TTL and WI-484 binding lifecycle |

Untouched environments (walked the taxonomy, found nothing): 1, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

## Simulation Report

| Check | Result | Evidence |
|---|---|---|
| CREATE targets absent | PASS | reference/schema/classifier/guard/test absent |
| MODIFY targets exist | PASS | five skill/doctrine/eligibility/wirer targets present |
| Entry-point coverage | PASS | all mutating lane families route through shared receipt |
| Dependency | PASS | P4/P5 identity precedes receipt enforcement |
| Scenario walk | PASS | cosmetic, logic, auth, missing source/coverage, foreign receipt map to tasks |

No unresolved simulation failure remains. Handoff stops before execute-changeset.
