# SSVE Evolution Feasibility & Pruning Audit — WI-SSVE-ARCHITECTURE-EVOLUTION-02

- **Date:** 2026-08-24
- **Type:** Architectural feasibility audit + pruning verdicts (Task 1 of 6)
- **Input:** `docs/specs/audits/2026-08-23-improvement-protocol-multi-agent-handoff-and-verification-receipts.md` (the four remaining open items), `docs/specs/wi-followups.md` (WI-563/WI-564 registrations), post-WI-562 tree @ `784b764`
- **Method:** Direct reads of every named artifact in this worktree; git-log reconciliation of WI-562 waves 1–4 against the protocol's 20 items; duplicate/linter probes run mechanically against `skills-manifest.json`.
- **Design directive applied:** zero compromise on agent velocity — every verdict below answers *"does this make multi-agent execution faster, safer, or more precise without adding governance friction?"* Items that add process weight are rejected outright.

---

## 1. Baseline: what WI-562 already landed (do not re-plan)

Reconciling the 2026-08-23 protocol against `git log --grep="WI-562"`:

| Protocol item | Status | Evidence |
|---|---|---|
| IP-H1 ground-truth parallel merge-back | **LANDED** | wave 1 (`ad1d7d0`) |
| IP-H2 exit-honest promote/remove | **LANDED** | wave 1 |
| IP-H3 CAS verb mutex + cleanup quarantine | **LANDED** | wave 2 (`9dc2c73`) |
| IP-H4 finalizeHandover forward-completion | **LANDED** | wave 2 |
| IP-H5 process-death-proof locks + heartbeats | **LANDED** | waves 1–2 |
| IP-H6 normalized handoff records | **LANDED** | wave 2 |
| IP-H7 freeze enforcement + quarantine + lane-tasks pre-commit | **LANDED** | wave 3 (`5007556`) |
| IP-R1 receipt format charter + kind registry | **LANDED** | wave 2 |
| IP-R2 fail-closed schema loading | **LANDED** | wave 1 |
| IP-R3 slot-keyed mining repair | **LANDED** | wave 1 |
| IP-R4 single sanctioned emitter / atomic writes | **LANDED** | wave 1 |
| IP-R5 schema/code enum conformance (incl. `explicit_takeover`) | **LANDED** | wave 2 |
| IP-R7 read-matrix gate (partial; tail cells seeded as debt) | **PARTIAL** | wave 3 + `docs/specs/wi562-read-matrix-baseline.json` |
| IP-R9 envelope digest binding + tamper-proof mirror | **LANDED** | wave 4 (`ee07334`) |
| IP-W1 uniform atomic write + corrupt-config abort (all 3 wirers) | **LANDED** | wave 1; verified live at `wire-cursor-hooks.mjs:146–152`, `wire-hooks.mjs:575–593` |
| IP-W2 shared ownership predicate | **LANDED** | wave 2 |
| IP-W3 declarative hook catalog (32 hooks × 7 hosts) + quoted renderer | **PARTIAL** | wave 4: catalog drives Cursor generation; Claude still merges additively through the legacy `isAlreadyWired` table (`hooks/lib/hook-catalog.mjs:8–9` states this explicitly) |

Tier-1 posture at base: **348/350 PASS** (WI-562 promotion delivery receipt, `docs/specs/reviews/wi562-promotion-delivery-receipt.md:20`). The four items this WI evaluates are exactly the residue — consistent with `docs/specs/wi-followups.md` (WI-564 ≈ SR-items; WI-563 ≈ HW-6/IP-R6). This WI absorbs both registrations.

---

## 2. Verdicts

### 2.1 SR-1 & SR-3 — Stage Registry Single Source Unification → **ADOPT, adapted (data-first, no new framework)**

