# Framework Improvement — 2026-04-24 — Reviewer Safety

**Status:** DRAFT — focused fix brief authored by improve-framework Step 5 in response to observed off-script reviewer failures during WI-073 and WI-074.

**Parent evolution:** Bundles three live-evidence issues from the 2026-04-24 framework-cohesion session (not pre-authored in the cohesion proposal — surfaced during its execution):

- **#4 Kimi goes off-script under scope-lock.** During WI-073 plan review, Kimi started writing files into `capture-idea/references/` instead of producing YAML findings. Had to kill the process. Files were orphaned in the worktree.
- **#5 Reviewer scope-lock cannot catch process-shape errors.** Neither Kimi nor Codex caught that WI-073 skipped `improve-framework` between `evolve-framework` and `write-spec` — scope-lock restricts reviewers to document content, not process shape.
- **#8 Codex exhausts turn exploring files.** During WI-074 plan review, Codex ran 6 `exec` commands reading skills-manifest, routing-rules, plan-changeset-trigger, etc., then never produced findings — the 2668-line log has zero ACCEPT/PARTIAL/REJECT verdicts. Same failure class as Kimi.

The common thread: reviewers spend their turn exploring instead of producing findings. Both Codex and Kimi exhibit it. Scope-lock instructions aren't sufficient to constrain model behavior.

## Goal

Harden `scripts/review-plan-kimi.sh` and `scripts/review-plan-codex.sh` so that adversarial plan reviews (a) cannot write files, (b) cannot explore beyond the scope-locked input set, (c) produce findings in a bounded time even when the reviewer's natural instinct is to keep exploring, and (d) include a "lane-compliance" check dimension.

## Non-Goals

1. Replacing the adversarial-review protocol itself. Findings format + rubric stay.
2. Building a new reviewer skill. This hardens the two existing reviewer scripts.
3. Silencing failed reviews. A failure-to-produce-findings SHOULD fail loudly, not succeed silently.

## Acceptance Criteria

### US-01 — Reviewers cannot write files

- **AC-01.1** `scripts/review-plan-kimi.sh` invokes kimi with a read-only sandbox flag (if available) OR wraps the call in a guard that refuses writes to the repo.
- **AC-01.2** `scripts/review-plan-codex.sh` already passes `--sandbox read-only`; verified to be still present.
- **AC-01.3** A tier-1 validator `validate-review-plan-readonly.sh` asserts both scripts have read-only enforcement wired.

### US-02 — Findings-first output enforced

- **AC-02.1** Both reviewer scripts prepend a "OUTPUT FIRST" preamble that instructs the model to emit the YAML findings block as the FIRST thing in its response, before any file reads or explorations.
- **AC-02.2** Both scripts tail-parse the output and hard-fail (exit 2) if the findings block is absent after the reviewer completes.
- **AC-02.3** Exit code contract: exit 0 on valid findings (even with findings present), exit 1 on reviewer tool failure, exit 2 on reviewer-output-missing-findings, exit 3 on reviewer-not-on-PATH.

### US-03 — Lane-compliance focus added to review dimensions

- **AC-03.1** Both reviewer prompts include an explicit "(g) lane compliance" focus item: "For the declared lane, list every mandatory upstream skill. Confirm each is either completed (cite artifact) or skipped-with-justification (cite pipeline-decisions.jsonl entry). Unnamed lane skills = REJECT."
- **AC-03.2** The lane-compliance check is added to the determinism rubric in `references/plan-review-protocol.md`.

### US-04 — Learning locked in + Codex default reinforced

- **AC-04.1** 3 learnings appended to `references/framework-learnings.jsonl`:
  - `reviewer-off-script-explore-instead-of-findings` (confidence 10)
  - `reviewer-scope-lock-misses-process-shape` (confidence 10)
  - `reviewer-model-must-be-pinned-for-reproducibility` (confidence 9)
- **AC-04.2** Full tier-1 sweep passes including the new validator.

## File Impact

| File | Change |
|---|---|
| `scripts/review-plan-kimi.sh` | **edit** — add read-only flag/wrapper; prepend OUTPUT-FIRST preamble; tail-parse for findings; exit-code contract |
| `scripts/review-plan-codex.sh` | **edit** — prepend OUTPUT-FIRST preamble; tail-parse for findings; exit-code contract (already has `--sandbox read-only` + model pin) |
| `references/plan-review-protocol.md` | **edit** — add "lane compliance" to rubric |
| `test-framework/evals/tier-1/validate-review-plan-readonly.sh` | **create** — asserts both scripts have read-only enforcement + OUTPUT-FIRST preamble + exit-code contract |
| `references/framework-learnings.jsonl` | **append** — 3 learnings |

## Scope boundary

- **touches:** the 5 files above.
- **reads:** existing reviewer transcripts at `/tmp/kimi-review*.txt` and `/tmp/codex-wi074-review.txt` as evidence anchors (for commit message + learning entries).
- **must-not-touch:** any skill SKILL.md; any hook; any rule; manifest; README.md; route-workflow; proposals outside this one; work-items outside WI-075.

## Rollback

Commit-scoped revert per established pattern.

- Each of the 3 code/script edits is a separate commit.
- If the OUTPUT-FIRST preamble causes reviewers to refuse to work: revert the preamble commit.
- If tail-parse is too strict: revert just that commit; keep the preamble.
- Learnings are append-only; if entries are wrong, remove the lines.

## Size / Risk

- **Risk class:** contract change (review protocol + exit codes) + hot-path edit (review scripts fire during every plan review).
- **Lines:** ~200 (2 script edits ~40 lines each + protocol edit ~20 + new validator ~80 + 3 JSON lines).
- **Files:** 5.
- **Plan-changeset required:** yes.


---

**Promoted to:** docs/specs/work-items/WI-075.md
**Promoted at:** 2026-04-24T12:57:49.284Z
