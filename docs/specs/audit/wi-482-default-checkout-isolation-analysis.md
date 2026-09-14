# Systems Analysis: WI-482 Mandatory Default-Checkout Isolation

**Date:** 2026-07-14

**Branch:** `framework-WI-482-default-checkout-isolation`

**Spec:** `docs/specs/work-items/WI-482.md`

**Manifest:** `docs/plans/2026-07-14-wi482-default-checkout-isolation/manifest.md`

## Acceptance-Criteria Ledger

| AC | Required behavior | Evidence | Status |
|---|---|---|---|
| AC-482-1 | Deny default-checkout mutation for every repository surface | structured, shell-fs, absolute-target, cross-root, symlink, sed write/execute, and pre-commit fixtures | CONFIRMED |
| AC-482-2 | Create only clean, current `.worktrees/` checkouts | bare-origin fixture proves ignored path, clean including untracked, current `origin/main`, immutable-SHA boundary, and stale rejection | CONFIRMED |
| AC-482-3 | Preserve reads and approved external runtime temp | WI-485 read classifier, exact `node --check`, external temp, and symlink-back-into-repo fixtures | CONFIRMED |
| AC-482-4 | Report WI, path, branch, and owning session | delegated `worktree.sh status` contract and binding-backed status assertions | CONFIRMED |
| AC-482-5 | Idempotent create/resume/cleanup without host-link repointing | real create/resume fixture, binding conflict checks, lifecycle-bracketed symlink assertion, and no setup/wrapper recursion | CONFIRMED |

## Coverage Ledger

| Subsystem | Risk | Result |
|---|---|---|
| Pre-tool mutation classifier | Critical | target-aware, symlink-aware, fail-closed for repository writes |
| Universal pre-commit backstop | Critical | executable slot installed and roster-tested |
| Worktree ensure lifecycle | High | locked, clean/current, idempotent, rollback on binding failure |
| Cross-host wiring | High | Claude, Codex, Kimi, and Gemini pre-tool guard first; OpenCode has universal commit backstop |
| Router and user contracts | Medium | route-before-write, status identity, and list-work-items mutation boundary documented |

## Adversarial Hypotheses Tested

1. A bound worktree can target the default checkout with an absolute or parent-relative path. Confirmed before review; corrected and regression-fenced.
2. A tool outside git can target an absolute repository path. Confirmed before review; corrected by target-derived git context.
3. A lexical temp path can symlink into a repository. Falsified after real-parent resolution.
4. `sed` can masquerade as read-only while writing or executing. Confirmed twice; resolved by removing all sed forms from the allowlist.
5. A lifecycle helper can repoint installed host symlinks. Falsified across create/resume, plus static prohibition on setup/wrapper delegation.
6. A dropped executable bit can silently remove commit enforcement. Corrected by adding the slot to the canonical executable roster.

## Validation

- Focused isolation validator: 8/8.
- Session/worktree binding validator: 22/22.
- Codex integrity validator: 88/88.
- Cross-host hook conformance: 49/49.
- Manifest lint: PASS.
- Full Tier 1: 241 passed, 0 failed, 0 timed out.
- Claude Fable final frozen-diff verdict: APPROVE.

## Plan Deviations

- `.gitignore` now excludes `.svc/bindings/`, preventing binding runtime residue.
- A universal pre-commit slot was added because OpenCode has no supported pre-tool command hook.
- Two existing validators were made hermetic so installed host state and the active session binding cannot contaminate Tier 1.
- Review, audit, and security artifacts are mandatory-chain evidence and do not expand runtime behavior.

## Verdict

- [x] READY TO LAND — all five ACs are confirmed and no unresolved Critical, High, or Medium finding remains.
- [ ] BLOCKED
- [ ] CONDITIONAL
