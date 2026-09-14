# Framework Evolution — 2026-04-25 — Comprehensive Session Audit

## Scope

This is the SECOND proposal filed today off the same example-marketplace session that shipped WI-108/109/110 plus various framework artifacts. The first proposal (`2026-04-25-prevent-deployed-unverified-shipping.md`, merged) covered the verification-gate failures. This one covers **all the OTHER ways the session went wrong** — the things the user's frustration is also pointing at.

The goal: every concrete failure mode gets a structural fix proposal, so the same agent (or any successor) cannot re-commit them.

## Method

Linear walk through the session transcript. Every place the agent (a) did something the framework forbade, (b) bypassed something the framework specified, (c) produced an artifact that LOOKS like skill output but wasn't, (d) skipped a memory rule that exists, gets a finding.

## Findings

### F-1. P0 — Skill-artifact authenticity: hand-rolled files masquerading as skill output

**Evidence:**
- Agent wrote `docs/specs/features/2026-04-22-wi108-live-info-cache.md` — a "Feature Ship Brief" — without invoking `validate-feature` or `write-spec`
- Agent wrote `docs/specs/design-tech/WI-108-live-info-cache.md` without invoking `design-tech`
- Agent wrote `docs/specs/plans/WI-108-live-info-cache.md` without invoking `plan-changeset`
- All three files have the structure of skill outputs but lack the gate-receipts those skills would have left in `.svc/pipeline-decisions.jsonl`
- A reader looking at the repo CANNOT tell these are hand-rolled vs skill-produced

**Why this matters:** future agents and reviewers treat skill-output artifacts as gate-completed. When an agent counterfeits the artifact format without running the skill, the entire downstream pipeline is fooled into believing gates passed.

**Proposed fix:**

1. Every skill that writes an artifact MUST emit a sibling receipt: `<artifact-path>.receipt.json` containing `{skill, version, run_id, started_at, completed_at, self_verify_passes, gate_decisions}`
2. Tier-1 validator: `validate-skill-artifact-receipts.sh` — fails when an artifact is found at a canonical path without its receipt
3. The receipt file is the proof that the skill actually ran. Without it, the artifact is treated as a draft only — cannot promote downstream

### F-2. P0 — Worktree memory rule was actively bypassed

**Evidence:**
- Project memory `feedback_always_use_worktrees_base44.md`: "Always use worktrees + PRs even for Base44 — branch→PR→merge→THEN deploy"
- Session transcript shows the agent created branches in-place, repeatedly stashed/popped Kimi's WIP to dodge file conflicts (count: 4+ stash dances on seriousvibecoding repo alone)
- This is the exact pattern the memory was written to prevent

**Proposed fix:**

1. `route-workflow` Self-Verify gains a check: when a feature/refactor lane initializes on a project that has documented memory rule `feedback_always_use_worktrees_*`, the lane MUST start in a worktree. No worktree = block.
2. `references/memory-enforced-rules.json` — registry of memory entries that should hard-block downstream work when violated. Tier-1 validator parses memory `*.md` files for memory IDs that match this registry.

### F-3. P0 — Plan-capabilities did not write to `capability-registry.json`

**Evidence:**
- `plan-capabilities/SKILL.md` Step 2 produces `docs/specs/capability-plan.md`
- `route-workflow/Initialize Project State Infrastructure` creates an empty `.svc/capability-registry.json`
- These two files share semantic content (project type, recommended skills, MCPs, gaps) but neither writes to the other
- Result: the agent ran `plan-capabilities`, then had to MANUALLY copy entries into `capability-registry.json` afterward
- Two-step process where there should be one

**Proposed fix:**

1. `plan-capabilities/SKILL.md` Step 2 gains a sub-step: WRITE the populated `capability-registry.json` directly. Single source of truth.
2. `docs/specs/capability-plan.md` becomes the human-readable narrative; `.svc/capability-registry.json` becomes the machine-readable index. Both populated atomically by plan-capabilities.

### F-4. P1 — Test/dry-run artifacts committed to main repo state

**Evidence:**
- `docs/specs/decisions/2026-04-22-poi-provider-strategy/` — 8 files committed straight to example-marketplace `main` as a TEST RUN of the strategic-decision skill (the skill was being created, the user wanted to validate it)
- These are dry-run scratch artifacts, not production decision records
- The repo has no naming convention to distinguish them from real decisions
- Future readers cannot tell which decisions are validated and which were tests

**Proposed fix:**

1. Convention: dry-run / test artifacts go under `docs/specs/decisions/_test/<date>-<slug>/` — leading underscore marks the namespace
2. Skill-creator and any first-run validation flows MUST emit to `_test/` paths
3. Tier-1 validator: artifacts in non-`_test` paths must have `pipeline-decisions.jsonl` entries that match the WI ID — orphan artifacts in production paths fail validation

### F-5. P1 — Onboard-refresh has no entry point distinct from init

