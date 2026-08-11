# WI-487 Changeset: Durable installed enforcement source

- **Spec (source of truth):** `docs/specs/features/wi-487-durable-install-enforcement.md` (BASELINED; AC-487-1..12)
- **Architecture decisions:** `docs/specs/decisions/wi-487-durable-install-enforcement.md` (D-1..D-12)
- **Proposal (design source):** `proposals/2026-07-15-framework-improvement-durable-install-source.md`
- **Work item:** `docs/specs/work-items/WI-487.md`
- **Branch:** `framework-WI-487-durable-install`
- **Worktree:** `.worktrees/framework-WI-487-durable-install`
- **Owner session:** `337044a1-701f-40c8-8930-b03f561c448e`
- **Lane:** framework
- **Delivery tier:** FULL
- **Archetype:** install-lifecycle integrity + fail-closed enforcement via a NON-symlinked durable launcher + actionable-denial diagnostic across every blocking hook + all-host migration
- **Planning mode:** invariant + reversibility analysis before task decomposition
- **Execution mode:** inline
- **Planning reasoning:** high
- **Execution reasoning:** medium
- **Depends on:** WI-486 compatibility contract (`hooks/lib/task-state-compatibility.mjs` + `scripts/svc-migrate-task-state.mjs`) — MERGED; present in this worktree; delegation target for AC-487-11
- **Created:** 2026-07-17
- **Revised:** 2026-07-17 (round-1 gpt-5.6-sol plan review — F-001..F-012 resolved); 2026-07-17 (round-2 gpt-5.6-sol plan review — F-013..F-020 resolved; 0 Critical, round-1 architecture confirmed)

## Single-Source Reference Anchors

Every downstream section references these anchors and never restates their values.

| Anchor | Symbol | Single canonical value | Defined once in |
|---|---|---|---|
| Immutable declared base | `$BASE` | `835e365a1ee2b408bcfbb8eae49500d8f0270f4b` (current `origin/main`, WI-486 promotion) | §A Immutable base |
| Tier-1 baseline env-red set at `$BASE` | `ENV_RED_SET` | `{ validate-agy-launcher.sh, validate-codex-execution-integrity.sh }` (the named set of environment-precondition failures; see §A) | §A Immutable base |
| Baseline provenance triple | `BASELINE_PROVENANCE` | 246 passed / 2 failed / 0 timed out at `$BASE` (INFORMATIONAL provenance only — the acceptance predicate is `ENV_RED_SET`, not the counts) | §A Immutable base |
| Durable-source predicate | classification | `durable-canonical \| ephemeral \| worktree-bound \| dangling` (spec §Durable-source classification output) | spec |
| Durable enforcement launcher | `$LAUNCHER` | `~/.svc/enforcement/<migration_version>/bin/svc-enforce` — a COPIED (non-symlinked) real file materialized by setup/migration; every governed hook runs THROUGH it | §Enforcement launcher |
| State-root resolver | resolver | the single `resolveStateRoot()` (HOME-anchored, explicit HOME-missing behavior) every Bash/Node consumer calls — its ONE implementation lives in the canonical enforcement-core; receipts are evidence-only | spec §State-root resolver |
| Denial identity digest | `denialStateDigest` | one exported canonical-JSON digest over enforcement-relevant state only (§Denial identity); its ONE implementation lives in the canonical enforcement-core, re-exported by `hook-denial.mjs` | spec |
| Canonical enforcement-core | enforcement-core | hooks/lib/enforcement-core.mjs — the ONE implementation of `resolveStateRoot` + `denialStateDigest` + receipt validation + atomic denial write; setup MATERIALIZES a byte/hash-verified copy under `~/.svc/enforcement/<migration_version>/lib/` that the installed launcher imports (never the live checkout) | §Enforcement launcher / D-10,D-11 |
| Env-red baseline cause map | `env-red-baseline.json` | docs/specs/test-evidence/WI-487/env-red-baseline.json — validator_id → {cause_class, digest} captured at `$BASE`; passed to the parser, exact-match required (§A / F-019) | §A Immutable base |
| Retry key | `retry_key` | `{ migration_version, host_id, pre_state_digest }`, ceiling N=3 (§D-8) | decisions D-8 |
| WI-486 delegation | contract | `classifyTaskState` + `svc-migrate-task-state.mjs --wi <n> --authorization <file>` — NO self graph write | §A / AC-487-11 |
| Staged file set | `declared-file-set.txt` | docs/specs/test-evidence/WI-487/declared-file-set.txt (generated task-1, asserted task-6a) | §Declared File Set |
| Blocking-hook inventory | `blocking-hook-inventory.json` | docs/specs/test-evidence/WI-487/blocking-hook-inventory.json — STRUCTURED rows `{hook_id, repo_path, installed_command, disposition}` (generated task-1 from hooks.json + provision/hosts + codex hooks); the derived normalized sorted repo-path list docs/specs/test-evidence/WI-487/blocking-hook-repo-paths.txt is what staging/hashing consume; asserted by the denial validator + `check-blocking-hook-inventory.mjs` (F-017) | §F-002 completeness |

### A. Immutable base and baseline acceptance predicate (stated once)

`$BASE = 835e365a1ee2b408bcfbb8eae49500d8f0270f4b` — the current promoted `origin/main` (WI-486 promotion). It is a **pinned SHA**, never resolved from the mutable `origin/main` ref at runtime for freeze/hash/comparison. (The pre-stage freshness gate in §Execution Command Sequence is the ONE place `origin/main` is compared to `$BASE`, and if it advanced the base is RE-DECLARED through the sanctioned rebase path BEFORE staging — see F-007.)

**The authoritative baseline is a NAMED SET of failed validator IDs plus their environmental-precondition classification, not a numeric triple (F-006).** At `$BASE`, `run-all-evals.sh --tier1` returns a nonzero exit because exactly two validators fail for ENVIRONMENT reasons, not code defects, and neither is in WI-487's declared file set:

`ENV_RED_SET`:
1. `validate-agy-launcher.sh` — requires a live Fable canary / network; the hermetic env has neither. Classification: **network/live-canary env-red**.
2. `validate-codex-execution-integrity.sh` — asserts the local `~/.codex` hooks feature-flag is enabled and current PreToolUse-limit docs state; both are host-machine state, not repo content. Classification: **host-machine-state env-red**.

`BASELINE_PROVENANCE` (246/2/0) is recorded ONLY as provenance in docs/specs/test-evidence/WI-487/pre-change-tier1-baseline.md; the totals shift the moment the two new validators register or an env-red recovers, so counts are never the acceptance predicate.

**Baseline acceptance predicate (used verbatim by §Execution Command Sequence Step 1 and the promoted verify):**

1. Capture the suite exit code EXPLICITLY with `if/else` (never under `set -e` directly — the suite is *expected* to exit nonzero) and parse the structured per-validator results.
2. Compute `FAILED_IDS` = the set of failing/timed-out validator IDs from the parsed results.
3. **PASS iff** `FAILED_IDS ⊆ ENV_RED_SET` **AND** each still-failing env-red's cause matches its recorded classification (agy = network/live-canary; codex-integrity = host-machine-state) **AND** the two NEW validators (`validate-actionable-hook-denial.sh`, `validate-all-host-install-migration.sh`) are PRESENT and PASSING.
4. **FAIL** on any `FAILED_IDS` member outside `ENV_RED_SET` (a NEW content failure), any env-red whose failure cause changed, or either new validator absent/failing.

**Baseline cause map + parser contract (F-019, round-2).** `check-tier1-env-red-set.mjs` does NOT infer causes — it is GIVEN them. task-1 captures a machine-readable baseline at `$BASE`, the file docs/specs/test-evidence/WI-487/env-red-baseline.json: an object mapping each env-red `validator_id` → `{ cause_class, digest }`, where `cause_class` is the normalized classification (`network/live-canary` for `validate-agy-launcher.sh`, `host-machine-state` for `validate-codex-execution-integrity.sh`) and `digest` is a SHA-256 over that validator's normalized failure signature (the classification-relevant lines of its output, whitespace-normalized) at `$BASE`. **Parser contract:** EVERY invocation of `check-tier1-env-red-set.mjs` passes `--baseline docs/specs/test-evidence/WI-487/env-red-baseline.json`; for each surviving failure in `FAILED_IDS ∩ ENV_RED_SET` the parser recomputes the current normalized signature and REQUIRES an EXACT match to the baseline `cause_class` AND `digest`. A member of `ENV_RED_SET` that still fails but whose signature changed (a NEW content/code reason under an old validator id) is a FAIL, not a pass — this closes the gap where a code regression could hide behind an allowed validator id. A negative fixture in `validate-actionable-hook-denial.sh`/`check-tier1-env-red-set.mjs` drives an allowed validator id to fail for a NEW (code) reason and asserts the parser rejects it.

Because WI-487 edits `hooks/codex/svc-codex-skill-load-enforcer.mjs`, the frozen tree must not make `validate-codex-execution-integrity.sh` worse than its recorded host-machine-state cause (verified in task-5 against the baseline cause map). An env-red *recovering* to green is allowed (it simply drops out of `FAILED_IDS`); it is never a regression.

## Implementation Summary

