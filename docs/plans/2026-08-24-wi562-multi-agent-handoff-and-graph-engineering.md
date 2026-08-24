# WI-562 Plan v2 — Universal Multi-Agent Swarm Handoff, Graph Engineering & Cross-Host Verification Parity

- **Date:** 2026-08-24 (v2 — post triple-plan-review remediation; see `docs/specs/reviews/wi562-plan-remediation.md`)
- **Work Item:** WI-562
- **Branch:** `feat/wi-562-swarm-graph-engineering`
- **Source audit:** `docs/specs/audits/2026-08-23-improvement-protocol-multi-agent-handoff-and-verification-receipts.md` (Grok, 2026-08-23) — 20 numbered improvements, ALL dispositioned in-scope or deferred-with-WI-id (§Coverage Matrix).
- **Round-1 reviews:** Codex gpt-5.6-sol high (rubric 2.5), Grok grok-4.6 high (rubric 4), Cursor Auto (rubric 6) — all NEEDS_FIX; every finding dispositioned in §F-mapping of the remediation doc.

---

## 0. Scope & Non-Negotiable Constraints

1. **Backwards compatibility:** every change keeps pre-existing on-disk state readable and existing CLI invocations working. Legacy formats read via fallback; writers switch only where the old behavior is the bug.
2. **Zero regressions:** touched validators green per wave; full tier-1 corpus (dynamically discovered; 339 checks at authoring time) green before promotion.
3. **No host-behavior drift:** wirer refactors byte-stable vs checked-in expectations; snapshot updates and command-quoting changes land in the SAME commit so bytes and expectations never disagree.
4. **Fail-closed bias:** soft-fail holes become loud nonzero failures; every new waiver channel is a single, echoed, documented flag.
5. **Single waiver-channel rule:** AP-30 healing skip converges on ONE channel (`--skip-healing-gate`, echoed to output); the `SVC_WORKTREE_SKIP_AP30_CHECK=1` env bypass is deprecated — still honored for one release with a loud deprecation warning, then refused.

## 0.1 Deliverables (corrected mapping; supersedes stale lane-task paths)

| Deliverable | Actual location |
|---|---|
| Process-death-proof lock expiry | `hooks/lib/process-liveness.mjs` (new shared lib), `scripts/state-io.mjs`, `hooks/lib/wi-claim.mjs` |
| Ground-truth parallel merge-back | `scripts/lib/merge-back-core.mjs` (new), `scripts/validate-parallel-merge-back.mjs`, `scripts/validate-execution-merge-back.mjs` (refactor onto core), `scripts/dispatch-worker.sh` |
| 2-phase atomic handover completion | `hooks/lib/authority-store.mjs` (`finalizeHandover`) |
| Machine-checkable handoff record | `schemas/handoff-record.schema.json` (new), `hooks/lib/authority-store.mjs` |
| Receipt Format Charter + registry | `references/receipt-format-charter.md` (new), `references/receipt-kind-registry.json` (new), `scripts/lint-receipt-formats.mjs` (new) |
| Fail-closed schema validation | `scripts/check-chain-receipts.mjs` |
| Slot-keyed envelope mining | `scripts/mine-receipts.mjs` |
| Atomic receipt writes | `scripts/quick-fix-eligibility.mjs` (routed through `emit-receipt.mjs` core writer), grep gate `validate-atomic-receipt-writes.sh` |
| Uniform wirer write policy + catalog | `scripts/wire-hooks.mjs`, `scripts/wire-cursor-hooks.mjs`, `scripts/wire-grok-hooks.mjs`, `hooks/lib/svc-ownership.mjs` (new), `references/host-hook-catalog.json` (new) |
| Concurrency-safe worktree verbs | `scripts/worktree.sh` (Git-CAS verb locks + quarantine) |
| Swarm DAG velocity | `scripts/fanout.sh`, `scripts/dispatch-worker.sh` (worker-summary status vocabulary; no phantom schema) |

Note: lane-task T04's literal strings `scripts/lib/authority-store.mjs` / `scripts/auto-receipt.mjs` were authored with approximate paths; the authoritative mapping is this table (`auto-receipt.mjs` is triad tooling, out of scope).

## 0.2 Coverage Matrix — every audit item dispositioned

