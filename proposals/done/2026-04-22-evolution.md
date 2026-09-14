# Framework Evolution — 2026-04-22

**Status:** IMPLEMENTED 2026-04-22 (`cac7afd`)

## Method

This proposal is scoped to the 2026-04-21 Kimi CLI dark-mode regression session audited in [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:1), with a narrow question: which failures were specific to Kimi-host execution hardness, and which should be hardened generically at the svc contract layer.

Read first:
- [FRAMEWORK-STATE.md](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:1)
- [DOCTRINE.md](/workspace/seriousvibecoding/DOCTRINE.md:1)
- [skills-manifest.json](/workspace/seriousvibecoding/skills-manifest.json:1)
- [track-visuals/SKILL.md](/workspace/seriousvibecoding/track-visuals/SKILL.md:1)
- [test-journeys/SKILL.md](/workspace/seriousvibecoding/test-journeys/SKILL.md:1)
- [review-gate/SKILL.md](/workspace/seriousvibecoding/review-gate/SKILL.md:1)
- [route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:1)
- [KIMI.md](/workspace/seriousvibecoding/KIMI.md:1)
- [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:1)

Explicitly skipped as already landed or intentionally deferred in `FRAMEWORK-STATE.md`:
- Kimi task-graph authority / skill receipts / latest-artifact close-out: [FRAMEWORK-STATE.md:42](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:42)
- Kimi rules auto-injection into `KIMI.md`: [FRAMEWORK-STATE.md:66](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:66)
- install-drift detection and rerun-setup guidance: [FRAMEWORK-STATE.md:153](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:153)

Assessment rule for this proposal:
- If the gap only exists because Kimi exposes slash-skill invocation or long-form reasoning loops, target Kimi-specific enforcement.
- If the same failure can occur on Claude/Codex/Gemini once a skill is explicitly loaded, push the fix down to a host-agnostic contract check.

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001 — Explicit skill invocation still lacks output-family postconditions [Fragility]

**Evidence:**
- [KIMI.md:35](/workspace/seriousvibecoding/KIMI.md:35) defines explicit `/skill:<name>` invocation as a first-class operation.
- [track-visuals/SKILL.md:17](/workspace/seriousvibecoding/track-visuals/SKILL.md:17) declares concrete output families under `docs/specs/visuals/baseline/` and `docs/specs/visuals/diffs/`.
- [track-visuals/SKILL.md:57](/workspace/seriousvibecoding/track-visuals/SKILL.md:57) defines `review` mode as the correct analysis mode for already-captured screenshots.
- [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:104](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:104) shows the user explicitly invoked `/skill:track-visuals`.
- [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:105](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:105) shows no `track-visuals` artifact family was produced; the run stayed in ad-hoc `test-journeys` evidence.

**Impact:** Kimi makes this failure easy to trigger because slash-skill invocation is explicit and cheap, but the real gap is generic: svc currently treats "did useful work happen?" as success even when the invoked skill's output contract was not satisfied. That makes named skill invocation weakly typed. The user asked for `track-visuals`; svc accepted "custom markdown that felt similar."

**Proposed fix:**
1. Add a host-agnostic explicit-skill postcondition check driven by the skill frontmatter `outputs.produces`.
2. Completion must satisfy exactly one of:
   - at least one expected artifact family was emitted,
   - a structured skip was recorded with reason and cited blocker,
   - a structured handoff to the correct successor skill was recorded.
3. For `track-visuals`, treat `review` mode as satisfying the contract only if the output lands in the visual-review family or explicitly references that mode in a durable artifact.
4. Surface this as Kimi-specific close-out feedback for slash skills, but implement it in the shared skill-completion layer so Claude/Codex/Gemini benefit too.

**Confidence:** HIGH

#### F-002 — Evidence-producing skills still have no arithmetic-integrity or post-write clean-closeout gate [Gap]

**Evidence:**
- [test-journeys/SKILL.md:384](/workspace/seriousvibecoding/test-journeys/SKILL.md:384) requires pass/fail counts and routed follow-ups in the summary.
- [test-journeys/SKILL.md:391](/workspace/seriousvibecoding/test-journeys/SKILL.md:391) makes commit-before-done mandatory.
- [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:107](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:107) records the session claiming `27 regressions` while the verified findings inventory still showed `15`.
- [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:108](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:108) records that the agent declared completion after later writes were left uncommitted and the worktree was dirty.
- [FRAMEWORK-STATE.md:51](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:51) shows the framework already closed the narrower "latest artifact" issue, so this remaining gap is specifically about numerical reconciliation and final write/commit integrity.

**Impact:** The current self-verify language is strong, but there is still no mechanical stop when headline counts diverge from the findings inventory or when late-session writes happen after the last commit. Kimi exposed it because it kept reasoning and rewriting after the main capture pass, but any host can do the same once a QA or audit skill writes multiple summary files.

