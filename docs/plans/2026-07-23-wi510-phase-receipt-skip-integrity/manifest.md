# WI-510 Change Manifest: Phase-Receipt-Aware Skip Integrity

**Spec:** `docs/specs/features/wi-510-phase-receipt-skip-integrity.md`
**Technical design:** `docs/specs/tech/wi-510-phase-receipt-skip-integrity.md`
**Solution confidence:** `docs/specs/decisions/2026-07-23-wi-510-phase-receipt-skip-integrity/SOLUTION-CONFIDENCE.md`
**Branch:** `framework-WI-510-phase-receipt-skip-integrity`
**Worktree:** `.worktrees/framework-WI-510-phase-receipt-skip-integrity`
**Base:** `main` at `89806678a9d88a0eafa4784fba8a065ff367c0e0`
**Created:** 2026-07-23
**Status:** SIMULATED
**Execution mode:** `inline`

## Archetype

Architectural change. The file footprint is bounded, but the change installs
one semantic authority across multiple governance gates. The planning source of
truth is the invariant and dependency map, not the number of lines changed.

### Current invariants

1. A completed current task never passes the shared skip-integrity classifier
   without a matching loaded skill receipt and structurally valid phase
   evidence; required-phase completeness remains owned by the Phase-D validator.
2. Any skip intent requires explicit, applicable, registry-backed delivery
   authorization in addition to the strict current receipt.
3. Unknown, malformed, empty, mismatched, escaping, or prose-only state fails
   closed.
4. The only retained historical behavior is the pre-enforcement base-receipt
   compatibility documented in `references/phase-receipts.md`.
5. WI-498 graph bytes, receipts, notes, checkpoints, and audit history remain
   unchanged.
6. Whole delivery-graph findings remain independent from a task-local completed
   state verdict.
7. Registry and lane-integrity consumers cannot define competing receipt
   predicates.

### Affected subsystem map

```text
references/phase-receipts.md
          |
          v
shared completed-task classifier <--- references/skip-conditions.json
          |
          +--> focused mutation-red validator
          +--> skip-conditions registry validator
          +--> lane-tasks integrity validator
          |
          v
aggregate Tier-1 / main-green canary / promotion replay
```

The change is reversible with a normal reviewed Git revert. It contains no data
migration and writes no historical graph.

## Implementation Summary

Create a dependency-free pure Node classifier and CLI that return `executed`,
`authorized-skip`, `legacy-compatible`, or `invalid` with stable reason codes.
Create one focused fixture matrix and Tier-1 validator. Replace only the
duplicated completed-task predicates in the two existing shell validators.
Document the exact boundary, remove the WI-498 known-red row after focused and
aggregate proof, and close the framework improvement through the mandatory
review and promotion chain.

Execution is inline. The active orchestrator has loaded the governing spec,
technical design, original validators, promoted WI-498 graph, current WI-509
graph, registry, Phase-D contract, and task graph. Changeset code blueprints are
therefore omitted; exact symbols, state transitions, tasks, files, and commands
remain frozen below.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| **scripts/lib/completed-task-integrity.mjs** | CREATE | task-2 | Pure classifier, strict receipt parser, skill-bound skip lookup, reason codes |
| **scripts/validate-completed-task-integrity.mjs** | CREATE | task-2 | CLI adapter for graph/task/registry selection and structured output |
| **test-framework/evals/tier-1/fixtures/phase-receipt-skip-integrity.json** | CREATE | task-1 | Hermetic positive and mutation-red scenario matrix |
| **test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh** | CREATE | task-1/task-2 | Focused contract runner plus unchanged WI-498 and WI-509 replay |
| `test-framework/evals/tier-1/validate-skip-conditions-registry.sh` | MODIFY | task-2 | Retain registry checks; delegate registered completed tasks to shared CLI |
| `test-framework/evals/tier-1/validate-lane-tasks-integrity.sh` | MODIFY | task-2 | Retain ID/status checks; delegate completed skill tasks to shared CLI |
| `references/phase-receipts.md` | MODIFY | task-3 | Normative completed-task state and evidence-reference boundary |
| `.svc/main-green-allowlist.json` | MODIFY | task-5 | Remove the obsolete WI-498 row only after promoted-main focused/full proof, then rerun full Tier-1 in closeout |
| `docs/specs/work-items/WI-510.md` | MODIFY | task-5 | Promoted evidence and verified status in governance closeout |
| `docs/specs/work-items/INDEX.md` | MODIFY | task-5 | WI-510 verified lifecycle |
| `FRAMEWORK-STATE.md` | MODIFY | task-5 | Promoted analysis history and locked decision |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | task-5 | Verified phase-receipt-aware validation capability |
| `proposals/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md` | CREATE then MOVE/MODIFY | pre-plan/task-5 | Accepted proposal in implementation PR; verified record in governance closeout |
| `docs/specs/features/wi-510-phase-receipt-skip-integrity.md` | CREATE then MODIFY | pre-plan/task-5 | Baselined behavior in implementation PR; VERIFIED status in governance closeout |
| `docs/specs/tech/wi-510-phase-receipt-skip-integrity.md` | CREATE | pre-plan | Baselined architecture |
| `docs/specs/decisions/wi-510-phase-receipt-skip-integrity.md` | CREATE | pre-plan | Ranked write-spec and design-tech decisions |
| `docs/specs/decisions/2026-07-23-wi-510-phase-receipt-skip-integrity/SOLUTION-CONFIDENCE.md` | CREATE/MODIFY | pre-plan | Design-auto confidence authority |
| `docs/specs/explorations/wi-510-phase-receipt-skip-integrity/` | CREATE | pre-plan | Problem, options, comparison, decision evidence |
| `docs/specs/research-log.md` | MODIFY | pre-plan | Repository-primary precedent record |
| **docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/manifest.md** | CREATE/MODIFY | plan/review | Execution authority |
| **docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/review-log.yaml** | CREATE | review | Independent plan-review findings and convergence |
| **docs/specs/reviews/wi-510-phase-receipt-skip-integrity-cross-model.md** | CREATE | task-4 | Durable independent cross-model findings |
| **docs/specs/reviews/wi-510-phase-receipt-skip-integrity-exec-cross-model.md** | CREATE | task-4 | Durable mandatory review-exec findings |
| **docs/specs/security/wi-510-phase-receipt-skip-integrity-review.md** | CREATE | task-4 | Fail-closed and authorization security review |
| **docs/specs/audit/wi-510-phase-receipt-skip-integrity-analysis.md** | CREATE | task-4 | AC and implementation audit |
| `.svc/lane-tasks-WI-510.json` | CREATE/MODIFY | all | Cross-host task and phase receipts |
| `.svc/pipeline-decisions.jsonl` | APPEND | all | Append-only decisions and gate outcomes |
| `.svc/session-contract.jsonl` | APPEND | preflight | Fresh WI-510 authority contract |

No other tracked path is authorized. Runtime logs, review receipts, and receipt
mirrors under `.svc/` are ignored, bounded execution evidence. Post-merge proof
is stored in the canonical `verify-promotion` receipt and consolidated Git note
on the promoted squash SHA; it does not claim to be content inside that squash.

Pre-plan artifacts have one lifecycle owner per promotion stage. The technical design, design
decisions, solution exploration, solution-confidence packet, and research-log
entry are frozen planning inputs after review-plan convergence; outer task 8
must not modify them. The feature spec and proposal are created by the planning
stage and remain frozen through implementation promotion; task-5 alone owns
their post-promotion status/move. The manifest and review log are owned by
review-plan until convergence, then are frozen inputs to execution.

## Changeset Blueprint