| Audit item | Disposition | Where |
|---|---|---|
| IP-H1 ground-truth merge-back (P0) | **IN SCOPE, Wave 1** | §H-A |
| IP-H2 promote/remove exit honesty (P0) | IN SCOPE, Wave 1 | §H-B |
| IP-H3 concurrency-safe verbs (P0) | IN SCOPE, Wave 2 | §H-C |
| IP-H4 forward-completion handover (P1) | IN SCOPE, Wave 2 | §H-D |
| IP-H5 process-death locks (P1) | IN SCOPE (split A1/A2), Wave 1/2 | §H-E1/E2 |
| IP-H6 handoff record (P1) | IN SCOPE, Wave 2 | §H-F |
| IP-H7 enforce-or-delete freeze + silent resets (P2) | IN SCOPE (scoped), Wave 3 | §H-G |
| IP-R1 charter (P0) | IN SCOPE, Wave 2 | §R-A |
| IP-R2 fail-closed load (P0) | IN SCOPE, Wave 1 | §R-B |
| IP-R3 mine-receipts slots (P0) | IN SCOPE, Wave 1 | §R-C |
| IP-R4 atomic writes/single emitter (P0) | IN SCOPE, Wave 1 | §R-D |
| IP-R5 schemas single source (P1) | IN SCOPE (conformance), Wave 2 | §R-E |
| IP-R6 cross-host receipt parity (P1) | DEFERRED → **WI-563** (capability flags shipped here) | §Deferred |
| IP-R7 validate-on-read closure (P1) | IN SCOPE (subset-to-zero + accepted-debt ledger), Wave 3 | §R-F |
| IP-R8 stage-registry/manifest integrity (P1) | DEFERRED → **WI-564** | §Deferred |
| IP-R9 integrity binding (P2) | IN SCOPE, Wave 4 | §R-G |
| IP-W1 uniform write policy (P0) | IN SCOPE, Wave 1 | §W-A |
| IP-W2 ownership predicate (P1) | IN SCOPE, Wave 2 | §W-B |
| IP-W3 declarative catalog (P1) | IN SCOPE (all 3 wirers generate; legacy adapter bounded), Waves 2/4 | §W-C |
| IP-W4 path quoting (P2) | IN SCOPE, Wave 4 (same-commit snapshots) | §W-D |

Follow-up WI registration: WI-563 and WI-564 are recorded in `docs/specs/wi-followups.md` (new, created this WI) with problem statements; they enter the backlog at land time.

---

## Track H — Multi-Agent Worktree Handoff Contracts

### H-A · IP-H1 Ground-truth merge-back for parallel waves (P0, Wave 1)

**Requirement.** No merge-back may accept worker-authored status strings. Wave workers must COMMIT before reporting; parents recompute changed files, diff digest, commit range, and validation exit codes from git exactly as the delegated path does.

**Change surface.**
- New `scripts/lib/merge-back-core.mjs`: pure functions extracted from `validate-execution-merge-back.mjs:16-69` — `recomputeWorkerGroundTruth({worktree, baseSha})` → `{committed: bool, changed_files[], diff_digest, head_sha, commits[]}`; `verifyScope(files, allowed_globs)`; shared digest helpers. `validate-execution-merge-back.mjs` refactored to consume the core (behavior preserved; golden diff fixtures assert identical outputs pre/post refactor).
- `validate-parallel-merge-back.mjs`: DELETE the accepted-string list (:84) and trust-nothing rules:
  - worker result MUST carry `worktree` realpath + `base_sha`; validator recomputes ground truth from git;
  - recomputed `changed_files` override worker-authored arrays (worker array may only be a SUBSET hint — mismatch ⇒ finding, superset ⇒ failure);
  - success requires `committed === true` (clean tree + ≥1 commit vs base) — a PASS with a dirty tree exits nonzero;
  - **validation_evidence carries NO worker-authoritative verdicts at all** (round-2 Codex C1): each evidence entry names `{command, cwd}` and the VALIDATOR RE-EXECUTES it in the worker worktree, comparing exit codes itself; worker-authored result strings/exit-code files are never read as proof. **Command binding (round-3 Codex C1):** every evidence `command` MUST belong to the task's plan-declared `validation_commands` set (from the wave-plan/task graph); an undeclared command is a validation FAILURE — workers cannot smuggle self-selected tautologies (`echo ok`) past the gate.
  - `dispatch-worker.sh` stops manufacturing `parent_graph_mutation.updated=true` (:211): the orchestrator sets mutation flags AFTER validators pass, workers only report observations.
- `dispatch-worker.sh`: worker commits its own work before summary emission; summary gains `head_sha`, `base_sha`, `diff_digest` (recomputed values the parent verifies).

**Verification (hermetic).** Tier-1 `validate-parallel-ground-truth.sh`: scratch clone + fake worker results — (a) forged PASS + dirty tree ⇒ nonzero; (b) changed-file outside scope ⇒ nonzero; (c) worker array ⊃ recomputed truth ⇒ nonzero; (d) committed+matching ⇒ PASS; **(e) evidence citing a command NOT in the task's declared `validation_commands` ⇒ nonzero** (round-4 Codex C1). Declared sets live per task in `plan-contract.json` (`validation_commands` field) and in wave-plan task graphs. Runtime budget <5s; promotion note in Appendix P.

### H-B · IP-H2 Exit-status honesty in promote/remove (P0, Wave 1)

As v1, plus round-1 fixes:
- Push failure ⇒ print stderr + `exit 1` BEFORE any state advance; "Branch pushed" printed only after `$? == 0`.
- PR-create failure: tolerated ONLY for the detected already-exists race; otherwise `exit 1`.
- **`gh` absent after successful push:** no longer `return 0` silently — prints branch pushed + exits NONZERO unless `--no-pr` waiver passed (echoed). (Codex F-9)
- AP-30 healing failure blocks `remove` unless `--skip-healing-gate` (the single waiver channel; env bypass deprecated with loud warning, per §0 constraint 5).
- Test harness: hermetic — scratch CLONE with a bare "origin" remote whose `pre-push`/hook denies the ref (fake-remote pattern), never this repo's origin. (Cursor F-9, Grok F-8)

### H-C · IP-H3 Concurrency-safe promote/remove/cleanup (P0, Wave 2)

**Lock substrate: the existing Git-CAS family; SINGLE repo-wide verb mutex** (round-2 Codex C6: independent branch refs never contend with `_global`, so cleanup would still race promote/remove).

