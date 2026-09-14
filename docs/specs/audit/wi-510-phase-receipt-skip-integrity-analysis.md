# Systems Analysis: WI-510 phase-receipt skip integrity

**Date:** 2026-07-23  
**Branch:** `framework-WI-510-phase-receipt-skip-integrity`  
**Base:** `89806678a9d88a0eafa4784fba8a065ff367c0e0`  
**Mode:** full  
**Spec:** `docs/specs/features/wi-510-phase-receipt-skip-integrity.md`

## Headline

READY TO LAND after the remaining mandatory test-framework and landing gates. The implementation satisfies PSR-01 through PSR-22 at the implementation stage, has no unresolved Critical/High/Medium/Low audit finding, and preserves the protected WI-498 graph, work item, and receipt note byte-for-byte.

Concern coverage produced keyword/path matches. Applicable synchronous-I/O,
feature-closeout, hermetic-fixture, and supply-chain concerns are covered by the
lazy bounded legacy resolver, this mandatory chain, isolated temporary Git
fixtures, and the zero-dependency review. Deploy, OAuth, PII, provider, social,
i18n, browser-E2E, denormalization, and production-logging matches are lexical
false positives with no corresponding runtime surface. The security review
independently covers the integrity/authorization boundary and reports PASS.

## Verification contract

| AC | Required behavior | Implementation evidence | Status |
|---|---|---|---|
| PSR-01 | Valid matching Phase-D receipt is executed | `validateCurrentPhases` plus `valid-current-execution` fixture | Confirmed |
| PSR-02 | Execution needs no delivery skip | execution branch is reached with no skip intent; WI-498 replay | Confirmed |
| PSR-03 | Receipt skill mismatch denies | `validateCommonReceipt`; mismatch mutation | Confirmed |
| PSR-04 | Malformed phase array denies | missing/non-array/entry-shape mutations | Confirmed |
| PSR-05 | Empty artifact list denies | `empty-phase-evidence`; dedicated mutation | Confirmed |
| PSR-06 | Unsafe or type-incompatible paths deny | repository containment and temporary-type matrix | Confirmed |
| PSR-07 | Resolvability is canonical reference shape, not byte retention | shared path predicate and Phase-D doctrine | Confirmed |
| PSR-08 | Skip requires delivery authorization and registration | skip-intent-first branch and valid authorized-skip fixture | Confirmed |
| PSR-09 | Delivery reason/evidence are non-empty | empty reason/evidence mutations | Confirmed |
| PSR-10 | Task reason matches delivery reason and strict receipt | normalized equality plus receipt validation | Confirmed |
| PSR-11 | Prose-only skip claim denies | missing-authorization and prose-only mutations | Confirmed |
| PSR-12 | Unregistered/wrong/inapplicable conditions deny | `resolveSkipCondition` and three mutation families | Confirmed |
| PSR-13 | Receipt alone cannot authorize a skip | skip intent is evaluated before executed classification | Confirmed |
| PSR-14 | Legacy authority is Git-derived and exact | fixed pre-enforcement anchor, hardened Git reads, introduction ancestry, anchor snapshot, typed task/skill/receipt equality | Confirmed |
| PSR-15 | Unsupported/backdated/untracked/malformed legacy denies | temporary Git mutation suite | Confirmed |
| PSR-16 | WI-498 passes unchanged | real replay: 5/5 completed tasks valid | Confirmed |
| PSR-17 | WI-498 history remains untouched | exact diff and three pinned hashes pass | Confirmed |
| PSR-18 | Allowlist stays until promoted proof | row remains present in implementation worktree; removal reserved for closeout | Confirmed at implementation stage |
| PSR-19 | Focused mutation matrix covers named paths | 42 current, 10 legacy, 10 selection/filter, 2 real replays | Confirmed |
| PSR-20 | Overlapping validators share interpretation | both shell consumers invoke the canonical CLI | Confirmed |
| PSR-21 | Focused validator joins aggregate enumeration | executable Tier-1 shell path and prior full-suite 273/273 proof | Confirmed |
| PSR-22 | Full Tier-1 is green without classifying WI-498 red | final task-14 suite 273/273 with 0 failures and 0 timeouts | Confirmed locally; promotion pending |

