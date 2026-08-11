# Session Audit — Gemini Slim-Refactor (WI-071) and WI-085 Task-Graph Corruption

## Scope

Two related runs driven by Gemini CLI on 2026-04-18 / 2026-04-19:

1. **Framework slim-refactor (WI-071, commit `4c36a4e`):** "Applied Progressive Disclosure pattern to worst offenders. Moved detailed protocols and examples to references/ files. Reduced initial skill activation context jump by >90%." Net commit delta: **-1767 lines** (4530 deletions, 2763 insertions) — indicating content loss during refactor, not pure reorganization.

2. **Example Marketplace WI-085 (read-path divergence, commit `70133e2`):** Legitimate bugfix work completed, but `.svc/lane-tasks-WI-085.json` was left in a **syntactically broken state** (line 24, missing opening quote in `name":` key). The task-graph validator would reject it; any future resume or stop-hook globbing fails on this file.

Both runs are Gemini-host. Combined they reveal three distinct fault domains:
- Framework gap (harness-specific refactor guardrails)
- Agent execution failure (Pillar Revisit coverage + content-preservation discipline)
- Project-specific damage (broken task-graph file in active repo)

## Evidence Inventory

| Source | Path | Role |
|---|---|---|
| WI file | `seriousvibecoding/docs/specs/work-items/WI-071.md` | Pillar Revisit Audit + Verification claims |
| Task graph | `seriousvibecoding/.svc/lane-tasks-WI-071.json` | Sub-task execution state |
| Commit | `4c36a4e` (Gemini slim-refactor) | Content-loss primary evidence |
| Commits | `0be4e81`, `964fb8d` (two sequential "restore" commits) | Proof refactor was incomplete |
| Commit (today) | `65ed674` (my F3 work) | Discovered STILL-missing content (paste-ready Output Protocol) after 2 repair commits |
| WI file | `example-marketplace/docs/specs/work-items/WI-085.md` | Legitimate diagnosis, proper 8-pillar audit |
| Task graph | `example-marketplace/.svc/lane-tasks-WI-085.json` | **Corrupted JSON at line 24** |
| Transcript status | `searched host traces, found at ~/.gemini/tmp/seriousvibecoding/chats/ and ~/.gemini/tmp/example-marketplace/chats/` | 4 multi-MB Gemini chat JSONs (3.4M, 3.2M, 4.1M on seriousvibecoding; 6.4M on example-marketplace — abnormally large indicating context bloat). Not parsed line-by-line for this audit; artifact evidence is stronger. |

## Expected Contract

For WI-071 (framework bugfix on svc itself, Lane 4 per `route-workflow` Freeform Intent table + svc-on-svc Framework Self-Management Policy):

1. `diagnose-bug` with **complete 8-pillar Pillar Revisit Audit**, pattern scan, register discoveries, learnings
2. `plan-changeset` (conditional — skip if fix is complete)
3. `execute-changeset`
4. `review-gate` — gates the diff against diagnose-bug brief
5. `write-e2e` / `test-journeys` — **skippable for framework-internal skill content refactors** (no user-facing surface), BUT replay/sanity check is MANDATORY — re-activate the slimmed skills in a fresh session and verify all lane-definitions, self-verify tables, rationalization tables, and chain rules are present/reachable
6. `land-changeset` — commit, verify
7. `verify-promotion` — equivalent here = replay activation test on both Gemini AND Claude Code
8. Close WI with all 8 pillars addressed

**Critical content-preservation rule** (implicit in framework contract but not mechanically enforced): a "progressive disclosure" refactor must produce **zero net content loss** — every section in the old SKILL.md must appear in the new SKILL.md OR in a reference file. Net delta should be ≤ boilerplate churn (~0-50 lines), not -1767.

For WI-085 (example-marketplace bugfix, Lane 4):

1-8 as above, PLUS: task-graph JSON must remain **syntactically valid** at every save. The `lane-tasks.json` file is the cross-host source of truth; a broken file blocks all downstream resume/stop-hook operations.

## Actual Execution

### WI-071 (framework slim-refactor)

