# Improvement Protocol — Multi-Agent Worktree Handoff Contracts & Automated Verification Receipts

- **Date:** 2026-08-23
- **Type:** Audit report + prescriptive improvement protocol (non-changeset)
- **Scope audited:** `references/stage-registry.json` + `skills-manifest.json` stage/gate surface; hook wirers `scripts/wire-hooks.mjs`, `scripts/wire-cursor-hooks.mjs`, `scripts/wire-grok-hooks.mjs`; receipt emission formats across `hooks/`, `scripts/`, `schemas/receipts/`; worktree handoff lifecycle (`scripts/worktree.sh`, `hooks/lib/wi-claim.mjs`, `hooks/lib/authority-store.mjs`, `hooks/lib/delegation-authority.mjs`, merge-back validators).
- **Method:** Direct read of the three named wirers and contract docs; parallel deep audits of registry, receipts, and handoff mechanics. All findings carry file:line evidence.

---

## 1. Executive Summary

The delegated-execution spine (controller lease v2 → delegation capability → Landlock containment → receipt recompute → locked sequential merge-back) is rigorous: Git-ref CAS locking, generation counters, one-time tokens, digest-bound receipts, and injected failpoints. The exposure is concentrated at the **edges that predate or bypass that spine**:

1. **Stage vocabulary is single-source for three consumers but not all** — `stage-segment.mjs` embeds a second skill-name vocabulary with zero mechanical tie-back; the manifest `reviewGates` block is read by no tooling and carries a documented G6 collision (FP-024).
2. **The three hook wirers implement three different idempotency, durability, and failure policies** — Claude's wirer writes host settings non-atomically via heuristic string dedup; Cursor silently resets a corrupt config to `{}` and keeps no backup; Grok has the best posture (immutable backup + rollback + failpoint) but relies on a hand-rolled TOML round-trip.
3. **Receipt formats have drifted into ~12 shapes** with four incompatible `schema_version` conventions, two JSON-Schema drafts, one emitter/schema enum mismatch (`explicit_takeover`), one already-broken consumer (`mine-receipts.mjs` vs slot-keyed notes), and one soft-fail hole (missing schema file ⇒ validation passes).
4. **Handoff authority is machine-checked on the delegated path only** — the parallel wave path trusts worker-authored result JSON, `worktree.sh promote` reports failure as success, and promote/remove/cleanup run without cross-process locking.

The protocol below (§5) prescribes 20 numbered improvements with enforcement mechanism and verification for each.

---

## 2. Stage Registry Audit

### 2.1 Current state

| Artifact | Role |
|---|---|
| `references/stage-registry.json:1–57` | Canonical stage vocabulary (`_version: 1`, 42 stages, 7 story-type profiles). "The `stages` array order IS the canonical stage order." |
| `scripts/lib/stage-registry.mjs:5–49` | Shared loader (validates classes, dupes, profiles). `_version` is never read — inert decoration. |
| Consumers | `audit-story-receipts.mjs:64`, `stage-activation.mjs:179–181`, `task-graph.mjs:828–830` derive from the registry through the loader. |
| `skills-manifest.json:409–445` | `reviewGates` G1–G7 — documentation-only, consumed by zero scripts. |
| `scripts/stage-segment.mjs:24–28` | Hardcoded 3-segment mandatory chain in *skill names* (`seg-1-plan`, `seg-2-exec`, `seg-3-land`). Does not import the loader. |

### 2.2 Findings

