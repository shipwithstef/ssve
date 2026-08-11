# WI-486 Changeset: Session-isolated multi-WI bootstrap

- **Spec (source of truth):** `docs/specs/features/wi-486-session-isolated-bootstrap.md` (BASELINED; SIB-01..42)
- **Diagnosis:** `docs/specs/bugfix/wi-486-session-bootstrap-brief.md`
- **Architecture decisions:** `docs/specs/decisions/wi-486-session-isolated-bootstrap.md`
- **Journey:** `docs/specs/journeys/J-FW-05-multi-session-contention.feature.md`
- **Branch:** `framework-WI-486-isolated-bootstrap`
- **Worktree:** `.worktrees/framework-WI-486-isolated-bootstrap`
- **Owner session:** `019f65ab-11b7-7db0-a6fe-a85fea90d525`
- **Lane:** framework
- **Delivery tier:** FULL
- **Archetype:** hot-path authority + atomic bootstrap + local state-migration contract, five bounded entry points
- **Planning mode:** invariant and reversibility analysis before task decomposition
- **Execution mode:** inline
- **Planning reasoning:** high
- **Execution reasoning:** medium
- **Status:** RE-AUTHORED (fresh-context single-pass; supersedes the 6 patch rounds recorded in `review-log.yaml`)
- **Created:** 2026-07-15 · **Re-authored:** 2026-07-16
- **Preserved user residue:** immutable stash commit `372699e5c001383e55f75a911d87149b5f0518f8` (`stash@{1}` at planning time), message `preserve-preflight-residue-before-WI-488-WI-486-WI-487-2026-07-15`; never drop, restore, overwrite, or include it.
- **Preserved framework residue:** immutable stash commit `5b471b6491b16d53eccbb3d9bd8a94cc8a40d6f0` (`stash@{0}` at planning time), message `preserve-background-auto-drive-residue-before-WI-488-merge-2026-07-15`; never drop, restore, overwrite, or include it.

## Single-Source Reference Anchors

Every downstream section references these five anchors and never restates their values. This is the discipline the six prior patch rounds lacked.