| Step | Expected | Actual | Evidence |
|---|---|---|---|
| diagnose-bug | Full 8-pillar audit | **4 of 8 pillars skipped** (missing: 1 Product fit, 2 Journey, 5 UI, 8 Operations) | `WI-071.md` "Pillar Revisit Audit" table has only rows 3, 4, 6, 7 |
| Content preservation | Zero net loss | **Net -1767 lines** across two skills | `git show --stat 4c36a4e` |
| Execution discipline | Task graph sub-tasks completed in order | Task graph shows task 1.1 `in_progress`, 1.2–1.6 `pending` but WI marked `VERIFIED` | `.svc/lane-tasks-WI-071.json` vs WI status |
| Replay verification | Fresh activation + contract-coverage check | None recorded. "Verification" section only cites file-size reduction | `WI-071.md` Verification section |
| Close-out | Full 8-pillar audit + learnings applied | Learning acknowledges gap ("Mechanical check for skill size should be added to framework CI to prevent regression") — but the MISSING-CONTENT failure mode not acknowledged, only size | `WI-071.md` |
| Follow-up repair | N/A if done correctly | **TWO follow-up commits required** to restore content (`0be4e81`, `964fb8d` = +2230 lines combined recovery), AND a third partial recovery today in `65ed674` | Commit log |

### WI-085 (example-marketplace read-path fix)

| Step | Expected | Actual | Evidence |
|---|---|---|---|
| diagnose-bug | Full 8-pillar audit + pattern scan + register discoveries | **Complete and correct** — all 8 pillars addressed, pattern scan found `batchLocationData` adjacent defect | `WI-085.md` |
| Execute fix | Update allowlist + switch to user-scoped reads | Done, committed `70133e2` | Commit |
| Task-graph hygiene | Valid JSON at every save | **BROKEN JSON at line 24** (`name": "diagnose-bug|brief"` — missing opening `"`) | `python3 -m json.tool` fails |
| Close WI | `Status: VERIFIED`, INDEX update | **`Status: identified`** — WI never closed despite commit | `WI-085.md` header |

## Expected vs Actual Matrix

| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| WI-071 Pillar coverage | 8/8 | 4/8 | **FAIL** (agent + framework) | WI-071.md |
| WI-071 content preservation | ~0 line net delta | -1767 lines | **FAIL** (agent — framework had no mechanical guardrail) | `git show 4c36a4e` |
| WI-071 replay verification | Fresh activation of refactored skills | Only size-reduction verified | **FAIL** (agent) | WI-071.md |
| WI-071 single-commit completion | 1 refactor commit, done | 1 refactor + 2 repairs + 1 partial repair (today) = 4 commits to reach stable | **FAIL** (compound evidence) | git log |
| WI-085 diagnosis | 8-pillar audit + pattern scan | Complete | **PASS** | WI-085.md |
| WI-085 task-graph integrity | Valid JSON | **Broken JSON line 24** | **FAIL** (agent) | `python3 -m json.tool` |
| WI-085 WI close-out | Status VERIFIED + INDEX update | Status still `identified` despite commit landing | **FAIL** (agent) | WI-085.md |

## Dimension Scores

| Dimension | Score | Evidence | Notes |
|---|---|---|---|
| Prompt fidelity | PASS | Both user problems solved in substance | |
| Routing correctness | PASS | Lane 4 chosen for both | |
| Contract compliance | **FAIL** | Pillar Revisit skipped half pillars (WI-071); task-graph JSON corrupted (WI-085) | |
| Skill-loading discipline | WARN | Cannot verify without parsing 16MB of Gemini chat JSON, but sub-task state in WI-071 graph suggests skill not loaded for 1.2-1.6 | |
| Verification sufficiency | **FAIL** | WI-071 "verified" by file size only, not by contract-coverage replay | |
| Review discipline | WARN | No `review-gate` artifact found for WI-071; the TWO follow-up "fix" commits ARE the review by another means | |
| User-handoff discipline | PASS | User was not asked to do things the framework could do | |
| Audit/log completeness | **FAIL** | Task graph says one thing (pending), WI file says another (VERIFIED); broken JSON in WI-085 | |
| Token/context efficiency | **FAIL (ESTIMATED)** | Gemini session JSONs on seriousvibecoding are 3.4M + 3.2M + 4.1M + 1.2M ≈ 12MB total across 4 sessions for this refactor; example-marketplace 6.4M single session for WI-085. These sizes indicate heavy context-window exhaustion — confirmed by the compound "forget content, then repair, then forget more" pattern visible in commit history | |
| Capability gaps | **FAIL** | No mechanical content-preservation check; no task-graph JSON validator; no Gemini context-ceiling pre-warning | |
| Workflow Phase gaps | **FAIL** | No "progressive-disclosure content-audit" phase exists in the skill-refactor workflow | |
| Systemic Opportunities | **FAIL** | Refactor → break → repair → break again is a structural pattern that needs workflow prevention | |
| Safety/Governance Audit | WARN | Agent ignored no explicit hook (none exists to block content-loss refactors) | |
| **Harness Efficiency Audit (Gemini-specific)** | **FAIL** | "Cache Layer Drift / Chapter Misalignment" clearly manifest: after the initial refactor, the agent lost awareness of what was in the original skill files and could not correctly audit its own work. Multi-MB chat JSONs indicate `/compress` was never invoked. | |
| Framework gap extraction | PASS (this report) | | |

