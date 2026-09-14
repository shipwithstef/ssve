# Technical Design: WI-510 Phase-Receipt-Aware Skip Integrity

**Status:** BASELINED
**WI:** WI-510
**Governing spec:** `docs/specs/features/wi-510-phase-receipt-skip-integrity.md`
**Selected approach:** one dependency-free, task-local Node classifier with thin
validator consumers

## Architecture

Add `scripts/lib/completed-task-integrity.mjs` as the single interpretation
boundary for completed task state. It classifies a completed task as
`executed`, `authorized-skip`, `legacy-compatible`, or `invalid`, returning
stable reason codes and diagnostics. A small CLI,
`scripts/validate-completed-task-integrity.mjs`, reads a graph and registry and
emits JSON or human-readable findings.

The focused Tier-1 validator owns the mutation-red fixture matrix and unchanged
WI-498/WI-509 replay. The two overlapping shell validators invoke the same CLI
instead of retaining their own completion predicates. Existing delivery-graph
and Phase-D validators remain responsible for their broader whole-graph
contracts; WI-510 does not compose their unrelated failures into the task-local
verdict.

### Component map

| Component | Type | Responsibility | Change |
|---|---|---|---|
| `scripts/lib/completed-task-integrity.mjs` | Pure library | Strict task-local classification and stable reason codes | New |
| `scripts/validate-completed-task-integrity.mjs` | CLI adapter | Load graph/registry, select tasks, print diagnostics, set exit status | New |
| `validate-phase-receipt-skip-integrity.sh` | Tier-1 contract test | Run positive/mutation-red fixtures and promoted graph replays | New |
| `fixtures/phase-receipt-skip-integrity/*.json` | Test data | Hermetic current and legacy graph states | New directory |
| `validate-skip-conditions-registry.sh` | Thin consumer | Retain registry bidirectional checks; delegate completed registered-skill state | Modify |
| `validate-lane-tasks-integrity.sh` | Thin consumer | Retain duplicate/status checks; delegate completed skill state | Modify |
| `references/phase-receipts.md` | Normative contract | Document strict completed-task interpretation and evidence resolvability | Modify |
| `.svc/main-green-allowlist.json` | Main-green baseline | Remove only the obsolete WI-498 row after proof passes | Modify last |

No persisted application data, external API, UI, provider, database, cache, or
feature toggle is introduced.

## State machine

```text
completed task
     |
     +-- skip intent? (task skip_reason OR matching delivery skip)
     |       |
     |       +-- explicit matching delivery entry
     |       |   + registered/applicable condition
     |       |   + non-empty reason/evidence
     |       |   + non-empty task skip_reason
     |       |   + strict matching phase receipt
     |       |          |
     |       |          +-- yes --> AUTHORIZED-SKIP
     |       |
     |       +-- otherwise ------> INVALID
     |
     +-- no skip intent
             |
             +-- matching loaded receipt
             |   + not legacy-backfill
             |   + strict valid phases/evidence
             |          |
             |          +-- yes --> EXECUTED
             |
             +-- supported pre-enforcement receipt
             |   + valid base receipt
             |   + no malformed extension
             |          |
             |          +-- yes --> LEGACY-COMPATIBLE
             |
             +-- otherwise ------> INVALID
```

Classification order is security-significant: any skip intent selects the skip
branch first. A receipt attached to a skipped task cannot make it executed, and
delivery authorization without a valid receipt cannot make a completed task
evidence-backed.

## Data flow

```text
lane-tasks JSON + skip registry + repository root
                    |
                    v
        CLI validates input boundaries
                    |
                    v
      pure classifier evaluates each selected task
                    |
          +---------+----------+
          |                    |
          v                    v
 structured verdicts     stable diagnostics
          |                    |
          +---------+----------+
                    |
                    v
 focused / registry / lane-integrity consumers
                    |
                    v
             exit 0 or exit 1
```

The classifier performs no writes. Every result is recomputed from the supplied
graph, registry, and repository tree.

## Classification contract

### Common input checks

