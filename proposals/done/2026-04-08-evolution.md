# Framework Evolution — 2026-04-08

**Status:** IMPLEMENTED (2026-04-08, replay verified by tier-1 framework checks; P3 remains a tracked non-actionable gap)

## Method
Read `FRAMEWORK-STATE.md` first, then audited `DOCTRINE.md`, `skills-manifest.json`, every skill frontmatter plus targeted body sections where contracts looked suspect, historical test evidence under `test-framework/results/`, completed proposals under `proposals/done/`, and `references/skill-pack-comparison.md`. I looked for new evidence-backed gaps, drift, inefficiencies, and fragility that are not already locked or explicitly deferred in `FRAMEWORK-STATE.md`.

## Findings (by priority)

### P0 — Fix now (blocks quality)

| Severity | Category | Finding |
|---|---|---|
| P0 | Drift / Fragility | Contract consistency is still not machine-checked, so manifest order, frontmatter chaining, and live continuation text diverge in ways that can skip required phases. |

Evidence:
- `write-journeys/SKILL.md:19-24` still declares `brownfield-feature: ... next: design-tech`, while `skills-manifest.json:179-183` requires `design-ux`, `design-ui`, and `track-visuals` before `design-tech`.
- `design-ui/SKILL.md:1135-1143` still chains directly to `design-tech`, while `skills-manifest.json:82-99` and `skills-manifest.json:170-183` place `track-visuals` between `design-ui` and `design-tech`.
- `execute-changeset/SKILL.md:515-523` still chains directly to `review-gate`, while `skills-manifest.json:92-98` requires a post-execution `track-visuals` step first.
- `proposals/done/2026-04-08-framework-improvement.md:3-4` and `proposals/done/2026-04-08-framework-improvement.md:20-29` mark the visual-tracking contract fix as implemented and replay-verified, but the live chaining text above shows the operational path is still wrong.

Specific fix:
- Add a contract-consistency linter that compares, per lane, all of: `skills-manifest.json` ordering, skill frontmatter `prev`/`next`, and any explicit continuation command in the skill body.
- Add a tier-1 eval that fails when any progressive handoff skips a manifest step or routes to a different next skill than the declared lane order.
- Treat “done proposal” status as invalid until this replay passes.

### P1 — Fix soon (degrades quality)

| Severity | Category | Finding |
|---|---|---|
| P1 | Gap | `review-security` and `review-cross-model` claim automatic progressive invocation, but the pipeline has no encoded hook that can ever invoke them automatically. |

Evidence:
- `review-security/SKILL.md:4-8` says it runs “automatically in progressive mode after design-tech” for risky features, but `review-security/SKILL.md:17-20` has no lane placement and `skills-manifest.json:82-99` / `skills-manifest.json:170-200` never include it in the pipeline or any lane.
- `review-cross-model/SKILL.md:8-10` says it runs “automatically in progressive mode after review-gate” for new data models or integrations, but `review-cross-model/SKILL.md:20-23` has no lane placement and `skills-manifest.json:82-99` / `skills-manifest.json:170-200` never include it either.
- `proposals/done/2026-04-04-gstack-blend-plan.md:119-125` explicitly envisioned `review-security` “between G4 and plan-changeset”, but that routing never landed in the manifest.

Specific fix:
- Introduce conditional lane hooks in the manifest, for example `after: design-tech if featureTraits includes security-sensitive`, and `after: review-gate if featureTraits includes new-data-model|integration`.
- Make `design-tech` and `review-gate` emit the feature-trait flags those hooks depend on.
- Remove “automatic” wording from skill descriptions until the hook exists.

| Severity | Category | Finding |
|---|---|---|
| P1 | Gap | The doctrine’s mandatory decision-log invariant is not enforced by skill contracts, so the pipeline cannot reliably resume or audit decisions the way it claims. |

Evidence:
- `DOCTRINE.md:976-983` says every skill must append the decision log and that the log is a primary resume source.
- `skills-manifest.json:109-115` repeats that `all-pipeline-skills` update `.svc/pipeline-decisions.jsonl`.
- In actual skill contracts, only `route-workflow/SKILL.md:1176-1249` defines the full logging protocol and only `quick-fix/SKILL.md:111-117` contains a concrete write step.
- `rg -n "pipeline-decisions\\.jsonl|.svc/pipeline-decisions\\.jsonl" */SKILL.md` returns only `route-workflow/SKILL.md` and `quick-fix/SKILL.md`, which means the rest of the skill pack does not encode the required behavior.