## Token / Context Notes

- **Gemini seriousvibecoding session sizes:** 3.4M, 3.2M, 4.1M, 1.2M (4 sessions). Tag: **ESTIMATED** (inferred from JSON file size, not provider token counters).
- **Gemini example-marketplace session sizes:** 6.4M (primary WI-085 session), 5.2M, 1.5M, 0.2M. Tag: **ESTIMATED**.
- The JSON file size is a rough proxy — conversation history + tool outputs + repeated file reads all compound. A 6MB session is ~1.5–2M tokens of chat history depending on tool-output density.
- **Cache Layer Drift evidence:** the 2 follow-up "restore" commits both list "recovered lost lane definitions and templates" — meaning on subsequent Gemini sessions, the agent could not see what it had just deleted. This is the classic Gemini "chapter misalignment" failure — the earlier chapters fall out of the effective attention window and the agent cannot self-audit.
- **Positional Attention Audit:** the agent correctly executed the top-level task (slim the file) but silently violated a framework-wide L1 constraint (preserve all contract content during progressive disclosure). Classic attention decay failure.

## Findings

### F1 — Gemini "slim refactor" silently drops contract content

- **Domain:** agent-specific **PLUS** framework-specific (framework had no mechanical enforcement)
- **Severity:** critical
- **Description:** WI-071 refactor committed with -1767 lines net loss. Required 2 follow-up "restore" commits to approach parity. Today's F3 work discovered STILL-missing content (Output Protocol paste-ready rules). The agent did not — could not — audit its own content loss because Gemini's context window could not hold both the old and new files simultaneously for comparison.
- **Evidence:** `git show --stat 4c36a4e` shows -1767 net; `0be4e81` and `964fb8d` commits labeled "restore"; my 2026-04-19 session (`65ed674`) still found Output Protocol content missing
- **Fix:** see Framework Gaps G1

### F2 — WI-071 Pillar Revisit Audit incomplete (4 of 8 pillars)

- **Domain:** agent-specific, but framework's eval-gate hook should have caught it
- **Severity:** high
- **Description:** WI-071.md shows only rows 3, 4, 6, 7. Missing: Product fit, Journey, UI, Operations. Framework rule per `references/pillars-coverage-matrix.md`: all 8 must be explicit with `[UPDATED]` / `[UNCHANGED — VERIFIED]` / `[N/A — justified]`. Blank/missing rows are a hard fail.
- **Evidence:** `WI-071.md` "Pillar Revisit Audit" table
- **Fix:** see Framework Gaps G2

### F3 — WI-085 task-graph JSON corrupted

- **Domain:** agent-specific (Gemini write) **PLUS** framework-specific (no validator on save)
- **Severity:** high
- **Description:** `.svc/lane-tasks-WI-085.json` line 24 has `name": "diagnose-bug|brief"` (missing opening `"`). `python3 -m json.tool` rejects it. Any script using `task-graph.mjs` or the svc stop hook (`hooks/svc-task-completion-guard.sh`) would fail or silently skip this file.
- **Evidence:** `python3 -m json.tool .svc/lane-tasks-WI-085.json` fails at char 2186
- **Fix:** see Framework Gaps G3 + non-framework corrections below

