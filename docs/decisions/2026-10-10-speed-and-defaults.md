# Decision: hook speed, enforcement precedence, and the open framework decisions

Date: 2026-10-10. Scope: PR 127 (Claude Code alignment). Method: the strategic-decision flow, compressed. It covers constraints, options, elimination gates, evidence, the decision, confidence, revisit triggers and rollback for each item. Adversarial review is recorded at the end.

## Constraint profile

The owner set four rules:
- **Speed:** the framework must not make the agent noticeably slower. "Speed almost the same, outcome 2x."
- **Quality:** a lower-quality result in exchange for speed is not acceptable.
- **Merges:** a merge such as 14 skills into 1 is allowed only when use cases and data show outcomes hold. Growth strategy is the named example.
- **Choice of technique:** use the strongest available technique (Claude Code features, systems engineering, Rust or Go where they help), and decide rather than ask.

Hard limits:
- Never weaken enforcement through files a repository controls.
- Never change authority semantics in enforce mode without tests.
- Keep every hook running on all nine hosts.

## Evidence: hook latency

Measured on this container. Node 22 starts in about 28 ms with an empty script. Each svc hook starts two Node processes: the boundary, then the hook. The wired hooks of a governed repository were replayed with `scratchpad/hookbench`; hooks of one event run in parallel, so an event costs as much as its slowest handler.

Wall time per event, governed repository, median, before this change:

| Event | Wall time | Slowest handler |
|---|---|---|
| PreToolUse:Edit | 566 ms | pretool dispatcher 526 ms |
| PostToolUse:Edit | 256 ms | heartbeat and edit accumulator, about 187 ms each |
| Stop | 278 ms | task-completion guard |
| UserPromptSubmit | 147 ms | |
| PreToolUse:Bash | 118 ms | |
| PostToolUse:Read | 87 ms | |

A CPU profile of the dispatcher showed that 286 ms of its 435 ms went to `spawnSync`. `strace` counted 73 git subprocesses for one Edit decision:
- 23 identical `rev-parse --git-common-dir`
- 21 identical `rev-parse --show-toplevel`
- 12 identical `worktree list`

A V8 compile cache (`NODE_COMPILE_CACHE`) made no measurable difference, so module compilation is not the cost.

## Measured result (scripts/hook-bench.mjs)

Same throwaway governed repository, 5 runs per event. The base is commit 1b69e0d, before this change.

| Event | Base | This branch | Change |
|---|---|---|---|
| PreToolUse:Edit | 648 ms | 335 ms | −48% |
| PostToolUse:Edit | 313 ms | 222 ms | −29% |
| Stop | 263 ms | 270 ms | no change |
| Other events | | | within noise |

`references/hook-budgets.json` now gates each event in units of one Node start. The base fails the PreToolUse:Edit gate.

## Decisions

### H1. Memoize repository-location git queries inside one hook decision (done)

**Options considered:**
1. Leave as is.
2. Thread a context object through every library.
3. A per-process memo, enabled only by short-lived hook processes.
4. Rewrite the dispatcher in Go.

**Gates:**
- Option 2 touches about 30 authority-code call sites.
- Option 4 duplicates the authority engine and breaks the single-source rule.
- Option 3 changes no decision logic.

**Decision: option 3.** `hooks/lib/git-query.mjs` caches `--show-toplevel` and `--git-common-dir` answers, and the worktree list, which is revalidated against the mtime of `<common-dir>/worktrees`. Only successful answers are cached. The memo is off unless `enableGitQueryMemo()` is called, so tests and long-running scripts are unaffected. The dispatcher enables it and clears it after any worktree adoption or provisioning.

**Result:**
- Same Edit decision measured three ways: 428 ms → 245 ms with the rev-parse memo, → about 200 ms with the worktree-list memo.
- Git spawns per decision: 73 → 23 under strace in the first bench setup. The reproducible count, from `scripts/count-hook-git.mjs` in a throwaway governed repository, is 68 on 1b69e0d → 8 on this branch. That figure includes D4, and the decision is unchanged (deny). The count is a gated claim in `references/claims.json`.
- Dispatcher-related test suites show identical pass/fail before and after (7 failures exist on the base commit as well).

**Confidence:** high. **Rollback:** revert the import lines; nothing is persisted.