**Confirmed problems (re-verified in this tree):**
- `scripts/stage-segment.mjs:24–28` hardcodes the 3-segment mandatory chain in *skill-name* vocabulary (`plan-changeset`, `execute-changeset`, `land-changeset`…) while `references/stage-registry.json` speaks *stage-key* vocabulary (`plan`, `implement`, `live-proof`). Worse, the two vocabularies collide on shared spellings (`review-plan`, `review-exec` exist as BOTH stage keys and skill names) — a standing misread hazard.
- The exempting consumer list in `validate-stage-registry-single-source.sh:20–23` does not include `stage-segment.mjs`.
- `skills-manifest.json.reviewGates.G6 = {after: land-changeset}` while `skills/review-exec/SKILL.md:87` self-labels "It is the G6 gate in the chain" and `:343` assigns review-plan "G5 (pre-exec)". Zero tooling reads the `reviewGates` block (repo-wide grep: no consumers in `scripts/`, `hooks/`, `test-framework/`). This is FP-024, unresolved.
- Bonus finding: the segments' `emits` arrays carry a THIRD implicit vocabulary (receipt types: `plan-manifest`, `exec-record`, …) with no tie-back either.

**Design (velocity-first):**
1. Move the segment DATA into `references/stage-registry.json` as a `mandatory_chain_segments` block: `{id, steps:[{skill, stage_key|null}], checkpoint_after_skill, emits[]}`. One file to edit when the chain evolves; zero new tooling concepts.
2. `stage-segment.mjs` derives `SEGMENTS` from the registry via the existing loader (`scripts/lib/stage-registry.mjs`), resolving the module path relative to the module URL (pattern proven in `hooks/lib/hook-catalog.mjs:15`). Runtime cost: one JSON parse (~ms, once per process). It keeps exporting the identical shape so `route-workflow` docs, `validate-stage-isolation.sh`, and all consumers stay untouched.
3. Extend `validate-stage-registry-single-source.sh`: consumer list gains `stage-segment.mjs`; new assertions — segment ids unique, every `steps[].skill` ∈ manifest `includedSkills` ∪ `mandatoryChainOutOfLane`, every non-null `stage_key` resolves, `checkpoint_after_skill` set == the three human_checkpoint seams, `emits[]` ⊆ receipt kinds registered in the WI-562 kind registry (kills the third vocabulary at birth).
4. **FP-024 resolution — single-vocabulary relabel (Option B):** keep the classic G1–G7 semantics exactly as the manifest defines them (they describe pipeline transitions; renumbering would churn dozens of artifacts — rejected). Give each manifest gate an `enforced_by` ownership field: `G5.enforced_by = [review-exec, audit-implementation]`, `G6.enforced_by = [land-changeset]`, `G7.enforced_by = [verify-promotion]`. Sweep prose: `review-exec/SKILL.md:87,:343` and the AGENTS.md mandatory-chain bullet stop claiming "G6"; review-plan is identified by its own mandatory-chain position and receipt type — no invented roman numerals. Linter validates `reviewGates` (after-skills ∈ pipeline ∪ chain set; unique ids; enforced_by ∈ includedSkills) and a tier-1 grep asserts no skill claims a gate id owned elsewhere.
5. SR-6 rider (same bundle, trivial): `references/receipts-TEMPLATE.json` staleness escalates warn → exit 2 (`scripts/audit-story-receipts.mjs:68–83`).

**Rejected alternatives:** full JSON-Schema for the registry (validation already lives in the loader; a second validator is duplicate truth); merging land/verify into story-stage keys (would ripple every `story_type_profile` for zero consumer benefit); dual `pipeline_gates` vs `chain_gates` namespaces (two names for one concept is precisely the disease under treatment).

---

### 2.2 SR-4 — Skills Manifest Integrity & Hash Validation → **ADOPT, adapted (sidecar digest, no chicken-and-egg)**

**Confirmed problems:** no `schema_version`, no revision/hash on `skills-manifest.json`; linter checks membership subsets only — duplicates pass. Mechanically re-confirmed TODAY: **`track-visuals` appears twice in `pipeline`, twice in `greenfield`, twice in `brownfield-feature`** — a real data defect the audit predicted and nobody caught because nothing checks.

