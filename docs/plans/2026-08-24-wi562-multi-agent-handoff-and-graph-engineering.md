# WI-562 Plan — Universal Multi-Agent Swarm Handoff, Graph Engineering & Cross-Host Verification Parity

- **Date:** 2026-08-24
- **Work Item:** WI-562
- **Branch:** `feat/wi-562-swarm-graph-engineering`
- **Source audit:** `docs/specs/audits/2026-08-23-improvement-protocol-multi-agent-handoff-and-verification-receipts.md` (Grok, 2026-08-23) — 20 numbered improvements across Tracks H/R/W, adopted here as the requirement baseline.
- **Lifecycle:** SSVE Phase 3 (this plan) → Triple Plan Review Gate → remediation to unanimous APPROVE → implementation → Triple Execution Review Gate → Tier-1 suite + promotion receipt.

---

## 0. Scope & Non-Negotiable Constraints

1. **Backwards compatibility:** every change must keep pre-existing on-disk state readable and every existing CLI invocation working. Legacy formats are read via fallback paths; new formats are written only when they add fields or replace a proven-broken behavior.
2. **Zero regressions:** all touched tier-1 validators must pass before each wave closes; the full 339-check tier-1 suite passes before promotion.
3. **No host-behavior drift:** wirer refactors must produce byte-stable output vs checked-in expectations (`--list-all` structural replay / TOML roundtrip eval).
4. **Fail-closed bias:** wherever the audit found a soft-fail hole, the fix makes validation failure loud (nonzero exit), never silent pass.

## 0.1 Deliverables named by the work item

| Deliverable | Location |
|---|---|
| Process-death-proof lock expiry | `scripts/state-io.mjs` + new shared lib `hooks/lib/process-liveness.mjs` |
| 2-phase atomic handover completion | `hooks/lib/authority-store.mjs` (`finalizeHandover`) |
| Machine-checkable handoff record | `schemas/handoff-record.schema.json` (new) |
| Receipt Format Charter + fail-closed validation | `references/receipt-format-charter.md` (new), `scripts/check-chain-receipts.mjs`, `scripts/lint-receipt-formats.mjs` (new) |
| Single atomic emitter policy | `scripts/emit-receipt.mjs` (unchanged contract), `scripts/quick-fix-eligibility.mjs` (converted), grep gate |
| Declarative cross-host hook catalog + uniform atomic write | `references/host-hook-catalog.json` (new), `scripts/wire-hooks.mjs`, `scripts/wire-cursor-hooks.mjs`, `scripts/wire-grok-hooks.mjs`, `hooks/lib/svc-ownership.mjs` (new) |
| Swarm DAG velocity | `scripts/fanout.sh` (adaptive bounded pool), `scripts/dispatch-worker.sh` (non-blocking branch claim) |

---

## Track H — Multi-Agent Worktree Handoff Contracts

### H-A · IP-H5 Process-death-proof lock expiry everywhere (P0)

**Requirement.** Replace mtime-based staleness in `scripts/state-io.mjs:42-52` with PID+StartTime liveness proof, mirroring `hooks/lib/authority-store.mjs:36-56` (`processStartToken` reads `/proc/<pid>/stat` field 22; PID reuse changes it). A lock whose recorded process is provably alive is NEVER stolen regardless of age; a lock whose process is provably dead is reclaimed immediately.

**Change surface.**
- New `hooks/lib/process-liveness.mjs`: export `processStartToken(pid)`, `processIsAlive({hostname,pid,start_token})`, `ownerProcessIdentity()`. Single source; `authority-store.mjs` re-imports from it (behavior preserved).
- `state-io.mjs` `acquireStateLock` writes `{pid, start_token, hostname, ts, filePath}` into the lock body. Staleness decision:
  - lock has `pid` + `hostname === os.hostname()` → liveness proof decides (dead ⇒ stale immediately; alive ⇒ never stale).
  - lock lacks pid / foreign hostname / unreadable `/proc` → legacy mtime fallback (`staleMs`), preserving current semantics for old locks and cross-host cases.