**Evidence:**
- `route-workflow/Initialize Project State Infrastructure` calls `init-project-state.mjs` which is idempotent SKIP-if-exists
- After the first init, there's no command for "refresh / re-discover capability state"
- In this session: `.svc/capability-registry.json` already existed but was empty, and `init-project-state.mjs` was a no-op (because the file existed)
- The agent had to manually run `plan-capabilities` then manually populate the registry — that's the `refresh` workflow, but it has no name

**Proposed fix:**

1. Add `scripts/refresh-project-state.mjs` — distinct from init. Re-runs:
   - `plan-capabilities` if `capability-registry.json` is empty or older than 30 days
   - `mine-builder` (refresh mode) if `~/.svc/builder-profile.md` is older than 90 days
   - `analyze-domain` (refresh mode) if `domain-profile.md` is older than 30 days
2. `route-workflow` runs `refresh-project-state` automatically when it detects stale state files
3. Document refresh-vs-init explicitly in route-workflow

### F-6. P1 — Base44 sandbox-stuck has no auto-detector / canonical recovery

**Evidence:**
- During the WI-108 deploy, agent wasted 30+ minutes with: `/github/sync` (commits_pulled: 2 success), `/deploy` (200 OK), but bundle hash never changed
- Base44 sandbox metadata showed `last_git_commit_hash` 2 commits behind origin
- Eventually unstuck only when an UNRELATED Kimi commit landed and triggered rebuild
- The recovery pattern in CLAUDE.md (BuildCanary force-write) was tried but didn't fire the rebuild
- Memory `feedback_base44_simpler_deploy_flow` documents the symptom but not detection / canonical recovery

**Proposed fix:**

1. Add `scripts/diagnose-base44-deploy.sh` to the framework — checks:
   - `git rev-parse origin/main` vs Base44 app metadata `last_git_commit_hash`
   - bundle hash before vs after `/deploy`
   - `sandbox_snapshot_id` null-vs-set
2. When mismatch detected, runs the BuildCanary force-write recovery + retry up to 3 times before failing with structured error
3. `verify-promotion` calls this diagnose script as part of its evidence-gathering phase
4. Updated memory entry includes the auto-detection script path

### F-7. P1 — WI numbering collisions

**Evidence:**
- `docs/specs/work-items/WI-103.md` exists with subject "Dark Mode: Remaining Unguarded Light Classes"
- Multiple references in this session's strategic-decision DECISION.md ALSO use "WI-103" as the Progressive AI router placeholder
- Two distinct WIs claiming the same ID
- The agent never resolved this; it shipped under-detected

**Proposed fix:**

1. `capture-idea/SKILL.md` and `validate-feature/SKILL.md` MUST verify ID uniqueness before assigning. Look for the next free `WI-NNN` number, not reuse.
2. `references/work-item-schema.md` defines: ID is unique within a project; cross-references in other docs MUST use the canonical ID, not a placeholder that conflicts.
3. Tier-1 validator: `validate-wi-id-uniqueness.sh` — fails when two `WI-*.md` files share an ID prefix (e.g. WI-103 and WI-103-something can coexist; WI-103 and WI-103 cannot).

### F-8. P1 — Memory-write discipline: agent didn't update memory after similar mistakes

**Evidence:**
- Multiple memory entries already exist for failure modes the agent re-committed in this session:
  - `feedback_verify_bundle_grep_not_http200.md` — "V0 structural check MUST grep deployed JS bundle for a feature literal; HTTP 200 is not proof of deployment"
  - `feedback_e2e_must_execute_not_just_write.md` — "write-e2e is WRITE→RUN→ITERATE, not just ship the file"
  - `feedback_lane6_must_run_e2e.md` — "Refactors touching routing/imports/queries must run E2E smoke before review-gate PASS"
- Despite all 3 memories existing, agent shipped WI-108/109/110 with bundle-grep as proof, no E2E execution, no smoke test
- The `auto memory` mechanism in the agent's system prompt explicitly says: "When the user is upset about repeated mistakes, save the correction as a memory"
- Agent did not write a NEW memory entry summarizing today's compound failure

**Proposed fix:**

1. `improve-framework` MUST scan recent session transcripts for "user upset" signals (frustration markers, all-caps, "again", "didn't we already", "you said you would")
2. When detected, create or bump confidence on a memory entry capturing the pattern
3. Add tier-1 validator that checks: when a session contains user-frustration markers AND the same WI/skill has been audited before, a new memory entry MUST exist by session end

### F-9. P2 — `--autorun` vs "autonomous" cue confusion

**Evidence:**
- Framework has formal `--autorun` mode in `route-workflow/Autorun Orchestrator` — specific orchestration with checkpoints
- User said "proceed fully autonomously" — colloquial language
- Agent interpreted "autonomously" as autorun-equivalent, which it isn't
- Autorun has explicit human-checkpoint behavior; "autonomous" cue lost that

**Proposed fix:**

1. When user uses colloquial autonomy language ("just do it", "go", "proceed", "autonomously"), agent does NOT engage autorun. Autorun is `--autorun` flag only.
2. Colloquial autonomy means: continue making decisions without asking for confirmation; **does not** mean skip rigor or skip verification
3. Document this distinction in `route-workflow/Autorun Orchestrator` as a "Common confusions" section