- **SR-1 — Second vocabulary escaping the single-source rule.** `stage-segment.mjs:24–28` uses skill names while the registry uses stage keys; registry essentials `spec-sync` / `index-restamp` appear in no segment, and `land-changeset` / `verify-promotion` exist nowhere in the registry. The exempting consumer list in `validate-stage-registry-single-source.sh:20–23` does not include `stage-segment.mjs`.
- **SR-2 — Hand-duplicated condition table.** `stage-activation.mjs:30–59` re-types the registry's `activation_condition` set; its own comment (:186–188) concedes agreement is "by coincidence," fenced only by an exit-2 assert (:190–203).
- **SR-3 — Dead gate data + G6 collision.** Manifest `reviewGates.G6 = after land-changeset` (:435–436) vs `review-exec/SKILL.md` self-labeling "G6"; tracked as FP-024 in `OPEN-PROPOSALS.md:19`. Nothing validates the block.
- **SR-4 — No manifest version/integrity.** `skills-manifest.json` (16 top-level keys) carries no version, revision, or content hash — inconsistent with `schema_version` discipline everywhere else in `.svc` state and receipts.
- **SR-5 — Linter blind spots.** `lint-skills-manifest.mjs` checks membership subsets (:117–139), not ordering (except the narrow `validate-review-gate-routing-arrays.sh:23–31`), not lane-name-set stability, not `reviewGates`. Duplicates pass: `track-visuals` appears twice in `pipeline` (:230, :238) and twice in greenfield (:506, :512) with no intent marker.
- **SR-6 — Soft template drift.** Stale `references/receipts-TEMPLATE.json` stage keys produce a warning, never failure (`audit-story-receipts.mjs:68–83`).

---

## 3. Hook Wiring Scripts Audit

### 3.1 Comparative posture

| Property | wire-hooks (Claude) | wire-cursor-hooks | wire-grok-hooks |
|---|---|---|---|
| Idempotency model | Additive merge + per-hookId string match (`isAlreadyWired`, :462–501, ~35 bespoke cases) + exact dedup (WI-076 :748–768) + variant dedup-v2 (WI-359 :797–836) | Subtractive rebuild: drop all svc-owned entries per event, re-append canonical set (`mergeCursorConfig`, :131–160) | Subtractive rebuild via region split (`splitTomlHookRegions` :393–430, `composeWiredToml` :432–442) |
| Write atomicity | **Non-atomic** `fs.writeFileSync` on live settings (3 separate write paths :869–894, :917–924) | Atomic tmp+rename (:186–188) | Atomic tmp+rename (:499–502) |
| Backup before mutation | Timestamped copy once (:564–573) | **None** | Immutable `.pre-migration.bak` + per-run rollback + mode preservation (:489–494) |
| Corrupt-config policy | Parse error ⇒ exit 1 (:556–559) | Parse error ⇒ **silent reset to `{}`** then overwrite (:169–175) | Read error ⇒ throw (:471–477) |
| Failure injection / tests | `--list-all` structural replay (:538–546) | none | `SVC_WIRE_GROK_FAIL_AFTER_BACKUP` failpoint (:496–498) + tier-1 TOML roundtrip eval |
| Ownership classifier | substring `svc-` / per-file heuristics; kimi strip (:775–786) | `cmd.includes("svc-")` / `/skills/hooks/` / `svc-enforce` (:143–148) | regex `isSvcOwnedText` (:382–389); non-svc text kept byte-verbatim |

### 3.2 Findings

- **HW-1 — Claude wirer is the durability outlier.** Whole-file rewrite without temp+rename; a crash mid-write corrupts `~/.claude/settings.json` (backup exists but is not used for recovery automatically). Three duplicated write paths invite divergence.
- **HW-2 — Cursor data-loss window.** A malformed `~/.cursor/hooks.json` is silently treated as empty and overwritten; combined with no backup, user hooks are unrecoverable.
- **HW-3 — String-identity idempotency does not scale.** Every new Claude hook requires a matching `isAlreadyWired` branch (:462–501); misses historically produced duplicates that motivated two dedup passes. Cursor/Grok avoid this by construction (rebuild-per-run).
- **HW-4 — Quoting hygiene.** Cursor quotes `NODE_CMD` but interpolates unquoted `hooksDir` paths (:61–125); Grok quotes neither consistently. Paths with spaces break wiring silently.
- **HW-5 — Hand-rolled TOML.** `parseExistingToml`/`serializeToml` (:264–376) implement a TOML subset (bracket-depth scanning, inline-object regex). Roundtrip is guarded by `validate-grok-hook-toml-roundtrip.sh`, but unrecognized grammar (multiline strings, dotted keys) would be misclassified as text and preserved — acceptable degradation, worth documenting as a contract.
- **HW-6 — Inventory parity is enforced, but capability gaps remain.** `validate-cross-host-hook-conformance.sh` maps each host wirer against `references/canonical-gates.json` MUST/MAY. Residual asymmetries: `svc-phase-receipt-autoemit-*` (receipt production) and `svc-loop-guard`, `svc-learning-inject`, eval gates are Claude-wired only; Cursor/Grok hosts therefore under-produce verification receipts relative to the chain contract (feeds IP-R6).
- **HW-7 — Embedded migration accretion.** Claude wirer accumulates bespoke migration passes (WI-072 renames :627–642, canonical commands :643–649, WI-487 launcher adoption :671–680, argv-payload strip :685–696, async adoption :701–710) with no declarative pipeline or settings-shape version.

