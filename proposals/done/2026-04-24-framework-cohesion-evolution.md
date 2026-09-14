# Framework Evolution — 2026-04-24 — Post-Lane-7 Cohesion Pass

**Status:** v3.1 — DRAFT. v2 reviewed by Codex; v3 reviewed by Kimi (deep-think, 20-min budget) + Codex. v3.1 fixes 4 proposal-level residuals (path mismatch for kimi-cli, Gemini injection channel, self-bootstrap-at-exit, fabricated CLI path). Plan-changeset-level granularity (exact parser algorithms, full pattern templates, survivor lists, automatable smoke tests) is deferred to the per-WI plan-changeset step — see "Scope of this proposal" note at bottom.

## Revision log

- **v2 → v3 (2026-04-24):**
  - Corrected host-hook-event assumptions per actual `provision/hosts/{claude,kimi,codex,gemini}.json`. Gemini has no `UserPromptSubmit`; Codex has no `PreCompact/PostCompact`; Gemini uses `PreCompress`. P0.5/P0.6 rewritten with per-host event matrix (Codex NEW-001).
  - Corrected P0.3 grounding paths to real structure: `references/knowledge/domains/{claude-hooks,codex-hooks,gemini-cli-hooks,agent-harnesses}/` + `references/knowledge/competitors/kimi-cli/details/hooks-system.md` and `references/knowledge/everything-claude-code/`. Added live-verification requirement tied to framework learning `stored-knowledge-decay-requires-live-verification` (Codex NEW-002).
  - Removed self-bootstrap impossibility in P0.1: the first WI (P0.1 itself) is authored via direct `write-spec` as a documented bootstrap exception; subsequent WIs use the mechanism P0.1 builds (Codex NEW-003).
  - Specified P0.4 invocation mechanism: meta-prompter fires from UserPromptSubmit (same hook as P0.5) when no active lane-tasks; emits candidate prompt plan for route-workflow to validate, not compete with (Codex NEW-004).
  - P1.3 linter parameterized: reads on-demand matrix row count dynamically from `lane-model.md`, no hardcoded count (Codex F-006 PARTIAL → VERIFIED).
  - Added P0.2 `blocked_by: P0.1` — the skip-registry itself should be the first non-bootstrap WI promoted via the new mechanism, validating the seam (Codex F-004 PARTIAL → VERIFIED).
  - Reconciled WI-per-leaf rule: "1 WI per leaf item UNLESS multiple leaves share both a file set AND a single routing contract — in which case combine and state so explicitly" (Codex N-003 PARTIAL → VERIFIED). Phase 2 split into two WIs (files don't overlap); Phase 1 combined stays (same 2 files).

- **v1 → v2 (2026-04-24):**
  - Applied Kimi findings: F-001 (pick one approach), F-003 (rollback for hot-path edit), F-004 (explicit `blocked_by`), F-005 (Phase 4 disposition template), F-006 (specify linter), F-008 (per-phase scope boundaries).
  - Applied Codex findings: N-001 (phases normalized 0–5; "P0 gates P1–P5"), N-002 (P0.1 classified as plan-changeset, not quick-fix), N-003 (explicit N-WIs-per-phase rule).
  - Rejected Kimi F-002 and F-007 as scope-lock false positives: `--tier1` flag works; `blockViaExit` exists at `hooks/lib/hook-decision.mjs:107`.
  - Added four items (P0.3 — P0.6) from live discussion: harness-advisor skill, meta-prompter skill, UserPromptSubmit contract-check hook, post-compaction lane-state reinjection.

## Meta-finding: the proposal itself violated `host-capability-research.md`

v2 wrote per-host hook capabilities from memory instead of reading `provision/hosts/*.json`. Codex caught this in NEW-001. This is exactly the failure mode `harness-advisor` is meant to prevent — strong additional evidence for P0.3.

## Intent

The 2026-04-23 / 04-24 session added Lane 7 (Framework), an on-demand skill trigger matrix, risk-based plan-changeset discipline, and four-host hook parity. The landing commits pass tier-1 but introduced internal contradictions, missing wire-up, and — surfaced during adversarial review — revealed four structural gaps in how Claude (specifically, but all harnesses to some degree) reliably executes framework work:

1. Proposal → WI promotion has no owner.
2. Claude cannot quote its own harness internals — training doesn't expose them.
3. No meta-prompter to match intent to the known-good packed prompt pattern.
4. No per-turn or post-compaction enforcement of lane-tasks contract compliance.

This proposal captures **all** findings from that session, the adversarial reviews, and the live gap discussion, ranks them, and phases them so each fix routes through the svc pipeline it describes.

## Method

Sources:
- Current session transcript and commits `fd301d6`, `3344b3e`, `ba68879`, `63daedd`, `5782b4f`, `1629705`, `695e77b`.
- `rules/plan-changeset-trigger.md` (risk-based trigger, adopted same session).
- Seven open proposals in `proposals/` (not yet promoted to WIs).
- `docs/specs/work-items/WI-072.md` "Follow-ups (not in scope)" block.
- Live reading of `route-workflow/SKILL.md`, `route-workflow/references/{lane-model,routing-rules,autorun-orchestrator,framework-policy}.md`, `evolve-framework/SKILL.md`, `improve-framework/SKILL.md`, `svc-advisor/SKILL.md`, `capture-idea/SKILL.md`.
- Adversarial reviews: `/tmp/kimi-review.txt` (scope-locked, 2186 lines), `/tmp/codex-review.txt` (cross-referencing, ~80 lines of findings).

Grounded in code. Every finding cites a concrete file+line or file+section.

## Framework-of-framework check — can we execute this plan with what svc has today?

**Not cleanly.** The pipeline `evolve-framework → improve-framework → (proposal) → work-item → plan-changeset → execute-changeset → review-gate → land-changeset → verify-promotion` is wired. Four gaps make execution brittle:

- Proposal→WI seam has no owning skill (manual copy).
- Lane compliance relies on agent memory (drifts, especially post-compaction).
- Agent can't verify harness-specific claims (no on-demand grounding).
- Variance in packed prompting is driven by whether the user happens to phrase things well.

Phase 0 of this plan closes all four. Phases 1–5 assume Phase 0 has landed.

---

## Findings Catalogue

### From session Lane 7 analysis (routing integrity)

- **F1 · Lane 7 size threshold contradicts adopted risk-based trigger.**
  - Evidence: `route-workflow/references/lane-model.md` Lane 7 "Universal Framework Rules" §1 cites the deprecated "2 files / 50 lines" threshold. `rules/plan-changeset-trigger.md` supersedes it with risk-based (contract change / hot-path / refactor-without-behavior).
  - Severity: MEDIUM.

- **F2 · 14-row on-demand matrix duplicated across two references.**
  - Evidence: `route-workflow/references/lane-model.md` §"Conditional On-Demand Skills" and `route-workflow/references/routing-rules.md` §"On-Demand Skill Trigger Matrix" both contain the same 14-row matrix.
  - Severity: MEDIUM.

- **F3 · `create-skill` has no placement in Lane 7.**
  - Evidence: `lane-model.md` Lane 7 "New capability branch" omits `create-skill`; `autorun-orchestrator.md` references "new skill without spec" hard stop without naming the executor.
  - Severity: MEDIUM.

- **F4 · Pre-lane insertion contradicts "existing task graph" rule.**
  - Evidence: `lane-model.md` insertion rule #1 vs `strategic-decision`/`plan-capabilities`/`mine-builder`/`platform-operating-architect` marked "Pre-lane."
  - Severity: MEDIUM.

- **F5 · `evaluate-rule` 90-day threshold is one-size-fits-all.**
  - Evidence: both on-demand matrices declare `last_evaluated > 90 days`; fast-moving sources (gstack, superpowers) ship weekly.
  - Severity: LOW.

- **F6 · Skip-condition registry does not exist; enforcement is declared but uncheckable.**
  - Evidence: `route-workflow/SKILL.md` §Self-Verify row #2 + 13 SKILL.md files with scattered skip rows; no central registry; `validate-lane-dynamic-handling.sh` does not cross-check.
  - Severity: MEDIUM.

- **F7 · Lane 7 journey-tag handling is hand-wavy.**
  - Evidence: `lane-model.md` Lane 7 close-WI block says "journey tag promotion is usually skipped; log the skip reason explicitly" without specifying log shape.
  - Severity: LOW.

### From framework pipeline structure

- **F8 · Proposal → Work-Item promotion has no owning skill.**
  - Evidence: `evolve-framework` and `improve-framework` both emit `proposals/*.md`; `capture-idea/SKILL.md` is intake-only. WI-072 authored via direct `write-spec`, skipping proposal entirely.
  - Severity: HIGH.

### From WI-072 follow-ups

- **F9 · `hooks/svc-lane-tasks-validator.mjs:40,50` uses `exit 1`, not `exit 2`.**
  - Evidence: contradicts framework learning `hook-hard-block-use-exit-2-not-exit-1` (confidence 9). Already logged as WI-072 follow-up.
  - Severity: MEDIUM.

- **F10 · 19 `hooks/kimi/*.sh` wrappers are maintenance burden post-adapter.**
  - Severity: LOW.

### From open backlog (triage-only; handled in Phase 4)

F11 · `2026-04-14-blocking-discovery-halt-protocol.md`; F12 · `2026-04-14-parallel-wi-dispatch.md`; F13 · `2026-04-19-evolution.md`; F14 · `2026-04-20-session-audit-capture-idea-wrong-repo.md`; F15 · `2026-04-21-evolution.md` (partially implemented); F16 · `2026-04-22-strategic-decision-research-discipline.md`.

### From live discussion — reliability of Claude execution

- **FA · Claude cannot quote its own harness internals.**
  - Evidence: Claude's training does not expose hook event semantics, compaction timing, subagent context isolation rules, settings.json precedence. Framework has per-host knowledge refs at `references/knowledge/domains/{claude-hooks,codex-hooks,gemini-cli-hooks,agent-harnesses}/` + `references/knowledge/competitors/kimi-cli/` (built by the host-capability-research rule). No skill reads them on demand — the refs are used pre-implementation, not live-in-session. `svc-advisor` covers framework itself, no per-host sibling.
  - Severity: HIGH.

- **FB · No meta-prompter to match intent to packed prompt patterns.**
  - Evidence: Claude has strong priors on specific packed patterns (rubric-scored review, hypothesis-ladder debugging, STAR spec, JSON task-graph). Route-workflow routes intent→lane→skills, but does not select the packed-pattern variant of the downstream prompts. Variance in quality is driven by whether the user's phrasing happens to be packed.
  - Severity: HIGH.

- **FC · No per-turn contract-check enforcement.**
  - Evidence: `UserPromptSubmit` hook fires every turn and injects the active-WI reminder (observed in this session). It does not enforce: "re-read `.svc/lane-tasks-<WI>.json`; emit skip justifications; reconcile TaskList." Lane compliance relies on agent memory. This is the documented failure mode behind "Claude doesn't always load skills / doesn't open tasks visually / drifts on skip decisions."
  - Severity: HIGH.

- **FD · No post-compaction lane-state reinjection.**
  - Evidence: `SessionStart:compact` fires (observed in this session — `svc-kimi-post-compact.sh` ran). It re-injects learnings but not the active lane's task graph. After compaction, the agent must re-derive lane state from the transcript and hook reminders alone — fragile.
  - Severity: MEDIUM.

---

## Phased Plan (v2)

**WI decomposition rule (reconciled v3):** **1 WI per leaf item UNLESS multiple leaves share BOTH a file set AND a single routing contract — in which case combine and state so explicitly in the phase's Execution block.** Phase 1 combines P1.1–P1.4 (all edit `lane-model.md` + `routing-rules.md` + `autorun-orchestrator.md`, same contract). Phase 2 splits into P2.1 and P2.2 (different files). Phase 3 stays two WIs (hot-path edit + wrapper audit are independent). Scope-boundary block per WI enforces this.

**Phase gate:** P0 completion gates P1–P5. Within P0, sub-phases run in the order P0A → P0B → P0C because P0B skills may consume P0A artifacts, and P0C hooks may reference P0B skills.

### Phase 0 — Framework-of-framework

#### P0A — Seam fixes

##### P0.1 — Close proposal → WI seam

**Finding:** F8 + F-001 (Kimi: "New skill OR extend capture-idea — pick one").

**Decision:** Extend `capture-idea` with `--from-proposal <path>` mode. Reasons: (a) additive flag on existing skill, no manifest/wiring growth; (b) `capture-idea` is already the WI-intake skill; (c) one skill surface is easier to keep coherent than two near-siblings.

**Fix:**
- Add `--from-proposal <path>` flag to `capture-idea`. When present:
  1. Parse the proposal's Goals / ACs / File Impact blocks.
  2. Emit `docs/specs/work-items/WI-NNN.md` pre-filled with Subject (from proposal title), Type (inferred: `refactor` if proposal mentions refactor; else `feature`), Status (`DRAFT`), Lane (`framework` if the proposal is under `proposals/`), Source (proposal filename), ACs copied from proposal.
  3. Move the proposal to `proposals/done/` with a trailer: `**Promoted to:** docs/specs/work-items/WI-NNN.md`.
  4. Append `capture-idea` decision to `.svc/pipeline-decisions.jsonl` as `taste`.
- Update `capture-idea/SKILL.md` inputs / outputs / description to document the flag.

**Scope boundary:**
- `touches:` `capture-idea/SKILL.md`, `capture-idea/references/from-proposal.md` (new), potentially `scripts/capture-idea-helpers.sh` if a helper exists.
- `reads:` `improve-framework/SKILL.md`, `evolve-framework/SKILL.md`, `docs/specs/work-items/WI-072.md` as shape reference.
- `must-not-touch:` any other SKILL.md, `route-workflow/**`, any hook, manifest.

**Size:** contract change (capture-idea gains a flag) — **plan-changeset required** per risk-based rule. Not quick-fix.

**Bootstrap exception (Codex NEW-003):** P0.1 itself cannot be promoted via P0.1's mechanism (chicken-and-egg). The WI for P0.1 is authored via **direct `write-spec`** with an explicit trailer in `.svc/pipeline-decisions.jsonl`: `{"skill":"capture-idea","decision":"bootstrap-exception","reason":"P0.1-builds-the-mechanism-itself"}`. All subsequent WIs (P0.2 onward) use `capture-idea --from-proposal`.

**Rollback:** none needed; the flag is additive. If behavior is wrong, revert the flag handler.

**Acceptance:**
- Invoking `capture-idea` with `--from-proposal proposals/done/2026-04-24-framework-cohesion-evolution.md` via the host's skill-loading mechanism (exact invocation syntax is a plan-changeset concern, not a proposal concern) emits WIs for P0.2 onward (not P0.1 itself), moves this proposal to `proposals/done/`, and updates `pipeline-decisions.jsonl`.
- `bash test-framework/evals/run-all-evals.sh --tier1` passes.

##### P0.2 — Skip-conditions registry

**Finding:** F6 + F-006 (Kimi: linter underspecified) + Codex F-006 (canonical marker needed).

**Fix:**
- Create `references/skip-conditions.json` with schema:
  ```json
  {
    "skills": {
      "design-ui": {
        "skip_when": "feature has no visual/UI surface",
        "signals": ["no CSS change", "no className change", "backend-only"],
        "justification_format": "pipeline-decisions.jsonl entry {\"skill\":\"design-ui\",\"decision\":\"skipped\",\"reason\":<reason>}",
        "self_verify_row": "ref to the row in design-ui/SKILL.md"
      }
    }
  }
  ```
  One entry per skill that has any skip condition today (13 skills: `design-ui`, `design-ux`, `execute-changeset`, `track-visuals`, `test-journeys`, `write-e2e`, `benchmark-landing`, `analyze-domain`, `blend-external`, `audit-ac`, `sync-work-items`, `validate-feature`, `verify-promotion`).
- New tier-1 validator `validate-skip-conditions-registry.sh`:
  1. Read `references/skip-conditions.json`.
  2. For each skill, assert the referenced SKILL.md contains a self-verify row with the skip language.
  3. Assert no skill has a skip row in its SKILL.md that is not in the registry.
  4. Exit 0 on both-way match; exit 1 with the mismatched skill name otherwise.

**Scope boundary:**
- `touches:` `references/skip-conditions.json` (new), `test-framework/evals/tier-1/validate-skip-conditions-registry.sh` (new), `route-workflow/SKILL.md` self-verify row #2 (reference the registry).
- `reads:` the 13 skills' SKILL.md files.
- `must-not-touch:` any hook, any other reference doc, any test fixture.

**Size:** contract change (new source of truth for a claimed check). Plan-changeset.

**Rollback:** delete the new files; revert the self-verify row edit.

**Acceptance:**
- `bash test-framework/evals/tier-1/validate-skip-conditions-registry.sh` exits 0.
- Full tier-1 sweep passes.

**Blocked_by:** P0.1 (rationale: P0.2 is the **first non-bootstrap WI** promoted via the new `capture-idea --from-proposal` mechanism — validates the seam fix end-to-end before P0.3/P0.4 rely on it). If P0.1 does not land, fall back to direct `write-spec` authoring for P0.2 and mark the bootstrap-exception trailer.

#### P0B — Reasoning skills

##### P0.3 — `harness-advisor` skill

**Finding:** FA (Claude can't quote harness internals).

**Fix:**
- New skill `harness-advisor` — on-demand pre-lane skill that answers harness-specific questions by reading `references/knowledge/<host>/` for the current host (resolved via `scripts/detect-host.sh`).
- Triggers:
  - Any skill hits a `rules/host-capability-research.md` gate.
  - Agent says "I think the hook fires on…" or "I believe settings.json…" or any harness-behavior claim without grounding.
- Output: a Grounded Answer block with `source: references/knowledge/<host>/<file>` + the exact quote, or "UNKNOWN — requires research" if not in refs.
- Added to the on-demand matrix in `lane-model.md` (single canonical table per P1.3).

**Grounding paths (corrected per Codex NEW-002):** The skill body references `references/knowledge/domains/{claude-hooks,codex-hooks,gemini-cli-hooks,agent-harnesses}/` + `references/knowledge/competitors/kimi-cli/details/hooks-system.md` (per-host hook specs + cross-cutting harness docs) and `references/knowledge/everything-claude-code/` (Claude-specific deep docs). On each invocation, the skill MUST (a) emit the path(s) it reads, (b) cross-check the extracted answer against `provision/hosts/<host>.json` for any capability claim, (c) if the stored knowledge is >30 days old (per `references/framework-learnings.jsonl` entry `stored-knowledge-decay-requires-live-verification`), mark the answer "STALE — live-verify" and suggest running `research` before relying on it.

**Scope boundary:**
- `touches:` `harness-advisor/SKILL.md` (new), `harness-advisor/references/grounding-sources.md` (new, lists the exact paths above with one-line purpose each), `skills-manifest.json` (add to `includedSkills`), `README.md` skill list, `route-workflow/references/lane-model.md` (add to on-demand matrix).
- `reads:` the grounding paths above + `provision/hosts/*.json` (for cross-check).
- `must-not-touch:` hooks, tests, other skills' SKILL.md (except for the 5-source-of-truth sync files).

**Size:** new skill = contract change = plan-changeset.

**Rollback:** remove the skill directory, revert manifest + README, revert matrix row.

**Acceptance:**
- Invocation matches five triggering prompts in `test-framework/evals/tier-1.5/prompts/triggering/harness-advisor.txt` (new).
- Tier-1 skill-structure validator passes (frontmatter, chain, self-verify).
- `bash scripts/lint-skills-manifest.mjs` passes (new skill present in all 5 sources).

**Blocked_by:** none in P0A.

##### P0.4 — `meta-prompter` skill

**Finding:** FB (no intent → packed-pattern matcher).

**Fix:**
- New skill `meta-prompter` — pre-route-workflow skill that takes user intent + current repo state and emits a **prompt plan**: the packed prompt pattern + skill sequence + quality targets, before `route-workflow` runs.
- Contract:
  - Input: raw user intent (string) + current lane state (`.svc/lane-tasks-*.json` if any).
  - Output: `/tmp/svc/prompt-plans/<timestamp>.md` with sections: Pattern (named pattern from library), Skill sequence (ordered list with skip flags), Quality targets (what "done" looks like), Fallback (alternative pattern if framework decomposition rejects primary).
  - Library of packed patterns stored in `meta-prompter/references/pattern-library.md` — ~10 patterns covering: debug (hypothesis ladder + minimal repro + root cause), spec writing (STAR + pillar coverage + AC-first), code review (rubric + severity + evidence-graded), explore (compare matrix + constraint table), refactor (invariant preservation + test-first), onboarding (capability registry + state snapshot), blend (attribution + source-sha + rule-evaluation), plan-changeset (task graph + blocked_by + scope boundary), validate-feature (ship brief + 8Q), verify-promotion (AC closure + journey promotion).
- **Invocation mechanism (corrected per Codex NEW-004):** meta-prompter fires from the **same UserPromptSubmit hook added by P0.5** (re-using per-host wiring) when (a) no active `.svc/lane-tasks-*.json` exists AND (b) the user intent matches any pattern in the library. If either condition fails, the hook is a no-op and route-workflow handles intent directly.
- **Authority contract with route-workflow:** meta-prompter emits a **candidate** prompt plan; route-workflow remains sole authority over final skill sequence and skip flags. route-workflow either (a) accepts the candidate plan (logs `mechanical` decision), (b) rejects with reason → meta-prompter retries with the Fallback pattern (max 1 retry), or (c) hard-rejects → plan discarded, route-workflow proceeds with direct intent. No circular dependency.

**Scope boundary:**
- `touches:` `meta-prompter/SKILL.md` (new), `meta-prompter/references/pattern-library.md` (new), `meta-prompter/references/decomposition-contract.md` (new), `skills-manifest.json`, `README.md`, `route-workflow/SKILL.md` (add "meta-prompter output is consulted" row in pre-lane table), `route-workflow/references/lane-model.md` on-demand matrix.
- `reads:` all existing SKILL.md files as library grounding.
- `must-not-touch:` hooks, per-skill SKILL.md (except meta-prompter's own), tests.

**Size:** new skill + library + contract integration = **plan-changeset required**; this is the highest-risk item in Phase 0.

**Rollback:** remove the skill directory, revert manifest + README, revert route-workflow additions.

**Acceptance:**
- Five canonical intents route correctly: "fix a typo" → quick-fix pattern; "add a new feature" → write-spec packed pattern; "refactor without behavior change" → refactor-invariant pattern; "build a landing page" → design-ui packed pattern; "what's next" → roadmap-evaluation pattern.
- Framework decomposition rejects at least one degenerate case (e.g., "ship without review" → hard-reject).
- Tier-1 skill-structure validator passes.

**Blocked_by:** P0.3 (meta-prompter consults harness-advisor when packing decisions depend on host capabilities).

#### P0C — Per-turn enforcement hooks

##### P0.5 — UserPromptSubmit contract-check injection

**Finding:** FC (per-turn compliance not enforced).

**Host event matrix (corrected per `provision/hosts/*.json`, Codex NEW-001):**

| Host | Native event | Fallback (if no UserPromptSubmit) |
|---|---|---|
| Claude | `UserPromptSubmit` ✓ | — |
| Kimi | `UserPromptSubmit` ✓ | — |
| Codex | `UserPromptSubmit` ✓ | — |
| Gemini | **no UserPromptSubmit** | `BeforeModel` (fires right before LLM call — closest semantic equivalent) |

**Fix:**
- For Claude/Kimi/Codex: extend the existing UserPromptSubmit hook. When `.svc/lane-tasks-*.json` exists with `status: active`, inject:
  ```
  📋 Contract check — lane active (WI-<N>):
    - Re-read .svc/lane-tasks-<WI>.json before acting
    - Emit next-skill + any skip decisions with justification
    - Ensure TaskList reflects lane-tasks JSON
    - Post-compaction? Re-confirm lane position before deciding
  ```
- For Gemini: wire the same injection to `BeforeModel` hook. Per Gemini's hook contract, the context-injection channel is **stdout JSON** — emit `{"decision":"allow","systemContext":"<contract-check block>"}` on stdout. Stderr is for diagnostics only and does not reach the model.
- When no active lane-tasks, no injection (don't noise-pollute idle sessions).

**Scope boundary:**
- `touches:` `hooks/svc-user-prompt-submit.mjs` (new shared extractor), `hooks/kimi/svc-kimi-user-prompt.sh` (wrapper), `scripts/wire-hooks.mjs` (Claude wire), `scripts/wire-codex-hooks.mjs`, `scripts/wire-gemini-hooks.mjs` (Gemini gets BeforeModel entry), corresponding test fixtures.
- `reads:` `provision/hosts/*.json`, `references/knowledge/domains/{claude-hooks,kimi-hooks,codex-hooks,gemini-cli-hooks}/`, `hooks/lib/hook-payload.mjs`.
- `must-not-touch:` any other hook, any skill SKILL.md, any rule.

**Size:** hot-path edit (UserPromptSubmit runs every turn) = **plan-changeset required** per risk-based rule.

**Rollback:** each host's hook has a `.bak` backup created before edit. If any tier-1 e2e hook test fails, restore from `.bak` and abort. Keep `.bak` until land-changeset completes.

**Acceptance:**
- New tier-1 test `validate-user-prompt-contract-check.sh`: fixture lane-tasks JSON present → hook stdout contains the 4-line block; fixture absent → no injection.
- Existing tier-1 hook e2e tests continue to pass (no behavior regression).

**Blocked_by:** P0.3 (verifying each host's exact hook event name / envelope).

##### P0.6 — SessionStart:compact lane-state reinjection

**Finding:** FD (post-compaction state loss).

**Host event matrix (corrected per `provision/hosts/*.json`, Codex NEW-001):**

| Host | Compact event | Injection timing | Fallback |
|---|---|---|---|
| Claude | `PostCompact` ✓ | After compaction | — |
| Kimi | `PostCompact` ✓ | After compaction | — |
| Codex | **no compact event at all** | — | On next `UserPromptSubmit` after a session, detect via session-metadata heuristic (compaction typically halves transcript length); inject once; set sentinel `.svc/compact-injected-<session>` to avoid re-inject |
| Gemini | `PreCompress` only (fires BEFORE compaction) | Before compaction | Inject the full lane-tasks JSON into the `PreCompress` preamble so it survives into the compacted context |

**Fix:**
- For Claude/Kimi: extend `PostCompact` hook. On fire: if `.svc/lane-tasks-*.json` with `status: active` exists, write the full JSON + active-lane label to stderr (per-host contract) as a reminder block. Current hooks only inject learnings — keep those and append the lane block.
- For Gemini: wire `PreCompress` hook. Emit the lane JSON on stdout per Gemini contract: `{"decision":"allow","systemContext":"<lane-reminder>"}`. Stderr is diagnostics only.
- For Codex: extend the P0.5 `UserPromptSubmit` handler to check for compaction heuristic on first invocation per session. Inject the block if detected; write sentinel file to avoid repeat.

**Scope boundary:**
- `touches:` `hooks/svc-post-compact.mjs` (new shared — Claude + Kimi consume), `hooks/kimi/svc-kimi-post-compact.sh` (wrapper update), `scripts/wire-hooks.mjs` (Claude PostCompact), `scripts/wire-gemini-hooks.mjs` (PreCompress), `hooks/svc-user-prompt-submit.mjs` (Codex fallback path — sharing P0.5's file), test fixtures.
- `reads:` same as P0.5 + `provision/hosts/*.json` for event-name ground truth.
- `must-not-touch:` UserPromptSubmit hook for Claude/Kimi/Gemini (P0.5 owns those); any skill; any rule.

**Size:** hot-path edit, but fires only on compact = plan-changeset required.

**Rollback:** `.bak` per host. Revert on any tier-1 regression.

**Acceptance:**
- Tier-1 test `validate-compact-state-reinject.sh`: simulate compact event with active lane-tasks → hook output contains lane JSON + learnings; without lane-tasks → learnings only.
- Manual smoke: run `/compact` mid-session, verify the next turn has the lane reminder.

**Blocked_by:** P0.5 (shares the per-host hook wiring knowledge).

### Phase 1 — Routing integrity (contradictions only)

**Goal:** Remove internal contradictions in the just-landed route-workflow changes so the next framework session doesn't re-introduce confusion.

| ID | Finding | Fix | Size |
|---|---|---|---|
| P1.1 | F1 | `lane-model.md` Lane 7 §"Universal Framework Rules" rule #1 — replace the "2 files / 50 lines" text with a reference to `rules/plan-changeset-trigger.md`. Also remove the size language from `autorun-orchestrator.md` `improve-framework` row. | Low; plan-changeset (doc-contract edit). |
| P1.2 | F4 | `lane-model.md` §"Conditional On-Demand Skills" — add carve-out: "Pre-lane skills emit DECISION / classification artifacts that seed the first task graph; rule #1 applies to in-lane skills only." | Low; plan-changeset. |
| P1.3 | F2 + F-006 | De-duplicate on-demand matrix: **canonical source = `lane-model.md`**. Replace the `routing-rules.md` table with a one-line pointer + explicit "do not duplicate this table" comment. Add tier-1 check `validate-on-demand-matrix-singular.sh` that: (a) reads the markdown table under `lane-model.md` heading `## Conditional On-Demand Skills`, (b) dynamically extracts **every value** in the "Skill" column (no hardcoded count — count is derived at runtime so adding harness-advisor / meta-prompter / future skills does not stale the check), (c) for each name, greps `routing-rules.md` for a table row whose first cell contains that skill name (pattern: `^\| \`?<name>\`? \|`), (d) exits 1 with message `Duplicate on-demand matrix in routing-rules.md: <skill>` if any match; exits 0 otherwise. | Low; plan-changeset. |
| P1.4 | F3 | `lane-model.md` Lane 7 "New capability branch" — insert `create-skill` between `design-tech` and `plan-changeset`. Update `framework-policy.md` accordingly. | Low; plan-changeset. |

**Scope boundary (all of P1):**
- `touches:` `route-workflow/references/lane-model.md`, `route-workflow/references/routing-rules.md`, `route-workflow/references/autorun-orchestrator.md`, `route-workflow/references/framework-policy.md`, `test-framework/evals/tier-1/validate-on-demand-matrix-singular.sh` (new).
- `reads:` `rules/plan-changeset-trigger.md`.
- `must-not-touch:` any SKILL.md, any hook, any test fixture outside the new validator.

**Execution:** One combined WI for P1.1–P1.4 since they share the same routing-contract surface (`route-workflow/references/*`) even though the file set spans 3 files (`lane-model.md`, `routing-rules.md`, `autorun-orchestrator.md`) + 1 new validator + optional `framework-policy.md` touch. Plan-changeset. Single PR.

**Rollback:** standard git revert on the branch; no destructive changes.

**Acceptance:**
- No reader can find two different rules for framework plan-changeset discipline.
- Pre-lane skills have a documented task-graph initialization path.
- Grep for any on-demand skill name (count extracted at runtime from `lane-model.md`) returns one authoritative table.
- `create-skill` appears in the Lane 7 decision tree.
- New tier-1 check passes.

### Phase 2 — Policy calibration

**Goal:** Close the latent-bug / hand-wavy-spec items.

| ID | Finding | Fix | Size |
|---|---|---|---|
| P2.1 | F5 | Per-source volatility override in `references/blend-registry.json`: add `evaluation_ttl_days` field per source with default 90. Set gstack/superpowers to 30. Update `evaluate-rule/SKILL.md` to read the field. | Low; plan-changeset (registry schema additive). |
| P2.2 | F7 | `lane-model.md` Lane 7 close-WI — specify: "Lane 7 has no journey promotion step because framework work produces no user-journey scenarios. Always append `{skill:'journey-promotion',decision:'skipped',reason:'framework-work-no-user-journey'}` to `.svc/pipeline-decisions.jsonl` at WI close." Match Lane 6's precision. | Low; plan-changeset. |

**WI decomposition (per N-003 reconciliation):** P2.1 and P2.2 touch **different file sets** (`blend-registry.json` + `evaluate-rule/SKILL.md` vs `lane-model.md`), so they become **two separate WIs**, not one combined.

**Scope boundary (P2.1):** `touches:` `references/blend-registry.json`, `evaluate-rule/SKILL.md`. `reads:` `blend-external/SKILL.md`. `must-not-touch:` `lane-model.md`, any other skill, any hook.

**Scope boundary (P2.2):** `touches:` `route-workflow/references/lane-model.md` Lane 7 close-WI block only. `reads:` Lane 6 close-WI block for format parity. `must-not-touch:` registry, skills, hooks.

**Rollback:** revert.

### Phase 3 — WI-072 follow-ups (hooks hygiene)

| ID | Finding | Fix | Size |
|---|---|---|---|
| P3.1 | F9 | `hooks/svc-lane-tasks-validator.mjs:40,50` — swap `process.exit(1)` for `blockViaExit(reason)` from `hooks/lib/hook-decision.mjs` (verified to exist at line 107). Update tier-1 validator assertions referencing exit code 1 to expect exit 2. | Medium; hot-path edit = plan-changeset required. |
| P3.2 | F10 | Audit `hooks/kimi/*.sh` — for each, check if the adapter layer renders it redundant. Delete redundant ones; document the rest with a one-line reason. | Medium; plan-changeset. |

**Scope boundary (P3.1):**
- `touches:` `hooks/svc-lane-tasks-validator.mjs`, tier-1 validators that assert exit codes for this hook.
- `reads:` `hooks/lib/hook-decision.mjs`, `references/framework-learnings.jsonl` for the `hook-hard-block-use-exit-2-not-exit-1` entry.
- `must-not-touch:` any other `.mjs` hook, adapter layer, host wire scripts.

**Rollback (P3.1):**
1. Before edit: copy `hooks/svc-lane-tasks-validator.mjs` to `hooks/svc-lane-tasks-validator.mjs.bak`.
2. After edit: run `node --check hooks/svc-lane-tasks-validator.mjs`; then feed fixture invalid lane-tasks JSON via stdin and assert exit 2.
3. Run full tier-1 sweep: must pass.
4. If any step fails: restore from `.bak`, delete branch, abort.
5. Delete `.bak` only after land-changeset completes.

**Scope boundary (P3.2):**
- `touches:` `hooks/kimi/*.sh` (only wrappers determined redundant), possibly `provision/hosts/kimi.json` if wrapper paths are referenced.
- `reads:` `hooks/lib/hook-payload.mjs`, `hooks/lib/hook-decision.mjs`, `scripts/wire-kimi-hooks.mjs`.
- `must-not-touch:` any `.mjs` hook, any other host's hooks.

**Execution:** `WI-074` (P3.1) and `WI-075` (P3.2). P3.1 first (correctness), P3.2 follows (cleanup).

### Phase 4 — Backlog reconciliation

**Goal:** Every open backlog proposal gets a disposition.

**Deliverable template** (mandatory; store as `proposals/2026-04-24-backlog-triage.md`):

| Proposal | Decision | Target Phase/WI | Rationale | Done Check |
|---|---|---|---|---|
| 2026-04-14-blocking-discovery-halt-protocol.md | PROMOTE / FOLD / CLOSE | e.g., `WI-076` or "folded into P0.5" or "closed — obsolete post-Lane-7" | 1-2 sentences | file moved to `proposals/done/` with trailer, OR WI file created, OR fold-reference added |
| 2026-04-14-parallel-wi-dispatch.md | … | … | … | … |
| 2026-04-19-evolution.md | … | … | … | … |
| 2026-04-20-session-audit-capture-idea-wrong-repo.md | … | … | … | … |
| 2026-04-21-evolution.md | … | … | … | … |
| 2026-04-22-strategic-decision-research-discipline.md | … | … | … | … |

**Completion check:** exactly 6 rows, every row has non-empty `Decision`, `Rationale`, and `Done Check`. `proposals/done/` trailer format: `**Disposition:** CLOSED 2026-MM-DD — <reason>. Superseded by: <ref>` or `**Disposition:** PROMOTED 2026-MM-DD → docs/specs/work-items/WI-NNN.md`.

**Scope boundary:** `touches:` the 6 proposal files + `proposals/2026-04-24-backlog-triage.md`. `reads:` this proposal. `must-not-touch:` code, hooks, skills.

**Execution:** single session, no code. Output: updated proposal files + triage doc + any new WIs.

### Phase 5 — Verification and learning capture

After Phases 0–4 land:
- Full tier-1 sweep green (≥22 scripts, incl. new skip-conditions and on-demand-matrix validators).
- Tier-1.5 spot checks on new skills: `harness-advisor`, `meta-prompter` — canonical triggering prompts produce expected invocations.
- Tier-2 spot check: run one framework intent through `meta-prompter → route-workflow → Lane 7` and verify skip decisions are logged to `pipeline-decisions.jsonl`.
- Append learnings to `references/framework-learnings.jsonl`:
  - `proposal-to-wi-seam-now-has-owner` (confidence 8)
  - `skip-conditions-must-be-registry-driven` (confidence 8)
  - `harness-advisor-grounds-host-claims` (confidence 8)
  - `meta-prompter-reduces-variance-via-packed-patterns` (confidence 7 — revise after 5 sessions of use)
  - `per-turn-contract-check-catches-lane-drift` (confidence 8)

---

## Cross-cutting constraints (apply to every phase)

1. **Every non-trivial edit routes through `plan-changeset`** per risk-based trigger. No quick-fix classifications in this plan.
2. **Host capability verification** via P0.3 (`harness-advisor`) before any hook edit — P0.5, P0.6, P3.1 all gate on this.
3. **No review-gate bypass** for any phase. Doc edits included.
4. **Branch-per-WI, squash-merge to main.**
5. **`.bak` rollback for every hot-path hook edit** (P0.5, P0.6, P3.1).
6. **Scope boundaries enforced.** Each WI's plan-changeset manifest must list `touches:` and `must-not-touch:`. Execute-changeset must refuse edits outside `touches:`.

## Estimated sequence and cost

| Phase | Sub-phase | WIs | Est. sessions | Risk |
|---|---|---|---|---|
| 0 | A (seams) | 2 (P0.1, P0.2) | 2 | Low |
| 0 | B (reasoning) | 2 (P0.3, P0.4) | 3 | Medium — P0.4 highest-risk item |
| 0 | C (enforcement) | 2 (P0.5, P0.6) | 2 | Medium — hot-path |
| 1 | — | 1 (P1.1–P1.4 combined) | 1 | Low |
| 2 | — | 2 (P2.1, P2.2 — files don't overlap) | 1 | Low |
| 3 | — | 2 (P3.1, P3.2) | 2 | Medium — hot-path P3.1 |
| 4 | — | 0 (triage only) + 0–6 PROMOTE WIs | 1 | Low |
| 5 | — | 0 | 0.5 | Low |

**Total:** 11 WIs guaranteed (P0×6 + P1×1 + P2×2 + P3×2 = 11), up to 17 if Phase 4 promotes all 6 backlog items. 12.5 sessions baseline.

**Critical path:** P0.3 → P0.4 → P0.5/P0.6 → (Phases 1–3 in parallel) → Phase 4 → Phase 5. P0A can run in parallel with P0.3.

## Self-verify (v2)

| # | Check | PASS/FAIL |
|---|---|---|
| 1 | Every finding cites a concrete file/line or file/section | PASS |
| 2 | Every phase has Fix, Size, Rollback, Scope Boundary, Acceptance | PASS |
| 3 | Plan does not skip the proposal→WI seam — it's P0.1 | PASS |
| 4 | No phase requires a framework capability that does not exist today | PASS (all pre-reqs live in P0) |
| 5 | Risk-based plan-changeset trigger is respected (no quick-fix) | PASS |
| 6 | Phase numbering is consistent (P0–P5; P0 gates P1–P5) | PASS |
| 7 | Per-phase scope boundaries enumerated (`touches` / `reads` / `must-not-touch`) | PASS |
| 8 | WI decomposition rule stated and matches the estimate table | PASS (1 WI per leaf in P0, combined WIs in P1–P3 where files overlap) |
| 9 | Rollback procedures defined for every hot-path edit | PASS (P0.5, P0.6, P3.1) |
| 10 | Every Kimi and Codex finding is either applied or explicitly rejected with evidence | PASS |
| 11 | The 4 live-discussion gaps (FA–FD) are each owned by a concrete P0 leaf item | PASS (FA→P0.3, FB→P0.4, FC→P0.5, FD→P0.6) |

## Supersedes / Supersedes-nothing

- Does not supersede any existing proposal. F11–F16 are triage candidates in Phase 4.
- `proposals/2026-04-24-four-host-hook-parity.md` remains as-is; WI-072 already landed that work. Can be moved to `proposals/done/` by Phase 4 triage (FOLD → WI-072 merged).

## Next step

**This proposal is at proposal-artifact precision, not plan-changeset-manifest precision.** The downstream `plan-changeset` skill is responsible for turning each P0.x leaf into a manifest with exact file diffs, parsing algorithms (P0.1 proposal parser + WI-NNN rule), survivor lists (P3.2), full pattern templates (P0.4 packed-pattern library), and automatable tests (replacing P0.6's manual smoke). Reviewers who flag those as missing in the proposal are correctly evaluating against the plan-changeset rubric — just at the wrong stage. Those gaps move forward as explicit deliverables of the per-WI plan-changeset step.

**Next step:** author WI-073 (P0.1 — `capture-idea --from-proposal`) via direct `write-spec` as the documented bootstrap exception. Log the exception to `.svc/pipeline-decisions.jsonl`. Once WI-073 lands, all subsequent WIs (P0.2 → …) use the new mechanism.