- Claims without a usable pid keep mtime reclaim (no behavior regression).

**Verification.** New tier-1 eval `validate-process-liveness-lock.sh`: (a) live-holder lock survives past `staleMs`; (b) dead-pid lock with fresh mtime is reclaimed; (c) pid-reuse simulation (start_token mismatch) is treated as dead; (d) legacy no-pid lock still expires at `staleMs`.

### H-B · IP-H2 Exit-status honesty in promote/remove (P0)

**Requirement.** `scripts/worktree.sh:583` (`git push … || true`) and `:606-615` (PR create `|| true`) report failure as success. Push/PR failures must abort promote nonzero before state advances. AP-30 healing failure blocks `remove` unless `--force` waiver passed.

**Change surface.** Remove `|| true` on push; check `$?`; on failure print diagnostic + `exit 1`. PR-create failure downgraded only when `gh` reports PR-already-exists race; otherwise `exit 1`. In `cmd_remove`, when AP-30 healing failed, require explicit `--skip-healing-gate` flag (echoed in output as a waiver) else `exit 1`.

**Verification.** Extend `test-framework/evals/tier-1/validate-worktree-safety.sh` with a refused-push fixture (fake remote) asserting nonzero exit and "Branch pushed" absent from stdout.

### H-C · IP-H3 Concurrency-safe promote/remove/cleanup (P0)

**Requirement.** Mutating worktree verbs take a repo-shared lock (same family as ensure-worktree CAS refs). Cleanup quarantines instead of bare `rm -rf`.

**Change surface.** New helper `with_worktree_verb_lock <branch>` using `mkdir`-based atomic lock dir under `$(git rev-parse --git-common-dir)/svc-worktree-verb-locks/<sha(branch)>` with PID+start-token staleness (reuses process-liveness). Wrap `cmd_promote`, `cmd_remove`, `cmd_cleanup`. `cmd_cleanup` moves unregistered dirs to `.worktrees/.quarantine/<ts>/` and prints disposition instead of deleting bytes.

**Verification.** Tier-1: concurrent double-promote of same branch — second exits nonzero before push; cleanup preserves quarantined bytes (fixture asserts file exists under quarantine after run).

### H-D · IP-H4 Forward-completion for half-consumed handovers (P1)

**Requirement.** Crash between lease-write and consumed-record write in `acceptHandover` (`authority-store.mjs:309-310`) strands a `prepared` token that retry cannot consume (generation CAS fails). Add idempotent `finalizeHandover({stateRoot, repoId, wi})` that completes a prepared token matching current lease generation WITHOUT operator evidence, mirroring `finalizeTransferredClaim`.

**Change surface.** `authority-store.mjs`: new exported op; SessionStart healthcheck path invokes it opportunistically (best-effort, logs outcome). The two writes become one critical section already inside `withLock`; finalize covers the historical crash window.

**Verification.** Failpoint-style tier-1 test: craft lease+prepared-handover pair where lease.generation == expected_generation, run finalize, assert lease advanced once and second call is a no-op (idempotent).

### H-E · IP-H6 Machine-checkable handoff record (P1)

**Requirement.** One `schemas/handoff-record.schema.json` binding authority transitions; emitted at every lifecycle op; resume validation consumes records.

**Schema contract** (JSON Schema **2020-12**, `additionalProperties:false`, snake_case, `ts` date-time — charter-conformant):
```
required: schema_version(const 1), record_id(uuid), kind(enum handover|explicit_takeover|recovery|release),
          wi, repo_id, lease_id(uuid), generation(int>=1), principal,
          worktree_realpath(string, format uri-reference acceptable → use plain string+pattern non-empty),
          base_sha(^[0-9a-f]{40}$|^$), token_hash(^sha256:[0-9a-f]{64}$ optional),
          allowed_paths(array of string), ttl_ms(int>0), evidence(object), ts(date-time)
```