Skipped because execution mode is `inline`. The active orchestrator will apply
the reviewed manifest with the governing spec and technical design loaded.

## Inline Classifier Contract

### Exported library surface

| Export | Contract |
|---|---|
| `CLASSIFICATIONS` | frozen values `executed`, `authorized-skip`, `legacy-compatible`, `invalid` |
| `REASON_CODES` | frozen reason-code values listed below |
| `PHASE_ENFORCE_AFTER` | `2026-05-10T16:00:00Z` |
| `resolveLegacyAuthority(input)` | accepts `{graphPath, repoRoot}`; uses the fixed canonical cutoff and returns the last pre-enforcement snapshot only when Git proves the tracked graph predates it |
| `classifyCompletedTask(input)` | accepts `{graph, task, registry}` and returns one current-contract task result; callers cannot inject legacy authority |
| `classifyGraphCompletedTasks(input)` | accepts `{graph, graphPath, registry, repoRoot, registeredSkillsOnly?, structuredOrSkipOnly?, taskIds?}`; derives legacy authority only when the graph exactly matches the tracked graph file, then returns the ordered aggregate |

One task result is:

```text
{
  task_id: string|number,
  skill: string|null,
  classification: executed|authorized-skip|legacy-compatible|invalid,
  ok: boolean,
  reasons: [{code: string, message: string, path?: string}]
}
```

The aggregate is:

```text
{
  ok: boolean,
  graph: string|null,
  checked: number,
  results: task-result[]
}
```

Input task order is preserved. `taskIds` filters to exact IDs and fails usage
validation when a requested ID is absent or explicitly filtered; requested
non-completed tasks return `not-completed` rather than a successful zero-check
result. `registeredSkillsOnly` uses all skill candidates before classification.
`structuredOrSkipOnly` centralizes the two consumers' semantic scope. It selects
structured phase/skip surfaces, malformed common receipt state, and phase-free
receipts without the legacy non-empty `output_artifact`/`validation_output`
summary floor. It never grants compatibility authority or changes a task
classification. The skip-registry shell retains its pre-WI-510 active/in-flight
graph boundary; lane integrity and focused replay cover closed graphs.

### Classification precedence

1. Reject non-completed tasks, absent task skill, or malformed common input.
2. Detect skip intent when either task has a `skip_reason` property or any
   delivery skip names the task skill.
3. For skip intent, require exactly one skill-bound registered delivery entry,
   non-empty delivery reason/evidence, a matching non-empty string task reason, a registry
   condition whose canonical applicability metadata (`skip_when` plus non-empty
   `signals`, or graph-level `applies_when` plus `required_evidence`) is
   substantive, and a strict matching current phase receipt. The delivery
   graph is the explicit authorization; task prose alone is never one. Return
   `authorized-skip` only when all pass.
4. With no skip intent, validate a strict matching current phase receipt and
   its phase ID, timestamp, artifact type, and safely resolvable evidence
   reference shape, then return `executed`. Required-phase/current-contract
   checks stay in `validate-skill-receipt-shape.sh`.
5. If and only if Git proves the tracked graph predates
   `PHASE_ENFORCE_AFTER`, the receipt has no phase-extension key, and the
   completed task ID, canonical skill, and receipt exactly match the last
   pre-enforcement snapshot, return `legacy-compatible`. Editable
   `graph.created` values, post-cutoff task insertion, receipt mutation, and
   caller-supplied markers do not establish legacy authority.
6. Every other state returns `invalid`. No branch guesses.

### Stable reason codes

`not-completed`, `missing-task-skill`, `task-skill-conflict`, `missing-skill-receipt`,
`receipt-skill-mismatch`, `invalid-loaded-at`, `invalid-loaded-via`,
`legacy-backfill-not-execution`, `invalid-skip-reason`, `missing-phases`, `malformed-phases`,
`invalid-phase-id`, `invalid-phase-timestamp`, `empty-phase-evidence`,
`invalid-evidence-type`, `unsafe-evidence-path`,
`skip-authorization-missing`, `skip-authorization-ambiguous`,
`skip-condition-unregistered`, `skip-condition-wrong-skill`,
`skip-condition-inapplicable`, `skip-justification-missing`,
`skip-reason-mismatch`, and
`unsupported-legacy-receipt`.

The fixture matrix must exercise every code that represents a WI-510
acceptance boundary.

### Evidence-reference contract

| Evidence type | Accepted path | Replay existence |
|---|---|---|
| `file` | contained repository-relative path, or normalized absolute path under `os.tmpdir()` | not required for OS-temp execution evidence |
| `command_output` | contained repository-relative path, or normalized absolute path under `os.tmpdir()` | not required; command logs are execution-local |
| `screenshot` | contained repository-relative path only | handled by visual evidence gates |
| `live_dom` | contained repository-relative path only | handled by runtime evidence gates |

Empty paths, NUL bytes, repository escapes, absolute paths outside
`os.tmpdir()`, and OS-temp `screenshot`/`live_dom` paths return
`unsafe-evidence-path`. The focused matrix includes the actual `/tmp` shapes
declared by review-plan plus non-temporary and type-incompatible inversions.
Repository-relative and OS-temp references are not required to retain bytes
after execution; "dangling" means an empty, escaping, absolute-outside-temp, or
otherwise non-resolvable reference, not a deliberately expired execution log.
Accordingly, `executed` means a well-formed execution receipt,
not cryptographic proof of the referenced bytes. Content integrity remains a
chain-receipt/final-SHA concern and is explicitly outside WI-510.

### CLI surface

```text
node scripts/validate-completed-task-integrity.mjs
  --graph <lane-tasks.json>
  --registry <skip-conditions.json>
  [--task <id>]...
  [--registered-skills-only]
  [--structured-or-skip-only]
  [--phase-free-compat strict|loaded|summary]
  [--repo-root <path>]
  [--json]
```

The CLI prints the aggregate JSON for `--json`; otherwise it prints one stable
diagnostic per invalid result and a summary. Exit `0` means every selected
completed task is valid. Exit `1` means at least one selected task is invalid.
Exit `2` means malformed CLI arguments, an
unreadable top-level graph/registry, invalid top-level JSON, or a missing
requested task. The focused test runner exits `2`
with token `classifier-unavailable` only when the CLI file itself is absent
during the expected-red checkpoint.

## Task Graph

