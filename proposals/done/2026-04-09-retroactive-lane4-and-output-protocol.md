# Framework Improvement: Retroactive Lane 4 + Mandatory E2E + Output Protocol

## Evidence

- **Source:** User-reported gap during Example Marketplace WI-012 close-out, 2026-04-09 session
- **Finding:** When work was done outside the framework (PhotoUpload prop-shape mismatch fix already committed in main), `route-workflow` and `diagnose-bug` did not unambiguously prescribe a close-out path. The assistant wavered between (a) proposing a new `adopt-external-fix` skill and (b) offering a manual 3-skill composition, neither of which was correct. Additionally, Lane 4 step 7 described `write-e2e` as "targeted support when the verification path needs direct runtime evidence" — that phrasing let the assistant treat runtime verification as optional for a user-facing bugfix, verifying only source-grep assertions instead of actually uploading a test image. Finally, the user had to explicitly instruct the assistant to end every response with a next-command suggestion, because no framework rule required it.
- **Severity:** HIGH
  - G1 (retroactive handling): HIGH — same waver will repeat on every out-of-band WI
  - G2 (e2e mandate): HIGH — silent under-verification of user-facing fixes is a correctness risk
  - G3 (output protocol): MEDIUM — UX regression, not correctness, but compounds friction across every skill response

## Diagnosis

- **Root cause:**
  - G1. `route-workflow` Lane 4 assumed forward execution (from broken state to fix). It did not document how to run the same lane retroactively against an already-committed fix.
  - G2. Lane 4 step 7 used the phrase "targeted support," which allowed interpretation as optional. It should have read "mandatory for user-facing surfaces."
  - G3. `route-workflow` had no Output Protocol section mandating that every skill response end with an explicit next-command trailer. This left each skill to hedge or forget.
- **Category:** drift (G1, G2 — contract wording drift) + missing capability (G3 — no output-format convention existed)
- **Already in FRAMEWORK-STATE.md?** No. None of the three gaps were listed in Known Gaps.

## Implementation

- **Route:** Direct SKILL.md edits (quick-fix scope — wording/contract drift + new output rule). No new skill created (explicitly rejected by user — framework is source of truth).
- **Files changed:**
  - `route-workflow/SKILL.md` — Lane 4 rewritten: `diagnose-bug` output contract expanded (pattern scan, affected artifacts, learnings mandatory), `write-e2e` promoted to MANDATORY step 5 for user-facing surfaces, new **Retroactive Lane 4 Execution** section with 7-step retroactive mapping; new **Output Protocol — Next Command Suggestion** section mandating `**Next:**` trailer on every skill response with 3 acceptable shapes and enforcement pointer
  - `diagnose-bug/SKILL.md` — Outputs expanded (pattern scan, affected artifacts, learnings as required outputs); new Process Step 4.5 **Pattern scan — MANDATORY** with root-cause-class → scan-type mapping table; new **Retroactive Mode** section explaining how to run diagnose-bug against already-committed code; What-Not-To-Do extended with 3 new prohibitions including "Do not propose a new skill to handle out-of-band fixes"; Routing updated to state `write-e2e` is mandatory for user-facing surfaces; Self-Verify table extended from 3 → 8 checks (added: pattern scan documented, affected artifacts list, learnings captured, write-e2e path identified, retroactive mode handled); Chaining updated to require the Output Protocol `**Next:**` trailer
- **Commits:** `0dac0d81c37d4a53384cc7621d8109757ab19424`

## Replay Verification

- **Replay target:** Re-route the Example Marketplace WI-012 scenario (user-facing bugfix, code already committed) against the updated `route-workflow` + `diagnose-bug` contracts. Verify that:
  1. Lane 4 is unambiguously selected (not "chore", not "create new skill")
  2. Retroactive mode is triggered because code is in main
  3. Pattern scan is mandatory per step 4.5
  4. `write-e2e` is mandatory per Lane 4 step 5 (user-facing surface)
  5. Every response ends with a `**Next:**` trailer per Output Protocol
  6. All tier-1 evals still pass

- **Result:** **PASS**
  - Tier-1 evals: 7/7 scripts passed, 3,136 total checks (lint-skills-manifest: 48 skills / 31 routing / 12 coreyhaines; validate-contracts: 239; validate-skill-structure: 543; validate-worktree-safety: 6; validate-frontmatter-ast: 1357; validate-markdown-ast: 991; chain-references: passed)
  - Scenario replay: every previously-wavering decision now has an explicit contract rule ruling the wrong answer out. "Do not propose a new skill to handle out-of-band fixes" is in diagnose-bug What-Not-To-Do. "MANDATORY for any user-facing or admin-facing surface" is in Lane 4 step 5. "Pattern Scan" is self-verify check #4. Output Protocol requires `**Next:**` on every response.

- **Evidence:** See test-framework tier-1 run above + WI-012 scenario walk in the "Replay scenario verification" section of this improvement run.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry "2026-04-09: Retroactive Lane 4 + Mandatory E2E + Output Protocol (Example Marketplace WI-012 evidence)" with root cause, implementation summary, replay result
- **Known Gaps:** No existing gaps moved (these were new findings)
- **Decisions Made:** Add "User-facing bugfixes require runtime E2E verification — source-grep assertions are not sufficient (locked 2026-04-09 based on Example Marketplace WI-012)"; "Out-of-band fixes use retroactive Lane 4 via existing diagnose-bug — no new close-out skill (locked 2026-04-09)"
- **Current State:** No numeric changes (skills remain 48)
- **Capabilities:** Update `references/knowledge/svc/CAPABILITIES.md` — add "Retroactive Lane 4 execution" and "Output Protocol next-command trailer" capability rows

## Status

**IMPLEMENTED** (2026-04-09, commit `0dac0d81c37d4a53384cc7621d8109757ab19424`)
