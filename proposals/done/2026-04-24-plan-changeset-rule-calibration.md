# Framework Evolution — 2026-04-24

> **ADOPTED 2026-04-24.** Rule lives at `rules/plan-changeset-trigger.md`.
> `framework-learnings.jsonl` entry `framework-changes-need-plan-changeset`
> rewritten with risk-based logic. This proposal is kept for historical
> context on why the change was made.

## Calibrate plan-changeset trigger by risk, not size

**Target rule:** `references/framework-learnings.jsonl` entry `framework-changes-need-plan-changeset` (confidence 9).

## Current rule

> "Any framework change touching >2 files or >50 lines MUST go through write-spec → plan-changeset → execute-changeset in a worktree."

## Problem

The rule triggers on **size** (file count, line count). Size correlates weakly with semantic risk. Observed friction this week:

- **False positive — purely additive work:** adding `wire-codex-hooks.mjs` and `wire-gemini-hooks.mjs` (two new files, ~150 lines each) is mechanically derivative of existing `wire-hooks.mjs` and `wire-kimi-hooks.mjs`. There's no existing behavior to break. The spec is already written (the 04-24 proposal). Forcing it through write-spec → plan-changeset → execute-changeset in a worktree adds ceremony without catching risk.
- **False negative — small high-risk changes:** a 5-line change to `hooks/svc-loop-guard.mjs`'s fingerprint algorithm could brick every session. Under the current rule, 5 lines is below threshold — no plan-changeset required. But the blast radius is every tool call on every host.
- **Inconsistent enforcement:** this session produced two commits with ~866 and ~300 insertions respectively. Both were user-directed bypasses. If the rule were calibrated correctly, one should have gated and the other shouldn't — but the rule has no language to distinguish them.

## Proposed rule (replacement)

Trigger plan-changeset on **semantic risk**, independent of size. Three risk signals, any one of which triggers:

1. **Contract change** — modifies a function signature, hook wire protocol, skill frontmatter schema, config file format, CLI argument, or any other interface that other code depends on.
2. **Behavior change on a hot path** — edits hooks/`svc-*`, `scripts/wire-*`, `scripts/resolve-*`, any `tier-1` validator, or any file in `hooks/lib/`. These run on every session / commit / tool call; regressions cascade.
3. **Refactor without behavior change** — rewrites that preserve external behavior but restructure internals (e.g., porting `.js` to `.mjs`, extracting modules, renaming frequently-referenced exports). Need plan-changeset to catch missed call sites, even though the change "should" be invisible.

Do NOT trigger plan-changeset on:

- **Purely additive work** — new files that don't modify existing ones (e.g., adding a new hook, new skill, new test, new knowledge file), provided no existing file imports/references them yet.
- **Documentation-only** — `FRAMEWORK-STATE.md`, `README.md`, `proposals/*.md`, `references/knowledge/**/*.md`, `CLAUDE.md`, `KIMI.md`. Skills with substantive prose edits that don't change frontmatter or the process still count as docs.
- **Learning updates** — appending to `framework-learnings.jsonl` or `learnings.jsonl`.
- **Proposal lifecycle** — moving a `proposals/*.md` to `proposals/done/`.

## Acceptance criteria

- [ ] `references/framework-learnings.jsonl` updated: `framework-changes-need-plan-changeset` keeps key, but the insight describes the risk-based rule (contract / hot-path / refactor triggers + additive / docs / learning exemptions).
- [ ] `rules/` gains a new rule file `plan-changeset-trigger.md` that is loaded into context for framework work, with the same three-signal logic and exemption list.
- [ ] `improve-framework/SKILL.md` and `evolve-framework/SKILL.md` reference the new rule by path instead of paraphrasing.
- [ ] A one-line "risk check" step is added to `write-spec` and `capture-idea` that asks "does this trigger any of the three risk signals?" — if no, the answer is "commit directly; don't open a worktree."

## Why this beats the current rule

- **Catches real risk:** a 5-line hot-path change now correctly gates.
- **Stops punishing additive work:** new hooks/skills/wirers land without ceremony.
- **Gives a clear decision:** three yes/no signals, not a fuzzy line count.
- **Documents exemptions up front:** no debate at commit time about whether a docs change counts.
- **Keeps the spirit of the original rule** — framework self-improvement needs discipline — while removing the mis-targeting.

## What this proposal does NOT do

- Does not relax review standards for actual refactors — those still go through the full pipeline.
- Does not remove the `write-spec` → `plan-changeset` → `execute-changeset` pipeline — it remains the default for contract/hot-path/refactor work.
- Does not touch other framework-learnings entries; they stand as-is.