## Scope drift

The implementation and planned governance files match the manifest. Three tracked evidence paths are not named as standalone rows but are justified outputs of required gates:

- `.svc/review-cross-model-log.yaml` is the durable cross-model launcher log required by task 10.
- `docs/specs/reviews/wi-510-phase-receipt-skip-integrity-exec-review-log.yaml` is the iteration/convergence log required by review-exec.
- `.svc/competitive-monitor-triggers.jsonl` is an append-only framework event produced by the full Tier-1 run; preserving it follows the repository's audit-history rule.

None changes product behavior or expands WI-510 scope. The security and audit reports are explicitly planned. The later allowlist/state closeout paths remain untouched until promoted-main proof.

## Coverage ledger

| Subsystem | Entrypoints | Risk | AC coverage | Result |
|---|---|---:|---|---|
| Current receipt classification | `classifyCompletedTaskInternal`, `validateCurrentPhases` | High | PSR-01–07 | Confirmed |
| Skip authorization | `resolveSkipCondition`, skip-intent branch | High | PSR-08–13 | Confirmed |
| Legacy compatibility | `resolveLegacyAuthority`, exact snapshot match | High | PSR-14–18 | Confirmed |
| CLI selection/diagnostics | `validate-completed-task-integrity.mjs` | Medium | PSR-19–20 | Confirmed |
| Focused mutation harness | `validate-phase-receipt-skip-integrity.sh` | High | PSR-03–19 | Confirmed |
| Registry/lane consumers | two delegated Tier-1 validators | High | PSR-20–22 | Confirmed |
| Doctrine/protected evidence | `references/phase-receipts.md`, WI-498 pins | High | PSR-07, 14, 17–18 | Confirmed |

## Hypotheses and traces

### H1: a phase array can launder an unauthorized skip

**Falsified.** Skip intent is derived before executed classification. Missing, duplicate, wrong-skill, unregistered, or inapplicable delivery authorization adds a failure reason even when the receipt is otherwise valid. The task and delivery reasons must also match.

### H2: editable graph timestamps can manufacture legacy authority

**Falsified.** Compatibility requires the graph-introduction commit to be an
ancestor of fixed anchor `060e3278afb26117034c4ed529a0e03da3869c32` and
reads the graph snapshot at that anchor. Hardened Git reads ignore replacement
objects, repository/object/index/namespace overrides, inherited `GIT_CONFIG_*`
entries, and system/global Git configuration. The parsed graph must equal the
exact on-disk graph, and the historical task must match current typed ID,
completed state, skill, and receipt.

### H3: a consumer can select zero tasks and report a misleading success

**Falsified for explicit selection.** Unknown and filtered requested task IDs exit as CLI usage errors. Whole-graph consumer filters may intentionally check zero applicable tasks, and both consumers surface the checked count rather than claiming a task passed.

### H4: evidence paths create a traversal or filesystem-read primitive

**Falsified.** The validator validates reference shape only and never opens an evidence artifact. Repository-relative traversal, empty references, URI/drive prefixes, control characters, and non-temporary absolute paths deny. Normalized current OS-temporary references and stable POSIX `/tmp`/`/var/tmp` `file`/`command_output` references remain valid across later `TMPDIR` changes.

### H5: the fixture suite can leak or depend on ambient state

**Falsified.** Temporary directories are created under the OS temp root and removed on process exit. Legacy Git fixtures initialize isolated repositories with local identity configuration, and no network or wall-clock sleep assertion is used.

## Pre/post acceptance delta

