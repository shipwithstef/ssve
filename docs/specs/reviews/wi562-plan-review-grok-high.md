# WI-562 Plan Review — Grok 4.6 High (adversarial)

- **Date:** 2026-08-24
- **Reviewer:** Grok 4.6 High (independent, in-session; not the canonical external-review launcher)
- **Plan:** `docs/plans/2026-08-24-wi562-multi-agent-handoff-and-graph-engineering.md`
- **Baseline audit:** `docs/specs/audits/2026-08-23-improvement-protocol-multi-agent-handoff-and-verification-receipts.md`
- **Plan commit:** `47797375684398e2600a679427e4d2bb7ae3eb92`

VERDICT: NEEDS_FIX
RUBRIC_SCORE: 4

## FINDINGS

1. [SEVERITY: CRITICAL] [CORRECTNESS] IP-H1 (P0 ground-truth merge-back) is neither implemented nor deferred, while V-1/V-2 add swarm throughput on top of the still-trusted worker JSON path.
Evidence: audit §6 IP-H1 / Wave 1 and HD-1 cite `scripts/validate-parallel-merge-back.mjs:77–87` accepting worker `clean_worktree`, ownership, and `"PASS"` literals; `scripts/dispatch-worker.sh:207–211` still manufactures `validation_evidence` and hardcodes `parent_graph_mutation.updated=true`. Contrast `scripts/validate-execution-merge-back.mjs:28–35`, which recomputes files/digest/commits from git. Plan Track H starts at IP-H5; deferrals name only IP-R6/R8/W5; V-2 even says “merge-back validators unchanged.”
Concrete required change: Add an IP-H1 item (Wave 1): shared recompute lib, delete the accepted-string list, require workers to commit before report, and a tier-1 fixture where a worker reports PASS with a dirty tree and the validator exits nonzero. Do not ship V-1/V-2 until that gate exists. If deferred, say so with a follow-up WI id and an explicit residual-risk statement.

2. [SEVERITY: CRITICAL] [CORRECTNESS] H-D / IP-H4 specifies the wrong crash state and would either no-op on the real hole or steal a prepared handover without the token.
Evidence: `acceptHandover` writes the advanced lease first (`hooks/lib/authority-store.mjs:304–310`), then the consumed record. After a crash, `lease.generation === expected_generation + 1` and `handover.status === "prepared"` — that is why retry hits CAS at `:301–303`. The plan’s API `finalizeHandover({stateRoot, repoId, wi})` “matching current lease generation” and its test (`lease.generation == expected_generation`, then “lease advanced once”) exercise the *unconsumed* prepared state. Completing that state without `token`/`token_hash` is a tokenless takeover. SessionStart “best-effort” invocation (`H-D` change surface) would run that path fail-open.
Concrete required change: Specify two disjoint cases: (A) half-consumed — `status=prepared` AND lease already at `expected_generation+1` / `expected_revision+1` / successor principal → mark consumed, **do not** bump generation, idempotent no-op on retry; (B) prepared but lease not advanced → refuse without `token`/`token_hash` (leave `acceptHandover`). Test A with a crafted post-write-1 fixture, not B. SessionStart must fail closed on A (actionable error if finalize cannot complete), never auto-accept B.

3. [SEVERITY: HIGH] [CORRECTNESS] H-C claims the ensure-worktree Git-CAS lock family, then implements a mkdir file lock — the primitive `withExclusiveLock` was written to replace.
Evidence: audit IP-H3: “Reuse `withExclusiveLock` semantics keyed on branch sha.” Plan H-C requirement says “same family as ensure-worktree CAS refs”; change surface is `mkdir …/svc-worktree-verb-locks/<sha(branch)>`. `hooks/lib/wi-claim.mjs:326–331` states correctness locks are Git `update-ref` CAS, “not runtime files,” because delayed contenders can delete/replace file locks. `scripts/svc-ensure-worktree.mjs:76` already uses that CAS family.
Concrete required change: Wrap `cmd_promote`/`cmd_remove`/`cmd_cleanup` in `withExclusiveLock` keyed on the branch (same ref namespace as ensure-worktree). If mkdir is kept, drop the “same family” claim, document the residual race with CAS holders, and add a steal-after-stale-mtime negative test — that is a weaker fix and must be called one.

