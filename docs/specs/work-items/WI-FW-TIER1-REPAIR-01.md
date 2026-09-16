# WI-FW-TIER1-REPAIR-01: Repair four Tier-1 failures observed during open-source preparation

**Type:** bugfix
**Status:** in-progress
**Severity:** high
**Filed:** 2026-09-16
**Source:** owner-authorized parallel Cursor work
**Lane:** framework
**Related:** WI-FW-OSS-READINESS-01

## Goal

Repair four Tier-1 failures observed during open-source preparation. Independent Cursor controller; actual implementation authorized.

## Affected Files

- `test-framework/evals/tier-1/validate-no-svc-residue.sh`
- `test-framework/evals/tier-1/validate-framework-docs-audit.sh`
- `test-framework/evals/tier-1/validate-codex-first-task-activation.sh`
- `test-framework/evals/tier-1/validate-runtime-root-portability.sh`
- `test-framework/evals/tier-1/lib/fixture-home.sh`
- `scripts/codex-load-skill.mjs`
- `hooks/lib/svc-runtime-root.mjs`
- `hooks/codex/lib/codex-hook-context.mjs`
- `scripts/audit-framework-docs.mjs`
- `FRAMEWORK-STATE.md`
- `docs/specs/work-items/WI-FW-TIER1-REPAIR-01.md`

## Affected Specs

- `docs/specs/work-items/WI-FW-TIER1-REPAIR-01.md`

## Constraints

No sibling worktree edits or main checkout mutation. Source ownership is limited to this file list; shared runtime output stays in the owned worktree. Keep SSVE private and hosted CI inactive. Root integrates worker results sequentially. Read the explicit worker handoff for proof obligations and scope exclusions.

## Reproduction

Reproduced 2026-09-16 on HEAD `355f3c9279e609110da08c553bb4fd8a19766807` via official fixture-home isolation. Sibling privacy candidate is a separate 14-file staged sanitization; these four checks failed on this main-identical tree.

| Check | Expected | Actual | Domain |
|---|---|---|---|
| validate-no-svc-residue.sh | no uncovered `.svc/` residue | `?? .svc/lane-tasks-WI-FW-TIER1-REPAIR-01.json` | bookkeeping |
| validate-framework-docs-audit.sh | live docs links resolve | broken `FRAMEWORK-STATE-ARCHIVE/closed-gaps.md` | docs claim |
| validate-codex-first-task-activation.sh | production unresolved-authority deny + byte-identical graph/receipt | ALLOW then mutation | fixture isolation |
| validate-runtime-root-portability.sh | unsafe mode 755 throws | missing expected exception | environment fixture |

## Root cause

1. Launch-created durable task graph was left untracked. Staging it is the correct disposition; the validator stays strict.
2. `FRAMEWORK-STATE.md` claimed a committed archive file that is gitignored and absent. Honest live-file wording; no private archive recreation.
3. Deny preflight used `new_consumer()` which writes claim-v1 authority. `NODE_ENV=production` then correctly treats that as resolved authority. Unbound consumer restores the deny case. Production deny path unchanged.
4. Host `umask 0077` makes Node `mkdirSync({mode:0o755})` create `0700`. chmod after create makes the unsafe fixture real. Production still denies actual 755 roots.

**Risk Flags:** none
**Register Discoveries:** single correction cluster — no INDEX decomposition.
**Pattern Scan:** same-class `mkdirSync(..., { mode: 0o755 })` without chmod is the one unsafe-leaf fixture; `FRAMEWORK-STATE-ARCHIVE/closed-gaps.md` was the only concrete archive filename the auditor matches.
