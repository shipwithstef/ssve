# Plan self-review — WI-FW-CROSS-REPO-ORCH-02

Date: 2026-09-18
Reviewer: PLAN agent (grok-4.6 xhigh)
Spec: docs/specs/features/wi-fw-cross-repo-orch-02.md
Fable round 1: `.svc/external-review-artifacts/WI-FW-CROSS-REPO-ORCH-02/fable-plan/run/findings.json` FAIL rubric 6, 3 HIGH

## Scope

Any onboarded svc project, not HoursHub-only. HoursHub remains the #66
regression example (AC-REG). Discovery uses `~/worktrees/<id>/` and
`~/app-workspaces/<id>-worktrees/` plus optional aliases.

## Fable HIGH closures

| ID | Closure |
|---|---|
| F-001 | T1 AFTER hunk is the real `withMigrateLock` + `existingMigrateBaton` skip path, not a comment. Validator asserts sequential skip, missing-receipt reconstruct, and concurrent one contract line. |
| F-002 | AC-ISO-1 check symlinks under `SVC_SKILLS_HOME/.cursor/skills` and `.grok/skills` and asserts `origin-orchestrate`. Lookalike cwd copy is not `origin-orchestrate`. Isolation reads `SVC_SKILLS_HOME`. |
| F-003 | Validator check names match the AC-to-Test table. JSON `V-ORCH-02.ac_ids` matches that table. No ghost tests. |

## Folded MEDIUM closures

| ID | Closure |
|---|---|
| F-004 | Project-only bind injects candidate WIs; migrate only on named WI or unique in_progress. Decision-trace row added. |
| F-005 | `resolveOriginHost` + `ORIGIN_HOSTS`; hook does not default host to cursor; validator asserts claude origin_host. |
| F-006 | JSON task_graph includes T7; T3/T6 files match markdown; T5 blocked_by includes T3; spec/WI/gap-brief are T7 copies (MODIFY INDEX/route-workflow/FRAMEWORK-STATE in T6). |
| F-007 | Execution sequence copies the packet + spec/WI/gap-brief from PLAN_WT into the new worktree and sha256-checks blueprints before CREATE copies. |
| F-008 | PROJECT_SUBJECT_RE before discoverProjects; per-process cache; 150ms budget; validator asserts long prompts do not scan. |

## Checks

| # | Check | Result |
|---|---|---|
| 1 | Owner never runs a CLI | AC-BIND-3 USER_CLI_HOMEWORK_RE |
| 2 | Isolation still denies mixed-repo Write | AC-ISO-2 |
| 3 | Default checkout refused | AC-BIND-2E validator throw |
| 4 | PLAN xhigh EXEC high | AC-DISPATCH-1/2 including result.effort |
| 5 | Hook does not spawn children | AC-BIND-6 source grep |
| 6 | Local setup is not land | AC-SETUP |
| 7 | Catalog + wirers | AC-CAT-1; T5 depends on T3 |
| 8 | Idempotent migrate | AC-BIND-5 lock + skip + concurrent |
| 9 | Scout not rubber-stamped | T1/T2 overwrite from blueprint hashes; adapter scout migrateSession block is replaced |
| 10 | Not HoursHub-only | AC-BIND-2 discovery; validator binds acme, ssve, hourshub |

## Residual

Scout files already occupy CREATE paths in this worktree (untracked). EXEC
overwrites them from `docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/`
byte hashes after copying the packet into `feature-wi-fw-cross-repo-orch-02`.
Simulation WARN, not FAIL.

No unresolved owner questions. Locked: user never told to run a command;
isolation denies mixed-repo Writes; default checkout refused; PLAN xhigh;
EXEC high; project-only does not mtime-pick a WI.