- Reuse the `withExclusiveLock` Git-ref CAS primitives used by `svc-ensure-worktree.mjs:76` / `wi-claim.mjs:326-331`.
- **One lock, one ref:** `refs/svc/locks/worktree-verb/_global` — ALL THREE mutating verbs (promote, remove, cleanup) take this single repo-wide mutex for their full critical section. These verbs are infrequent operator actions; serializing them costs nothing and makes deadlock impossible by construction (one lock, no ordering to reason about). Branch-scoped locking was evaluated and REJECTED in round 2 precisely because partial coverage is worse than coarse coverage.
- Lock-held-then-refuse determinism for tests: fixture acquires the CAS ref itself, runs each verb once, asserts nonzero + no side effects; releases. No real races in tier-1. (Codex F-12)
- Quarantine: unregistered dirs move to `.worktrees/.quarantine/<ts>/<dir>`; **`validate-worktree-safety.sh` orphan-check excludes the `.quarantine/` segment** (same commit). (Grok F-8)
- Stale CAS locks self-expire via the same generation/TTL semantics ensure-worktree already uses — no new staleness code.

**Verification.** Extend `validate-worktree-safety.sh`: lock-held-then-refuse promote; cleanup quarantine preserves bytes; `.quarantine` excluded from orphan FAIL.

### H-D · IP-H4 Forward-completion for half-consumed handovers (P1, Wave 2)

**Redesigned to the actual crash window** (round-1 Grok F-2 / Codex F-3). After `acceptHandover` writes the advanced lease (:304-309) but crashes before the consumed marker (:310), the on-disk state is: `handover.status=="prepared"` AND `lease.generation == handover.expected_generation + 1` AND `lease.backend_revision == handover.expected_revision + 1` AND `lease.controller_principal == handover.intended_principal`.

Two DISJOINT cases, one function:

```
finalizeHandover({stateRoot, repoId, wi})            // case A only
  under withLock:
    handover.status !== "prepared"                    -> idempotent no-op (already consumed)
    handover.lease_id     !== lease.lease_id          -> REFUSE (cross-lease stranding)
    lease.accepted_handover_id !== handover.handover_id \
    lease.accepted_token_hash !== handover.token_hash  >-> REFUSE (lease advanced by
                                                           takeover/recovery, NOT by
                                                           token acceptance — operator
                                                           recovery owns that state)
    lease.generation      !== expected_generation + 1 \
    lease.backend_revision!== expected_revision + 1    >-> REFUSE (case B: token still
                                                           unconsumed; acceptHandover
                                                           owns that path with the token)
    principal guard: IF handover.intended_principal is set,
                     it MUST equal lease.controller_principal;
                     IF null (unbound handover — prepareHandover permits it),
                     the requirement is lease.controller_principal !== old
                     controller_principal recorded in the handover (i.e., a real
                     acceptance happened), which generation/revision+1 already prove.
    else: mark consumed {consumed_at}, emit lifecycle receipt (kind:"handover",
          completed:true) + normalized record carrying token_hash binding,
          freeze old-generation delegations. NO lease mutation.
          Second call: no-op (idempotent).
```

**Token-proof lives INSIDE the lease (round-3 Codex C3):** generation+1/revision+1 alone do NOT prove token acceptance — `takeoverController` and `recoverController` advance the same counters without any token. Therefore `acceptHandover`'s first atomic write embeds acceptance evidence IN the lease itself: `accepted_handover_id: handover.handover_id`, `accepted_token_hash: handover.token_hash`. Neither takeover nor recovery ever writes these fields. Finalize's stranded-state test becomes: `handover.status=="prepared"` AND `lease.accepted_handover_id === handover.handover_id` AND `lease.accepted_token_hash === handover.token_hash` AND `lease.lease_id === handover.lease_id` AND the principal guard — a tuple ONLY token-gated `acceptHandover` can produce. Crash between lease-write and consumed-marker leaves exactly this verifiable state; anything else refuses.

- Case B (lease NOT yet advanced) is NEVER completed without the secret token — no tokenless takeover. (Grok F-2)
- SessionStart healthcheck: detects stranded case-A tuples and invokes `finalizeHandover`; on finalize ERROR it reports an actionable, blocking-grade warning (fail-closed: operator learns authority state is ambiguous; it never silently accepts case B). (Grok F-2)
- The two `atomicWrite` calls remain two calls (they are already inside one `withLock`); finalize covers the historical window. Prose corrected per Cursor F-6.

**Verification.** Tier-1 `validate-handover-forward-completion.sh`: crafted case-A fixture ⇒ finalize completes once, second call no-op, NO generation change; case-B fixture WITHOUT token ⇒ refuse; WITH token via normal acceptHandover ⇒ works. Budget <5s.

### H-E · IP-H5 Process-death-proof lock expiry (split E1/E2)

**E1 — `scripts/state-io.mjs` (Wave 1).**
- Shared lib `hooks/lib/process-liveness.mjs` exports `processStartToken(pid)`, `processIsAlive({hostname,pid,start_token})`, `ownerProcessIdentity()`; `authority-store.mjs` re-imports (single source).
- Lock bodies gain `{pid, start_token, hostname, ts, filePath}`. Staleness:
  - same-host lock WITH parseable pid: reclaimed ONLY on positive death proof (pid gone, or start_token mismatch ⇒ PID reuse). Live holder NEVER stolen at any age.
  - pid-less/foreign-host/unparseable locks: legacy mtime path preserved — these are PRE-WI-562 bytes or cross-host unknowns; version-gated by the presence of `start_token` in the body (explicit legacy class, documented). (Codex F-2 version-gating)