The exact pre-change focused validator exited `2` with `classifier-unavailable`. The original registry consumer exited `1` with exactly the WI-498 task 5/6 false red, while lane integrity was already green. This is classified **fixed-by-change**, not baseline debt.

Post-change, the same selected surfaces report:

- Focused validator: PASS — 42 current, 10 legacy, 10 selection/filter, 2 real replays, under both default and alternate `TMPDIR`.
- Skip-conditions registry: PASS — 20/20 assertions.
- Lane-task integrity: PASS — 41/41 graphs.
- Alternate-`TMPDIR` real consumers: PASS — 20/20 and 41/41.
- WI-498 replay: PASS — 5/5 completed tasks, including tasks 5 and 6 as executed.
- WI-509 replay: PASS — 13/13 current structured completions.
- Final task-14 aggregate Tier-1: PASS — 273/273, 0 failures, 0 timeouts,
  using the runner's supported bounded-concurrency and timeout overrides to
  avoid unrelated machine saturation.

The full aggregate is intentionally rerun again by task 14 and again from promoted main. No allowlist entry is used by `run-all-evals.sh`, and the WI-498 row has not been removed or expanded during implementation.

## Specialist convergence

The completed G5 and cross-family review cycles found and closed earlier authorization, legacy provenance, selector, timestamp, and fixture gaps. The audit's read-only testing, security, and maintainability/performance specialists then blocked the first audit verdict and produced the following confirmed corrections:

- closed High: synthetic `/tmp` portability did not preserve real historical receipt replay under another `TMPDIR`;
- closed High: timestamp-only legacy authority allowed backdated descendant commits;
- closed High: ordinary Git history honored replacement refs that could reinterpret the fixed anchor;
- closed Medium: URI/drive and absolute-temporary control-character evidence ambiguity;
- closed Medium: missing cutoff/identity/consumer regression locks;
- closed Medium: eager Git history fan-out and per-scenario repository cloning exceeded the Tier-1 cost target;
- closed Low: normalized reason equality lacked a positive boundary.

The corrected paths pass default/alternate-temporary-root replay, replacement-object mutation, exact-anchor identity mutations, and the optimized focused suite. Final read-only testing, security/correctness, and maintainability/performance rechecks all returned PASS with no remaining finding. No specialist had mutation authority.

The final different-family Claude Opus execution review likewise returned 0
Critical, 0 High, and 0 Medium findings. Its inherited-Git-configuration Low
finding is fixed; its leading-colon evidence and WI-181 real-canary observations
are documented design/test choices rather than authorization defects.

## Findings

No unresolved implementation finding. The three High, four Medium, and two Low
findings above are closed or explicitly dispositioned by code, mutation-red,
portability, timing, and independent-review evidence.

## Residue

- Changed implementation/test files contain no `TODO`, `FIXME`, `HACK`, or temporary feature flag.
- New runtime dependencies: 0.
- New database/network/customer-data surface: 0.
- Scratch directories are scoped to the focused harness and removed on exit; earlier WI-510 `/tmp` residue is removed during closeout only after evidence is no longer needed.
- Unrelated worktrees and repository residue remain untouched.

## Unverified surfaces

- PR push, squash merge, promoted-main replay, and allowlist removal are downstream gates and are not claimed by this audit.
- Git-note chain completeness awaits the audit receipt and final branch SHA.
- No production runtime exists for this repository-local validator.

## Self-verify

| # | Check | Result |
|---|---|
| 1 | Analysis report exists | PASS |
| 2 | Every AC has a verification row | PASS — 22/22 |
| 3 | No unresolved Critical finding | PASS — 0 |
| 4 | Verdict section present | PASS |
| 5 | Pre/post acceptance delta classified | PASS — fixed-by-change |
| 6 | Protected WI-498 surfaces verified | PASS |

## Verdict

- [x] READY TO LAND — no Critical or High findings; continue through test-framework and governed landing.
- [ ] BLOCKED
- [ ] CONDITIONAL
