---
name: improve-framework
version: "1.0"
description: >
  Fix or improve the svc framework itself: close gaps, apply pending proposals, act on
  test-framework failures or drift. Use for "improve the framework", "run self-
  improvement", "close framework gaps". To find gaps first use evolve-framework.
phases:
  - id: P1-FrameworkRepoAndMemoryLoad
    trigger: always
    reads: ["installed skills root", "FRAMEWORK-STATE.md", "references/knowledge/svc/CAPABILITIES.md"]
    writes: [".svc/improve-framework-repo-memory.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-PendingProposalAndEvidenceSelection
    trigger: always
    reads: ["proposals/", "proposals/triage.json", "test-framework/results/", "user report"]
    writes: [".svc/improve-framework-evidence.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-DiagnosisAndDuplicateFilter
    trigger: always
    reads: ["FRAMEWORK-STATE.md", "evolve-framework output", "gap evidence"]
    writes: ["proposals/<date>-framework-improvement.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ImplementationRouteDecision
    trigger: always
    reads: ["rules/plan-changeset-trigger.md", "rules/host-capability-research.md", "gap category"]
    writes: [".svc/improve-framework-route.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-ImplementationAndReplayVerification
    trigger: always
    reads: ["selected route output", "test-framework replay target", "changed files"]
    writes: ["test-framework/results/ when replayed", ".svc/improve-framework-replay.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-ImprovementRecordAndStateMutation
    trigger: always
    reads: ["proposals/<date>-framework-improvement.md", "FRAMEWORK-STATE.md", "references/knowledge/svc/CAPABILITIES.md"]
    writes: ["proposals/<date>-framework-improvement.md", "FRAMEWORK-STATE.md", "references/knowledge/svc/CAPABILITIES.md when capabilities change"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-ProposalDoneAndRemoteSync
    trigger: implementation-verified
    reads: ["proposals/<date>-framework-improvement.md", "git status", "git remote"]
    writes: ["proposals/done/<date>-framework-improvement.md", "git commit", "git push or PR URL"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify table", ".svc/lane-tasks-<WI>.json", "validation output"]
    writes: [".svc/improve-framework-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
  optional:
    - { path: "proposals/", artifact: proposals }
    - { path: "test-framework/results/", artifact: test-results }
    - { path: "references/blend-registry.json", artifact: blend-registry }
    - { path: "references/knowledge/svc/CAPABILITIES.md", artifact: self-knowledge }
outputs:
  produces:
    - { path: "proposals/<date>-framework-improvement.md", artifact: improvement-proposal }
chain:
  lanes:
    framework: { position: 4 }
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Framework Self-Improvement

Orchestrate the closed loop: find a gap → diagnose it → fix it → prove it → record it.

**Announce at start:** "I'm using improve-framework to run the self-improvement loop."

## Scope boundary vs `evolve-framework` (WI-077)

These two skills produce DIFFERENT artifacts and should never be conflated:

| Skill | Artifact shape | What it carries |
|---|---|---|
| `evolve-framework` | `proposals/<date>-evolution.md` | **Survey** of N gaps with evidence + severity + category. No per-leaf fix briefs. |
| `improve-framework` | `proposals/<date>-framework-improvement-<name>.md` | **One** gap, diagnosed, with ACs + file-impact + rollback. Single fix brief. |

**Rule:** An improvement proposal is ALWAYS scoped to a single gap. Batching multiple gaps into one improvement proposal is forbidden. If you catch an evolution proposal carrying per-leaf fix briefs, STOP — extract each leaf to its own `framework-improvement-<name>.md` before promoting to WIs. This was the WI-073 lane-compliance failure.

Reciprocal note in `skills/evolve-framework/SKILL.md` under "Scope boundary vs improve-framework".

**Step 0: Locate the Framework Source Repo (MANDATORY FIRST STEP)** — Before anything else, find the svc framework git repo; all skill edits, proposals, `FRAMEWORK-STATE.md` updates and commits go there, never to the install copy at `<SKILLS_PATH>` or the current project repo. Resolve the skills root (`SVC_SKILLS_PATH`, else the first existing host skills dir), read `<skills root>/.source-repo`, and fall back to matching the inode of the installed `improve-framework/SKILL.md` to its owning git repo. If none is found, stop with an error rather than guessing, and clone the framework repo only if it was never cloned on this machine. After that, treat every path as relative to `$FRAMEWORK_REPO`. Details and script: `references/step-0-locate-source.md`.

## Recursion Guard

The framework lane has a mutual dependency: improve-framework invokes
test-framework for verification, and test-framework routes gaps back through
improve-framework for fixes. To prevent infinite loops:

- **Max depth: 1.** If improve-framework is already running (check for an active
  `proposals/<date>-framework-improvement.md` being written in this session),
  do NOT invoke improve-framework again. Instead, log the gap to
  FRAMEWORK-STATE.md Known Gaps and stop.
- **No re-entry from test-framework replay.** When Step 6 invokes test-framework
  for replay verification, test-framework MUST NOT route any new gaps back
  through improve-framework. It reports them in the replay output only.
  Pass `--no-self-improve` context to the replay invocation.

## Self-correction inputs

These keep svc tuned as models and harnesses change. Run them weekly (a scheduled routine is the natural fit) and at every model or harness release:

- `node scripts/harness-drift.mjs check`: release notes since the version svc was tuned on, as **adopt** (a new capability svc could use) and **check** (a change svc must verify) proposals, each naming the svc files it touches. After acting, `harness-drift.mjs mark-tuned --version <v>`.
- `node scripts/harness-playbook.mjs verify`: installed CLIs still accept every flag svc passes them.
- `node scripts/mirror-ledger.mjs advise`: skills the current model has **caught up** with (slim or retire), skills that now **regress** (review first), and skills never measured.
- `node scripts/route-model.mjs stats`: where recorded outcomes disagree with the routing priors.

Each finding becomes one WI through `route-workflow`. Nothing edits a skill directly from these reports.

## The Loop

```
FRAMEWORK-STATE.md → evidence → diagnosis → [external comparison] →
implementation → replay verification → update FRAMEWORK-STATE.md
```

This skill does NOT do the work itself. It orchestrates existing skills:

| Role | Skill | What it does in this loop |
|---|---|---|
| Evidence engine | `test-framework` | Produce proof of failure, regression, or inefficiency |
| Diagnosis engine | `evolve-framework` | Convert evidence into ranked, actionable proposals |
| External delta | `blend-external` | Import patterns for a specific gap (not open-ended) |
| Implementation | `quick-fix` / `create-skill` / normal pipeline | Apply the fix |
| Replay verifier | `test-framework` | Prove the fix closed the gap |
| Memory | `FRAMEWORK-STATE.md` | Record what was found, fixed, deferred, locked |

## Process

### Step 1: Load Framework Memory

Read `FRAMEWORK-STATE.md` first. This tells you:
- What was already analyzed (don't rediscover)
- What was already fixed (don't re-propose)
- What was intentionally deferred (don't re-raise without new evidence)
- What decisions are locked (don't re-litigate)

Also read `references/knowledge/svc/CAPABILITIES.md` — our own capabilities
in structured format. This is what you're improving.

**Step 1.5: Pending Proposals** — Before gathering new evidence, list `proposals/*.md` excluding any with `**Status:** BLOCKED` in the first 20 lines, and run `bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh`: every open proposal past the `max_open_days` window in `proposals/triage.json` needs exactly one disposition (`accepted_wi`, `backlog_wi` plus reason, `rejected_reason` or `deferred_until`). A `backlog_wi` pointer is never dispatch authorization, so read that WI and its dependencies and respect freezes. If actionable pending proposals exist they ARE the evidence: skip Steps 2-3 and go to Step 5 (do not re-diagnose); with several, ask the user or take the newest. If only BLOCKED or no proposals exist, continue to Step 2. Also emit a one-line reminder for placeholder rules (`source: local`, `last_evaluated` null) in `skills-manifest.json`; these are non-blocking. Details: `references/step-1-5-pending-proposals.md`.

### Step 2: Gather Evidence

Choose ONE source of evidence (not all at once):

| Source | When to use |
|---|---|
| Pending proposals in `seriousvibecoding/proposals/` | A blend plan or evolution proposal exists — implement it (Step 1.5 catches this) |
| `test-framework/results/` (existing) | Recent test run found failures — start from those |
| Fresh `test-framework` run | No recent results, or results are stale (> 7 days) |
| User-reported issue | User describes a specific framework problem |
| Codex / cross-model review | External review identified contract issues |
| Blend source update | A tracked source (GSD, gstack, etc.) has a new SHA |

**If no evidence exists and none is provided:** run `test-framework` to generate it.
Don't diagnose without evidence.

### Step 3: Diagnose with evolve-framework

Invoke `evolve-framework` with the evidence. It reads FRAMEWORK-STATE.md
(required input) and produces a ranked shortlist:

For each gap:
- Exact problem and affected skills/files
- Category: drift | fragility | inefficiency | missing capability
- Severity: high | medium | low
- Whether it's already in FRAMEWORK-STATE.md known gaps

**Filter:** remove anything already in FRAMEWORK-STATE.md as fixed or locked.
Only surface genuinely new findings or deferred items with new evidence.

### Step 4: Decide if External Comparison is Needed

Invoke `blend-external` ONLY if:
- The gap looks like a known solved pattern elsewhere
- The framework lacks a convincing internal answer
- The change is architectural enough to benefit from comparative evidence

**Do NOT run broad external blending.** Scope blend-external to the specific
gap: "Does GSD/gstack/superpowers solve X? How?" — not "What else can we take?"

Check `references/knowledge/INDEX.md` before cloning. If the source's Layer 2
already covers the gap, read that instead.

### Step 5: Pick Implementation Route

| Gap type | Route | Why |
|---|---|---|
| Wording/contract drift across a few files | `quick-fix` | Fast, low-risk, no pipeline overhead |
| Isolated skill surgery (new self-verify check, new reference) | Direct SKILL.md edit | Skill-level change, test-framework replays |
| New skill needed | `create-skill` | Full skill creation with eval |
| Larger pipeline/framework change | Normal svc pipeline on THIS repo | Spec → design → plan → execute → review |

**Host Capability Verification Gate (MANDATORY before any host-specific implementation):**

If the implementation route touches host integration surfaces — hooks, MCP, task graph, model routing, UI paradigms, Background Tasks, or any host-specific API — invoke `research` to verify current host documentation BEFORE proceeding. Do NOT rely on training data for host API capabilities.

This gate is non-negotiable. The `rules/host-capability-research.md` correction rule enforces it. Violating this gate is a framework-breaking deviation.

**Plan-Changeset Discipline Gate (risk-based, not size-based):**

Apply `rules/plan-changeset-trigger.md` before implementation. The old size-only rule (`>2 files` or `>50 lines`) is superseded: size is an audit signal, not a mandatory trigger. Route by semantic risk and explicit exemptions.

If the implementation matches any risk signal in `rules/plan-changeset-trigger.md`, it MUST go through the normal svc pipeline on THIS repo, regardless of size:

```
write-spec → design-ux (if UI) → design-tech → plan-changeset → execute-changeset (in worktree) → review-gate → land-changeset
```

Framework skills are NOT exempt from planning discipline. Reactive quick-fixes on framework infrastructure cause:
- Validator failures (missing boilerplate, broken contracts)
- Content loss (progressive-disclosure refactors dropping required sections)
- Silent drift (hooks wired incorrectly, lane definitions misaligned)

| Change class | Required route | Why |
|---|---|---|
| Explicit exemption in `rules/plan-changeset-trigger.md` | `quick-fix` or direct edit with logged rationale | Avoid ceremony that catches nothing |
| Risk signal in `rules/plan-changeset-trigger.md` | Normal svc pipeline on THIS repo | Spec + plan + worktree + review prevent framework degradation |
| Large but exempt documentation/additive patch | Direct edit allowed, but log why the exemption applies | Size alone is not a correctness proxy |
| Small but hot-path/contract patch | Normal svc pipeline | Small changes can still alter framework behavior |
| New skill | `create-skill` | Full skill creation with eval |
| Refactor moving > 10% of SKILL.md lines | Normal pipeline + `verify-skill-refactor.mjs` | Content-preservation gate |

**Dogfooding is the goal.** Use svc to improve svc.

**For normal pipeline route:** treat the svc repo itself as the project.
Write a feature spec for the framework change, plan it, execute it in a
worktree, review it, land it. Dogfooding.

**svc-on-svc routing rules:**
- If the framework behavior is broken or regressed, route to `diagnose-bug` first, not `write-spec`
- If the framework is gaining a new capability, route to `write-spec`
- After `design-tech`, run `explore-solutions` whenever the framework change introduces a hard-to-reverse architecture decision (new persistence model, new host abstraction, new external dependency, new state backend)
- Use `route-workflow`'s Framework Self-Management Policy as the source of truth for deciding between `diagnose-bug`, `improve-framework`, and the normal product pipeline

### Step 5.5: Refactor-Specific Safety Check (MANDATORY when touching SKILL.md)

When the implementation modifies any existing `*/SKILL.md` file AND the change removes > 10% of the file's lines OR moves content to `references/*.md` (progressive-disclosure refactor), run the content-preservation verifier BEFORE committing:

```bash
node scripts/verify-skill-refactor.mjs <skill-name> <pre-refactor-git-ref>
# Exit 0 required before commit. Exit 1 means content was lost.
```

This catches the Gemini slim-refactor failure mode archetype (WI-071, commit `4c36a4e`) where 1767 net lines of contract content were silently dropped. The verifier's exit code is a hard gate — do not commit with exit 1 unless the deletion is intentional AND documented in `FRAMEWORK-STATE.md` Decisions with justification.

**Gemini-CLI pre-flight (MANDATORY when running on Gemini):**

Before any SKILL.md refactor or multi-file framework change on Gemini, execute:

1. `du -sh ~/.gemini/tmp/*/chats/*.json 2>/dev/null | tail -1` — check session size
2. If > 2.5 MB: run `/compress`, then re-read `FRAMEWORK-STATE.md` + active WI + active task graph before proceeding (L1 → L4 re-anchor)
3. If > 4 MB: commit WIP, exit session, restart — do NOT proceed with content-sensitive work

Reference: `references/gemini-context-budget.md`. This is framework gap G4 from proposal `2026-04-19-session-audit-gemini-slim-refactor-wi071-and-wi085.md`.

### Step 6: Require Replay Verification

No framework change is "done" until the original gap is replayed.

```
test-framework --replay <original-failing-scenario>
```

If the scenario that triggered the improvement now passes: the fix is verified.
If it still fails: the fix is incomplete — iterate.

If the gap was qualitative (not testable by test-framework): require a
cross-model review or manual verification instead.

**Output Artifact: Improvement Record** — Write `proposals/<date>-framework-improvement.md` in the framework source repo (not the current project) with sections Evidence (source, exact finding with file:line, severity), Diagnosis (root cause, category, already in FRAMEWORK-STATE.md?), Implementation (route, files, commit SHAs), Replay Verification (target, PASS/FAIL/PARTIAL, evidence) and FRAMEWORK-STATE.md Mutations. Timing: for quick-fix and direct SKILL.md edit routes write it AFTER implementation; for normal pipeline routes write it BEFORE as a plan, then update with commits and replay results. The replay target must exist and pass. Details and template: `references/improvement-record.md`.

### Step 6b: Move Proposal to Done

After replay verification passes and all changes are committed:

```bash
# run from the seriousvibecoding framework repo
mv proposals/<date>-framework-improvement.md proposals/done/
git add proposals/done/<date>-framework-improvement.md && git commit -m "improve-framework: mark proposal done"
```

Proposals live in `proposals/` while pending. Once implemented and verified, they move to `proposals/done/` and are committed. Do NOT leave implemented proposals in `proposals/` — that directory should only contain actionable pending work.

**Step 6c: Sync to Remote (MANDATORY BEFORE DECLARING DONE)** — After the Step 6b commit, push from the framework repo (`git push origin main`) and report the remote SHA and unpushed-commit count; unpushed work silently piles up otherwise. On a non-fast-forward, run `git fetch` and `git pull --rebase origin main` ONCE and retry, stopping on conflicts. If main is protected, push branch `skills/improve-framework/<date>-<slug>` and open a PR with the proposal as body; the loop is not done until the PR is open. On auth failure (`Repository not found`, 401/403), you may `gh auth switch` ONCE to the account named in the remote URL only if it already appears in `gh auth status`, then restore the previous account and name the account used. NEVER force-push (any variant) without an explicit user directive, never run `gh auth login`, create accounts, disable branch protection, or edit `~/.gitconfig` or the remote URL. Details: `references/step-6c-sync-remote.md`.

### Step 7: Mutate Framework Memory

Update ALL state artifacts — not just FRAMEWORK-STATE:

1. **FRAMEWORK-STATE.md:**
   - Add to Analysis History: what was found and what was done
   - Move from Known Gaps to Analysis History: if a deferred gap was fixed
   - Add to Decisions Made: if the fix involved a design choice
   - Update Current State: if skill count, gate count, etc. changed

2. **`references/knowledge/svc/CAPABILITIES.md`** — if the fix added new
   capabilities, add them. This is how svc knows what it IS.

3. **`references/blend-registry.json`** — if the improvement came from a
   blend, add the source entry with patterns_taken and patterns_skipped.

4. **Source proposal** — mark the proposal as IMPLEMENTED with date + commit SHA.
   Add `**Status:** IMPLEMENTED (date, commit SHA)` to the proposal header.
   Move it to `proposals/done/` (Step 6b).

5. **NOTICES** — if patterns were taken from an external source, credit it.

## Routing Logic

```
If issue is skill contract mismatch:
  → quick-fix or direct SKILL.md edit

If issue is lane/order/gate drift:
  → normal pipeline (this is a framework-level change)

If issue is benchmark regression without clear cause:
  → test-framework first → evolve-framework → diagnose

If issue is "others do this better":
  → blend-external (targeted) → evolve-framework → implement

If issue is already deferred in FRAMEWORK-STATE.md:
  → report that. Stop unless new evidence changes priority.

If issue is already fixed in FRAMEWORK-STATE.md:
  → skip. Do not rediscover.
```

## Non-Goals

- This skill does NOT freeform-edit the framework. It orchestrates.
- This skill does NOT run broad external blending without a target gap.
- This skill does NOT skip replay verification.
- This skill does NOT fix things that aren't broken (no speculative improvement).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Evidence gathered | test-framework results or user report exists | |
| 2 | Diagnosis produced | evolve-framework output with ranked gaps | |
| 3 | Implementation route chosen | quick-fix / create-skill / pipeline identified | |
| 4 | Replay verification passed | test-framework confirms fix OR cross-model confirms | |
| 5 | FRAMEWORK-STATE.md updated | analysis history, known gaps, decisions current | |
| 6 | svc CAPABILITIES.md updated | new capabilities reflected (if any added) | |
| 7 | Blend registry updated (if blend) | `grep <source> references/blend-registry.json` | |
| 8 | Proposal moved to done | `test -f proposals/done/<date>-*.md` in seriousvibecoding (Step 6b moves + commits it) | |
| 9 | NOTICES updated (if external source) | `grep <source> NOTICES` | |
| 10 | Commits pushed to remote | `git log @{u}..HEAD` returns empty OR a PR URL was reported to the user | |

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `improve-framework` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-FrameworkRepoAndMemoryLoad --evidence command_output:.svc/improve-framework-repo-memory.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-PendingProposalAndEvidenceSelection --evidence command_output:.svc/improve-framework-evidence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-DiagnosisAndDuplicateFilter --evidence file:proposals/<date>-framework-improvement.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ImplementationRouteDecision --evidence command_output:.svc/improve-framework-route.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ImplementationAndReplayVerification --evidence command_output:.svc/improve-framework-replay.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ImprovementRecordAndStateMutation --evidence file:FRAMEWORK-STATE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-ProposalDoneAndRemoteSync --evidence command_output:.svc/improve-framework-remote-sync.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/improve-framework-self-verify.log
```

If a phase is intentionally skipped because the gap is already fixed, deferred,
or blocked, still record that phase id with command-output evidence explaining
the stop condition. Do not complete the task until all required phase ids appear
in `skill_receipt.phases_executed`.

## Pipeline Continuation

Follow the canonical task-graph chaining contract: see `references/task-graph-chaining-protocol.md`.

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill does not chain progressively. It orchestrates other skills and produces a proposal + verification evidence. The output is the updated FRAMEWORK-STATE.md and any implemented fixes.

## Key Principles

- **Evidence before diagnosis.** Don't guess what's broken — prove it.
- **Diagnosis before implementation.** Don't fix symptoms — find root causes.
- **Targeted external comparison.** Import for a gap, not for exploration.
- **Replay before done.** The gap that triggered the loop must be re-tested.
- **Memory is mandatory.** Every loop iteration updates FRAMEWORK-STATE.md.
- **Dogfooding is the goal.** Use svc to improve svc.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
