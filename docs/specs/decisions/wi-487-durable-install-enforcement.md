# Design Decisions: WI-487 durable installed enforcement source

## Session Mode: auto

The owner supplied and accepted the complete behavior contract (AC-487-1..12 in `proposals/2026-07-15-framework-improvement-durable-install-source.md`) and authorized end-to-end delivery. These choices select the implementation shape without reopening the required behaviors. Every decision preserves the WI-486/WI-487 boundary: WI-486 owns session-authority, atomic worktree bootstrap, and task-state graph classification/migration; WI-487 owns durable install source, a durable non-symlinked enforcement launcher, fail-closed enforcement, actionable denial across every blocking hook, and all-host install migration + rollback, and INVOKES WI-486's compatibility contract without inventing a second graph migrator.

**Round-1 plan review (gpt-5.6-sol/high) added D-10 (durable enforcement launcher — resolves the CRITICAL self-reference defect F-001), D-11 (single state-root resolver + receipts-as-evidence-only, F-011), and D-12 (versioned external install rollback, F-004), and tightened D-5 (pinned `denialStateDigest` contract, F-010) and D-8 (pinned N=3 retry ceiling, F-005). The reviewer adjudicated the six open design questions: keep durable-source / hook-denial / migration CLI SEPARATE (module boundaries differ); suppress-duplicate-output-but-keep-DENY is correct (reuse only a generic WI-486 digest primitive if its input contract fits, never its advisory/allow disposition); `~/.svc/install-state` is correct IF all consumers share one resolver and receipts are observational; denial receipts are home-local; retry ceiling N=3 per `{migration_version, host_id, pre_state_digest}`. All folded in below.**

**Round-2 plan review (gpt-5.6-sol/high) confirmed the round-1 architecture holds and found NO Critical; it raised one DESIGN finding (F-016) plus seven execution defects (F-013..F-015, F-017..F-020). F-016 resolved the launcher self-containment vs. single-implementation tension by extracting a canonical `hooks/lib/enforcement-core.mjs` module (the ONE implementation of `resolveStateRoot`, `denialStateDigest`, receipt validation, and the atomic denial write) that setup MATERIALIZES — copies, byte/hash-verified, versioned — alongside the launcher under `~/.svc/enforcement/<migration_version>/lib/`, so the installed launcher imports ONLY materialized files and never the live checkout, while the in-repo module stays the single source of truth every repo-side consumer imports. D-10 and D-11 are updated below; D-5's exported digest now lives in `enforcement-core.mjs` and `hook-denial.mjs` re-exports it. The remaining execution defects (F-013 dual freshness-recovery, F-014 6b authoring-before-staging, F-015 6b-bound receipt envelope, F-017 structured blocking-hook inventory, F-018 review-document production/binding, F-019 env-red baseline cause map, F-020 rollback ordering) are fixed in the manifest's §A, Files Planned, §F-002, Execution Command Sequence, and Rollback sections.**

## D-1: Definition of "durable canonical source"

**Phase:** design-tech
**Decided:** a source is durable iff its realpath exists, is executable/readable, is NOT under an ephemeral prefix (`/tmp`, `$TMPDIR`, `/dev/shm`, `/var/tmp`) or a `/.worktrees/` path, and equals the git-common-dir main checkout; classification is a pure predicate reused by setup, healthcheck, and the mutation guards.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Predicate over realpath + ephemeral-prefix + worktree + git-common-dir | Single-sources "canonical" with `setup`'s existing resolution; reused by every consumer; hermetically testable | Must enumerate ephemeral prefixes explicitly |
| 2 | Separate content-addressable install store (npm/Nix style) | Strong immutability guarantee | Huge new surface; svc already symlinks every host into ONE canonical checkout, so a second store is redundant |
| 3 | Trust `.source-repo` pointer only | Minimal code | Pointer itself can be worktree/ephemeral (the exact observed bug) |
| 4 | Mtime/age heuristic for "durable" | No path knowledge needed | A fresh `/tmp` source looks durable; false negatives on legitimately old worktrees |
| 5 | Refuse ALL non-main-checkout sources unconditionally | Simplest fail-closed | Breaks legitimate `.worktrees/` development (AC-487-4) |

**Chosen:** #1 because the canonical main checkout is already the framework's single durable artifact; a pure predicate over it satisfies AC-487-1/2/4 and single-sources the definition with `setup`'s `git rev-parse --git-common-dir` logic.