---

## 4. Receipt Emission Formats Audit

### 4.1 Format inventory (emitters → storage)

| Kind | Emitter (file:line) | Storage | schema_version | Validated on read? |
|---|---|---|---|---|
| Chain receipts ×9 types | skills via `emit-receipt.mjs` / heredoc pattern (`chain-receipt-contract.md:77–117`) | git notes `refs/notes/svc-receipts` (slot-keyed envelope) + mirror `.svc/receipts/<sha>/` + staging by tree-hash | int const 1 (v3 baton grandfathered) | YES — `check-chain-receipts.mjs` schema+blueprint |
| Install receipts | setup / `svc-migrate-install.mjs` | `<stateRoot>/install-state/<host>.json` | int (version-bound) | YES — identity-bound `validateInstallReceipt` (`enforcement-core.mjs:342–445`) |
| Denial receipts | `hook-denial.mjs:36–95` via `writeDenialReceipt` (`enforcement-core.mjs:446–488`) | `denial-receipts/<sessionHash>/<digest>.json` | minimum 1 | Digest/dedup only — body never re-validated |
| Authority lifecycle | `authority-store.mjs:285–290, 312–318, 338–343, 364–371` | `<git-common-dir>/svc-authority-v2/receipts/` | int const 1 | PARTIAL — hand-rolled field match on resume; schema unused at runtime |
| Delegation completion | `delegation-authority.mjs:212–219, 271–275` | `delegation-receipts/<id>.json` | int const 1 | YES — shape check |
| Gate receipts | `pipeline-log.mjs` | `.svc/pipeline-decisions.jsonl` | absent | NO — ad-hoc field greps |
| PR review receipts | review flow | `.svc/review-receipts/pr-<n>.json` (+ legacy path) | absent | PARTIAL — hand-rolled required fields (`validate-review-receipt.mjs`) |
| Story receipts | skills | `docs/specs/receipts/<WI>.receipts.json` | absent (template-driven) | YES — registry-parameterized auditor, exit-2 hard |
| Quick-fix staging | `quick-fix-eligibility.mjs:305–324` | `.svc/receipts/staging/<treeHash>/quick-fix.json` | int const 1 | PARTIAL — tree-hash cross-check in reconcile only |
| External-review cache | `run-external-review.mjs` | cache dir | int enum [2] | YES — write AND cache-hit |
| Migration receipts | `authority-store.mjs:424–520` | migration root | int const 1 | YES — digest-checked, reversible |
| Runtime projections | `svc-host-runtime-adapter-v2.mjs:81` | mirror | **string** `runtime-projection-v2` | ad-hoc |

### 4.2 Findings