```json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Create focused receipt and skip-integrity fixture matrix",
      "blocked_by": [],
      "files": [
        "test-framework/evals/tier-1/fixtures/phase-receipt-skip-integrity.json",
        "test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh"
      ],
      "acs": ["PSR-01", "PSR-03", "PSR-04", "PSR-05", "PSR-06", "PSR-08", "PSR-09", "PSR-10", "PSR-11", "PSR-12", "PSR-13", "PSR-14", "PSR-15", "PSR-19"],
      "validation": "Focused validator initially fails because the classifier CLI is absent, then passes after task-2",
      "checkpoint": "wi510-mutation-red"
    },
    {
      "id": "task-2",
      "title": "Implement the shared classifier and wire all three consumers",
      "blocked_by": ["task-1"],
      "files": [
        "scripts/lib/completed-task-integrity.mjs",
        "scripts/validate-completed-task-integrity.mjs",
        "test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh",
        "test-framework/evals/tier-1/validate-skip-conditions-registry.sh",
        "test-framework/evals/tier-1/validate-lane-tasks-integrity.sh"
      ],
      "acs": ["PSR-01", "PSR-02", "PSR-03", "PSR-04", "PSR-05", "PSR-06", "PSR-07", "PSR-08", "PSR-09", "PSR-10", "PSR-11", "PSR-12", "PSR-13", "PSR-14", "PSR-15", "PSR-16", "PSR-19", "PSR-20", "PSR-21"],
      "validation": "Node syntax, focused matrix, both overlapping validators, unchanged WI-498 and current WI-509 replay",
      "checkpoint": "wi510-integrity-engine"
    },
    {
      "id": "task-3",
      "title": "Lock doctrine and run aggregate proof before promotion",
      "blocked_by": ["task-2"],
      "files": [
        "references/phase-receipts.md"
      ],
      "acs": ["PSR-07", "PSR-14", "PSR-16", "PSR-17", "PSR-20", "PSR-21"],
      "validation": "Focused replay remains green, full Tier-1 passes, WI-498 path has no diff, and the historical allowlist row remains unchanged pending promoted replay",
      "checkpoint": "wi510-doctrine-green"
    },
    {
      "id": "task-4",
      "title": "Bind independent reviews to an exact final branch SHA, land it, and store promoted proof in the verify-promotion receipt",
      "blocked_by": ["task-3"],
      "files": [
        "docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/review-log.yaml",
        "docs/specs/reviews/wi-510-phase-receipt-skip-integrity-cross-model.md",
        "docs/specs/reviews/wi-510-phase-receipt-skip-integrity-exec-cross-model.md",
        "docs/specs/security/wi-510-phase-receipt-skip-integrity-review.md",
        "docs/specs/audit/wi-510-phase-receipt-skip-integrity-analysis.md",
        ".svc/lane-tasks-WI-510.json",
        ".svc/pipeline-decisions.jsonl",
        "docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/manifest.md"
      ],
      "acs": ["PSR-16", "PSR-17", "PSR-18", "PSR-22"],
      "validation": "Review-plan, G5, cross-model/security, review-exec, audit, clean-tree final-SHA receipt check, exact-head PR merge, promoted WI-498 replay, canonical reconcile, verify-promotion Git note",
      "checkpoint": "wi510-promoted-proof"
    },
    {
      "id": "task-5",
      "title": "Persist truthful land, verify, and improve-framework completion in a governance-only follow-up PR",
      "blocked_by": ["task-4"],
      "files": [
        ".svc/lane-tasks-WI-510.json",
        ".svc/main-green-allowlist.json",
        ".svc/pipeline-decisions.jsonl",
        "docs/specs/features/wi-510-phase-receipt-skip-integrity.md",
        "docs/specs/work-items/WI-510.md",
        "docs/specs/work-items/INDEX.md",
        "FRAMEWORK-STATE.md",
        "references/knowledge/svc/CAPABILITIES.md",
        "proposals/done/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md"
      ],
      "acs": ["PSR-16", "PSR-17", "PSR-18", "PSR-22"],
      "validation": "task 15/16 and improve-framework receipts reflect actual merge/replay; obsolete allowlist row removed only now; governance-only diff; full Tier-1 without the row; closeout PR exact-head merge; final promoted replay and reconcile",
      "checkpoint": "wi510-governance-closeout"
    }
  ]
}
```

Tasks are sequential because task-1 defines failure expectations, task-2
implements them, task-3 locks doctrine and aggregate proof, and
task-4 binds review and implementation promotion to the first promoted SHA.
task-5 is a mechanically separate governance-only closeout PR created only
after that SHA has passed promoted replay. It is the truthful persistence
boundary for outer tasks 15/16 and the resumed improve-framework wrapper.

The JSON above is the **inner changeset graph**. It describes implementation
dependency order only. The authoritative execution graph is
`.svc/lane-tasks-WI-510.json`, whose 16 skills and statuses are listed below.

## Mandatory Lane Compliance

| Outer task | Skill | Current status at plan review | Artifact / required completion evidence |
|---:|---|---|---|
| 1 | improve-framework | blocked as orchestration wrapper | accepted proposal; resumes after task 16 and records its remaining phase receipts |
| 2 | write-spec | completed | baselined feature spec and 6 phase receipts |
| 3 | research | completed | `docs/specs/research-log.md` and 6 phase receipts |
| 4 | explore-solutions | completed | selected decision under `docs/specs/explorations/wi-510-phase-receipt-skip-integrity/` and 6 phase receipts |
| 5 | design-tech | completed | baselined technical design, G4 log, and 6 phase receipts |
| 6 | plan-changeset | completed | this manifest, v3 baton body, and 6 phase receipts |
| 7 | review-plan | in progress | independent review log and 6 phase receipts required before task 8 |
| 8 | execute-changeset | pending | implementation, focused/full verification, exec record |
| 9 | review-gate | pending | G5 staged/final diff verdict |
| 10 | review-cross-model | pending | independent cross-model artifact |
| 11 | review-exec | pending | different-family adversarial receipt bound to frozen diff |
| 12 | review-security | pending | fail-closed/authorization review artifact |
| 13 | audit-implementation | pending | AC and implementation audit receipt |
| 14 | test-framework | pending | focused and aggregate Tier-1 evidence |
| 15 | land-changeset | pending | exact final branch SHA, PR, squash merge, final-SHA receipt recomputation |
| 16 | verify-promotion | pending | promoted WI-498/WI-509 replay, Tier-1, reconcile, verify-promotion receipt |

No mandatory upstream skill is silently skipped. The outer graph validates with:

```text
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-510.json
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-510.json
node scripts/validate-delivery-graph.mjs .svc/lane-tasks-WI-510.json
```

The host executes skill tasks through the canonical task-graph protocol, not a
shell alias. For outer tasks 9-14 the exact invocation/postcondition contract is:

| Task | Activation command | Required durable postcondition |
|---:|---|---|
| 9 | `node scripts/task-graph.mjs load-skill .svc/lane-tasks-WI-510.json 9 review-gate --via codex-load-skill` | six G5 phase receipts and PASS decision logs |
| 10 | `node scripts/task-graph.mjs load-skill .svc/lane-tasks-WI-510.json 10 review-cross-model --via codex-load-skill` | cross-model report plus six phase receipts |
| 11 | `node scripts/task-graph.mjs load-skill .svc/lane-tasks-WI-510.json 11 review-exec --via codex-load-skill` | exec review report/body plus six phase receipts |
| 12 | `node scripts/task-graph.mjs load-skill .svc/lane-tasks-WI-510.json 12 review-security --via codex-load-skill` | security report plus six phase receipts |
| 13 | `node scripts/task-graph.mjs load-skill .svc/lane-tasks-WI-510.json 13 audit-implementation --via codex-load-skill` | audit report/body plus six phase receipts |
| 14 | `node scripts/task-graph.mjs load-skill .svc/lane-tasks-WI-510.json 14 test-framework --via codex-load-skill` | focused/full results plus six phase receipts |

Each row is activated only after its blocker is completed, then its loaded
`SKILL.md` is followed completely. A missing artifact, missing phase, non-PASS
verdict, or non-completed task stops before the frozen-tree stage.

The five inner tasks map to outer tasks as follows: inner task-1/task-2 execute
under outer task 8; inner task-3 spans outer tasks 8 and 14; inner task-4 spans
outer tasks 9 through 16; inner task-5 resumes outer task 1 after task 16 and
persists the post-promotion graph in the separate closeout PR. The outer graph
is always authoritative for skill activation, blockers, phase receipts, and
completion.

## AC-to-Task Mapping