| Anchor | Symbol | Single canonical value | Defined once in |
|---|---|---|---|
| Immutable declared base | `$BASE` | `99da8bcf873d4d2a7b2a2becfb19759c71e3d2de` (WI-489 verify-promotion, PR #146; branch rebased onto it 2026-07-16) | §A Immutable base |
| Tier-1 baseline at `$BASE` | `BASELINE` | **245 passed / 0 failed / 0 timed out** | §A Immutable base |
| Ownership anchor | intent marker | .svc/bootstrap-intent/<WI>.json (schema in §Bootstrap transaction) | §Bootstrap transaction |
| Land ordering | 9-step sequence: 6a steps 1–7 (implementation land) + 6b steps 8–9 (promoted verify + verify-promotion PR) | the WI-489 two-commit pattern | §Execution Command Sequence |
| Staged file set | `declared-file-set.txt` | `docs/specs/test-evidence/WI-486/declared-file-set.txt` (generated task-1, asserted task-6a) | §Declared File Set |

### A. Immutable base (stated once)

`$BASE = 99da8bcf873d4d2a7b2a2becfb19759c71e3d2de` — the promoted `origin/main` at WI-489 verify-promotion (PR #146). It is a **pinned SHA**, never resolved from the mutable `origin/main` ref at runtime. Every base preflight, freeze hash (`git diff "$BASE"`), and baseline comparison uses this exact value. The Tier-1 baseline captured at `$BASE` is `BASELINE = 245 passed / 0 failed / 0 timed out`; that single triple is used in Task-1 evidence, the Simulation Report, and Full-branch policy identically. A changed total after this change is acceptable **only** when fully attributable to the newly registered focused validators (two new `.sh` files); no regression waiver applies.

## Implementation Summary

Make repository inspection independent of graph uniqueness; derive mutation authority ONLY from one exact session/worktree/WI/claim/graph tuple; make the canonical bootstrap command (`scripts/svc-ensure-worktree.mjs`) create that tuple atomically — anchored by a bootstrap-intent marker written first — without touching unrelated default-checkout residue. Reuse ONE shared resolver (`hooks/lib/resolve-wi.mjs`) in both Codex hooks and the Claude Stop guard; preserve WI-485 exact-skill enforcement; add pure task-state compatibility inspection plus an explicit, backed-up, receipted disk-migration CLI.

### Invariants

| Invariant | Required outcome |
|---|---|
| Read safety | Proved read-only operations allow before graph inventory or authority resolution; shell syntax outside the conservative classifier stays governed |
| Mutation authority | Only a fresh exact binding plus matching claim, repository, worktree, branch, WI, graph, and generation grants authority |
| Foreign isolation | Foreign graphs, claims, receipts, branches, normalized views, and graph overrides are diagnostic-only and never current authority |
| Skill discipline | A valid tuple still requires WI-485's exact current task and canonical skill-load receipt |
| Bootstrap atomicity | One repository lock protects same-WI discovery and tuple creation; the intent marker is the first artifact and the last removed; rollback removes only artifacts created by the failed attempt |
| Ownership attribution | Every partial bootstrap state is attributable to a session via the intent marker; unattributable artifacts are ambiguous and never auto-completed or auto-deleted |
| Residue preservation | Successful bootstrap never edits, stages, stashes, deletes, or byte-changes unrelated tracked or untracked default-checkout content |
| Host parity | Claude Stop and Codex PreToolUse serialize the same shared authority classification for the same fixture |
| Compatibility safety | Supported state follows normal authority; old lossless state is read-only; future, malformed, and lossy state is quarantined; no view/branch/contract ever becomes implicit authority |
| Loop termination | Compatibility pressure is keyed by repository, session, worktree, affected paths, byte digest, and classification; unchanged repeats become advisory |
| Migration safety | Only an explicit attributable command migrates; it excludes fresh foreign state, backs up exact bytes, verifies digests, and emits a schema-valid terminal receipt |
| Test isolation | All Tier-1 proof uses temporary repositories and local fixtures with zero external model calls |
| Dependency boundary | WI-487 alone owns all-host installation migration and generalized hook failure rendering/deduplication |

### Entry-point universe

| Family | Count | Entries | Disposition |
|---|---:|---|---|
| Shared authority resolver | 1 | `hooks/lib/resolve-wi.mjs` | Extend binding validation to an exact graph-aware tuple; expose a JSON CLI serialization of the same function |
| Codex authority consumers | 2 | `hooks/codex/lib/codex-hook-context.mjs`, `hooks/codex/svc-codex-skill-load-enforcer.mjs` | Classify reads first; consume shared resolver; retain exact receipt gate |
| Claude authority consumer | 1 | `hooks/svc-task-completion-guard.sh` | Replace embedded ownership resolution and unbounded invalid-state pressure with the shared resolver CLI + compatibility output |
| Canonical bootstrap | 1 | `scripts/svc-ensure-worktree.mjs` | Intent-anchored complete graph/claim/binding transaction with target-specific conflict handling |
| Ownership persistence | 1 | `hooks/lib/wi-claim.mjs` | Expose secure cross-worktree live-WI inspection, `processIdentity` liveness, and selective release primitives |
| Explicit compatibility/migration | 2 new modules | `hooks/lib/task-state-compatibility.mjs`, `scripts/svc-migrate-task-state.mjs` | Pure inspection plus separately authorized disk migration |
| Data contract | 1 new schema | schemas/task-state-migration-receipt.schema.json | Migration receipt shape |
| Regression-only graph readers | inventory-defined count | validators, reporting, workflow, lane, Kimi/Gemini/OpenCode utilities | Do not change authority semantics; count produced by scripts/inventory-graph-readers.sh, never asserted as prose |

No behavioral entry point in the accepted WI-486 contract is deferred. Durable installed-host repair and error-storm controls remain explicitly owned by WI-487.

## Files Planned

Legend — **Phase:** `plan` = authored/committed during plan convergence (before task-2..5 execute); `1..5` = execution task that authors it; `6a` = staged/committed in the implementation land PR; `6b` = authored in the SEPARATE verify-promotion follow-up PR (records merged/VERIFIED state OUTSIDE 6a's tree — F1); `commit` = staged only, at the task-6a freeze. **UPSTREAM** rows are already authored in the completed planning lane and only *committed* at 6a freeze — no execution task authors upstream authority.

| File | Action | Phase | Purpose |
|---|---|---|---|
| `hooks/lib/resolve-wi.mjs` | MODIFY | 2 | Single graph-aware authority resolver + JSON CLI adapter |
| `hooks/codex/lib/codex-hook-context.mjs` | MODIFY | 2 | Remove repository inventory as authority; derive active task only from the validated tuple |
| `hooks/codex/svc-codex-skill-load-enforcer.mjs` | MODIFY | 2 | Allow proved reads before resolution; enforce shared tuple + exact receipt for mutation |
| `hooks/lib/wi-claim.mjs` | MODIFY | 3 | Cross-worktree live-WI inspection, `processIdentity` liveness, selective release |
| `scripts/svc-ensure-worktree.mjs` | MODIFY | 3 | Intent-anchored repository-locked complete bootstrap, same-WI scan, residue-safe, resume, selective rollback |
| `hooks/lib/task-state-compatibility.mjs` | CREATE | 4 | Pure state classification, normalized read-only view, digest identity, bounded disposition marker |
| `scripts/svc-migrate-task-state.mjs` | CREATE | 4 | Explicit authorized backup/migrate/verify/receipt/restore CLI |
| schemas/task-state-migration-receipt.schema.json | CREATE | 4 | Terminal migration receipt contract |
| `hooks/svc-task-completion-guard.sh` | MODIFY | 5 | Shared authority adapter + terminal compatibility behavior for Stop |
| `.gitignore` | MODIFY | 4 | Declare-ignore the machine-local runtime dirs `.svc/bootstrap-intent/`, `.svc/task-state-migrations/`, `.svc/receipt-bodies/`, `.svc/review-receipts/` (F4 — the change is in `CODE_PATHS` and the declared set, no undeclared write) |
| scripts/inventory-graph-readers.sh | CREATE | 1 | Reproducible graph-reader inventory generator |
| test-framework/evals/tier-1/validate-session-authority-isolation.sh | CREATE | 1 | Red-first read ordering, exact resolver tuple, override, and Claude/Codex parity fixtures |
| test-framework/evals/tier-1/validate-task-state-compatibility.sh | CREATE | 1 | Red-first supported/legacy/quarantine/migration/digest/loop fixtures |
| `test-framework/evals/tier-1/validate-default-checkout-isolation.sh` | MODIFY | 1,3 | Replace dirty-checkout rejection with residue-safe transaction, race, resume, partial-state, failpoint proof |
| `test-framework/evals/tier-1/validate-session-worktree-binding.sh` | MODIFY | 1,3,5 | Complete-tuple ownership, same-WI concurrency, cross-session regression |
| `test-framework/evals/tier-1/validate-codex-execution-integrity.sh` | MODIFY | 1,2,5 | Safe-read-before-inventory, binding/override, foreign receipt, exact skill-gate proof |
| `docs/specs/test-evidence/WI-486/declared-file-set.txt` | CREATE | 1 | Machine-readable authoritative staged-file set (enumerated by task-1; asserted at freeze). **Lists its own path.** |
| `docs/specs/test-evidence/WI-486/graph-reader-inventory.txt` | CREATE | 1 | Frozen graph-reader inventory; count re-validated at task-6a freeze |
| docs/specs/test-evidence/WI-486/pre-change-tier1-baseline.md | CREATE | 1 | Preserve the `$BASE` `BASELINE` (245/0/0) Tier-1 identity + raw command output |
| docs/specs/test-evidence/WI-486/post-change-tier1-frozen.md | CREATE | 6b | Preserve frozen-tree full-suite identity (follow-up PR, not inside 6a's merged tree) |
| docs/specs/test-evidence/WI-486/pre-post-evidence.json | CREATE | 6b | Machine-readable old/new authority, bootstrap, migration, loop proof (follow-up PR) |
| docs/specs/verification/wi-486-promotion.md | CREATE | 6b | Durable in-repo promoted Tier-1 verification record (G9 — verify-promotion receipt cites this, not a /tmp path) |
| `docs/specs/features/wi-486-session-isolated-bootstrap.md` | MODIFY-UPSTREAM | commit(6a) | Record per-AC implementation evidence (QA/E2E/Test columns); final VERIFIED status is 6b via WI-486.md/INDEX |
| `docs/specs/journeys/J-FW-05-multi-session-contention.feature.md` | MODIFY-UPSTREAM | commit | Commit FW05-S7..S12 accepted journey authority |
| `docs/specs/bugfix/wi-486-session-bootstrap-brief.md` | CREATE-UPSTREAM | commit | Reproduced failures + root-cause evidence |
| `docs/specs/decisions/wi-486-session-isolated-bootstrap.md` | CREATE-UPSTREAM | commit | Architecture alternatives + accepted decisions |
| `docs/plans/2026-07-15-wi486-session-isolated-bootstrap/manifest.md` | CREATE-UPSTREAM | plan | This reviewed deterministic implementation authority |
| `docs/plans/2026-07-15-wi486-session-isolated-bootstrap/review-log.yaml` | CREATE-UPSTREAM | plan | Plan-review attempts, findings, dispositions, convergence — **authored/persisted in the plan phase, not task-6** |
| docs/plans/2026-07-15-wi486-session-isolated-bootstrap/progress.md | CREATE | 1..6a | TDD red/green checkpoints and replay status |
| docs/specs/reviews/wi-486-exec-cross-model.md | CREATE | 6a | Frozen-diff review-exec findings + convergence |
| docs/specs/reviews/wi-486-security.md | CREATE | 6a | Authority/path/ownership specialist security review (distinct package — §Execution Command Sequence step 3) |
| docs/specs/reviews/wi-486-gate.md | CREATE | 6a | Review-gate decision + finding dispositions |
| docs/specs/audit/wi-486-session-isolated-bootstrap-analysis.md | CREATE | 6a | AC-traced implementation audit |
| `docs/specs/work-items/WI-486.md` | MODIFY | 6b | Status→VERIFIED in the follow-up PR (records merged/verified state OUTSIDE 6a's merged tree) |
| `docs/specs/work-items/INDEX.md` | MODIFY | 6b | Synchronize WI lifecycle to VERIFIED (follow-up PR) |
| `.svc/lane-tasks-WI-486.json` | MODIFY | commit(6a) + close(6b) | Task/phase receipts committed with 6a; graph CLOSED (all tasks completed + verify-promotion) in 6b |
| `.svc/pipeline-decisions.jsonl` | MODIFY | commit | Append-only plan/exec/review/audit/land/verify decisions |
| `.svc/session-contract.jsonl` | PRESERVE (never staged) | — | Existing exact WI/session/worktree binding; append only if a later turn requires refresh; excluded from the declared staged set |

Machine-local runtime dirs, never staged and never in `declared-file-set.txt`: `.svc/bootstrap-intent/`, `.svc/task-state-migrations/`, `.svc/receipt-bodies/`, `.svc/review-receipts/`, `.svc/receipts/`, `.svc/external-review-artifacts/`. The last two are ALREADY covered by `.gitignore` (`.svc/receipts/*`, `.svc/external-review-artifacts/`); the first four are declare-ignored by the explicit task-4 `.gitignore` MODIFY row above (F4 — the `.gitignore` change is itself in `CODE_PATHS` and the declared set, so no undeclared file changes).

### Changeset Blueprint

Skipped because execution mode is `inline`: the implementing orchestrator has loaded the complete baselined spec, diagnosis, technical design, and this reviewed manifest. File inventory, AC coverage, dependency order, and validation remain mandatory below.

## Task Graph

```json
{"tasks":[
  {"id":"task-1","title":"Write red authority/bootstrap/compatibility/migration/loop fixtures + generate declared-file-set and graph-reader inventory","blocked_by":[]},
  {"id":"task-2","title":"Unify exact mutation authority and reorder Codex safe reads","blocked_by":["task-1"]},
  {"id":"task-3","title":"Complete the intent-anchored residue-safe atomic bootstrap transaction","blocked_by":["task-2"]},
  {"id":"task-4","title":"Add pure compatibility inspection and explicit receipted migration","blocked_by":["task-3"]},
  {"id":"task-5","title":"Adopt the shared authority and bounded compatibility result in Claude Stop","blocked_by":["task-4"]},
  {"id":"task-6a","title":"Freeze, review the code diff, commit, tree-bound receipts, freshness gate, PR, squash-merge, re-emit envelope","blocked_by":["task-5"]},
  {"id":"task-6b","title":"Verify-promotion FOLLOW-UP PR: flip WI-486 status→VERIFIED, close lane graph, write verification record, emit verify-promotion on ITS merge SHA","blocked_by":["task-6a"]}
]}
```

| Task | Files | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|
| task-1 | five focused validators, inventory generator, declared-file-set, baseline/progress evidence | SIB-01–42 (red) | each new fixture fails only on its NAMED expected-red marker (§F); `bash -n` per `.sh`; baseline file records `BASELINE` (245/0/0) | `wi486-red-contract` |
| task-2 | shared resolver + two Codex files | SIB-01–08, 19–25 | authority-isolation validator, Codex integrity replay, per-file `node --check` (§F) | `wi486-shared-authority` |
| task-3 | bootstrap helper, wi-claim primitives, two bootstrap validators | SIB-09–18, 24 | residue digest, race, failpoint, partial tuple, resume, different-WI replays | `wi486-atomic-bootstrap` |
| task-4 | compatibility module, migration CLI, schema, compatibility validator | SIB-26–42 | schema replay; supported/legacy/future/malformed/foreign; success/failure/idempotency; loop replay | `wi486-compatibility-migration` |
| task-5 | Claude Stop + parity/cross-host fixtures | SIB-19–25, 36–42 | Claude/Codex vector parity; Stop first/repeat/new-digest/new-session replay; existing Stop regressions | `wi486-host-parity` |
| task-6a | freeze/review/commit/land only (no new runtime code); the reviewed tree records NO merged/verified lifecycle state | SIB-01–42 | §Execution Command Sequence steps 1–7: full verify, distinct exec+security reviews, tree-bound receipts, freshness gate, sanctioned merge, re-emit envelope | `wi486-frozen-branch` |
| task-6b | own worktree + promoted verify; sanctioned-chain FOLLOW-UP PR: `WI-486.md` status→VERIFIED, `INDEX.md`, close `.svc/lane-tasks-WI-486.json`, `post-change-tier1-frozen.md`, `pre-post-evidence.json`, durable verification record | SIB-42 (lifecycle closure) | §Execution Command Sequence steps 8–9: own `svc-ensure-worktree` worktree, promoted verify, 6b receipts, `verify-promotion` on 6b's merge SHA | `wi486-verified` |

Tasks are sequential because each later public behavior consumes the exact contract frozen by the preceding task. Task-1 is the smallest reversible slice and adds no authority or migration write path. **Task-6 is SPLIT into 6a and 6b (F1 — WI-489 two-commit pattern):** 6a's reviewed/merged tree contains the implementation ONLY and never records "merged"/"verified" lifecycle state (which cannot exist inside the tree that is being merged); 6b is a SEPARATE follow-up PR — exactly like WI-489's own verify-promotion PR #146 — that records the merged/verified graph and lifecycle state in ITS commit.

## Authority, Bootstrap, Compatibility, and Migration Contract (stated once)

### Resolver result

`resolveWI(hookPayload, env)` returns a machine-readable classification with `authority` (boolean), `classification`, `reason`, diagnostics, and — only when `owned` — an exact canonical tuple: repository root, absolute worktree, branch, WI, absolute graph, session id, claim path, binding path, and claim generation. An optional `SVC_CODEX_TASK_GRAPH` is realpath-checked inside the exact bound worktree and must equal the tuple's `graph_path`; it is a consistency assertion only and never supplies any tuple field. Diagnostic fields (branch names, repository-wide graph inventory) never set `authority=true`.

Codex calls `isReadOnlyTool` BEFORE the resolver or any task inventory. Governed mutation resolves the tuple, reads only its graph, selects exactly one in-progress task, then applies WI-485's exact receipt checks. Claude Stop invokes the resolver's JSON CLI serialization (new `resolve-wi.mjs` CLI mode) so it maintains no second ownership implementation. A non-owned result exits before any foreign graph is parsed.

### Bootstrap transaction (intent-anchored)

`scripts/svc-ensure-worktree.mjs` remains the ONLY bootstrap entry point. Under its existing secure repository lock (`withExclusiveLock` in `hooks/lib/wi-claim.mjs`) it performs, in order:

1. Validate `$BASE`/origin and the requested identity (WI, branch, target worktree).
2. Scan all linked-worktree bindings/claims for a live same-WI owner (conflict source).
3. **Write the bootstrap-intent marker FIRST** — before the worktree, graph, claim, or binding. This is the single ownership anchor.
4. Create (or exact-resume) the isolated worktree.
5. Create or validate the initial graph (minimal schema-valid current-v1 graph whose first runnable task is `route-workflow`; lane inferred from existing WI/branch conventions).
6. Create the claim (`claimWI`).
7. Create the session binding (`writeSessionBinding`).
8. Re-read the complete tuple → on success remove the intent marker and release the lock; on any failure roll back in reverse order (binding → claim → graph → worktree → branch → intent marker → temp files), removing **only** artifacts this attempt created.

**Bootstrap-intent marker (the ownership anchor — defined here, referenced everywhere):**

```
.svc/bootstrap-intent/<WI>.json          # mode 0600, machine-local, gitignored
{
  "schema_version": 1,
  "session_id":            "<host-session-shaped id>",
  "owner_token":           "<random 256-bit hex minted at marker creation — proves this exact marker authored its artifacts>",
  "pid":                   <integer>,
  "process_start_token":   "<host:pid:btime — stable per live process>",
  "hostname":              "<os.hostname()>",
  "wi":                    "WI-486",
  "branch":                "<requested branch>",
  "target_worktree":       "<absolute requested worktree>",
  "base_sha":              "<requested base SHA>",
  "created_paths":         [],       # absolute paths of EVERY artifact this marker created, appended as each is created
  "started_at":            "<ISO-8601>",
  "renewed_at":            "<ISO-8601 — refreshed on each same-session resume>"
}
```

The marker is written before every other artifact, so ANY crash state at ANY stage is attributable to a session even before the claim/binding exist. It is removed only on successful completion or on rollback. `pid`, `process_start_token`, and `hostname` are present because the liveness test in §Recovery and liveness requires them. `renewed_at` (defaulting to `started_at`) supplies the TTL clock; a same-session resume rewrites it atomically (temp→fsync→rename, the `atomicWriteJson` pattern already in `wi-claim.mjs`).

**Deletion-authority provenance (F2 + G2 — stated once).** The ledger is written **record-intent-then-create**: for each artifact (worktree → graph → claim path → binding path) the intended absolute path is appended to the marker's `created_paths[]` and the **marker is fsync'd BEFORE the artifact is created**. The ledger is therefore always a **SUPERSET** of what exists on disk — a crash can leave a path listed but not yet created (a safe no-op on recovery), but can never leave an existing artifact unlisted. `owner_token` is minted once at marker creation. `created_paths[]` is the ONLY authority for selective deletion during stale recovery: reclaim/rollback removes ONLY listed paths whose owner is proven dead (§Recovery and liveness); a listed-but-absent path is skipped; a path NOT listed is NEVER deleted.

**Completeness backstop (G2).** Before any reclaim, recovery ALSO pattern-scans for the WI/branch/worktree-specific artifacts (`.worktrees/<branch>`, .svc/lane-tasks-<WI>.json, .svc/claims/<WI>.claim.json, the worktree's `.svc/bindings/*`) and asserts every match is a **subset of** the stale marker's `created_paths[]`. Any on-disk artifact that matches the WI/branch/worktree pattern but is NOT listed makes the state an **ambiguous CONFLICT** — nothing is deleted (the ledger cannot prove this session authored it). This closes the record-then-create TOCTOU window from both sides: superset ledger + subset assertion.

Ownership resolution reduces to one rule: **the intent marker's `session_id` is authoritative for every partial artifact of that WI, and its `created_paths[]` is the exact deletion allowlist.** If a marker exists → its session owns the partial state. If no marker exists but bootstrap artifacts do → orphaned/ambiguous (never forward-completed, never auto-deleted). The bootstrap result adds `absolute_graph`, `claim_generation`, `created`, and `resumed` to the existing fields.

### Recovery and liveness (one algorithm, covering every crash state)

At the head of the repository lock, before any new create, classify the requested target:

- **Same-session partial tuple** — an interrupted OWN bootstrap. It is same-session iff a bootstrap-intent marker exists for the WI whose `session_id` == the current session AND `target_worktree`/`branch`/`base_sha` match the request. Action: **forward-complete idempotently** — create only the missing artifacts in canonical order (marker present → worktree → graph → claim → binding), rewrite the marker's `renewed_at`, re-read, return `resumed: true`. This does not break atomicity: the marker is the single anchor, created first and removed last.
- **Exact complete same-session tuple** — resume unchanged, `resumed: true`.
- **Foreign or ambiguous state** — resolved by owner liveness of the marker's `session_id`:

| Foreign state | Owner liveness | Action |
|---|---|---|
| complete tuple, or any partial WITH an intent marker | **LIVE** | actionable CONFLICT — nothing is touched |
| any partial WITH an intent marker (any stage, incl. pre-claim) | **STALE** (per the G3 definition — same-host dead pid, or cross-host past-TTL) | RECLAIM under the lock: FIRST run the §Completeness backstop subset assertion (any WI/branch/worktree artifact not in `created_paths[]` → ambiguous CONFLICT, abort); then remove ONLY the listed `created_paths[]` (§Deletion-authority provenance), then the marker; then start a fresh bootstrap. A same-host LIVE pid is never reached here (it classifies LIVE) |
| complete claim/binding, NO intent marker (legacy/normal) | **LIVE** | CONFLICT |
| complete claim/binding, NO intent marker | **STALE** | reclaim via the existing generation-bound `transferClaim` (bumps generation, atomic) |
| artifacts present, NO intent marker AND NO claim (true orphan) | n/a | AMBIGUOUS → CONFLICT with an actionable diagnostic; never auto-deleted (no anchor authorizes removal) |

**Liveness test (single definition — G3: process liveness OVERRIDES TTL).** Reclaim/deletion is permitted ONLY when the owner is **provably dead or unreachable**, decided as:

```
STALE (reclaimable) iff:
    ( marker.hostname == os.hostname()  AND  processIdentity(marker.pid, marker.process_start_token) resolves DEAD )
  OR
    ( marker.hostname != os.hostname()  AND  now - max(started_at, renewed_at) > TTL  AND  no other liveness signal )
otherwise → LIVE
```

`processIdentity` is a new helper in `wi-claim.mjs` extending the existing `isProcessAlive` (pid alive AND its start token still matches — guards against PID reuse). **A same-host LIVE pid is NEVER reclaimed or deleted regardless of age — TTL alone never authorizes deleting a live same-host process's artifacts.** For same-host owners TTL is irrelevant: a live pid is LIVE at any age, a dead pid is STALE at any age. TTL is consulted ONLY for cross-host owners, whose process cannot be probed. If process identity cannot be evaluated at all, the result is fail-closed to **LIVE** (never reclaim on uncertainty). Reclaim is never silent forward-completion of another session's state: it either transfers a claim by generation or removes only the paths in the stale marker's `created_paths[]` (§Deletion-authority provenance) under the lock.

Unrelated default-checkout status is observed only by the residue fixture and is never a bootstrap precondition.

### Compatibility inspection (`hooks/lib/task-state-compatibility.mjs`, pure, no writes)

Exports:
- `classifyTaskState(graphBytes) -> { classification, lossless, version }` — **the input is RAW BYTES (Buffer/Uint8Array), not a pre-parsed object (F3): you cannot parse invalid bytes to classify them.** The function runs `JSON.parse` inside a `try/catch`; a parse failure returns `{ classification: "quarantine-recommended", lossless: false, version: "unparseable" }` and **never throws**. On successful parse: `classification ∈ {supported, legacy-lossless, quarantine-recommended}`; `version` is the declared `schema_version`/`version` or `"omitted"`. Omitted version = current supported shape (preserves already-verified WI-484/WI-485 graphs). Explicit `version: 0` = eligible for lossless normalization when every field maps without deletion/coercion. Version `> 1`, structurally invalid shape, unsafe paths, unknown task states, or lossy version-0 → `quarantine-recommended`. Only `supported` may participate in authority resolution.
- `normalizedView(graphBytes) -> { ...readOnlyGraph }` — parses and in-memory-upgrades a `legacy-lossless` graph; throws only when called on non-`legacy-lossless` input (callers must classify first and never persist the result).
- `stateIdentityDigest({ repoRoot, sessionId, worktreeRoot, affectedPaths[], graphBytesByPath, classification }) -> sha256hex` — the loop-breaker key. It hashes ALL six fields named by the loop-termination invariant (repository, session, worktree, sorted affected paths, per-path byte digests, and `classification`), length-delimited; `classification` is REQUIRED so a state whose only change is its classification produces a distinct digest and is not deduplicated as an unchanged repeat.
- `recordDisposition({ ...identity }) -> { disposition }` — the concrete marker writer/reader (F3). It ensures a **0700** directory tree and writes a **0600** marker file via the `atomicWriteJson` pattern already in `wi-claim.mjs`. **First occurrence** of a `stateIdentityDigest` → returns `{ disposition: "actionable" }` and writes the marker; an **identical repeat** (same digest, marker already present) → returns `{ disposition: "advisory" }` and does not rewrite; **`supported` classification writes no marker** and always returns `{ disposition: "none" }`.

Runtime marker (secure 0700 tree / 0600 file) at `${SVC_TASK_STATE_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-~/.cache}/svc-task-state-runtime}/<repo-hash>/<session-hash>/<worktree-hash>/<state-digest>.json` records classification, first-seen time, affected relative paths, and digest only. First creation → `actionable`; existing identical marker → `advisory`. Supported state writes no marker. Runtime state never grants authority.

### Explicit migration (`scripts/svc-migrate-task-state.mjs`, the ONLY disk-rewrite path)

Two mutually exclusive modes, both requiring `--wi WI-N --authorization <path>`:
- **migrate:** `--wi WI-N --authorization <path> [--dry-run]`.
- **restore:** `--wi WI-N --authorization <path> --restore <digest>`. The `<digest>` MUST be a backup whose receipt records the SAME `--wi`; a digest belonging to a different WI, or with no matching receipt, is rejected (exit 4) and restores nothing — so restore can never touch unrelated state.

**Authorization source:** `--authorization <path>` points to a repository-owner authorization file whose exact bytes hash to `SVC_TASK_STATE_MIGRATION_SHA256`, whose `authority` is `"repository-owner"`, that names the target `wi`, and whose `timestamp` is within a 24h freshness window (the owner-override trust pattern already used by `parseOwnerOverride` in `scripts/run-external-review.mjs`). No env var alone, and no in-process self-declared authority, authorizes a disk migration.

**Storage:** backups at `.svc/task-state-migrations/v1/<before-digest>/{original/<relative-path>, receipt.json}`; each `original/` file is mode-0600 immutable bytes; the digest is `stateIdentityDigest`.

**Migration algorithm — ordered atomic steps (F7 — stated once).** Under the lock, after re-inspecting and rejecting a fresh foreign graph/claim/binding:

1. Copy the original source bytes to the 0600 backup (exclusive `O_EXCL` create) and `fsync` the backup file and its directory.
2. Verify `sha256(backup) == sha256(original)`. If not equal → abort with exit 5, delete the just-written (incomplete) backup, leave the original untouched.
3. **ONLY THEN** write the transformed file over the source via `atomicWriteJson` (temp → fsync → rename).
4. Verify the post-write digest equals the expected transformed digest.

On ANY failure at or after step 3, the on-disk source is **restored from the verified backup** (atomic rename back) before the process exits non-zero; the backup is never deleted. `--restore <digest>` reverses from that same backup by the same atomic rename. **Invariant (stated once): after step 2 completes, the original bytes are recoverable from the verified backup at every subsequent point — success, failure, crash, or explicit restore.** **Exit codes:** 0 success, 3 already-migrated, 4 foreign/ineligible/wrong-WI, 5 verify-mismatch (backup/original both preserved). Failure never claims upgrade completion. The receipt conforms to schemas/task-state-migration-receipt.schema.json (requires `schema_version`, `migration_version`, authorization source/session, source/target versions, before/after SHA-256 digests, original/backup/changed paths, started/completed timestamps, and terminal result ∈ `{migrated, already-current, ineligible-fresh-foreign, failed}`).

## Gate Ordering (C — stated once)

The chain receipts split across two phases, and this manifest never contradicts it:

- **Plan phase (now, before any task-2..5 code executes):** `review-plan` converges and its `plan-manifest` + `review-plan` receipts are emitted. `review-log.yaml` is persisted here (it is the canonical audit output of `review-plan`, a plan-phase artifact — NOT a task-6a output). Their bodies are preserved to .svc/receipt-bodies/{plan-manifest,review-plan}.json (machine-local) and an immutable checksum sidecar is written: `sha256sum .svc/receipt-bodies/plan-manifest.json .svc/receipt-bodies/review-plan.json > .svc/receipt-bodies/plan-bodies.sha256`. Every later re-emission byte-compares against this sidecar (F6), so the plan receipts attached to HEAD/MERGE_SHA are provably the plan-convergence originals. Execution is refused if the plan-review receipt is absent or non-converged.
- **Task-6a (after the aggregate implementation commit):** emits ONLY the post-execution receipts — `exec-record`, `review-exec`, `audit-implementation` — and the `review-exec` body BINDS to the real launcher artifacts (§Execution Command Sequence step 5, F6). The two preserved plan-receipt bodies are RE-EMITTED onto `HEAD` (byte-verified via the sidecar) so `check-chain-receipts --sha HEAD` sees the complete 5-receipt envelope, then RE-EMITTED again onto the squash `MERGE_SHA` (steps 5 and 7). This two-stage lifecycle is what makes the pre-execution plan receipts attach to the post-execution aggregate commit.
- **Task-6b (the separate verify-promotion follow-up PR, F1):** emits `verify-promotion` on 6b's OWN merge SHA — never on 6a's, because the "merged/VERIFIED" lifecycle state cannot be recorded inside 6a's already-merged tree. `verify-promotion` is the G7 receipt and is NOT part of the 5-receipt envelope that `check-chain-receipts` requires on the implementation commit.

## Declared File Set (E — stated once)

`declared-file-set.txt` is the single machine-readable authority for what the aggregate commit stages — generated deterministically, never derived from prose at freeze time.

- **Task-1** runs `scripts/inventory-graph-readers.sh --emit-declared-file-set` (one script, no alternative path) which enumerates, one absolute-repo-relative path per line, EVERY file the task-6a `git add` will stage — expanding no directories — and writes them sorted to `docs/specs/test-evidence/WI-486/declared-file-set.txt`. Because that path is itself staged, **the generator includes its own path in the output** (no self-reference gap — resolves the round-6 circularity finding). Plan-phase review artifacts that exist at generation time (`manifest.md`, `review-log.yaml`, `progress.md`, and any `review-round*-findings.json`) are enumerated explicitly by the generator.
- **Task-6 freeze** stages exactly `git add -- $(cat declared-file-set.txt)`, then asserts `git diff --cached --name-only "$BASE" | sort` equals `declared-file-set.txt` byte-for-byte. `.svc/session-contract.jsonl` and all machine-local gitignored `.svc/*` paths are excluded from the set and never staged.

`graph-reader-inventory.txt` is likewise generated in task-1 by scripts/inventory-graph-readers.sh (greps the tracked tree for `lane-tasks` graph reads, subtracts the authority-consumer allowlist: `resolve-wi.mjs`, the two Codex authority files, `svc-ensure-worktree.mjs`, `svc-task-completion-guard.sh`) and RE-VALIDATED at the task-6 freeze — the frozen count must equal the inventory artifact or task-6a fails. The regression-reader count is thus produced, never asserted as prose.

## F. Deterministic Test-and-Syntax Discipline (stated once)

- **Red-first with NAMED markers.** Each new fixture, before its behavior exists, fails by emitting a specific expected-red string that the run greps for — not merely a nonzero exit:
  - `validate-session-authority-isolation.sh` → `EXPECTED-RED: exact-tuple mutation authority not yet implemented`
  - `validate-task-state-compatibility.sh` → `EXPECTED-RED: task-state compatibility classifier not yet implemented`
- **`node --check` checks ONE file.** All Node syntax validation loops per file: `for f in <planned .mjs>; do node --check "$f"; done`. Never pass multiple files to a single `node --check`.
- **`bash -n` per planned `.sh`.** Each planned shell file is syntax-checked individually.

## AC-to-Task and AC-to-Test Mapping

| ACs | Task(s) | Test type | Exact proof |
|---|---|---|---|
| SIB-01–03 | 1,2,6 | fixture/negative | two foreign live graphs allow a proved read and deny mutation; chained/redirection/interpolation/escape/newline forms stay governed |
| SIB-04–08 | 1,2,5,6 | fixture/negative | exact binding selects one graph; unset/outside/symlink/wrong-worktree/wrong-WI/mismatched overrides fail; branch + inventory remain diagnostics |
| SIB-09–10 | 1,3,6 | integration/schema | one command yields the graph/claim/binding/worktree tuple and all required result fields |
| SIB-11–13 | 1,3,6 | race/failpoint | one complete winner, clean loser leaving no artifact, selective rollback at every recorded stage |
| SIB-14–15 | 1,3,6 | replay/negative | exact same-session complete tuple resumes unchanged; a same-session partial tuple forward-completes (`resumed:true`) via the intent marker; only a foreign/ambiguous partial tuple conflicts, never repaired or deleted (matches §Recovery and liveness) |
| SIB-16–18 | 1,3,6 | digest/matrix/concurrent | unrelated tracked/untracked bytes unchanged (before/after digests); only target conflicts deny; different WIs bootstrap independently |
| SIB-19–20 | 1,2,5,6 | inventory/parity replay | both host adapters call the same resolver and return identical owned/foreign/missing/stale/malformed/mismatch classifications |
| SIB-21–25 | 1,2,5,6 | fixture/negative/replay | fresh foreign Stop is advisory without graph read; cross-worktree/receipt/role authority denied; exact skill gate retained |
| SIB-26–29 | 1,4,6 | fixture/negative | supported, normalized lossless, and quarantine results preserve bytes and never independently grant authority |
| SIB-30–35 | 1,4,6 | CLI/schema/failpoint/replay | attributable explicit CLI, foreign denial, immutable backup, terminal receipts, failure preservation, idempotent replay |
| SIB-36–41 | 1,4,5,6 | schema/repeated replay | full compatibility identity; first actionable; repeat advisory; changed digest / new session each get one result; supported state writes no marker |
| SIB-42 | 1–6 | inventory/harness | fixtures use temporary git repositories, local Node/Bash, and no external reviewer/provider process |

No AC is manual-only or N/A. Every AC has deterministic unit, integration, race, failpoint, schema, replay, or inventory evidence.

## Validation Plan

### Targeted tests (per task; syntax loops per §F)

```bash
for f in hooks/lib/resolve-wi.mjs hooks/codex/lib/codex-hook-context.mjs hooks/codex/svc-codex-skill-load-enforcer.mjs hooks/lib/wi-claim.mjs hooks/lib/task-state-compatibility.mjs scripts/svc-ensure-worktree.mjs scripts/svc-migrate-task-state.mjs; do node --check "$f"; done
for f in hooks/svc-task-completion-guard.sh scripts/inventory-graph-readers.sh test-framework/evals/tier-1/validate-session-authority-isolation.sh test-framework/evals/tier-1/validate-task-state-compatibility.sh test-framework/evals/tier-1/validate-default-checkout-isolation.sh test-framework/evals/tier-1/validate-session-worktree-binding.sh test-framework/evals/tier-1/validate-codex-execution-integrity.sh; do bash -n "$f"; done
bash test-framework/evals/tier-1/validate-session-authority-isolation.sh
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh
bash test-framework/evals/tier-1/validate-task-state-compatibility.sh
bash test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh
bash test-framework/evals/tier-1/validate-completion-guard-no-max-escape.sh
bash test-framework/evals/tier-1/validate-stop-hook-phase-enforcement.sh
node -e 'JSON.parse(require("fs").readFileSync("schemas/task-state-migration-receipt.schema.json","utf8"))'
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-486.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-486.json
node test-framework/evals/tier-1/validate-markdown-ast.mjs
node scripts/validate-jsonl.mjs .svc/pipeline-decisions.jsonl
bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-15-wi486-session-isolated-bootstrap/manifest.md
git diff --check
```

If the repository's JSONL validator exposes a different current CLI, task-6a uses the validator named by the full Tier-1 harness and records the exact successful command.

### Full branch policy

```bash
bash test-framework/evals/run-all-evals.sh
```

The immutable pre-edit comparison point is `BASELINE` — 245 passed, 0 failed, 0 timed out — at `$BASE` (captured in docs/specs/test-evidence/WI-486/pre-change-tier1-baseline.md). The frozen implementation must have zero failures and zero timeouts; a changed total is acceptable only when attributable to the two newly registered focused validators.

## Execution Command Sequence — Land Sequence (B; the WI-489 pattern, executed correctly this session; stated once)

This is the single canonical land ordering. `$BASE` is §A. All variables below are defined before use; there are no placeholders.

**Land-sequence invariant (G1 — fail-fast, stated once).** The sequence runs under `set -euo pipefail`; every gate is a hard predicate that aborts the WHOLE sequence with a non-zero exit and NO step continues past a failed predecessor. In particular a failed `git diff --check`, a failed promoted/full Tier-1 run, a failed `check-chain-receipts`, a failed staged-set diff or `REVIEWED_CODE_SHA` equality assertion, a non-PASS review verdict (§step 3 / G5), or a failed freshness gate (§step 6 / G4) each STOP the land. No `|| true`, no swallowed failure, on any gate. (The only bounded soft-retry is the notes-push loop, which still `exit 1`s after its 5th attempt.)

```bash
set -euo pipefail
ROOT="$PWD"          # the 6a worktree root; receipt bodies live under "$ROOT/.svc/receipt-bodies"
# ---- Base preflight (§A): pinned SHA, not the mutable ref; no undisclosed commits ahead ----
BASE=99da8bcf873d4d2a7b2a2becfb19759c71e3d2de
test "$(git rev-parse --abbrev-ref HEAD)" = "framework-WI-486-isolated-bootstrap"
test "$(git merge-base "$BASE" HEAD)" = "$BASE"
test -z "$(git rev-list "$BASE"..HEAD)"          # implementation stays uncommitted until this one aggregate freeze

# ==== STEP 1 — full verify over the working tree ====
git diff --check
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-486.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-486.json
node test-framework/evals/tier-1/validate-markdown-ast.mjs
bash test-framework/evals/run-all-evals.sh          # must be zero fail / zero timeout vs BASELINE (245/0/0)

# ==== STEP 2 — stage the COMPLETE candidate (incl. new untracked files), THEN hash the reviewed code diff ====
# (resolves round-6 F-001: git diff BASE omits untracked; git add first + diff --cached includes them)
CODE_PATHS='.gitignore hooks/lib/resolve-wi.mjs hooks/codex/lib/codex-hook-context.mjs hooks/codex/svc-codex-skill-load-enforcer.mjs hooks/lib/wi-claim.mjs hooks/svc-task-completion-guard.sh hooks/lib/task-state-compatibility.mjs scripts/svc-ensure-worktree.mjs scripts/svc-migrate-task-state.mjs scripts/inventory-graph-readers.sh schemas/task-state-migration-receipt.schema.json test-framework/evals/tier-1/validate-session-authority-isolation.sh test-framework/evals/tier-1/validate-task-state-compatibility.sh test-framework/evals/tier-1/validate-default-checkout-isolation.sh test-framework/evals/tier-1/validate-session-worktree-binding.sh test-framework/evals/tier-1/validate-codex-execution-integrity.sh'
git add -- $CODE_PATHS                                            # stage code+fixtures, including newly created files
REVIEWED_CODE_SHA=$(git diff --cached "$BASE" -- $CODE_PATHS | sha256sum | awk '{print $1}')   # pinned base + --cached ⇒ untracked-staged included

# ==== STEP 3 — review the CODE diff (gpt-5.6-sol/high); security is a DISTINCT package; every artifact is a concrete assertion (F5) ====
ART=.svc/external-review-artifacts/WI-486/exec ; ART_SEC=.svc/external-review-artifacts/WI-486/security ; mkdir -p "$ART" "$ART_SEC"
EXEC_PKG=/tmp/wi486-exec-pkg.md
{ echo "# WI-486 exec review — reviewed_code_sha=$REVIEWED_CODE_SHA base=$BASE";
  echo "## Spec + AC context"; sed -n '/### Acceptance Criteria — US-1/,/## System Dependencies/p' docs/specs/features/wi-486-session-isolated-bootstrap.md;
  echo '```diff'; git diff --cached "$BASE" -- $CODE_PATHS; echo '```'; } > "$EXEC_PKG"
node scripts/run-external-review.mjs --orchestrator claude --review-kind exec --context-root "$PWD" --artifacts-dir "$ART" < "$EXEC_PKG"
# the agent authors the human review record from $ART/{receipt.json,findings.json}; existence is asserted (F5), not narrated:
test -f docs/specs/reviews/wi-486-exec-cross-model.md
# DISTINCT security package — different bytes + explicit threat lens (F-008), separately hashed:
SEC_PKG=/tmp/wi486-sec-pkg.md
{ echo "# WI-486 SECURITY review — reviewed_code_sha=$REVIEWED_CODE_SHA base=$BASE";
  echo "## Threat model to attack: authority derivation, realpath/symlink containment, forged SVC_CODEX_TASK_GRAPH override, stale-session reclaim, intent-marker/created_paths forgery, migration authorization, fresh-foreign exclusion, backup-first rollback restore";
  echo '```diff'; git diff --cached "$BASE" -- $CODE_PATHS; echo '```'; } > "$SEC_PKG"
SEC_PKG_SHA=$(sha256sum "$SEC_PKG" | awk '{print $1}')
node scripts/run-external-review.mjs --orchestrator claude --review-kind exec --context-root "$PWD" --artifacts-dir "$ART_SEC" < "$SEC_PKG"
test -f docs/specs/reviews/wi-486-security.md
test -f docs/specs/reviews/wi-486-gate.md      # in-session 5-step review-gate decision over REVIEWED_CODE_SHA
# G5 — a review doc EXISTING ≠ PASSING. Gate on a machine-checkable verdict (fail-fast under set -e aborts the land):
grep -qE '^Verdict: PASS$' docs/specs/reviews/wi-486-exec-cross-model.md
grep -qE '^Verdict: PASS$' docs/specs/reviews/wi-486-security.md
grep -qE '^Verdict: PASS$' docs/specs/reviews/wi-486-gate.md
# AND the ACTUAL launcher findings must carry ZERO unresolved critical/high (both exec + security packages):
test "$(jq '[.findings[]? | select((.severity=="critical" or .severity=="high") and (.status // "open")!="resolved")] | length' "$ART/findings.json")" = 0
test "$(jq '[.findings[]? | select((.severity=="critical" or .severity=="high") and (.status // "open")!="resolved")] | length' "$ART_SEC/findings.json")" = 0
# capture the ACTUAL launcher receipt identity for F6 binding (NOT invented):
EXEC_REQ_ID=$(jq -r '.request_id' "$ART/receipt.json")
EXEC_PKG_SHA256=$(jq -r '.package_sha256' "$ART/receipt.json")
SEC_REQ_ID=$(jq -r '.request_id' "$ART_SEC/receipt.json")
# Any accepted finding that edits code/fixtures ⇒ re-run STEP 2 (recompute REVIEWED_CODE_SHA) and STEP 3. Never land un-re-reviewed code.

# ==== STEP 4 — commit the EXACT staged tree (assert reviewed==staged code, staged names==declared set) ====
git add -- $(cat docs/specs/test-evidence/WI-486/declared-file-set.txt)     # stage the full declared set (code + evidence + plan + lifecycle)
git diff --cached --name-only "$BASE" | sort > /tmp/wi486-staged.txt
diff -u docs/specs/test-evidence/WI-486/declared-file-set.txt /tmp/wi486-staged.txt   # staged name-set == declared set (E)
test "$(git diff --cached "$BASE" -- $CODE_PATHS | sha256sum | awk '{print $1}')" = "$REVIEWED_CODE_SHA"   # reviewed code == committed code
test -z "$(git status --porcelain -- hooks scripts schemas | grep -v '^[AM]')"       # no unstaged/untracked implementation residue
COMMIT_MSG_FILE=/tmp/wi486-commit-msg.txt
printf 'feat(session-isolation): intent-anchored session-isolated multi-WI bootstrap (WI-486)\n\nExact-tuple mutation authority, atomic residue-safe bootstrap, shared\nresolver parity, bounded task-state compatibility, explicit receipted\nmigration. Implements SIB-01..42.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>\nCo-Authored-By: GPT-5.6 Codex <contact-b6b620a2d4@example.invalid>\n' > "$COMMIT_MSG_FILE"
git commit -F "$COMMIT_MSG_FILE"

# ==== STEP 5 — emit TREE-BOUND receipts on HEAD; receipt bodies BIND to the real launcher artifacts (F6) ====
mkdir -p .svc/receipt-bodies
# plan-manifest + review-plan bodies were WRITTEN AT PLAN CONVERGENCE (§Gate Ordering: plan-manifest carries the v3
# ac_digests baton computed there) and preserved at .svc/receipt-bodies/{plan-manifest,review-plan}.json with a checksum
# sidecar. They are RE-USED here byte-for-byte — never regenerated — and verified against the sidecar (F6):
sha256sum -c .svc/receipt-bodies/plan-bodies.sha256
# exec-record + audit bodies attest the REVIEWED CODE is complete PRE-MERGE (G8) — they do NOT claim the merge/promotion happened;
# merged/VERIFIED lifecycle state belongs to task-6b. `reviewed_code_sha` binds the attestation to the exact reviewed tree:
cat > .svc/receipt-bodies/exec-record.json <<JSON
{"receipt_type":"exec-record","wi":"WI-486","author":"anthropic","attests":"reviewed-code-complete-pre-merge","reviewed_code_sha":"$REVIEWED_CODE_SHA","tasks_completed":["task-1","task-2","task-3","task-4","task-5","task-6a"]}
JSON
cat > .svc/receipt-bodies/audit-implementation.json <<'JSON'
{"receipt_type":"audit-implementation","wi":"WI-486","result":"pass","evidence":"docs/specs/audit/wi-486-session-isolated-bootstrap-analysis.md"}
JSON
# review-exec body EMBEDS the launcher receipt identity captured in STEP 3 (request_id + package_sha256 + artifacts path) — NOT invented (F6).
# `verdict:"pass"` is the machine-checkable review verdict required by G5; `attests` scopes it to reviewed code, not the merge (G8):
jq -n --arg reqid "$EXEC_REQ_ID" --arg pkg "$EXEC_PKG_SHA256" --arg secreq "$SEC_REQ_ID" --arg rcs "$REVIEWED_CODE_SHA" '{
  receipt_type:"review-exec", wi:"WI-486", author:"anthropic", reviewer:"openai", result:"pass", verdict:"pass",
  attests:"reviewed-code-complete-pre-merge", reviewed_code_sha:$rcs,
  launcher:{ request_id:$reqid, package_sha256:$pkg, artifacts:".svc/external-review-artifacts/WI-486/exec" },
  security_launcher:{ request_id:$secreq, artifacts:".svc/external-review-artifacts/WI-486/security" },
  evidence:["docs/specs/reviews/wi-486-exec-cross-model.md","docs/specs/reviews/wi-486-security.md","docs/specs/reviews/wi-486-gate.md"]
}' > .svc/receipt-bodies/review-exec.json
# ASSERT the emitted review-exec's referenced launcher identity EXISTS in the actual on-disk launcher receipt (F6) AND verdict is pass (G5):
test "$(jq -r '.launcher.request_id' .svc/receipt-bodies/review-exec.json)"    = "$(jq -r '.request_id'    "$ART/receipt.json")"
test "$(jq -r '.launcher.package_sha256' .svc/receipt-bodies/review-exec.json)" = "$(jq -r '.package_sha256' "$ART/receipt.json")"
test "$(jq -r '.verdict' .svc/receipt-bodies/review-exec.json)" = "pass"
for T in plan-manifest review-plan exec-record review-exec audit-implementation; do
  node scripts/emit-receipt.mjs --type "$T" --wi WI-486 --sha HEAD --body ".svc/receipt-bodies/$T.json"
done
node scripts/check-chain-receipts.mjs --sha HEAD          # complete 5-receipt envelope on the aggregate commit

# ==== STEP 6 — pre-merge freshness gate (F8/G4), then sanctioned merge ====
# origin/main must still equal the pinned $BASE the tree was reviewed/tested against. If main advanced, a squash-merge would
# combine an UNREVIEWED tree — REFUSE, rebase, recompute, re-review before merging. The rebase PRESERVES the candidate:
# the implementation is already committed on this branch (STEP 4), so `git rebase` carries every reviewed change onto the new
# main — it NEVER discards the candidate. After rebasing we re-stage $CODE_PATHS and recompute REVIEWED_CODE_SHA from the
# COMBINED tree, then assert the recomputed diff is NON-EMPTY so the re-run exec review sees the real combined diff (not empty).
git fetch origin main --quiet
if [ "$(git rev-parse origin/main)" != "$BASE" ]; then
  git rebase origin/main                                   # carries the committed candidate onto new main; never discards it
  BASE=$(git rev-parse origin/main)                        # recompute the pinned base to the combined tree's parent
  git add -- $CODE_PATHS
  REVIEWED_CODE_SHA=$(git diff --cached "$BASE" -- $CODE_PATHS | sha256sum | awk '{print $1}')
  test -n "$(git diff --cached "$BASE" -- $CODE_PATHS)"    # G4: the combined diff MUST be non-empty before re-review (rebase kept the candidate)
  echo "BASE advanced — candidate preserved via rebase; re-run STEP 3 exec+security review on the NON-EMPTY combined diff, then resume from STEP 4. Do NOT merge on a stale base."
  exit 2
fi
git push origin framework-WI-486-isolated-bootstrap
git push origin refs/notes/svc-receipts:refs/notes/svc-receipts
PR_TITLE='feat(session-isolation): intent-anchored session-isolated multi-WI bootstrap (WI-486)'
PR_BODY_FILE=/tmp/wi486-pr-body.md
printf 'Implements WI-486 SIB-01..42. Exact-tuple mutation authority, atomic intent-anchored bootstrap, shared resolver host parity, bounded task-state compatibility, explicit receipted migration.\n\nReviewed code sha: %s (base %s). Evidence: docs/specs/reviews/wi-486-{exec-cross-model,security,gate}.md.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n' "$REVIEWED_CODE_SHA" "$BASE" > "$PR_BODY_FILE"
PR=$(gh pr create --base main --head framework-WI-486-isolated-bootstrap --title "$PR_TITLE" --body-file "$PR_BODY_FILE" | grep -oE '[0-9]+$')
mkdir -p .svc/review-receipts
printf '{"pr":%s,"wi":"WI-486","reviewed_at":"%s","review_gate_task":"WI-486 review-exec","reviewer":"gpt-5.6-sol high","result":"PASS","review_gate_required":true,"evidence":["docs/specs/reviews/wi-486-exec-cross-model.md","docs/specs/reviews/wi-486-security.md","docs/specs/reviews/wi-486-gate.md"]}\n' "$PR" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ".svc/review-receipts/pr-$PR.json"
node scripts/validate-review-receipt.mjs --pr "$PR"
node scripts/merge-pr-with-review-receipt.mjs --pr "$PR" --squash --delete-branch
MERGE_SHA=$(gh pr view "$PR" --json mergeCommit --jq .mergeCommit.oid)

# ==== STEP 7 — RE-EMIT the 5-receipt envelope onto the squash MERGE_SHA (squash mints a new SHA that orphans tree-bound notes) ====
git fetch origin main --quiet
sha256sum -c .svc/receipt-bodies/plan-bodies.sha256    # plan-manifest+review-plan bodies are BYTE-IDENTICAL to plan-convergence originals (F6)
for T in plan-manifest review-plan exec-record review-exec audit-implementation; do
  node scripts/emit-receipt.mjs --type "$T" --wi WI-486 --sha "$MERGE_SHA" --body ".svc/receipt-bodies/$T.json"
done
node scripts/check-chain-receipts.mjs --sha "$MERGE_SHA"        # 5-receipt envelope complete on the PROMOTED commit
# bounded-retry notes publication (F-007: fetch–merge–push loop, not a bare fetch)
for attempt in 1 2 3 4 5; do
  if git push origin refs/notes/svc-receipts:refs/notes/svc-receipts; then break; fi
  git fetch origin refs/notes/svc-receipts:refs/notes/svc-receipts-remote || true
  git notes --ref svc-receipts merge -s cat_sort_uniq refs/notes/svc-receipts-remote || true
  [ "$attempt" = 5 ] && { echo "notes push failed after 5 attempts"; exit 1; }
done

# ==== STEP 8 (task-6b) — bootstrap a FRESH ISOLATED 6b worktree; run promoted verify INSIDE it (G7: primary untouched) ====
# The verify-promotion follow-up NEVER mutates the shared primary checkout's tracked/untracked residue (Residue-preservation
# invariant). It runs in its OWN worktree created by the canonical bootstrap — exactly like WI-489's framework-WI-489-verify-
# promotion worktree. The primary's default-checkout bytes stay byte-identical throughout 6b.
VP_WT=$(node scripts/svc-ensure-worktree.mjs --wi WI-486 --branch framework-WI-486-verify-promotion --base origin/main --json | jq -r '.absolute_worktree')
( cd "$VP_WT" && git fetch origin main --quiet && git reset --hard origin/main )
# promoted verify + G7 run INSIDE the 6b worktree (on origin/main content), writing DURABLE in-repo evidence (G9), not /tmp:
mkdir -p "$VP_WT/docs/specs/verification"
( cd "$VP_WT" && bash test-framework/evals/run-all-evals.sh --tier1 ) | tee "$VP_WT/docs/specs/verification/wi-486-promotion.md"

# ==== STEP 9 (task-6b) — SEPARATE verify-promotion PR through the SANCTIONED CHAIN with 6b's OWN receipts (G6, WI-489 PR-#146 pattern) ====
# 6b changes NON-EXEMPT state (lane-tasks graph + WI/INDEX status) → it is NOT a quick-fix/direct-to-main shortcut. It emits its
# OWN plan-manifest/review-plan (reused convergence bodies) + exec-record + review-exec + audit envelope, writes a review-receipt,
# and merges via merge-pr-with-review-receipt — the same sanctioned path 6a used.
test -f "$VP_WT/docs/specs/test-evidence/WI-486/post-change-tier1-frozen.md"    # agent-authored; existence asserted (F5)
test -f "$VP_WT/docs/specs/test-evidence/WI-486/pre-post-evidence.json"
# status→VERIFIED, INDEX synced, lane-tasks graph closed, durable verification record — all inside the 6b worktree:
git -C "$VP_WT" add -- docs/specs/work-items/WI-486.md docs/specs/work-items/INDEX.md .svc/lane-tasks-WI-486.json docs/specs/test-evidence/WI-486/post-change-tier1-frozen.md docs/specs/test-evidence/WI-486/pre-post-evidence.json docs/specs/verification/wi-486-promotion.md docs/specs/features/wi-486-session-isolated-bootstrap.md
VP_MSG=/tmp/wi486-vp-msg.txt
printf 'docs(WI-486): verify promotion — status VERIFIED, lane-tasks closed (G7)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>\n' > "$VP_MSG"
git -C "$VP_WT" commit -F "$VP_MSG"
git -C "$VP_WT" push origin framework-WI-486-verify-promotion
PR_VP=$(cd "$VP_WT" && gh pr create --base main --head framework-WI-486-verify-promotion --title 'docs(WI-486): verify promotion — status VERIFIED, lane-tasks closed (G7)' --body 'Verify-promotion follow-up for WI-486. Flips status to VERIFIED, closes the lane-tasks graph, records promoted Tier-1 identity and pre/post evidence.' | grep -oE '[0-9]+$')
# 6b's OWN sanctioned chain: reuse convergence plan bodies; emit fresh 6b exec/review/audit; commit-bound to the 6b HEAD:
VP_HEAD=$(git -C "$VP_WT" rev-parse HEAD)
jq -n --arg h "$VP_HEAD" '{receipt_type:"exec-record",wi:"WI-486",scope:"verify-promotion-6b",attests:"lifecycle-closure",head:$h}' > .svc/receipt-bodies/vp-exec-record.json
jq -n --arg h "$VP_HEAD" '{receipt_type:"review-exec",wi:"WI-486",scope:"verify-promotion-6b",result:"pass",verdict:"pass",attests:"lifecycle-closure",head:$h}' > .svc/receipt-bodies/vp-review-exec.json
jq -n --arg h "$VP_HEAD" '{receipt_type:"audit-implementation",wi:"WI-486",scope:"verify-promotion-6b",result:"pass",head:$h}' > .svc/receipt-bodies/vp-audit.json
( cd "$VP_WT" && node "$ROOT/scripts/emit-receipt.mjs" --type plan-manifest --wi WI-486 --sha "$VP_HEAD" --body "$ROOT/.svc/receipt-bodies/plan-manifest.json"
  node "$ROOT/scripts/emit-receipt.mjs" --type review-plan --wi WI-486 --sha "$VP_HEAD" --body "$ROOT/.svc/receipt-bodies/review-plan.json"
  node "$ROOT/scripts/emit-receipt.mjs" --type exec-record --wi WI-486 --sha "$VP_HEAD" --body "$ROOT/.svc/receipt-bodies/vp-exec-record.json"
  node "$ROOT/scripts/emit-receipt.mjs" --type review-exec --wi WI-486 --sha "$VP_HEAD" --body "$ROOT/.svc/receipt-bodies/vp-review-exec.json"
  node "$ROOT/scripts/emit-receipt.mjs" --type audit-implementation --wi WI-486 --sha "$VP_HEAD" --body "$ROOT/.svc/receipt-bodies/vp-audit.json"
  node "$ROOT/scripts/check-chain-receipts.mjs" --sha "$VP_HEAD" )
mkdir -p .svc/review-receipts
printf '{"pr":%s,"wi":"WI-486","reviewed_at":"%s","review_gate_task":"WI-486 verify-promotion review-exec","reviewer":"in-session review-gate","result":"PASS","review_gate_required":true,"evidence":["docs/specs/verification/wi-486-promotion.md"]}\n' "$PR_VP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ".svc/review-receipts/pr-$PR_VP.json"
node scripts/validate-review-receipt.mjs --pr "$PR_VP"
node scripts/merge-pr-with-review-receipt.mjs --pr "$PR_VP" --squash --delete-branch
git fetch origin main --quiet                                   # G9: make MERGE_SHA_6B exist locally before emitting on it
MERGE_SHA_6B=$(gh pr view "$PR_VP" --json mergeCommit --jq .mergeCommit.oid)
# re-emit 6b's envelope + verify-promotion onto 6b's squash MERGE_SHA (durable in-repo evidence path, not /tmp — G9):
for T in plan-manifest:plan-manifest review-plan:review-plan exec-record:vp-exec-record review-exec:vp-review-exec audit-implementation:vp-audit; do
  node scripts/emit-receipt.mjs --type "${T%%:*}" --wi WI-486 --sha "$MERGE_SHA_6B" --body ".svc/receipt-bodies/${T##*:}.json"
done
cat > .svc/receipt-bodies/verify-promotion.json <<JSON
{"receipt_type":"verify-promotion","wi":"WI-486","implementation_merge_sha":"$MERGE_SHA","promotion_merge_sha":"$MERGE_SHA_6B","result":"VERIFIED","tier1":"pass","evidence":"docs/specs/verification/wi-486-promotion.md"}
JSON
node scripts/emit-receipt.mjs --type verify-promotion --wi WI-486 --sha "$MERGE_SHA_6B" --body .svc/receipt-bodies/verify-promotion.json
node scripts/check-chain-receipts.mjs --sha "$MERGE_SHA_6B"
for attempt in 1 2 3 4 5; do
  if git push origin refs/notes/svc-receipts:refs/notes/svc-receipts; then break; fi
  git fetch origin refs/notes/svc-receipts:refs/notes/svc-receipts-remote || true
  git notes --ref svc-receipts merge -s cat_sort_uniq refs/notes/svc-receipts-remote || true
  [ "$attempt" = 5 ] && { echo "notes push failed after 5 attempts"; exit 1; }
done
```

`RECOVERY_IF_FAIL`: keep the isolated worktree and every fixture artifact needed to explain the failure. Correct only the current task, rerun its focused validators, then replay every downstream task. For a bootstrap failpoint failure, compare the transaction ledger to pre-attempt repository/worktree/branch/graph/claim/binding digests and remove nothing manually. For migration failure, preserve the original, backup, and failure receipt; do not rerun against changed bytes until the cause is classified. Any accepted code/fixture finding re-runs STEP 2 (new `REVIEWED_CODE_SHA`) and STEP 3. If STEP 6's freshness gate exits 2 (main advanced), the candidate is preserved by the rebase (G4) — re-run STEP 3 on the NON-EMPTY combined diff then resume from STEP 4 (F8). Because the whole sequence runs `set -euo pipefail` (G1), any failed gate aborts it with non-zero exit and nothing proceeds past the failure; re-enter at the failed step after fixing its cause. The task-6b worktree (`$VP_WT`) is retained on failure like the 6a worktree; the primary checkout is never mutated (G7). No verification bypass or force operation is allowed. The reviewed commit uses repository author configuration plus `Co-Authored-By: GPT-5.6 Codex <contact-b6b620a2d4@example.invalid>`.

## Checkpoint Plan

| Order | Checkpoint | Rollback anchor | Required proof |
|---:|---|---|---|
| 1 | `wi486-red-contract` | `$BASE` | fixture syntax + NAMED expected-red failures tied to missing WI-486 behavior; declared-file-set + graph-reader inventory generated |
| 2 | `wi486-shared-authority` | checkpoint 1 | reads-before-resolution, exact tuple, override, receipt replay |
| 3 | `wi486-atomic-bootstrap` | checkpoint 2 | intent-anchored residue, race, failpoint, resume, partial, different-WI replay |
| 4 | `wi486-compatibility-migration` | checkpoint 3 | classification, backup, schema, success/failure/idempotency, loop proof |
| 5 | `wi486-host-parity` | checkpoint 4 | Claude/Codex vector parity + Stop regressions |
| 6a | `wi486-frozen-branch` | checkpoint 5 | §Execution Command Sequence steps 1–7: verify, distinct exec+security reviews, tree-bound receipts, freshness gate, sanctioned merge, re-emit envelope |
| 6b | `wi486-verified` | checkpoint 6a | §Execution Command Sequence steps 8–9: own worktree + promoted verify, sanctioned-chain PR, status→VERIFIED, lane graph closed, verify-promotion on 6b's merge SHA |

Logical checkpoints are recorded in `progress.md`; implementation remains uncommitted until task-6a freezes one aggregate diff.

## Framework-Lane Compliance

Every mandatory upstream framework-lane skill is completed with a cited artifact (lane-tasks `WI-486`):

| Upstream skill | Status | Artifact citation |
|---|---|---|
| improve-framework | completed | `docs/specs/bugfix/wi-486-session-bootstrap-brief.md` (reproduced multi-session failures) |
| research | completed | `docs/specs/decisions/wi-486-session-isolated-bootstrap.md` (host-session-id + claim/binding prior art) |
| diagnose-bug | completed | `docs/specs/bugfix/wi-486-session-bootstrap-brief.md` (root cause: authority derived from graph uniqueness, not exact tuple) |
| write-spec | completed | `docs/specs/features/wi-486-session-isolated-bootstrap.md` (BASELINED; SIB-01..42) |
| design-tech | completed | `docs/specs/decisions/wi-486-session-isolated-bootstrap.md` (accepted architecture + rollback/foreign-state/migration boundaries) |
| plan-changeset | completed | this manifest |
| review-plan | in_progress | `review-log.yaml` — six prior patch rounds abandoned; this fresh re-author is the convergence target; receipts emitted at plan convergence (§Gate Ordering) |

No mandatory upstream skill is skipped; none is asserted without a cited artifact.

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX transitions | N/A | Internal hook/CLI Enabler; authority/bootstrap/compatibility/migration state machines are the flow contract |
| UI tokens/assets | N/A | No browser-visible file, component, route, viewport, or rendering AC |
| Technical design | satisfied | baselined Technical Design in the spec plus D1–D8 in the decision log |
| Style contract | satisfied | zero-dependency ESM, portable Bash adapter, JSON Schema, secure atomic local files, existing Tier-1 shell conventions |
| Persona differentiation | N/A | System-only S1 Framework Orchestrator journey; `J-FW-05` supplies the concurrent-session pressure |
| Capability evidence | satisfied | current Node, git-worktree, secure claim/binding, atomic state, task-graph, and WI-489 launcher paths are locally present and baseline-tested |
| G4 architecture review | satisfied | design-tech adversarial review PASS with rollback, foreign-state, and migration boundaries resolved |
| Upstream lane | satisfied | route-workflow, diagnose-bug, write-spec, design-tech completed with graph phase receipts |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---:|---|---|---|---|
| 3 | Out-of-tree version control | isolated branch/worktree, later PR, same-WI linked-worktree inventory, two preserved stash commits | coupled | exact session binding; transaction conflict scan; §Execution Command Sequence; stash commits reported but never restored or dropped |
| 12 | Downstream framework artifacts | Codex/Claude authority consumers, WI-485 receipt gate, WI-487 installation consumer, work-item/spec/index lifecycle | coupled | shared resolver, parity fixtures, lane/task/receipt/Markdown validators, dependent-WI boundary |
| 15 | Runtime filesystem | secure repository lock, bootstrap-intent markers, compatibility markers, migration backups/receipts, machine-local receipt bodies | coupled | 0700/0600 ownership, atomic create/replace, attempt ledger, reverse selective rollback, digest/version paths, idempotent migration |
| ad-hoc | Default checkout residue | unrelated tracked/untracked user/framework bytes relied on as an isolation fixture | decoupled-justified | before/after byte digests prove bootstrap never writes it; immutable stash commits independently preserve the two known residue sets |

Untouched environments (walked the taxonomy, found nothing): 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

Default-checkout residue is intentionally decoupled: the bootstrap must operate without taking ownership of it. The transaction never stages, stashes, resets, restores, deletes, or edits those paths; fixture digests and the preserved immutable stash commits detect any violation. Runtime artifacts are non-authoritative unless the resolver revalidates the current exact tuple and state bytes.

## Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| task-1 | both new validator paths absent; three modified validators exist | PASS | create two local fixture suites, extend three harnesses |
| task-1 | promoted baseline is `BASELINE` (245/0/0) at `$BASE` | PASS | store immutable baseline evidence with raw command output before implementation |
| task-1 | declared-file-set and graph-reader inventory generators run and self-include their own paths | PASS | generate machine-readable sets; assert at freeze |
| task-2 | `resolveWI`, `activeTask`, `isReadOnlyTool`, and the skill-receipt gate exist at planned paths | PASS | extend established exports; no parallel authority service |
| task-2 | current Codex enforcer resolves ambiguous inventory before read classification | PASS as reproduced bug | move read-only exit before shared tuple resolution |
| task-3 | `ensureWorktree`, secure repo lock (`withExclusiveLock`), worktree inventory, and binding writer exist in `wi-claim.mjs` | PASS | add intent marker first, extend transaction, remove whole-checkout cleanliness precondition |
| task-3 | target graph does not yet exist in a fresh worktree | PASS | create after worktree, before claim/binding, under the lock |
| task-4 | compatibility module, migration CLI, and receipt schema do not exist | PASS | create in dependency order with Node core only |
| task-4 | secure runtime + atomic-write patterns (`atomicWriteJson`, 0700/0600) exist in `wi-claim.mjs`/state-io | PASS | reuse ownership/mode and rename/fsync conventions without a package dependency |
| task-5 | Claude Stop embeds a separate binding/claim resolver and invalid-graph status bypasses the pressure cap | PASS as reproduced bug | call shared JSON resolver + compatibility serializer; retain ordinary completion pressure |
| task-6b | work-item/index paths, task graph, Markdown AST, JSONL, and full Tier-1 validators exist | PASS | run §Execution Command Sequence and record exact command outcomes |
| all | no package manifest, ORM schema, external API, browser, or paid-model runtime enters implementation | PASS | no dependency install, migration framework, UI proof, or provider fixture needed |
| rollback | bootstrap + migration write paths have named pre-state and selective rollback/backup requirements | PASS | failpoint matrices verify every boundary before freeze |

### Scenario Coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---|---|---:|---|---|
| J-FW-05 | FW05-S7 foreign graphs do not deny safe inspection | 4 | task-1,2,6 | 4/4 |
| J-FW-05 | FW05-S8 bounded bootstrap establishes complete authority | 6 | task-1,2,3,6 | 6/6 |
| J-FW-05 | FW05-S9 same-WI race has one winner | 5 | task-1,3,6 | 5/5 |
| J-FW-05 | FW05-S10 Claude/Codex exact binding parity | 5 | task-1,2,5,6 | 5/5 |
| J-FW-05 | FW05-S11 legacy inspection never migrates implicitly | 6 | task-1,4,5,6 | 6/6 |
| J-FW-05 | FW05-S12 unsupported state handling terminates | 6 | task-1,4,5,6 | 6/6 |

No simulation failure, acknowledged warning, unresolved architecture question, journey gap, or package dependency remains.

## Adversarial Self-Review

1. **Missing tasks:** PASS — SIB-01..42 and all FW05-S7..S12 steps map to implementing tasks.
2. **Dependency correctness:** PASS — red fixtures precede shared authority; bootstrap consumes the resolver contract; compatibility precedes Claude adoption; freeze follows all runtime work.
3. **Scope reduction:** PASS — the full accepted contract is planned; WI-487-only install/error rendering is a named boundary, not deferred WI-486 behavior.
4. **Validation strength:** PASS — behavior uses race, failpoint, byte-digest, parity, schema, negative, and replay fixtures; syntax and grep checks are secondary.
5. **First-task viability:** PASS — task-1 needs only `$BASE`, the committed spec/diagnosis/design, this manifest, and existing validators.
6. **Pattern completeness:** PASS — authority negatives cover unset/outside/symlink/wrong-worktree/wrong-WI/foreign/branch/inventory/receipt; read-classifier negatives cover chaining/redirect/interpolation/quoting/escaping/newline.
7. **Visual tier:** N/A — no visual AC or browser-visible file.
8. **Mock parity:** N/A — no existing UI component/screen modified.
9. **Provider fidelity:** N/A — the WI-489 launcher is used for independent review only; implementation and Tier-1 tests make no provider call.
10. **Persona trace:** PASS — every scenario traces to S1 Framework Orchestrator in J-FW-05.
11. **Single-source consistency:** PASS — `$BASE`, `BASELINE`, the intent marker, the liveness rule, the land ordering, and `declared-file-set.txt` are each defined once and referenced; no value is restated differently in two places.
12. **Fail-fast + verdict gating:** PASS — the land runs `set -euo pipefail` (G1); reviews gate on `Verdict: PASS` + `verdict:"pass"` + zero unresolved critical/high (G5), not mere existence.
13. **Liveness safety:** PASS — process liveness overrides TTL; a same-host LIVE pid is never reclaimed (G3); the ledger is a record-then-create superset with a subset backstop (G2).

## Promotion Readiness Checklist

- [ ] Every planned runtime, test, schema, evidence, state, and lifecycle file is accounted for in `declared-file-set.txt`.
- [ ] SIB-01..42 have passing deterministic proof and spec evidence.
- [ ] Proved reads allow before graph inventory; unsafe shell variants remain governed.
- [ ] Mutation authority requires the exact tuple and WI-485 skill receipt on both hosts.
- [ ] Bootstrap race, failpoint, residue, resume, partial, target-conflict, and different-WI fixtures pass; the intent marker attributes every crash state.
- [ ] Supported/lossless/quarantine/fresh-foreign compatibility bytes remain correctly classified and preserved.
- [ ] Explicit migration backup, receipt, failure, and idempotency replay passes; restore is WI-scoped and digest-verified.
- [ ] Unchanged compatibility state cannot produce indefinite hard blocks; digest and session partitioning pass.
- [ ] Tier-1 fixtures cannot invoke an external model.
- [ ] Task graph, receipt, Markdown, JSONL, and `git diff --check` validators pass.
- [ ] Full Tier-1 passes with zero failures and zero timeouts vs `BASELINE` (245/0/0).
- [ ] Plan receipts (plan-manifest, review-plan) exist at plan convergence and re-attach to HEAD then `MERGE_SHA`; `check-chain-receipts` is complete on both.
- [ ] Review-exec, review-security, review-gate, and audit evaluate the same `REVIEWED_CODE_SHA`; security uses a DISTINCT hashed package.
- [ ] Land sequence runs `set -euo pipefail`; every gate (verify, check-chain, staged-set/hash, review verdict, freshness) aborts on failure (G1).
- [ ] Pre-merge freshness gate passed (`origin/main == $BASE`); if main advanced, rebase preserved the candidate and re-review saw a NON-EMPTY combined diff (G4); implementation PR (6a) merged; notes published with bounded retry.
- [ ] Separate verify-promotion PR (6b) went through the sanctioned chain with its OWN receipts + `merge-pr-with-review-receipt` (G6); ran in its OWN `svc-ensure-worktree` worktree with the primary checkout byte-unchanged (G7); `verify-promotion` emitted on 6b's merge SHA (fetched first, cites the durable docs/specs/verification/wi-486-promotion.md — G9), never inside 6a's tree.
- [ ] `review-exec` receipt body binds to the real launcher artifacts (request_id + package_sha256 asserted against `$ART/receipt.json`); preserved plan bodies byte-match the plan-convergence sidecar.
- [ ] Intent marker records `created_paths[]` + `owner_token`; stale-recovery deletes ONLY listed paths.
- [ ] Migration is backup-first: original bytes recoverable from the verified backup at every point after the digest check.
- [ ] No ORM schema touched; the task-state JSON migration has its own explicit CLI, schema, backup, and replay.
- [ ] Stash commits `372699e5…` and `5b471b64…` are never restored, dropped, or rewritten.

## Rollback

Before merge, any change after a failed checkpoint invalidates that checkpoint and every downstream proof; correct the current task, replay dependents, and freeze a new `REVIEWED_CODE_SHA`.

After merge, rollback is two ordered steps: **(1)** FIRST restore any already-migrated task-state — for every recorded WI-486 migration digest (.svc/task-state-migrations/v1/*/receipt.json where `wi == WI-486` and `status == migrated`) run `node scripts/svc-migrate-task-state.mjs --wi WI-486 --authorization "$AUTH" --restore <digest>` where **`$AUTH` is the repository-owner authorization file** (G10 — §Explicit migration: its exact bytes hash to `SVC_TASK_STATE_MIGRATION_SHA256`, its `authority` is `"repository-owner"`, it names `wi: WI-486`, and its `timestamp` is within a 24h freshness window — no unresolved placeholder) (WI-scoped, restores only this WI's own backups) and verify the restored bytes' digest equals the recorded original; **(2)** THEN land a normal revert PR that reverts BOTH the verify-promotion follow-up commit (6b) and the implementation commit (6a) — restoring both host adapters, `wi-claim.mjs`, and the original bootstrap behavior while removing the compatibility/migration modules, schema, `.gitignore` runtime-dir entries, and focused validators together. Restoration proof precedes code revert; backups/receipts are never deleted manually. Do not reset or force push. Never restore, drop, or rewrite stash commits `372699e5c001383e55f75a911d87149b5f0518f8` or `5b471b6491b16d53eccbb3d9bd8a94cc8a40d6f0` without new owner authority.