## D-2: Loss-of-enforcement disposition (fail-open vs fail-closed)

**Phase:** design-tech
**Decided:** a governed-mutation guard whose own installed enforcement source is dangling/non-executable/ephemeral-vanished returns a VISIBLE FAIL-CLOSED deny; it never silently allows. The session-start healthcheck keeps its never-block contract, but the mutation-path enforcement guard is a distinct, fail-closed pre-check with no fail-open flag.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Fail-closed deny on the mutation path; healthcheck stays never-block for self-heal | Matches OPA/systemd/admission-controller defaults; loss of a safety control becomes visible, not silent | Governed mutation stalls until repair (the correct, safe behavior) |
| 2 | Extend the existing healthcheck to block | Fewer files | Healthcheck runs at SessionStart, not on every mutation; blocking there breaks session start and still misses per-tool-call loss |
| 3 | Warn-only on dangling enforcement | Non-disruptive | This IS the current fail-open bug — a warning is not enforcement |
| 4 | Auto-repair inline on the mutation path then allow | Seamless | A mutation hook that self-installs gains write authority and can loop; repair belongs to setup/migration under a ceiling |
| 5 | Global fail-open env override for emergencies | Escape hatch | A fail-open flag on a security guard is exactly the defect being removed; refused |

**Chosen:** #1 because a safety control that disappears silently is the fail-open defect WI-487 exists to close; the fix is a fail-closed default on the governed-mutation path, independent of the never-block self-heal.

## D-3: One recorded effective source shared by hooks and skills

**Phase:** design-tech
**Decided:** setup and the migration write ONE per-host install receipt (`~/.svc/install-state/<host>.json`, 0600) recording the single effective resolved source, its durability class, framework commit, and hooks/skills coverage; repair of hooks and skills is one transaction keyed to that receipt.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | One per-host receipt naming the shared effective source | Satisfies AC-487-5 directly; hooks+skills repair coherently; idempotency is a byte-compare against the receipt | One small machine-local file per host |
| 2 | Separate hook-source and skill-source records | More granular | Lets hooks and skills drift to different sources — the split-source failure class the AC forbids |
| 3 | Infer source at read time, store nothing | No new file | No before/after evidence (AC-487-10); every reader re-derives and can disagree |
| 4 | Store receipt in the repo (`.svc/`, tracked) | Durable in git | Machine-specific paths pollute every PR; must be gitignored/home-local |

**Chosen:** #1 because AC-487-5 requires hooks and skills to be one installed surface with one recorded effective source, and the receipt is also the idempotency/before-after anchor for AC-487-6/10.

## D-4: Actionable-denial diagnostic contract and stderr-swallowing hosts

**Phase:** design-tech
**Decided:** a shared `hooks/lib/hook-denial.mjs` helper every blocking hook calls, emitting `{hook_id, reason_code, cause, operation, recovery}` as both machine-readable and human-readable output, ALSO writing a durable per-session receipt (0600 under `.svc/denial-receipts/`) whose lookup path is embedded in the shortest host-visible message; hosts that swallow stderr recover from the receipt.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Shared helper + durable per-session receipt + short message with reason code + lookup path | Satisfies AC-487-7/7A in one place; every hook inherits the same actionable shape; stderr-swallowing hosts have a durable fallback | Every blocking hook must be wired to call it |
| 2 | Per-hook ad-hoc diagnostic strings | No shared module | Drifts across hooks; the anonymous-`code 1` bug recurs per hook |
| 3 | stdout JSON only, no receipt | Simplest | Hosts that swallow BOTH streams show nothing; AC-487-7A unmet |
| 4 | Central daemon collecting denials | Rich querying | A background service violates the zero-dependency, no-background-job red line |

**Chosen:** #1 because AC-487-7/7A require one stable, durable, host-visible diagnostic surface, and a shared helper is the only way to guarantee every blocking hook renders it identically.

## D-5: Denial deduplication without converting deny into allow

**Phase:** design-tech
**Decided:** dedup denials by the exported `denialStateDigest` (see the pinned contract below); the first occurrence is actionable, an identical repeat SUPPRESSES OUTPUT ONLY and returns the SAME deny (`deduped:true`); the denial is never downgraded to allow. This is explicitly DISTINCT from WI-486's compatibility marker, which is permitted to downgrade to advisory/allow on repeat.
**By:** AI (auto)

