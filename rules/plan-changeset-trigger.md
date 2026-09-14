# Rule: When to gate framework changes through plan-changeset

Framework self-improvement must go through `write-spec → plan-changeset → execute-changeset` in a worktree **when the change carries semantic risk**, regardless of size. Conversely, changes that are purely additive or documentation should land as direct commits to avoid ceremony that catches nothing.

**Supersedes** the earlier size-based trigger ("any framework change >2 files or >50 lines") which mis-targeted: it gated harmless additive work while letting small-but-risky edits sail through.

## Risk signals — any ONE triggers plan-changeset

1. **Contract change.** Modifies an interface other code depends on:
   - function signature, class API, module export
   - hook wire protocol (stdin payload shape, stdout decision format, exit codes)
   - skill frontmatter schema (inputs/outputs/chain fields)
   - config file format (`skills-manifest.json`, `provision/hosts/*.json`, `.svc/*.json`)
   - CLI arguments for framework scripts
   - svc canonical event names, lane names, review gate IDs

2. **Behavior change on a hot path.** Edits a file in:
   - `hooks/svc-*` or `hooks/lib/*` — runs on every tool call
   - `scripts/wire-*`, `scripts/resolve-*`, `scripts/init-*` — runs on every install/session-start
   - `test-framework/evals/tier-1/` — runs on every lint
   - `scripts/lint-skills-manifest.mjs` or any other top-level validator

   Regressions here cascade across every session.

3. **Refactor without behavior change.** Rewrites that preserve external behavior but restructure internals:
   - porting `.js` → `.mjs` (or vice versa)
   - extracting modules / shared libraries
   - renaming frequently-referenced exports
   - reorganizing directory structure

   Ceremony is needed even though the change "should" be invisible — to catch missed call sites and silent breakage.

## Explicit exemptions — do NOT trigger plan-changeset

- **Purely additive.** New files that existing code doesn't yet reference:
  - a new hook, new skill, new test, new knowledge node, new provision entry
  - a new proposal or rule file
- **Documentation-only.** `FRAMEWORK-STATE.md`, `README.md`, `EXTERNAL_ADDONS.md`, `REPO_MODES.md`, `WORKTREES.md`, `DOCTRINE.md`, `CLAUDE.md`, `KIMI.md`, `GEMINI.md`, any `proposals/*.md`, any file under `references/knowledge/`. Substantive prose edits to a `SKILL.md` that do NOT alter frontmatter or declared process still count as docs.
- **Learning updates.** Appending to `framework-learnings.jsonl` or project `learnings.jsonl`.
- **Proposal lifecycle.** Moving a file from `proposals/` to `proposals/done/` with a superseded-by pointer.
- **Revert.** Git revert of a bad commit on the same branch.

## Decision procedure

Before committing framework changes, ask in order:

1. Does my change match any exemption above? → **commit directly.**
2. Does my change match any risk signal above? → **open a worktree and go through write-spec → plan-changeset → execute-changeset.**
3. Unclear? → default to plan-changeset. The ceremony cost is low; the regression cost is high.

## Operational notes

- If you're mid-session and realize a change you intended as "additive" now touches a hot path, **stop, land what's harmless, and route the rest through plan-changeset.**
- If the user explicitly directs a bypass ("just do it"), proceed but note the bypass in the commit message. The user's judgment call is the override.
- Learning confidence: when this rule prevents a mistake, bump the underlying learning's confidence (cap 10). When a false trigger wastes cycles, log the false positive so the rule can be further calibrated.