### H2. Skip spawns that cannot matter (done)

- **Path filters.** `svc-lane-tasks-validator` and `svc-wi-pillars-check` now carry a Claude Code `if` filter, `Edit(//**/.svc/lane-tasks-*.json)` and `Edit(//**/docs/specs/work-items/WI-*.md)`. Before, they started two Node processes on every edit just to exit 0.
  - The patterns are anchored at the filesystem root, so edits in sibling worktrees outside the working directory still match.
  - Hosts or versions without `if` ignore the field and run the hook as before.
- **Heartbeat in the background.** `svc-posttool-heartbeat` is now `async`. It only renews a lease the dispatcher already authorized and reports in a systemMessage. The dispatcher renews a due lease itself before the next mutation, so nothing depends on the heartbeat finishing first.
- **Kept synchronous, with reasons:**
  - `svc-phase-receipt-autoemit`, because the Stop guard reads its receipts immediately.
  - The edit accumulator, because a background read-modify-write can race the Stop quality check.
  - Stop and UserPromptSubmit guards, because they block.

**Confidence:** high.

### H3. Native front door plus warm daemon (built, not shipped: needs owner approval)

The remaining floor is about 60–80 ms per hook, which is two Node start-ups. Only a long-lived process removes it.

**Options considered:**
1. Claude Code `type: "http"` hooks to a local server. This is Claude-only, and the server would have to translate exit-code semantics into HTTP responses.
2. Worker threads. These break hooks that read fd 0.
3. A native client plus a warm standby daemon.

**Built:**
- `svc-hookc`, a Go client of about 2.6 MB with roughly 2 ms startup. It forwards argv, cwd, the environment and stdin over a 0700 per-user unix socket, and replays stdout, stderr and the exit code byte for byte.
- `svc-hookd`, a Node daemon. It keeps one already-started boundary per exact (argv, cwd, environment) waiting on stdin.
- A boundary standby mode in which nothing that reads policy, state or the clock runs before the input arrives.
- When the daemon is absent or declines, the client runs the command itself, so the hook always runs.

**Why it is not shipped:**
- The session's safety classifier blocked running it as a command-execution surface.
- A hardened version is ready in the session scratchpad and was not committed. It adds an installer-registered allowlist of argv hashes, the daemon's own Node binary, and a hand-back to the client for any call whose environment sets loader variables.
- A same-user local daemon that executes hook commands is a real new trust surface, so the owner decides.

**Expected effect (estimated, not measured):** about 60–80 ms saved per hook call on every host.

**Revisit:** when the owner approves; then benchmark through the replay harness with output identity checked per call.

### H4. Owner `enforce` outranks the environment (done)

**Before:** `SVC_HOOK_MODE` in the environment beat `~/.svc/hook-policy.json`. Host and repository settings can set environment variables, so a cloned repository's `.claude/settings.json` could switch the owner's enforce off.

**Options considered:**
1. Keep the old order.
2. Owner file first, with the environment able to raise enforcement only.
3. Ignore the environment entirely.

**Gates:** option 3 breaks per-session opt-in enforcement and the test fixtures.

**Decision: option 2.** An ignored lowering is reported as a warning. `repoOptOut` simplifies to "advisory only". Updated: `docs/hook-modes.md`, `CLAUDE.md`, `AGENTS.md`, and a tier-1 test.

**Zero latency cost.** **Confidence:** high. **Rollback:** revert `resolveHookMode`.

### D4. Advisory mode advises instead of provisioning a worktree (done)

On an unbound edit in a governed repository, the dispatcher created a worktree and branch: 3.9 s on the first call. In advisory mode the boundary then drops the rebound input, so the edit ran on the original path anyway. That was pure cost.

**Decision:** in advisory mode, emit the finding with the exact next step, `svc-ensure-worktree --wi <WI>`. Enforce mode is unchanged.

**Confidence:** high.

### D2. Company fleet: merge only behind an outcome gate (decided: not yet)

**Evidence:**
- **Fifteen skills (about 2.5 KB each), 48% shared lines.** Each SKILL.md holds a short procedure, red flags and three self-verify rows.
- **The domain depth is not in the skills.** The 14 agents carry it. For example, the growth-lead agent holds AARRR, North Star, Bullseye channel selection, ICE backlogs, and CAC by channel. The knowledge banks under `references/knowledge/domains/*` carry 21–28 KB each, such as growth benchmarks with sources.
- **The skills cost about 820 tokens per turn in the listing.**
- **No outcome data exists.** The Tier-2 scenarios assert routing only, and the repository has no eval results or usage telemetry.

