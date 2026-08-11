# SVC skills package layout implementation audit

**Work item:** WI-530
**Mode:** full
**Base:** `4d7543f6a8008a90cb3c841961125214c4aea2cb`
**Verdict:** PASS for implementation; landing and canonical-main installation remain pending

## Outcome

All 103 first-party skills are packaged beneath `skills/` while installed host
surfaces remain flat. Source, installed, consumer-local, and root eval-harness
namespaces are separate. Existing preserved worktrees can recover exact
same-session branch drift without duplicate creation or a manual recovery lease.

## Acceptance-criteria verification

| AC | Evidence | Result |
|---|---|---|
| AC-530-1 | layout validator enumerates all 103 manifest skills under `skills/<name>/SKILL.md` | PASS |
| AC-530-2 | root skill scan and Git move set show no first-party root `SKILL.md` directory or alias | PASS |
| AC-530-3 | setup and drift validators retain flat host targets | PASS |
| AC-530-4 | centralized source resolver plus updated setup, hooks, scripts, launchers, and evals | PASS |
| AC-530-5 | manifest lint and frontmatter/chain validators preserve identities and ordering | PASS |
| AC-530-6 | maintained framework docs use packaged paths; historical evidence is not bulk-rewritten | PASS |
| AC-530-7 | focused suites pass; full Tier-1 remains at 285 pass / same 18 baseline fail / 0 timeout | PASS |
| AC-530-8 | Sol and configured AGY review converge to zero unresolved Critical/High | PASS locally; post-merge install pending |
| AC-530-9 | moved skill-local helper families resolve the repository from their new depth | PASS |
| AC-530-10 | symlink/path escapes, duplicate manifest names, and equal-count set mismatches fail before setup mutation | PASS |
| AC-530-11 | consumer `.agents/skills` supplies context only and cannot replace central enforcement executables | PASS |
| AC-530-12 | unique registered branch at a preserved `.worktrees` path is adopted in place | PASS |
| AC-530-13 | same-session claim and every validated generation-lineage binding converge without HEAD, byte, or generation drift | PASS |
| AC-530-14 | Codex canonical dispatcher requests v2 promotion and hook convergence keeps one governed dispatcher | PASS |
| AC-530-15 | repeated, interrupted, pre-intent, partial-lineage, rollback, duplicate, ambiguous, and containment fixtures | PASS |
| AC-530-16 | reconcile consumer-routing fixture proves read-only help, explicit operation repo, and central helper provenance | PASS |
| AC-530-17 | pre-commit boundary mutation proves validate-only in worktrees and live setup only from canonical main | PASS |

## Behavior and preservation

- The source move does not add `skills/svc/`, root compatibility aliases, or a
  host-visible wrapper directory.
- `test-framework/` remains root infrastructure; only its skill contract moved.
- No product code, database, provider, environment, or deployment was changed.
- Foreign live owners, ambiguous identities, multiple registrations, paths
  outside `.worktrees`, and insecure state roots remain fail-closed.
- An exact older v2 controller resumes without fabricated migration evidence.
- Durable intent precedes new controller migration; exact retry reconstructs a
  missing receipt; rollback restores v1 bytes and the exact prior v2 state.
- Branch repair rechecks the entire transfer lineage on every same-session
  resume, closing the multi-file interruption window.
- Central reconcile no longer executes a possibly stale consumer-local receipt
  checker or auto-drive executable, and its help path exits before any
  repository or checkpoint action.
- A live read-through against `/home/svc-user/app-workspaces/example-marketplace`
  reported five real `ALL - no note or mirror found` debts with no receipt
  validation infrastructure failure, proving the former
  `exit-output-mismatch` was removed without fabricating historical evidence.
- Worktree pre-commit now validates the candidate for all provisioned hosts
  without attempting to install an unmerged layout from canonical main or
  pointing hosts at a disposable worktree. Its tracked slot is relative, so it
  resolves to the hook in the active checkout instead of a developer-specific
  absolute canonical-main path.

## Review convergence

Three bounded review rounds converted every Critical/High concern into an
executable regression. The final cap-round partial-write finding was fixed and
confirmed by a targeted read-only Sol replay; no fourth broad adversarial round
was used. The configured AGY reviewer ran as Gemini 3.6 Flash High with no
fallback and returned PASS at rubric 10.

## Residual obligations

1. Commit and emit the mandatory final-SHA plan, review-plan, exec, review-exec,
   and audit receipts.
2. Push, open a PR, and merge only through the governed wrapper.
3. From canonical main, run setup and drift checks for every provisioned host,
   then verify the installed Codex dispatcher and original Example Marketplace recovery path.
