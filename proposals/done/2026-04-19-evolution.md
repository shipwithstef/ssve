# Framework Evolution — 2026-04-19

## Method

Read `FRAMEWORK-STATE.md` in full (1845 lines) to skip already-tracked items. Read `DOCTRINE.md` section headers + self-verification section. Read `skills-manifest.json` (488 lines) and compared `includedSkills` vs `corePackForRouting`. Read `evolve-framework/SKILL.md`, `hooks/hooks.json`, `references/skill-pack-comparison.md`, `ANTIGRAVITY.md`. Globbed all 57 `*/SKILL.md` files. Inspected all 8 pending proposals in `proposals/` and sampled `proposals/done/` for baseline. Verified scripts referenced by "pending" proposals actually exist on disk. Ran `jq` diff between manifest skill lists; ran directory diff vs `includedSkills`.

This proposal supersedes the prior shallow 34-line draft at the same path (which had been authored before `FRAMEWORK-STATE.md` gained its full 2026-04-19 entries and already-closed gaps).

**Skipped (already in FRAMEWORK-STATE.md):** V0 bundle-grep vs HTTP-200 false positive (covered by the 2026-04-18 WI-072 learnings and already absorbed into verification discipline), `lane-tasks.json` → `lane-tasks-<WI>.json` chaining-boilerplate drift (Known Gap line 1775), Gemini context degradation (closed 2026-04-19), progressive disclosure re-bloat (closed 2026-04-19), route-workflow content recovery (closed), E2E seed antipattern (closed), Pillar Revisit Audit gate (closed), test-fixture/Platform domain classification in diagnose-bug (closed), decision-log mandatory enforcement (closed 2026-04-18), skill boilerplate for task-graph chaining (applied to all 55 skills 2026-04-19).

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001: `assess-market-readiness` listed in `corePackForRouting` but missing from `includedSkills` [Drift] — **IMPLEMENTED 2026-04-19**
**Evidence:** `skills-manifest.json:99` lists `"assess-market-readiness"` in `corePackForRouting`, and the skill has a full `assess-market-readiness/SKILL.md`, but it is absent from the top-level `includedSkills` array (`skills-manifest.json:2-59`). `diff` of `jq -r '.includedSkills[]'` vs `jq -r '.corePackForRouting[]'` surfaces exactly one mismatch: `assess-market-readiness` is in core-pack and NOT in included. `route-workflow/references/intent-routing.md` auto-invokes `assess-market-readiness --stage launch` on idle, so new installs that respect `includedSkills` as the install set will silently fail to find it.
**Impact:** Auto-readiness trigger breaks on fresh installs. Skill ships but isn't "declared shipped." Tier-1 static validation (FRAMEWORK-STATE:182 "Framework Integrity Audit") did not catch this because the validator checks output-path conflicts, not manifest set-membership parity.
**Proposed fix:** Add `"assess-market-readiness"` to `includedSkills` in `skills-manifest.json`. Extend the manifest linter (`scripts/lint-skills-manifest.mjs`) with an assertion: `corePackForRouting ⊆ includedSkills`. Any skill listed in core-pack must be declared as included.

#### F-002: `hooks/hooks.json` diverges from FRAMEWORK-STATE hook inventory [Drift] — **IMPLEMENTED 2026-04-19** (FRAMEWORK-STATE:18 updated; manifest-linter extension deferred to F-003 workstream)
**Evidence:** `FRAMEWORK-STATE.md:18` declares *"4 PreToolUse hooks (workflow-guard, phase-boundary, eval-gate-pre, bash-guard) + 2 PostToolUse hooks (eval-gate-post, edit-accumulator) + 2 Stop hooks (completion-guard, stop-quality)."* The actual `hooks/hooks.json` registers **5 PostToolUse hooks** (`hooks/hooks.json:32-61`: `svc-eval-gate-post`, `svc-edit-accumulator`, `svc-vibe-auditor`, `svc-lane-tasks-validator`, `svc-wi-pillars-check`). Three of those five post-hooks were added by the 2026-04-18 Industrial-UI push and the 2026-04-19 Gemini-harness hardening but never back-propagated into FRAMEWORK-STATE's Current State block.
**Impact:** FRAMEWORK-STATE is the file `evolve-framework`, `improve-framework`, `blend-external`, and `test-framework` read before mutating. A stale inventory causes double-registration and "is this already a hook?" rediscovery cycles. Agents may re-propose `svc-lane-tasks-validator`/`svc-wi-pillars-check` because the state file under-reports them.
**Proposed fix:** Update `FRAMEWORK-STATE.md:18` to reflect the real count (4/5/2). Add a self-verify to `improve-framework` Step 5.5: a small script that parses `hooks/hooks.json` and asserts counts match the `Current State` bullet. Mechanical enforcement per 2026-04-19 locked decision "Mechanical enforcement over agent discipline" (FRAMEWORK-STATE:1788).