- The graph and registry must be objects; `tasks` must be an array.
- The selected task must be `completed` and have a non-empty canonical skill
  from `metadata.skill` or `skill`.
- Receipt skill must match the canonical task skill.
- `loaded_at` and `loaded_via` must be non-empty strings.
- `loaded_via: legacy-backfill` is never execution proof.

### Executed

An executed current task has no skip intent and has:

- a matching loaded receipt;
- a non-empty `phases_executed` array;
- phase IDs matching the canonical Phase-D pattern;
- valid ISO-8601 timestamps;
- a non-empty `evidence_artifacts` array on every phase;
- only `file`, `command_output`, `screenshot`, or `live_dom` artifact types;
- safe, non-empty repository-relative artifact paths or canonical OS-temporary
  references for `file`/`command_output`.

Required-phase completeness and comparison against the current skill
declaration remain owned by `validate-skill-receipt-shape.sh`. Repeating those
checks here would apply today's mutable skill contract to immutable historical
receipts and recreate false reds unrelated to skip integrity.

Evidence-reference resolvability means:

1. the type is canonical;
2. the path is a non-empty string;
3. a repository path is relative, normalized, remains under the repository
   root, and has no URI scheme, drive prefix, or control character;
4. an absolute path is accepted only when normalized under `os.tmpdir()` or a
   stable POSIX temporary root (`/tmp`, `/var/tmp`) and the type is `file` or
   `command_output`, matching current review-plan and execution receipt
   producers without making replay depend on the operator's current `TMPDIR`;
5. `screenshot` and `live_dom` always use repository-relative references;
6. the path contains no NUL byte.

Filesystem existence is not part of later replay because Phase-D
`command_output` and OS-temporary review files are intentionally
execution-local. Syntactic containment makes the reference resolvable without
claiming retained bytes. Durable content authenticity remains the responsibility
of tracked artifacts, final-SHA receipts, Git notes, and promotion verification.
The `executed` classification is therefore a well-formedness
verdict over a canonical execution receipt, not a cryptographic assertion that
execution-local bytes remain available. Expanding phase artifacts with sizes or
digests is a separate receipt-schema migration and remains out of WI-510.

### Authorized skip

Skip intent exists when the task has a `skip_reason` property (including null or
another malformed value) or
`delivery_graph.skipped_skills` has an entry for the task's skill. It passes
only when exactly one matching delivery skip:

- names the task skill;
- has a `skip_condition_id` registered for that skill;
- has non-empty `reason` and `evidence`;
- resolves to substantive canonical applicability metadata: registry-skill
  conditions require non-empty `skip_when` and `signals`; graph-level
  conditions require non-empty `applies_when` and `required_evidence`;
- accompanies a non-empty task `skip_reason`;
- requires normalized task and delivery reasons to match;
- accompanies the same strict matching current phase receipt required by the
  executed branch.

`<skill>:registry-skip` is valid only for the same registry skill. A registry
entry's explicit `skip_condition_id`, when present, is also valid only for that
entry's skill. Graph-level conditions do not authorize a task-level skill skip
unless the canonical delivery-graph contract explicitly maps them to it.

### Legacy-compatible

The only compatibility retained from `references/phase-receipts.md` is a
pre-enforcement tracked graph whose completed task has a valid matching base
receipt but no phase-extension key. The cutoff is the existing Phase-D
enforcement cutoff, `2026-05-10T16:00:00Z`. Eligibility is bound to the fixed
repository commit immediately before enforcement,
`060e3278afb26117034c4ed529a0e03da3869c32`: the graph's introducing commit must
be an ancestor of that anchor and task identity is read from the graph snapshot
at the anchor. Editable `graph.created` values, backdated Git commits, untracked
copies, tasks inserted into old graph paths, post-cutoff receipt changes, and
caller-supplied markers cannot establish legacy authority. Hermetic tests clone
the real anchored repository history, then mutate descendants and backdated
new commits to prove the boundary. Authority Git reads use
`--no-replace-objects`, `GIT_NO_REPLACE_OBJECTS=1`, and a sanitized repository
environment; a replacement-ref mutation fixture must remain red.

