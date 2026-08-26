# SSVE Architecture Evolution Plan — WI-SSVE-ARCHITECTURE-EVOLUTION-02

- **Date:** 2026-08-24
- **Work Item:** WI-SSVE-ARCHITECTURE-EVOLUTION-02
- **Branch:** `feat/ssve-architecture-evolution-02`
- **Base SHA:** `784b764b9af91dbcbd4167f3c317508fa6084677`
- **Source audit:** `docs/specs/audits/2026-08-23-improvement-protocol-multi-agent-handoff-and-verification-receipts.md` (residual items SR-1/SR-3, SR-4, HW-7, HW-6/IP-R6)
- **Feasibility verdicts:** `docs/specs/audits/2026-08-24-ssve-evolution-feasibility-audit.md` (Task 1 — ADOPT×3 adapted, REJECT-and-SUPERSEDE ×1)
- **Foundation:** WI-562 landed IP-H1…H7, IP-R1…R5/R7(partial)/R9, IP-W1/W2/W3(partial). This plan finishes the residue at zero agent-velocity cost.
- **Machine contract:** `docs/plans/2026-08-24-ssve-architecture-evolution-plan/plan-contract.json`
- **Review gates:** triple independent plan review (Codex 5.6 Sol High / Cursor Auto / Grok High) at T03; triple exec review at T05; promotion delivery receipt at T06.

---

## 0. Scope & Non-Negotiable Constraints