4. [SEVERITY: HIGH] [CORRECTNESS] H-E’s “validate each lifecycle receipt against BOTH schemas” is unsatisfiable; `bootstrapOrResume` does not exist.
Evidence: `schemas/authority-handover-receipt.schema.json` requires `receipt_id`, `old_generation`, `new_generation`, `completed_at` with `additionalProperties: false` and `kind` enum `handover|recovery` only. Planned `handoff-record.schema.json` requires `record_id`, singular `generation`, `principal`, `worktree_realpath`, `base_sha`, `ttl_ms`, `ts`, also `additionalProperties: false`, and adds `release`. Current emitters (`authority-store.mjs:312–371`) match the old shape; `releaseController` (`:375–384`) emits no receipt. There is no `bootstrapOrResume` — only `bootstrapController` / `resumeController`.
Concrete required change: Dual-write: keep the existing lifecycle receipt validated only against the old schema (after H-F adds `explicit_takeover`); emit a *normalized* handoff-record validated only against the new schema. Map `generation` explicitly (`new_generation`). Add a `release` receipt or drop `release` from the new enum. Wire resume into `resumeController`. Do not claim one object satisfies both schemas.

5. [SEVERITY: HIGH] [COMPLETENESS] H-A inverts IP-H5’s claim-without-pid rule; process-liveness for `state-io` does not close HD-7.
Evidence: audit IP-H5: “Claims without pid must carry a mandatory renewal heartbeat or refuse to persist.” Plan H-A: “Claims without a usable pid keep mtime reclaim (no behavior regression).” `hooks/lib/wi-claim.mjs:176–188` already TTL-reclaims pid-less same-host claims (HD-7); `scripts/state-io.mjs:42–52` is a different lock.
Concrete required change: Split items: (1) pid+start_token for `state-io` locks; (2) claims without pid either require renewal heartbeat or refuse persist, with a live-process-over-TTL test. Do not call H-A a close of IP-H5 until (2) is in or explicitly deferred.

6. [SEVERITY: HIGH] [COMPLETENESS] IP-H7 is only partly specified; freeze is enforced on the wrong verbs, and lane-tasks Bash writes are omitted.
Evidence: audit IP-H7 requires isolation-guard enforcement **or** delete of `.worktree-freeze`, orchestrator-state quarantine, **and** “lane-tasks Bash writes route through the same validator.” Plan H-G only quarantines `orchestrator-state.mjs:26–33` and blocks `cmd_promote/remove/cleanup` on the freeze marker. `scripts/worktree.sh:1041` writes an *edit-scope* marker; `hooks/` has no reader of `.worktree-freeze`.
Concrete required change: Either teach `svc-worktree-isolation-guard` to honor `.worktree-freeze` or delete the marker. Add a pre-commit / argv-aware check so Bash writes of `.svc/lane-tasks-*.json` hit the same validator as Edit/Write.

7. [SEVERITY: HIGH] [COMPLETENESS] R-F does not close IP-R7; IP-R4 is reduced to “atomic writes,” not a single emitter.
Evidence: audit IP-R7 verification: read-side matrix with **zero** NO/PARTIAL cells. Plan R-F: “zero cells *regress* … relative to baseline” — that freezes today’s PARTIAL/NO rows. Audit IP-R4: `emit-receipt.mjs` is the sole write path; plan keeps `quick-fix-eligibility.mjs:322` as its own writer.
Concrete required change: Either drive every §4.1 kind to YES-on-read in this WI, or defer the remainder of IP-R7 with a named WI and a matrix that lists remaining PARTIAL/NO cells as accepted debt. For IP-R4, either route quick-fix staging through `emit-receipt.mjs` or rename the item to “atomic receipt writes” and list remaining emitters in the grep allowlist *before* the gate lands.

