# Systems Analysis: WI-502 durable authority

**Date:** 2026-07-20
**Branch:** `framework-WI-502-durable-authority`
**Spec:** `docs/specs/features/wi-502-durable-authority.md`
**Mode:** full

## Scope Drift

The union of staged, tracked, and non-ignored new paths equals `docs/specs/test-evidence/WI-502/declared-file-set.txt`. The pipeline decision index contains the base ledger plus exactly the WI-502 decision; unrelated auto-drive appends remain unstaged. Post-review audit and security reports are justified additions to the declared review evidence.

## Verification Contract

| AC | Verified | Evidence |
|---|---|---|
| OS-01 | yes | operation-scope result keeps session and operation repositories separately |
| OS-02 | yes | trusted adapter field, session-relative resolution, realpath fixtures |
| OS-03 | yes | missing, empty, file, and dangling workdir negatives |
| OS-04 | yes | exact worktree/common-dir identity fixtures |
| OS-05 | yes | non-Git cwd with governed target fixture |
| OS-06 | yes | patch update/add/delete/move source/destination fixture |
| OS-07 | yes | multi-path Edit/Write extraction fixture |
| OS-08 | yes | mixed repo/worktree, nested Git, symlink, and Git/non-Git denial |
| OS-09 | yes | sanctioned structured command operand and trusted identity checks |
| OS-10 | yes | Codex enforcer and universal isolation guard consume shared result |
| SB-01 | yes | cd, pushd, git-C, compound mutation, and redirection negatives |
| SB-02 | yes | result explicitly reports incomplete containment |
| SB-03 | yes | eight host manifests validate; supported mutation fails closed |
| SB-04 | yes | doctrine/worktree/host docs state the guardrail boundary |
| AU-01 | yes | stable host-session-agent digest; label-only negatives |
| AU-02 | yes | canonical common-Git digest separate from worktree |
| AU-03 | yes | schema-v2 lease and CAS revision fixture |
| AU-04 | yes | same principal resumes without generation change |
| AU-05 | yes | one-time CAS handover increments generation and freezes children |
| AU-06 | yes | live owner denies; proven death/expiry recovery increments generation |
| AU-07 | yes | behavioral public `--authority-v2` migration, backup, and rollback receipt |
| DG-01 | yes | versioned nested graph with waves under one execution stage |
| DG-02 | yes | standalone inner Git worktree plus scoped capability |
| DG-03 | yes | persisted parent lease/delegation edge; no relationship inference |
| DG-04 | yes | disjoint waves, overlap/shared/unknown serialization |
| DG-05 | yes | principal/generation/worktree/path/task/receipt checks, including Bash redirection |
| DG-06 | yes | inherited denies and mechanically bounded nested scope |
| DG-07 | yes | exact commit/file/diff/validation/cleanliness completion receipt |
| DG-08 | yes | sequential fetch/cherry-pick, commit-list binding, mapping, controller validation |
| DG-09 | yes | completed-unmerged freezes; merged stays terminal; adoption reissues generation |
| DG-10 | yes | two-process duplicate issuance has exactly one winner; worker terminal transitions are wired |

## Coverage Ledger

| Subsystem | Risk | Status | Findings |
|---|---|---|---|
| Canonical operation scope | Critical | verified | structured CLI and relative shell gaps fixed |
| Controller lease/handover | Critical | verified | stale-lock inode recheck fixed |
| Delegation/dispatch | Critical | verified | duplicate issue and nested widening fixed |
| Completion/merge | High | verified | terminal merged state, commit binding, controller validation |
| Host containment | Critical | verified | Landlock escape denial and contained Git commit pass |
| Compatibility/docs | Medium | verified | host matrices and boundary claims aligned |

## Hypotheses Tested

1. Two controllers could issue the same leaf concurrently. Confirmed pre-fix in 5/5 specialist reproductions; fixed with graph-transition locking and a two-process exactly-one-winner assertion.
2. A child could write `README.md` through relative redirection despite `src/**`. Confirmed by code trace; fixed by positive relative target extraction and delegated scope checking.
3. A nested child could widen `src/*.js` into `src/private/**` or drop parent denies. Confirmed; fixed with conservative glob-subset rules and mandatory deny inheritance.
4. A contained linked worktree could not commit because Git metadata lived outside Landlock. Confirmed; dispatch now creates a no-hardlink standalone inner Git worktree, and contained commit behavior passes.
5. A repeated merge could corrupt terminal state. Confirmed in Fable round 3; fixed with terminal `merged` mapping and exact repeat diagnostic.

## Findings Convergence

No Critical or High finding remains. Three Medium operational follow-ups remain bounded:

- Add a dedicated Linux/Landlock promotion job so behavioral containment proof cannot be skipped on every release runner.
- Expand process-level v2 contention coverage beyond duplicate dispatch to simultaneous renew/handover/recovery stress.
- Optimize Git identity reuse for very large patch target sets; correctness is cached per exact target today, but hot-path subprocess count can still grow with target count.

The concern scanner's database, DNS, consent, paid-API, and PII matches came from documentation/example tokens with no changed runtime surface. `auth-surface` and `cryptography-touch` were genuinely applicable and are satisfied by `docs/specs/security/wi-502-durable-authority-review.md`.

## Pre/Post Evidence

Pre-change focused validators emitted their unique `WI502-RED` markers. Post-change operation-scope, lease/handover, delegated execution, shell containment, session authority/binding, Codex integrity, and parallel dispatch gates pass. Repository-wide Tier 1 reports 258 passing scripts and two failures reproduced on the base checkout: stale session-contract evidence and missing historical WI-498 task receipts. They are not introduced by WI-502.

## Residue and Unverified Surfaces

No new dependency, secret, TODO/FIXME, browser surface, native surface, or deploy target exists. Arbitrary interpreter-contained shell semantics are intentionally not proven by hooks; Landlock is the filesystem boundary. The two baseline Tier-1 state failures remain outside this WI and are not represented as green.

## Verdict

- [x] READY TO LAND — no unresolved Critical/High finding.
- [ ] BLOCKED
- [ ] CONDITIONAL
