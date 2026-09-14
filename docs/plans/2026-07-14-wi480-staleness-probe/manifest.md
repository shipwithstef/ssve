# WI-480 Change-Set Manifest — Upstream-staleness probe (blend item 3)

**Date:** 2026-07-14 | **Lane:** framework | **Risk class:** M (registry field backfill + skill-doc; no code logic)
**Execution mode:** inline single-orchestrator (one worktree, one implementation commit)
**Spec:** `docs/specs/work-items/WI-480.md` ACs + `proposals/2026-07-13-blend-coreyhaines-v2.6.0.md` § Blend item 3

## File set & two-commit strategy

**Commit P (planning, exempt, lands on main BEFORE the worktree):** this manifest, review-log.yaml (+ raw captures), mechanical-gate.log, `.svc/lane-tasks-WI-480.json`, `.svc/pipeline-decisions.jsonl` appends. (WI-480.md + INDEX row landed in filing commit 22df12ef.)

**Commit M (implementation, worktree branch `WI-480-staleness-probe`):** blueprints #1–3.

## Scope decisions

1. **Backfill `upstream_ref_cmd` on the 14 sources that MISS it** (only coreyhaines HAS it, added WI-476). Per source type:
   - **Release-TAG-pinned GitHub repo** (`get-shit-done` v1.34.2; `coreyhaines` already v2.6.0): `gh release list -R <owner/repo> -L 1`.
   - **SHA/HEAD/date-pinned GitHub repo** (the other 12 — gstack, superpowers, oh-my-claudecode, claude-code-setup, anthropic-skills, harness, last30days-skill, everything-claude-code, taskmaster, taste-skill, capacitor-skills, gsd-2): `git ls-remote https://github.com/<owner/repo> HEAD` — because these track commit SHAs, not releases; `gh release list` on a release-less repo returns empty and mis-reports. (AGY review-plan finding 1.)
   - **Non-repo source** (`lucaspatiri-ugc-viral`, an x.com URL): `upstream_ref_cmd: null` + `staleness_note: "manual — social post, no versioned upstream"` so audit mode reports it as manual-check, not silently skips.
