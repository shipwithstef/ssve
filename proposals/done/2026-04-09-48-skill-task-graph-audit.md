# Framework Improvement Proposal: Full 48-Skill Task-Graph Chaining Audit

## Status: IMPLEMENTED (2026-04-09, commit `2176c60ae4fda8d36ebcfee44b1caef52daaf02a`; proposal moved to `done/` in `6991fed19af5ab7f9ef73bf5fbddaa0a91b36010`)

## Evidence

- **Source:** Example Marketplace WI-012 session, 2026-04-09 — user flagged that the Task-Graph Execution Protocol inheritance rule ("all 48 skills inherit by reference") is insufficient. Skills should explicitly have the Task-graph mode block in their Chaining sections so that: (a) the Skill tool loads the block when the skill fires, (b) the agent sees the TaskUpdate obligation in-context, (c) there's no ambiguity about whether a specific skill participates.
- **Finding:** Only 7 of 48 skills had the explicit Task-graph mode block in their Chaining sections (diagnose-bug, plan-changeset, execute-changeset, review-gate, write-e2e, land-changeset, verify-promotion). The remaining skills either inherited by reference to `route-workflow` or lacked a `### Chaining` section entirely. This worked in theory but failed in practice — an agent loading `write-spec/SKILL.md` would not see the TaskUpdate obligation unless it also loaded `route-workflow`, which it would not.
- **Severity:** MEDIUM (the 7 critical-path skills cover Lane 4 end-to-end; the remaining 41 matter when Lanes 1, 3, 5, 6 run as task graphs)

## Diagnosis

- **Root cause:** The Task-Graph Execution Protocol was implemented as a quick-fix (Level A) focused on Lane 4. The 7 Lane 4 skills got explicit blocks. The other 41 got an inheritance rule — but inheritance-by-reference doesn't put the obligation in the agent's context window when the skill loads.
- **Category:** fragility (inheritance-by-reference vs explicit-in-context)
- **Already in FRAMEWORK-STATE.md?** Partially — the Level B auto-advance state machine is deferred. This proposal is Level A completion, not Level B.

## Proposed Implementation

- **Route:** Mechanical batch edit across all 47 non-router SKILL contracts plus targeted router/state-doc edits
- **What was done:**
  1. Added or refreshed the standard Task-graph mode block in every non-router skill
  2. Added `### Chaining` sections where only `## Pipeline Continuation` existed before
  3. Added `test-framework` pipeline continuation coverage so the framework lane is explicit end-to-end
  4. Updated `route-workflow` to remove inheritance-by-reference and document Claude vs Codex mechanics explicitly
  5. Added Codex guidance: use `lane-tasks.json` + `update_plan` for task-state mirroring and open the named `SKILL.md` directly because Claude task APIs are not available in the Codex host profile
- **Verification:** Run manifest lint and tier-1 evals after the batch. Spot-check representative skills across lanes to confirm the block is correctly placed.

## Verification

- `node scripts/lint-skills-manifest.mjs` — PASS
- `bash test-framework/evals/run-all-evals.sh` — PASS (tier-1 only, 7 scripts passed, 0 failed)

## Why This Matters

The execution rule in route-workflow says: "An agent that 'just does the work' without loading the skill is violating the framework." But the reverse is also true: a skill that doesn't tell the agent about TaskUpdate is setting it up to forget. The obligation must be IN the skill's context, not just referenced from route-workflow.

## Dependencies

None. Can be done independently in a fresh session.

## Recommended Session

Spawn a subagent or dedicate a short session to:
1. `grep -l "### Chaining" */SKILL.md` — get the full list
2. Filter out the 7 already done
3. Batch-edit the remaining 41
4. Run tier-1 evals
5. Commit + push
