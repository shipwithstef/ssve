# Framework Improvement: Tracked Residue Disposition

**Status:** IMPLEMENTED
**Date:** 2026-05-22
**Source:** Example Marketplace clean-repo closeout showed dirty tracked residue after a
final clean claim: `.svc/loop-guard-state.json`,
`.svc/pipeline-decisions.jsonl`, and `docs/specs/research-log.md`.

## Gap

The leftover-disposition doctrine covered generated cache and durable artifacts,
but it did not explicitly block the common false fix: adding or confirming a
`.gitignore` entry for a path that is already tracked by git. That leaves
rolling local cache dirty forever and makes a clean-repo claim unstable.

## Acceptance Criteria

- Generated tracked cache such as `.svc/loop-guard-state.json` is removed from
  the index and ignored instead of committed as rolling state.
- Durable tracked artifacts such as `.svc/pipeline-decisions.jsonl` and
  `docs/specs/research-log.md` are committed when valid or restored when
  accidental.
- The leftover-disposition validator rejects `gitignored` for any path still
  present in `git status`.
- Route-workflow requires the final status check after any route/research/log
  writes and after branch or PR closeout.

## Implemented Files

- `references/leftover-disposition.md`
- `route-workflow/SKILL.md`
- `scripts/validate-leftover-disposition.mjs`
- `test-framework/evals/tier-1/validate-leftover-disposition-closeout.sh`
- `FRAMEWORK-STATE.md`
- `references/knowledge/svc/CAPABILITIES.md`

## Verification

Run:

```bash
bash test-framework/evals/tier-1/validate-leftover-disposition-closeout.sh
```