Make installed enforcement depend on a DURABLE canonical source AND on a durable enforcement LAUNCHER that does not live inside the source it guards, not on the lifetime of a temporary directory. Setup/migration materialize a minimal, NON-symlinked launcher `$LAUNCHER` under a stable per-user path (copied real bytes, not a symlink into the checkout) and reconfigure every governed hook to run THROUGH it. At run time the launcher resolves the real enforcement source, validates it (realpath exists + executable + `durable-canonical`), and FAILS CLOSED — denying the governed mutation with an actionable diagnostic and a home-local receipt — when the source is missing/dangling/non-executable, EVEN IF the entire source checkout was deleted. Setup also classifies the install source and refuses or materializes an ephemeral/worktree source to the git-common-dir main checkout before installing hooks/skills, and records ONE per-host install receipt (resolved through the single state-root resolver) shared by hooks and skills. Every BLOCKING hook — inventoried mechanically from hooks.json + provision/hosts + codex hooks — routes its denial through the shared actionable-denial helper, so no blocking surface emits an anonymous `code 1`; the helper writes a durable per-session receipt for stderr-swallowing hosts and deduplicates by `denialStateDigest` WITHOUT weakening the deny. A versioned first-run CLI inventories every host in provision/hosts/*.json, repairs them transactionally, resumably, idempotently, with a pinned retry ceiling N=3 per `retry_key` and a durable terminal record, DELEGATING legacy WI-state transformation to WI-486's compatibility contract (never a second migrator), and exposes a versioned `--rollback` that reverses the external migration from per-host backups.

### Invariants

| Invariant | Required outcome |
|---|---|
| Durable launcher | `$LAUNCHER` is a COPIED real file outside the source checkout, materialized alongside a byte/hash-verified copy of the canonical enforcement-core it imports; deleting the entire source checkout leaves the launcher runnable, and it fail-closed denies the governed mutation with a home-local receipt |
| Single enforcement-core | Exactly ONE implementation of `resolveStateRoot` + `denialStateDigest` + receipt validation + atomic denial write lives in hooks/lib/enforcement-core.mjs; setup materializes a byte/hash-verified copy under `~/.svc/enforcement/<version>/lib/`; the installed launcher imports the materialized copy, repo consumers import the in-repo copy — no duplication, no live-checkout dependency after install |
| Every governed hook routes through the launcher | No governed mutation hook is wired directly to a path inside the source checkout; the host hook command invokes `$LAUNCHER`, which validates then delegates |
| Durable source | An ephemeral/worktree/dangling source is refused or repointed to the git-common-dir canonical main BEFORE hooks/skills install |
| Fail-closed enforcement | A dangling/non-executable installed enforcement source on a governed mutation DENIES visibly; it never converts deny into silent allow, and has no fail-open flag |
| One effective source | Hooks and skills share ONE recorded effective source (via the single state-root resolver) and repair as a single transaction |
| Single state-root resolver | Every Bash/Node consumer resolves `~/.svc` through `resolveStateRoot()` with explicit HOME-missing behavior; receipts are EVIDENCE ONLY — consumers always re-realpath and reclassify the live hook/source before accepting converged state |
| Idempotent repair | Repeated setup/migration is a byte no-op on a converged host and never overwrites unrelated user host config |
| Complete actionable-denial coverage | EVERY blocking hook in `blocking-hook-inventory.txt` emits stable id + machine reason code + human cause + operation + exact recovery through the shared helper; an anonymous nonzero exit on ANY inventoried blocking hook is a test failure |
| Durable diagnostic | On stderr-swallowing hosts the same diagnostic is written to a durable per-session receipt (home-local) and the short message carries the reason code + lookup path |
| Denial dedup | Repeated identical `denialStateDigest` suppresses OUTPUT only; the DENY remains in force (never permission) |
| Denial identity | Dedup keys on ONE exported `denialStateDigest` over canonical JSON of enforcement-relevant state only (resolved command path, target existence/executability, effective source, receipt/source class, hook id, reason code); timestamps/output excluded |
| Dynamic all-host inventory | First-run migration globs provision/hosts/*.json; no hard-coded host subset |
| Transactional migration | Per-host backup + reverse rollback; resumable after interruption; bounded by the pinned N=3 ceiling; idempotent; versioned `--rollback` restores from backups with precondition digests |
| Pinned retry ceiling | N=3 automated attempts per `retry_key`; attempts persisted atomically; attempt 3 writes a terminal record and performs NO further automatic retry for that key; a changed `pre_state_digest`/`migration_version` starts a NEW key; one documented recovery command clears the terminal record only after verifying repair |
| WI-486 delegation | Legacy WI-state transformation delegates to WI-486's `classifyTaskState` + `svc-migrate-task-state.mjs`; no lane-tasks graph write exists in WI-487 code |
| Loop termination | The pinned ceiling + fail-closed terminal state prevents infinite first-run/PreToolUse/Stop loops |
| Test isolation | All Tier-1 proof uses temporary repositories + fixture host manifests with zero network/model calls |
| Boundary | Session-authority, atomic bootstrap, and task-state graph classification/migration remain WI-486 |

### Entry-point universe

| Family | Count | Entries | Disposition |
|---|---:|---|---|
| Durable enforcement launcher | 1 new | bin/svc-enforce.mjs (launcher TEMPLATE; setup COPIES it to `$LAUNCHER`, never symlinks) | Minimal fail-closed run-time validate-then-delegate; deny path imports the MATERIALIZED enforcement-core beside it, never the live checkout (F-016) |
| Canonical enforcement-core | 1 new | hooks/lib/enforcement-core.mjs | The ONE implementation of `resolveStateRoot` + `denialStateDigest` + receipt validation + atomic denial write; setup materializes a byte/hash-verified copy under `~/.svc/enforcement/<migration_version>/lib/`; in-repo consumers import the live copy, the installed launcher imports the materialized copy |
| Source-durability service | 1 new | hooks/lib/durable-source.mjs | Pure classify + canonical resolve + fail-closed enforcement guard; imports `resolveStateRoot` from enforcement-core (no own copy) |
| Actionable-denial service | 1 new | hooks/lib/hook-denial.mjs | Denial emitter + durable home-local receipt + dedup; RE-EXPORTS `denialStateDigest` + the atomic-write primitive from enforcement-core (no own copy); consumed by every inventoried blocking hook |
| All-host migration + rollback CLI | 1 new | scripts/svc-migrate-install.mjs | Dynamic-inventory transactional migration + `--rollback`; pinned N=3 ceiling; delegates WI-state to WI-486 |
| Data contracts | 2 new | schemas/install-state-receipt.schema.json, schemas/hook-denial-receipt.schema.json | Per-host install + per-session denial receipt shapes |
| Installer entry points | 2 mod | `setup`, `scripts/check-install-drift.sh` | Classify + refuse/materialize + materialize launcher + write receipt via resolver; surface ephemeral/dangling drift |
| Self-heal | 1 mod | `hooks/svc-session-start-healthcheck.mjs` | Detect ephemeral/dangling → bounded migration or actionable hard-fail (pinned ceiling) |
| Blocking-hook denial adoption | N mod (inventoried) | every id in `blocking-hook-inventory.txt` (see §F-002) — the two governed-mutation guards `hooks/svc-task-completion-guard.sh` + `hooks/codex/svc-codex-skill-load-enforcer.mjs` route through `$LAUNCHER`; the remaining inventoried blocking hooks adopt `emitDenial` | Call `guardEnforcementSource` (governed-mutation guards) and/or `emitDenial` (all blocking hooks); no anonymous exit remains |
| WI-486 delegation target | 0 new | `hooks/lib/task-state-compatibility.mjs`, `scripts/svc-migrate-task-state.mjs` | CONSUMED read-only; never modified by WI-487 |

No behavioral entry point in the accepted WI-487 contract is deferred.

### Enforcement launcher (F-001, stated once)

The self-reference defect the round-1 review caught: a guard installed THROUGH the same ephemeral source whose disappearance it must detect vanishes with the source, so a deleted checkout produces the same anonymous fail-open incident it was meant to close. The fix decouples the guard from the guarded:

- **Materialization.** Setup and `svc-migrate-install.mjs` COPY the enforcement BUNDLE as real bytes into `~/.svc/enforcement/<migration_version>/`, resolved through `resolveStateRoot()`, mode 0700, owner-only: the launcher `bin/svc-enforce` (from bin/svc-enforce.mjs) AND the canonical enforcement-core `lib/enforcement-core.mjs` (from hooks/lib/enforcement-core.mjs). BOTH are copied real bytes, each byte/hash-verified against its in-repo source of truth after copy; NEITHER is a symlink into the checkout. The version segment lets an upgrade install a new bundle without disturbing a running one. The installed launcher imports `../lib/enforcement-core.mjs` relative to itself, so it depends ONLY on materialized files — never the guarded checkout (F-016).
- **Wiring.** Every governed-mutation hook command is (re)written to invoke `$LAUNCHER <hook-id>` instead of a path inside the checkout. The launcher is the durable entry point the host actually executes.
- **Run-time contract.** `$LAUNCHER` (a) resolves the real enforcement source for `<hook-id>`, (b) validates it via `classifySource` (realpath exists + executable + `durable-canonical`), (c) if valid, exec-delegates to the real hook logic in the resolved source, (d) if missing/dangling/non-executable, FAILS CLOSED: it denies the governed mutation and emits the actionable diagnostic + a home-local denial receipt WITHOUT needing the vanished source. The launcher's deny path is self-contained because it imports the MATERIALIZED `lib/enforcement-core.mjs` beside it — the SAME canonical `resolveStateRoot` + `denialStateDigest` + receipt-write implementation the repo uses, NOT a duplicated inline copy and NOT the guarded checkout — so it denies (and dedups) identically even when the entire checkout is gone (F-016 resolves the self-contained-vs-single-implementation tension).
- **Proof.** The extended dead-pointer fixture DELETES the complete source checkout, then invokes the INSTALLED host command (the launcher) and asserts a visible DENY + a home-local receipt (AC-487-2 / AC-487-7A end-to-end, not merely a repointed future install).

## Files Planned

Legend — **Phase:** `plan` = authored in the planning lane, committed at 6a freeze; `1..5` = execution task that authors it; `6a` = staged/committed in the implementation land PR; `6b` = authored in the SEPARATE verify-promotion follow-up PR; `commit` = staged only at task-6a freeze. **UPSTREAM** rows are authored in the completed planning lane and only *committed* at 6a. CREATE paths that do not yet exist on disk are written WITHOUT code-span backticks so the mechanical prerequisite check (C1) does not treat a planned output as a missing prerequisite.

| File | Action | Phase | Purpose | ACs |
|---|---|---|---|---|
| bin/svc-enforce.mjs | CREATE | 2 | Durable NON-symlinked enforcement launcher template; run-time validate-then-delegate; fail-closed deny via the MATERIALIZED enforcement-core beside it | 1,2,7,7A,12 |
| hooks/lib/enforcement-core.mjs | CREATE | 2 | Canonical single-impl core: `resolveStateRoot` + `denialStateDigest` + receipt validation + atomic denial write; setup materializes a byte/hash-verified copy under the launcher's version dir (F-016) | 1,2,7,7A,8,12 |
| hooks/lib/durable-source.mjs | CREATE | 2 | `classifySource` + `resolveDurableCanonical` + `guardEnforcementSource`; imports `resolveStateRoot` from enforcement-core | 1,2,4,12 |
| `setup` | MODIFY | 2 | Classify + refuse/materialize ephemeral source; materialize `$LAUNCHER` (copy); rewire governed hooks through it; write per-host install receipt via resolver | 1,4,5,6 |
| `scripts/check-install-drift.sh` | MODIFY | 2 | Surface ephemeral/dangling enforcement source + missing/stale launcher; cite recorded receipt (evidence-only, re-realpath live) | 3,5 |
| `hooks/svc-session-start-healthcheck.mjs` | MODIFY | 2 | Detect ephemeral/dangling / missing launcher → bounded `svc-migrate-install` or actionable hard-fail (pinned ceiling) | 3,12 |
| schemas/install-state-receipt.schema.json | CREATE | 2 | Per-host effective-source + launcher + before/after receipt shape | 5,10 |
| hooks/lib/hook-denial.mjs | CREATE | 3 | Actionable denial emitter + durable home-local receipt + dedup; re-exports `denialStateDigest` + atomic-write from enforcement-core | 7,7A,8,12 |
| `hooks/svc-task-completion-guard.sh` | MODIFY | 3 | Route Stop through `$LAUNCHER`; fail-closed enforcement guard + actionable denial | 2,7,8,12 |
| `hooks/codex/svc-codex-skill-load-enforcer.mjs` | MODIFY | 3 | Route PreToolUse through `$LAUNCHER`; fail-closed enforcement guard + actionable denial | 2,7,8,12 |
| every remaining blocking hook in `blocking-hook-inventory.txt` | MODIFY | 3 | Adopt `emitDenial` so no blocking surface emits an anonymous `code 1` (F-002; per-file rows resolved by the task-1 inventory) | 7,7A |
| schemas/hook-denial-receipt.schema.json | CREATE | 3 | Durable per-session denial receipt shape | 7,7A |
| scripts/svc-migrate-install.mjs | CREATE | 4 | Versioned dynamic-inventory transactional all-host migration + `--rollback`; pinned N=3 ceiling; delegate WI-state to WI-486 | 3,5,6,9,10,11,12 |
| `.gitignore` | MODIFY | 4 | Declare-ignore machine-local `~/.svc`-mirrored runtime dirs written in-repo (`.svc/denial-receipts/`, `.svc/install-migrations/`) | 5,10 |
| test-framework/evals/tier-1/validate-actionable-hook-denial.sh | CREATE | 1 | Red-first denial identity/receipt/dedup/never-fail-open + inventory-completeness + deleted-checkout-launcher fixtures | 2,7,7A,8,12 |
| test-framework/evals/tier-1/validate-all-host-install-migration.sh | CREATE | 1 | Red-first dynamic-inventory/transactional/resumable/idempotent/rollback/N=3-ceiling/WI-486-delegation fixtures | 9,10,11,12 |
| `test-framework/evals/tier-1/validate-setup-worktree-canonical-resolution.sh` | MODIFY | 1,2 | EXTEND: ephemeral `/tmp` refusal + durable materialization + launcher materialized (copied, not symlinked) | 1,4 |
| `test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh` | MODIFY | 1,2 | EXTEND: deleted-checkout → launcher fail-closed deny + home-local receipt (no silent allow) | 2,3 |
| docs/specs/test-evidence/WI-487/declared-file-set.txt | CREATE | 1 | Machine-readable authoritative staged-file set (asserted at freeze). Lists its own path. | — |
| docs/specs/test-evidence/WI-487/blocking-hook-inventory.json | CREATE | 1 | STRUCTURED inventory rows `{hook_id, repo_path, installed_command, disposition}` (F-002/F-017); asserted by the denial validator | 7 |
| docs/specs/test-evidence/WI-487/blocking-hook-repo-paths.txt | CREATE | 1 | Derived normalized sorted repo-path list (file-disposition rows only) consumed by staging/hashing (F-017) | 7 |
| docs/specs/test-evidence/WI-487/env-red-baseline.json | CREATE | 1 | validator_id → {cause_class, digest} captured at `$BASE`; passed to the env-red parser, exact-match required (F-019) | — |
| scripts/check-blocking-hook-inventory.mjs | CREATE | 1 | Asserts every inventory row maps to exactly one reviewed repo file OR an explicit non-file disposition; emits the normalized repo-path list (F-017) | 7 |
| scripts/check-tier1-env-red-set.mjs | CREATE | 1 | Structured-results env-red-subset parser; consumes `--baseline` cause map and requires exact cause-class + digest match for surviving failures (F-006/F-019) | — |
| scripts/author-review-doc.mjs | CREATE | 1 | Produces + BINDS each per-round review document / gate decision from the launcher summary + receipt + findings; stamps `reviewed_code_sha`/`base`/`request_id`/`package_sha256` (F-018) | — |
| scripts/emit-6b-closure.mjs | CREATE | 1 | 6b lifecycle-closure authoring tool: writes both evidence artifacts, flips WI + INDEX status to VERIFIED, closes the lane graph with phase receipts, syncs feature-spec AC evidence (F-014) | — |
| docs/specs/test-evidence/WI-487/pre-change-tier1-baseline.md | CREATE | 1 | Preserve `$BASE` `ENV_RED_SET` + `BASELINE_PROVENANCE` + raw output + the 2 env-red classifications | — |
| docs/specs/test-evidence/WI-487/post-change-tier1-frozen.md | CREATE | 6b | Frozen-tree full-suite identity (follow-up PR) | — |
| docs/specs/test-evidence/WI-487/pre-post-evidence.json | CREATE | 6b | Machine-readable old/new launcher, durable-source, denial, migration, delegation proof | — |
| docs/specs/verification/wi-487-promotion.md | CREATE | 6b | Durable in-repo promoted Tier-1 verification record (G7), env-red-set predicate | — |
| `docs/specs/features/wi-487-durable-install-enforcement.md` | MODIFY-UPSTREAM | commit(6a) | Record per-AC implementation evidence (QA/E2E/Test columns) | all |
| `docs/specs/decisions/wi-487-durable-install-enforcement.md` | MODIFY-UPSTREAM | commit(6a) | Architecture alternatives + accepted decisions D-1..D-12 (this session) | all |
| `docs/plans/2026-07-17-wi487-durable-install-enforcement/manifest.md` | CREATE-UPSTREAM | plan | This reviewed deterministic implementation authority | all |
| docs/plans/2026-07-17-wi487-durable-install-enforcement/review-log.yaml | CREATE-UPSTREAM | plan | Plan-review rounds, findings, dispositions, `rounds_run`/`bounded_exit`; gated by check-review-round-cap.mjs | — |
| docs/plans/2026-07-17-wi487-durable-install-enforcement/progress.md | CREATE | 1..6a | TDD red/green checkpoints and replay status | — |
| docs/specs/reviews/wi-487-exec-cross-model.md | CREATE | 6a | Frozen-diff review-exec rounds + dispositions + convergence | — |
| docs/specs/reviews/wi-487-security.md | CREATE | 6a | Fail-closed/authority/path specialist security review (distinct package) | — |
| docs/specs/reviews/wi-487-gate.md | CREATE | 6a | Review-gate decision + finding dispositions | — |
| docs/specs/audit/wi-487-durable-install-analysis.md | CREATE | 6a | AC-traced implementation audit | — |
| `docs/specs/work-items/WI-487.md` | MODIFY | 6b | Status→VERIFIED in the follow-up PR | — |
| `docs/specs/work-items/INDEX.md` | MODIFY | 6b | Synchronize WI lifecycle to VERIFIED | — |
| `.svc/lane-tasks-WI-487.json` | MODIFY | commit(6a) + close(6b) | Task/phase receipts committed with 6a; graph CLOSED in 6b | — |
| `.svc/pipeline-decisions.jsonl` | MODIFY | commit | Append-only plan/exec/review/audit/land/verify decisions | — |
| `.svc/session-contract.jsonl` | PRESERVE (never staged) | — | Existing exact WI/session/worktree binding; append-only; excluded from declared set | — |

Machine-local runtime surfaces, resolved through `resolveStateRoot()`, never staged and never in `declared-file-set.txt`: `~/.svc/enforcement/<migration_version>/{bin/,lib/}` (the durable launcher + the materialized canonical enforcement-core it imports — see §External State), `~/.svc/install-state/` (home, per-host receipt), `~/.svc/denial-receipts/` (home, per-session denial receipt), `~/.svc/install-migrations/` (home, per-host backup + marker + report + attempt ledger). The in-repo `.svc/denial-receipts/` and `.svc/install-migrations/` mirrors (used only when a consumer runs with HOME set to a fixture root under a temp repo) are declare-ignored by the task-4 `.gitignore` MODIFY row (the `.gitignore` change is itself in the declared set, so no undeclared write). `.svc/receipts/`, `.svc/receipt-bodies/`, `.svc/external-review-artifacts/` are already gitignored.

## Task Graph

```json
{"tasks":[
  {"id":"task-1","title":"RED FIRST: author failing new+extended fixtures with NAMED expected-red markers (incl. deleted-checkout-launcher + inventory-completeness); generate declared-file-set + blocking-hook-inventory; capture $BASE ENV_RED_SET baseline","blocked_by":[]},
  {"id":"task-2","title":"Durable launcher FIRST: bin/svc-enforce.mjs + durable-source.mjs (classify/resolve/resolveStateRoot/guard) + setup materializes launcher (copy) and rewires governed hooks through it + healthcheck/drift wiring + install-state receipt schema","blocked_by":["task-1"]},
  {"id":"task-3","title":"Actionable-denial helper + FULL blocking-hook coverage: hook-denial.mjs (exported denialStateDigest, home-local receipt) + fail-closed guard in both mutation guards + emitDenial adopted by every inventoried blocking hook + denial receipt schema","blocked_by":["task-2"]},
  {"id":"task-4","title":"All-host migration + rollback: svc-migrate-install.mjs (dynamic inventory, transactional, resumable, N=3 ceiling, idempotent, --rollback) delegating WI-state to WI-486; .gitignore","blocked_by":["task-3"]},
  {"id":"task-5","title":"GREEN: extended+new fixtures pass; full Tier-1 FAILED_IDS ⊆ ENV_RED_SET with unchanged env-red causes; 2 new validators PASS","blocked_by":["task-4"]},
  {"id":"task-6a","title":"Freeze; pre-STAGE freshness gate; review the code diff (exec + distinct security) under the 3-round bounded-exit cap; commit; tree-bound receipts; sanctioned merge; re-emit envelope","blocked_by":["task-5"]},
  {"id":"task-6b","title":"Verify-promotion FOLLOW-UP PR through the sanctioned chain: flip WI-487 status→VERIFIED, close lane graph, write verification record, emit verify-promotion on ITS merge SHA","blocked_by":["task-6a"]}
]}
```

| Task | Files | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|
| task-1 | two new validators (red), two extended validators (red), declared-file-set, blocking-hook-inventory, baseline evidence | AC-487-1..12 (red) | each new/extended fixture fails only on its NAMED expected-red marker (§F); `bash -n` per `.sh`; baseline records `ENV_RED_SET` + provenance | `wi487-red-contract` |
| task-2 | bin/svc-enforce.mjs, durable-source.mjs, `setup`, `check-install-drift.sh`, `svc-session-start-healthcheck.mjs`, install-state schema | AC-487-1,2,3,4,5,6 | deleted-checkout launcher fail-closed green; extended canonical-resolution (launcher copied, not symlinked) + double-dead-pointer green; `node --check`; schema parses | `wi487-durable-launcher` |
| task-3 | hook-denial.mjs, two mutation guards, every inventoried blocking hook, denial receipt schema | AC-487-2,7,7A,8,12 | denial validator green: identity/receipt/dedup/never-fail-open + inventory-completeness (every blocking hook actionable); both guards fail-closed on dangling | `wi487-actionable-denial` |
| task-4 | scripts/svc-migrate-install.mjs, `.gitignore` | AC-487-3,5,6,9,10,11,12 | migration validator green: dynamic inventory, failpoint rollback, resume, idempotent no-op, `--rollback` restore, N=3 ceiling→terminal, WI-486 delegation (grep: no lane-tasks write) | `wi487-all-host-migration` |
| task-5 | none (green gate only) | AC-487-1..12 | full `run-all-evals.sh --tier1` = `FAILED_IDS ⊆ ENV_RED_SET`, causes unchanged; 2 new validators PASS | `wi487-green` |
| task-6a | freeze/review/commit/land (no new runtime code) | AC-487-1..12 | §Execution Command Sequence steps 1–7 | `wi487-frozen-branch` |
| task-6b | own worktree + promoted verify; sanctioned-chain follow-up PR | lifecycle closure | §Execution Command Sequence steps 8–9 | `wi487-verified` |

Tasks are sequential because each later behavior consumes the exact contract frozen by the preceding task. **The durable launcher is built FIRST among implementation tasks (task-2)** so every later denial/guard/migration behavior binds to the decoupled, non-symlinked entry point rather than to a path inside the guarded source. Task-1 is the smallest reversible slice and adds no repair/denial/migration write path. **Task-6 is SPLIT into 6a and 6b** (WI-489 two-commit pattern): 6a's merged tree contains the implementation ONLY; 6b is a separate follow-up PR that records the merged/VERIFIED lifecycle state in ITS commit.

## F-002 blocking-hook completeness (stated once)

AC-487-7/7A demand that EVERY blocking hook — not only the two governed-mutation guards — emit an actionable denial. Completeness is asserted mechanically, not by hand:

1. **task-1 generates** the STRUCTURED inventory `blocking-hook-inventory.json` (F-017) — one row per blocking hook with distinct fields `{hook_id, repo_path, installed_command, disposition}` — by extracting every hook whose disposition is a hard block from three authorities: `hooks/hooks.json` (ids described as HARD BLOCK — currently `svc-workflow-guard`, `svc-bash-guard`, `svc-eval-gate-pre`, `svc-preflight-skill`, `svc-skill-artifact-authenticity`, `svc-session-contract-freshness`, `svc-inertia-check`, `svc-lane-tasks-validator`, `svc-wi-pillars-check`, `svc-stop-quality`, `svc-verification-delegation-guard`, `svc-task-completion-guard`), the per-host manifests under provision/hosts/ that wire blocking commands, and the codex hooks (`svc-codex-skill-load-enforcer`, `svc-codex-stop-firewall`, `svc-codex-prompt-authority`). `disposition` is one of `route-through-launcher` (the two governed-mutation guards), `adopt-emitDenial` (every other file-backed blocking hook), or an explicit `non-file:<reason>` (a wiring row with no single repo file — recorded, not staged). The generator is reproducible (re-run yields the same set). **`hook_id`/`installed_command` are hook metadata; `repo_path` is a repository path** — the two are NEVER conflated: `scripts/check-blocking-hook-inventory.mjs` asserts every row maps to exactly one reviewed repo file OR an explicit non-file disposition, and emits the derived normalized, sorted, unique repo-path list `blocking-hook-repo-paths.txt` (file-disposition rows only). Staging and hashing consume ONLY that normalized repo-path file (never the raw ids/commands), read into a NUL/space-safe form.
2. **task-3 routes/adopts** — the two governed-mutation guards (`disposition: route-through-launcher`) run THROUGH `$LAUNCHER`; every other inventoried blocking hook (`disposition: adopt-emitDenial`) adopts `emitDenial`. A shared helper does not make a hook use it, so each inventoried `hook_id` is explicitly wired or explicitly classified out via its `disposition` field (with a recorded reason).
3. **The denial validator enumerates the inventory** and drives each blocking path to a denial, FAILING if any inventoried hook returns a nonzero exit lacking the complete `{hook_id, reason_code, cause, operation, recovery}` diagnostic and the durable receipt. "Every blocking hook is actionable" is therefore a mechanical assertion over `blocking-hook-inventory.json`, not a prose claim.

## F. Deterministic Test-and-Syntax Discipline (stated once)

- **Red-first with NAMED markers.** Each new fixture, before its behavior exists, fails by emitting a specific expected-red string the run greps for — not merely a nonzero exit:
  - `validate-actionable-hook-denial.sh` → `EXPECTED-RED: actionable hook-denial contract not yet implemented`
  - `validate-actionable-hook-denial.sh` (deleted-checkout case) → `EXPECTED-RED: durable launcher fail-closed-on-deleted-checkout not yet implemented`
  - `validate-actionable-hook-denial.sh` (inventory case) → `EXPECTED-RED: full blocking-hook denial coverage not yet implemented`
  - `validate-all-host-install-migration.sh` → `EXPECTED-RED: all-host install migration not yet implemented`
  - `validate-all-host-install-migration.sh` (rollback case) → `EXPECTED-RED: versioned install rollback not yet implemented`
  - extended `validate-setup-worktree-canonical-resolution.sh` → new case emits `EXPECTED-RED: ephemeral-source refusal + launcher materialization not yet implemented`
  - extended `validate-self-heal-survives-double-dead-pointer.sh` → new case emits `EXPECTED-RED: fail-closed enforcement on deleted checkout not yet implemented`
- **`node --check` checks ONE file.** Node syntax validation loops per file: `for f in <planned .mjs>; do node --check "$f"; done`.
- **`bash -n` per planned `.sh`.** Each planned shell file is syntax-checked individually.

## Tier-1 Promotion (required note for the two NEW validators)

Per `rules/tier-1-promotion.md` and the proposal's Tier-1 promotion note, each new always-on validator names all five fields.

### validate-actionable-hook-denial.sh

- `validator_path`: test-framework/evals/tier-1/validate-actionable-hook-denial.sh
- `failure_class`: a blocking hook emits an anonymous nonzero exit (no identity/reason/operation/recovery), or a stderr-swallowing host shows nothing, or a deleted source checkout makes the launcher fail OPEN, or repeated identical denials storm, or dedup silently converts a deny into allow, or any inventoried blocking hook is uncovered.
- `promotion_signal`: signal 3 — protects the hook-execution hot path (`hooks/svc-*`, `hooks/lib/*`, `$LAUNCHER`); the observed incident (`PreToolUse hook (failed)` / `hook exited with code 1` repeated many times) is documented in the proposal Evidence and WI-487.
- `expected_runtime_budget`: under 5 seconds, hermetic, no network/model.
- `why_tier_2_or_targeted_is_insufficient`: the denial contract + launcher fail-closed path is a per-tool-call hot path; a broken diagnostic, an uncovered blocking hook, or a fail-open-on-deleted-checkout must block before install ships, and is deterministic from local process state.

### validate-all-host-install-migration.sh

- `validator_path`: test-framework/evals/tier-1/validate-all-host-install-migration.sh
- `failure_class`: first-run migration repairs only the active host / a hard-coded subset, or is non-transactional (partial host left inconsistent), or non-resumable, or non-idempotent, or lacks a working `--rollback`, or invents a second WI-state migrator, or retries past the pinned N=3 ceiling.
- `promotion_signal`: signal 3 — protects the install/first-run hot path (`setup`/session-start) and the WI-486 delegation boundary; the legacy-machine loop incident is documented in the proposal Evidence.
- `expected_runtime_budget`: under 5 seconds, hermetic (temporary repo + fixture host manifests), no network/model.
- `why_tier_2_or_targeted_is_insufficient`: migration integrity, the pinned ceiling, the rollback path, and the "no second graph migrator" invariant must block before an upgrade ships to any host; all are deterministic from filesystem + provision/hosts/*.json state.

The two EXTENDED validators (`validate-setup-worktree-canonical-resolution.sh`, `validate-self-heal-survives-double-dead-pointer.sh`) are already tier-1; no new slot is claimed for them.

## AC-to-Task and AC-to-Test Mapping

| ACs | Task(s) | Test type | Exact proof |
|---|---|---|---|
| AC-487-1,4 | 1,2,6 | fixture (extend canonical-resolution) | setup from a `/tmp` source is refused/materialized to canonical main; launcher is COPIED (not symlinked); legitimate `.worktrees/` dev still resolves to git-common-dir main |
| AC-487-2 | 1,2,3,6 | negative fixture (extend double-dead-pointer + denial validator) | deleting the COMPLETE source checkout still yields a launcher fail-closed DENY + home-local receipt; guards never convert deny to allow |
| AC-487-3 | 1,2,4,6 | fixture | healthcheck detect ephemeral/dangling/missing-launcher → bounded repair or actionable hard-fail |
| AC-487-5,6 | 1,2,4,6 | schema/idempotency | one per-host receipt (via resolver) names the shared effective source + launcher; 3rd setup/migration run is a byte no-op; unrelated host config preserved |
| AC-487-7,7A | 1,3,6 | fixture/host/inventory (denial validator) | EVERY blocking hook in the inventory carries id+reason+op+recovery; stderr-swallowing host recovers from durable home-local receipt via short message |
| AC-487-8 | 1,3,6 | replay (denial validator) | repeat identical `denialStateDigest` suppresses OUTPUT, keeps DENY |
| AC-487-9,10 | 1,4,6 | inventory/failpoint/replay/rollback (migration validator) | dynamic provision/hosts/*.json inventory; per-host rollback; interrupted-then-resumed; idempotent no-op; `--rollback` restore; per-host before/after report |
| AC-487-11 | 1,4,6 | delegation fixture (migration validator) | classify via `task-state-compatibility`; migratable state shells `svc-migrate-task-state.mjs`; grep proves NO lane-tasks graph write in scripts/svc-migrate-install.mjs; absent/unsupported → fail-closed terminal, no retry |
| AC-487-12 | 1,3,4,6 | loop replay (both new validators) | N=3 ceiling per `retry_key` → terminal record; denial dedup bounds output; no infinite first-run/PreToolUse/Stop loop |

No AC is manual-only or N/A. Every AC has deterministic unit, schema, failpoint, replay, inventory, or rollback evidence.

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX transitions | N/A | Internal installer/hook/CLI Enabler; the durable-launcher / durable-source / denial / all-host-migration state machines are the flow contract; operator diagnostics are output contracts in the spec |
| UI tokens/assets | N/A | No browser-visible file, component, route, viewport, or rendering AC |
| Technical design | satisfied | baselined Technical Design in the spec plus D-1..D-12 in the decision log (D-10 launcher, D-11 resolver, D-12 rollback added this revision) |
| Style contract | satisfied | zero-dependency ESM, portable Bash, JSON Schema, atomic 0600/0700 home-local files, existing Tier-1 shell conventions |
| Persona differentiation | N/A | System-only S1 Framework Orchestrator journey; `J-FW-05` supplies the concurrent-session / install-integrity pressure |
| Capability evidence | satisfied | Node, git-worktree, `git rev-parse --git-common-dir`, WI-486 compatibility CLI, WI-489 launcher, and check-review-round-cap.mjs are locally present and baseline-tested |
| G4 architecture review | satisfied | design-tech adversarial review PASS with launcher-decoupling, rollback, foreign-state, and WI-486 delegation boundaries resolved |
| Upstream lane | satisfied | route-workflow, improve-framework, diagnose-bug, write-spec, design-tech, plan-changeset completed with graph phase receipts |

## External State

Enumerated against the svc external-state taxonomy. Every coupled row names writer, verifier, rollback, ownership/mode, and drift check.

| # | Environment | What state | Writer | Verifier | Rollback | Ownership/mode | Drift check | Coupling |
|---:|---|---|---|---|---|---|---|---|
| 1 | Host hook configuration | governed-mutation hook commands rewritten to invoke `$LAUNCHER <hook-id>` in each provision/hosts manifest wiring | `setup`, scripts/svc-migrate-install.mjs | canonical-resolution + denial fixtures assert the installed command points at `$LAUNCHER` | `svc-migrate-install.mjs --rollback` restores per-host config from backup | svc-owned symlink/command entries only; unrelated user config untouched | `check-install-drift.sh` re-realpaths the live wired command | coupled |
| 2 | Installed hook/skill symlinks | hooks + skills symlinked into the durable canonical checkout | `setup` | one per-host install receipt names the shared effective source; fixtures assert resolution | re-run `./setup --host <host>` / `--rollback` | svc-owned symlinks under the host skills/hook path | drift check compares live realpath to receipt then re-classifies | coupled |
| 3 | Durable enforcement launcher | `~/.svc/enforcement/<migration_version>/bin/svc-enforce` — COPIED real bytes, non-symlinked | `setup`, svc-migrate-install.mjs | deleted-checkout fixture proves it runs + fail-closed denies after the checkout is gone | `--rollback` removes the version dir it created; a prior version remains runnable | 0700 dir / 0700 file, owner-only, via `resolveStateRoot()` | healthcheck/drift verify presence + version + executability | coupled |
| 4 | Per-host install receipt | ~/.svc/install-state/&lt;host&gt;.json (via resolver) | `setup`, svc-migrate-install.mjs | idempotency fixture byte-compares; receipts are EVIDENCE ONLY (re-realpath live) | delete-on-rollback; regenerable on next setup | 0600, owner-only | drift check re-derives live source and reconciles against receipt | coupled |
| 5 | Per-session denial receipts | ~/.svc/denial-receipts/&lt;session-hash&gt;/&lt;denialStateDigest&gt;.json | hooks/lib/hook-denial.mjs, `$LAUNCHER` | denial validator asserts receipt written + short message lookup path | regenerable cache; removed by operator, never authoritative | 0600 under 0700, owner-only | none required (append-only evidence); never trusted as authorization | coupled |
| 6 | Migration markers / backups / attempt ledger | `~/.svc/install-migrations/v<version>/<host>/{backup/, marker.json, report.json, attempts.json}` | svc-migrate-install.mjs | failpoint/resume/idempotency + N=3-ceiling fixtures | `--rollback` restores from `backup/`; ledger names the incomplete host | 0700 tree / 0600 files, owner-only | resume marker + `pre_state_digest` per `retry_key` | coupled |
| 7 | Git notes receipts | `refs/notes/svc-receipts` envelope on HEAD then MERGE_SHA | scripts/emit-receipt.mjs | scripts/check-chain-receipts.mjs on both SHAs | notes are additive; a revert PR re-emits its own envelope | pushed to origin; bounded-retry merge on contention | check-chain-receipts on each SHA | coupled |
| 8 | Temp review artifacts | `/tmp/wi487-*.md/.txt`, `.svc/external-review-artifacts/WI-487/{exec,security}/` | §Execution Command Sequence (launcher review packages) | `test -f` on each generated artifact before use | ephemeral; recreated on replay | current user, tmp perms | each artifact is generated by a prior step before it is consumed | decoupled-justified |

Untouched environments (walked the taxonomy, found nothing): databases, message queues, cloud object storage, DNS, CDN, secret stores, external SaaS APIs, browser storage, OS package managers, cron/systemd units — WI-487 touches only local git + home-local files.

Home-local storage is chosen because installation state is user- and host-specific; the single `resolveStateRoot()` (with explicit HOME-missing fail-closed behavior) is the ONLY expander of `~/.svc` for every Bash and Node consumer, so Bash and Node cannot disagree on the path. Receipts are non-authoritative: any consumer re-realpaths and reclassifies the live hook/launcher/source before accepting a converged state, so a stale, forged, or drifted receipt cannot grant authority.

## Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| task-1 | both new validator paths absent; two extended validators exist | PASS | create two local fixture suites, extend two harnesses with NAMED red markers |
| task-1 | `ENV_RED_SET` reproduces at `$BASE` (agy + codex-integrity, classified) | PASS | store immutable baseline evidence (set + provenance + raw output) before implementation |
| task-1 | declared-file-set + STRUCTURED blocking-hook-inventory (+ derived normalized repo-paths) + env-red baseline cause map generators run and self-include their own paths / enumerate every blocking hook | PASS | generate machine-readable sets (F-017/F-019); assert row/file bijection + exact env-red cause match at freeze |
| task-2 | `setup`'s `git rev-parse --git-common-dir` canonical resolution exists to reuse | PASS | wrap it in `resolveDurableCanonical`; materialize launcher via copy, not symlink |
| task-2 | no launcher exists outside the checkout today (the self-reference defect) | PASS as reproduced defect | copy bin/svc-enforce.mjs to `$LAUNCHER`; rewire governed hooks through it |
| task-3 | current blocking hooks emit anonymous `code 1` (the incident) | PASS as reproduced bug | route mutation guards through `$LAUNCHER`; adopt `emitDenial` across the inventory |
| task-3 | WI-486 exposes a generic exported canonical digest with identical semantics? | UNKNOWN → verified in task-3 | if yes, reuse; else define an own exported `denialStateDigest`; NEVER reuse `recordDisposition` |
| task-4 | compatibility module + migration CLI exist to delegate to | PASS | import `task-state-compatibility`; shell `svc-migrate-task-state.mjs`; no self graph write |
| task-4 | secure atomic-write + 0600/0700 patterns exist to reuse | PASS | reuse ownership/mode + rename/fsync conventions; add `attempts.json` per `retry_key` |
| task-5 | full Tier-1 predicate is `FAILED_IDS ⊆ ENV_RED_SET`, not a count | PASS | parse structured results; assert set-subset + unchanged causes + 2 new validators PASS |
| task-6a | pre-STAGE freshness gate compares `origin/main` to `$BASE` BEFORE staging; DISTINCT pre-freeze (STEP 0) vs post-commit (STEP 6) recovery | PASS | pre-freeze: preserve tracked+untracked via verified stash → rebase → restore → re-verify; post-commit: rebase the existing aggregate commit; never hash an empty staged diff (F-013) |
| task-6a | review gate uses the 3-round bounded-exit cap, not zero-High; review DOCS are produced + bound to the diff | PASS | author each per-round doc + gate from the launcher summary/receipt/findings; assert reviewed_code_sha/base/request_id/package_sha256 before round-cap + PASS (F-018); persist rounds in review-log.yaml |
| task-6b | work-item/index paths, task graph, Markdown AST, JSONL, full Tier-1 validators exist | PASS | run §Execution Command Sequence steps 8–9 through the sanctioned chain |
| all | no package manifest, ORM schema, external API, browser, or paid-model runtime enters implementation | PASS | Node core + git + Python3 only; no dependency install |
| rollback | external migration (host config/home state) is reversed by a versioned command, not `git revert`, and BEFORE the code revert merges | PASS | run+verify `--rollback` (or run it from a pinned worktree at the WI-487 merge SHA) with precondition digests + atomic restore + verification + idempotent replay; record per-host results BEFORE merging the revert (F-020) |

### Scenario Coverage

| Journey | Scenario | Tasks | Coverage |
|---|---|---|---|
| J-FW-05 | install-integrity: ephemeral source refused/materialized + launcher copied | task-1,2,6 | full |
| J-FW-05 | install-integrity: deleted checkout → launcher fail-closed deny + receipt | task-1,2,3,6 | full |
| J-FW-05 | install-integrity: every blocking hook actionable (inventory) | task-1,3,6 | full |
| J-FW-05 | install-integrity: all-host transactional migration + rollback + N=3 ceiling | task-1,4,6 | full |
| J-FW-05 | install-integrity: legacy WI-state delegated to WI-486, no second migrator | task-1,4,6 | full |

No simulation failure, unresolved architecture question, journey gap, or package dependency remains. The single task-3 UNKNOWN (WI-486 digest reuse) is resolved at implementation by an input-contract check, defaulting to an own exported digest.

## Validation Plan

### Targeted tests (per task; syntax loops per §F)

```bash
for f in bin/svc-enforce.mjs hooks/lib/enforcement-core.mjs hooks/lib/durable-source.mjs hooks/lib/hook-denial.mjs scripts/svc-migrate-install.mjs scripts/check-tier1-env-red-set.mjs scripts/check-blocking-hook-inventory.mjs scripts/author-review-doc.mjs scripts/emit-6b-closure.mjs; do node --check "$f"; done
for f in hooks/svc-session-start-healthcheck.mjs hooks/codex/svc-codex-skill-load-enforcer.mjs; do node --check "$f"; done
for f in setup scripts/check-install-drift.sh hooks/svc-task-completion-guard.sh \
         test-framework/evals/tier-1/validate-actionable-hook-denial.sh \
         test-framework/evals/tier-1/validate-all-host-install-migration.sh \
         test-framework/evals/tier-1/validate-setup-worktree-canonical-resolution.sh \
         test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh; do bash -n "$f"; done
node -e 'JSON.parse(require("fs").readFileSync("schemas/install-state-receipt.schema.json","utf8"))'
node -e 'JSON.parse(require("fs").readFileSync("schemas/hook-denial-receipt.schema.json","utf8"))'
bash test-framework/evals/tier-1/validate-setup-worktree-canonical-resolution.sh
bash test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh
bash test-framework/evals/tier-1/validate-actionable-hook-denial.sh
bash test-framework/evals/tier-1/validate-all-host-install-migration.sh
bash test-framework/evals/tier-1/validate-industry-grounding-section.sh
# AC-487-11 grep invariant — MUST return nothing (no lane-tasks graph write in WI-487 migration code):
! grep -nE "writeFile.*lane-tasks|JSON\.stringify.*(tasks|lane-tasks)" scripts/svc-migrate-install.mjs
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-487.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-487.json
node test-framework/evals/tier-1/validate-markdown-ast.mjs
node scripts/validate-jsonl.mjs .svc/pipeline-decisions.jsonl
git diff --check
```

### Full branch policy — env-red-set predicate (F-006)

```bash
export -f rg 2>/dev/null || true
# Capture the suite exit EXPLICITLY; the suite is EXPECTED to exit nonzero at baseline.
if bash test-framework/evals/run-all-evals.sh --tier1 > /tmp/wi487-tier1.out 2>&1; then SUITE_RC=0; else SUITE_RC=$?; fi
# FAILED_IDS ⊆ ENV_RED_SET = { validate-agy-launcher.sh, validate-codex-execution-integrity.sh }
# AND both new validators present + passing. Parse structured per-validator results; do NOT gate on 246/2/0.
node scripts/check-tier1-env-red-set.mjs --results /tmp/wi487-tier1.out \
  --baseline docs/specs/test-evidence/WI-487/env-red-baseline.json \
  --env-red validate-agy-launcher.sh,validate-codex-execution-integrity.sh \
  --require-pass validate-actionable-hook-denial.sh,validate-all-host-install-migration.sh
```

The immutable comparison point is `ENV_RED_SET` at `$BASE`; the frozen implementation is acceptable iff `FAILED_IDS ⊆ ENV_RED_SET` with unchanged env-red causes and both new validators PASS. `check-tier1-env-red-set.mjs` is a small structured-results parser authored in task-1 alongside the fixtures (declared, syntax-checked, in `declared-file-set.txt`); if the suite's structured-results file is used directly instead, the parse step reads it — either way the predicate is a set relation, never a count.

## Execution Command Sequence — Land Sequence (the WI-489 two-commit pattern; stated once)

`$BASE` is §A. All variables are defined before use. The sequence runs under `set -euo pipefail`; every gate is a hard predicate that aborts the WHOLE sequence with non-zero exit (G1). No `|| true`, no swallowed failure, on any gate (the only bounded soft-retry is the notes-push loop, which still `exit 1`s after its 5th attempt). **The origin/main freshness gate runs BEFORE staging and review (F-007); the review gate is the WI-491 3-round bounded-exit cap, NOT zero-High (F-008); the baseline gate is the env-red-set predicate, NOT 246/2/0 (F-006).**

```bash
set -euo pipefail
ROOT="$PWD"
BASE=835e365a1ee2b408bcfbb8eae49500d8f0270f4b
test "$(git rev-parse --abbrev-ref HEAD)" = "framework-WI-487-durable-install"
test "$(git merge-base "$BASE" HEAD)" = "$BASE"
test -z "$(git rev-list "$BASE"..HEAD)"      # implementation stays uncommitted until the one aggregate freeze

# ==== STEP 0 — PRE-FREEZE freshness gate (F-007); PRE-FREEZE recovery procedure (F-013) ====
# Entry precondition (initial pass only): the implementation is UNCOMMITTED — the top-of-sequence
# assertion above holds. If origin/main has advanced, the PRE-FREEZE recovery preserves ALL declared
# tracked+untracked work via an explicit VERIFIED mechanism, rebases the clean tree, restores, re-verifies,
# re-declares $BASE, and RESTARTS from STEP 1. It NEVER hashes an empty staged diff and never rebases a
# dirty tree. (The distinct POST-COMMIT recovery lives at STEP 6, after the aggregate commit exists.)
git fetch origin main --quiet
if [ "$(git rev-parse origin/main)" != "$BASE" ]; then
  STASH_TAG="wi487-prefreeze-$(date -u +%s)"
  git stash push --include-untracked -m "$STASH_TAG"
  if ! git stash list | grep -q "$STASH_TAG"; then echo "PRE-FREEZE preserve unverified — abort"; exit 2; fi
  git rebase origin/main
  git stash pop
  if git stash list | grep -q "$STASH_TAG"; then echo "PRE-FREEZE restore incomplete (conflict) — resolve manually, do not proceed"; exit 2; fi
  if [ -n "$(git rev-list origin/main..HEAD)" ]; then echo "unexpected commit after PRE-FREEZE restore — abort"; exit 2; fi
  echo "origin/main advanced pre-freeze — work preserved (stash --include-untracked), rebased, restored, re-verified. Update \$BASE in §A to $(git rev-parse origin/main), rerun STEP 1 verification, then proceed. Aborting this pass."
  exit 2
fi

# ==== STEP 1 — full verify over the working tree (env-red-set predicate) ====
git diff --check
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-487.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-487.json
node test-framework/evals/tier-1/validate-markdown-ast.mjs
export -f rg 2>/dev/null || true
if bash test-framework/evals/run-all-evals.sh --tier1 > /tmp/wi487-tier1.out 2>&1; then SUITE_RC=0; else SUITE_RC=$?; fi
node scripts/check-tier1-env-red-set.mjs --results /tmp/wi487-tier1.out \
  --baseline docs/specs/test-evidence/WI-487/env-red-baseline.json \
  --env-red validate-agy-launcher.sh,validate-codex-execution-integrity.sh \
  --require-pass validate-actionable-hook-denial.sh,validate-all-host-install-migration.sh

# ==== STEP 2 — stage the COMPLETE candidate (incl. new untracked files), THEN hash the reviewed code diff ====
CODE_PATHS='.gitignore setup scripts/check-install-drift.sh scripts/svc-migrate-install.mjs bin/svc-enforce.mjs hooks/lib/enforcement-core.mjs hooks/lib/durable-source.mjs hooks/lib/hook-denial.mjs hooks/svc-session-start-healthcheck.mjs hooks/svc-task-completion-guard.sh hooks/codex/svc-codex-skill-load-enforcer.mjs schemas/install-state-receipt.schema.json schemas/hook-denial-receipt.schema.json scripts/check-tier1-env-red-set.mjs scripts/check-blocking-hook-inventory.mjs scripts/author-review-doc.mjs scripts/emit-6b-closure.mjs test-framework/evals/tier-1/validate-actionable-hook-denial.sh test-framework/evals/tier-1/validate-all-host-install-migration.sh test-framework/evals/tier-1/validate-setup-worktree-canonical-resolution.sh test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh'
# F-017: consume ONLY the normalized repo-path list DERIVED from the STRUCTURED inventory (never raw
# hook-ids/commands). check-blocking-hook-inventory.mjs asserts every {hook_id,repo_path,installed_command,
# disposition} row maps to exactly one reviewed repo file OR an explicit non-file disposition, and (re)emits
# the sorted unique repo-path file. Those normalized paths are then appended to CODE_PATHS.
node scripts/check-blocking-hook-inventory.mjs \
  --inventory docs/specs/test-evidence/WI-487/blocking-hook-inventory.json \
  --repo-paths docs/specs/test-evidence/WI-487/blocking-hook-repo-paths.txt
CODE_PATHS="$CODE_PATHS $(tr '\n' ' ' < docs/specs/test-evidence/WI-487/blocking-hook-repo-paths.txt)"
git add -- $CODE_PATHS
REVIEWED_CODE_SHA=$(git diff --cached "$BASE" -- $CODE_PATHS | sha256sum | awk '{print $1}')
! grep -nE "writeFile.*lane-tasks|JSON\.stringify.*(tasks|lane-tasks)" scripts/svc-migrate-install.mjs

# ==== STEP 3 — review the CODE diff under the 3-round bounded-exit cap (F-008); security is a DISTINCT package ====
ART=.svc/external-review-artifacts/WI-487/exec ; ART_SEC=.svc/external-review-artifacts/WI-487/security ; mkdir -p "$ART" "$ART_SEC"
# F-018: INVALIDATE any stale review docs from an earlier attempt BEFORE round 1 so existence/round-cap/PASS
# checks can never be satisfied by a document that reviewed a different diff.
rm -f docs/specs/reviews/wi-487-exec-cross-model.md docs/specs/reviews/wi-487-security.md docs/specs/reviews/wi-487-gate.md
EXEC_PKG=/tmp/wi487-exec-pkg.md
{ echo "# WI-487 exec review — reviewed_code_sha=$REVIEWED_CODE_SHA base=$BASE";
  echo "## Spec + AC context"; sed -n '/### Acceptance Criteria — US-1/,/## System Dependencies/p' docs/specs/features/wi-487-durable-install-enforcement.md;
  echo '```diff'; git diff --cached "$BASE" -- $CODE_PATHS; echo '```'; } > "$EXEC_PKG"
# Run the launcher, CAPTURE its summary, VALIDATE its artifact paths, then AUTHOR + BIND the per-round review doc.
node scripts/run-external-review.mjs --orchestrator claude --review-kind exec --context-root "$PWD" --artifacts-dir "$ART" < "$EXEC_PKG" > /tmp/wi487-exec-summary.json
test -f "$ART/receipt.json" && test -f "$ART/findings.json"
node scripts/author-review-doc.mjs --kind exec --summary /tmp/wi487-exec-summary.json --receipt "$ART/receipt.json" \
  --findings "$ART/findings.json" --reviewed-code-sha "$REVIEWED_CODE_SHA" --base "$BASE" \
  --out docs/specs/reviews/wi-487-exec-cross-model.md
SEC_PKG=/tmp/wi487-sec-pkg.md
{ echo "# WI-487 SECURITY review — reviewed_code_sha=$REVIEWED_CODE_SHA base=$BASE";
  echo "## Threat model to attack: fail-open bypass of the launcher/enforcement guard, deleted-checkout fail-open, ephemeral-prefix classification evasion (symlink/realpath), forged install/denial receipts, receipt-as-authorization, denial-dedup converting deny->allow, migration overwriting unrelated host config, second-migrator boundary breach, retry-ceiling loop / rollback misuse";
  echo '```diff'; git diff --cached "$BASE" -- $CODE_PATHS; echo '```'; } > "$SEC_PKG"
node scripts/run-external-review.mjs --orchestrator claude --review-kind exec --context-root "$PWD" --artifacts-dir "$ART_SEC" < "$SEC_PKG" > /tmp/wi487-sec-summary.json
test -f "$ART_SEC/receipt.json" && test -f "$ART_SEC/findings.json"
node scripts/author-review-doc.mjs --kind security --summary /tmp/wi487-sec-summary.json --receipt "$ART_SEC/receipt.json" \
  --findings "$ART_SEC/findings.json" --reviewed-code-sha "$REVIEWED_CODE_SHA" --base "$BASE" \
  --out docs/specs/reviews/wi-487-security.md
# Author the GATE decision from BOTH review docs' dispositions (Verdict: PASS only when both bounded-exit).
node scripts/author-review-doc.mjs --kind gate --reviewed-code-sha "$REVIEWED_CODE_SHA" --base "$BASE" \
  --inputs docs/specs/reviews/wi-487-exec-cross-model.md,docs/specs/reviews/wi-487-security.md \
  --out docs/specs/reviews/wi-487-gate.md
# F-018: each doc must EXIST and mechanically BIND to THIS diff (base + package hash + request id + reviewed_code_sha) BEFORE any gate is honored.
for D in docs/specs/reviews/wi-487-exec-cross-model.md docs/specs/reviews/wi-487-security.md docs/specs/reviews/wi-487-gate.md; do
  test -f "$D"; grep -qF "reviewed_code_sha=$REVIEWED_CODE_SHA" "$D"; grep -qF "base=$BASE" "$D"
done
grep -qF "request_id=$(jq -r '.request_id' "$ART/receipt.json")" docs/specs/reviews/wi-487-exec-cross-model.md
grep -qF "package_sha256=$(jq -r '.package_sha256' "$ART/receipt.json")" docs/specs/reviews/wi-487-exec-cross-model.md
grep -qF "request_id=$(jq -r '.request_id' "$ART_SEC/receipt.json")" docs/specs/reviews/wi-487-security.md
# Mechanical bounded-exit gate (F-008): rounds_run<=3, zero unresolved Critical, every remaining High dispositioned.
node scripts/check-review-round-cap.mjs --log docs/specs/reviews/wi-487-exec-cross-model.md
node scripts/check-review-round-cap.mjs --log docs/specs/reviews/wi-487-security.md
node scripts/check-review-round-cap.mjs --log docs/specs/reviews/wi-487-gate.md
grep -qE '^Verdict: PASS$' docs/specs/reviews/wi-487-gate.md
EXEC_REQ_ID=$(jq -r '.request_id' "$ART/receipt.json"); EXEC_PKG_SHA256=$(jq -r '.package_sha256' "$ART/receipt.json"); SEC_REQ_ID=$(jq -r '.request_id' "$ART_SEC/receipt.json")
# Any accepted finding that edits code/fixtures => re-run STEP 1-2 (recompute REVIEWED_CODE_SHA) and STEP 3, incrementing rounds_run (<=3).

# ==== STEP 4 — commit the EXACT staged tree (assert reviewed==staged, staged names==declared set) ====
git add -- $(cat docs/specs/test-evidence/WI-487/declared-file-set.txt)
git diff --cached --name-only "$BASE" | sort > /tmp/wi487-staged.txt
diff -u docs/specs/test-evidence/WI-487/declared-file-set.txt /tmp/wi487-staged.txt
test "$(git diff --cached "$BASE" -- $CODE_PATHS | sha256sum | awk '{print $1}')" = "$REVIEWED_CODE_SHA"
COMMIT_MSG_FILE=/tmp/wi487-commit-msg.txt
printf 'feat(install-integrity): durable enforcement launcher + durable install source + actionable fail-closed denials across every blocking hook + all-host migration (WI-487)\n\nNon-symlinked per-user enforcement launcher, durable-canonical install\nsource, fail-closed enforcement guard, actionable deduplicated denials\nfor every blocking hook, versioned all-host first-run migration + rollback\ndelegating WI-state to WI-486. Implements AC-487-1..12.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>\nCo-Authored-By: GPT-5.6 Codex <contact-b6b620a2d4@example.invalid>\n' > "$COMMIT_MSG_FILE"
git commit -F "$COMMIT_MSG_FILE"

# ==== STEP 5 — emit TREE-BOUND receipts on HEAD; review-exec body BINDS to the real launcher artifacts ====
mkdir -p .svc/receipt-bodies
sha256sum -c .svc/receipt-bodies/plan-bodies.sha256    # plan-manifest + review-plan bodies preserved at plan convergence
cat > .svc/receipt-bodies/exec-record.json <<JSON
{"receipt_type":"exec-record","wi":"WI-487","author":"anthropic","attests":"reviewed-code-complete-pre-merge","reviewed_code_sha":"$REVIEWED_CODE_SHA","tasks_completed":["task-1","task-2","task-3","task-4","task-5","task-6a"]}
JSON
cat > .svc/receipt-bodies/audit-implementation.json <<'JSON'
{"receipt_type":"audit-implementation","wi":"WI-487","result":"pass","evidence":"docs/specs/audit/wi-487-durable-install-analysis.md"}
JSON
jq -n --arg reqid "$EXEC_REQ_ID" --arg pkg "$EXEC_PKG_SHA256" --arg secreq "$SEC_REQ_ID" --arg rcs "$REVIEWED_CODE_SHA" '{
  receipt_type:"review-exec", wi:"WI-487", author:"anthropic", reviewer:"openai", result:"pass", verdict:"pass",
  attests:"reviewed-code-complete-pre-merge", reviewed_code_sha:$rcs,
  launcher:{ request_id:$reqid, package_sha256:$pkg, artifacts:".svc/external-review-artifacts/WI-487/exec" },
  security_launcher:{ request_id:$secreq, artifacts:".svc/external-review-artifacts/WI-487/security" },
  evidence:["docs/specs/reviews/wi-487-exec-cross-model.md","docs/specs/reviews/wi-487-security.md","docs/specs/reviews/wi-487-gate.md"]
}' > .svc/receipt-bodies/review-exec.json
test "$(jq -r '.launcher.request_id' .svc/receipt-bodies/review-exec.json)" = "$(jq -r '.request_id' "$ART/receipt.json")"
test "$(jq -r '.verdict' .svc/receipt-bodies/review-exec.json)" = "pass"
for T in plan-manifest review-plan exec-record review-exec audit-implementation; do
  node scripts/emit-receipt.mjs --type "$T" --wi WI-487 --sha HEAD --body ".svc/receipt-bodies/$T.json"
done
node scripts/check-chain-receipts.mjs --sha HEAD

# ==== STEP 6 — sanctioned merge; POST-COMMIT recovery is DISTINCT from STEP 0 (F-013) ====
git fetch origin main --quiet
if [ "$(git rev-parse origin/main)" != "$BASE" ]; then
  # POST-COMMIT RECOVERY: the aggregate 6a commit + its tree-bound receipts already exist, so we do NOT
  # re-enter STEP 0 (whose no-commit precondition would fail here). Instead rebase the EXISTING commit onto
  # the advanced main — this replays a NON-EMPTY diff, never an empty one.
  git rebase origin/main
  echo "origin/main advanced DURING review — aggregate 6a commit rebased onto new base. Re-declare \$BASE in §A to $(git rev-parse origin/main), rerun STEP 1 verification and STEP 3 review on the NON-EMPTY rebased diff (new REVIEWED_CODE_SHA, rounds_run<=3), then re-emit every tree-bound receipt on the replaced commit. Aborting this pass."
  exit 2
fi
git push origin framework-WI-487-durable-install
git push origin refs/notes/svc-receipts:refs/notes/svc-receipts
PR_BODY=/tmp/wi487-pr-body.md
{ echo "## WI-487 durable installed enforcement source";
  echo "Implements AC-487-1..12. Durable non-symlinked launcher, durable install source, actionable fail-closed denials across every blocking hook, all-host migration + rollback delegating WI-state to WI-486.";
  echo "reviewed_code_sha=$REVIEWED_CODE_SHA base=$BASE"; } > "$PR_BODY"
PR=$(gh pr create --base main --head framework-WI-487-durable-install --title 'feat(install-integrity): durable installed enforcement source (WI-487)' --body-file "$PR_BODY" | grep -oE '[0-9]+$')
mkdir -p .svc/review-receipts
printf '{"pr":%s,"wi":"WI-487","reviewed_at":"%s","review_gate_task":"WI-487 review-exec","reviewer":"gpt-5.6-sol high","result":"PASS","review_gate_required":true,"evidence":["docs/specs/reviews/wi-487-exec-cross-model.md","docs/specs/reviews/wi-487-security.md","docs/specs/reviews/wi-487-gate.md"]}\n' "$PR" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ".svc/review-receipts/pr-$PR.json"
node scripts/validate-review-receipt.mjs --pr "$PR"
node scripts/merge-pr-with-review-receipt.mjs --pr "$PR" --squash --delete-branch
MERGE_SHA=$(gh pr view "$PR" --json mergeCommit --jq .mergeCommit.oid)

# ==== STEP 7 — RE-EMIT the 5-receipt envelope onto the squash MERGE_SHA ====
git fetch origin main --quiet
sha256sum -c .svc/receipt-bodies/plan-bodies.sha256
for T in plan-manifest review-plan exec-record review-exec audit-implementation; do
  node scripts/emit-receipt.mjs --type "$T" --wi WI-487 --sha "$MERGE_SHA" --body ".svc/receipt-bodies/$T.json"
done
node scripts/check-chain-receipts.mjs --sha "$MERGE_SHA"
for attempt in 1 2 3 4 5; do
  if git push origin refs/notes/svc-receipts:refs/notes/svc-receipts; then break; fi
  git fetch origin refs/notes/svc-receipts:refs/notes/svc-receipts-remote || true
  git notes --ref svc-receipts merge -s cat_sort_uniq refs/notes/svc-receipts-remote || true
  [ "$attempt" = 5 ] && { echo "notes push failed after 5 attempts"; exit 1; }
done

# ==== STEP 8 (task-6b) — bootstrap a FRESH ISOLATED 6b worktree; run promoted verify INSIDE it ====
VP_WT=$(node scripts/svc-ensure-worktree.mjs --wi WI-487 --branch framework-WI-487-verify-promotion --base origin/main --json | jq -r '.absolute_worktree')
( cd "$VP_WT" && git fetch origin main --quiet && git reset --hard origin/main )
mkdir -p "$VP_WT/docs/specs/verification" "$VP_WT/docs/specs/test-evidence/WI-487"
# Promoted verify uses the SAME env-red-set predicate + baseline cause map (F-006/F-019), not 246/2/0:
( cd "$VP_WT" && export -f rg 2>/dev/null || true;
  if bash test-framework/evals/run-all-evals.sh --tier1 > /tmp/wi487-vp-tier1.out 2>&1; then :; fi
  node scripts/check-tier1-env-red-set.mjs --results /tmp/wi487-vp-tier1.out \
    --baseline docs/specs/test-evidence/WI-487/env-red-baseline.json \
    --env-red validate-agy-launcher.sh,validate-codex-execution-integrity.sh \
    --require-pass validate-actionable-hook-denial.sh,validate-all-host-install-migration.sh )
cp /tmp/wi487-vp-tier1.out "$VP_WT/docs/specs/verification/wi-487-promotion.md"

# ==== STEP 8.5 (task-6b) — AUTHOR the lifecycle-closure files IN $VP_WT BEFORE staging (F-014) ====
# The fresh worktree was reset to origin/main and contains NONE of the 6b closure changes. A single
# 6b-closure authoring tool (merged in 6a, present on origin/main) writes BOTH evidence artifacts, flips
# WI + INDEX status to VERIFIED, closes the lane graph with phase receipts, and syncs feature-spec AC
# evidence. NOTHING is staged until this authoring has produced + verified every file.
node scripts/emit-6b-closure.mjs --wi WI-487 --root "$VP_WT" --base "$BASE" --merge-sha "$MERGE_SHA" \
  --tier1-results /tmp/wi487-vp-tier1.out \
  --evidence-frozen docs/specs/test-evidence/WI-487/post-change-tier1-frozen.md \
  --evidence-prepost docs/specs/test-evidence/WI-487/pre-post-evidence.json \
  --verification docs/specs/verification/wi-487-promotion.md
# Verify the AUTHORED state BEFORE any git add (F-014 — no blind stage):
test -s "$VP_WT/docs/specs/test-evidence/WI-487/post-change-tier1-frozen.md"
test -s "$VP_WT/docs/specs/test-evidence/WI-487/pre-post-evidence.json"
grep -qE 'VERIFIED' "$VP_WT/docs/specs/work-items/WI-487.md"
grep -qE 'WI-487' "$VP_WT/docs/specs/work-items/INDEX.md"
node scripts/task-graph.mjs validate "$VP_WT/.svc/lane-tasks-WI-487.json"

# ==== STEP 9 (task-6b) — SEPARATE verify-promotion PR through the SANCTIONED CHAIN with 6b's OWN receipts (F-009) ====
# 9.1 stage the lifecycle-closure set + evidence
git -C "$VP_WT" add -- docs/specs/work-items/WI-487.md docs/specs/work-items/INDEX.md .svc/lane-tasks-WI-487.json \
  docs/specs/test-evidence/WI-487/post-change-tier1-frozen.md docs/specs/test-evidence/WI-487/pre-post-evidence.json \
  docs/specs/verification/wi-487-promotion.md docs/specs/features/wi-487-durable-install-enforcement.md
# 9.2 temp message/body files (defined, not referenced-before-creation)
VP_MSG=/tmp/wi487-vp-msg.txt
printf 'docs(WI-487): verify promotion — status VERIFIED, lane-tasks closed (G7)\n\nVerify-promotion follow-up for WI-487 on promoted origin/main.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>\n' > "$VP_MSG"
VP_BODY=/tmp/wi487-vp-body.md
printf 'Verify-promotion follow-up for WI-487. Records merged/VERIFIED lifecycle state OUTSIDE 6a tree.\n' > "$VP_BODY"
git -C "$VP_WT" commit -F "$VP_MSG"
# 9.3 build 6b's OWN 5-receipt envelope INSIDE $VP_WT, BOUND to the 6b change (F-015).
# .svc/receipt-bodies is gitignored, so it is ABSENT in the fresh worktree.
mkdir -p "$VP_WT/.svc/receipt-bodies"
# (a) COPY ONLY the reusable plan-level bodies from the 6a worktree, checksum-VERIFIED (no || true):
cp "$ROOT/.svc/receipt-bodies/plan-manifest.json" "$ROOT/.svc/receipt-bodies/review-plan.json" \
   "$ROOT/.svc/receipt-bodies/plan-bodies.sha256" "$VP_WT/.svc/receipt-bodies/"
( cd "$VP_WT" && sha256sum -c .svc/receipt-bodies/plan-bodies.sha256 )
# (b) BIND a 6b-specific hash over the committed 6b diff + its verification evidence:
SHA_6B_DIFF=$( ( cd "$VP_WT" && git diff origin/main HEAD ) | sha256sum | awk '{print $1}')
VP_EVIDENCE_SHA=$(sha256sum "$VP_WT/docs/specs/verification/wi-487-promotion.md" \
  "$VP_WT/docs/specs/test-evidence/WI-487/post-change-tier1-frozen.md" \
  "$VP_WT/docs/specs/test-evidence/WI-487/pre-post-evidence.json" | sha256sum | awk '{print $1}')
BOUND_6B="${SHA_6B_DIFF}:${VP_EVIDENCE_SHA}"
# (c) RE-EMIT exec-record / review-exec / audit bodies bound to the 6b change (NOT the reused 6a bodies):
cat > "$VP_WT/.svc/receipt-bodies/exec-record.json" <<JSON
{"receipt_type":"exec-record","wi":"WI-487","author":"anthropic","attests":"verify-promotion-lifecycle-closure","bound_6b":"$BOUND_6B","tasks_completed":["task-6b"]}
JSON
cat > "$VP_WT/.svc/receipt-bodies/audit-implementation.json" <<JSON
{"receipt_type":"audit-implementation","wi":"WI-487","result":"pass","bound_6b":"$BOUND_6B","evidence":"docs/specs/verification/wi-487-promotion.md"}
JSON
cat > "$VP_WT/.svc/receipt-bodies/review-exec.json" <<JSON
{"receipt_type":"review-exec","wi":"WI-487","author":"anthropic","reviewer":"openai","result":"pass","verdict":"pass","attests":"verify-promotion-lifecycle-closure","bound_6b":"$BOUND_6B","evidence":["docs/specs/verification/wi-487-promotion.md"]}
JSON
for T in plan-manifest review-plan exec-record review-exec audit-implementation; do
  ( cd "$VP_WT" && node scripts/emit-receipt.mjs --type "$T" --wi WI-487 --sha HEAD --body ".svc/receipt-bodies/$T.json" )
done
( cd "$VP_WT" && node scripts/check-chain-receipts.mjs --sha HEAD )
# 9.4 push + open PR + PR review-gate receipt + validate + sanctioned merge
git -C "$VP_WT" push origin framework-WI-487-verify-promotion
git -C "$VP_WT" push origin refs/notes/svc-receipts:refs/notes/svc-receipts
PR_VP=$(cd "$VP_WT" && gh pr create --base main --head framework-WI-487-verify-promotion --title 'docs(WI-487): verify promotion — status VERIFIED, lane-tasks closed (G7)' --body-file "$VP_BODY" | grep -oE '[0-9]+$')
( cd "$VP_WT" && mkdir -p .svc/review-receipts && printf '{"pr":%s,"wi":"WI-487","reviewed_at":"%s","review_gate_task":"WI-487 verify-promotion","reviewer":"gpt-5.6-sol high","result":"PASS","review_gate_required":true,"evidence":["docs/specs/verification/wi-487-promotion.md"]}\n' "$PR_VP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ".svc/review-receipts/pr-$PR_VP.json" )
( cd "$VP_WT" && node scripts/validate-review-receipt.mjs --pr "$PR_VP" )
( cd "$VP_WT" && node scripts/merge-pr-with-review-receipt.mjs --pr "$PR_VP" --squash --delete-branch )
MERGE_SHA_6B=$(cd "$VP_WT" && gh pr view "$PR_VP" --json mergeCommit --jq .mergeCommit.oid)
# 9.5 re-emit 6b envelope on its squash MERGE_SHA_6B + emit verify-promotion citing the in-repo verification record
( cd "$VP_WT" && git fetch origin main --quiet && sha256sum -c .svc/receipt-bodies/plan-bodies.sha256 )
for T in plan-manifest review-plan exec-record review-exec audit-implementation; do
  ( cd "$VP_WT" && node scripts/emit-receipt.mjs --type "$T" --wi WI-487 --sha "$MERGE_SHA_6B" --body ".svc/receipt-bodies/$T.json" )
done
( cd "$VP_WT" && node scripts/emit-receipt.mjs --type verify-promotion --wi WI-487 --sha "$MERGE_SHA_6B" --body <(printf '{"receipt_type":"verify-promotion","wi":"WI-487","result":"pass","evidence":"docs/specs/verification/wi-487-promotion.md"}') )
( cd "$VP_WT" && node scripts/check-chain-receipts.mjs --sha "$MERGE_SHA_6B" )
for attempt in 1 2 3 4 5; do
  if ( cd "$VP_WT" && git push origin refs/notes/svc-receipts:refs/notes/svc-receipts ); then break; fi
  ( cd "$VP_WT" && git fetch origin refs/notes/svc-receipts:refs/notes/svc-receipts-remote || true; git notes --ref svc-receipts merge -s cat_sort_uniq refs/notes/svc-receipts-remote || true )
  [ "$attempt" = 5 ] && { echo "6b notes push failed after 5 attempts"; exit 1; }
done
```

`RECOVERY_IF_FAIL`: keep the isolated worktree and every fixture artifact needed to explain the failure. Correct only the current task, rerun its focused validators, then replay every downstream task. Any accepted code/fixture finding re-runs STEP 1-2 (new `REVIEWED_CODE_SHA`) and STEP 3, incrementing `rounds_run` (never past 3). If the freshness gate exits 2, `origin/main` advanced and the sanctioned recovery is procedure-specific (F-013): STEP 0 (PRE-FREEZE, implementation uncommitted) preserves all tracked+untracked work via a verified stash, rebases the clean tree, restores, re-verifies, re-declares `$BASE`, and restarts from STEP 1 — never hashing an empty diff; STEP 6 (POST-COMMIT, the aggregate 6a commit + receipts exist) does NOT re-enter STEP 0 but rebases the EXISTING commit onto the new base, then reruns STEP 1 verification, re-runs STEP 3 review on the NON-EMPTY rebased diff, and re-emits every tree-bound receipt on the replaced commit. The whole sequence runs `set -euo pipefail` (G1); any failed gate aborts it. No verification bypass or force operation is allowed.

## Checkpoint Plan

| Order | Checkpoint | Rollback anchor | Required proof |
|---:|---|---|---|
| 1 | `wi487-red-contract` | `$BASE` | new+extended fixtures fail on NAMED expected-red markers; `ENV_RED_SET` baseline + provenance recorded; declared-file-set + blocking-hook-inventory generated |
| 2 | `wi487-durable-launcher` | checkpoint 1 | launcher COPIED (not symlinked); deleted-checkout → fail-closed deny + home-local receipt; ephemeral refusal + durable materialization; extended canonical-resolution + double-dead-pointer green; install receipt schema parses |
| 3 | `wi487-actionable-denial` | checkpoint 2 | denial identity/receipt/dedup/never-fail-open; EVERY inventoried blocking hook actionable; both guards fail-closed on dangling |
| 4 | `wi487-all-host-migration` | checkpoint 3 | dynamic inventory, failpoint rollback, resume, idempotent no-op, `--rollback` restore, N=3 ceiling→terminal, WI-486 delegation (no self graph write) |
| 5 | `wi487-green` | checkpoint 4 | full Tier-1 `FAILED_IDS ⊆ ENV_RED_SET`, causes unchanged; new validators PASS |
| 6a | `wi487-frozen-branch` | checkpoint 5 | §Command Sequence steps 0–7: pre-stage freshness, verify, distinct exec+security reviews under 3-round cap, tree-bound receipts, sanctioned merge, re-emit envelope |
| 6b | `wi487-verified` | checkpoint 6a | §Command Sequence steps 8–9: own worktree + promoted verify (env-red-set predicate), sanctioned-chain PR with own envelope + review-gate receipt, status→VERIFIED, lane graph closed, verify-promotion on 6b's merge SHA |

Logical checkpoints are recorded in progress.md; implementation remains uncommitted until task-6a freezes one aggregate diff.

## Rollback

Before merge, any change after a failed checkpoint invalidates that checkpoint and every downstream proof; correct the current task, replay dependents, and freeze a new `REVIEWED_CODE_SHA`.

After merge, rollback is TWO coupled operations because the migration is EXTERNAL (host config + home-local state) and `git revert` alone cannot undo it (F-004). **Ordering is load-bearing (F-020): the external-state rollback CLI must be invoked while it still EXISTS in the tree — the code revert deletes `scripts/svc-migrate-install.mjs`, so it CANNOT be the thing that runs the rollback afterward.** Two sanctioned orderings satisfy this; pick ONE:

1. **External-state revert FIRST (default).** Run `scripts/svc-migrate-install.mjs --rollback --host <host>` (or `--all-hosts`) from the CURRENT tree (WI-487 still merged, CLI present) BEFORE opening/merging the code-revert PR. It (a) checks a precondition digest that the host's current install matches the post-migration state it recorded (refusing to rollback an already-diverged host absent an explicit owner override flag, which is out of scope), (b) atomically restores the pre-migration host config + hook wiring from `~/.svc/install-migrations/v<version>/<host>/backup/`, (c) removes the version-scoped launcher/enforcement-core dir it created (a prior version, if any, remains runnable), (d) verifies hooks/skills resolve to the restored source, and (e) is idempotent — a second `--rollback` on an already-rolled-back host is a byte no-op. **Record per-host `--rollback` results (success/precondition-refusal/partial) as a HARD PREREQUISITE; the code-revert PR does not merge until every targeted host is confirmed restored.**
2. **Pinned-worktree alternative.** If the code revert has already merged, execute the rollback CLI from a worktree pinned at the WI-487 merge SHA (`git worktree add <dir> <WI-487-merge-sha>`), where `scripts/svc-migrate-install.mjs` still exists, then run the same `--rollback` and record per-host results.

2b. **Code revert.** A normal revert PR reverting BOTH the verify-promotion follow-up commit (6b) and the implementation commit (6a) restores the prior (fail-open) `setup`/healthcheck/drift/guard behavior and removes bin/svc-enforce.mjs, hooks/lib/enforcement-core.mjs, hooks/lib/durable-source.mjs, hooks/lib/hook-denial.mjs, scripts/svc-migrate-install.mjs, scripts/check-tier1-env-red-set.mjs, the review/inventory/closure helpers, the two schemas, the two new validators, the `.gitignore` runtime-dir entries, the blocking-hook `emitDenial` adoptions, and the fixture extensions together — merged ONLY after the external-state revert (1 or 2) has recorded per-host success.

No WI-state data migration is undone by WI-487 because WI-487 never rewrites a graph (it delegates to WI-486, whose own `--restore` is the graph-state rollback path if any migration ran). Do not reset or force push. Running only the code revert leaves installed hosts pointing at a launcher/source the reverted framework no longer ships; the external-state revert MUST run (and be per-host verified) FIRST, or from a pinned worktree at the merge SHA.

## Framework-Lane Compliance

Every mandatory upstream framework-lane skill is completed with a cited artifact (lane-tasks `WI-487`):

| Upstream skill | Status | Artifact citation |
|---|---|---|
| improve-framework | completed | `proposals/2026-07-15-framework-improvement-durable-install-source.md` (accepted gap + evidence) |
| diagnose-bug | completed | proposal §Evidence + §Relationship to existing controls (observed fail-open + opaque-`code 1` storm + legacy-machine loop; distinguished from WI-485) |
| write-spec | completed | `docs/specs/features/wi-487-durable-install-enforcement.md` (BASELINED; AC-487-1..12; passes validate-industry-grounding-section) |
| design-tech | completed | `docs/specs/decisions/wi-487-durable-install-enforcement.md` (D-1..D-12; G4 PASS; launcher/rollback/resolver/boundary/WI-486-delegation resolved) |
| plan-changeset | completed | this manifest |
| review-plan | in progress | round-1 gpt-5.6-sol/high review returned 12 findings (1C/9H/2M); this revision resolves F-001..F-012; rounds/dispositions persisted in review-log.yaml, gated by check-review-round-cap.mjs (<=3 rounds) |

No mandatory upstream skill is skipped; none is asserted without a cited artifact. Legacy WI-state transformation is DELEGATED to WI-486 (AC-487-11) and no second migrator is planned.

## Adversarial Self-Review

1. **Missing tasks:** PASS — AC-487-1..12 map to implementing tasks; the durable launcher (task-2) closes the self-reference defect; the inventory (task-3) closes every blocking-hook surface.
2. **Dependency correctness:** PASS — red fixtures precede the launcher; the launcher precedes the denial helper and guards; migration consumes both; freeze follows all runtime work.
3. **Scope reduction:** PASS — the full accepted contract plus the round-1 launcher/inventory/rollback expansions are planned; WI-486's session-authority/bootstrap/graph-migration remain a named boundary.
4. **Validation strength:** PASS — failpoint, schema, replay, inventory, rollback, deleted-checkout, and negative fixtures; the AC-487-11 grep invariant and the env-red-set predicate are hard gates; syntax checks are secondary.
5. **First-task viability:** PASS — task-1 needs only `$BASE`, the committed spec/decisions, this manifest, and the two existing validators.
6. **Pattern completeness:** PASS — durability negatives cover `/tmp`/`$TMPDIR`/`/dev/shm`/`/var/tmp`/worktree/dangling/deleted-checkout; denial negatives cover anonymous exit / empty stderr / duplicate / dedup-never-allows / uncovered-inventory-hook; migration negatives cover partial host / interrupt / third-run no-op / rollback / N=3-ceiling / absent-WI-486 / unsupported-state.
7. **Boundary integrity:** PASS — AC-487-11 delegation is grep-verifiable; no lane-tasks write in WI-487 code.
8. **Baseline honesty:** PASS — the authoritative predicate is the named `ENV_RED_SET`; counts are provenance only; a NEW content failure or a changed env-red cause fails.
9. **Fail-fast + verdict gating:** PASS — the land runs `set -euo pipefail`; the review gate is the mechanical 3-round bounded-exit cap (check-review-round-cap.mjs), not zero-High.
10. **Fail-closed safety:** PASS — the launcher denies (never allows) even on a deleted checkout; dedup suppresses output but keeps the deny; the N=3 ceiling terminates fail-closed (never fail-open); receipts are evidence-only, never authorization.

## Promotion Readiness Checklist

- [ ] Every planned runtime, test, schema, evidence, state, and lifecycle file is in `declared-file-set.txt`.
- [ ] AC-487-1..12 have passing deterministic proof and spec evidence.
- [ ] The durable launcher is a COPIED (non-symlinked) real file materialized alongside a byte/hash-verified copy of the canonical enforcement-core it imports (ONE `resolveStateRoot`/`denialStateDigest`/receipt-validation/atomic-write impl, no live-checkout dependency); deleting the complete source checkout still yields a fail-closed DENY + home-local receipt; every governed hook runs through it.
- [ ] Ephemeral/worktree/dangling sources are refused or materialized to canonical main; legitimate `.worktrees/` dev still resolves.
- [ ] EVERY blocking hook in `blocking-hook-inventory.txt` emits id+reason+op+recovery through the shared helper; no anonymous `code 1` remains; stderr-swallowing hosts recover from the durable home-local receipt.
- [ ] One per-host install receipt (via the single state-root resolver) records the shared effective source + launcher; repeated setup/migration is a byte no-op preserving unrelated config; receipts are evidence-only (re-realpath live).
- [ ] Denial dedup keys on the exported `denialStateDigest` (enforcement-relevant state only); repeats dedup output without weakening the deny.
- [ ] First-run migration dynamically inventories every provision/hosts/*.json; per-host transaction rolls back cleanly; interrupted run resumes; third run is a byte no-op; `--rollback` restores from backups; per-host before/after reported.
- [ ] Retry ceiling is N=3 per `retry_key`; attempt 3 writes a terminal record and stops; a changed `pre_state_digest`/`migration_version` starts a new key; one recovery command clears the terminal record after verifying repair.
- [ ] Legacy WI-state delegates to WI-486; grep proves no lane-tasks graph write in WI-487; absent/unsupported state ends fail-closed without a retry loop.
- [ ] Full Tier-1 `FAILED_IDS ⊆ ENV_RED_SET` checked against the machine-readable env-red baseline cause map (validator_id → cause_class + digest, exact-match); the two new validators PASS; counts are provenance only.
- [ ] The STRUCTURED blocking-hook inventory `{hook_id, repo_path, installed_command, disposition}` maps every row to exactly one reviewed repo file or an explicit non-file disposition; staging/hashing consume only the derived normalized repo-path list.
- [ ] Each external-review document is PRODUCED from its launcher summary and BINDS to the reviewed diff (reviewed_code_sha + base + request_id + package_sha256) and passes check-review-round-cap.mjs before the PASS gate; stale docs are invalidated before round 1.
- [ ] 6b authors both evidence artifacts, flips WI + INDEX to VERIFIED, closes the lane graph, and syncs feature evidence BEFORE staging; the 6b receipt envelope is regenerated inside the 6b worktree bound to the staged 6b diff + verification evidence (only plan bodies are copied, checksum-verified).
- [ ] Post-merge rollback runs+verifies the external `--rollback` (recording per-host results) BEFORE the code revert merges, or executes it from a worktree pinned at the WI-487 merge SHA.
- [ ] The origin/main freshness gate runs BEFORE staging/review; if main advances the base is re-declared via the sanctioned rebase and verification reruns; no empty staged diff is ever hashed.
- [ ] Plan receipts (plan-manifest, review-plan) exist at plan convergence and re-attach to HEAD then MERGE_SHA; `check-chain-receipts` complete on both; review-log.yaml passes check-review-round-cap.mjs (<=3 rounds).
- [ ] Review-exec, review-security, review-gate evaluate the same `REVIEWED_CODE_SHA`; security uses a DISTINCT hashed package; each persists rounds + dispositions.
- [ ] Separate verify-promotion PR (6b) went through the sanctioned chain with its OWN 5-receipt envelope + PR review-gate receipt; ran in its OWN worktree; `verify-promotion` emitted on 6b's merge SHA.
- [ ] Post-merge rollback couples the code revert PR with `svc-migrate-install.mjs --rollback` (external-state revert); running only the code revert is insufficient.
