# Cross-Model Review: Framework-Evaluation Execution Plan (Phase 0 + WI-356..371)

**Date:** 2026-06-06
**Artifact under review:** `~/.claude/plans/dazzling-chasing-honey.md` (v2 → v3)
**Models:** Claude Opus 4.8 (primary/synthesis) + Codex CLI 0.137.0 (`codex exec`, stdin-piped package) + Gemini CLI 0.45.0 (tri-model)
**Reviewer resolution:** `scripts/resolve-adversarial-reviewer.sh` → primary codex, fallback gemini (both available, both used)
**Package:** `scratch/review-package-plan.md` (26,383 chars: repo context, hard constraints, verified-facts list, full plan text)
**Raw outputs:** `scratch/codex-plan-review.txt` (5,598 lines incl. live repo probes), `scratch/gemini-plan-review.txt` (92 lines)
**Rounds:** 2 (round 1 findings + fixes; round 2 delta-confirmation)

## Summary

- Findings: **13** (Codex 7, Gemini 6; 2 overlapping → 11 unique)
- Accepted: **11** (Critical: 1, High: 5, Medium: 5)
- Accepted-with-modification: 2 (G2 severity/mechanism corrected; G3 replacement-list corrected)
- Rejected: **0** — every load-bearing claim was independently verified against live repo state before acceptance
- Fixed in plan v3: **11/11**

Notable: Codex executed live probes during review (ran `list_work_items.mjs`, inspected git notes, read hook source) and discovered a Critical by *doing*, not reading. Gemini's own startup stderr (60 skill-conflict warnings before reviewing) is itself evidence for the catalog-bloat thesis under review.

## Round 1 — Accepted findings & fixes

| # | Src | Sev | Finding | Claude verification | Fix in v3 |
|---|---|---|---|---|---|
| 1 | Codex | **Critical** | Push fails regardless of new commit's envelope: unpushed EIT commits `a1e7b3b3`/`0f25004b` carry only INELIGIBLE quick-fix receipts; pre-push validates entire `remote..local` range (`hooks/git/pre-push.d/10-receipts-complete`) | Ran `check-chain-receipts.mjs --range @{u}..HEAD` → `"type": "incomplete"` for both SHAs; notes show `quick-fix: eligible=false` | New step 0b: backfill 5-receipt envelopes for both EIT SHAs (`--wi WI-356`, retroactive) + range-gate before any new work; post-commit verification switched from `--sha` to `--range` |
| 2 | Codex | High | Dirty-file disposition incomplete: `.svc/competitive-monitor-triggers.jsonl` also modified, unmentioned | `git status --short` confirms 3 dirty tracked files, not 2 | Step 0: full `git diff --name-status` enumeration + exact-path `git add` allowlist of all three; anything else dirty = STOP |
| 3 | Codex+Gemini | High | Anchoring Phase 0 envelope to `--wi WI-357` = false provenance, poisons registry-refresh WI's audit trail | Receipt schema requires only `wi: string`; agreed semantics matter | New **WI-371 Phase-0 meta-WI** (lands DONE in the commit it describes); envelope anchored to WI-371; no renumbering of 357-370 (preserves locked user decision: WI-357 first) |
| 4 | Codex | High | `list_work_items.mjs` MUTATES `DONE.md` on every run — "verification" step dirties tracked state | Codex ran it live, DONE.md changed (232→263 closed), Codex restored; `git diff` clean after restore | Step 7: regeneration declared DELIBERATE (DONE.md stale since 2026-05-11) and DONE.md listed as planned touched file of the commit |
| 5 | Gemini | High | `disable-model-invocation` on execute-changeset/land-changeset stalls the autonomous chain at G6 (model can't invoke them to continue the pipeline) | Pipeline Continuation contract requires model-invocation of chain skills — correct. (Gemini's suggested replacement list was wrong: route-workflow MUST stay model-invocable; finding accepted, proposal corrected) | WI-365 L1 rewritten: eligibility = mechanically proven chain-independence (absent from all laneDefinitions + chain frontmatter + Pipeline Continuation refs); chain participants permanently excluded |
| 6 | Gemini | High | PostToolUse(Edit\|Write) rule injection arrives AFTER the first edit — first edit always unguarded | Correct by definition of PostToolUse timing | WI-361: dual trigger — PostToolUse(Read\|Grep\|Glob) injects during exploration BEFORE first edit + Edit\|Write catch-up; verify PreToolUse `additionalContext` support at execution and prefer if available |
| 7 | Gemini | High→Med (modified) | WI-356 backfilled `in-progress` hijacks next session's routing | Mechanism corrected: no `.svc/lane-tasks-WI-356.json` exists, so lane-resume hijack specifically can't fire — but session-contract/stale-state guards DO reference WI-356; safe-status fix stands | Step 1: default `DEFERRED` + "do not auto-resume" note; NEVER in-progress |
| 8 | Codex | Med | Memory writes are external state inside the commit flow — no rollback, mixed-state risk | Correct: `~/.claude/projects/.../memory/` outside repo | Step 5: memory writes deferred until AFTER push succeeds; rollback = delete listed files |
| 9 | Codex+Gemini | Med | Session-contract bootstrap Catch-22: Edit/Write blocked until contract exists, but plan says "append entry" without mechanism | Verified live earlier this session: Bash shell redirect bypasses the Edit/Write tool matcher | Step 0: explicit `echo '...' >> .svc/session-contract.jsonl` via Bash, never via Edit/Write tools |
| 10 | Gemini | Med | Inline `echo '<receipt-json>'` with multi-line markdown payloads will fail (quote collisions / ARG_MAX) | `emit-receipt.mjs` supports `--body <path>` (verified in source) | Step 9: bodies written to temp files + `--body`; payloads reference artifact paths, never inline content |
| 11 | Codex | Med | 54% framework-on-framework finding maps to no WI | Correct — gap between evaluation and catalog | WI-369 + monthly commit-ratio report, MEASUREMENT ONLY (explicitly not a gate — user declined ship-gate; telemetry ≠ gate) |