The focused validator also asserts that the library constant equals the
existing `PHASE_B_ENFORCE_AFTER` value in
`validate-skill-receipt-shape.sh` and the normative cutoff documented here.
This parity check prevents the compatibility boundary from drifting even
though portable Bash cannot import an ESM constant directly.

An explicit legacy marker does not rescue malformed receipt extensions,
`legacy-backfill`, a mismatched skill, unsafe evidence, or an otherwise
unsupported graph shape. No WI-specific condition is added.

### Invalid

Every unknown or incomplete current state fails closed. Results include stable
codes such as:

- `missing-skill-receipt`
- `task-skill-conflict`
- `receipt-skill-mismatch`
- `legacy-backfill-not-execution`
- `invalid-skip-reason`
- `missing-phases`
- `malformed-phases`
- `invalid-phase-id`
- `invalid-phase-timestamp`
- `empty-phase-evidence`
- `invalid-evidence-type`
- `unsafe-evidence-path`
- `skip-authorization-missing`
- `skip-authorization-ambiguous`
- `skip-condition-unregistered`
- `skip-condition-wrong-skill`
- `skip-condition-inapplicable`
- `skip-justification-missing`
- `skip-reason-mismatch`
- `unsupported-legacy-receipt`

## Consumer boundaries

The library exports pure functions and constants. The CLI supports:

```text
node scripts/validate-completed-task-integrity.mjs \
  --graph <lane-tasks.json> \
  --registry <skip-conditions.json> \
  [--task <id>] [--registered-skills-only] \
  [--structured-or-skip-only] \
  [--phase-free-compat strict|loaded|summary] [--json]
```

- `--registered-skills-only` lets the registry validator retain its historical
  scope.
- `--structured-or-skip-only` narrows a graph scan to structured phase/skip
  surfaces, malformed common receipt state, and phase-free receipts that lack
  the historical non-empty `output_artifact`/`validation_output` summary floor.
  It never grants a passing classification.
- `--phase-free-compat` selects one documented legacy consumer boundary:
  `strict` classifies all phase-free receipts, `loaded` preserves the lane
  validator's base-receipt scope, and `summary` preserves the registry
  validator's non-empty legacy summary scope. It changes selection only; an
  explicitly requested excluded task exits with usage failure.
- Without that flag, callers can explicitly check every completed task with a
  declared skill; the focused WI-498/WI-509 replays use this whole-graph mode.
- The two existing shell consumers delegate their registered structured/skip
  scope to that one classifier. The registry consumer retains its historical
  active/in-flight graph boundary; closed graphs remain covered by lane-task
  integrity and explicit replay. This avoids duplicate semantic preselection,
  preserves the legacy summary predicate, and does not introduce unrelated
  receipt-migration debt.
- Non-completed tasks are omitted during graph scans but fail with
  `not-completed` when explicitly requested; contradictory state remains covered
  by the lane-integrity validator.
- A nonzero exit means at least one selected task is `invalid` or an input could
  not be interpreted.
- Callers cannot supply legacy eligibility, a different cutoff, or a different
  enforcement anchor. The
  graph-level classifier derives compatibility from the exact graph file and
  rejects graph/path mismatches; the task-level classifier applies only the
  current contract.

## Alternatives and decisions

| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| Interpretation boundary | Pure task-local library + CLI | independent patches; whole-validator composition | One verdict without importing unrelated graph failures |
| Phase enforcement | Strict structural parser in the shared library; required-phase ownership stays in the Phase-D validator | accept any array; duplicate the current skill-contract gate | Current malformed receipts fail closed without applying mutable declarations twice |
| Evidence resolvability | Canonical type + contained repo-relative reference, or normalized OS-temp reference for `file`/`command_output` | permanent file existence; unrestricted absolute paths; path ignored | Matches actual Phase-D review producers while rejecting empty, escaping, and unrelated absolute references |
| Skip precedence | Any skip intent takes the authorization branch | receipt-first classification | Prevents receipts from laundering genuine skips |
| Legacy behavior | Existing pre-enforcement receipt compatibility only | new marker/allowlist/WI exception | Preserves documented history without widening it |

