# SVC Plan Review Request — WI-SSVE-ARCHITECTURE-EVOLUTION-02

You are an independent adversarial plan reviewer for the svc framework (SSVE). Review the PLAN DOCUMENT below BEFORE any implementation. Your verdict gates dispatch of execute-changeset.

## What you are reviewing

- **Work item:** WI-SSVE-ARCHITECTURE-EVOLUTION-02 — SSVE Framework Architecture Evolution & Performance Preservation
- **Plan:** `docs/plans/2026-08-24-ssve-architecture-evolution-plan.md` (embedded below)
- **Feasibility audit feeding the plan:** `docs/specs/audits/2026-08-24-ssve-evolution-feasibility-audit.md` (verdicts: ADOPT-adapted ×3, REJECT-and-supersede ×1)
- **Source improvement protocol (residual items only):** `docs/specs/audits/2026-08-23-improvement-protocol-multi-agent-handoff-and-verification-receipts.md` — items SR-1/SR-3, SR-4, HW-7, HW-6/IP-R6. Items IP-H1…H7, IP-R1–R5/R9, IP-W1–W3 were ALREADY landed by WI-562 (verify against git log if needed); re-demanding them is a review error.
- **Machine contract:** `docs/plans/2026-08-24-ssve-architecture-evolution-plan/plan-contract.json` + `manifest.md` (living documents; amendment protocol stated in both).

## Design directive you must enforce

**Zero compromise on agent velocity.** The owner's standing directive: integration must NOT slow agent execution or add governance bureaucracy. The plan's §0.1 rejected-alternatives ledger is binding context: do not re-propose rejected machinery (declarative migration engine, gate renumbering, dual gate namespaces, in-file manifest hash, registry JSON-Schema layer, new blocking hooks) without NEW evidence those rejections are wrong.

## Review lenses (apply each; cite file:line evidence for every finding)

1. **Completeness** — does the plan fully disposition all four residual items? Any silent scope drops?
2. **Correctness** — are the proposed mechanisms sound? (segments-derived-view shape vs consumers; digest sidecar semantics; subtractive-rebuild equivalence for Claude wirer incl. kimi strip + company-hook prune + DISABLED interplay; Cursor afterFileEdit / Grok PostToolUse payload reality.)
3. **Security / fail-closed bias** — do any changes weaken fail-closed postures? Does the manifest-integrity stamp have a bypass? Does wirer normalization risk destroying user state irrecoverably?
4. **Backwards compatibility** — exported shapes (SEGMENTS field names, CLI verbs/flags/exit codes), legacy installs converging in one run, validator fixtures referencing deleted internals.
5. **Verifiability** — is every wave's acceptance mechanically checkable via the declared validation commands? Are D-1/D-2 decision points falsifiable?
6. **Velocity preservation** — any hidden runtime or ritual cost that violates the directive?

## Required output format (strict)

```
VERDICT: APPROVE | NEEDS_FIX
RUBRIC_SCORE: <number 0–10>
FINDINGS:
<N>. [SEVERITY: CRITICAL|HIGH|MEDIUM|LOW] [LENS] <finding>; evidence: <file:line or quoted plan text>; required change: <concrete instruction>.
...
SUMMARY: <one paragraph>
```

Rubric anchors: 0 = plan dangerous or incoherent; 5 = implementable but with HIGH gaps; 8 = minor MEDIUM findings only; 10 = promote as-is. Per protocol: rubric 10 AND zero findings ⇒ PROMOTE. Every finding must carry evidence and a required change; findings without both are invalid.

## Plan document follows

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
3. `test-framework/evals/tier-1/validate-stage-registry-single-source.sh`: append `scripts/stage-segment.mjs` to the consumer-import assertion; add segments-block validation — ids unique; every `steps[].skill` ∈ manifest `includedSkills` ∪ `mandatoryChainOutOfLane`; non-null `stage_key` resolves against `stages[]`; `checkpoint_after_skill` set == `{plan-changeset, execute-changeset, land-changeset}`; every `emits[]` member ∈ `references/receipt-kind-registry.json` kinds (kills the third vocabulary); negative fixtures: unknown skill, unknown stage key, unknown emit kind each rejected.
4. SR-6: `scripts/audit-story-receipts.mjs:68–83` template-staleness sentinel escalates warn → exit 2. Update any eval asserting the warn-only behavior (enumerate via grep `receipts-TEMPLATE` under `test-framework/` during execution).

**Verification:** extended single-source validator; `validate-stage-isolation.sh` unchanged and green (proves byte-compat); seeded segment-drift fixtures fail.

### E2 — Manifest Integrity & Gate Ownership (SR-4 + SR-5 tail + FP-024 resolution)

**Goal:** the manifest carries version + verifiable integrity; duplicates and ordering defects fail at lint time; every gate id has exactly one owning skill-set; prose matches.