**Options considered:**
- (a) Keep 15.
- (b) One router skill with `references/<role>.md`; agents and banks unchanged.
- (c) `disable-model-invocation`. This breaks route-workflow.
- (d1) `skillOverrides` or a pack.
- (d2) Also merge the agents.

**Gates:**
- (c) fails on routing.
- (d2) fails the quality rule: growth, legal and security depth would compete in one prompt, and reviewer independence (WI-507) would be lost.

**Decision:** (b) is the target, but the owner's own rule requires outcome data first.

**Next step:** add one Tier-2 outcome scenario per high-stakes role, starting with growth-lead on a fixture funnel graded for North Star, an ICE-ranked backlog and a kill rule. Run it before and after the merge, port the 15 routing assertions into the router's role table, then merge.

**Confidence:** medium.

### D7. Agents name model aliases, not pinned IDs (done)

All 28 agents now use `opus`, `sonnet` or `haiku`. Claude Code resolves these to the current model of each family: Opus 5.5, Sonnet 5.5 and Haiku 5.5 today, versus Opus 4.8, Sonnet 5 and Haiku 4.5 before. This ends the drift instead of refreshing it.

**Left pinned on purpose:**
- The external-review policy, which is owner-versioned with a cutover.
- The commit-attribution fallback, which is owner policy.
- The registry's generated table.

**Confidence:** medium. Aliases move every agent to a new family model on release, with no outcome check (reviewer finding O-002).

**Revisit trigger:** on each model-family release that `harness-drift` reports, run the Tier-2 scenarios for the reviewer agents (`plan-reviewer`, `strategic-reviewer`, `svc-lens-*`) on the old pin and on the alias. Pin back any agent whose catch rate drops.

**Rollback:** restore that agent's pin in `agents/<name>.md` and run `scripts/sync-native-agents.mjs`.

### D1, D3, D5, D6, D8 (decided: hold, with triggers)

- **D1. Keep the four retire candidates.** No usage data, and archiving touches 245 references. Trigger: `/skill-doctor` shows near-zero invocation over 30 days.
- **D3. Rules on Codex, Grok, Kimi and Cursor are unchanged.** Their per-turn loading behaviour is unverified here, and trimming without proof risks quality. Trigger: a host is installed and its rule loading is measured.
- **D5. Concern globs are unchanged.** Tightening them moves routing pins for a small noise gain. Trigger: more than 2 concern injections per 10 edits in `.svc/rule-injection-log*` on a normal feature WI, or one owner report of an irrelevant concern.
- **D6. Hooks that do little are unchanged:**
  - `svc-vibe-auditor` is already async, so it adds no wall time.
  - `svc-rule-injector-explore` does inject rule pointers on Read, and removing it would trade quality for 87 ms. H3 is the fix that makes it free.
  - Trigger: H3 is rejected. Then make explore injection opt-in.
- **D8. The agy research rule is unchanged** until the agy CLI is available to test. Trigger: harness-playbook verify reports agy installed.

## Adversarial review

**Verdict:** approve with fixes, from the strategic-reviewer run on 2026-10-10.

- **Applied:** O-002, a trigger and rollback gate for D7; O-005, a concrete trigger for D5.
- **Confirmed by the reviewer:** H4 and D4. The H4 test (`validate-svc-repo-switch.mjs`, last case) asserts that an attempt to lower the mode is ignored.
- **Recorded as pre-existing, not changed here (O-001):**
  - The dispatcher keeps the pre-provisioning `repo` root when it evaluates crash-recovery self-heal after auto-provisioning (`svc-codex-pretool-dispatcher.mjs`, the `b?.worktree&&!boot` block).
  - The memo is not involved: it clears on provisioning.
  - Whether the stale root can change `gate.wi` needs tracing in `pretool-decision-engine.mjs`. That is authority code, so it gets its own WI with a regression test, not a drive-by change.
- **Not verified by the reviewer:** the benchmark numbers. They come from `scratchpad/hookbench` on this container and must be re-run before H3 ships.