| AC | Task(s) |
|---|---|
| PSR-01 | task-1, task-2 |
| PSR-02 | task-2 |
| PSR-03 | task-1, task-2 |
| PSR-04 | task-1, task-2 |
| PSR-05 | task-1, task-2 |
| PSR-06 | task-1, task-2 |
| PSR-07 | task-2, task-3 |
| PSR-08 | task-1, task-2 |
| PSR-09 | task-1, task-2 |
| PSR-10 | task-1, task-2 |
| PSR-11 | task-1, task-2 |
| PSR-12 | task-1, task-2 |
| PSR-13 | task-1, task-2 |
| PSR-14 | task-1, task-2, task-3 |
| PSR-15 | task-1, task-2 |
| PSR-16 | task-2, task-3, task-4, task-5 |
| PSR-17 | task-3, task-4, task-5 |
| PSR-18 | task-5 |
| PSR-19 | task-1, task-2 |
| PSR-20 | task-2, task-3 |
| PSR-21 | task-2, task-3 |
| PSR-22 | task-3, task-4, task-5 |

## AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| PSR-01 | Integration | valid current execution fixture returns `executed` |
| PSR-02 | Integration | unchanged WI-498 execution passes without a delivery graph |
| PSR-03 | Mutation-red | mismatched receipt skill fails |
| PSR-04 | Mutation-red | non-array/malformed phase receipt fails |
| PSR-05 | Mutation-red | empty phase artifacts fail |
| PSR-06 | Mutation-red | empty, escaping, non-temporary absolute, and type-incompatible temporary paths fail |
| PSR-07 | Static + integration | repository-relative and canonical `/tmp` file/command-output references pass without later existence |
| PSR-08 | Integration | matching registered delivery authorization plus strict receipt passes |
| PSR-09 | Mutation-red | empty delivery reason/evidence fails |
| PSR-10 | Mutation-red | authorization without receipt or task reason fails |
| PSR-11 | Mutation-red | receipt plus skip prose without delivery entry fails |
| PSR-12 | Mutation-red | unregistered, wrong-skill, and empty canonical-applicability registry conditions fail |
| PSR-13 | Mutation-red | receipt on skip-intent task without authorization fails |
| PSR-14 | Integration | a temporary Git history with a true pre-enforcement task/receipt snapshot returns `legacy-compatible`; a task inserted after cutoff into that old path fails |
| PSR-15 | Mutation-red | malformed, untracked, or currently committed graph with a backdated editable `created` field fails |
| PSR-16 | Real replay | tracked WI-498 graph passes unchanged |
| PSR-17 | Static | scoped Git diff excludes WI-498 graph/history paths |
| PSR-18 | Promoted aggregate | implementation passes promoted focused/full replay with the historical row still present; task-5 removes it and reruns full Tier-1 without masking |
| PSR-19 | Integration | focused fixture matrix self-asserts every named path |
| PSR-20 | Integration | both overlapping validators call the same CLI and pass |
| PSR-21 | Aggregate | Tier-1 runner auto-enumerates the focused shell file |
| PSR-22 | Aggregate | full Tier-1 and promoted-main replay pass with empty known-red list |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style | Persona/competitor |
|---|---|---|---|---|
| task-1 | N/A, headless validator | fixture matrix and state machine in technical design | portable Bash, hermetic temporary state | N/A, system-only |
| task-2 | N/A, headless validator | exact pure-library/CLI boundary and fail-closed ordering | dependency-free Node ESM plus thin shell consumers | N/A, system-only |
| task-3 | N/A, doctrine/state only | cost, operations, compatibility, rollback | concise operational Markdown and append-only logs | N/A, system-only |
| task-4 | N/A, governance only | proof and promotion gates | existing chain-receipt and worktree conventions | N/A, system-only |
| task-5 | N/A, governance closeout | truthful post-promotion state persistence | append-only decisions and exact-path docs-only PR | N/A, system-only |

No style-contract file is required for this documentation/script-driven
framework. Existing neighboring Node ESM and portable Tier-1 shell patterns are
the grounded conventions.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 3 | Out-of-tree version control | canonical worktree, branch, PR, squash commit, Git receipt notes | coupled | `svc-ensure-worktree`, `land-changeset`, final-SHA receipt verification, and normal reviewed revert |
| 7 | External SaaS | canonical external-review provider and remote Git hosting for review/PR/merge | coupled | `scripts/run-external-review.mjs` hard-failure receipt, `scripts/review-plan-codex.sh`, land receipt, exact-head PR check, and retry from the same frozen SHA |
| 12 | Downstream framework artifacts | three Tier-1 consumers, Phase-D doctrine, framework state/capability memory | coupled | task-2/task-3 land in one governed chain; task-5 removes the obsolete baseline only after promoted replay |
| 14 | Authentication / secrets | existing external-review and Git-host credentials are relied on but never read or mutated by the changeset | coupled | launcher and `gh` fail before state mutation; re-authentication is an operator prerequisite, then the same receipt-bound command is retried |
| 15 | Runtime filesystem state | ignored focused logs, review receipts, and regenerable receipt mirrors | coupled | task phase commands produce them; Git notes are durable; worktree cleanup removes only WI-510 runtime residue |

Untouched environments (walked the taxonomy, found nothing): 1, 2, 4, 5, 6,
8, 9, 10, 11, 13. There is no decoupled external state, customer database
state, Supabase access, host installation, or production-runtime provider
dependency. Review and remote-Git network dependencies are explicit above.

External-review/auth/network failure is a hard stop with a launcher receipt;
it does not authorize a local substitute. A successful review followed by a
push/merge failure is retried from the same clean final branch SHA. A successful
merge followed by promoted replay failure leaves the promoted SHA and notes
intact, records `deployed-unverified`, and retries verification without changing
implementation history.

## Validation Plan

1. Syntax-check the two new Node files and shell-check the focused validator.
2. Prove the focused validator is red before classifier implementation with
   exact exit `2` and token `classifier-unavailable`; reject every other cause.
3. Run the focused mutation matrix after implementation.
4. Run `validate-skip-conditions-registry.sh`.
5. Run `validate-lane-tasks-integrity.sh`.
6. Run the classifier directly against unchanged WI-498 and current WI-509.
7. Run `validate-skill-receipt-shape.sh` to ensure Phase-D parity.
8. Prove no diff under the tracked WI-498 graph/work-item/history surfaces.
9. Run the full Tier-1 suite while preserving the historical allowlist row
   through implementation promotion.
10. Run outer tasks 9-14, stage the exact authorized implementation plus
    tracked review/audit/task-graph evidence, then freeze its Git tree and diff
    hash. The final review-exec body must name that exact diff hash.
11. Commit that unchanged frozen tree, assert commit-tree equality, and emit the
    five canonical plan/exec/review/audit receipt bodies onto
    `FINAL_BRANCH_SHA`. Receipt emission may write only ignored mirrors and Git
    notes; the tree and HEAD remain unchanged.
12. Land exactly `FINAL_BRANCH_SHA` through the canonical PR/squash path.
13. On promoted main, rerun the focused validator, unchanged WI-498 replay,
    WI-509 replay, full Tier-1, final-SHA receipt recomputation, and canonical
    reconcile. Store this post-merge truth only in the `verify-promotion`
    receipt/Git note and final report.
14. In the same-WI governance closeout, remove only the WI-498 allowlist row,
    rerun full Tier-1 without it, persist actual land/verify completion, merge
    the exact closeout head, and replay focused/full/reconcile once more.

## Execution Command Sequence

