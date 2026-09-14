# Framework Improvement: End-to-End Review Remediation

## Evidence
- **Source:** User-requested end-to-end framework code review with 38 validated findings
- **Finding:** Runtime enforcement, host-parity contracts, state/docs, and done proposals had drifted out of sync. The main concrete gaps were: prose-only task-state ownership without helper scripts, completion-guard behavior mismatching its docs, stale builder-profile ownership/path expectations in validators and host profiles, and framework memory that still advertised superseded or unverified states.
- **Severity:** high

## Diagnosis
- **Root cause:** Several 2026-04-09 framework upgrades landed quickly and correctly at the contract level, but the surrounding runtime and memory layer did not keep up. The repo had strong declarations (`lane-tasks.json` is primary, builder profile is global, Codex has a parity path) without the supporting helper scripts, bootstrap directories, validator allowances, and proposal/state backfill that make those declarations durable.
- **Category:** drift + fragility
- **Already in FRAMEWORK-STATE.md?** partially — individual gaps were present across recent analysis entries, but this clustered remediation pass is new

## Implementation
- **Route:** grouped framework fixes: direct SKILL/doc edits + runtime helper scripts + validator updates
- **Files changed:** `hooks/svc-task-completion-guard.sh`, `hooks/hooks.json`, `scripts/pipeline-log.mjs`, `scripts/task-graph.mjs`, `skills-manifest.json`, `route-workflow/SKILL.md`, `DOCTRINE.md`, `README.md`, `provision/hosts/claude.json`, `provision/hosts/codex.json`, `FRAMEWORK-STATE.md`, `references/knowledge/svc/CAPABILITIES.md`, `references/knowledge/svc/details/{references,infrastructure}.md`, `test-framework/evals/tier-1/{validate-framework-self-management.sh,validate-contracts.sh}`, bootstrap docs under `docs/`, and the affected 2026-04-09 done proposals
- **Commits:** `bfeec7af9d40ac9da34d0e055581f40b80caa979`

## Replay Verification
- **Replay target:** helper/runtime smoke + full tier-1 framework replay
- **Result:** PASS
- **Evidence:** `node scripts/lint-skills-manifest.mjs`; task-graph helper smoke; pipeline-log helper smoke; completion-guard smoke; `bash test-framework/evals/run-all-evals.sh` → PASS (tier-1: 8 scripts passed, 0 failed)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added `2026-04-09: End-to-End Framework Review Remediation (38 findings)`
- **Known Gaps:** no new gap added; existing deferred items unchanged
- **Decisions:** no new core design decision, but existing builder-profile/task-graph/Stop-hook decisions were made operationally consistent
- **Capabilities:** yes — updated `references/knowledge/svc/CAPABILITIES.md` and Layer 3 infrastructure/reference details
