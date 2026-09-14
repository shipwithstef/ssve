# Leftover Disposition Closeout

Mutating, end-to-end, deploy-affecting, and framework-evolution work must not close with ambiguous worktree residue. A closeout is valid only when `git status --short --untracked-files=all` is clean, or every remaining path is covered by a leftover-disposition ledger and the ledger passes validation.

Run:

```bash
git status --short --untracked-files=all
node scripts/validate-leftover-disposition.mjs --ledger .svc/leftover-dispositions/<WI>.json
```

If the status command is clean, no ledger is required. If any path remains, the ledger must include one row per path with `path`, `status`, `reason`, and optional `follow_up`.

## Clean-Repo Requests Are Hard Gates

When the user explicitly asks for a clean repo, a leftover-disposition ledger is not sufficient. The active worktree must be made clean before closeout, or the final response must name the specific blocker that prevents cleaning.

Allowed fates for each residue path are:

- Commit and push it when it is intended source, spec, evidence, or task-graph state.
- Preserve it on a named branch or stash when it has possible value but does not belong in the active branch.
- Restore or delete it when it is generated, stale, or accidental local state.
- Add or confirm a gitignore rule when it is machine-local output and the path no longer appears in `git status`.

Do not leave untracked docs, specs, task ledgers, or generated `.svc` state sitting in the active worktree after a clean-repo request. If the path has unclear ownership, preserve it outside the active branch first, then return the requested worktree to clean.

## Tracked-Vs-Ignored Rule

`.gitignore` only prevents new untracked paths from entering `git status`; it does
not suppress a path already tracked by git. A dirty tracked path cannot be closed
as `gitignored`.

When a generated machine-local path is already tracked, remove it from the index
and commit that index removal:

```bash
git rm --cached .svc/loop-guard-state.json
printf '.svc/loop-guard-state.json\n' >> .gitignore  # only when missing
git add .gitignore
git commit -m "chore: stop tracking local loop guard state"
```

When a dirty tracked path is durable audit state, do the opposite: commit the
valid append or restore an accidental append. Do not add ignore rules to hide
tracked audit files such as `.svc/pipeline-decisions.jsonl` or
`docs/specs/research-log.md`.

Common classifications:

| Path family | Expected fate for clean-repo requests |
|---|---|
| `.svc/loop-guard-state.json` and similar generated guard/cache files | If tracked, `git rm --cached` and commit the index removal while keeping the path ignored; otherwise restore, delete, or gitignore. Do not commit rolling cache content unless the file is intentionally versioned framework state. |
| `.svc/pipeline-decisions.jsonl` | Commit valid route/decision/audit appends or restore accidental appends. Do not solve tracked decision-log changes with `.gitignore`. |
| `.svc/lane-tasks-*.json` and task-graph ledgers | Commit only with matching WI evidence; otherwise restore or preserve with an explicit follow-up owner. |
| `docs/logs/*.md` operation logs | Commit when they are authoritative run evidence; otherwise restore or preserve outside the active branch. |
| `docs/specs/research-log.md` | Commit valid research findings produced by a research/question run or restore accidental writes. |
| `docs/specs/**/*.md` untracked planning docs | Commit to the intended branch or preserve on a named branch/stash. Do not leave them merely untracked. |

## Ledger Format

Preferred JSON shape:

```json
{
  "schema_version": 1,
  "work_item": "WI-345",
  "git_status_command": "git status --short --untracked-files=all",
  "entries": [
    {
      "path": "docs/logs/base44-environment.md",
      "status": "local-evidence",
      "reason": "Operation log is local validation evidence for the current run.",
      "follow_up": ""
    }
  ]
}
```

Markdown tables are also accepted when the header includes `path`, `status`, `reason`, and optionally `follow_up`.

## Status Values

| Status | Meaning |
|---|---|
| `committed` | The path is staged or already covered by the commit being closed. Use only for intended source changes, not loose generated output. |
| `gitignored` | The path is intentionally transient and is ignored before closeout. A path still shown as untracked cannot claim this status. |
| `deleted` | The path was intentionally removed or is scheduled for removal. |
| `local-evidence` | The path is local validation evidence that should remain on the machine but not in repository history. |
| `deferred` | The path remains because follow-up work owns it. `follow_up` is required. |
| `user-owned` | The path predates the task or belongs to the user. Do not modify it without explicit instruction. |

## Closeout Wording

Final closeout must state whether leftovers remain. If they do, cite the validated ledger and summarize each disposition class. Do not summarize only tests, deploy, or screenshots while leaving residual paths unclassified.

Generated evidence should live under intentional directories such as `docs/specs/.../test-evidence/`, `.svc/visuals/`, or a WI-specific `.svc/leftover-dispositions/` path. Transient caches, local logs, and machine-only evidence should be gitignored by default.