```bash
node scripts/svc-ensure-worktree.mjs --wi WI-510 --branch framework-WI-510-phase-receipt-skip-integrity --from main --json --print-cd
cd /workspace/seriousvibecoding/.worktrees/framework-WI-510-phase-receipt-skip-integrity
BASE_SHA=89806678a9d88a0eafa4784fba8a065ff367c0e0
test "$(git merge-base HEAD "$BASE_SHA")" = "$BASE_SHA"
test "$(git branch --show-current)" = "framework-WI-510-phase-receipt-skip-integrity"

# After task-1 fixture/test files are applied, capture only the intended red:
set +e
PRE_IMPL_OUTPUT=$(bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh 2>&1)
PRE_IMPL_EXIT=$?
set -e
test "$PRE_IMPL_EXIT" = "2"
printf '%s\n' "$PRE_IMPL_OUTPUT" | grep -q 'classifier-unavailable'

# Freeze the pre-change consumer failure surface. The exact live baseline is one
# validator failure containing only WI-498 tasks 5/6; lane integrity is green.
set +e
bash test-framework/evals/tier-1/validate-skip-conditions-registry.sh > /tmp/wi510-skip-registry-before.log 2>&1
SKIP_BEFORE_EXIT=$?
bash test-framework/evals/tier-1/validate-lane-tasks-integrity.sh > /tmp/wi510-lane-integrity-before.log 2>&1
LANE_BEFORE_EXIT=$?
set -e
test "$SKIP_BEFORE_EXIT" = "1"
test "$LANE_BEFORE_EXIT" = "0"
grep -q 'task 5 (review-plan).*task 6 (execute-changeset)' /tmp/wi510-skip-registry-before.log
test "$(grep -c '^  ✗' /tmp/wi510-skip-registry-before.log)" = "1"

# Preflight exact receipt/landing interfaces before any final-tree freeze.
rg -q 'a === "--body"' scripts/emit-receipt.mjs
node scripts/merge-pr-with-review-receipt.mjs --help 2>&1 |
  grep -q -- '--squash.*--delete-branch'
git cat-file -e "$BASE_SHA:docs/specs/work-items/WI-510.md"
# run-all-evals does not read the allowlist, and validate-main-green returns
# fully green before loading it; retaining a now-stale row cannot mask/fail green.
! rg -q 'main-green-allowlist|validate-main-green' test-framework/evals/run-all-evals.sh
rg -q 'if \\[\\[ \"\\$failed\" -eq 0 \\]\\]' scripts/validate-main-green.sh

# After task-2 implementation and consumer wiring:
node --check scripts/lib/completed-task-integrity.mjs
node --check scripts/validate-completed-task-integrity.mjs
bash -n test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh
bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh
set +e
bash test-framework/evals/tier-1/validate-skip-conditions-registry.sh > /tmp/wi510-skip-registry-after.log 2>&1
SKIP_AFTER_EXIT=$?
bash test-framework/evals/tier-1/validate-lane-tasks-integrity.sh > /tmp/wi510-lane-integrity-after.log 2>&1
LANE_AFTER_EXIT=$?
set -e
test "$SKIP_AFTER_EXIT" = "0"
test "$LANE_AFTER_EXIT" = "0"
! grep -q 'WI-498' /tmp/wi510-skip-registry-after.log
bash test-framework/evals/tier-1/validate-skill-receipt-shape.sh
node scripts/validate-completed-task-integrity.mjs --graph .svc/lane-tasks-WI-498.json --registry references/skip-conditions.json --json
node scripts/validate-completed-task-integrity.mjs --graph .svc/lane-tasks-WI-509.json --registry references/skip-conditions.json --json
node scripts/validate-completed-task-integrity.mjs --graph .svc/lane-tasks-WI-498.json --registry references/skip-conditions.json --registered-skills-only --json

# Protect historical replay authority:
git diff --exit-code 89806678a9d88a0eafa4784fba8a065ff367c0e0 -- .svc/lane-tasks-WI-498.json docs/specs/work-items/WI-498.md
test "$(sha256sum .svc/lane-tasks-WI-498.json | awk '{print $1}')" = "ae7df0ae2f4810f8e7f873bfc21dbd86a7ddadcebcc670dd48c4071fc8a01e21"
test "$(sha256sum docs/specs/work-items/WI-498.md | awk '{print $1}')" = "ba333366fc80e6a772ff72f5ae822d5d698ea740a1068f57e1b361f0e21a1841"
test "$(git notes --ref=svc-receipts show 85b5b965b28667e0b8f16501c50446cb9f3ca73b | sha256sum | awk '{print $1}')" = "2758c1c225294d1705e79e6bd70be57cc9d48addf4de1c20743dedae4fe92b05"
test "$(rg -F 'WI-498' .svc/pipeline-decisions.jsonl | sha256sum | awk '{print $1}')" = "9e5fd347a19aed89d8511b9a849570b38c23e40eb1ed2db5df9d245adccee4a4"
test "$(rg -F 'WI-498' .svc/session-contract.jsonl | sha256sum | awk '{print $1}')" = "022f34e524f7c51b218d127f1859269af8a8b7b73a20cff686dd7f2013c2d9a5"
test -z "$(find .svc -maxdepth 2 -type f | rg -i 'checkpoint.*498|498.*checkpoint' || true)"

# task-3 proves aggregate behavior while preserving the historical row until
# the promoted implementation itself has replayed successfully.
node -e 'const a=require("./.svc/main-green-allowlist.json");if(!a.known_red.some(x=>x.wi==="WI-498"))process.exit(1)'
bash test-framework/evals/run-all-evals.sh

# RECOVERY_IF_FAIL:
# Preserve the worktree, task graph, append-only decisions, and receipt notes.
# Correct the focused implementation in a new reviewed commit and rerun from
# the first failing command. Never edit WI-498 or advance a reconcile checkpoint
# by hand.

# Stage only exact authorized paths, including plan/review evidence:
git add \
  .svc/competitive-monitor-triggers.jsonl \
  .svc/lane-tasks-WI-510.json \
  .svc/pipeline-decisions.jsonl \
  .svc/review-cross-model-log.yaml \
  .svc/session-contract.jsonl \
  docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/manifest.md \
  docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/review-log.yaml \
  docs/specs/audit/wi-510-phase-receipt-skip-integrity-analysis.md \
  docs/specs/decisions/2026-07-23-wi-510-phase-receipt-skip-integrity/SOLUTION-CONFIDENCE.md \
  docs/specs/decisions/wi-510-phase-receipt-skip-integrity.md \
  docs/specs/explorations/wi-510-phase-receipt-skip-integrity/ANALYSIS.md \
  docs/specs/explorations/wi-510-phase-receipt-skip-integrity/COMPARISON.md \
  docs/specs/explorations/wi-510-phase-receipt-skip-integrity/DECISION.md \
  docs/specs/explorations/wi-510-phase-receipt-skip-integrity/PROBLEM_BRIEF.md \
  docs/specs/explorations/wi-510-phase-receipt-skip-integrity/SOLUTION_MAP.md \
  docs/specs/features/wi-510-phase-receipt-skip-integrity.md \
  docs/specs/reviews/wi-510-phase-receipt-skip-integrity-cross-model.md \
  docs/specs/reviews/wi-510-phase-receipt-skip-integrity-exec-cross-model.md \
  docs/specs/reviews/wi-510-phase-receipt-skip-integrity-exec-review-log.yaml \
  docs/specs/research-log.md \
  docs/specs/security/wi-510-phase-receipt-skip-integrity-review.md \
  docs/specs/tech/wi-510-phase-receipt-skip-integrity.md \
  proposals/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md \
  references/phase-receipts.md \
  scripts/lib/completed-task-integrity.mjs \
  scripts/validate-completed-task-integrity.mjs \
  test-framework/evals/tier-1/fixtures/phase-receipt-skip-integrity.json \
  test-framework/evals/tier-1/validate-lane-tasks-integrity.sh \
  test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh \
  test-framework/evals/tier-1/validate-skip-conditions-registry.sh
FROZEN_TREE=$(git write-tree)
diff -u \
  <(printf '%s\n' \
    .svc/competitive-monitor-triggers.jsonl \
    .svc/lane-tasks-WI-510.json \
    .svc/pipeline-decisions.jsonl \
    .svc/review-cross-model-log.yaml \
    .svc/session-contract.jsonl \
    docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/manifest.md \
    docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/review-log.yaml \
    docs/specs/audit/wi-510-phase-receipt-skip-integrity-analysis.md \
    docs/specs/decisions/2026-07-23-wi-510-phase-receipt-skip-integrity/SOLUTION-CONFIDENCE.md \
    docs/specs/decisions/wi-510-phase-receipt-skip-integrity.md \
    docs/specs/explorations/wi-510-phase-receipt-skip-integrity/ANALYSIS.md \
    docs/specs/explorations/wi-510-phase-receipt-skip-integrity/COMPARISON.md \
    docs/specs/explorations/wi-510-phase-receipt-skip-integrity/DECISION.md \
    docs/specs/explorations/wi-510-phase-receipt-skip-integrity/PROBLEM_BRIEF.md \
    docs/specs/explorations/wi-510-phase-receipt-skip-integrity/SOLUTION_MAP.md \
    docs/specs/features/wi-510-phase-receipt-skip-integrity.md \
    docs/specs/reviews/wi-510-phase-receipt-skip-integrity-cross-model.md \
    docs/specs/reviews/wi-510-phase-receipt-skip-integrity-exec-cross-model.md \
    docs/specs/reviews/wi-510-phase-receipt-skip-integrity-exec-review-log.yaml \
    docs/specs/research-log.md \
    docs/specs/security/wi-510-phase-receipt-skip-integrity-review.md \
    docs/specs/tech/wi-510-phase-receipt-skip-integrity.md \
    proposals/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md \
    references/phase-receipts.md \
    scripts/lib/completed-task-integrity.mjs \
    scripts/validate-completed-task-integrity.mjs \
    test-framework/evals/tier-1/fixtures/phase-receipt-skip-integrity.json \
    test-framework/evals/tier-1/validate-lane-tasks-integrity.sh \
    test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh \
    test-framework/evals/tier-1/validate-skip-conditions-registry.sh | sort) \
  <(git diff --name-only --no-renames "$BASE_SHA" "$FROZEN_TREE" | sort) ||
  { echo 'frozen-tree path mismatch'; exit 1; }

# Outer tasks 9-14 run before this freeze and produce the listed tracked review
# artifacts plus ignored canonical receipt bodies. Freeze and verify the exact
# staged tree they reviewed. All four tracked review/security/audit documents
# are mandatory even when findings are empty. They name BASE_SHA/branch only and
# MUST NOT embed FROZEN_DIFF_HASH; that value exists only in the ignored
# review-exec body and, after emission, the consolidated Git note.
test "$FROZEN_TREE" = "$(git write-tree)"
FROZEN_DIFF_HASH=$(git -c diff.noprefix=false -c diff.renames=false diff \
  --binary --no-ext-diff --no-textconv "$BASE_SHA" "$FROZEN_TREE" |
  sha256sum | awk '{print $1}')
for BODY in \
  .svc/receipt-bodies/plan-manifest.json \
  .svc/receipt-bodies/review-plan.json \
  .svc/receipt-bodies/exec-record.json \
  .svc/receipt-bodies/review-exec.json \
  .svc/receipt-bodies/audit-implementation.json
do
  test -s "$BODY"
done
BODY_DIFF_HASH=$(node -e 'process.stdout.write(require("./.svc/receipt-bodies/review-exec.json").diff_hash)')
test "$BODY_DIFF_HASH" = "$FROZEN_DIFF_HASH"

git commit -m "Make skip integrity phase-receipt aware" -m "Co-Authored-By: Codex CLI <contact-b6b620a2d4@example.invalid>"
FINAL_BRANCH_SHA=$(git rev-parse HEAD)

# The commit must be exactly the reviewed staged tree. Emit every canonical
# receipt body onto that SHA; emit-receipt adds the commit tree binding for
# exec-record/review-exec and writes only ignored mirrors plus Git notes.
test "$(git rev-parse "$FINAL_BRANCH_SHA^{tree}")" = "$FROZEN_TREE"
node scripts/emit-receipt.mjs --type plan-manifest --wi WI-510 --sha "$FINAL_BRANCH_SHA" --body .svc/receipt-bodies/plan-manifest.json
node scripts/emit-receipt.mjs --type review-plan --wi WI-510 --sha "$FINAL_BRANCH_SHA" --body .svc/receipt-bodies/review-plan.json
node scripts/emit-receipt.mjs --type exec-record --wi WI-510 --sha "$FINAL_BRANCH_SHA" --body .svc/receipt-bodies/exec-record.json
node scripts/emit-receipt.mjs --type review-exec --wi WI-510 --sha "$FINAL_BRANCH_SHA" --body .svc/receipt-bodies/review-exec.json
node scripts/emit-receipt.mjs --type audit-implementation --wi WI-510 --sha "$FINAL_BRANCH_SHA" --body .svc/receipt-bodies/audit-implementation.json
node scripts/check-chain-receipts.mjs --sha "$FINAL_BRANCH_SHA"
test "$(git rev-parse HEAD)" = "$FINAL_BRANCH_SHA"
test -z "$(git status --porcelain)"

# LAND:
git fetch origin main
test "$(git rev-parse origin/main)" = "$BASE_SHA"
test "$(git merge-base "$FINAL_BRANCH_SHA" "$BASE_SHA")" = "$BASE_SHA"
git push -u origin framework-WI-510-phase-receipt-skip-integrity
PR_NUMBER=$(gh pr list --head framework-WI-510-phase-receipt-skip-integrity --state open --json number --jq '.[0].number // empty')
if test -z "$PR_NUMBER"; then
  PR_URL=$(gh pr create --base main --head framework-WI-510-phase-receipt-skip-integrity --title "Make skip integrity phase-receipt aware" --body "Implements WI-510 through the full reviewed framework chain.")
  PR_NUMBER=$(printf '%s\n' "$PR_URL" | awk -F/ '{print $NF}')
fi
test "$(gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid')" = "$FINAL_BRANCH_SHA"
node scripts/merge-pr-with-review-receipt.mjs --pr "$PR_NUMBER" --squash --delete-branch
PROMOTED_SHA=$(gh pr view "$PR_NUMBER" --json mergeCommit --jq '.mergeCommit.oid')
test -n "$PROMOTED_SHA"

# POST-MERGE ON PROMOTED MAIN:
cd /workspace/seriousvibecoding
git fetch origin main
test "$(git rev-parse origin/main)" = "$PROMOTED_SHA"
node -e 'const a=require("./.svc/main-green-allowlist.json");if(!a.known_red.some(x=>x.wi==="WI-498"))process.exit(1)'
node scripts/validate-completed-task-integrity.mjs --graph .svc/lane-tasks-WI-498.json --registry references/skip-conditions.json --json
node scripts/validate-completed-task-integrity.mjs --graph .svc/lane-tasks-WI-509.json --registry references/skip-conditions.json --json
bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh
bash test-framework/evals/run-all-evals.sh
node scripts/svc-reconcile.mjs
test -s .svc/receipt-bodies/verify-promotion.json
node scripts/emit-receipt.mjs --type verify-promotion --wi WI-510 --sha "$PROMOTED_SHA" --body .svc/receipt-bodies/verify-promotion.json
node scripts/check-chain-receipts.mjs --sha "$PROMOTED_SHA"
test "$(sha256sum .svc/lane-tasks-WI-498.json | awk '{print $1}')" = "ae7df0ae2f4810f8e7f873bfc21dbd86a7ddadcebcc670dd48c4071fc8a01e21"
test "$(git notes --ref=svc-receipts show 85b5b965b28667e0b8f16501c50446cb9f3ca73b | sha256sum | awk '{print $1}')" = "2758c1c225294d1705e79e6bd70be57cc9d48addf4de1c20743dedae4fe92b05"

# GOVERNANCE-ONLY CLOSEOUT PR:
# After land-changeset releases the implementation worktree/binding, create the
# same-WI closeout worktree from the proven promoted SHA. Outer tasks 15/16 and
# resumed task 1 are completed here with their real phase evidence.
node scripts/svc-ensure-worktree.mjs --wi WI-510 --branch framework-WI-510-phase-receipt-skip-integrity-closeout --from origin/main --json --print-cd
cd /workspace/seriousvibecoding/.worktrees/framework-WI-510-phase-receipt-skip-integrity-closeout
test "$(git rev-parse HEAD)" = "$PROMOTED_SHA"
# Use apply_patch to remove exactly the WI-498 object from known_red now that
# promoted focused/full replay is proven; do not rewrite any other entry.
node -e 'const a=require("./.svc/main-green-allowlist.json");if(a.known_red.some(x=>x.wi==="WI-498"))process.exit(1)'
bash test-framework/evals/run-all-evals.sh
git add \
  .svc/lane-tasks-WI-510.json \
  .svc/main-green-allowlist.json \
  .svc/pipeline-decisions.jsonl \
  FRAMEWORK-STATE.md \
  docs/specs/features/wi-510-phase-receipt-skip-integrity.md \
  docs/specs/work-items/INDEX.md \
  docs/specs/work-items/WI-510.md \
  proposals/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md \
  proposals/done/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md \
  references/knowledge/svc/CAPABILITIES.md
diff -u \
  <(printf '%s\n' \
    .svc/lane-tasks-WI-510.json \
    .svc/main-green-allowlist.json \
    .svc/pipeline-decisions.jsonl \
    FRAMEWORK-STATE.md \
    docs/specs/features/wi-510-phase-receipt-skip-integrity.md \
    docs/specs/work-items/INDEX.md \
    docs/specs/work-items/WI-510.md \
    proposals/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md \
    proposals/done/2026-07-23-framework-improvement-phase-receipt-skip-integrity.md \
    references/knowledge/svc/CAPABILITIES.md | sort) \
  <(git diff --cached --name-only --no-renames | sort) ||
  { echo 'closeout staged-path mismatch'; exit 1; }
git commit -m "Record WI-510 promoted verification" -m "Co-Authored-By: Codex CLI <contact-b6b620a2d4@example.invalid>"
CLOSEOUT_SHA=$(git rev-parse HEAD)
git push -u origin framework-WI-510-phase-receipt-skip-integrity-closeout
CLOSEOUT_PR=$(gh pr create --base main --head framework-WI-510-phase-receipt-skip-integrity-closeout --title "Record WI-510 promoted verification" --body "Persists truthful land, verify-promotion, and improve-framework completion after the implementation squash passed promoted replay.")
test "$(gh pr view "$CLOSEOUT_PR" --json headRefOid --jq '.headRefOid')" = "$CLOSEOUT_SHA"
node scripts/merge-pr-with-review-receipt.mjs --pr "$CLOSEOUT_PR" --squash --delete-branch
FINAL_MAIN_SHA=$(gh pr view "$CLOSEOUT_PR" --json mergeCommit --jq '.mergeCommit.oid')
cd /workspace/seriousvibecoding
git fetch origin main
test "$(git rev-parse origin/main)" = "$FINAL_MAIN_SHA"
bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh
bash test-framework/evals/run-all-evals.sh
node scripts/svc-reconcile.mjs
```

