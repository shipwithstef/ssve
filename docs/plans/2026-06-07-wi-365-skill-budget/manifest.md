# WI-365 manifest — skill-catalog budget, layers L0/L1/L4/L5 (compressed tier)

**Status:** EXECUTING | Branch: feature-wi-365-skill-budget | Base: main 985a8d5d | Tier: compressed (decision-logged)
**Archetype:** cross-cutting concern — entry points enumerated mechanically (L0 tool); universe = 214 installed skills, 96,594 desc chars = **241% of default 1% budget** (live eviction active), 0 skills on the zero-cost lever today.

## Layer scope THIS run
L0 (measure tool + committed baseline) · L1 (dmi on the 3 mechanically chain-independent skills) · L4 (desc diet on top svc-owned fat descriptions + local budget knob 0.02 + skillOverrides name-only for the near-miss set) · L5 (routing-rules router-safety note). **L2 plugins + L3 paths → follow-up WI** (filed at closeout w/ L0 evidence) — keeps this run off setup/provision.

## Files Planned
| # | File | Action |
|---|---|---|
| 1 | scripts/measure-skill-budget.mjs | CREATE — occupancy report: per-skill desc chars, pack split, budget math @fraction, top-N, dmi count |
| 2 | scripts/check-chain-independence.mjs | CREATE — L1 eligibility: laneDefinitions/corePack/bootstrap memberships + repo-wide ref scan; prints eligible + near-miss |
| 3-5 | suno-architect, svc-advisor, wsl2-audio SKILL.md | MODIFY — `disable-model-invocation: true` (mechanically eligible: zero memberships, zero refs) |
| 6 | ~top-18 svc-owned fattest SKILL.md descriptions | MODIFY — key-use-case-first rewrite, target ≤300 chars, preserve trigger nouns/verbs; exact list = includedSkills ∩ measurement top list (external packs EXCLUDED per anti-goal 4; their diet rides L2) |
| 7 | route-workflow/references/routing-rules.md | MODIFY — L5 note: router resolves from skills-manifest file reads; never assumes system-prompt visibility; deferred skills keep router+user triggering |
| 8 | docs/analysis/skill-budget-baseline-2026-06-07.md | CREATE — L0 baseline + after-numbers + host-config appendix (knob, overrides, backup/restore) + trigger-reliability statement |
| 9 | docs/specs/work-items/WI-365.md (+INDEX at closeout) | MODIFY |

## External State
| # | Environment | What | Coupling | Wiring |
|---|---|---|---|---|
| 1 | ~/.claude/settings.json | `skillListingBudgetFraction: 0.02` + `skillOverrides` name-only for near-miss set | decoupled-justified | machine-local host config; timestamped backup + printed restore line; documented in analysis doc §Host-config; NOT repo state — per-host adoption rides L2 follow-up (wire-hooks/plugins) |
| 2 | ~/.claude/skills symlinks | dmi/desc edits flow through EXISTING links | coupled | no installer change; links resolve to the MAIN checkout — frontmatter effects activate ON MERGE (G7 re-measures post-merge); settings knob live immediately; AP-30 untouched |
Untouched: all other taxonomy entries (no installer, no provision, no CI, no DB).
Decoupling justification: host knob is per-machine tuning; drift detection = L0 tool re-run prints active fraction effect; recovery = restore line in doc.

## Anti-stall proof (L1)
lane memberships 38 + core 46 + bootstrap 23 + chain-out-of-lane all excluded; ref-scan over */SKILL.md, references, scripts, hooks excludes 15 near-misses (incl. review-cross-model 9 refs, capability-registry 12) → eligible = {suno-architect, svc-advisor, wsl2-audio} ONLY. Chain participants untouched → G6 cannot stall.

## Validation
frontmatter-ast (2528) + skill-structure + lint + chain-references; L0 tool before/after (target: svc-owned desc total −10K+ chars); trigger probe = chain-references PASS + router-resolution note (router never reads descriptions). RECOVERY_IF_FAIL: git revert single checkpoint; settings restore from backup.

## AC
1. L0 tool committed, reproducible report; baseline doc cites 241% + after-number
2. dmi exactly 3, all mechanically proven; check tool committed for future adds
3. ≥15 svc-owned descriptions ≤300 chars (from ≥700 avg), trigger nouns preserved
4. routing-rules carries L5 note inside existing prose (no contract change)
5. Local knob+overrides applied w/ backup + restore line documented
6. Follow-up WI filed for L2/L3 with measured evidence
