# Systems Analysis: WI-511 Loop-State Lifecycle

**Date:** 2026-07-24
**Branch:** `framework-WI-511-quality-preserving-loop-state-pruning`
**Spec:** `docs/specs/work-items/WI-511.md`
**Mode:** full

## Headline

READY FOR FINAL TEST AND LANDING. Three read-only specialist lenses audited the
corrected staged implementation. Two confirmed High findings and three
test/spec coverage findings were fixed and independently re-audited. No
Critical, High, or Medium finding remains. The concern scanner reported no
registered concern match.

## Verification Contract

| AC | Required behavior | Evidence | Result |
|---|---|---|---|
| WI511-AC1 | A cadence-eligible call removes no more than the selected 32-file stale batch before current-state load and rotates later windows | helper batch loop; exact two-window fixture; source-order assertion | Confirmed |
| WI511-AC2 | Never remove the current invocation's state file | ancient current file remains; contended real-hook call persists one history row | Confirmed |
| WI511-AC3 | Preserve exact cutoff and newer files | cutoff and cutoff-plus-one-millisecond fixtures | Confirmed |
| WI511-AC4 | Preserve symlinks, directories, nonmatching names, and invalid lookalikes | selection fixture plus `.svc` directory-symlink escape fixture | Confirmed |
| WI511-AC5 | Enumeration, metadata, lock, and unlink failures cannot stop current enforcement | injected failure families and real held-lock hook execution | Confirmed |
| WI511-AC6 | Mutation-red focused coverage spans selection, boundary, concurrency, malformed state, failures, bound, and rotation | pre-change missing-helper red; focused 10/10 post-change | Confirmed |
| WI511-AC7 | Named and aggregate framework validators remain green | focused 10/10; loop guard 11/11; state-dir 29/29; loadability 33/33; final aggregate assigned to test-framework | Confirmed locally; aggregate final rerun pending |
| WI511-AC8 | Promoted main replays focused validation and reconcile with zero debt | promotion-only verification task | Pending by phase |

## Scope Drift

No unplanned tracked path was found. The implementation is one owner hook, one
internal helper, and one focused validator. Planning, review, audit, state, and
task-graph records are all listed in the manifest. The candidate, receipt,
reconcile, timestamp, payload-equality, and generic graph-path proposals remain
excluded.

## Coverage Ledger

| Subsystem | Risk | Specialist | Status | Findings |
|---|---|---|---|---|
| State-directory and deletion boundary | High | security | re-audited clean | F-SEC-001 fixed |
| Locking and current-call enforcement | High | security/testing | re-audited clean | none |
| Cadence and synchronous work bound | High | performance | re-audited clean | PERF-001 fixed; one Low scaling advisory |
| Mutation and boundary fixtures | High | testing | re-audited clean | TEST-001/002/003 fixed |
| Framework records and scope | Medium | orchestrator | clean | none |

## Hypotheses and Outcomes

| Hypothesis | Falsification | Outcome |
|---|---|---|
| A symlinked `.svc` can redirect unlink outside the repository | disposable external-victim reproduction, then corrected fixture | Confirmed before fix; resolved by final-component `lstat` refusal |
| Cleanup can block the PreToolUse path while processing a large stale backlog | helper-only 100/1,000 stale-file benchmarks | Confirmed before fix; resolved at required scale by 32-candidate rotating batch |
| A broader filename regex could delete producer-invalid lookalikes | stale empty-suffix, 49-character, and punctuation fixtures | Resolved; all preserved |
| Cleanup failure can cause the hook to exit zero without persisting current state | held sibling lock plus real hook and history assertion | Falsified after fix; current history persists |
| A batch-size or non-rotating mutation could survive focused tests | hardcoded size, first slice, second slice, and backlog counts | Falsified after fix |
| The hook could evaluate cadence before load but perform deletion afterward | actual prune-call source offset compared with load call | Falsified after fix |

## Findings and Dispositions

### F-SEC-001: Symlinked `.svc` directory escaped containment