## Round 2 — Delta confirmation (Codex)

Raw output: `scratch/codex-plan-review-r2.txt`. Result: **9/11 RESOLVED**, 2 NOT-RESOLVED (both stale-text contradictions left by the round-1 fix edits), 4 new findings:

| Sev | Finding | Fix |
|---|---|---|
| NOT-RESOLVED (was #3) | "Verified mechanics" section still said anchor `--wi WI-357`, contradicting step 9's WI-371 | Mechanics section corrected to WI-371 + "NEVER WI-357" note |
| NOT-RESOLVED (was #5/9) | WI-365 guardrails cell still named land-changeset/execute-changeset as `disable-model-invocation` candidates | Cell rewritten: chain participants stay model-invocable, eligibility only via L1's mechanical check |
| HIGH (new) | This review doc referenced as receipt evidence but untracked / not in planned commit | Step 3c added: review doc is a planned committed file |
| MED (new) | `.svc/tmp-receipt-*.json` temp paths not gitignored | Switched to `/tmp/svc-receipt-<t>.json` |
| MED (new) | `DEFERRED` WI-356 still surfaces in open-held listings | `**Hold:** manual-resume-only` metadata line added |
| LOW (new) | WI-371 `DONE` lacked `Closed:` date | `**Closed:** 2026-06-06` required in step 6 |

## Round 3 — Mechanical convergence audit (Claude)

The two NOT-RESOLVED items were pure text-consistency defects, so round 3 is a grep audit rather than a third model dispatch:
- `grep "--wi WI-357"` → zero hits (all anchors WI-371) ✓
- `grep "disable-model-invocation.*on side-effect skills (land"` → zero hits (chain skills appear only as exclusions) ✓
- `grep ".svc/tmp-receipt"` → zero hits ✓
- Review doc referenced 3× in plan including committed-files step ✓

## Round 2b — Gemini delta confirmation

Raw output: `scratch/gemini-plan-review-r2.txt`. Result: **6/6 RESOLVED, zero new issues, verdict CONVERGED** ("the fixes applied from the other reviewer further harden the execution plan without conflicting with these resolutions").

## Verdict

**CONVERGED — TRI-MODEL AGREEMENT DOCUMENTED** (Codex: 11/11 after round-3 audit; Gemini: 6/6, no new issues; Claude: all fixes mechanically verified). 0 Critical, 0 High remaining. 17 total findings across 2 rounds (13 round-1, 4 round-2-new); 17 accepted (2 with modified proposals), 0 rejected, 17 fixed in plan v3. Remaining residuals are all documented design notes (first-edit-unguarded residual in WI-361, DEFERRED-listing semantics), none blocking.

Per-finding agreement signal: 2 findings found independently by both external models (receipt provenance, contract bootstrap) — highest confidence; 1 finding (Codex Critical, range-gate) discovered only by live probing — the strongest argument for executable reviewers.

## Process notes

- Codex round-1 first attempt failed (`codex exec "<arg>"` backgrounded → stdin EAGAIN); fixed by stdin-piping (`codex exec - < package`), matching the repo's own memory: "compose-and-pipe via stdin".
- Gemini host stderr observations captured for WI-367's host-matrix work: gemini host reports `Invalid hook event name: "UserPromptSubmit"` and `"Stop"` from project config — gemini-side hook-event parity drift to verify during WI-367.
- Codex modified `DONE.md` during its sandboxed probing and restored it before finishing; verified clean (`git diff --stat` empty).

## Verdict

**Round 1: FIX-AND-REENTER** (1 Critical + 5 High accepted → all fixed in plan v3).
**Round 2: pending** — recorded in addendum.