If `origin/main` no longer equals `BASE_SHA` before the implementation PR
merges, stop without pushing a merge. Integrate the new main into the WI branch,
rerun focused/full validation and every final-tree review, freeze a new tree/SHA,
and update the PR only with a normal non-rewriting push. The old receipts remain
attached to the old candidate and do not authorize the new one.

## Checkpoint Plan

| Checkpoint | Contents | Rollback anchor |
|---|---|---|
| `wi510-plan-reviewed` | baselined spec/design/manifest plus independent plan review and plan receipts | corrective planning commit before execution |
| `wi510-mutation-red` | fixture matrix and observed failing focused test | task-1 parent; no production semantics changed |
| `wi510-integrity-engine` | shared library/CLI and three green consumers | revert engine and consumers together |
| `wi510-doctrine-green` | doctrine/AC evidence and aggregate green while the historical row remains unchanged | revert entire WI changeset; do not restore history by mutation |
| `wi510-promoted-proof` | final-branch reviews, exact-head PR/squash, promoted verify receipt, main replay, reconcile | normal reviewed revert of promoted squash |

No rollback rewrites commits, graphs, notes, checkpoints, bindings, or audit
history.

## Simulation Report

| Task | Check | Result | Action |
| task-1 | focused fixture matrix target absent | PASS (CREATE) | create one scenario corpus |
| task-1 | focused validator target absent | PASS (CREATE) | create executable shell runner |
| task-2 | classifier library and CLI targets absent | PASS (CREATE) | add dependency-free ESM files |
| task-2 | both overlapping shell validators exist | PASS (MODIFY) | replace only their completed-task predicates |
| task-2 | skip registry, Phase-D spec, WI-498, and WI-509 inputs exist | PASS | use real authority paths |
| task-2 | Tier-1 runner enumerates every shell/module validator | PASS | no runner edit required |
| task-3 | Phase-D reference exists | PASS (MODIFY) | targeted doctrine update |
| task-5 | WI-498 known-red row exists exactly once before promoted replay | PASS | remove only after promoted proof and rerun full Tier-1 |
| task-4 | canonical worktree and authoritative 16-task mandatory lane graph validate | PASS | inner five-task graph separates implementation promotion from truthful governance closeout |
| all | Node, Bash, Git, jq, and framework scripts are present | PASS | no dependency installation |