Specific fix:
- Create a shared logging contract snippet or reference doc that every skill must link in its Pipeline Continuation section.
- Add a static check: any skill marked `progressive: true` or any pipeline skill in the manifest must reference decision-log write behavior.
- Update `test-framework` to fail if the pipeline cannot prove where a run stopped from disk artifacts alone.

### P2 — Improve when possible (nice to have)

| Severity | Category | Finding |
|---|---|---|
| P2 | Drift | Comparison and proposal artifacts are stale enough to mislead future evolution work. |

Evidence:
- `references/skill-pack-comparison.md:43-45` still lists Cross-Model Review and Security Audit as `— gap —`, even though `skills-manifest.json:33-35` includes `review-cross-model` and `review-security`.
- `references/skill-pack-comparison.md:54` lists Learning/Memory as `— gap —`, even though `skills-manifest.json:36` includes `manage-learnings`.
- `references/skill-pack-comparison.md:59` lists Skill Creation as `— gap —`, even though `skills-manifest.json:44` includes `create-skill`.
- `proposals/done/2026-04-08-framework-improvement.md:3-4` claims implementation closure in an area that still fails the live contract check above.

Specific fix:
- Add a stale-reference audit to `improve-framework` and `evolve-framework`: any “gap” row in comparison docs must be cross-checked against `skills-manifest.json`.
- Add a `PARTIAL` or `REGRESSED` status for proposals in `proposals/done/` when replay evidence no longer matches the claim.
- Require any proposal moved to `done/` to record the exact replay command plus one invariant check tied to the affected contract.

### P3 — Track (not actionable yet)

| Severity | Category | Finding |
|---|---|---|
| P3 | Opportunity | The doctrine still has evidence debt on its strongest empirical claims, and the test framework has not closed it yet. |

Evidence:
- `test-framework/results/aggregate-report.md:17-25` says doctrine verification is only partially met.
- `test-framework/results/aggregate-report.md:84-90` marks C1 as only qualitatively supported and C7 as not tested.
- `test-framework/results/aggregate-report.md:99-101` and `test-framework/results/aggregate-report.md:128-133` explicitly recommend repeated runs for variance and a parallel-worktree scenario for C7.
- `DOCTRINE.md:642-644` and `DOCTRINE.md:719-724` make concrete claims about parallel task execution, but the framework has not yet produced matching replay evidence.

Why not actionable yet:
- This is real methodology debt, but it needs new eval scenarios and probably runnable multi-feature fixtures, not just contract edits.

Specific fix when ready:
- Add an autopilot scenario that runs the same greenfield spec multiple times and compares variance in downstream artifacts.
- Add a parallel-worktree eval that executes two independent feature branches and checks isolation, merge safety, and decision-log replay.

## Comparison delta
The meaningful competitor delta is enforcement, not breadth. gstack and superpowers both lean harder on operational checks that keep their own process claims honest: gstack’s automation mindset shows up in things like `/autoplan` and template validation, while superpowers explicitly pressure-tests skills and review flows. svc already has many of the capability nouns now, but the current evidence shows it still lacks the machine-checked contract layer that would keep manifest order, skill chaining, logging, and proposal closure from drifting apart.

The practical takeaway: do not add more standalone skills first. Close the enforcement gap around existing contracts. That yields better quality than adding another review or planning artifact that can also drift.

## Stale proposal audit
- `proposals/`: no pending proposal files currently exist. Everything is either implemented or at least filed under `proposals/done/`.
- `proposals/done/2026-04-08-framework-improvement.md`: should be treated as partially regressed, not fully closed, because the operational `track-visuals` handoff still skips the manifest step.
- `proposals/done/2026-04-04-gstack-blend-plan.md`: partially landed. `review-security` and `manage-learnings` exist as skills, but the pipeline wiring it proposed at `proposals/done/2026-04-04-gstack-blend-plan.md:121-125` and `proposals/done/2026-04-04-gstack-blend-plan.md:145-151` is still incomplete.
- Remaining `proposals/done/*`: no direct contradiction surfaced in this audit, but they were not exhaustively replayed beyond the contract surfaces above.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Proposal file exists | `test -f proposals/done/2026-04-08-evolution.md` | PASS |
| 2 | Every finding cites file:line | manual scan of Findings sections | PASS |
| 3 | FRAMEWORK-STATE.md was read first | audit started from `FRAMEWORK-STATE.md`; findings avoid already-fixed/locked items | PASS |
| 4 | Findings are ranked by impact | P0-P3 sections plus severity tables present | PASS |
