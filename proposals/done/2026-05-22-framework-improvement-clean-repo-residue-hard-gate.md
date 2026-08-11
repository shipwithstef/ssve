# Framework Improvement: clean-repo residue hard gate

**Status: IMPLEMENTED** - all changes applied and verified in this session.

## Evidence

- **Source:** Example Marketplace recovery closeout on 2026-05-22.
- **Finding:** The recovery branch was published, but the active worktree still showed generated `.svc` state, task ledgers/log edits, and untracked planning docs. The existing leftover-disposition guard could classify residue, but the user explicitly wanted the repo clean, which needs a stronger fate decision: commit, preserve elsewhere, restore/delete, or gitignore.
- **Severity:** high - dirty leftovers after recovery make later sessions guess whether files are valuable, generated, stale, or accidental.

## Diagnosis

- **Root cause:** WI-345 introduced a general leftover-disposition ledger, but it did not distinguish ordinary closeout from an explicit clean-repo request. Ledger-only closeout is acceptable for known local evidence, but it does not satisfy a user request to return the active worktree to clean.
- **Category:** route-workflow / closeout hygiene / artifact lifecycle.
- **Already in FRAMEWORK-STATE.md?** Partially. WI-345 covered classification, not the hard clean gate.

## Implementation

- `references/leftover-disposition.md` now defines clean-repo requests as hard gates and lists expected fates for generated `.svc` state, task ledgers, operation logs, and untracked planning docs.
- `route-workflow/SKILL.md` now has a universal local residue closeout rule before final handled/complete/clean responses.
- `references/knowledge/svc/CAPABILITIES.md` now describes the clean-repo variant of the leftover-disposition capability.
- `FRAMEWORK-STATE.md` records the hard-gate addendum.
- `test-framework/evals/tier-1/validate-leftover-disposition-closeout.sh` now checks the new contract text and common residue families.

## Replay Verification

- `bash test-framework/evals/tier-1/validate-leftover-disposition-closeout.sh` - PASS, 14 checks, 0 failures.
- `node --check scripts/validate-leftover-disposition.mjs` - PASS.
- `git diff --check` on changed files - PASS.

## Rollback

Revert the route-workflow/reference/capability/state/test edits from this proposal. The prior WI-345 ledger behavior remains intact.