- **RC-1 — Emitter/schema mismatch (silent).** `authority-store.mjs:338` emits `kind:"explicit_takeover"`; the authority-handover schema enum allows only `["handover","recovery"]`. Undetected because nothing loads that schema at runtime.
- **RC-2 — Consumer already broken.** `mine-receipts.mjs:98–137` reads legacy type-keyed envelopes; post-WI-550 notes use `slot::<type>::<wi>::<sha>[::<phase>]` keys (`emit-receipt.mjs:48/:85/:117`). Zero occurrences of `slot` in mine-receipts ⇒ new-format receipts are invisible to stats/tier/learning modes, silently.
- **RC-3 — Four `schema_version` conventions** (int const; int enum `[2]`; `minimum:1`; string consts like `runtime-projection-v2`; absent entirely for pipeline-decisions, PR review, embedded `skill_receipt`).
- **RC-4 — Draft mix.** draft-07 (`schemas/receipts/*`, hook-denial, install-state) vs 2020-12 (authority-handover, delegation-completion).
- **RC-5 — Timestamp chaos.** `ts` / `timestamp` / `completed_at` / `installed_at` / `decided_at` / `first_seen_at` / `loaded_at`; `format:date-time` enforced only in some schemas.
- **RC-6 — Vocabulary drift in gate receipts.** Writer emits `type` ∈ {mechanical…gate-result} + `decided_by` + `timestamp`; reference schema declares `kind` ∈ {mechanical,taste,user} + `ts`. Tolerated only via `additionalProperties:true`.
- **RC-7 — Contract duplication.** install-state specified three times (JSON Schema, `INSTALL_RECEIPT_REQUIRED/TYPES` constants, local validators in `svc-migrate-install.mjs:505/:749`); delegation completion twice (schema vs `validateCompletionReceiptShape`).
- **RC-8 — Non-atomic emitter.** `quick-fix-eligibility.mjs:322` uses bare `writeFileSync` — the only receipt writer without an atomic primitive.
- **RC-9 — Soft-fail hole.** `check-chain-receipts.mjs:764–765`: missing schema file ⇒ `loadSchema` null ⇒ receipt validates. A renamed/deleted schema silently disables a receipt gate.
- **RC-10 — Strictness split.** `additionalProperties:false` (authority, delegation-completion, external-review) vs `true` (hook-denial, install-state, pipeline-decisions).

---

## 5. Multi-Agent Worktree Handoff Contracts — Assessment

### 5.1 Lifecycle map (enforcer per step)

```
claim ─────────────► execute ───────────► merge-back ─────► land/verify
wi-claim v1          delegation           delegated:         worktree.sh guard
 claimWI :897        issueDelegation      full recompute     cmd_promote :538
 Git-CAS locks       :166–201             validate-execution- merge-pr w/ receipt
 :267,:326–413       inner worktrees      merge-back :16–69  cmd_remove :658
 session bindings    dispatch-exec-task   locked sequential  tier-1 safety eval
 :1123–1179          Landlock probe       cherry-pick :51–69 :23–96
lease v2             svc-contained-exec   parallel waves:
 bootstrap/resume    dispatch-worker.sh   TRUSTS worker JSON
 handover/takeover/  preflight :27–76     validate-parallel-
 recovery :225–373   token consume :75    merge-back :41–101
 generations+frozen                       orchestrator-state
 delegations :253–263                     checkpoint :102–157
```

Strengths: repository-shared CAS refs, generation counters freezing stale delegations, one-time handover tokens with hash CAS, digest-checked v1→v2 migration with reversible rollback, per-target allowed/denied glob authorization, OS-level Landlock containment, sequential merge under integration lock with expected-head CAS.

### 5.2 Weaknesses