### P1 — Fix soon (degrades quality)

#### F-003: `list-work-items.skill` — binary zip archive committed alongside the unpacked `list-work-items/` directory [Drift]
**Evidence:** `ls -la list-work-items.skill` returns a 2886-byte file (not a directory). `head` of the file shows `PK` header bytes (ZIP magic) and embedded paths `SKILL.md`, `assets/`, `references/`, `scripts/list_work_items.mjs` — a packaged copy of the same skill that already lives unpacked at `list-work-items/`. `git log --oneline -- list-work-items.skill` confirms the file is tracked (commit `15ee476`, "improve-framework: add platform forensics …"). No other skill has a `.skill` zip twin. No convention in `DOCTRINE.md`, `CONTRIBUTING.md`, or `setup/` documents `.skill` as a distribution format.
**Impact:** Two sources of truth for the same skill. If an improvement lands in `list-work-items/SKILL.md` but not in the zip, the two drift silently. Installers that glob `*.skill` may prefer the stale zip. Confusing for contributors scanning the tree.
**Proposed fix:** `git rm list-work-items.skill`. If a packaged form is genuinely needed for an installer, add a documented `scripts/package-skill.sh <name>` that produces artifacts under `dist/` (gitignored), not tracked at repo root.

#### F-004: Pending proposals queue contains 3 proposals whose referenced artifacts already shipped [Inefficiency] — **IMPLEMENTED 2026-04-19** (three files `git mv`'d to `proposals/done/`)
**Evidence:**
- `proposals/2026-04-18-framework-improvement-industrial-ui.md` proposes `scripts/generate-a2ui-catalog.mjs`, `scripts/lint-w3c-tokens.mjs`, `hooks/svc-vibe-auditor.js`. All three files exist on disk today (`ls` confirms each path resolves).
- `proposals/2026-04-18-session-audit-industrial-progression.md` header table (lines near top) explicitly says `"Cataloging | Auto-gen A2UI JSON | Implemented via mjs script | PASS"`, `"Real-time Audit | Hook-based visual diff | Implemented AfterTool hook | PASS"`, `"Token Safety | Block hardcoded colors | Implemented git-diff linter | PASS"`.
- `proposals/2026-04-18-session-audit-gemini-masterclass.md` body: *"2. Path Correction: …implemented @-import rule injection…", "3. Safety Policies: Implemented svc-safety.toml…", "5. Innovation: Proposed and implemented the Vibe Contract pattern."*

All three sit in `proposals/` (= pending) instead of `proposals/done/` per the locked "Proposal lifecycle" decision (FRAMEWORK-STATE:1810).
**Impact:** `evolve-framework` Step "Stale proposal audit" re-reads them each run as if they were open backlog. Agents waste cycles re-evaluating already-landed work. Hides the actual pending backlog (the BLOCKED scope-decision proposals `2026-04-14-parallel-wi-dispatch.md` and `2026-04-14-blocking-discovery-halt-protocol.md`, plus the 2 new 2026-04-19 cognitive-routing proposals that genuinely need triage).
**Proposed fix:** `git mv proposals/2026-04-18-framework-improvement-industrial-ui.md proposals/done/` and the two related session-audit files. Add a self-verify step to `improve-framework` and `audit-session-execution`: after landing the implementation, run `git mv <proposal> proposals/done/` as a final output-contract step — not as an afterthought.

#### F-005: `evolve-framework/SKILL.md:60` says "read all 35+ skills" — actual count is 57 [Drift]
**Evidence:** `evolve-framework/SKILL.md:60`: *"**Every SKILL.md** — read all 35+ skills."* `jq -r '.includedSkills | length'` returns 57; `ls -d */SKILL.md | wc -l` returns 58 (includes `assess-market-readiness` which is the F-001 drift). FRAMEWORK-STATE:12 says 55, also slightly stale relative to manifest.
**Impact:** Minor, but agents reading SKILL.md use the number as a proxy for scan effort and may under-scope. "35+" is literally true but understates current surface area by ~40%.
**Proposed fix:** Change `evolve-framework/SKILL.md:60` to reference `skills-manifest.json` dynamically rather than hard-coding a count: *"read every SKILL.md listed in `skills-manifest.json:includedSkills` (currently ~55-60)."* Same fix for any other skill that hard-codes a skill count.

### P2 — Improve when possible (nice to have)