- New locks always write identity ⇒ the legacy class only shrinks.

**E2 — `wi-claim.mjs` claims / HD-7 (Wave 2). Builds ON the WI-486 heartbeat semantics — does not regress them** (round-2 Grok G5: WI-486 EXEC-004 deliberately refuses ephemeral CLI pids as false-dead; `isClaimStale` already runs identity-governed for pid-bearing claims and renewal-heartbeat-TTL for pid-less same-host claims).
- **Durable-owner class (existing, kept):** claim created with `SVC_OWNER_PID` records `{pid, process_start_token}` → TTL IGNORED while that exact process is live (death-proof reclaim only) — `wi-claim.mjs:172-176` today. No change; covered by regression test.
- **Heartbeat class (existing, kept):** pid-less same-host claims renew `renewed_at` on every claim write; live renewing owner never preempted, dead owner reclaimable after TTL (`wi-claim.mjs:178-193`). E2 makes the heartbeat EXPLICIT and scheduled: renewal refresh also available via a lightweight `renewClaim` op invoked by long-running executors (dispatch-worker trap/interval), so silent-but-alive owners survive past 24 h by renewing rather than by accident.
- **Heartbeat CONTRACT made mandatory (round-3 Codex C2/Grok G5):** a NEW claim without a durable owner pid MUST record `heartbeat_contract: {interval_minutes}` at creation, subject to the invariant `interval_minutes * 2 <= ttl_hours * 60` (enforced at claim creation; violation refuses persist) and its holder renews via the new exported `renewClaim` op. Wiring points (real callers): `scripts/svc-ensure-worktree.mjs` resume/attach path, `worktree.sh` binding guard invocations, and the `dispatch-worker.sh` execution loop (interval touch while a long silent section runs). A claim whose contract interval lapses without renewal is reclaimable exactly as today — but the obligation is now EXPLICIT, schedulable, and test-assertable rather than an accident of incidental writes.
- Foreign-host claims keep expiry-based reclaim (cross-host liveness unprovable — unchanged posture).

**Verification.** Tier-1 `validate-process-liveness-lock.sh` (E1) + `validate-claim-liveness.sh` (E2: durable-owner survives past TTL while alive; heartbeat-class renewed claim survives; unrenewed expires; identity-less non-ephemeral creation REFUSED; ephemeral acknowledged creation persists). Budgets <5s each.

### H-F · IP-H6 Machine-checkable handoff record (P1, Wave 2)

**Normalized record is its OWN object validated against its OWN schema — never dual-validated against the lifecycle receipt schema** (round-1 Grok F-4 / Codex F-4):

`schemas/handoff-record.schema.json` (2020-12, `additionalProperties:false`, snake_case, `ts`):
```
required: schema_version(const 1), record_id(uuid), kind(enum handover|explicit_takeover|recovery|release),
          wi, repo_id, lease_id(uuid), generation(int>=1),
          old_generation(int>=0), principal(string), predecessor_principal(string),
          worktree_realpath(string minLength 1), base_sha(pattern ^[0-9a-f]{40}$|^$),
          token_hash(pattern ^sha256:[0-9a-f]{64}$, optional),
          allowed_paths(array of string), ttl_ms(integer >0),
          evidence_digests(object with ^sha256:[0-9a-f]{64}$ values), ts(date-time)
```

- **Dual-write, not dual-validation:** lifecycle receipts keep validating against `authority-handover-receipt.schema.json` (after H-F1 adds `explicit_takeover` to its enum). Each lifecycle op ADDITIONALLY emits a normalized handoff-record.
- `release` transitions: `releaseController` (:375-384, currently emits nothing) now ALSO emits a normalized `kind:"release"` record — lifecycle receipt shape stays untouched (no breaking change), closure achieved in the record stream. (Codex F-4)
- `generation` mapped explicitly from `new_generation`; `evidence_digests` preserves the audit-required digest bindings (labels → sha256 over canonical JSON of evidence sub-objects). (Codex F-4)
- **Storage: per-record atomic files** `<receipts-dir>/handoff/<record_id>.json` via `writeJsonAtomic` (tmp+fsync+rename under lock) — not JSONL append. (Codex F-4)
- **Resume consumption:** wired into the REAL `resumeController` path — on resume, latest record for `(repo_id, wi)` is compared against lease `generation`/principal; mismatch ⇒ refuse with actionable error naming both values. There is no fictional `bootstrapOrResume` helper. (Grok F-4)

**Verification.** Tier-1 `validate-handoff-record-schema.sh`: positive fixtures ×4 kinds; negative: generation mismatch on resume ⇒ nonzero; unknown kind rejected by schema; `token_hash` format enforced.

### H-F1 · RC-1 enum closure (Wave 2)

`"explicit_takeover"` added to `authority-handover-receipt.schema.json` `kind.enum` (emitter already produces it). Conformance test: code-side kinds set === schema enum set (drift fails CI) — the IP-R5 slice for authority receipts.