### F4 — WI-085 WI file status not updated despite fix committed

- **Domain:** agent-specific
- **Severity:** medium
- **Description:** `WI-085.md` shows `Status: identified` but commit `70133e2 fix(wi-085): update getUserLocations allowlist...` has landed. The WI close-out contract (update status → VERIFIED, update INDEX.md, append learnings, append decision log entry) was skipped.
- **Evidence:** WI header vs commit log
- **Fix:** see non-framework corrections

### F5 — Gemini session context bloat (multi-MB chat JSONs)

- **Domain:** framework-specific (harness integration)
- **Severity:** medium
- **Description:** Individual Gemini sessions exceeded 4MB of chat JSON. No `/compress` usage evidence. `ui.compactToolOutput` not engaged for large file reads. This is the root cause of F1's content loss: the agent could not hold both old and new file states in effective attention.
- **Evidence:** `du -sh ~/.gemini/tmp/{seriousvibecoding,example-marketplace}/chats/` shows 4MB+ sessions
- **Fix:** see Framework Gaps G4

## Framework Gaps For evolve-framework

### G1 — Progressive-disclosure refactors have no content-preservation check

**Gap:** The framework has no mechanical verification that a progressive-disclosure refactor preserved all contract content from the original SKILL.md. An agent can silently truncate sections and commit.

**Proposed mechanical enforcement (NOT "the agent should be careful"):**

- Add `scripts/verify-skill-refactor.mjs` that:
  1. Takes a git ref BEFORE the refactor and HEAD AFTER
  2. Extracts all H2/H3 headers + all `| # |` table rows + all `### ` self-verify checks from the old SKILL.md
  3. Greps new SKILL.md + all new `references/*.md` for each extracted marker
  4. Reports any missing markers
- Wire into `improve-framework` as a MANDATORY step 5.5 for any changeset that modifies a SKILL.md with `-size` reduction > 30%
- Gemini agents MUST run it before writing the commit
- Claude agents must run it when reviewing Gemini's refactor work

This is deterministic, ~100 lines of Node, catches the exact F1 failure mode.

### G2 — eval-gate hook does not block WI close when Pillar Revisit is incomplete

**Gap:** WI-071 shipped with 4 of 8 pillars missing. The `svc-eval-gate-pre.sh` hook (PreToolUse) and/or `svc-eval-gate-post.sh` (PostToolUse) should reject a WI that marks `VERIFIED` when its `## Pillar Revisit Audit` table has < 8 rows.

**Proposed mechanical enforcement:**

- In the eval-gate hook, add a check: if the event is a WI status transition to `VERIFIED`, count rows in the Pillar Revisit Audit table. Require exactly 8 (pillars 1-8). Block otherwise with a clear message.
- ~20 lines of bash + grep.

### G3 — Task-graph JSON files are not syntax-validated on write

**Gap:** `.svc/lane-tasks-<WI>.json` can be written in a broken state. No pre-save validator. The existing `scripts/task-graph.mjs validate` is opt-in, not mandatory.

**Proposed mechanical enforcement:**

- Add a PostToolUse hook (Edit/Write on `.svc/lane-tasks-*.json`) that runs `node scripts/task-graph.mjs validate <path>` and BLOCKS the save if invalid.
- Or: run validation in a pre-commit hook for any committed `.svc/lane-tasks-*.json`.
- ~15 lines of bash.

### G4 — No Gemini-specific context-budget enforcement in harness

**Gap:** Gemini sessions grew to 4MB+ JSON without `/compress` or chapter-reset. The framework has Gemini-CLI host provisioning but no runtime context-ceiling pre-warning.

**Proposed mechanical enforcement:**

- Add a `references/gemini-context-budget.md` with:
  - Session-size ceilings (e.g., "at 2MB chat JSON, agent MUST run `/compress` before the next heavy read")
  - Chapter-reset protocol for multi-file refactors
  - Mandatory re-anchor to L1 (Vision/state files) after cache-drift signals