**Pinned `denialStateDigest` contract (F-010 round-1; canonical-core home fixed F-016 round-2).** There is exactly ONE implementation of `denialStateDigest(state)`, and it lives in the canonical `hooks/lib/enforcement-core.mjs` module; `hooks/lib/hook-denial.mjs` re-exports it (never re-implements) so every repo-side consumer and the MATERIALIZED launcher compute byte-identical digests. It is the SHA-256 of a canonical (sorted-key, no-whitespace) JSON object containing ONLY enforcement-relevant state: `{ resolved_command_path, target_exists, target_executable, effective_source, source_or_receipt_class, hook_id, reason_code }`. Timestamps, output text, pids, and any wall-clock field are EXCLUDED so the digest is stable cross-process. **Reuse rule:** WI-486's `stateIdentityDigest` primitive is reused ONLY if it is a generic exported canonical-JSON digest whose input contract accepts exactly this field set with identical canonicalization semantics; if it couples any WI-486-specific field or disposition behavior, WI-487 defines its own `denialStateDigest`. WI-486's `recordDisposition` (advisory/allow-on-repeat) is NEVER reused — it would fail a security denial open. The launcher's deny path imports the MATERIALIZED `enforcement-core.mjs` (copied alongside it under `~/.svc/enforcement/<migration_version>/lib/`), so it computes the same digest and a deleted-checkout denial dedups identically WITHOUT depending on the vanished checkout and WITHOUT a second inlined digest implementation (F-016).

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Dedup OUTPUT, keep DENY, key on state digest | Stops the message storm (AC-487-8) while never weakening enforcement; a real state change → new digest → one new actionable denial | Needs a per-session digest store (reuses WI-486's digest pattern) |
| 2 | Reuse WI-486 `recordDisposition` verbatim | Zero new code | WI-486 downgrades to advisory/allow on repeat — correct for a compatibility diagnosis, WRONG for a security denial (would fail open) |
| 3 | Rate-limit by time window | Simple | A time window can either drop a real new denial or let the storm through; digest keying is exact |
| 4 | No dedup | Simplest | The observed opaque-`code 1` storm persists |

**Chosen:** #1 because AC-487-8 mandates dedup "without converting the denial into permission" — the deny must remain in force; only the repeated OUTPUT is suppressed. The pinned `denialStateDigest` key (above) admits exactly one new actionable denial per real change, is stable cross-process (no timestamps), and reuses WI-486's digest primitive ONLY under the strict input-contract match stated in the pinned contract — never its advisory disposition.

## D-6: All-host first-run migration — dynamic inventory, transactional, bounded

**Phase:** design-tech
**Decided:** a separate versioned CLI `scripts/svc-migrate-install.mjs` that globs `provision/hosts/*.json` dynamically (no hard-coded host list) and, per host, snapshots config → classifies source → repoints to durable canonical → verifies → writes before/after receipt; transactional (per-host backup + reverse rollback), resumable (per-host completion marker), bounded (hard host-attempt ceiling → fail-closed terminal), idempotent (converged host = byte no-op).
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Separate versioned CLI, dynamic glob, per-host transaction | Satisfies AC-487-9/10/12; dynamic inventory can't miss a host; each host repairs atomically with rollback | A new CLI + schema |
| 2 | Hard-code the 8 current hosts | Explicit | A future 9th host silently missed (the exact AC-487-9 failure) |
| 3 | Repair only the active host inline in setup | Fewer files | Leaves other hosts' stale/ephemeral installs unrepaired; no all-host convergence |
| 4 | Auto-migrate inside the session-start hook | Seamless | Hook gains broad write authority and can loop; migration belongs to a bounded, resumable CLI the hook INVOKES under a ceiling |

**Chosen:** #1 because AC-487-9 requires dynamic inventory of every declared host and AC-487-10/12 require a transactional, resumable, bounded, idempotent migration — properties that belong in a dedicated CLI, not inline in a hook or hard-coded in setup.

## D-7: Legacy WI-state alignment — DELEGATE to WI-486 (no second migrator)

**Phase:** design-tech
**Decided:** in the same first-run pass, `svc-migrate-install.mjs` aligns legacy WI state by IMPORTING WI-486's `hooks/lib/task-state-compatibility.mjs` to classify graphs and, for migratable state, shelling out to `scripts/svc-migrate-task-state.mjs --wi <n> --authorization <file>`; it performs NO graph transformation itself. If the WI-486 contract is absent or the state is unsupported, it records an actionable fail-closed terminal result and stops — no retry loop. Grep invariant: no lane-tasks graph write exists in `svc-migrate-install.mjs`.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Delegate classification + migration to WI-486; fail-closed terminal if unavailable | Satisfies AC-487-11 exactly; one backed-up receipted graph-rewrite path in the framework; grep-verifiable no-self-write | Hard dependency on WI-486 being merged first |
| 2 | Re-implement a small WI-state migrator in WI-487 | Independent of WI-486 timing | Violates AC-487-11 and the memory note "never invent a second graph migrator"; two rewrite paths drift |
| 3 | Skip WI-state alignment entirely | Simplest | Leaves the legacy-machine loop (the observed incident) unfixed |
| 4 | Retry WI-state migration until it succeeds | "Eventually consistent" | Unbounded retry is the exact loop AC-487-12 forbids |

**Chosen:** #1 because AC-487-11 mandates delegation to WI-486's compatibility contract and an actionable fail-closed terminal (not a retry) when it is unavailable; a second migrator is explicitly prohibited.

## D-8: Retry ceiling and fail-closed terminal state

**Phase:** design-tech
**Decided:** every first-run/PreToolUse/Stop path carries a hard retry ceiling PINNED at N=3 automated attempts per `retry_key = { migration_version, host_id, pre_state_digest }`; on exhaustion it enters a fail-closed terminal state (governed mutation denied, actionable message emitted once) rather than retrying. The migration's per-host ceiling and the denial helper's dedup together guarantee bounded output and bounded work.
**By:** AI (auto)

**Pinned ceiling contract (F-005, round-1).** N=3. The attempt counter is keyed on `retry_key` and persisted ATOMICALLY (rename-over-temp, 0600) in `~/.svc/install-migrations/v<version>/<host>/attempts.json` so a crash mid-attempt cannot lose or double-count. After attempt 3 for a key, a TERMINAL record is written (`terminal: true`, the failing host, the exact cause) and NO further automatic retry runs for that same key — first-run, SessionStart healthcheck, and the migration CLI all read the terminal record and refuse to auto-retry. **Reset condition:** the key includes `pre_state_digest` and `migration_version`, so a genuine change to the host's pre-migration state OR a framework upgrade produces a NEW key and a fresh N=3 budget — a permanently-stuck host is never silently unblocked, and a genuinely-changed host is never permanently blocked. **Recovery:** the terminal record names ONE exact recovery command — `scripts/svc-migrate-install.mjs --resume --host <host>` (or `--rollback --host <host>`) — which re-verifies the repair succeeded before clearing the terminal record; the record is never cleared by time or by an unrelated run.

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Hard ceiling → fail-closed terminal + deduped actionable message | Satisfies AC-487-12; unchanged bad state cannot loop; still safe (denies) | Operator must act to clear the terminal state (correct) |
| 2 | Exponential backoff, no ceiling | Self-healing eventually | Unbounded first-run/PreToolUse loop persists on genuinely unfixable state |
| 3 | Ceiling → fail-OPEN allow after N tries | Never blocks the user | Converts a security denial into permission — the fail-open defect being removed |
| 4 | No ceiling, rely on dedup alone | Fewer knobs | Dedup bounds OUTPUT, not WORK; migration could still spin |

**Chosen:** #1 because AC-487-12 requires a hard ceiling AND a fail-closed terminal recovery state; a fail-open escape (#3) is precisely the defect WI-487 exists to eliminate.

## D-9: Fixture strategy — extend two named fixtures, add two for distinct classes

**Phase:** plan-changeset
**Decided:** extend `validate-setup-worktree-canonical-resolution.sh` (source-durability, AC-487-1/4) and `validate-self-heal-survives-double-dead-pointer.sh` (fail-closed enforcement, AC-487-2/3) per the proposal's tier-1 note; add TWO new validators for genuinely distinct failure classes — `validate-actionable-hook-denial.sh` (AC-487-7/7A/8) and `validate-all-host-install-migration.sh` (AC-487-9/10/11/12) — each with a tier-1 promotion note.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Extend 2 + add 2 (distinct classes, promotion-noted) | Honors the proposal's extend directive AND avoids coupling unrelated assertions; an adversarial reviewer prefers separated classes | Two new tier-1 files (at, not above, WI-486's precedent of two new validators) |
| 2 | Cram all 12 ACs into the 2 named fixtures | Literally "no third validator" | Overloads a "canonical-resolution" fixture with migration-transactionality + denial-dedup; a reviewer flags the overlap and the false single-responsibility |
| 3 | Add 4 new validators, don't extend | Clean separation | Duplicates the source-durability class the 2 named fixtures already own; violates the proposal's extend directive |
| 4 | One giant new "install-integrity" validator | One file | Kitchen-sink validator; slow, hard to attribute a failure, violates tier-1 single-purpose discipline |

**Chosen:** #1 because the proposal permits new validators when "diagnosis proves a genuinely distinct failure class," and the actionable-denial contract (hook OUTPUT shape + session dedup) and all-host migration (multi-host orchestration + WI-486 delegation) are distinct from source resolution and single-host self-heal. Each new validator carries the required promotion note (`validator_path`, `failure_class`, `promotion_signal`, `expected_runtime_budget`, `why_tier_2_or_targeted_is_insufficient`).

## D-10: Durable non-symlinked enforcement launcher (F-001 CRITICAL)

**Phase:** design-tech (added round-1)
**Decided:** setup and the migration MATERIALIZE a versioned enforcement BUNDLE under a stable per-user path `~/.svc/enforcement/<migration_version>/` — a NON-symlinked launcher `bin/svc-enforce` (copied real bytes) PLUS the canonical enforcement-core `lib/enforcement-core.mjs` (copied real bytes, byte/hash-verified against the in-repo source of truth) — and reconfigure every governed-mutation hook command to run THROUGH the launcher. At run time the launcher resolves the real enforcement source, validates it (`classifySource` = realpath exists + executable + durable-canonical), delegates when valid, and FAILS CLOSED (denies the governed mutation + emits an actionable diagnostic + a home-local denial receipt) when the source is missing/dangling/non-executable — including when the entire source checkout was deleted. **Self-containment vs. single-implementation tension (F-016):** the launcher's deny path is self-contained because it imports the MATERIALIZED `lib/enforcement-core.mjs` sitting next to it in the version dir — NOT the in-repo checkout — so a deleted checkout leaves the launcher fully runnable; and it does not duplicate/inline the resolver or digest because that canonical core (the ONE `resolveStateRoot` + `denialStateDigest` + receipt validation + atomic denial write) is exactly the materialized module. The in-repo `hooks/lib/enforcement-core.mjs` is the single source of truth that setup copies; `durable-source.mjs` and `hook-denial.mjs` import it in-repo, and the launcher imports its materialized copy — one implementation, zero drift, no live-checkout dependency after install. A deleted-checkout fixture asserts the materialized bundle denies with a home-local receipt after the entire source checkout is removed.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Copied non-symlinked launcher PLUS copied canonical enforcement-core outside the checkout; governed hooks route through the launcher; deny path imports the materialized core | Closes the self-reference defect AND the single-implementation tension (F-016): the detector of source-disappearance no longer disappears with the source, uses the ONE canonical `resolveStateRoot`/`denialStateDigest`/receipt-validation/atomic-write core, and a deleted checkout still produces a VISIBLE deny + receipt (proves AC-487-2/7A end-to-end) with no inlined duplicate | A new launcher template + a canonical enforcement-core module + a byte/hash-verified copy step for BOTH in setup/migration; a version segment to avoid disturbing a running launcher on upgrade |
| 2 | Keep `guardEnforcementSource` INSIDE the hook source (the round-0 design) | Fewer files | The guard vanishes with the ephemeral source — the exact CRITICAL F-001 defect; anonymous fail-open on a deleted checkout |
| 3 | Symlink the launcher into the checkout | No copy | A symlink into the checkout dangles the moment the checkout is removed — same defect |
| 4 | A background daemon that watches the source | Continuous | Violates the zero-dependency, no-background-job red line |

**Chosen:** #1 — the round-1 reviewer proved the guard-inside-the-guarded-source design cannot satisfy AC-487-2/7A after the checkout moves or is deleted. A copied, versioned, non-symlinked launcher is the only shape that fails closed when everything it guards is gone. The launcher is built FIRST among implementation tasks so every later denial/guard/migration behavior binds to it.

## D-11: Single state-root resolver; receipts are evidence, not authority (F-011)

**Phase:** design-tech (added round-1)
**Decided:** exactly ONE `resolveStateRoot()` (HOME-anchored, with an explicit fail-closed behavior when HOME is unset/unreadable) expands `~/.svc` for EVERY Bash and Node consumer (`setup`, `check-install-drift.sh`, healthcheck, the migration CLI, the launcher, the denial helper). Its single implementation lives in the canonical `hooks/lib/enforcement-core.mjs` (F-016): in-repo Node consumers import it directly, Bash consumers call it through a tiny Node shim, and the installed launcher imports its MATERIALIZED copy under `~/.svc/enforcement/<migration_version>/lib/` — never the live checkout — so resolver semantics are identical whether or not the checkout exists. Receipts (install-state and denial) are EVIDENCE ONLY: every consumer re-realpaths and re-classifies the live hook/launcher/source before accepting a converged state — a receipt is never read as authorization. Receipt files are written atomically at 0600, and a consumer rejects a symlinked, wrong-owner, or schema-invalid receipt.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | One shared resolver + receipts-as-evidence + re-realpath before trust | Bash and Node cannot disagree on the home path; a stale/forged/drifted receipt cannot grant authority because the live target is always re-checked | A small shared resolver both languages call (Node import; Bash sources a tiny helper or calls the Node resolver) |
| 2 | Each consumer expands `$HOME/.svc` itself | No shared code | Bash and Node can diverge (unset HOME, trailing slash, symlinked home); the security package lists forged receipts as a threat this ignores |
| 3 | Treat the receipt as the source of truth | Fast idempotency | A stale/forged receipt hides a drifted or malicious installed command — the exact fail-open class WI-487 removes |

**Chosen:** #1 — the reviewer confirmed `~/.svc` is the correct per-user location ONLY under this constraint: one resolver, receipts observational. Both conditions are now decided invariants.

## D-12: Versioned external install rollback (F-004)

**Phase:** design-tech (added round-1)
**Decided:** `scripts/svc-migrate-install.mjs` exposes a versioned `--rollback` (per-host or `--all-hosts`) that reverses the EXTERNAL migration from per-host backups: precondition digest check (refuse an already-diverged host absent an explicit owner override), atomic restore of pre-migration host config + hook wiring from `~/.svc/install-migrations/v<version>/<host>/backup/`, removal of the version-scoped launcher dir it created (a prior version stays runnable), verification that hooks/skills resolve to the restored source, and idempotent replay (a second rollback on a restored host is a byte no-op). The post-merge revert procedure COUPLES the code-revert PR with this command, because `git revert` removes repository code but cannot restore host configuration/symlinks/launcher already rewritten on user machines.
**By:** AI (auto)

| Rank | Option | Why | Trade-offs |
|---|---|---|---|
| 1 | Versioned `--rollback` from backups + precondition digest + atomic restore + verify + idempotent, coupled to the revert PR | The migration is external state; only a backup-driven restore actually undoes it; precondition digest prevents clobbering a diverged host | Requires the transactional backup already captured by AC-487-10 (reused, not new surface) |
| 2 | Rely on `git revert` alone | Zero new code | Leaves installed hosts pointing at a launcher/source the reverted framework no longer ships — the F-004 defect |
| 3 | Manual per-host re-`setup` | Simple | Non-deterministic, no precondition safety, no verification, not idempotent |

**Chosen:** #1 — the reviewer proved `git revert` cannot reverse the external installation migration; a versioned, precondition-guarded, verified, idempotent rollback command coupled to the revert is the only safe post-merge undo.

## Cross-cutting: reversibility and boundary

Every module is additive or a behavior-preserving extension of an existing entry point. Reverting the WI-487 commit restores the prior (fail-open) installer/guard behavior; the durable launcher and the machine-local runtime dirs (`~/.svc/enforcement/`, `~/.svc/install-state/`, `~/.svc/denial-receipts/`, `~/.svc/install-migrations/`) are home-local and disposable, and the EXTERNAL host-config migration is reversed by D-12's versioned `--rollback` coupled to the revert PR (F-004) — a code revert alone is insufficient. The WI-486 boundary is enforced structurally: WI-487 imports and shells out to WI-486's compatibility contract and contains no lane-tasks graph write.
