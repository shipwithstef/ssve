# Fable review: WI-486 through WI-488 framework intake

**Date:** 2026-07-15
**Reviewer:** Claude Fable 5 alias (`fable`)
**Effort:** high
**Mode:** read-only plan review; no implementation authorized
**Verdict:** confirmed regressions; file separate work items

## Scope reviewed

Fable reviewed the evidence collected after Codex was blocked by `ambiguous active tasks` while attempting to start a new isolated Example Marketplace work item. The evidence covered the Codex mutation guard, task-graph resolution, worktree bootstrap, and installed hook paths.

The reviewer-effort policy in WI-488 was added by explicit owner correction after that review. It records the required review configuration and the incident that exposed the missing policy; it is not represented as an independent Fable finding.

Two additional owner-provided runtime observations were added after the Fable verdict: repeated anonymous `PreToolUse hook (failed) / code 1` messages in the current Codex run, and a different machine entering a loop while old/unsupported work-item state was present. These extend the accepted observability, migration, and bounded-loop acceptance criteria; they are not misattributed to Fable.

The subsequent full Tier-1 run supplied local corroboration: `validate-concern-registry-cross-host.sh` and `validate-shared-content-symlinks.sh` found missing shared infrastructure on seven configured host installs, while `validate-session-contract-freshness.sh` found an eight-hour stale WI-481 contract. These are recorded as baseline migration fixtures, not failures introduced by the intake documents.

## Confirmed findings

### F1 — HIGH — Multi-WI state is confused with current-session authority

The Codex guard scans every non-completed task graph when no explicit binding exists. With two foreign in-progress graphs, it denies before the read-only allowance and before a new session can create its own graph or binding. This makes supported parallel work impossible to bootstrap safely from a neutral checkout.

**Disposition:** accepted as WI-486. Preserve arbitrary mutation denial, but add a safe, bounded bootstrap path and resolve governed state from an explicit session/worktree/WI binding.

### F2 — HIGH — The bootstrap helper rejects unrelated default-checkout residue

`scripts/svc-ensure-worktree.mjs` requires the default checkout to be completely clean. Unrelated untracked files therefore prevent creation of an isolated worktree even though the worktree operation can preserve them untouched.

**Disposition:** accepted into WI-486 because it is part of the same unreachable bootstrap path, not a separate authority model.

### F3 — HIGH/CRITICAL — Installed controls can point to ephemeral sources and fail open

The installed Codex hooks and skills pointed through symlinks into a deleted `/tmp/...` source. The guard first blocked commands and later disappeared when its target vanished. A missing enforcement executable therefore produced silent behavioral oscillation.

**Disposition:** accepted as WI-487. Existing setup canonicalization and health checks are prior safeguards, so the follow-up must reproduce why they did not prevent or repair this installed state rather than duplicate them.

### F4 — LOW — Active-intent notification residue is suspicious but not causal

An unrelated task-notification was present as active intent, but the reproduced ambiguity came from two live task graphs and the resolver order.

**Disposition:** excluded from WI-486 and WI-487. Track only if independently reproducible.

## Required acceptance direction from the review

- Two or more foreign live graphs must not block read-only inspection.
- Arbitrary mutation without authority must remain denied with a diagnostic.
- A safe bootstrap sequence must create a new worktree, graph, claim, and session binding without modifying foreign graphs.
- `SVC_CODEX_TASK_GRAPH` must not act as an unvalidated authority override.
- A bound session must resolve only its own graph and worktree.
- Unrelated untracked default-checkout files must survive bootstrap unchanged.
- Claude and Codex must enforce the same ownership invariant while foreign-session Stop behavior remains advisory.
- Setup must refuse, materialize, or repair ephemeral/dangling install sources; a missing guard may never silently allow mutation.
- A blocking hook result must identify the hook, reason, affected operation, and recovery action; anonymous code-1 failures are invalid.
- Identical hook failures must be deduplicated or rate-limited without hiding the first actionable denial.
- First run after upgrade must migrate every configured host and normalize or quarantine legacy/unsupported WI state without entering a Stop/PreToolUse retry loop.

## Owner correction: reviewer model and effort

The initial Fable invocation was mistakenly started above the requested effort and cancelled before a verdict. The completed review used Fable at **high**. WI-488 makes the intended policy mechanical:

- Claude-orchestrated cross-family review: Codex 5.6 sol at **high**.
- Codex-orchestrated cross-family review: Fable 5 at **high** when available.
- Only when Fable 5 is unavailable: Opus at **xhigh**.
- No default Fable xhigh/max or Codex effort above high; a higher setting requires an explicit owner override.