**Change surface.** `writeLifecycleReceipt` additionally appends a normalized `handoff-record` JSON to `<receipts>/handoff-records.jsonl` (atomic append) and validates each emitted lifecycle receipt against BOTH the existing `authority-handover-receipt.schema.json` enum (after H-F adds `explicit_takeover`) and the new schema. Resume path (`bootstrapOrResume` consumers) reads latest record and compares `generation` against lease — mismatch ⇒ refuse with actionable error (negative test required).

**Verification.** Tier-1 `validate-handoff-record-schema.sh`: positive conformance fixtures for all four kinds; negative test for mismatched generation and unknown kind.

### H-F · RC-1/RC-5 enum closure (P1)

Add `"explicit_takeover"` to `schemas/authority-handover-receipt.schema.json` `kind.enum` (emitter already produces it — emitter/schema mismatch closed); conformance unit test asserting code-side kinds == schema enum so drift fails CI (IP-R5 slice for authority receipts).

### H-G · IP-H7 Silent-state hygiene (P2)

- `orchestrator-state.mjs loadState`: on parse failure, rename corrupt file to `.svc/orchestrator-state.json.corrupt-<ts>` (quarantine), warn to stderr, return null (resume starts clean but prior bytes preserved — no silent destruction).
- `.worktree-freeze`: enforced — `cmd_promote/cmd_remove/cmd_cleanup` refuse when freeze marker present unless `--ignore-freeze` given (documented waiver). Marker stays documented rather than deleted (chose enforce over delete: cheapest honest semantics).
- AP-30 repoint proceeds-despite-failed-healing gets the H-B `--skip-healing-gate` waiver gate.

**Verification.** Corrupt-state resume test warns + preserves `.corrupt-*` file; frozen worktree mutation refused without waiver flag.

---

## Track R — Automated Verification Receipts

### R-A · IP-R1 Receipt Format Charter (P0)

New `references/receipt-format-charter.md` — the normative convention set:
1. integer monotonic `schema_version` starting at 1;
2. timestamp field named `ts`, `format: date-time`;
3. snake_case keys;
4. ids are UUIDs or content digests (`sha256:<hex>`);
5. JSON Schema draft **2020-12**;
6. `additionalProperties: false` default;
7. **no schema file ⇒ no emitter may merge** (enforced by lint below).

New `scripts/lint-receipt-formats.mjs` (tier-1): scans `schemas/**` + emitters for convention violations; honors `references/receipt-format-exceptions.json` — a dated exception list grandfathering known outliers (`runtime-projection-v2` string version, hook-denial `timestamp`, install-state triplication, pipeline-decisions legacy fields) each with owner WI and revisit date. Deliberately nonconforming fixture in eval corpus must fail.

### R-B · IP-R2 Fail-closed schema loading (P0)

`check-chain-receipts.mjs loadSchema` (:758-768): missing/unreadable schema ⇒ return sentinel that makes `validateReceipt` FAIL with reason `schema unavailable: <type>` — never `{valid:true}`. Rename-a-schema drill in tier-1 proves nonzero exit.

### R-C · IP-R3 Repair mine-receipts for slot-keyed envelopes (P0)

`mine-receipts.mjs readEnvelopes` currently assumes legacy type-keyed envelopes; post-WI-550 notes are slot-keyed (`slot::<type>::<wi>::<sha>[::<phase>]`). Fix: parse both shapes — detect `slot::` prefix, split key, aggregate per type exactly as today. Legacy fallback retained. Tier-1 eval emits a fresh-format note into a scratch git repo clone and asserts stats report nonzero receipts.

### R-D · IP-R4 Single emitter, atomic writes only (P0)

- Convert `quick-fix-eligibility.mjs writeReceipt` (:322 bare `writeFileSync`) to `writeJsonAtomic` from `state-io.mjs` (tmp+fsync+rename under lock) — crash leaves no partial file.
- Tier-1 grep gate `validate-atomic-receipt-writes.sh`: forbids receipt-shaped direct `writeFileSync` in `scripts/`+`hooks/` (allowlist: state-io internals, emit-receipt tmp primitives, wirer config files which are not receipts). Seeded violation fails the gate.

### R-E · IP-R5 Schemas as single source (P1)