### H-G · IP-H7 Silent-state hygiene (P2, Wave 3, scoped honestly)

- `orchestrator-state.mjs loadState`: parse failure quarantines to `.corrupt-<ts>` + stderr warning + returns null (bytes preserved, no silent reset).
- **Freeze enforce-or-delete — DECISION: ENFORCE** (round-2 Codex C5 demanded the decision now, not at implementation). Exact surfaces: `hooks/svc-worktree-isolation-guard.mjs` gains a `.worktree-freeze` check (marker read from the target worktree root; mutation of ANY in-worktree path refused with pointer to the documented waiver), wired for every host that already wires this guard via the catalog; `worktree.sh` verbs additionally honor the marker directly. Waiver: freeze is lifted by deleting the marker file itself (a deliberate, visible act) — no hidden env bypass. If any wired host's guard cannot read the worktree root reliably, THAT HOST falls back to verb-level enforcement only, recorded per-host in the catalog (`freeze_enforcement: "guard"|"verbs-only"`). Deletion fallback is OFF the table. **A host either ENFORCES freeze or is NOT OFFERED freeze at all** (round-4 Codex C5): hosts whose guard cannot intercept all mutation paths are recorded `freeze_enforcement: "none"` in the catalog AND their `worktree.sh freeze` verb REFUSES to create markers ("this host cannot enforce freeze") — no unenforceable frozen state can ever exist. Catalog lands in WAVE 3 together with the guard change (round-4 ordering fix), not Wave 4.
- **Lane-tasks Bash-path validation** (HD-9 slice): new pre-commit slot `hooks/git/pre-commit.d/15-lane-tasks-validate` — any staged change touching `.svc/lane-tasks-*.json` runs `task-graph.mjs validate` (same validator as PostToolUse), closing the Bash-write bypass at the commit boundary. In-session pre-commit Bash writes remain a documented residual (PostToolUse cannot see them) — accepted residual with rationale. (Codex C5 partial-by-design, Cursor U8 satisfied)
- AP-30 repoint-despite-failed-healing: gated behind the single `--skip-healing-gate` waiver (§H-B).

---

## Track R — Automated Verification Receipts

### R-A · IP-R1 Receipt Format Charter + machine-readable registry (P0, Wave 2)

- `references/receipt-format-charter.md`: integer monotonic `schema_version`≥1; timestamp `ts` date-time; snake_case; UUID/digest ids; draft 2020-12; `additionalProperties:false` default; **no schema file ⇒ no emitter merges**; annex documenting the grok TOML-subset degradation contract (HW-5).
- **`references/receipt-kind-registry.json`** (Codex F-10): machine-readable denominator — one row per receipt kind `{kind, emitter[], storage[], schema_path|null, validator, strictness}` covering ALL §4.1 kinds (~12 shapes). The lint script iterates THIS registry — mechanical denominator, not heuristic scanning.
- `scripts/lint-receipt-formats.mjs` (tier-1): validates every registered schema against charter rules; validates emitter/storage rows resolve to real files; honors `references/receipt-format-exceptions.json` — EVERY known outlier enumerated (draft-07 schemas, `completed_at`/`timestamp` fields, `runtime-projection-v2` string version, install-state triplication, open `additionalProperties`, story receipts without `schema_version`) each with `{owner_wi, reason, revisit_by}`. Seeded nonconforming fixture fails. Budget <5s.

### R-B · IP-R2 Fail-closed schema loading (P0, Wave 1)

`check-chain-receipts.mjs loadSchema`: missing/unreadable ⇒ validation FAILURE with `schema unavailable: <type>` — never `{valid:true}`. Rename-a-schema drill in tier-1 proves nonzero. (Verified sound by all three reviewers.)

### R-C · IP-R3 mine-receipts slot-key parsing (P0, Wave 1)

- Parse `slot::<type>::<wi>::<sha>[::<phase>]` keys; **iterate ALL slots and aggregate PER SLOT (type+wi+sha+phase)** — never collapse same-type slots last-write-wins (WI-550 collision class). Legacy type-keyed envelopes remain a fallback reader.
- Tier-1 eval includes TWO slots of the SAME type on one note and asserts BOTH count. (Grok F-10)

### R-D · IP-R4 Single emitter, atomic writes (P0, Wave 1)

- `quick-fix-eligibility.mjs writeReceipt` routes through `emit-receipt.mjs`'s core writer (exported `writeReceiptAtomic(type, receipt)` from emit-receipt; staging path + schema validation reused) — quick-fix becomes a consumer of the single sanctioned emitter, satisfying "sole sanctioned write path," not merely "atomic." (Cursor F-7, Codex F-10)
- Tier-1 grep gate `validate-atomic-receipt-writes.sh`: forbids direct `writeFileSync` of receipt-shaped payloads outside the allowlist {state-io internals, emit-receipt primitives}. Allowlist is enumerated BEFORE landing; seeded violation fails.

### R-E · IP-R5 Schemas as single source (P1, Wave 2)

Exact-parity conformance (not one-directional subset) per registry rows: install-state constants ≡ schema required/types/enums; delegation-completion validator shape ≡ schema; authority kinds ≡ enum (H-F1). Drift EITHER direction fails. Known current divergences are fixed or explicitly exception-listed with revisit dates — the conformance eval reads the exception file, so main cannot red-fail on grandfathered reality while future drift still fails. (Codex F-10)

