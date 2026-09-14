# WI-366 batch-1 manifest — core-skill diet (compressed tier)

**Status:** EXECUTING | Branch: feature-wi-366-core-skill-diet | Base: main e6514058 | Tier: compressed (decision-logged; renegotiated 2-3 skills/run w/ per-skill gates)

## Scope (batch 1 of 2)
write-spec 1106→180 · plan-changeset 830→289 · execute-changeset 851→298 (**2,787→767, −72%**). route-workflow already 204 ≤300 (verified, no change). Batch 2 (next run): review-gate 859.

## Method — behavior-preserving restructure
Per-mode/per-detail sections moved VERBATIM into `<skill>/references/*.md` (9 new files); SKILL.md keeps frontmatter (byte-identical), every mandatory step/gate as a compressed-but-complete mandate + pointer, Self-Verify tables verbatim, ONE canonical record-phase line (validator-pinned string) + pointer (WI-363 ceremony absorption), single deduped Pipeline-Continuation/Chain-Receipt blocks (originals carried doubles).

## Files
3 MODIFY SKILL.md + 9 CREATE references/ (write-spec: scope-review, authoring-modes, spec-section-templates, process-details, task-graph-setup; plan-changeset: archetype-protocols, manifest-templates, simulation-protocol, adversarial-review-detail; execute-changeset: dispatch-preflight, subagent-dispatch, process-details) + 2 test-asset prompts (write-spec.txt NEW 6Qs authored from pre-diet content; plan-changeset.txt brittle 2-term/100%-threshold pattern enriched — parity-proven pre-existing vs original).

## Per-skill gates (all run, all green)
| Skill | Lines | Comprehension (claude runner; kimi 402-dead membership) | Validators |
|---|---|---|---|
| write-spec | 180 | 6/6 PASS | structure/self-verify/chain/phase-migration/lint PASS |
| plan-changeset | 289 | 3/3 PASS (post pattern-fix; original scored SAME 1/2 on the brittle Q — parity) | PASS |
| execute-changeset | 298 | 3/3 PASS | PASS |

## External State
None (skill text + repo test assets only; symlinks unchanged — content flows on merge). Untouched: all 15 taxonomy entries.

## RECOVERY_IF_FAIL
git revert squash; references/ files are additive.