**Severity:** High
**Confidence:** Confirmed
**Type:** Destructive filesystem safety
**Location:** `hooks/lib/loop-guard-state-lifecycle.mjs`

**Observed:** The initial helper followed a symlinked state directory and could
remove an external matching file.

**Fix:** Require the resolved final state-directory component to be a real,
non-symlink directory before enumeration. Add an external-victim fixture.

**Disposition:** Fixed and security re-audit PASS.

### PERF-001: Unbounded synchronous stale deletion exceeded the stop condition

**Severity:** High
**Confidence:** Confirmed
**Type:** Performance / hot-path blocking
**Location:** `hooks/lib/loop-guard-state-lifecycle.mjs`

**Observed:** The original helper removed all stale matches synchronously.
Specialist medians were 7.233 ms for 100 and 66.296 ms for 1,000 stale files.

**Fix:** Select a deterministic rotating batch of at most 32 regular candidate
names per cadence window. The corrected specialist medians were 2.883 ms for
100 and 3.507 ms for 1,000; metadata, lock, and unlink operations remain exactly
bounded and the backlog is preserved for later windows.

**Disposition:** Fixed and performance re-audit PASS.

### TEST-001 through TEST-003: Mutation and contract gaps

**Severity:** Medium, Medium, Low
**Confidence:** Confirmed
**Type:** Test falsifiability / spec alignment

**Observed:** Invalid lookalikes, exact batch rotation, and the real prune-call
ordering were not independently pinned; AC1 initially implied every stale file
must be removed in one pass.

**Fix:** Add hostile lookalikes, hardcode the 32-file contract and two exact
daily slices, assert backlog `100 → 68 → 36`, target the actual prune call in
the order assertion, and align AC1/AC6 with bounded rotation.

**Disposition:** Fixed and testing re-audit PASS.

## Residual Advisory

Directory enumeration and candidate sorting remain `O(N + C log C)`. The
performance lens measured a 16.877 ms median at an intentionally extreme
10,000 matching candidates while metadata/lock/unlink work stayed bounded.
This is Low severity at the evidenced operating scale and remains the documented
scaling trigger; it does not weaken cleanup safety or current loop enforcement.

## Pre/Post Evidence

- Pre-change: `.svc/execute-tests-red.log` records exit 1 with the exact
  `loop-guard lifecycle helper unavailable` reason.
- Post-change: focused validator passes 10/10 and existing loop guard passes
  11/11; named state-directory and hook-loadability validators pass 29/29 and
  33/33.
- Classification: fixed-by-change. Aggregate and promotion-only deltas remain
  assigned to their later governed phases and are not presented as completed
  here.

## Residue

No TODO, FIXME, TBD, temporary flag, orphan import, schema migration, network
dependency, database access, or tracked scratch file was introduced.

## Unverified Surfaces

- Full Tier-1 final-staged-tree result belongs to `test-framework`.
- Final-SHA receipt validation, PR merge, host-install coupling, and
  promoted-main replay belong to `land-changeset` / `verify-promotion`.

## Verdict

- [x] READY TO LAND AFTER FINAL TEST GATE — no unresolved Critical/High/Medium
  findings.

## Promotion-Closeout Addendum

The first promoted aggregate passed 273/274 and isolated the only failure to
the watcher-advance fixture's fixed historical checkpoint under a shared
100 ms child timeout. Shipped reconcile and loop-guard behavior were green.
The closeout changes only the fixture anchor to current `HEAD`, so its
GitHub-hang/watcher-preservation assertion does no unrelated receipt-range
work. `validate-chain-receipts-range-workers.sh` independently retains
synthetic 16-commit range, ordering, concurrency, timeout, spawn, and malformed
worker coverage.

Fresh Anthropic Opus 4.8/high G7 review returned `pass-with-findings` with no
Critical or High issue. Its Medium coverage concern was resolved by inspecting
the synthetic range fixture; its Low remote-ref and branch-length concerns
were fixed by the `HEAD` anchor. Focused reconcile/range validators and the
full Tier-1 aggregate pass 274/274 after correction.
- [ ] BLOCKED
- [ ] CONDITIONAL