## Review conclusion

Open three improvements because the framework proposal contract permits one gap per proposal: WI-486 for session-scoped multi-WI bootstrap plus bounded handling of legacy graph state, WI-487 for durable and observable cross-host installed enforcement plus first-run migration, and WI-488 for deterministic reviewer selection and effort. Do not amend the already verified WI-485 and do not implement any of the three during intake.

## External invocation audit added before shipping

The installed CLIs and current primary documentation were re-checked on 2026-07-15 before shipping this intake. Codex CLI 0.144.4 confirms that non-interactive automation is `codex exec`; its `-p` flag means profile, and it supports stdin, ephemeral sessions, user-config/rules isolation, read-only sandboxing, JSONL, output schema, and a separate final-message artifact. The existing `review-cross-model` example uses invalid Codex syntax and the current Codex plan-review launcher leaves several of those reproducibility controls unused.

Claude Code 2.1.210 supports explicit full model and effort, safe-mode isolation, disabled tools/MCP, no session persistence, schema-validated JSON, one-turn execution, and a budget ceiling. `--bare` is not the universal isolation choice because it deliberately skips OAuth/keychain reads and therefore can break subscription-authenticated review; WI-488 instead requires `--safe-mode`. The primary review invocation must double as the availability probe so the framework does not pay for a separate smoke call.

The audit also corrected a stale billing premise: Anthropic's help center says the announced separate Agent SDK credit change was paused. For now `claude -p` remains within subscription usage limits and there is no separate monthly Agent SDK credit. Cost controls remain valuable because reviews consume the shared subscription allowance, but the paused policy must not force routing or justify TUI puppeting.

These findings expand WI-488's one gap—deterministic external review invocation—without implementing its runtime changes during intake. WI-488 now requires a single structured/isolated launcher, exact effective-model evidence, classified fallback, content-addressed duplicate suppression, time/budget ceilings, actionable CLI-version failure, and fixture-only Tier-1 tests. WI-488 should execute before WI-486 and WI-487 so those later changes can use the corrected review path.

Fable 5 reviewed this external-invocation expansion at **high** through a safe-mode, tool-disabled, non-persistent, schema-validated call and returned `PASS`. Its two medium refinements were accepted: a fallback-provenance Opus receipt can never satisfy a later Fable-primary request, and shared subscription-quota exhaustion is a hard failure rather than a fallback trigger. Four low notes were also applied: hedge Codex runtime effective-model evidence when the CLI does not expose it, confirm `CODEX_HOME` auth survives isolation, align Claude plan-permission wording, and disambiguate source provenance/historical billing links. No second paid review was necessary after the PASS because the edits directly narrow the accepted contract.

## Final-intake re-review

After the owner evidence expanded the scope, Fable 5 re-reviewed the complete intake at **high** and returned `REVISE` with three blocking findings:

1. WI-486 contradicted itself by requiring legacy normalization/quarantine while also proving no foreign graph changed.
2. WI-486 lacked an atomic two-session/same-new-WI bootstrap race.
3. WI-488 did not specify what happens when Codex 5.6 sol is unavailable on the Claude-orchestrated path.

All three are accepted. The revised contract separates non-mutating bootstrap from an explicitly authorized, backed-up, receipted upgrade migration; requires one atomic bootstrap winner; and hard-fails Codex-unavailable review without model or effort substitution. Fable's nonblocking notes are also adopted: tracked residue is preserved byte-for-byte, WI-487 remains fail-closed until WI-486 compatibility is available, host-swallowed diagnostics require a durable side channel, and the Opus-xhigh cost inversion is confirmed as the owner's deliberate Fable-unavailable fallback.

### Final verdict

Fable 5 re-checked the revised proposals at **high** and returned `PASS`. It confirmed all three blockers were closed, WI-487 delegates WI transformation to WI-486 instead of creating a competing migrator, and the deliberate Fable-unavailable Opus-xhigh fallback does not conflict with the normal high-effort caps.

## Intake verification

- Proposal authorship lint: 8 PASS, 0 WARN, 0 FAIL for each proposal.
- Work-item metadata, proposal-triage SLA, Markdown AST, diff check, and file-persistence checks: PASS.
- WI-486 task graph validation: PASS (one completed framework intake task).
- Impact-triad behavioral validator: 52 PASS, 0 FAIL.
- Full Tier-1 baseline: 240 scripts passed, 3 failed. The failures are the evidence recorded above: cross-host concern/shared-content installation drift and a stale session contract. No source hook or installer implementation changed in this intake.
