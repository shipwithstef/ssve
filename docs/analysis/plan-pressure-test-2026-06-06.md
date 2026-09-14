# Plan Pressure-Test — Framework-Evaluation Execution Plan (2026-06-06)

**Method:** dedicated Plan-agent adversarial pass over plan v1 (before any execution), instructed to verify mechanics by reading enforcement source, with the owner's hard constraint: nothing may break working machinery.
**Consumed by:** plan v2 (`~/.claude/plans/dazzling-chasing-honey.md`), then tri-model review → v3 (`docs/specs/reviews/framework-eval-plan-cross-model.md`).

## Headline findings (all incorporated into v2)

1. **"Exempt-class → direct commit" is policy-true but mechanically false.** `rules/plan-changeset-trigger.md` exempts docs/additive work from *ceremony*, but the refuse-mode push gate (`hooks/git/pre-push.d/10-receipts-complete` + `scripts/check-chain-receipts.mjs`) requires receipts per pushed SHA regardless. Quick-fix eligibility (`scripts/quick-fix-eligibility.mjs`) caps at 3 files/±30 lines and auto-fails `.svc/*.jsonl` appends (structural-diff pattern `/^[+-]\s*\{/`) and denylists `.github/workflows`. Precedent: additive commits `b8edc870`/`84edb670` carry full envelopes with `retroactive_backfill: true`. → Phase 0 must end with envelope emission; root cause filed as WI-360.
2. **WI-356 numbering collision** — reserved by session-contract (EIT research) but no file existed; capture-idea numbers from INDEX highest+1 → backfill before intake.
3. **W2/WI-359 is the riskiest item**: rewrites the installer of the global enforcement surface with no backup mechanism in `wire-hooks.mjs`; the three `svc-workflow-guard` variants are INTENTIONAL (flag-distinguished) while the `svc-loop-guard` pair is not — naive basename dedup would wrongly collapse the former. → fixture-first, timestamped backup + restore one-liner, dedup key = basename + sorted flag set, idempotency proof, 5-field tier-1 promotion note.
4. **Receipt-automation (WI-363) risk is enforcement hollowing**, not chain breakage: two separate receipt systems exist (chain receipts = git notes; phase receipts = `task-graph.mjs record-phase` into lane-tasks, enforced by Stop hook + validators). Auto-emission is legitimate ONLY for observable evidence (file: after matching Edit; command_output: from exit-0 PostToolUse-Bash); judgment phases stay manual; `phases:` frontmatter untouched; update phase validators in-changeset; handle `skill_receipt`-not-loaded (`task-graph.mjs:668-670`).
5. **WI-361 trigger design**: SessionStart is wrong (no file-scope at t=0); scan-concerns has no prompt-text mode (only `--diff/--staged/--paths`). PostToolUse with `--paths`, memoized per-session injected-set; W2's latency validator polices it. (Tri-model review later strengthened this to dual-trigger Read/Grep/Glob + Edit/Write.)
6. **Sequencing**: registry refresh (WI-357) must run EARLY — every later ceremony resolves reviewer/executor models through `resolve-model.sh`/`resolve-adversarial-reviewer.sh`; a retired pinned ID breaks ceremonies mid-sequence.
7. **Contradiction checks vs repo rules**: zero-hit demotion for tier-1 validators contradicts `rules/tier-1-promotion.md` §Demotion → WI-369 narrowed (rules via evaluate-rule; concerns via telemetry; validators only per the rule's own criteria). `FRAMEWORK-STATE.md` is authenticity-protected at EDIT time (90-min skill-receipt window) even though docs-class at commit time → WI-362 runs under improve-framework session.
8. **Dependency edges added**: 363→359, 365→361, 366→363, 369→361(telemetry), plus W9 absorbs W6's remaining ceremony removal (avoid double-touching 1,000-line files).

## Final recommended ordering (adopted)

357 → 358 → 359 → 360 → 361 → 370 → 362 → 363 → 364 → 365 → 366 → 367/368 (anytime) → 369 (last).