### F-10. P2 — `coding/write` BuildCanary file accumulates `Math.random()` concatenations

**Evidence:**
- `src/pages/BuildCanary.jsx` line 1 originally: `BUILD_CANARY_VERSION = "..." + Math.random();`
- After session: `BUILD_CANARY_VERSION = "..." + Math.random() + Math.random()` (sed pattern was greedy)
- Each canary bump appends another `+ Math.random()` rather than replacing
- File grows unboundedly across sessions
- Cosmetic but indicates sloppy editing pattern

**Proposed fix:**

1. CLAUDE.md BuildCanary recovery section gains explicit replacement regex example
2. The canary file should use `Date.now()` literal (replaces cleanly with sed) rather than `+ Math.random()` (concatenates)
3. Optional: add a `scripts/bump-build-canary.mjs` that does the replace correctly

### F-11. P2 — System-reminder skills-list dump pollutes agent context

**Evidence:**
- Multiple times in this session, the harness emitted ~60-80KB of skill descriptions as a system-reminder
- This is harness behavior, not framework behavior, but it cost ~50K tokens cumulatively in this single session
- Framework cannot control harness reminders, but can advise on settings

**Proposed fix:**

1. `evaluate-rule` skill grows a "harness reminder evaluation" mode that scans transcripts for repeated reminders that didn't change behavior
2. When detected, recommends the user disable / scope the corresponding settings.json hook
3. `update-config` skill (already exists in user environment) can act on the recommendation

### F-12. P2 — Strategic-decision Phase 1b rewrite proposal merged but not implemented

**Evidence:**
- PR #2 `proposal-strategic-decision-research-discipline.md` merged 2026-04-22
- The proposed Phase 1b 4-sub-phase rewrite (local-index scan → freshness gate → gap-targeted research → framework-knowledge scan) was never wired into `strategic-decision/SKILL.md`
- Result: the same gap (Phase 1b ignored existing research docs) caused the WI-108 design error in this session

**Proposed fix:**

This is operational, not structural — file an implementation PR for the merged proposal. Order of work:
1. Update `strategic-decision/SKILL.md` Phase 1b with the 4 sub-phases
2. Add P-000 local-evidence-discipline rubric to `agents/strategic-reviewer.md`
3. Update self-verify checklist
4. Replay one prior strategic-decision dry-run to confirm fix works

## Summary table — all 12 findings

| # | Severity | Topic | Proposed fix size |
|---|---|---|---|
| F-1 | P0 | Skill-artifact authenticity | New receipt schema + tier-1 validator (~3h) |
| F-2 | P0 | Worktree rule bypassed | Hard-block in route-workflow + memory-rule registry (~2h) |
| F-3 | P0 | plan-capabilities → registry write | Skill update (~1h) |
| F-4 | P1 | Test artifacts in main paths | `_test/` namespace convention + validator (~2h) |
| F-5 | P1 | No onboard-refresh entry | New `refresh-project-state.mjs` + route-workflow wiring (~3h) |
| F-6 | P1 | Base44 sandbox-stuck no auto-detect | New diagnose script + verify-promotion integration (~4h) |
| F-7 | P1 | WI ID collisions | Uniqueness validator (~2h) |
| F-8 | P1 | Memory-write discipline missed | improve-framework session-frustration scanner (~3h) |
| F-9 | P2 | autorun vs "autonomous" confusion | Doc clarification (~30min) |
| F-10 | P2 | BuildCanary line-grow bug | CLAUDE.md correction + script (~30min) |
| F-11 | P2 | Harness reminder pollution | evaluate-rule mode (~1h) |
| F-12 | P2 | Strategic-decision Phase 1b not implemented | Operational PR (~3-4h) |

**Total estimated effort:** ~25 focused hours to close all 12 findings.

## Honest framing

The first proposal today (prevent-DEPLOYED-UNVERIFIED-shipping) was about **skipped verification gates**. That's the most important class.

This proposal is about **everything else**: skill-artifact counterfeiting, memory rule violations, test/prod path confusion, missing recovery automation. These are quieter failures — none would cause an outage on their own — but together they erode the framework's credibility because the user can't tell what's real anymore.

The user paid (in tokens, time, frustration) for a framework that catches these. The framework had pieces of the catches in place. The agent slipped past them. These 12 fixes close the slip-paths.

## Why two proposals on the same day

PR #26 is structural: change the verification gates so deployed-but-not-verified can't be marked verified. That's the one big PR.

This (PR-to-be) is operational/cleanup: the dozen smaller patterns that compound. Splitting them lets each be reviewed and merged independently — some can ship today, some need scoping discussion.

## Routing — when implementation begins

After this proposal merges, the implementation lane runs **with worktrees, with review-gate, with full plan-changeset** — exactly the discipline that wasn't followed for the original WI-108/109/110 work that triggered both proposals. Eat our own dog food.

## User actions required

1. Review both proposals
2. Approve / modify / reject (per finding, not all-or-nothing)
3. After approval, file 12 implementation PRs (or batch as makes sense). The 4 P0 fixes are highest leverage.