**Design (velocity-first):**
1. Add `"schema_version": 1` top-level (aligns with the WI-562 receipt charter's integer-monotonic convention).
2. Integrity via **sidecar projection**, not an in-file hash (a hash inside the hashed document is self-defeating and forces restamp-on-every-read): `node scripts/lint-skills-manifest.mjs --stamp` writes `.svc/manifest-digest.json` `{sha256(manifest bytes), stamped_at}`; plain lint mode verifies stamp-vs-bytes and FAILS on drift with the exact restamp command in the error. The repo already mandates running the linter after any manifest change (AGENTS.md §13) — this adds zero new ritual, just teeth.
3. Linter upgrades: duplicate detection across ALL ordered arrays (fixes the three live `track-visuals` rows in T04); ordering checks where array role demands order (`pipeline`, `bootstrapStartSequence`); `reviewGates` validation (per §2.1); lane-name-set stability vs `laneDefinitions` keys.
4. Consumers that cache the manifest (setup, install-drift) may pin the digest for cheap tamper detection — optional, additive.

**Rejected:** in-file `_integrity.digest` (restamp ceremony on every edit = friction); hashing at every read path (runtime cost on hot paths for a protection that pre-commit lint already provides).

---

### 2.3 HW-7 — Declarative Hook Settings Migration Pipeline → **REJECT as prescribed; SUPERSEDE with catalog-cutover completion**

The prescribed remedy ("declarative migration pipeline + settings-shape version") treats the symptom. First-principles: the five embedded migration passes in `scripts/wire-hooks.mjs` (:635–730: WI-072 renames, canonical commands, WI-487 launcher adoption, WI-359 argv-strip, async adoption) exist **only because Claude's wirer uses additive merge + string-identity idempotency** (`isAlreadyWired`, :463–502, ~35 bespoke cases) that *skips* canonical re-emission whenever any variant already matches. Cursor and Grok prove the alternative: subtractive rebuild (drop svc-owned entries via the shared predicate, append canonical set) needs **no migration passes at all** — replacement subsumes rename/adoption/normalization by construction.

Building a declarative migration engine (descriptor schema, ordering, shape-version stamps) would institutionalize the accretion HW-7 complains about — permanent machinery serving a shrinking population of legacy installs. That is negative complexity. **Rejected.**

**Superseding design — complete the IP-W3 cutover on the Claude wirer:**
1. Convert `wire-hooks.mjs` merge phase to catalog-driven subtractive rebuild: classify existing entries with the shared ownership predicate (WI-562, `hooks/lib/`), drop svc-owned, append catalog-generated canonical entries honoring the `DISABLED` set; foreign commands preserved byte-verbatim.
2. Delete: the `isAlreadyWired` table, all five migration passes, the dedup-v1/v2 safety nets they necessitated (:748–836). Net effect is several hundred lines REMOVED from a hot-path script — negative complexity is the velocity feature.
3. Preserve: `--list-all` structural replay, backup-once + atomic write (IP-W1), company-hook prune flag path, kimi strip behavior.
4. Contract note (documented, per HW-5 precedent): user-customized svc-owned commands are normalized back to canonical on re-wire; recovery via the timestamped backup.
5. Acceptance tier-1 evals: double-run byte-stability; foreign-entry preservation; DISABLED honored; corrupt-config abort nonzero; seeded legacy-variant install converges to canonical in ONE run with zero bespoke passes.

**Fallback (if exec review surfaces regression risk beyond appetite):** consolidate the five passes into ONE declarative table + tiny interpreter (`hooks/.migrations.json`, pattern proven by `hooks/.renames.json`) — strictly less value, but bounded. Decision point recorded for T05 reviewers.

---

### 2.4 HW-6 / IP-R6 — Cross-Host Phase Auto-Receipt Parity (Cursor & Grok) → **ADOPT, capability-tiered (honest parity beats forced parity)**

**Verified host surfaces:** Grok supports native `PostToolUse` (`wire-grok-hooks.mjs:8`) → port `svc-phase-receipt-autoemit` directly; full parity achievable. Cursor offers only `beforeShellExecution / afterFileEdit / sessionStart / stop` (`wire-cursor-hooks.mjs:8`) — no PostToolUse payload; Edit-path receipts achievable via `afterFileEdit`, shell-path evidence structurally cannot fire.

**Design (zero-overhead honored):**
1. Wire `svc-phase-receipt-autoemit` on grok PostToolUse and cursor `afterFileEdit` using the existing catalog renderer (quoting handled). The hook is fail-open, sync-but-tiny (reads active `.svc/lane-tasks-*` + one SKILL.md phases block; one node spawn per qualifying event — the same cost class Claude pays today). No new blocking semantics anywhere.
2. Catalog capability truth graduates from binary to tiers: `receipts: "auto-full"` (claude, grok) / `"auto-edits-only"` (cursor) / `"skills-only"` (kimi/codex/gemini/opencode unless later ports land). `hostCapability()` consumers get precise facts instead of a euphemism.
3. `validate-cross-host-hook-conformance.sh` gains a receipts section: capability ≠ `skills-only` ⇒ host wirer must enumerate the autoemit id; capability == `auto-edits-only` ⇒ must NOT claim shell-path coverage. Declared-vs-wired mismatch fails.

**Explicitly out of scope (registered, not built here):** Stop/SessionEnd-equivalent adapters for remaining hosts; read-side matrix tail cells (`denial-receipts` body revalidation, `runtime-projections` ad-hoc validation — see `docs/specs/wi562-read-matrix-baseline.json`); these stay with the WI-563 registration.

---

## 3. Additional findings adopted into scope

| # | Finding | Evidence | Action |
|---|---|---|---|
| A-1 | Live duplicate rows: `track-visuals` ×2 in `pipeline`, `greenfield`, `brownfield-feature` | mechanical probe this session | Fix in T04; prevented recurrently by §2.2 linter upgrade |
| A-2 | Third vocabulary risk: segment `emits[]` receipt types unchecked | `stage-segment.mjs:25–27` | Validated against receipt-kind registry (§2.1.3) |
| A-3 | Gate-id ownership unenforced → prose collisions recur even after sweep | FP-024 history | `enforced_by` matrix + tier-1 anti-collision grep (§2.1.4) |
| A-4 | `SVC_WORKTREE_SKIP_AP30_CHECK=1` bypass still honored (deprecated) | `scripts/worktree.sh:716,:793–794` | NOTED, deferred — removal touches worktree safety surface; register followup, keep this changeset focused |

**Pruned from consideration (anti-bloat ledger):** declarative migration engine (§2.3); gate renumbering; registry JSON-Schema layer; in-file manifest hash; runtime schema validation of every manifest read; new blocking hooks on cursor/grok; CI-mutating stamp writes. Combined rejection rationale: each adds permanent process weight or hot-path cost to prevent a class of mistake already fenced by cheaper means.

---

## 4. Velocity impact statement

- Agent-visible latency delta: **~0** (one JSON parse at wirer/module init; fail-open autoemit already the operating cost on Claude).
- Governance delta: **0 new rituals** (linter was already mandated; digest stamp rides the same command).
- Code delta: wire-hooks.mjs shrinks by hundreds of lines; two wirers gain one entry each; validators gain targeted sections.
- Coordination precision: single stage/gate vocabulary, truthful per-host receipt capabilities, tamper-evident manifest — fewer silent divergence classes for parallel agents to trip over.

---

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every verdict grounded in this tree, not memory | Direct reads: stage-segment.mjs, stage-registry.json + loader, wire-{hooks,cursor,grok}*.mjs, hook-catalog.mjs, host-hook-catalog.json, manifest probe | PASS |
| 2 | WI-562 overlap excluded from re-planning | `git log --grep=WI-562` wave mapping vs protocol items (§1 table) | PASS |
| 3 | Each ADOPT has enforcement + verification mapped to tier-1 | §§2.1.3, 2.2.2–3, 2.3.5, 2.4.3 | PASS |
| 4 | Every REJECT carries architectural justification | §2.3 + §3 pruning ledger | PASS |
| 5 | Duplicates claim independently reproduced | `node -e` dupes probe over manifest arrays this session | PASS |
| 6 | No new blocking governance introduced | §4 velocity statement; autoemit fail-open verified in hook header | PASS |