No simulation warning or failure remains.

Interface and coupling preflight additionally proves: `--body`,
`--squash/--delete-branch`, the already-tracked WI-510 authority document,
full-Tier-1 independence from the main-green allowlist, and the canary's
green-before-allowlist ordering.

## Scenario Coverage

| Scenario | Given / When / Then boundary | Task(s) | Coverage |
|---|---|---|---|
| current executed receipt | no skip intent; strict phases and evidence | task-1, task-2 | complete |
| authorized completed skip | strict receipt plus matching registered delivery authorization | task-1, task-2 | complete |
| receipt but no authorization | skip intent with receipt only | task-1, task-2 | mutation-red |
| authorization but no receipt | delivery/task skip state without receipt | task-1, task-2 | mutation-red |
| empty/dangling evidence | invalid artifacts or unsafe reference | task-1, task-2 | mutation-red |
| malformed phases | invalid array, phase ID, timestamp, artifact, or path | task-1, task-2 | mutation-red |
| prose-only skip | task reason without delivery authority | task-1, task-2 | mutation-red |
| unregistered condition | delivery entry not bound to registry skill | task-1, task-2 | mutation-red |
| supported/unsupported history | Git-proven pre-cutoff task/receipt snapshot versus editable backdating/untracked/malformed/post-cutoff insertion | task-1, task-2 | positive + mutation-red |
| registered-skills filter | unregistered skill omitted without weakening selected-task checks | task-1, task-2 | positive |
| promoted WI-498 | unchanged real graph tasks 5/6 | task-2, task-3, task-4 | branch + main replay |
| current WI-509 | current strict graph | task-2, task-4 | branch + main replay |