8. [SEVERITY: HIGH] [BACKWARDS COMPATIBILITY / REGRESSION RISK] H-C quarantine as specified will fail the existing worktree-safety eval; H-B/H-C promote tests are unspecified against the live origin.
Evidence: plan H-C moves orphans to `.worktrees/.quarantine/<ts>/`. `test-framework/evals/tier-1/validate-worktree-safety.sh:73–79` treats every `$REPO_ROOT/.worktrees/*/` path not in `git worktree list` as FAIL. H-B verification “extend validate-worktree-safety.sh with a refused-push fixture” runs in a script whose `REPO_ROOT` is this repo; `cmd_promote` currently does `git push -u origin` (`scripts/worktree.sh:583`).
Concrete required change: Exclude `.quarantine/` from the orphan check (or place quarantine outside `.worktrees/`). Run promote/remove race and refused-push fixtures only in a scratch clone with a fake remote.

9. [SEVERITY: HIGH] [SECURITY/FAIL-CLOSED] Several “fixes” stay fail-open: tokenless/best-effort finalize (finding 2), `gh` missing still `return 0`, AP-30 env bypass, and `MAX_PARALLEL=0` as a silent unbounded restore.
Evidence: `scripts/worktree.sh:590–594` returns 0 when `gh` is absent after the push block; `:740–741` plus `validate-worktree-remove-ap30-safety.sh:72–73` keep `SVC_WORKTREE_SKIP_AP30_CHECK=1` as a required escape hatch.
Concrete required change: Missing `gh` after a successful push must exit nonzero (or a documented `--no-pr` waiver). Healing skip: one waiver channel, echoed, not a hidden env. If unbounded fanout remains, require an explicit `--unbounded` flag.

10. [SEVERITY: MEDIUM] [CORRECTNESS] R-C “aggregate per type exactly as today” would collapse WI-550 slot identity.
Evidence: `scripts/emit-receipt.mjs:48, :85–87, :266` stores `slot::<type>::<wi>::<sha>[::<phase>]`. `scripts/mine-receipts.mjs:96–108, :117–124` reads `env["review-plan"]` / `env["exec-record"]` (type keys).
Concrete required change: Parse `slot::` keys, iterate *all* slots, and aggregate counts/findings per slot (type+wi+sha+phase). The tier-1 eval must include two slot keys of the same type on one note and assert both count.

11. [SEVERITY: MEDIUM] [COMPLETENESS] Plan self-verify claims every protocol item and T04 deliverable are covered; that is false.
Evidence: `.svc/lane-tasks-WI-562.json` T04 names `scripts/lib/authority-store.mjs` and `scripts/auto-receipt.mjs` (neither exists; store lives at `hooks/lib/authority-store.mjs`). IP-W3 audit verification: “adding a hook requires catalog-only change”; plan W-C keeps the ~35-case table (`scripts/wire-hooks.mjs:462–501`). IP-R8 is deferred with no follow-up WI id.
Concrete required change: Rewrite the mapping table: implemented / partial / deferred+WI-id. Fix T04 paths. For W-C, either generate Claude identities from the catalog or downgrade IP-W3 to “cursor/grok only.” Enumerate every §4.1 exception with owner+revisit date before `lint-receipt-formats.mjs` is tier-1.

12. [SEVERITY: MEDIUM] [VERIFIABILITY] Several new checks are not hermetic as written; new always-on evals lack promotion notes.
Evidence: H-C “concurrent double-promote” is a race (audit asked Tier-2). W-C and W-D share Wave 4: quoting **must** change generated command bytes (`scripts/wire-cursor-hooks.mjs:61`) while W-C demands byte-stable snapshots.
Concrete required change: Replace true concurrency with lock-held-then-refuse. Update cursor/grok snapshots in the same commit as W-D quoting. Add a promotion note per new `test-framework/evals/tier-1/validate-*.sh`.

## SUMMARY

The receipt and wirer P0s that *are* specified (R-B fail-closed schema load, R-C slot-key parsing intent, W-A atomic writes + cursor abort-on-corrupt, H-B removing `|| true` on push) match the current code and should stay. The plan does not survive attack on the handoff spine: it drops the audit’s first P0 (IP-H1), designs `finalizeHandover` against the wrong generation state (and a tokenless complete), and substitutes mkdir locks for the Git-CAS family it claims to reuse. Completeness claims are overstated (IP-H5/H7/R4/R7/W3, T04, unnamed deferrals). Do not execute until IP-H1 is in-scope or explicitly deferred, H-D is rewritten to the post-write-1 tuple, and H-C uses `withExclusiveLock`.