For the two duplicated contracts the audit names:
- install-state: add conformance test asserting `INSTALL_RECEIPT_REQUIRED/TYPES` constants ⊆ schema `properties/required` (drift ⇒ fail). Full codegen deferred (documented follow-up); this closes silent drift cheaply.
- delegation completion: same pattern against `validateCompletionReceiptShape`.
- authority kinds: covered by H-F.

**Verification.** One tier-1 eval `validate-schema-code-conformance.sh` covering all three mappings.

### R-F · IP-R7 Validate-on-read closure (P1)

- New `schemas/pipeline-decision-entry.schema.json` (charter-conformant: `kind`, `ts`, `schema_version`); `pipeline-log.mjs` writer adopts canonical fields while tolerantly reading legacy (`type`/`timestamp`) entries.
- PR-review receipts gain `schema_version: 1` on write; validator requires it for NEW receipts, grandfathering existing files by absence.
- Read-side matrix script `scripts/receipt-read-matrix.mjs` regenerates §4.1-style table; tier-1 asserts zero cells regress to NO/PARTIAL relative to baseline captured in this WI (matrix stored at `docs/specs/wi562-read-matrix-baseline.json`).

### R-G · IP-R9 Receipt integrity binding (P2)

Notes envelope gains per-slot content digest: emit-receipt stores `digests: {<type>: sha256}` inside envelope meta; mirror regeneration verifies mirror bytes against envelope digest before serving (tampered mirror ⇒ regenerate-from-notes, never serve). GC refuses to delete mirrors whose digest verification errors (fail-closed).

### Explicitly deferred (documented, not silently dropped)

- **IP-R6 cross-host receipt-production parity**: extends canonical-gates + conformance validator. Requires Stop/SessionEnd adapter ports for cursor/grok hosts — sized as its own follow-up WI because it changes host wiring contracts mid-flight here. This WI ships the catalog capability flags (W-C) that R6 will consume.
- **IP-R8 stage-registry/manifest integrity**: bridge item touching manifest+linter+router docs — routed to its own framework WI to avoid a mega-changeset colliding with routing hot paths (plan-changeset-trigger rule: behavior change on hot path needs isolated ceremony).
- **IP-W5/HW-5 TOML contract doc**: documentation-only note added to charter annex (grok TOML subset degradation documented).

---

## Track W — Wiring Substrate

### W-A · IP-W1 Uniform write policy (P0)

All three wirers converge on: **tmp+rename + pre-mutation backup + corrupt-config aborts nonzero (never silent reset)**.

- `wire-hooks.mjs`: single `atomicWriteSettings(path, value)` (tmp+fsync+rename) replacing 3 direct `writeFileSync` paths (:575, :873, :887, :920). Existing timestamped backup kept.
- `wire-cursor-hooks.mjs`: corrupt `hooks.json` no longer resets to `{}` — parse failure exits 1 with backup-preserving message; adds immutable `.pre-migration.bak` before first mutation of a run (mirrors grok posture).
- `wire-grok-hooks.mjs`: already conformant; unchanged except quoting (W-D).

**Verification.** Seeded-corrupt fixture per host: claude/cursor/grok wiring aborts nonzero leaving original bytes intact. Byte-stability: `--list-all` structural replay unchanged for Claude; cursor merged JSON identical on double-run; grok TOML roundtrip eval green.

### W-B · IP-W2 Shared ownership predicate (P1)

New `hooks/lib/svc-ownership.mjs` exporting `isSvcOwnedCommand(cmd)` (unified rules: `svc-` prefix token match on command basename/path segments, `/skills/hooks/` path containment, canonical gate ids). All three wirers import it. Parity eval feeds identical command fixtures to each wirer's classifier path expecting identical verdicts (exported pure function tested directly; wirers consume the same lib).

### W-C · IP-W3 Declarative hook catalog (P1)

New `references/host-hook-catalog.json`: per-hook entries `{id, events[], command_template, ownership: "canonical", capabilities: {receipts: "full"|"skills-only"|"none"}}` for every svc-owned hook across claude/cursor/grok wirers.

