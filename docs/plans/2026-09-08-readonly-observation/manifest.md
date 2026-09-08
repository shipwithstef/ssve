# Restore diagnostics and existing-session task recovery

WI: WI-FW-READONLY-OBSERVATION-01
Branch: bugfix-readonly-observation
Mode: inline; urgent incident repair authorized by the owner on 2026-09-08.
Baseline: 25f3ea8. Preserve the unfinished bugfix-session-recovery worktree; recover its source into this owned worktree under the explicit request to finish the original interrupted work. Formal plan review is retrospective under the owner's urgent implementation authorization; it has not preceded implementation.

## Problem and evidence

System inspection was classified as mutation and denied when the owned task was blocked. The advertised owner override was not activated by the host. An emergency marker existed but had mode 0664; the launcher's documented mode check rejected it. Correcting that existing marker to 0600 restored tooling. The map worktree has an existing same-session binding and 15 pending tasks, last modified 07:18 UTC before history repair at 14:50 UTC; the enforcer nevertheless prescribed new-worktree bootstrap. Source edits and failed/incomplete browser-test evidence survived.

## Acceptance criteria

- **AC-1:** systemctl observation verbs and journalctl log queries run without WI, session, controller or task state. Paginated commands are executed with --no-pager. Unsupported verbs/options, redirects, service mutations, journal maintenance and shell execution remain governed.
- **AC-2:** Every segment is classified using decoded argv. Normalization preserves cmd/command envelope spelling, all operands and redirections, and never mutates original input evidence. Both direct classifier and dispatcher paths retain unsafe-operation refusal.
- **AC-3:** When a valid owned graph has a first runnable pending task and no active task, denial names the exact canonical loader for that existing task. Never prescribe bootstrap for an owned blocked, terminal, malformed or ambiguous graph; never fabricate progress or transfer foreign ownership.
- **AC-4:** Current repaired framework binding uses canonical APIs and the emergency mode is disclosed and temporary. Tests exercise enforcement without emergency mode; fresh installed-hook checks validate observations, pending loader guidance and mutation refusal after installation.

- **AC-RW-1:** Invalid inline plans and missing declared sources fail before reviewer invocation; preflight and review consume the same validated bytes.
- **AC-RW-2:** Unscored progress without negative evidence receives at most one completion attempt inside the original budget.
- **AC-RW-3:** Existing bounded closeout handles fixed plan certifications consistently; Criticals, unread dependencies and failed execution certifications still block.
- **AC-RW-4:** Missing PR metadata derives from exact live PR identity and passing canonical chain evidence; moving heads cannot merge as another candidate.
- **AC-RW-5:** Published receipt notes preserve all concurrent history and canonical digest maps; malformed/conflicting metadata is refused.
- **AC-RW-6:** Review final source, run the release corpus, publish through the normal chain and install all provisioned hosts. Record actual elapsed delivery, including interruptions; never claim a ten-minute result from focused tests.

## Changes and verification

T1: hooks/codex/lib/codex-hook-context.mjs: add strict argv observation rules for systemctl and journalctl; small OS probes only when trivially nonmutating.
T2: hooks/lib/pretool-decision-engine.mjs: normalize no-pager before proving observation, preserve command-field spelling and command semantics.
T3: hooks/codex/svc-codex-skill-load-enforcer.mjs: derive recovery advice from the owned graph and first runnable task; blocked work remains blocked with honest diagnostics.
T4: test-framework/tests/readonly-observation.test.mjs and test-framework/evals/tier-1/validate-readonly-observation.sh: positive commands, adversarial flags, envelopes, no-WI installed dispatcher and pending/blocked/foreign recovery fixtures.
T5: Recovered receipt publication, review preparation, bounded closeout and PR derivation sources and regressions from docs/plans/repair-workflow.md.
T6: Existing regression fixtures reflect persistent authority and normalized execution input; released binding cannot authorize an external worktree root.
T7: FRAMEWORK-STATE.md: record incident fix and limitations; no review-evidence or previous delivery completion invented.

Run node test regressions, existing read-only and decision-engine corpora, first-skill/bootstrap fixtures, full tier-1 release corpus and independent source review. Respect owner reviewer policy. Install all provisioned hosts through canonical setup only after reviewed source is published; verify exact installed bytes, all-host drift and live no-WI reads with emergency mode disabled. Permanent fix is not complete merely because the temporary escape hatch works.

## Risk, external state and rollback

Effect scope: source hooks, tests, this plan and framework state. Incorrect classification could admit mutation, so whitelist verbs/options and retain hostile-command tests. Do not infer that arbitrary Python, SQL or shell scripts are read-only. Runtime state and API queries are observations only; unknown commands remain governed. No app source or session transcript changes. Preserve signed receipts and old task evidence. Revert reviewed source and reinstall if regression occurs; existing backups retain session data. No unattended VM eviction or app deployment.
