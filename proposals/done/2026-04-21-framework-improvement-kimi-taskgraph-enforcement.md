# Framework Improvement: Kimi Task-Graph Enforcement

**Status:** IMPLEMENTED (2026-04-21)
**Source proposal:** `proposals/done/2026-04-21-evolution-kimi-taskgraph-enforcement.md`

## Evidence

The pending evolution proposal isolated four framework gaps exposed by the example-marketplace WI-099 Kimi session audit:

1. Kimi host/task-graph capabilities were described inconsistently across framework files.
2. `scripts/task-graph.mjs` enforced task shape but not graph-level closure semantics.
3. AP-27 ghost-execution enforcement had no host-agnostic skill-load receipt path.
4. E2E/debugging skills had no explicit “latest artifact wins” close-out rule.

## Diagnosis

- **Root cause:** the framework had moved to reference-split docs and multi-host support, but Kimi-specific task-graph behavior still lived in stale duplicated boilerplate. The helper layer also stopped short of enforcing the semantic invariants that the audit depended on.
- **Category:** drift + missing enforcement
- **Already tracked?** Partially. Kimi rules auto-injection had landed earlier the same day, but task-graph enforcement and close-out freshness had not.

## Implementation

**Route:** direct framework edits (helper + docs + validator + skill self-verify rows). No new skill was required.

### Files changed

- `scripts/task-graph.mjs`
  - added derived graph-level `status`
  - added `graph-status`
  - added `load-skill`
  - added per-task `skill_receipt`
  - reject non-skip completion without a matching receipt
- `provision/hosts/{claude,codex,gemini,kimi}.json`
  - added canonical `task_graph` metadata
- `KIMI.md`
  - aligned task-graph wording to `.svc/lane-tasks-<WI>.json`
  - documented `/skill:<name>` + `load-skill`
- `route-workflow/references/task-graph-protocol.md`
  - added explicit Kimi host mechanics
  - documented helper-owned graph closure
  - documented helper skill-load receipts
- `references/task-graph-chaining-protocol.md`
  - aligned host quick contract and receipt rule
- `references/knowledge/svc/CAPABILITIES.md`
  - updated host continuity, dependency-safe task graph, and provisioning rows
- `references/knowledge/svc/details/infrastructure.md`
  - updated supported-host inventory and helper description
- `test-framework/evals/tier-1/validate-framework-self-management.sh`
  - aligned checks to split route-workflow references
  - added Kimi/task-graph/latest-artifact assertions
- `write-e2e/SKILL.md`
- `diagnose-bug/SKILL.md`
- `test-journeys/SKILL.md`
- `audit-session-execution/SKILL.md`
  - added explicit latest-artifact self-verify rows
- skill corpus boilerplate sweep
  - replaced stale “Kimi: file-only (no native task API)” wording with the current observational contract

## Replay Verification

### Tier-1 validator

```bash
$ bash test-framework/evals/tier-1/validate-framework-self-management.sh
=== Tier 1: Framework Self-Management Validation ===
  253 passed, 0 failed
  PASS — framework self-management contracts valid
```

### Helper replay

```bash
$ node scripts/task-graph.mjs set-status /tmp/lane.json 1 completed
/tmp/lane.json: task 1 cannot be completed without a matching load-skill receipt for write-e2e

$ node scripts/task-graph.mjs load-skill /tmp/lane.json 1 write-e2e --via direct_skill_file
recorded skill receipt for task 1 in /tmp/lane.json

$ node scripts/task-graph.mjs set-status /tmp/lane.json 1 completed
updated task 1 in /tmp/lane.json
```

Separate replay also confirmed that `validate` rejects a graph whose top-level `status` says `completed` while child tasks still derive `pending`.

## FRAMEWORK-STATE.md Mutations

- Added a 2026-04-21 Analysis History entry for Kimi task-graph enforcement + latest-artifact close-out.
- Added four locked decisions:
  - host-native task readers are observational only
  - graph closure is helper-owned
  - AP-27 proof is the helper receipt, not host transcripts
  - latest artifact wins in debug/E2E close-out

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Evidence gathered | PASS — pending evolution proposal + session audit |
| 2 | Diagnosis produced | PASS — 4 concrete findings with file:line evidence |
| 3 | Implementation route chosen | PASS — direct helper/docs/validator edits |
| 4 | Replay verification passed | PASS — validator green + helper replay green |
| 5 | FRAMEWORK-STATE.md updated | PASS |
| 6 | svc CAPABILITIES.md updated | PASS |
| 7 | Blend registry updated | N/A — no external blend |
| 8 | Proposal moved to done | PASS |
| 9 | NOTICES updated | N/A |
| 10 | Commits pushed to remote | PENDING at authoring time |