### R-F · IP-R7 Validate-on-read closure (P1, Wave 3, scoped)

- `pipeline-log.mjs` **dual-writes** canonical (`kind`,`ts`,`schema_version:1`) ALONGSIDE legacy (`type`,`timestamp`) so every existing consumer (incl. `svc-skill-artifact-authenticity.mjs:122-129` requiring `timestamp`) keeps working; new schema `schemas/pipeline-decision-entry.schema.json` validates canonical fields on entries carrying `schema_version`. (Codex F-7)
- PR-review receipts: writer adds `schema_version:1`. Grandfathering is SNAPSHOT-based, not date-trust-based (round-2 Codex C7 rejected self-reported dates as backdateable): the set of existing receipt files WITHOUT `schema_version` is frozen in `docs/specs/wi562-read-matrix-baseline.json` (captured at plan approval, pre-implementation); the validator enforces `schema_version` on any `.svc/review-receipts/` file NOT in that frozen set (file-path + content-hash identities). **Activation is atomic with the writer upgrade:** both the strict validator and the schema_version-writing change land in the SAME merged changeset, so no intermediate state exists where post-approval legacy-shaped receipts are rejected on main; local pre-land worktrees are not gated. A newly malformed receipt cannot masquerade as legacy — it isn't in the snapshot.
- Read-side matrix: `scripts/receipt-read-matrix.mjs` regenerates the §4.1 table from the kind-registry. **Baseline captured at plan approval, pre-implementation** (already committed alongside this plan as `docs/specs/wi562-read-matrix-baseline.json`). Gate semantics: (a) ZERO regressions anywhere; (b) the WI-562-upgraded subset {chain, quick-fix, pipeline-decisions, pr-review, authority, handoff} must reach YES/PARTIAL→documented-YES; (c) remaining PARTIAL/NO cells (denial-body, story, runtime-projection…) are enumerated as ACCEPTED DEBT rows bound to **WI-563** in `docs/specs/wi-followups.md`. Honest scoping: full zero is WI-563's exit criterion. (Grok F-7 option b)

### R-G · IP-R9 Receipt integrity binding (P2, Wave 4)

- Digests keyed by the FULL composite slot identity: within an envelope, `digests["<type>::<wi>[::<phase>]"] = sha256(canonicalJSON(receipt))` — canonical-object hashing domain DEFINED in the charter (sorted keys, no whitespace); note-target sha is implicit per envelope. No cross-slot collision. (Codex F-8)
- Envelope meta key `digests` reserved: normalization in `check-chain-receipts.mjs` passes it through and validates value formats; unknown meta keys still rejected.
- Mirror regeneration verifies served mirror bytes' canonical form against envelope digests BEFORE serving; tampered mirror ⇒ regenerate-from-notes (source of truth), never serve unverified. GC refuses to delete mirrors whose verification ERRORS (fail-closed).
- Consumers updated together: emit-receipt (writes digests), check-chain-receipts (validates), gc-stale-receipts (refuses unverifiable), mine-receipts (tolerant read). Tier-1: tampered-slot fixture, two-slot digest independence, GC refusal drill.

---

## Track W — Wiring Substrate

### W-A · IP-W1 Uniform write policy (P0, Wave 1)

- `wire-hooks.mjs`: one `atomicWriteSettings()` (tmp+fsync+rename) replaces all direct settings writes (:575, :873, :887, :920); timestamped backup kept.
- `wire-cursor-hooks.mjs`: corrupt config ⇒ exit 1 (abort, never silent `{}` reset) + immutable `.pre-migration.bak` before first mutation of a run.
- `wire-grok-hooks.mjs`: conformant; only quoting (W-D) touches it.
- Hermetic seeded-corrupt fixtures per host: abort nonzero, original bytes intact. Byte-stability: claude `--list-all` replay unchanged; cursor merged-JSON double-run identical; grok TOML roundtrip green.

### W-B · IP-W2 Shared ownership predicate (P1, Wave 2)

New `hooks/lib/svc-ownership.mjs` exporting pure `isSvcOwnedCommand(cmd)`; all three wirers import it. Parity eval: identical fixtures ⇒ identical verdicts (function tested directly; wirers consume the same lib).

### W-C · IP-W3 Declarative hook catalog (P1, Waves 2+4)

- `references/host-hook-catalog.json`: entries `{id, events[], command_template, capabilities:{receipts:"full"|"skills-only"|"none"}}` for claude/cursor/grok wirer-owned hooks, PLUS capability-truth flags for the other hook-capable hosts (kimi/codex/gemini/opencode) derived from their wirers' entry inventories — the catalog is the seed corpus WI-563 (IP-R6) consumes. (Codex F-9)
- **Claude identities generated FROM the catalog**; the ~35-case bespoke table remains ONLY as a bounded, clearly-marked legacy-migration adapter (it matches historical installed variants that no catalog entry describes). Catalog-only addition drill runs for ALL THREE wirers: adding a catalog entry appears in dry-run output with zero wirer-code change for new-style hooks. (Codex F-13, Grok F-11)
- Verification: byte-stable generated output vs snapshots; drill eval; snapshot/quoting same-commit rule.

### W-D · IP-W4 Path quoting (P2, Wave 4)