- **HD-1 — Parallel wave merge-back trusts self-reported evidence.** `validate-parallel-merge-back.mjs:41–101` accepts worker-authored `clean_worktree` (:78), scope (:79–82), and `"PASS"` string literals (:84); `dispatch-worker.sh` manufactures `validation_evidence` as `{command:"dispatch-worker exit"…}` (:207–209) and hardcodes `parent_graph_mutation.updated=true` (:211). Contrast: delegated path recomputes diff/files/digests/commits from git.
- **HD-2 — `worktree.sh promote` reports failure as success.** `git push … || true` then unconditional "Branch pushed" (:583–584); same for PR creation (:606–615). Review-handoff proceeds on prose, not exit status.
- **HD-3 — No cross-process lock on promote/remove/cleanup.** CAS locking covers create/resume only; concurrent promotes race past clean-tree checks (:565–568); `cleanup` does bare `rm -rf` on unregistered dirs (:887–898).
- **HD-4 — Half-consumed handover strands the successor.** `acceptHandover` writes lease then consumed-record independently (:309–310); crash between them leaves a `prepared` token that retry cannot consume (generation CAS fails :301–303); recovery demands operator reason/evidence (:327–328, :356). No forward-completion routine analogous to `finalizeTransferredClaim` (wi-claim :1053).
- **HD-5 — mtime-based lock reclaim can steal live locks.** `state-io.mjs isStaleLock :42–52` reclaims after 10 min; a >10-min validation inside the merge critical section lets a second merger enter. Delegation/lease locks correctly require process-death proof instead.
- **HD-6 — `freezeDelegations` lost-update race.** Freeze writes `status:"frozen"` without the per-delegation lock (:253–263); a child update can overwrite it. Merge-back still rejects old-generation results, so this is ledger corruption, not an authority hole.
- **HD-7 — TTL-stale reclaim of a live silent owner.** Claims without `SVC_OWNER_PID` rely on renewal TTL (wi-claim :176–188, default 24h); a long silent mutation can be reclaimed, yielding two owners.
- **HD-8 — Silent state resets.** `orchestrator-state loadState` swallows parse errors → fresh defaults (:26–33), destroying active-WI resume; `worktree.sh freeze` writes `.worktree-freeze` nothing enforces (:1041); AP-30 repoint proceeds despite failed healing (:789–800) and is bypassable via `SVC_WORKTREE_SKIP_AP30_CHECK=1`.
- **HD-9 — Lane-tasks bypass windows.** Never-committed graphs make transition checks vacuous (`priorJson` null, validator :85–93); PostToolUse fires after the write; Bash-path writes never traverse Edit/Write hooks at all.
- **HD-10 — Preflight contradiction.** Read-only `create` requires a clean checkout (:161–166) while the canonical mutating path explicitly forbids requiring one (`svc-ensure-worktree.mjs:87–90`).

---

## 6. The Improvement Protocol

Each item: **Requirement → Enforcement → Verification**. Items are ordered by risk-adjusted priority within two tracks. H = handoff contracts, R = verification receipts, W = wiring substrate (prerequisite hygiene).

### Track H — Multi-Agent Worktree Handoff Contracts

**IP-H1 · Ground-truth merge-back for parallel waves (P0)**
- *Requirement:* No merge-back may accept worker-authored status strings. Wave workers must commit before reporting; parents recompute changed files, diff digest, and validation exit codes from git exactly as `validate-execution-merge-back.mjs` does.
- *Enforcement:* Extend the recompute core into a shared lib consumed by both validators; delete the accepted-string list in `validate-parallel-merge-back.mjs:84`.
- *Verification:* Tier-1 scenario where a worker reports PASS with a dirty tree must exit nonzero.

**IP-H2 · Exit-status honesty in promote/remove (P0)**
- *Requirement:* Push/PR failures abort promote with nonzero exit before any state advances; AP-30 healing failure blocks removal unless an explicit waiver flag is passed.
- *Enforcement:* Remove `|| true` at `worktree.sh:583/:606`; propagate exit codes; gate removal on healing success.
- *Verification:* Tier-1 test with a refused push asserts promote exits nonzero and no PR artifact exists.

**IP-H3 · Concurrency-safe promote/remove/cleanup (P0)**
- *Requirement:* All mutating worktree.sh verbs take the same repo-shared Git-CAS lock family used by ensure-worktree/wi-claim. Cleanup must quarantine (move to `.worktrees/.quarantine/<ts>/`) instead of `rm -rf`.
- *Enforcement:* Reuse `withExclusiveLock` semantics keyed on branch sha; quarantine + grace period in cleanup.
- *Verification:* Tier-2 double-promote race scenario; cleanup preserves quarantined bytes.

**IP-H4 · Forward-completion for half-consumed handovers (P1)**
- *Requirement:* An idempotent `finalizeHandover(token_hash)` that completes a lease-transferred/token-prepared state without operator-supplied evidence, mirroring `finalizeTransferredClaim`.
- *Enforcement:* New operation in `authority-store.mjs` next to `acceptHandover`; SessionStart healthcheck invokes it when a prepared token matches the current lease generation.
- *Verification:* Failpoint test (crash between the two writes at :309–310) then resume succeeds without takeover.

