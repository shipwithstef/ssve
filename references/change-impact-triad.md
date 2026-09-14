# Change Impact Triad

Every governed mutation answers three questions and binds those answers to the exact session, worktree, task, and diff. The receipt is evidence routing, not a substitute for the live spec, tests, review, or runtime proof.

## The three required fields

| Field | Required answer | Sources | Evidence |
|---|---|---|---|
| `breaks_what` | Changed paths and symbols, callers, mapped tests or journeys, and the observed result. A no-reference answer must cite the search that proved it. | Paths, symbols, tests, journeys | Search commands, test output, diff artifacts |
| `intended_behavior` | How the changed behavior must work. Missing authority creates a blocking source-repair task. | Spec, AC, journey, or explicit user decision | Exact source path plus verification command |
| `product_surface` | Persona, page, flow, API, or headless framework boundary affected by the change. | Persona/journey for visible work; cited N/A reason for headless work | Behavioral probe, mapped test, or cited structural proof |

Each field requires a non-empty answer, source list, and evidence list. “Looks safe,” file count, line count, and self-authored prose are not evidence.

## Deterministic risk floor

| Tier | Mechanical floor | Required proof |
|---|---|---|
| `high` | Auth, authz, RLS, policy, billing or money, schema or migration, shared layout/component, feature flag, host hook/task graph, release/signing/version configuration, binary ambiguity, or deletion/rename involving these surfaces | Behavioral/runtime proof now; exact binding to the one final different-family review task |
| `logic` | Executable logic, data transformation, caller/signature, control flow, or non-cosmetic configuration | Passing mapped test |
| `cosmetic` | Copy, comment, formatting, or documentation only, with no symbol/call-site/control-flow change | Static diff proof |

The classifier establishes a floor. Humans and plans may raise risk but never lower it. Renames and deletions inherit the higher risk of the old and new paths. Binary or generated ambiguity is high. No file-count or line-count downgrade exists.

## Coverage gaps are tasks

Missing mapped coverage creates a task with an owner, blockers, and validation command. `coverage_tasks` is always explicit and non-empty, even when it points at existing mapped coverage. A note, acknowledgement, backlog sentence, or empty entry cannot represent an unresolved gap. Any receipt containing a blocked coverage task is incomplete and the guard denies completion. High-task proof artifacts must resolve at the checkpoint boundary; the receipt binds the current plan digest and exactly one graph `review-exec` task. That final reviewer still independently assesses the frozen cumulative diff before landing.

Task-graph state is intentionally protected even for pure status flips. This supersedes the older exempt-closeout carve-out: a bound closeout commit uses the last completed task's exact receipt instead of silently bypassing the triad.

## Independent and runtime proof

- `cosmetic`: `runtime_proof.kind=static`, status pass.
- `logic`: `runtime_proof.kind=mapped-test`, status pass.
- `high`: `independent_review.status=pass`, reviewer family differs from executor family, and `runtime_proof.kind=behavioral`, status pass.
- Headless framework work uses a controlled payload or runtime fixture as behavioral proof. Deployment may be N/A, behavior may not.

## Subsumption

Rich lanes may emit one receipt that points to already completed phase artifacts:

- `diagnose-bug`: expected behavior, Pillar Revisit Audit, affected artifacts, proof of fix, and verify-promotion plan.
- feature/refactor execution: manifest AC mapping, affected-surface tests, review, and runtime evidence.

`subsumed_by` must name the phases and exact evidence paths. The three triad fields and identity binding remain mandatory; a phase name without artifacts does not subsume anything.

## Identity and lifecycle

The only valid path is `.svc/impact-triad/WI-N/task-N.json` in the bound worktree. The guard rejects symlinks, foreign owners, wrong WI/task/worktree/session, a stale diff hash, invalid schema shape, unresolved coverage, self-review, or insufficient tier proof. A receipt becomes stale whenever the staged diff, task, worktree, or session changes.

WI-484 binding supplies the exact worktree/session/WI identity. On Codex, WI-485 exact skill authority runs before the impact guard. The impact guard adds assurance evidence; it does not create a second Stop path or weaken either identity contract.