Quote interpolated NODE_CMD/hooksDir paths in cursor/grok generated commands. Snapshots updated in the SAME commit (constraint §0.3). Eval: space-bearing HOME prefix wires successfully (hermetic temp HOME).

---

## Swarm DAG Velocity

### V-1 Adaptive bounded concurrency — fanout.sh (Wave 3)

- Resolution order: `--max-parallel N` > `SVC_FANOUT_MAX_PARALLEL` > adaptive default `min(queue_len, max(2, floor(nproc/2)))`.
- Job-slot pool: launch up to cap, launch-next-as-one-finishes (streaming wait), summaries rendered after drain.
- **No silent unbounded mode:** `MAX_PARALLEL=0`/negative/invalid env ⇒ adaptive default with a warning. Unbounded requires the EXPLICIT `--unbounded` flag (kept for legacy callers; loudly logged). (Codex F-9/Grok F-9)
- Tier-1 `validate-fanout-concurrency.sh`: 4 trivial workers @cap 2 ⇒ observed concurrency ≤2, all summaries render. Deterministic (<5s).

### V-2 Non-blocking branch claims — dispatch-worker.sh (Wave 3, hardened per reviews)

- Claim dir: `$(git-common-dir)/svc-wave-branch-claims/<sha256(branch)>` — HASHED identity (slash-bearing branches safe), body `{hostname, pid, start_token, claimed_at, wi}`.
- Acquisition: `mkdir` O_EXCL semantics; EEXIST ⇒ read owner: positive death proof (via process-liveness) ⇒ steal stale claim; live owner ⇒ worker exits IMMEDIATELY with structured summary `status: branch_busy` (added to the worker-summary status vocabulary emitted by dispatch-worker.sh / parsed by extract-summary.sh) — no lock waits.
- Release: EXIT trap (normal + signal); SIGKILL leaves a reclaimable stale claim (death-proof steal covers it; PID-reuse covered by start_token).
- Retry policy (consumer contract, named executables — round-2 Codex C12): `branch_busy` enters the worker-summary status vocabulary emitted by `dispatch-worker.sh` and parsed by `scripts/extract-summary.sh`; the RETRY CONSUMER is `scripts/fanout.sh` (re-queues `branch_busy` workers up to 2 attempts within the same run) and the documented orchestrator behavior in `skills/dispatch-waves/SKILL.md` appendix (redispatch max 2 across runs, then blocked in wave report). No schema file is claimed where none exists today; the summary contract is the source of truth.
- Tests: slash-bearing branch claim; stale-claim steal; live-claim fast-exit; SIGKILL leftover reclaim. All hermetic (<5s total).

---

## Implementation Contract (execution-ready governance)

**Machine-readable contract:** the adjacent `plan-contract.json` (committed with this plan) carries the task DAG, per-task write sets, risk flags, and external-state inventory in the canonical plan-contract shape; this section is its human summary. The two are kept in sync; the contract file is authoritative for mechanical checks.

**Ownership model (corrected — round-2 Codex C11):** waves are STRICTLY SEQUENTIAL with one executor (WI-562 session); ownership exclusivity is therefore *temporal*, not per-wave-static. A file touched in waves 1 and 4 (e.g. `dispatch-worker.sh`, `emit-receipt.mjs`) is owned by the same single executor across both touches — no concurrent-writer hazard exists. Within any wave there is exactly one writer. The earlier "disjoint write sets" claim is corrected: disjointness holds *per wave commit*, and cross-wave re-touch by the same owner is expected and listed.

**Write-set map (primary surface per item).**

| Wave | Items → primary files |
|---|---|
| 1 | H-A: `scripts/lib/merge-back-core.mjs`(+), `validate-parallel-merge-back.mjs`, `validate-execution-merge-back.mjs`, `dispatch-worker.sh`; H-B: `worktree.sh` (push/PR honesty); H-E1: `hooks/lib/process-liveness.mjs`(+), `state-io.mjs`, `authority-store.mjs`(import swap); R-B: `check-chain-receipts.mjs`; R-C: `mine-receipts.mjs`; R-D: `quick-fix-eligibility.mjs`, `emit-receipt.mjs`(export writer); W-A: `wire-hooks.mjs`, `wire-cursor-hooks.mjs`; new evals (+) |
| 2 | H-C: `worktree.sh`(CAS mutex+quarantine), `validate-worktree-safety.sh`; H-D/H-F/F1: `authority-store.mjs`, `schemas/handoff-record.schema.json`(+), `authority-handover-receipt.schema.json`; H-E2: `wi-claim.mjs`; R-A: charter(+), registry(+), lint(+), exceptions(+); R-E: conformance eval(+); W-B: `svc-ownership.mjs`(+), wirers(import) |
| 3 | H-G: `orchestrator-state.mjs`, `svc-worktree-isolation-guard.mjs`, pre-commit slot(+); V-1: `fanout.sh`; V-2: `dispatch-worker.sh`, `extract-summary.sh`; R-F: `pipeline-log.mjs`, schema(+), review-receipt validator, matrix script(+); docs |
| 4 | R-G: `emit-receipt.mjs`, `check-chain-receipts.mjs`, `gc-stale-receipts.mjs`, `mine-receipts.mjs`; W-C/W-D: catalog(+), three wirers, snapshots |

(+) = new file.