**Changes:**
1. `skills-manifest.json`: add `"schema_version": 1`; fix the three live duplicate rows (`track-visuals` ×2 in `pipeline`, `greenfield`, `brownfield-feature` — keeping the canonical position, dropping the redundant copy); extend each `reviewGates.G*` entry with `"enforced_by"`: G1 `[write-spec]`, G2 `[design-ux]`, G3 `[design-ui]`, G4 `[design-tech]`, G5 `[review-exec, audit-implementation]`, G6 `[land-changeset]`, G7 `[verify-promotion]`.
2. `scripts/lint-skills-manifest.mjs` (hot-path validator — ceremony already engaged via this changeset):
   - Duplicate detection across ALL ordered arrays (`pipeline`, `bootstrapStartSequence`, `corePackForRouting`, every `laneDefinitions.*.skills`).
   - Ordering assertions where role demands them (`pipeline` spine order incl. plan→review-plan→execute precedence already asserted narrowly by `validate-review-gate-routing-arrays.sh` — generalize here).
   - `reviewGates` validation: unique G-ids, contiguous numbering, `after` ∈ `pipeline` ∪ `mandatoryChainOutOfLane`, `enforced_by` ⊆ `includedSkills`.
   - Digest integrity: `--stamp` writes `.svc/manifest-digest.json` `{algorithm:"sha256", digest, stamped_at}`; default mode verifies stamp-vs-current-bytes — **missing stamp ⇒ loud warn + remediation hint, exit 0** (bootstrap-friendly); **mismatched bytes ⇒ exit 1** naming both digests and `node scripts/lint-skills-manifest.mjs --stamp`.
3. Commit the stamped `.svc/manifest-digest.json` so PRs show manifest+digest mutations together.
4. Mechanical enforcement of the existing manual mandate: new pre-commit slot `hooks/git/pre-commit.d/20-manifest-integrity` running `node scripts/lint-skills-manifest.mjs` (sub-second; skips cleanly when manifest untouched — diff-filter on staged paths).
5. FP-024 prose sweep (single-vocabulary relabel): `skills/review-exec/SKILL.md:87` "It is the G6 gate in the chain" → "It enforces the **G5** checkpoint (BASELINED → CHANGE-SET-APPROVED) via adversarial post-exec review."; `:343` "at G5 (pre-exec) instead of G6 (post-exec)" → align review-plan as the pre-execution plan checkpoint identified by its own name and `review-plan` receipt (no roman numeral); AGENTS.md mandatory-chain bullet "new G6 gate" → "G5-enforcing gate". Sweep method: `grep -rn "G[56]" skills/review-{exec,plan}/SKILL.md docs/ ../AGENTS.md` then targeted edits; no mass renumbering.
6. New validators:
   - `validate-manifest-integrity-stamp.sh`: stamp present+matching passes; seeded byte-flip fails exit 1; missing stamp warns-not-fails (asserts bootstrap contract).
   - `validate-gate-ownership-matrix.sh`: for each gate g with `enforced_by` E, scan `skills/*/SKILL.md` for self-labeling patterns (`\bthe G<n> gate\b`, `\bat G<n> \(`) and FAIL when the claiming skill ∉ E[g]. Narrow patterns only — no generic "G5" mention policing.

**Verification:** linter green twice (stamp→no-op verify); seeded duplicate fixture fails; seeded gate-claim violation fails; `validate-review-gate-routing-arrays.sh` still green.

### E3 — Claude Wirer Catalog Cutover (HW-7 superseded — net code DELETION)

**Goal:** one architectural posture across all three wirers; the migration-pass accretion and the `isAlreadyWired` string-match table cease to exist.

**Changes:**
1. `scripts/wire-hooks.mjs`: replace additive-merge phase with catalog-driven subtractive rebuild:
   - Classify every existing settings entry with the shared ownership predicate (`hooks/lib/svc-ownership.mjs`, WI-562).
   - Drop ALL svc-owned entries; append catalog-generated canonical entries (`generateHostEntries("claude", …)`), honoring the `DISABLED` set (disabled ids neither dropped-then-readded nor resurrected — they are simply absent).
   - Foreign commands preserved byte-verbatim, including entry grouping/matchers.
   - Delete: `isAlreadyWired` (:463–502), migration passes (:635–730 renames/canonical-commands/launcher-adoption/argv-strip/async-adoption), exact-dedup + variant-dedup safety nets (:748–836), and the now-dead `loadRenamedFiles`/`CANONICAL_COMMANDS` scaffolding. `hooks/.renames.json` itself stays (other consumers may read it; removal is a separate followup if census shows zero readers).
   - Preserve: arg parsing, `--list-all` structural replay output shape, backup-once + atomic write, company-hook prune path, kimi strip behavior (rebuild classifies kimi-installed variants as svc-owned via the shared predicate — verify parity fixture).