2. **blend-external audit mode (mode 3)** gains a mechanical step: run each source's `upstream_ref_cmd` BEFORE analysis and emit a **stale-sources table** (registered SHA/tag vs current upstream ref; null-probe sources listed as manual).
3. **blend-external self-verify** gains a row: "source being analyzed exists in blend-registry — if absent, register a baseline entry before writing the plan" (WI-476's coverage-gap miss, made structural).
4. **What NOT to take (honored):** no upstream JS sync tooling (svc linter covers manifest drift); no per-skill semver (WI-CLN-15 done). The optional evolve-framework feeder is documented as a pointer, not built here (kept minimal).
5. **No mobile/deploy surface** — deploy + mobile-build N/A.

## External State Lifecycle

| # | Environment | This plan | Coupling |
|---|-------------|-----------|----------|
| 3 | Out-of-tree version-controlled | **TOUCHED** — branch `WI-480-staleness-probe` + sibling worktree | coupled → create/land/remove; abort cleanup: remove worktree (worktree.sh remove) + delete branch |
| 12 | Downstream framework artifacts | **TOUCHED** — `blend-external/SKILL.md` (a skill doc) + `references/blend-registry.json` (data). No generated mirror (blend-external is not an agent). | coupled → tier-1 validates skill structure |
| 1,2,4,5,6,7,8,9,10,11,13,14,15 | (host fs, config, registries, schedulers, services, SaaS, DB, caches, DNS, search, CI, secrets, runtime fs) | untouched | — |

**Note (runtime probe commands):** `upstream_ref_cmd` values are DATA (strings stored in the registry), not executed by this WI — audit mode runs them later, at blend-audit time. No network calls, no external state mutation here.

## File blueprints

| # | File | Action |
|---|------|--------|
| 1 | `references/blend-registry.json` | Add `upstream_ref_cmd` to the 14 sources missing it (13 GitHub → gh release list form; 1 x.com → null + manual note). Valid JSON; coreyhaines entry unchanged. |
| 2 | `blend-external/SKILL.md` § "3. Audit — check all sources" | Add the mechanical stale-sources-table step (run each `upstream_ref_cmd`, compare to registered SHA/tag, null-probe = manual) WITH explicit parsing rules: (a) extract the first whitespace token of the command output (git ls-remote emits `<40-hex>\tHEAD`; gh release list emits the tag in col 1); (b) tag sources → compare the tag string (normalize a leading `v`); (c) sha sources → prefix-match (registered short-sha is a prefix of the 40-hex remote sha, or vice versa) since registry stores short/8-char shas; (d) null probe → row = MANUAL. |
| 3 | `blend-external/SKILL.md` Self-Verify table | Add a registry-coverage row: source-under-analysis must exist in blend-registry, else register a baseline entry first |

## Execution Command Sequence

```bash
set -euo pipefail
ROOT=/workspace/seriousvibecoding
# commit P lands on main FIRST, then:
bash scripts/worktree.sh create WI-480-staleness-probe
WT="$ROOT/.worktrees/WI-480-staleness-probe"; cd "$WT"
# blueprint #1: backfill registry (python, valid-JSON round-trip)
node -e "JSON.parse(require('fs').readFileSync('references/blend-registry.json','utf8'))"   # valid JSON
# assert every source now has upstream_ref_cmd (present-or-null, no missing key)
node -e "const r=require('./references/blend-registry.json'); const miss=r.sources.filter(s=>!('upstream_ref_cmd' in s)); if(miss.length){console.error('MISSING:',miss.map(s=>s.name));process.exit(1)} console.log('all',r.sources.length,'sources have upstream_ref_cmd key')"
# assert the x.com source is null-with-manual-note, GitHub sources carry a probe
node -e "const r=require('./references/blend-registry.json'); const luca=r.sources.find(s=>s.name==='lucaspatiri-ugc-viral'); if(luca.upstream_ref_cmd!==null){console.error('lucaspatiri should be null');process.exit(1)} const gh=r.sources.find(s=>s.name==='gstack'); if(!/git ls-remote/.test(gh.upstream_ref_cmd)){console.error('gstack (sha-pinned) must use git ls-remote');process.exit(1)} const gsd=r.sources.find(s=>s.name==='get-shit-done'); if(!/gh release list/.test(gsd.upstream_ref_cmd)){console.error('get-shit-done (tag-pinned) must use gh release list');process.exit(1)} console.log('probe forms ok (per pin-type)')"
# blueprints #2-3: skill doc
grep -q 'stale-sources table' blend-external/SKILL.md
grep -qi 'exists in .*blend-registry\|registered in blend-registry\|register a baseline' blend-external/SKILL.md
bash test-framework/evals/run-all-evals.sh --tier1
# then: review-exec (G6) -> audit -> land -> verify-promotion
```

## Prerequisite Alignment Matrix

| Upstream skill | Status | Evidence |
|----------------|--------|----------|
| route-workflow | completed | session contract + lane graph |
| blend-external (WI-476) | completed | blend plan item 3 (merged) |
| write-spec / design-ux / design-ui / define-code-style | skipped | decisions logged; registry data + skill-doc, no code/UX |
| design-tech | completed-inline | probe form per source-type (gh release list / git ls-remote / null-manual) — task-4 receipt + decision ledger |
| explore-solutions | completed-inline | blend plan specifies the probe (pure transplant); evolve-framework feeder documented not built — task-5 receipt |
| plan-changeset | completed | this manifest |

## Validation plan

| Check | Command | Expected |
|-------|---------|----------|
| Mechanical plan gate | `bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-14-wi480-staleness-probe/manifest.md` | PASS |
| Valid JSON + full coverage | Exec assertions | all sources have the key; probe forms correct |
| Skill-doc additions | Exec greps | stale-sources table + coverage self-verify present |
| Tier-1 | tier-1 suite | all pass |

## Checkpoints & rollback

- Commit P → worktree commit M → PR + merge → verify-promotion (lint+tier1). No machine flip.
- Rollback (commit-scoped): `git revert <commit-M-merge-sha>` — additive registry field + skill-doc; no code logic.
- Blast radius: blend-audit thoroughness. Worst case: a probe string is wrong → audit reports a false stale/fresh; caught the next time audit runs the command (it's data, re-editable).
