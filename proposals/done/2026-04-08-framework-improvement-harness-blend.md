# Framework Improvement: Harness Blend Implementation

## Evidence
- **Source:** blend-external analysis of https://github.com/revfactory/harness
- **Finding:** 6 patterns identified from complete knowledge extraction (7/7 source files, 8 detail files)
- **Severity:** medium-high (fills real gaps in agent dispatch, verification, and communication)

## Diagnosis
- **Root cause:** svc had no vocabulary for agent dispatch patterns, no description quality standard, no integration boundary verification, no communication adaptation
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** no (first harness blend)

## Implementation
- **Route:** direct SKILL.md / reference doc edits (6 targeted changes)
- **Files changed:**
  - `references/agent-patterns.md` (NEW)
  - `references/anti-patterns.md` (AP-19 added)
  - `references/verification-patterns.md` (Integration Coherence section)
  - `route-workflow/SKILL.md` (Communication Adaptation section)
  - `test-framework/evals/tier-1.5/test-skill-triggering.sh` (manifest + near-miss note)
  - `research/SKILL.md` (self-verify table fix)
  - `NOTICES` (Harness attribution)
  - `FRAMEWORK-STATE.md` (blend history)
- **Commits:** f216b23

## Replay Verification
- **Replay target:** tier 1 eval suite (all 5 scripts)
- **Result:** PASS (5/5)
- **Evidence:** lint passed (46 skills, 30 routing), all chain refs valid, all contracts valid, all self-verify sections valid, all structure valid, worktree safety valid

## FRAMEWORK-STATE.md Mutations
- **Blend History:** added harness row (6 patterns, 2026-04-08)
- **Known Gaps:** none moved (this was new capability, not fixing a gap)
- **Decisions:** agent definition convention is recommendation, not requirement
- **Capabilities:** yes — update svc/CAPABILITIES.md with agent patterns, boundary detection, communication adaptation