2. Contract documentation (one paragraph in the wirer header): re-wire normalizes user-modified svc-owned commands back to canonical; recovery = timestamped backup printed on every mutating run.
3. Validators:
   - CREATE `validate-claude-wirer-cutover.sh`: sandboxed HOME fixtures — (a) double-run byte-stability; (b) foreign-entry preservation; (c) `DISABLED` honored; (d) corrupt-config abort nonzero with intact prior bytes; (e) seeded legacy-variant install (renamed-file ref, argv-token relic, sync observational hook) converges to canonical in ONE run with ZERO migration-specific code paths exercised (assert via `--list-all` + final-settings snapshot, and grep that `wire-hooks.mjs` contains no `isAlreadyWired` / `$TOOL_INPUT` strip remnants).
   - Retire/repurpose `validate-wire-hooks-variant-dedup.sh` (dedup nets are gone by design — replace body with the convergence assertion above rather than deleting the slot, preserving suite numbering stability).
   - Enumerate and update every validator referencing removed internals: `grep -rln "isAlreadyWired\|argv-payload\|RENAMED_FILES\|CANONICAL_COMMANDS" test-framework/ hooks/ scripts/` at execution start; each hit dispositioned (update fixture or drop assertion) in the exec record.

**Fallback (pre-agreed with T05 reviewers):** if exec review surfaces irreducible regression risk, land instead the bounded consolidation — five passes → one declarative table + interpreter (`hooks/.migrations.json`) — and register the cutover followup. Decision recorded in the exec triple-review log either way.

### E4 — Cross-Host Phase Auto-Receipt Parity (HW-6 / IP-R6, capability-tiered)

**Goal:** every hook-capable host produces phase receipts up to its REAL event surface; declared capability == wired reality, mechanically checked.

**Changes:**
1. Payload compatibility gate FIRST (decision point D-1, before any wiring): read `hooks/lib/hook-payload.mjs` `extractFilePath`/payload parsing; smoke-test real Cursor `afterFileEdit` and Grok `PostToolUse` stdin shapes in a sandboxed harness. Outcomes: (a) both compatible → proceed; (b) Cursor incompatible → Cursor stays `skills-only` (protocol-sanctioned classification), Grok proceeds; capability flags reflect truth either way. No adapter hacks — if the payload lacks a usable file path, the host cannot produce Edit-path evidence and pretending otherwise would poison receipts.
2. `references/host-hook-catalog.json`: graduate `receipts` capability from binary to tiers — `claude: "auto-full"`, `grok: "auto-full"` (post-D-1), `cursor: "auto-edits-only"` | `"skills-only"` (per D-1), others unchanged `skills-only`; add autoemit hook entries for grok (`PostToolUse`) and cursor (`afterFileEdit`) with quoted renderer templates.
3. `scripts/wire-grok-hooks.mjs` / `scripts/wire-cursor-hooks.mjs`: emit the autoemit entries from the catalog (both wirers already generate from catalog post-WI-562 — this is data + one event-map row each).
4. `hooks/svc-phase-receipt-autoemit.mjs`: no behavioral change expected; if D-1 exposes a payload-shape nuance, adapt `extractFilePath` additively (never narrowing Claude's behavior).
5. `validate-cross-host-hook-conformance.sh`: new receipts section — capability ≠ `skills-only` ⇒ host wirer text must enumerate the autoemit id; capability == `auto-edits-only` ⇒ MUST NOT claim shell-path coverage; `skills-only` hosts MUST NOT enumerate it. Snapshot expectations updated in the SAME commit (byte-parity rule).

**Velocity proof obligation:** the autoemit hook is fail-open and observational (header-documented); wiring adds one node spawn per qualifying event on hosts that previously produced NO receipts — strictly more signal per unit latency, zero new blocks. Cited in exec record.

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
| E2 | `skills-manifest.json`, `.svc/manifest-digest.json` (created), `scripts/lint-skills-manifest.mjs`, `skills/review-exec/SKILL.md`, `skills/review-plan/SKILL.md` (if sweep hits), `AGENTS.md` (chain bullet), `hooks/git/pre-commit.d/20-manifest-integrity` (created), `test-framework/evals/tier-1/validate-manifest-integrity-stamp.sh` (created), `test-framework/evals/tier-1/validate-gate-ownership-matrix.sh` (created) |
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

---

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every feasibility ADOPT appears as concrete waves with file lists | §1 E1–E4 vs audit §2 | PASS |
| 2 | No adopted item adds agent-facing blocking work or new rituals | §0.1 + E4 velocity proof obligation; pre-commit slot <1s, skip-on-untouched | PASS |
| 3 | Exported interfaces byte-compatible (SEGMENTS shape, wirer flags, linter exit-code additions documented) | E1.2, E3.1, E2.2 | PASS |
| 4 | Every new failure mode carries remediation command in message | E2.2 digest mismatch, E3 corrupt-config, E1 template drift | PASS |
| 5 | Hot-path edits confined to already-engaged ceremony (wire-hooks, linter, one pre-commit slot) | ownership table | PASS |
| 6 | Fallback for highest-risk wave pre-agreed | E3 fallback paragraph | PASS |
| 7 | Coverage: all four mandate items dispositioned (adopt/adapt/reject), none silently dropped | §0.1 ledger + §1 | PASS |