## Test strategy

The focused validator creates no repository state and runs fixtures through the
real CLI:

| Fixture | Expected |
|---|---|
| valid structured receipt, no skip intent | `executed` |
| valid structured receipt plus explicit authorized skip intent | `authorized-skip`, proving receipt and authorization are jointly required |
| receipt present, delivery authorization absent, skip intent present | fail |
| delivery authorization present, receipt absent, task skip reason present | fail |
| delivery authorization present but task skip reason absent | fail |
| task skip reason is non-string or differs from delivery reason | fail |
| empty evidence artifacts | fail |
| empty, escaping, non-temporary absolute, or type-incompatible temporary evidence reference | fail |
| canonical review `/tmp` file/command-output reference | valid reference; later existence is not required |
| malformed `phases_executed` | fail |
| prose-only skip claim | fail |
| unregistered skip condition | fail |
| supported pre-enforcement receipt | `legacy-compatible` |
| unsupported legacy-shaped graph | fail |
| WI-498 unchanged | pass, tasks 5 and 6 `executed` |
| current structured WI-509 graph | pass |

“Dangling” in the required mutation matrix means an empty, absolute, escaping,
or otherwise non-resolvable reference. It does not mean an intentionally
expired ignored command-output file.

Unit-like fixture assertions cover the pure contract; the three shell
validators cover integration and aggregate enumeration. Full Tier-1 covers
repository interaction.

## Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---:|---:|---:|---|---|
| Compute | bounded JSON parsing per graph; Git history only for a selected phase-free legacy candidate | tens of local graphs per Tier-1 run | $0 | linear in tasks and phase rows; legacy lookup is exceptional | local operator |
| Storage | fixture and source text only | under repository scale | $0 | constant after merge | repository |
| Bandwidth | none | 0 | $0 | none | N/A |
| External API | none | 0 | $0 | none | N/A |
| Background jobs | none | 0 | $0 | none | N/A |

Scaling trigger: profile if the focused classifier adds more than 10% to the
Tier-1 batch or graph counts reach the thousands. The implementation selects
candidate tasks before resolving Git legacy authority, so current structured
graphs and zero-result consumer scans do not spawn Git history commands. First
month and year one remain $0 because all work is local and dependency-free.
There is no paid tier or cost red line.

## Operations & Ownership

| Dimension | Answer |
|---|---|
| Owner | svc framework maintainers |
| On-call | no paging; framework-maintainer response |
| SLA / SLO | deterministic local gate; best effort, no availability SLA |
| Error budget | zero known false-green classifications; false-reds block governed work until fixed |
| Monitoring | focused validator, aggregate Tier-1, main-green parser, canonical reconcile |
| Alerting | command exit status and diagnostics; no external alerts |
| Dashboard | none |
| Runbook | rerun focused validator with `--json`, inspect reason code, then replay graph unchanged |
| Failure modes | fail-open predicate, false-red compatibility, parser drift, consumer drift |
| Recovery | revert the single changeset or repair classifier/fixture together; never rewrite graph history |
| Backup / restore | N/A, stateless; source and fixtures are Git-tracked |
| Dependency failure impact | malformed/unreadable local input fails closed |

## Feasibility matrix