1. **Zero agent-velocity regression.** No new blocking hooks, no new mandatory rituals beyond mechanically enforcing an already-mandated linter run, no hot-path runtime cost beyond module-init JSON parses (~ms). Every change must leave interactive agent loops as fast as before or faster.
2. **Backwards compatibility.** Pre-existing on-disk state stays readable; every CLI invocation signature is preserved (`stage-segment` CLI verbs, wirer flags, linter exit codes gain only additive failure modes with actionable messages).
3. **Fail-closed bias.** Soft-fail holes close loudly (template drift warn→exit 2; stamp mismatch→exit 1). Every new failure message carries the exact remediation command.
4. **Single vocabulary per concept.** Stages have one vocabulary (registry keys), the mandatory chain has one vocabulary (the registry's `mandatory_chain_segments` block), gates have one owner set (manifest `enforced_by`). No second spelling of anything survives this changeset.
5. **No validator sprawl.** New tier-1 checks ride existing validators where one exists (`validate-stage-registry-single-source.sh`, `validate-cross-host-hook-conformance.sh`, `lint-skills-manifest.mjs`). Only genuinely new failure classes get new files (three, each named below).
6. **Full-corpus discipline.** Surface-scoped validators per execution wave (FP-030 runner); the complete tier-1 corpus runs green immediately before promotion (T06), with any environmental failures reproduced on pristine `origin/main` and named, never waved through.

## 0.1 Rejected-by-design ledger (carried from feasibility audit — do not re-litigate in review without new evidence)

| Rejected | Why |
|---|---|
| Declarative migration-pipeline engine + settings-shape version stamps (HW-7 as written) | Institutionalizes accretion; superseded by catalog-cutover that deletes the migrations' reason to exist |
| Gate renumbering (shift G5→G9 etc.) | Churns dozens of artifacts for zero consumer benefit |
| Dual namespace (`pipeline_gates` vs `chain_gates`) | Two names for one concept is the disease |
| In-file `_integrity.digest` on the manifest | Hash-inside-hashed-doc; forces restamp ceremony on every edit |
| Registry JSON-Schema layer | Loader already validates; duplicate truth |
| New blocking hooks on Cursor/Grok | Velocity directive; autoemit is fail-open observational only |

---

## 1. Work Breakdown — four execution waves inside T04

### E1 — Stage Registry Single Source (SR-1 + SR-6 rider)

**Goal:** `scripts/stage-segment.mjs` contains zero inline chain vocabulary; the segments live as data in `references/stage-registry.json`; template drift fails hard.

**Changes:**
1. `references/stage-registry.json`: add top-level `mandatory_chain_segments` block. Shape (segment-level `emits` preserved verbatim from today's constants; `steps[]` pairs each chain skill with its story-stage key or `null`):
   ```json
   [
     { "id": "seg-1-plan",
       "steps": [ { "skill": "plan-changeset", "stage_key": "plan" },
                  { "skill": "review-plan",     "stage_key": "review-plan" } ],
       "checkpoint_after_skill": "plan-changeset",
       "emits": ["plan-manifest", "review-plan"] },
     { "id": "seg-2-exec",
       "steps": [ { "skill": "execute-changeset",     "stage_key": "implement" },
                  { "skill": "review-exec",           "stage_key": "review-exec" },
                  { "skill": "audit-implementation",  "stage_key": null } ],
       "checkpoint_after_skill": "execute-changeset",
       "emits": ["exec-record", "review-exec", "audit-implementation"] },
     { "id": "seg-3-land",
       "steps": [ { "skill": "land-changeset",   "stage_key": null },
                  { "skill": "verify-promotion", "stage_key": "live-proof" } ],
       "checkpoint_after_skill": "land-changeset",
       "emits": [] }
   ]
   ```
2. `scripts/stage-segment.mjs`: derive exported `SEGMENTS` at module load via `loadStageRegistry()` with the registry path resolved relative to the module URL (pattern: `hooks/lib/hook-catalog.mjs:15`). Exported shape is BYTE-COMPATIBLE with today (`{id, stages, checkpoint_after, emits}` where `stages` remains the skill-name list consumers expect); only the SOURCE changes. Pure functions (`nextStageAction`, `verifyStageReceipt`) untouched. CLI verbs untouched.
3. `test-framework/evals/tier-1/validate-stage-registry-single-source.sh`: append `scripts/stage-segment.mjs` to the consumer-import assertion; add segments-block validation — ids unique; every `steps[].skill` ∈ manifest `includedSkills` ∪ keys of `mandatoryChainOutOfLane`; non-null `stage_key` resolves against `stages[]`; `checkpoint_after_skill` set == `{plan-changeset, execute-changeset, land-changeset}`; every `emits[]` member ∈ chain receipt **types** (the `receipt_type` / schema basename set in `references/chain-receipt-contract.md` Receipt Types table and `schemas/receipts/{plan-manifest,review-plan,exec-record,review-exec,audit-implementation}.schema.json`). Do **not** validate against `references/receipt-kind-registry.json` `kinds` (those are envelope families such as `chain-receipts`, not slot types). Negative fixtures: unknown skill, unknown stage key, unknown chain receipt type each rejected.
4. SR-6: `scripts/audit-story-receipts.mjs:68–83` template-staleness sentinel escalates warn → exit 2. Update any eval asserting the warn-only behavior (enumerate via grep `receipts-TEMPLATE` under `test-framework/` during execution).

**Verification:** extended single-source validator; `validate-stage-isolation.sh` unchanged and green (proves byte-compat); seeded segment-drift fixtures fail.

### E2 — Manifest Integrity & Gate Ownership (SR-4 + SR-5 tail + FP-024 resolution)

**Goal:** the manifest carries version + verifiable integrity; duplicates and ordering defects fail at lint time; every gate id has exactly one owning skill-set; prose matches.

**Changes:**
1. `skills-manifest.json`: add `"schema_version": 1`; do **not** drop the second `track-visuals` slot in `pipeline` / `greenfield` / `brownfield-feature`. Those two positions are the documented sidecar (`skills/track-visuals/SKILL.md`: baseline after design-ui/landing-page, diff after execute-changeset). Represent them with an explicit role marker (e.g. allowlisted dual-run annotation or distinct role ids that still route to skill `track-visuals`). Duplicate detection fails only on unannotated accidental repeats, never on this allowlisted pair. Extend each `reviewGates.G*` entry with `"enforced_by"`: G1 `[write-spec]`, G2 `[design-ux]`, G3 `[design-ui]`, G4 `[design-tech]`, G5 `[review-exec, audit-implementation]`, G6 `[land-changeset]`, G7 `[verify-promotion]`.
2. `scripts/lint-skills-manifest.mjs` (hot-path validator — ceremony already engaged via this changeset):
   - Duplicate detection as above (allowlist the `track-visuals` dual-run; do not uniqueness-check every ordered array blindly).
   - Ordering assertions **only** where the array's role demands them: `pipeline` keeps plan→review-plan→execute (already asserted by `validate-review-gate-routing-arrays.sh`). Do **not** require `review-plan` / `review-exec` inside `laneDefinitions.*.skills` — those skills are out-of-lane by design (`mandatoryChainOutOfLane`).
   - `reviewGates` validation: unique G-ids, contiguous numbering, `after` ∈ `pipeline` ∪ keys of `mandatoryChainOutOfLane`, `enforced_by` ⊆ `includedSkills`.
   - Digest integrity: `--stamp` writes `.svc/manifest-digest.json` `{algorithm:"sha256", digest, stamped_at}`; default mode verifies stamp-vs-current-bytes. **Missing stamp is bootstrap-only when `schema_version` is absent (warn + remediation, exit 0).** Once `schema_version` is present (this changeset adds `1`), **missing stamp and mismatched bytes both exit 1**, naming both digests and `node scripts/lint-skills-manifest.mjs --stamp`. First E2 commit adds `schema_version` and the sidecar together. **Amendment (exec R5 F-006, tracked-sidecar model):** the sidecar is COMMITTED, not gitignored — a fresh clone always carries a baseline, deletion is a git-restorable mutation rather than a silent reset, and rotation requires `--stamp` + re-add in the same commit as the manifest change.
3. Commit the stamped `.svc/manifest-digest.json` so PRs show manifest+digest mutations together.
4. Mechanical enforcement of the existing manual mandate: new pre-commit slot `hooks/git/pre-commit.d/21-manifest-integrity` (not `20-`, which is the required `20-quick-fix-eligibility` slot) running `node scripts/lint-skills-manifest.mjs` (sub-second; skips cleanly when manifest untouched — diff-filter on staged paths). Do not add this slot to `REQUIRED_SLOTS` unless `scripts/install-git-hooks.mjs` is updated in the same wave.
5. FP-024 prose sweep (single-vocabulary relabel): `skills/review-exec/SKILL.md:87` "It is the G6 gate in the chain" → "It enforces the **G5** checkpoint (BASELINED → CHANGE-SET-APPROVED) via adversarial post-exec review."; `:343` and frontmatter `description` "Mandatory G6 gate"; `skills/execute-changeset/SKILL.md` "`review-exec` (G6)"; `README.md` "Mandatory G6 gate"; AGENTS.md mandatory-chain bullet "new G6 gate" → "G5-enforcing gate". Sweep from repo root: `rg -n "G[56]" skills/*/SKILL.md AGENTS.md README.md CLAUDE.md` then targeted edits; no mass renumbering. E2 ownership includes every path the gate-ownership validator will see.
6. New validators:
   - `validate-manifest-integrity-stamp.sh`: stamp present+matching passes; seeded byte-flip fails exit 1; missing stamp with no `schema_version` warns-not-fails; missing stamp with `schema_version` present fails exit 1.
   - `validate-gate-ownership-matrix.sh`: for each gate g with `enforced_by` E, scan `skills/*/SKILL.md` for skill-owned self-labels (`It is the G<n> gate`, `Mandatory G<n> gate`, chain bullets) and FAIL when the claiming skill ∉ E[g]. Do **not** use `\bat G<n> \(` (false-positive on `skills/review-gate/SKILL.md` protocol prose). Narrow patterns only — no generic "G5" mention policing.

**Verification:** linter green twice (stamp→no-op verify); seeded duplicate fixture fails; seeded gate-claim violation fails; `validate-review-gate-routing-arrays.sh` still green.

### E3 — Claude Wirer Catalog Cutover (HW-7 superseded — net code DELETION)

**Goal:** one architectural posture across all three wirers; the migration-pass accretion and the `isAlreadyWired` string-match table cease to exist.

**Do not call `generateHostEntries("claude", …)` a drop-in for `buildHookEntries`.** Live `generateHostEntries` returns `{id, command}` only (`hooks/lib/hook-catalog.mjs:54–70`): no `matcher`, no `async`, no `hooks:[{type,command}]` envelope. The catalog has no matcher field, points `svc-bash-guard` at missing `hooks/svc-bash-guard.mjs` (Claude wires `svc-workflow-guard.mjs --bash-guard`), and has one autoemit id vs `svc-phase-receipt-autoemit-edit` / `-bash`. Using it as written would fire every PreToolUse hook on every tool and drop `SVC_HOOK_PROFILE=minimal`.

**Primary path (B — merge cutover, keep Claude emitter):**
1. `scripts/wire-hooks.mjs`: replace the additive-merge phase (`isAlreadyWired` skip + append) with subtractive rebuild. Canonical entries still come from **`buildHookEntries(skillsPath)`** (same matchers, async flags, PROFILE skip set, existsSync company-hook gates, two autoemit ids, bash-guard command string).
   - Classify every existing settings entry with the shared ownership predicate (`hooks/lib/svc-ownership.mjs`, WI-562).
   - Drop ALL svc-owned entries; append `buildHookEntries` output, honoring `DISABLED` (disabled ids neither dropped-then-readded nor resurrected — they are simply absent) and `SVC_HOOK_PROFILE=minimal` (same skip set as today: workflow-guard, phase-boundary, edit-accumulator, vibe-auditor, wi-pillars, stop-quality, verification-delegation-guard).
   - Foreign commands preserved byte-verbatim, including entry grouping/matchers.
   - Delete: `isAlreadyWired` (:463–502), migration passes (:635–730), exact-dedup + variant-dedup safety nets (:748–836), and the now-dead `loadRenamedFiles`/`CANONICAL_COMMANDS` scaffolding. `hooks/.renames.json` itself stays (reader census at T06).
   - Rebuild order (load-bearing):
     1. `--remove-company-session-hooks` remains prune + write + `process.exit(0)` **before** rebuild (no re-append of catalog/company SessionStart hooks).
     2. PROFILE=minimal skip set applied to the canonical set **before** append.
     3. existsSync gates for `cos-briefing.mjs` / `svc-delta-preload.mjs` stay in `buildHookEntries`.
     4. kimi strip stays `isSvcOwnedCommand && /hooks\/kimi\//` OR a named parity fixture proves the predicate alone matches every current strip hit.
   - Preserve: arg parsing, `--list-all` structural replay output shape (still `buildHookEntries`), backup-once + atomic write.
2. Contract documentation (one paragraph in the wirer header): re-wire normalizes user-modified svc-owned commands back to canonical; recovery = timestamped backup printed on every mutating run.
3. Acceptance: `node scripts/wire-hooks.mjs --list-all` is byte-equal (aside from dropped migration-only fields) to current `buildHookEntries` on origin/main, including the bash-guard command string `svc-workflow-guard.mjs --bash-guard`.
4. Validators:
   - CREATE `validate-claude-wirer-cutover.sh`: sandboxed HOME fixtures — (a) double-run byte-stability; (b) foreign-entry preservation; (c) `DISABLED` honored; (d) `SVC_HOOK_PROFILE=minimal` omits the same ids as today; (e) `--remove-company-session-hooks` does not resurrect pruned hooks; (f) corrupt-config abort nonzero with intact prior bytes; (g) seeded legacy-variant install (renamed-file ref, argv-token relic, sync observational hook) converges to canonical in ONE run with ZERO migration-specific code paths (assert via `--list-all` + final-settings snapshot, and grep that `wire-hooks.mjs` contains no `isAlreadyWired` / `$TOOL_INPUT` strip remnants).
   - Retire/repurpose `validate-wire-hooks-variant-dedup.sh` (replace body with the convergence assertion; keep the slot).
   - Enumerate and update every validator referencing removed internals: `grep -rln "isAlreadyWired\|argv-payload\|RENAMED_FILES\|CANONICAL_COMMANDS" test-framework/ hooks/ scripts/` at execution start; each hit dispositioned in the exec record.

**Catalog-faithful Claude generation (path A) is a registered followup**, not this wave: it requires catalog fields for matcher/async/profile, a real bash-guard command template, and split autoemit ids — plus a `--list-all` byte-equality gate against `buildHookEntries`. Do not land path A in E3.

**Fallback (emergency-only supersession of §0.1, not a stable end state):** if T05 surfaces irreducible regression risk, land the bounded consolidation (five passes → one table + interpreter in `hooks/.migrations.json`) and register a T06 followup WI to delete that interpreter within one cycle. Decision recorded in the exec triple-review log either way.

### E4 — Cross-Host Phase Auto-Receipt Parity (HW-6 / IP-R6, capability-tiered)

**Goal:** every hook-capable host produces phase receipts up to its REAL event surface; declared capability == wired reality, mechanically checked.

**Cursor and Grok wirers do not generate from the catalog today.** `generateHostEntries` is not called from `scripts/wire-cursor-hooks.mjs` or `scripts/wire-grok-hooks.mjs` (`buildCursorHookEntries` / `buildGrokHookEntries` are hardcoded; `validate-catalog-generation.sh:16` still says full wirer cutover is WI-563). Adding a catalog row alone will not wire autoemit.

**Changes:**
1. Payload compatibility gate FIRST (decision point D-1, before any wiring). Smoke-test **real** Cursor `afterFileEdit` and Grok `PostToolUse` stdin by piping fixtures through `readHookPayload()` **and** autoemit `main()` (or a testable export) — not `extractFilePath` in isolation. Autoemit currently requires `toolName`+`toolInput` and `tool ∈ {Edit,Write,Bash}` (`hooks/svc-phase-receipt-autoemit.mjs:77–86`, `hooks/lib/hook-payload.mjs:93`). Independent per-host outcomes:
   - Cursor compatible → capability `auto-edits-only` and wire autoemit on `afterFileEdit`. Autoemit must never exit 2 (Cursor hard-block).
   - Cursor incompatible → Cursor stays `skills-only`; do not advertise `auto-edits-only`.
   - Grok compatible → capability `auto-full` and wire autoemit on `PostToolUse`.
   - Grok incompatible → Grok stays `skills-only`.
   - Both incompatible → both `skills-only`.
   No adapter hacks that fabricate file-path evidence. Named command recorded on contract D-1.
2. `references/host-hook-catalog.json`: graduate `receipts` from `full`/`skills-only`/`none` to tiers `auto-full` / `auto-edits-only` / `skills-only`. Keep `full` as an accepted synonym of `auto-full` in `validate-catalog-generation.sh:40` (update that enum in the same commit). Values for grok/cursor are written **after** D-1, never assumed.
3. `scripts/wire-grok-hooks.mjs` / `scripts/wire-cursor-hooks.mjs`: add the autoemit command in `buildGrokHookEntries` / `buildCursorHookEntries` the same way other hooks are added today (hardcoded builders). Also register matching catalog `hosts`/`events` so `validate-cross-host-hook-conformance.sh` can check inventory. Do not pretend this is "one event-map row on an already-catalog wirer." Switching those builders to `generateHostEntries` is a larger cutover and is out of scope unless it preserves current quoting/commands byte-for-byte.
4. `hooks/svc-phase-receipt-autoemit.mjs` / `hooks/lib/hook-payload.mjs`: if D-1 shows Cursor/Grok payloads lack Claude `tool_name`/`tool_input`, add an **additive** normalizer upstream of the Edit/Write/Bash gate (never narrowing Claude). If that cannot extract a real path, keep the host `skills-only`.
5. `validate-cross-host-hook-conformance.sh`: new receipts section — capability ≠ `skills-only` ⇒ host wirer text must enumerate the autoemit id; capability == `auto-edits-only` ⇒ MUST NOT claim shell-path coverage; `skills-only` hosts MUST NOT enumerate it. Snapshot expectations updated in the SAME commit.

**Velocity proof obligation:** autoemit is fail-open and observational. Cursor `afterFileEdit` has no matchers (`provision/hosts/cursor.json:45`) and already runs five svc commands; adding autoemit is one extra node spawn per edit. Record a timed D-1 measurement on a no-graph workspace; if p95 is not in the existing Claude PostToolUse class, keep Cursor `skills-only`. Cited in exec record.

**Amendment (retro-plan R2 F-002 adjudication):** the binding velocity constraint for E4 is the MEASURED-CLASS rule above — a new autoemit spawn is sanctioned when its recorded no-graph p95 sits in the existing Claude PostToolUse class (D-1 gate JSON), because Claude PostToolUse already carries one Node spawn per tool event. A categorical zero-new-spawns reading would outlaw the existing Claude wiring and is not the contract. Fail-open behavior (never exit 2) remains mandatory on every host.

---

## 2. Task Graph & Ownership

```
T01 (feasibility audit) ──► T02 (this plan) ──► T03 (triple PLAN review)
                                                      │
        ┌─────────────────────────────────────────────┘
        ▼
T04 implementation waves:  E1 ──► E2 ──► E3 ──► E4   (sequential; ownership disjoint — E3∩E4=∅ files)
                                                      │
                                     T05 (triple EXEC review) ──► T06 (delivery receipt + land)
```

Sequential waves chosen over parallel dispatch: E3 is a hot-path refactor whose validator fallout surfaces best on a clean tree; E1/E2 are prerequisites for the gate/segments fixtures E3/E4 snapshots build on. Wave-parallelism remains available to a future dispatcher since file ownership below is disjoint across E-waves.

| Wave | Files (authoritative; supersedes lane-task literal strings) |
|---|---|
| E1 | `references/stage-registry.json`, `scripts/stage-segment.mjs`, `scripts/lib/stage-registry.mjs` (only if loader gains segments validation helper), `scripts/audit-story-receipts.mjs`, `test-framework/evals/tier-1/validate-stage-registry-single-source.sh`, template-behavior evals enumerated at exec time |
| E2 | `skills-manifest.json`, `.svc/manifest-digest.json` (created), `scripts/lint-skills-manifest.mjs`, `skills/review-exec/SKILL.md`, `skills/review-plan/SKILL.md`, `skills/execute-changeset/SKILL.md`, `skills/review-gate/SKILL.md` (validator must not false-positive), `AGENTS.md`, `README.md`, `CLAUDE.md` if sweep hits, `hooks/git/pre-commit.d/21-manifest-integrity` (created), `test-framework/evals/tier-1/validate-manifest-integrity-stamp.sh` (created), `test-framework/evals/tier-1/validate-gate-ownership-matrix.sh` (created) |
| E3 | `scripts/wire-hooks.mjs`, `test-framework/evals/tier-1/validate-claude-wirer-cutover.sh` (created), `test-framework/evals/tier-1/validate-wire-hooks-variant-dedup.sh` (repurposed), validator fixtures enumerated via the E3.3 grep |
| E4 | `references/host-hook-catalog.json`, `scripts/wire-grok-hooks.mjs`, `scripts/wire-cursor-hooks.mjs`, `hooks/svc-phase-receipt-autoemit.mjs` (conditional, D-1), `hooks/lib/hook-payload.mjs` (conditional, additive), `test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh`, `test-framework/evals/tier-1/validate-catalog-generation.sh` (snapshots) |
| Docs/state | `FRAMEWORK-STATE.md`, `.svc/lane-tasks-WI-SSVE-ARCHITECTURE-EVOLUTION-02.json`, review artifacts under `docs/specs/reviews/`, this plan directory |

## 3. Validation Commands (declared for the contract)

```bash
node scripts/lint-skills-manifest.mjs                       # after every manifest touch
node scripts/lint-skills-manifest.mjs --stamp               # restamp (same command, explicit mode)
bash test-framework/evals/tier-1/validate-stage-registry-single-source.sh
bash test-framework/evals/tier-1/validate-stage-isolation.sh
bash test-framework/evals/tier-1/validate-review-gate-routing-arrays.sh
bash test-framework/evals/tier-1/validate-manifest-integrity-stamp.sh
bash test-framework/evals/tier-1/validate-gate-ownership-matrix.sh
bash test-framework/evals/tier-1/validate-claude-wirer-cutover.sh
bash test-framework/evals/tier-1/validate-catalog-generation.sh
bash test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh
bash test-framework/evals/run-all-evals.sh                  # FULL corpus — mandatory at CP-PRELAND (T06)
```

Per-wave: surface-scoped subset above (FP-030 selector). Full corpus once before promotion; environmental failures must reproduce on pristine `origin/main` and be named individually in the delivery receipt (WI-562 precedent: 348/350 with two named environment-dependent failures).

## 4. Review-Gate Mapping

| Gate | Artifact | Reviewers (owner policy) |
|---|---|---|
| T03 plan review | this plan + contract + manifest | Codex 5.6 Sol High, Cursor Auto, Grok High — independent, findings dispositioned in round logs; promotion blocked until zero unresolved CRITICAL/HIGH |
| G5 (in-chain) | executed diff vs manifest file set | review-exec + audit-implementation (per new `enforced_by`) |
| T05 exec review | worktree diff | same triple panel |
| T06 promotion | delivery receipt | receipt-signed land per `rules/build-and-ship-alignment.md` analogues (source SHA, tier-1 evidence, reviewer dispositions bound) |

## 5. Followups Registered (out of scope here — kept visible)

| Item | Registered location |
|---|---|
| Read-side matrix tail cells (denial-body revalidation, runtime-projections ad-hoc validation) | WI-563 registration, `docs/specs/wi-followups.md` |
| `hooks/.renames.json` retirement census (post-E3 reader check) | new — record in T06 receipt |
| AP-30 bypass flag removal (`SVC_WORKTREE_SKIP_AP30_CHECK`) | A-4 note, feasibility audit §3 — separate safety-scoped WI |
| Stop/SessionEnd receipt adapters for remaining `skills-only` hosts | WI-563 |
| Catalog-faithful Claude `generateHostEntries` (matcher/async/profile, real bash-guard template, split autoemit ids) with `--list-all` byte-equality vs `buildHookEntries` | new — E3 path A; record in T06 receipt |
| D-2 emergency `.migrations.json` interpreter deletion (only if T05 chose the fallback) | new — T06 followup WI within one cycle |

---

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every feasibility ADOPT appears as concrete waves with file lists | §1 E1–E4 vs audit §2 | PASS |
| 2 | No adopted item adds agent-facing blocking work or new rituals | §0.1 + E4 velocity proof obligation; pre-commit slot 21- <1s, skip-on-untouched | PASS |
| 3 | Exported interfaces byte-compatible (SEGMENTS shape, wirer flags, linter exit-code additions documented) | E1.2, E3.1, E2.2 | PASS |
| 4 | Every new failure mode carries remediation command in message | E2.2 digest mismatch, E3 corrupt-config, E1 template drift | PASS |
| 5 | Hot-path edits confined to already-engaged ceremony (wire-hooks, linter, one pre-commit slot) | ownership table | PASS |
| 6 | Fallback for highest-risk wave pre-agreed | E3 fallback paragraph | PASS |
| 7 | Coverage: all four mandate items dispositioned (adopt/adapt/reject), none silently dropped | §0.1 ledger + §1 | PASS |