Consumption strategy (risk-bounded):
- Cursor/Grok wirers generate their entry sets FROM the catalog (they are already rebuild-per-event, low blast radius).
- Claude wirer: catalog becomes source of truth for canonical command strings used by `isAlreadyWired` identity checks going forward; the ~35-case table remains for legacy detection but each case's expected-string now derives from catalog (single-source identities). No behavioral rewrite of migration passes.
- Capability flags recorded per host feed future IP-R6.

**Verification.** Generated output byte-stable vs checked-in expectations (cursor JSON snapshot, grok TOML roundtrip, claude `--list-all` replay). Adding-a-hook drill: catalog-only edit reflected in dry-run output (eval asserts new id appears without wirer code change for cursor/grok).

### W-D · IP-W4 Path quoting (P2)

Cursor/grok generated commands quote interpolated `NODE_CMD` and hooksDir-bearing paths (`"$HOOKS_DIR"` style). Eval: sandboxed HOME with a space-bearing prefix wires successfully for both hosts.

---

## Swarm DAG Velocity (WI-562-specific track)

**V-1 Adaptive bounded concurrency in fanout.sh.**
Current behavior launches ALL workers simultaneously then waits (thundering herd; unbounded CPU/API pressure). Change:
- `MAX_PARALLEL` resolution order: `--max-parallel N` flag > `SVC_FANOUT_MAX_PARALLEL` env > `min(queue_len, max(2, floor(nproc/2)))` adaptive default.
- Bounded pool: launch up to MAX_PARALLEL, then launch-next-as-one-finishes (job-slot loop). Streaming wait replaces batch `wait`.
- Per-worker result capture unchanged (logs + extract-summary), table rendered after drain. Backwards compat: no args ⇒ adaptive default; `MAX_PARALLEL=0` restores launch-all legacy mode.

**V-2 Non-blocking branch scheduling in dispatch-worker.sh.**
Workers currently assume serialized branch claims. Add best-effort advisory branch claim: worker attempts `mkdir $(git-common-dir)/svc-wave-branch-claims/<branch>` (atomic O_EXCL semantics via mkdir); success ⇒ proceeds; EEXIST ⇒ worker exits fast with structured `status: branch_busy` summary instead of blocking on locks (orchestrator re-dispatches later). Claim released in trap on exit. This converts lock-wait stalls into immediate observable skips — velocity without correctness loss (merge-back validators unchanged).

**Verification.** Tier-1 `validate-fanout-concurrency.sh`: fixture queue of 4 trivial workers with MAX_PARALLEL=2 asserts max observed concurrency ≤2 and all 4 summaries render; branch-claim collision drill asserts `branch_busy` path and claim-dir cleanup.

---

## Implementation Waves & Sequencing

| Wave | Items | Risk class |
|---|---|---|
| 1 | H-A, H-B, R-B, R-C, R-D, W-A | P0 correctness/data-loss |
| 2 | H-C, H-D, H-E+H-F, R-A, R-E, W-B | contract consolidation |
| 3 | H-G, V-1, V-2, R-F | structural convergence |
| 4 | R-G, W-C, W-D | hygiene tail |

Each wave closes with: touched validators green + `node scripts/lint-skills-manifest.mjs` + focused tier-1 slice. Deferred items (R6, R8) filed in plan §Track-R deferrals with rationale.

## Rollback posture

Every change is independently revertible; no data migrations are irreversible (new files only; modified writers keep legacy readers working). Wirer changes guarded by backup+rollback primitives already present (claude/grok) or added (cursor).

---

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every protocol item mapped to file:line change surface or explicitly deferred with rationale | Plan §H/R/W/V tables vs audit §6 | PASS |
| 2 | Named deliverables (lane-tasks T04) all covered | Plan §0.1 table | PASS |
| 3 | Backwards compatibility stated per item | Constraint §0 + per-item fallback notes | PASS |
| 4 | Verification maps to tier-1 harness (hermetic, <5s budget noted where new) | Per-item Verification lines; new evals listed | PASS |