**IP-H5 · Process-death-proof lock expiry everywhere (P1)**
- *Requirement:* Replace mtime-based `isStaleLock` with pid+starttime liveness proof (as delegation/lease locks do). Claims without pid must carry a mandatory renewal heartbeat or refuse to persist.
- *Verification:* Long (>TTL) critical-section test does not lose the lock; silent-owner claim survives past 24 h while its process lives.

**IP-H6 · Machine-checkable handoff record (P1)**
- *Requirement:* One `handoff-record.schema.json` binding `{schema_version, wi, lease_id, generation, principal, worktree_realpath, base_sha, token_hash, allowed_paths, ttl, evidence_digests}` emitted at every authority transition; resume validation consumes records, not prose summaries.
- *Enforcement:* Emit from `authority-store` lifecycle ops; validate on SessionStart resume; add to read-side matrix (IP-R8).
- *Verification:* Tier-1 schema-conformance test over recorded transitions; negative test for mismatched generation.

**IP-H7 · Enforce-or-delete `freeze` and fix silent resets (P2)**
- *Requirement:* `.worktree-freeze` is either enforced by isolation guards or removed; `orchestrator-state` parse failure quarantines the file and warns instead of resetting; lane-tasks Bash writes route through the same validator (pre-commit check covers graph files).
- *Verification:* Guard blocks mutation under freeze; corrupted-state resume test warns and preserves prior checkpoint.

### Track R — Automated Verification Receipts

**IP-R1 · Receipt Format Charter (P0)**
- *Requirement:* One convention set: integer monotonic `schema_version`; timestamp field `ts` with `format:date-time`; snake_case; UUID or content-digest ids; JSON Schema 2020-12; `additionalProperties:false` default. New formats require a schema file before their emitter merges.
- *Enforcement:* Meta-schema lint script over `schemas/**` + emitters (part of tier-1); grandfather existing outliers with a dated exception list.
- *Verification:* Lint passes on repo; deliberately nonconforming fixture fails.

**IP-R2 · Fail-closed schema loading (P0)**
- *Requirement:* Missing/unreadable schema ⇒ validation failure, never pass. Fix `check-chain-receipts.mjs:764–765`.
- *Verification:* Rename-a-schema drill exits nonzero.

**IP-R3 · Repair mine-receipts for slot-keyed envelopes (P0)**
- *Requirement:* Parse `slot::<type>::<wi>::<sha>[::<phase>]` keys with legacy fallback.
- *Verification:* Tier-1 eval emits a fresh-format note and asserts mine-receipts reports nonzero stats.

**IP-R4 · Single emitter, atomic writes only (P0)**
- *Requirement:* `emit-receipt.mjs` is the sole sanctioned write path for receipt JSON; direct `writeFileSync` of receipt payloads is banned. Convert `quick-fix-eligibility.mjs:322` to the atomic primitive.
- *Enforcement:* Tier-1 grep gate over scripts/hooks for receipt-shaped `writeFileSync` calls.
- *Verification:* Gate catches a seeded violation; quick-fix staging crash-test leaves no partial file.

**IP-R5 · Schemas as single source; kill contract duplication (P1)**
- *Requirement:* Runtime constants/validators are generated from (or conformance-tested against) the schema files: install-state (currently 3 specs), delegation completion (2 specs). Add `explicit_takeover` to the authority enum and load the schema in resume paths.
- *Verification:* Conformance test asserting code enums == schema enums; deliberate drift fails CI.

**IP-R6 · Cross-host receipt-production parity (P1)**
- *Requirement:* Verification-receipt emission is a first-class gate in `canonical-gates.json` (MUST/MAY per host). Hook-capable hosts lacking Edit/Write PostToolUse events must emit phase receipts via Stop/SessionEnd equivalents or be explicitly classified `receipts: skills-only`.
- *Enforcement:* Extend `validate-cross-host-hook-conformance.sh` with a receipts section.
- *Verification:* Each host manifest declares receipt capability truthfully; parity check passes.