**Compensation / rollback ordering.** Sequential commits in reverse-wave revert order. Format changes are additive-readers-first within the same series: reader tolerance lands in the earlier commit, writer strictness in a later one — reverting the writer leaves tolerant readers intact. Host-config mutations run ONLY via wirers' own backup+rollback primitives under hermetic temp-HOME tests.

**External State (canonical section).**

| External state | Touch mode | Compensation |
|---|---|---|
| `~/.claude/settings.json`, `~/.cursor/hooks.json`, grok config | Only via wirers (backup + rollback built in); never hand-edited | Wirer rollback primitive / timestamped backup restore |
| Git refs `refs/svc/locks/worktree-verb/_global` | Ephemeral CAS lock, self-expiring TTL | Automatic expiry; no manual cleanup |
| Git notes `refs/notes/svc-receipts` | Append-only through existing emit path | Notes are append-only; no rewrite |
| `.worktrees/.quarantine/**` | Move-in only, never auto-delete | Manual inspection; bytes preserved |

No network services, no store deployments, no CI mutation.

**Lock ordering.** Single repo-wide verb mutex (H-C) — no nesting, no hierarchy. Authority ops keep existing per-key locks. Merge integration lock unchanged. No lock acquires another while held except the pre-existing authority internal pattern.

---

## Sequencing

| Wave | Items | Exit criteria |
|---|---|---|
| 1 | H-A(IP-H1), H-B(IP-H2), H-E1, R-B, R-C, R-D, W-A | wave-1 validators green + manifest lint |
| 2 | H-C, H-D, H-E2, H-F+F1, R-A, R-E, W-B | + charter lint green |
| 3 | H-G, V-1, V-2, R-F | + read-matrix gate green |
| 4 | R-G, W-C, W-D | + full tier-1 corpus green |

## Rollback posture

Unchanged from v1: independently revertible waves; no irreversible migrations; additive-reader-then-strict-writer ordering.

---

## Appendix P — New tier-1 eval promotion notes (rules/tier-1-promotion compliance)

| validator_path | failure_class | promotion_signal | expected_runtime_budget | why_tier_2_or_targeted_insufficient |
|---|---|---|---|---|
| validate-parallel-ground-truth.sh | worker-authored PASS trusted (audit HD-1/IP-H1 P0) | audit item adopted as P0 baseline for this WI; hot merge-back path | <5s hermetic | merge-back authority is a hot path; a regression ships unverified worker claims silently |
| validate-process-liveness-lock.sh | mtime lock theft of live holders (HD-5 P1) | audit IP-H5; state-io runs on every state write | <5s | hot path; targeted script would not run on every session |
| validate-claim-liveness.sh | silent-owner claim steal (HD-7) | audit IP-H5/HD-7 named requirement | <5s | companion to above; same hot-path rationale |
| validate-rename-schema-drill.sh | missing schema disables receipt gate (RC-9 P0) | audit IP-R2; protects receipt gate hot path | <5s | silent gate disablement class must fail at lint time |
| validate-slot-envelope-mining.sh | telemetry blindness to new notes (RC-2 P0) | audit IP-R3 | <5s | stats feed tier prediction gates |
| validate-atomic-receipt-writes.sh | partial receipt files on crash (RC-8) | audit IP-R4 | <5s | grep gate must be always-on to prevent recurrence |
| validate-wirer-corrupt-config.sh | silent user-config destruction (HW-1/2 P0) | audit IP-W1 | <5s | data-loss class on every setup run |
| validate-handoff-forward-completion.sh | stranded prepared handover (HD-4) | audit IP-H4 | <5s | authority spine correctness |
| validate-handoff-record-schema.sh | prose-only handoff records (HD-6/IP-H6) | audit IP-H6 | <5s | schema conformance must be mechanical |
| validate-schema-code-conformance.sh | contract duplication drift (RC-7) | audit IP-R5 | <5s | drift detection belongs in lint |
| validate-ownership-predicate-parity.sh | classifier divergence across wirers (HW ownership) | audit IP-W2 | <5s | parity must hold on every wirer change |
| validate-fanout-concurrency.sh | thundering-herd fan-out | WI-562 velocity track | <5s | protects new bounded-pool behavior |
| validate-branch-claims.sh | wedged advisory claims (V-2) | WI-562 velocity track | <5s | new concurrency primitive needs always-on proof |
| validate-receipt-integrity.sh | tampered mirror serving (IP-R9) | audit IP-R9 P2 | <5s | integrity chain must be continuous |
| validate-catalog-generation.sh | wirer inventory drift (HW-3/7) | audit IP-W3 | <5s | catalog is becoming single source |
| validate-path-quoting.sh | space-bearing prefixes break wiring (HW-4) | audit IP-W4 | <5s | cheap always-on guard |
| validate-rename-schema-drill / others inline above | — | — | — | — |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every audit IP item dispositioned in Coverage Matrix (in-scope w/ section, or deferred w/ named WI id) | §0.2 table vs audit §6 | PASS |
| 2 | Named deliverables covered with CORRECTED paths | §0.1 table | PASS |
| 3 | Round-1 findings all addressed | remediation doc §finding-map | PASS |
| 4 | Execution-ready governance: disjoint write sets, lock ordering, rollback, external state | §Implementation Contract | PASS |
| 5 | Every new tier-1 eval carries promotion note + budget | Appendix P | PASS |