| AC | Persona pressure | Feasible | Design proof |
|---|---|---|---|
| PSR-01 | N/A - system-only | Yes | strict executed branch |
| PSR-02 | N/A - system-only | Yes | execution branch does not require a delivery skip |
| PSR-03 | N/A - system-only | Yes | exact receipt/task skill binding |
| PSR-04 | N/A - system-only | Yes | strict array and phase-row checks |
| PSR-05 | N/A - system-only | Yes | non-empty artifact array per phase |
| PSR-06 | N/A - system-only | Yes | normalized repository or type-compatible OS-temp containment check |
| PSR-07 | N/A - system-only | Yes | explicit reference-safety and replay-retention boundary |
| PSR-08 | N/A - system-only | Yes | matching registry-backed delivery skip |
| PSR-09 | N/A - system-only | Yes | non-empty delivery reason and evidence |
| PSR-10 | N/A - system-only | Yes | non-empty string task reason with normalized equality to delivery reason |
| PSR-11 | N/A - system-only | Yes | skip intent fails without delivery authorization |
| PSR-12 | N/A - system-only | Yes | skill-bound registered condition with substantive applicability metadata and non-empty delivery evidence |
| PSR-13 | N/A - system-only | Yes | skip branch precedes receipt branch |
| PSR-14 | N/A - system-only | Yes | named existing pre-enforcement cutoff |
| PSR-15 | N/A - system-only | Yes | malformed/unsupported legacy state is invalid |
| PSR-16 | N/A - system-only | Yes | unchanged WI-498 replay in focused validator |
| PSR-17 | N/A - system-only | Yes | read-only replay; no historical target edits |
| PSR-18 | N/A - system-only | Yes | allowlist removal sequenced after proof |
| PSR-19 | N/A - system-only | Yes | focused positive and mutation-red fixtures |
| PSR-20 | N/A - system-only | Yes | both overlapping consumers call the CLI |
| PSR-21 | N/A - system-only | Yes | aggregate runner auto-enumerates focused shell validator |
| PSR-22 | N/A - system-only | Yes | full Tier-1 without the WI-498 baseline row |

All acceptance criteria are feasible without revising the governing spec.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Receipt parser drifts from the Phase-D shape contract | false red or false green | cutoff parity plus malformed ID, timestamp, artifact, and path fixtures |
| Skip entry is matched to the wrong skill | unauthorized skip passes | bind registry IDs to the registry skill, not a global ID set |
| Registered condition lacks canonical applicability metadata | unrelated or empty registry entry passes | require substantive skill or graph-level applicability fields plus delivery evidence |
| Delivery authorization is accepted without execution evidence | silent completed skip passes | require the same strict current phase receipt on the authorized-skip branch |
| Receipt-first ordering launders a skipped task | fail open | detect any skip intent before execution classification |
| Existing graphs rely on loose lane-integrity receipt check | new focused reds | run all tracked graphs before removing allowlist; distinguish scoped failures |
| Missing ignored evidence file is treated as malformed | broad false red | validate path resolvability, not persistent bytes; document boundary |
| Whole delivery graph has unrelated debt | WI-498 replay remains red | task-local classifier; whole-graph validator remains separate |
| New helper becomes a competing schema authority | future drift | normative doc names its scope; receipt-shape and delivery validators retain broader ownership |

## Adversarial design review

- `[Layer 1] [Confidence: 10/10]` Use Node standard library; no dependency is
  warranted for bounded JSON and canonical frontmatter parsing.
- `[Layer 1] [Confidence: 10/10]` One shared classifier removes the verified
  duplicated predicates in the two shell validators.
- `[Layer 3] [Confidence: 10/10]` Skip intent must be classified before receipt
  execution; this ordering closes the receipt-as-skip-bypass path.
- `[Layer 1] [Confidence: 9/10]` Keep delivery-graph and receipt-shape whole-file
  gates separate so an independent WI-498 delivery-graph issue does not alter a
  task-local completion verdict.
- `[Layer 1] [Confidence: 9/10]` Stable reason codes make mutation failures and
  operator diagnosis deterministic.
- `[Layer 3] [Confidence: 9/10]` Evidence resolvability is a reference-safety
  property here; durable byte authenticity remains a final-SHA concern.

No scope-reduction trigger fires: the design introduces three source/test
files plus fixture data and no classes or services.

## Reversibility

The implementation and governance closeout are Git-revertable reviewed
changesets. They do not migrate or rewrite history. The existing allowlist row
remains through implementation promotion and is removed only in closeout after
promoted replay succeeds; if closeout regresses, normal reviewed revert remains
available without inventing a hidden fallback.