**Proposed fix:**
1. Add a shared `validate-evidence-closeout` helper for evidence-producing skills (`test-journeys`, `track-visuals review`, `audit-session-execution`, later `benchmark-landing` if needed).
2. The helper should compare:
   - stated regression/finding counts vs actual finding blocks,
   - stated screenshot totals vs filesystem counts or manifest counts,
   - scenario totals vs `scenarios.json`,
   - latest edited evidence files vs staged/committed set.
3. Fail close-out if counts diverge or if tracked output files changed after the last commit.
4. Keep the existing latest-artifact rule; this new helper sits after it and enforces arithmetic plus final-tree integrity.

**Confidence:** HIGH

### P1 — Fix soon (degrades quality)

#### F-003 — Allowed next-step routing is still not validated against the producing skill's routing table [Drift]

**Evidence:**
- [test-journeys/SKILL.md:374](/workspace/seriousvibecoding/test-journeys/SKILL.md:374) routes behavioural defects and regressions to `diagnose-bug`.
- [test-journeys/SKILL.md:419](/workspace/seriousvibecoding/test-journeys/SKILL.md:419) repeats the same routing rule in the final routing table.
- [review-gate/SKILL.md:54](/workspace/seriousvibecoding/review-gate/SKILL.md:54) limits `review-gate` to G1-G7 artifact transitions after producer skills like `execute-changeset`.
- [skills-manifest.json:110](/workspace/seriousvibecoding/skills-manifest.json:110) and [skills-manifest.json:116](/workspace/seriousvibecoding/skills-manifest.json:116) place `track-visuals` and then `review-gate` after `execute-changeset`, not after regression capture.
- [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:119](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:119) and [2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:179](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-22-session-audit-manual-visual-tracking-dark-mode.md:179) show the audited session nonetheless told the user `review-gate` was next.

**Impact:** This is currently a soft-doc discipline problem. A model can read the routing table, forget it during synthesis, and still give a plausible but wrong "next skill" answer. Kimi's long-form self-discussion made the drift visible, but the failure class is generic to any host summarizing findings after a QA run.

**Proposed fix:**
1. Add an `allowed_next_skills` declaration or derived routing map for skills with explicit routing tables.
2. Final summaries and `route-workflow` continuations should validate proposed next skills against that set.
3. If the model suggests a disallowed next skill, block the suggestion unless it records an override with rationale and cites the rule it is consciously breaking.
4. Start with `test-journeys`, `diagnose-bug`, and `track-visuals`, where wrong next-step advice changes the lane.

**Confidence:** HIGH

### P2 — Improve when possible (nice to have)

None new in scope. The setup-side drift detection problem was already closed by [FRAMEWORK-STATE.md:161](/workspace/seriousvibecoding/FRAMEWORK-STATE.md:161), and the stronger SessionStart banner remains a documented deferred item rather than a newly evidenced gap in this audit.

### P3 — Track (not actionable yet)

None new in scope. The Kimi session did not expose a missing host capability; it exposed missing svc enforcement on top of capabilities that already exist.

## Comparison delta

No meaningful external-framework delta was needed for this pass. The dark-mode session did not fail because Kimi lacked browser execution, background-task visibility, or explicit skill invocation; [KIMI.md:35](/workspace/seriousvibecoding/KIMI.md:35) and [KIMI.md:76](/workspace/seriousvibecoding/KIMI.md:76) show those capabilities already exist. The missing layer is svc postcondition enforcement after a named skill runs. This is an internal contract-hardening problem, not a "blend a missing feature from another pack" problem.

## Stale proposal audit

- [2026-04-21-evolution.md](/workspace/seriousvibecoding/proposals/done/2026-04-21-evolution.md:1) is unrelated; it targeted `list-work-items` parsing and output size, not skill-output enforcement or QA close-out validation.
- [2026-04-20-session-audit-capture-idea-wrong-repo.md](/workspace/seriousvibecoding/proposals/done/2026-04-20-session-audit-capture-idea-wrong-repo.md:1) is a session audit, not an overlapping framework proposal.
- [2026-04-14-blocking-discovery-halt-protocol.md](/workspace/seriousvibecoding/proposals/done/2026-04-14-blocking-discovery-halt-protocol.md:1) and [2026-04-14-parallel-wi-dispatch.md](/workspace/seriousvibecoding/proposals/done/2026-04-14-parallel-wi-dispatch.md:1) remain out of scope.
- No current pending proposal in `proposals/` overlaps the three gaps above. They remain open and unimplemented as of this proposal.

## Self-Verify
| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | `FRAMEWORK-STATE.md` was read first; no rediscovered fixed items were re-proposed | PASS |
| 4 | Findings are ranked by impact and each includes confidence | PASS |