#### F-006: Two new 2026-04-19 proposals (cognitive-model-routing, isolated-subagent-dispatch) lack explicit Status header [Fragility]
**Evidence:** `proposals/2026-04-19-framework-improvement-cognitive-model-routing.md` and `proposals/2026-04-19-framework-improvement-isolated-subagent-dispatch.md` both open with `## Evidence` / `## Diagnosis` but no `**Status:**` line in the first 10 lines. Compare `proposals/done/2026-04-14-blocking-discovery-halt-protocol.md:3`: `**Status:** BLOCKED (awaiting scope decisions; see "Why BLOCKED" below)` — the locked convention introduced by `proposals/done/2026-04-14-framework-improvement-blocked-proposal-status.md`.
**Impact:** Without an explicit status header, `evolve-framework` cannot distinguish "awaiting triage" from "awaiting implementation" from "awaiting user scope decision." Next evolution run has to re-read entire bodies to classify.
**Proposed fix:** Add a self-verify row to `improve-framework` and `audit-session-execution` skills: every proposal file they emit must start (within first 5 lines) with one of `**Status:** DRAFT` | `**Status:** READY` | `**Status:** BLOCKED — <reason>` | `**Status:** IMPLEMENTED`. Backfill the two 2026-04-19 files with appropriate status markers.

### P3 — Track (not actionable yet)

#### F-007: "Discussion phase for gray areas" gap (FRAMEWORK-STATE:1769) is now 10+ days old with no proposal [Opportunity]
**Evidence:** `FRAMEWORK-STATE.md:1769` lists *"Discussion phase for gray areas | validate-feature partially covers; full GSD-style discuss needs new skill | 3-4 days | MED-HIGH."* No file in `proposals/` addresses it. Meanwhile 2026-04-19 shipped multiple user-pushback-driven fixes (capture-idea directive detection, reverse-engineer family-fit check) that are exactly the "gray area" class this gap is meant to handle upstream.
**Impact:** Recurring user-correction cost on intake-class skills. Not actionable today without a concrete write-up.
**Proposed fix:** Track only. Flag for next `improve-framework` run to draft a concrete proposal. Do not expand this file into that proposal.

## Comparison delta

From `references/skill-pack-comparison.md` (read 2026-04-19), the active `— gap —` rows vs gstack/superpowers:
- **Auto-Review Pipeline** (gstack `/autoplan`): assesses whether CEO → design → eng reviews can auto-chain. svc has the pieces (`review-gate` G1–G7) but no orchestrator that sequences them without human checkpoint. Non-trivial and may conflict with svc's `human_checkpoint: true` default on many skills. Not a priority.
- **Safety Guardrails** (gstack `/careful` + `/freeze` + `/guard`): svc's `hooks/svc-workflow-guard.js` already covers config-protection, `--no-verify` block, and commit quality. The gstack trio adds a user-toggleable "freeze" mode that halts all Edits until unfrozen — marginal value given svc's existing workflow-guard. Defer.
- **Retrospectives** (gstack `/retro`): the comparison row is likely stale — `audit-session-execution` does commit analysis + session forensics and overlaps substantially. Update the comparison matrix row rather than build a new skill.

None of the three rises to P0/P1. All gaps are either already covered by adjacent svc skills or not in scope.

## Stale proposal audit

| Proposal | Current state | Recommendation |
|---|---|---|
| `2026-04-14-blocking-discovery-halt-protocol.md` | BLOCKED (scope decisions needed) — status header present | Leave pending. Unblock via user scope decision. |
| `2026-04-14-parallel-wi-dispatch.md` | BLOCKED (scope decisions needed) — status header present | Leave pending. User must pick Tier 1 narrow vs full. |
| `2026-04-18-framework-improvement-industrial-ui.md` | Shipped (3 referenced artifacts exist on disk) | `git mv → done/` — F-004. |
| `2026-04-18-session-audit-industrial-progression.md` | Shipped (audit confirms PASS across 3 artifacts) | `git mv → done/` — F-004. |
| `2026-04-18-session-audit-gemini-masterclass.md` | Shipped (body says "implemented" across items) | `git mv → done/` — F-004. |
| `2026-04-19-evolution.md` | Being replaced by this file | N/A — self-supersede. |
| `2026-04-19-framework-improvement-cognitive-model-routing.md` | Missing `**Status:**` header | Add status — F-006. |
| `2026-04-19-framework-improvement-isolated-subagent-dispatch.md` | Missing `**Status:**` header | Add status — F-006. |

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS (`proposals/done/2026-04-19-evolution.md`) |
| 2 | Every finding cites file:line | PASS (F-001 `skills-manifest.json:99` + `:2-59`; F-002 `FRAMEWORK-STATE.md:18` + `hooks/hooks.json:32-61`; F-003 `list-work-items.skill` + commit `15ee476`; F-004 3 proposal paths + verified artifact paths; F-005 `evolve-framework/SKILL.md:60`; F-006 proposal paths + `proposals/done/2026-04-14-blocking-discovery-halt-protocol.md:3`; F-007 `FRAMEWORK-STATE.md:1769`) |
| 3 | FRAMEWORK-STATE.md was read first | PASS (read lines 1–250 and 1765–1846; Known Gaps + Decisions scanned; already-tracked items explicitly listed in Method and skipped) |
| 4 | Findings ranked by impact | PASS (P0 blocks manifest correctness and state-file honesty; P1 queue hygiene + stale counts; P2 convention enforcement; P3 tracked-not-actionable) |