- Add a check to skills that are known context-heavy on Gemini (`route-workflow`, `write-e2e`, `improve-framework`): at the top of each skill, a Gemini-only branch: "If running on Gemini and session JSON > 2MB, run `/compress` and re-anchor to FRAMEWORK-STATE.md before proceeding."
- This is the "cache-layer drift" prevention called for in this session's Harness Efficiency Audit.

### G5 — The "framework slim refactor" workflow has no dedicated workflow phase

**Gap:** When the goal is "this skill is too big for Gemini" → the workflow is currently ad-hoc. No dedicated phase with explicit content-preservation gate.

**Proposed workflow:**

Create a new skill `refactor-skill-progressive-disclosure` (or extend `improve-framework` with a `--mode=slim-refactor` branch) that:

1. Snapshots the old SKILL.md into `.tmp/old-skill-<name>-<sha>.md`
2. Emits an inventory of sections to preserve
3. Executes the refactor
4. Runs G1's content-preservation verifier
5. Blocks the commit if any content is missing
6. Includes a mandatory replay: activate the refactored skill in both Claude Code and Gemini CLI (if Gemini is target), confirm all self-verify tables, rationalization tables, and lane rules are reachable

~80 lines. Converts a known-failure-mode workflow into a deterministic one.

## Non-Framework Corrections (project/agent issues)

These go into example-marketplace/seriousvibecoding repos directly, not into the framework:

### C1 — Fix WI-085 task-graph JSON (example-marketplace)

- File: `/home/svc-user/app-workspaces/example-marketplace/.svc/lane-tasks-WI-085.json`
- Line 24: change `"id": "1.10", name": "diagnose-bug|brief"` to `"id": "1.10", "name": "diagnose-bug|brief"` (add opening quote)
- Then run `node scripts/task-graph.mjs validate` (if the script exists in example-marketplace) to confirm

### C2 — Close WI-085 properly (example-marketplace)

- Update `WI-085.md` header: `Status: VERIFIED`
- Update `docs/specs/work-items/INDEX.md` row for WI-085 to `VERIFIED`
- Append decision-log entry to `.svc/pipeline-decisions.jsonl` with `type: "mechanical"`, `decision: "Close WI-085"`, `reasoning: "Fix landed 70133e2, E2E passing (to confirm)"`
- Verify no additional pillar-revisit findings require follow-up WIs

### C3 — Content-recovery audit of route-workflow + write-e2e (seriousvibecoding)

- Even after commits `0be4e81`, `964fb8d`, and today's `65ed674`, content may still be missing
- Manual comparison: extract the pre-refactor version of `route-workflow/SKILL.md` (git show `4c36a4e^:route-workflow/SKILL.md` — ~2573 lines) and grep every H2/H3 header against the current state (main SKILL.md + all `references/*.md`). Report any headers still unreachable.
- Apply symmetric check to `write-e2e/SKILL.md`

## Confidence

**Medium-high.** Artifact evidence (commits, WI files, task-graph file, file sizes) is strong and direct. The transcript-heavy dimensions (exact token counts, precise skill-loading timestamps) are ESTIMATED — I did not parse 16MB of Gemini JSON line-by-line for this audit. That would strengthen the F5 finding but not change any conclusion.

Not included: a full line-by-line diff of what content is still missing from the slim-refactored skills. That is C3's job — separate, larger scope.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Audit target is narrow and concrete | PASS — WI-071 + WI-085 + their immediate repair chain |
| 2 | Expected contract cites framework and repo contract | PASS — route-workflow lanes, pillar-coverage-matrix, task-graph-protocol, FRAMEWORK-STATE cited |
| 3 | Expected vs Actual matrix exists | PASS |
| 4 | Every finding bucketed into project/agent/framework | PASS — each F1-F5 labeled |
| 5 | Token claims labeled EXACT/ESTIMATED/UNKNOWN | PASS — all ESTIMATED from file sizes |
| 6 | Framework gaps exclude already-fixed entries | PASS — FRAMEWORK-STATE 2026-04-19 Gemini Hang Fix entry exists but does NOT include G1-G5 proposals |
| 7 | Transcript absence was proven, not assumed | PASS — host traces found at `~/.gemini/tmp/` and cited |
| 8 | Output file exists | PASS — this file |