## Adversarial Self-Check

1. **Missing tasks:** none; every PSR AC and system scenario maps to an
   implementation and proof task.
2. **Dependency correctness:** task-1 defines expectations, task-2 supplies the
   CLI, task-3 locks doctrine and aggregate proof, task-4 freezes and promotes
   an exact branch SHA, and task-5 persists the actual land/verify completion
   after promoted replay.
3. **Scope reduction:** none; all 22 ACs and every required mutation are present.
4. **Validation strength:** state transitions use positive and mutation-red
   behavioral assertions plus original promoted replay and aggregate Tier-1.
5. **First-task viability:** task-1 needs only the tracked spec/design,
   registry, actual graphs, and manifest.
6. **Pattern completeness:** strict receipt shape covers phase arrays, every row,
   required IDs, artifact types, and path variants; skip lookup covers missing,
   wrong-skill, duplicate, and unregistered entries.
7. **Visual tier:** N/A, no visual surface.
8. **UI mock parity:** N/A, no browser-visible modification.
9. **Provider fidelity:** Product/provider fidelity is N/A; the external review
   provider is an explicit governance dependency with launcher-owned receipts.
10. **Persona trace:** N/A, system-only enabler.

## Review Convergence Record

Round 1 used the canonical pinned `gpt-5.6-sol/high` reviewer and scored 4/10.
All six findings were accepted with the following concrete revisions:

| Finding | Decision | Revision |
|---|---|---|
| F-001 final-SHA lifecycle circular | ACCEPT | Separate planning, implementation, frozen final-branch, promoted-squash, and verify-promotion receipt stages; post-merge truth is not claimed inside the squash |
| F-002 broad/incomplete staging | ACCEPT | Exact file pathspecs plus fail-closed staged-path equality |
| F-003 expected red accepts any failure | ACCEPT | Require exit 2 and exact `classifier-unavailable` token |
| F-004 inline contract underspecified | ACCEPT | Freeze exports, inputs/results, precedence, reason codes, CLI flags/output, and exits |
| F-005 lane compliance unproved | ACCEPT | Distinguish the inner changeset graph from the authoritative 16-task graph and enumerate every outer skill/status/evidence requirement |
| F-006 external provider/network omitted | ACCEPT | Declare review provider, remote Git, authentication, hard-failure receipts, and retry boundaries in External State |

The durable response detail is in
`docs/plans/2026-07-23-wi510-phase-receipt-skip-integrity/review-log.yaml`.
Because the plan is infra-path and round 1 scored below 5, the mandatory
convergence cycle continued through its three-round hard cap.

Round 2 scored 5/10 and produced six more findings. All were accepted:

| Finding | Decision | Revision |
|---|---|---|
| F-001 final SHA still not mechanically bound | ACCEPT | Freeze the exact staged tree and diff hash after tracked reviews; require review-exec body equality; commit that tree; emit all canonical bodies onto the equal commit tree |
| F-002 mandatory outputs unlisted | ACCEPT | Add exact cross-model, exec-review, security, and audit report paths to scope and staging equality |
| F-003 absolute-path policy conflicts with producers | ACCEPT | Permit normalized OS-temp `file`/`command_output` references, reject other absolute/type combinations, and test actual review-plan shapes |
| F-004 registry membership does not prove applicability | ACCEPT, SOURCE-CORRECTED | Require substantive applicability fields from the actual registry schema plus non-empty delivery evidence; the later source check rejected the initially proposed non-existent delivery `applicability` object |
| F-005 contract read error exit contradiction | ACCEPT | Graph-resolved skill-contract failures are invalid task results/exit 1; exit 2 is top-level invocation/input only |
| F-006 duplicate/unclear artifact ownership | ACCEPT | Deduplicate proposal ownership and freeze all other pre-plan artifacts as read-only execution inputs |

Round 3 scored 5/10 and produced four findings. All were accepted and resolved
within the three-round hard cap:

| Finding | Decision | Revision |
|---|---|---|
| F-001 tracked graph could not truthfully complete land/verify inside the implementation squash | ACCEPT | Split the lifecycle into the reviewed implementation PR and a same-WI governance-only closeout PR after promoted replay; task-5 persists actual task 15/16 and wrapper completion evidence |
| F-002 mandatory review/landing operations were prose placeholders | ACCEPT | Add exact task activation/postcondition rows, exact-head PR assertions, merge commands, promoted receipt emission, and closeout PR commands |
| F-003 WI-498 preservation proof was too narrow | ACCEPT | Pin graph, work-item, historical note, WI-498-only JSONL records, and checkpoint-absence invariants before commit and after promotion |
| F-004 declared base was not mechanically enforced | ACCEPT | Assert branch ancestry from the exact base, hash the base-to-frozen-tree binary diff, reassert the base before landing, and require full re-review if main advances |

No Critical or High finding remains unresolved. No fourth reviewer round is
authorized or required by the bounded review protocol.

The subsequent high-risk pre-commit impact review returned a schema-invalid
provider payload, so that payload is not accepted as a review receipt. Its
source-grounded observations were independently checked against the named local
contracts and used as pre-execution corrections: Git-authoritative legacy
eligibility replaces editable timestamps; skip applicability uses the actual
delivery/registry schema; phase timestamps are strictly parsed; allowlist removal moves
after promoted replay; receipt/merge flags are preflighted; diff hashing is
configuration-pinned; consumer deltas are compared; and both commits use exact
staged-path equality. A fresh schema-valid Anthropic review is still required
for the impact-triad receipt.

A fresh schema-valid Anthropic review then scored the corrected package 6/10
and returned one High plus six lower findings. Its High was resolved with live
baseline proof: the pre-change registry validator has exactly one failure
containing only WI-498 tasks 5/6, the post-fix exit is pinned to 0, full Tier-1
does not read the allowlist, and the main-green canary exits on a fully green
suite before loading allowlist entries. The tracked WI-510 document was proven
to exist at `BASE_SHA`; tracked review documents are forbidden from embedding
the self-referential frozen diff hash; OS-temp evidence is explicitly
well-formedness-only; cutoff parity and registered-filter fixtures are required;
and all four tracked review outputs are mandatory even with zero findings.
A final schema-valid different-family pass must return PASS before the impact
receipt can authorize commit.

## Promotion Readiness Checklist

- [x] Archetype, invariants, subsystem map, and reversibility are explicit.
- [x] Every PSR criterion maps to a task and a test.
- [x] All CREATE/MODIFY targets match the disk/planned layers.
- [x] External-state taxonomy and lifecycle coupling are explicit.
- [x] No dependency, ORM, migration, UI, provider, customer database, or
      host-installation change exists.
- [x] Exact focused, overlap, aggregate, final-SHA, and promoted commands exist.
- [x] WI-498 protection and allowlist-removal ordering are explicit.
- [x] Mandatory lane graph contains plan, independent reviews, execution,
      audit, test, land, and verify tasks.
- [x] Inline exported symbols, reason codes, precedence, CLI schema, and exit
      codes are frozen.
- [x] Exact-path staging and staged-path equality prevent ambient residue.
- [x] Final branch SHA, promoted squash SHA, and post-merge receipt lifecycles
      are distinct.
- [x] Independent plan review completed at the three-round hard cap with no
      unresolved High/Critical finding.
- [ ] Implementation/reviews/audit/full Tier-1/final-SHA receipts pass.
- [ ] PR is squash-merged and promoted-main WI-498/WI-509/reconcile replay passes.