**IP-R7 · Validate-on-read closure (P1)**
- *Requirement:* Every receipt kind maps to exactly one documented validator; blind-trust consumers eliminated. Pipeline-decisions gets a real schema and the writer adopts canonical fields (`ts`, `kind`); PR-review receipts gain `schema_version`.
- *Verification:* Read-side matrix table (as in §4.1) regenerated by a tier-1 script showing zero "NO/PARTIAL" cells.

**IP-R8 · Stage-registry completion & manifest integrity (P1)** *(bridge item)*
- *Requirement:* Segments become a derived view in `stage-registry.json` consumed by `stage-segment.mjs`; single-source validator covers it; `skills-manifest.json` gains `schema_version` + content hash; linter validates `reviewGates` (after-skills ∈ pipeline, unique numbering) and resolves FP-024's G6 dual meaning; template-drift check escalates to exit 2.
- *Verification:* Extended single-source validator + manifest lint pass; seeded segment drift fails.

**IP-R9 · Receipt integrity binding (P2)**
- *Requirement:* Notes envelope carries a content digest chain (per-receipt sha256 in envelope key or body); mirror regeneration verifies against notes before serving; gc stays content-agnostic but refuses to GC unverifiable mirrors.
- *Verification:* Tampered mirror byte fails regeneration check.

### Track W — Wiring Substrate (prerequisite hygiene)

**IP-W1 · Uniform write policy (P0):** every wirer uses tmp+rename + pre-mutation backup + defined corrupt-config behavior (abort nonzero, never silent reset). Fixes HW-1/HW-2.
*Verification:* Seeded mid-write crash leaves prior config intact on all three hosts.

**IP-W2 · Shared ownership predicate (P1):** one exported `isSvcOwnedCommand(cmd)` lib replaces per-host substring/regex heuristics (wire-hooks :775–786, cursor :143–148, grok :382–389).
*Verification:* Parity eval feeding identical command fixtures to all three classifiers expects identical verdicts.

**IP-W3 · Declarative hook catalog (P1):** single per-host capability catalog generating wirer entries and `isAlreadyWired` identities from IDs, ending the ~35-case string-match table (:462–501) and inventory drift between wirers (HW-3, HW-7).
*Verification:* Generated output of each wirer byte-stable vs checked-in expectations; adding a hook requires catalog-only change.

**IP-W4 · Path quoting (P2):** quote interpolated script/hook paths in cursor/grok commands (HW-4).
*Verification:* Wiring succeeds with a space-bearing install prefix in a sandboxed HOME.

---

## 7. Sequencing

| Wave | Items | Rationale |
|---|---|---|
| 1 | IP-H1, IP-H2, IP-R2, IP-R3, IP-R4, IP-W1 | Correctness/data-loss bugs; small diffs, immediate risk reduction. |
| 2 | IP-H3, IP-H4, IP-R1, IP-R5, IP-W2 | Contract consolidation before new format work. |
| 3 | IP-H5, IP-H6, IP-R6, IP-R7, IP-R8, IP-W3 | Structural convergence; needs changeset planning. |
| 4 | IP-H7, IP-R9, IP-W4 | Hygiene tail. |

Per AGENTS.md: items touching skills/manifest/routing land via plan-changeset in a worktree; each wave closes with the touched tier-1 validators plus `node scripts/lint-skills-manifest.mjs`.

---

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every finding cites file:line evidence | Spot-read wirers, contract doc, validator heads during audit | PASS |
| 2 | Named scripts audited directly (not just subagent summary) | Full reads: wire-hooks.mjs (928 ln), wire-cursor-hooks.mjs (219), wire-grok-hooks.mjs (539) | PASS |
| 3 | Protocol items are enforceable + verifiable | Each IP has Enforcement/Verification; map to existing tier-1 harness | PASS |
| 4 | Report placed outside hook-protected paths | `docs/specs/audits/` not in SKILL_OUTPUT_PATHS (svc-skill-artifact-authenticity.mjs:65–89) | PASS |
