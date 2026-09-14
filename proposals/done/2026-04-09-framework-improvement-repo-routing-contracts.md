# Framework Improvement: Repo Routing Contracts + Delegation Topology

## Status

**IMPLEMENTED** (2026-04-09, worktree-only; replay verification passed; no commit requested)

## Evidence
- **Source:** `proposals/done/2026-04-09-evolution-repo-routing-contracts.md`
- **Finding:** Router trusted `project-state.md` as a complete continuity source even when repo-critical routing rules still lived in repo docs and platform config; Pre-Flight checked skill directories but not repo contracts; delegation decisions were based on generic platform capability rather than repo-local topology.
- **Severity:** high

## Diagnosis
- **Root cause:** The framework had strong task-state and self-verify contracts, but no explicit repo-routing contract layer. Brownfield repos could be "mapped" without a canonical place for deploy/runtime overrides, code-style authority, or delegation boundaries. Generic platform heuristics therefore had no deterministic precedence against repo-local overrides.
- **Category:** fragility
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation
- **Route:** direct SKILL.md edit + targeted validator hardening
- **Files changed:**
  - `route-workflow/SKILL.md`
  - `onboard-repo/SKILL.md`
  - `audit-coverage/SKILL.md`
  - `execute-changeset/SKILL.md`
  - `references/knowledge/svc/CAPABILITIES.md`
  - `test-framework/evals/tier-1/validate-framework-self-management.sh`
  - `FRAMEWORK-STATE.md`
  - `proposals/done/2026-04-09-evolution-repo-routing-contracts.md`
- **Commits:** none — no commit requested; worktree-only implementation atop the current branch

## Replay Verification
- **Replay target:** Router/Pre-Flight/self-management contract replay for repo-routing context, agent-topology contract, precedence rule, and execute-changeset delegation check.
- **Result:** PASS
- **Evidence:**
  - `node scripts/lint-skills-manifest.mjs` → PASS (`49` included skills, `32` routing core skills)
  - `bash test-framework/evals/tier-1/validate-framework-self-management.sh` → PASS (`186 passed, 0 failed`)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry documenting repo-routing contract hardening, brownfield artifact expansion, delegation-topology check, and replay results.
- **Known Gaps:** no gap removed; this closes a newly identified router fragility rather than a pre-existing deferred item.
- **Decisions:** brownfield mapping now requires `router-context.md` and `agent-topology.md`; routing precedence is `repo override > project-local platform rule > generic platform heuristic > global fallback`.
- **Capabilities:** yes — add repo routing contract, repo delegation topology, Pre-Flight repo-contract scan, and Current Focus to `references/knowledge/svc/CAPABILITIES.md`.
