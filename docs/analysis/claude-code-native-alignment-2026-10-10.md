# SSVE × Claude Code: native-alignment review and plan

> **Status in PR #127 (2026-10-10):** Phase 0 done (the four retire candidates stay model-invocable; per-turn claims corrected). Also delivered early: `addon-gateway` (add-on packs cost one listing entry instead of about 31K chars), `scripts/route-model.mjs` (per-task model and effort with effort-first escalation and outcome learning, `references/model-intel/`), `scripts/svc-repo.mjs` (per-repo on/off through Claude Code settings), and `design-sync` with `scripts/design-tokens.mjs` (code ↔ Claude Design tokens, contrast). Everything else below is still the plan.

2026-10-10 · reviews [shipwithstef/ssve#127](https://github.com/shipwithstef/ssve/pull/127) against the current Claude Code docs (code.claude.com, fetched today) and the repo itself.

## 0. Bottom line

SSVE is right about *what* to add on top of Claude Code: evidence, receipts, independent review, contracts between stages, and project knowledge the model can't know. It mostly builds *how* it delivers that by hand, though, and Claude Code now ships most of that natively. Examples are path-scoped rules, skill and agent `model`/`effort`, skill-scoped hooks, `if`-filtered and async hooks, saved workflows, `/goal`, plugins with versioned install, `claude plugin eval`, `/skill-doctor`, agent `memory`, `isolation: worktree` and `omitClaudeMd`. Today SSVE uses almost none of them: across 106 skills, `paths`, `effort`, `model`, `hooks`, `allowed-tools`, `when_to_use` and `argument-hint` appear zero times. Agents pin model IDs that are two generations old.

The plan below keeps every SSVE behaviour that a recorded failure justifies. It moves the delivery onto native features, so the framework:
- costs nothing in repos that don't use it,
- spawns far fewer processes per tool call,
- upgrades with the model automatically,
- and proves each skill's value with Claude Code's own eval tooling.

## 1. Verdict on PR #127, checked one item at a time

| PR claim or change | Verdict | Evidence |
|---|---|---|
| Context-budget gate fixed (it read `<name>/SKILL.md` and counted 0) | **Correct, keep** | CI green on 17eb447 |
| 105 descriptions slimmed; all under the per-entry cap | **Correct** | Docs: combined `description` + `when_to_use` is truncated at 1,536 chars. The longest now is `research` at 386 |
| `svc-preflight-skill` installed on the `Skill` matcher only | **Correct** | Confirmed in `scripts/wire-hooks.mjs:154-160` and a dry wire into scratch settings |
| Injected rules drop YAML frontmatter | **Correct, and matches native behaviour** | Docs: Claude Code strips rule frontmatter before loading |
| `disable-model-invocation: true` on quick-fix, extract-bootstrap, honest-diagnosis, craft-prompt | **Regression, fix before merge** | The repo's own `scripts/check-chain-independence.mjs` lists all 4 as **NOT eligible** (referenced by 14/2/3/1 places). `improve-framework` still names `quick-fix` as an implementation route, `explore-solutions` points to `extract-bootstrap`, and the router index still lists `craft-prompt` and `honest-diagnosis`. Docs: when Claude tries a skill with this flag, Claude Code **blocks the call and tells it not to reproduce the steps another way**, so those routes now dead-end |
| "About 8.2K tokens saved per turn" | **Overstated, reword** | Always-loaded text sits in the cached prefix (docs: system prompt → project context → conversation). Each turn it is billed as cache reads, which are cheap, not as fresh input. The real wins are: (1) fewer cache writes at session start and after `/compact`; (2) context-window room; (3) no dropped descriptions |
| "Listing budget about 40K chars, svc at 107%" | **Correct for current models** | Docs: the budget is **1% of the model's context window**. Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1 all have 1M windows, so about 40K chars. The exception is the 3 agents still pinned to Haiku 4.5 (200K window, about 8K chars), where the 22.9K catalog still overflows about 3×. Moving those agents to current aliases (Phase 1) removes it |
| 6 local tier-1 failures are container artifacts | **Confirmed** | All 6 checks green in hosted CI on the PR head |

**Phase 0 fix (one small commit on the PR):** remove `disable-model-invocation: true` from those 4 skills, recompile the router index, and confirm `measure-always-loaded` stays under the 28,500 ceiling (about +1K chars). Reword the PR body's per-turn claim as described above. Then run ultrareview.

## 2. Why SSVE built these things, and what Claude Code does natively now

| SSVE mechanism | Why it was built | Native Claude Code now | Recommendation |
|---|---|---|---|
| `svc-rule-injector` (WI-361): a node hook on Edit/Write/Bash/Read that injects rules matched by path, bash or keyword signals | Every rule was loaded on every turn, so it moved to on-demand loading | **`.claude/rules/*.md` with `paths:` frontmatter** loads a rule when Read/Write/Edit touches a matching file, with zero processes | **21 of 48 rules are path-only** (17 path, plus 4 path with repo markers). Move them to native path rules. Keep the injector for the 16 bash/keyword rules only |
| `./setup` symlinks plus `wire-hooks.mjs` merging into `~/.claude/settings.json` | There was no packaging system for 9 hosts | **Plugins:** skills, agents, hooks, MCP, default settings, output styles, monitors and `bin/`. Versioned updates, `/plugin` enable and disable, `claude plugin validate`, and `claude plugin details` for cost | Package the Claude host as plugins (core plus optional packs). Keep `setup` for other hosts and for rules (rules are not a plugin component) |
| `scripts/skill-ab-eval.mjs` (new in #127) | To prove each skill beats the bare model | **`claude plugin eval`** runs a no-plugin baseline with regex, `tool_used: Skill` and judge graders, and exits non-zero below a threshold, so CI can gate on it. **skill-creator** does a per-skill blind A/B and description-trigger tuning | Use `claude plugin eval` for Claude. Keep the custom harness only for non-Claude runners (Codex, Grok) |
| 11 hooks fire on every Edit, each wrapped in `svc-hook-boundary.mjs`, which `spawn()`s the real hook: about 22 node processes per Edit | Fail-safe isolation, one script per guard | The handler **`if` field** (permission-rule syntax, e.g. `Edit(**/.svc/**)`), **`async: true`** and **`asyncRewake`** for observers, **`PostToolBatch`** for one call per batch, **`onFailure: "block"`** (v2.1.295) for enforce mode | Merge into one dispatcher per event. Make observers async (heartbeat, spec-index, auto-capture, vibe-auditor). Filter with `if` instead of spawning and exiting. Unwire the no-ops listed in D6 |
| Global governance hooks run in **every** repo | Enforcement had to be always on | **Skill `hooks:` frontmatter** registers hooks when the skill is invoked and keeps them for the rest of the session | Register chain-governance hooks from `route-workflow` (and the chain skills), so non-svc repos and plain questions pay nothing. Keep the global hooks only for safety (destructive git, secrets) |
| `resolve-model.sh` and `model-registry.json`. CLAUDE.md says effort is "declared, not applied" (WI-470) | One model table across hosts | **`model` and `effort` in skill and agent frontmatter** are applied by the runtime | Set `effort` on each agent and review skill. Use aliases (`opus`, `sonnet`, `haiku`, `inherit`) instead of pinned IDs. The registry stays for non-Claude hosts and external review |
| Agents pin `claude-opus-4-8` (15), `claude-sonnet-4-6` (1), `claude-haiku-4-5` (3), `claude-sonnet-5` (8) | Pinned for reproducibility | Aliases follow the current generation (Opus 5.5, Sonnet 5.5, Haiku 5.5) | Switch to aliases. That moves the 15 company-fleet agents off a two-generation-old model |
| WI-380 stage agents (`svc-stage-plan/exec/land`) plus `scripts/worktree.sh` | Fresh context per stage; isolation | **Skill `context: fork` + `agent:`**, agent **`isolation: worktree`** (auto-cleaned when unchanged), `maxTurns`, `background` | Keep the agents. Use `isolation: worktree` for disposable or parallel work, and keep `worktree.sh` only where the chain needs a named, promotable branch |
| WI-382 parallel review station (4 lens agents) | Independent lenses on a frozen diff | **Saved workflows** (`.claude/workflows/`): code-held fan-out, adversarial verify, resumable, shared prompt cache, results kept out of the main context | Rewrite the station as a saved workflow `svc-review-station`, one workflow per stage (a workflow can't take user input mid-run, which matches the human checkpoints) |
| Prose "keep driving the chain until receipts exist" | The model stopped early | **`/goal <condition>`**: a model checks the condition after each turn and keeps going | Have route-workflow set a goal such as "`svc-reconcile` passes and CI is green on HEAD" |
| `svc-learning-preload` (3.6–5.7K chars at SessionStart and after compaction, including unpromoted entries) | Cross-session learning | **Auto memory** for the main session, and agent **`memory: user/project/local`** | Preload only promoted learnings. Give the company fleet `memory: project` (the ad-strategist "levels up" from a ledger today) |
| route-workflow reads state files with tool calls | It needs project state to route | **`` !`command` `` dynamic context** in SKILL.md runs at invocation | Inject the current WI, lane, receipt status and `git status` summary at invocation, saving several tool turns per route |
| Lens agents load the full CLAUDE.md (about 12K) plus rules | Default subagent startup | **`omitClaudeMd: true`** (v2.1.271) | Set it on lens and summary agents. They review a frozen diff from the prompt |

## 3. Gaps nobody has filled yet

1. **Compaction drops skill tails.** Docs: after compaction, each re-attached skill keeps only its **first 5,000 tokens**, with 25,000 shared across all skills. `route-workflow` is 33.6KB (about 8.4K tokens), `base44-environment` 39KB, `design-ui` 71KB and `validate-feature` 72KB. Anything after roughly the first 18KB silently disappears in long sessions. Fix: put the load-bearing rules first. Add a validator that every MUST, NEVER or refuse line in a chain skill sits in the first 18KB. Move rules that must *always* hold into hooks, which the docs explicitly recommend.
2. **Losing work when a session dies.** Today's run lost its push to a 403 and then to the 5-hour limit. Add a **`StopFailure` hook** with matcher `rate_limit|billing_error|authentication_failed` that commits work-in-progress and pushes `wip/<branch>`, falling back to a `git bundle` in the scratchpad. Also: Routines don't draw on cloud-session credits, so long audits should run in a session you start yourself or with extra usage turned on.
3. **Skill frontmatter typos fail silently.** Docs: Claude Code ignores unknown frontmatter fields without reporting an error. Add a tier-1 lint that checks every skill and agent field against the documented tables, and run `claude plugin validate` in CI.
4. **The listing budget depends on the context window.** Every current model has a 1M window. Keep the measurement window-aware anyway, because a pinned older model such as Haiku 4.5 (200K) silently gets a 5× smaller listing.
5. **Choose skills from real usage, not judgement.** `/skill-doctor` reports each skill's listing cost and how often it was used. Run it on the owner's machine before deciding D1 or D2.
6. **106 skills are listed everywhere.** Split into packs: **core** (the about 59 `corePackForRouting` skills), plus **company fleet**, **marketing**, **base44** and **media** (suno-architect, wsl2-audio, ad-video…). The `enabledPlugins` stubs for `svc-marketing-pack` and `svc-agents-skills-pack` already exist in `.claude/settings.json`. Use `paths:` on stack skills such as `base44-environment`. Use `skillOverrides: "name-only"` for rare skills in personal installs.
7. **Ambient state belongs in the status line.** `svc-prompt-stale-state` runs on every prompt. A status line can show lane, WI and receipt state with zero tokens and keep the prompt hook for real staleness only.
8. **Subagent cache lifetime.** A fresh subagent starts cold with a 5-minute TTL, while a fork reads the parent's cache. For stage agents that wait on a human checkpoint, set `subagentPromptCacheTtl: "1h"` or the agent's `experimental.cacheTtl`.
9. **Observability.** An `InstructionsLoaded` hook (reasons `path_glob_match`, `compact`…) shows exactly which rules loaded and when. That turns the injection-noise corpus into live data.
10. **Stale self-description.** CLAUDE.md, the commit-trailer fallback (`hooks/svc-workflow-guard.mjs:707`) and `model-registry.json` (`claude-fable-5`, `claude-opus-4-8`) all describe an older generation. Every session working on the framework loads them.

## 4. Phased plan

Each phase is one or more PRs through the mandatory chain. Order matters: earlier phases produce the measurements later phases depend on.

**Phase 0 — finish #127 (today).** Remove the 4 `disable-model-invocation` flags and reword the per-turn claim (§1), then run ultrareview on #127 and merge.
*Exit:* CI green, ultrareview findings handled.

**Phase 1 — native quick wins (low risk, each independently revertible).**
1. Agents: model aliases plus `effort`; `omitClaudeMd` on lens and summary agents; `color`.
2. Model-registry and CLAUDE.md refresh (D7), plus the trailer fallback.
3. `StopFailure` work-preserving hook (gap 2).
4. Hook diet: `async` on observers, `if` filters, unwire the D6 no-ops, remove the duplicate `eval-gate` wiring in the repo's `.claude/settings.json`.
5. Frontmatter field lint and the compaction-head validator (gaps 1 and 3).

*Exit:* processes per Edit fall from about 22 to ≤8 (new benchmark), no change in tier-1 results.

**Phase 2 — move the delivery onto native features (measured, one area per PR).**
1. Move the 21 path-only rules to native `paths:` rules. The injector keeps bash and keyword rules only.
2. Adopt skill frontmatter: `paths` on stack skills, `effort`/`model` on review and mechanical skills, `argument-hint`, `allowed-tools` for the receipt scripts, and `` !`cmd` `` state injection in route-workflow.
3. Chain-governance hooks move into `route-workflow`'s `hooks:` frontmatter. The global set shrinks to safety only.
4. Reorder big skills so hard rules come first.

*Exit:* the injection corpus shows the same relevant-rule recall with ≤3 irrelevant deliveries, the always-loaded surface fits the listing budget of every model an agent pins, and a non-svc repo session has zero svc hook spawns on Edit.

**Phase 3 — packaging and proof.**
1. Plugin packaging: `svc-core` plus packs, a marketplace entry with `relevance` signals (optional), and `claude plugin validate` in CI.
2. A `claude plugin eval` suite for the core skills: a trigger grader (`tool_used: Skill`), a contract grader (the artifact svc tooling reads) and one correctness check, all against the no-plugin baseline.
3. Retire `skill-ab-eval.mjs` for Claude and keep it for Codex and Grok.

*Exit:* one-command install, the eval suite gates CI on a threshold, and `claude plugin details` reports the cost in the PR body.

**Phase 4 — deterministic orchestration.**
1. Saved workflow `svc-review-station` (4 lenses, then adversarial verify, then findings JSON), replacing prose dispatch.
2. `/goal`-driven chain completion.
3. `context: fork` stage skills and `isolation: worktree` for parallel waves.
4. `memory: project` for the company fleet.
5. Status line for chain state.

*Exit:* a full M-size WI runs plan → land with a smaller main context (measured with `/context`) and identical receipts.

**Phase 5 — owner decisions with data.** Use `/skill-doctor` usage plus eval results to settle D1 (archive the 4) and D2 (merge the 14 role skills into one fleet skill with a role table), and to decide which rarely used skills to move into optional packs.

## 5. Testing mechanism

| Tier | Runs | Cost | What it proves |
|---|---|---|---|
| A. Deterministic CI (extends tier-1) | Every PR | Free | Always-loaded budget per model window; injection-noise corpus; **hook process-count benchmark** (spawns per Edit/Bash/Read with a ceiling); compaction-head validator; frontmatter field lint; `claude plugin validate`; existing receipt and contract validators |
| B. Behavioural evals | Before any SLIM or RETIRE, on each model release, nightly for core | Paid, gated by `EVALS=1` | `claude plugin eval` with the no-plugin baseline: trigger rate, contract compliance, correctness delta, token delta. A tie means slim or retire. A regression blocks |
| C. Live telemetry | Weekly | Free | `/skill-doctor` (unused skills), `/context` (real listing size), `claude plugin details`, `InstructionsLoaded` log, OTel monitoring |
| D. Release proof | Each phase PR | Free | Before and after numbers in the PR body: per-turn chars, processes per Edit, eval deltas |

Rule from the audit, kept: **a skill earns its tokens only if it beats the bare model on something checkable.** Phase 3 makes that measurement native and automatic.

## 6. What not to do

- Don't hide a skill that other skills route to (the #127 regression). Run `check-chain-independence.mjs` first and make it a CI check.
- Don't bulk-edit the hot path (CLAUDE.md S5). One area per PR, with a measurement before and after.
- Don't drop receipts, independent review or no-fabrication. Those are the moat, and the model doesn't do them by default.
- Don't migrate keyword- or bash-triggered rules to native rules. Native `paths:` only fires on file access.

## 7. What would impress people

- Install with `/plugin install svc-core` and get zero cost in repos that don't use it.
- Governance switches on only when you start a chain, and every stage leaves a verifiable receipt in git notes.
- The review station is a saved, resumable workflow that adversarially verifies its own findings.
- Every skill ships with an eval that shows its lift over bare Claude Code, re-run on each model release.

The claim is short: "it's Claude Code, plus proof."

## 8. Receipts 2.0 and the self-eval gauntlet

### What receipts actually are

Today a receipt proves that a stage **ran**: it is schema-valid, bound to a SHA or tree in `refs/notes/svc-receipts`, and its AC baton is hash-bound to the spec (WI-381). It is checked late, at push, reconcile and Stop. That alone beats agent self-report, because "did the phase run" stops being a claim.

The deeper value is that a chain of receipts is a **written record of what each stage believed, which later stages can check**. Three additions turn that record into a self-correction loop:

1. **Receipts carry predictions, not only proofs.** Each stage writes what it expects the next stage to observe:
   - `plan-manifest`: the files it expects to touch, the tests it expects to change, and AC → test-id mappings.
   - `exec-record`: the commands it expects to pass.
   - `review-exec`: the findings it expects audit to confirm.

   The next stage's entry gate checks those predictions mechanically. A mismatch is a **drift event** caught at the stage boundary, not at push time.
2. **Every failed check returns a repair path.** The WI-487 actionable-denial envelope says what failed. Extend it with *which stage to re-enter, with which inputs, and the smallest re-run that clears it*. The model fixes the problem in place instead of rediscovering it.
3. **Escaped-defect attribution.** When a later gate (audit, CI, verify-promotion, post-deploy evidence) finds something an earlier stage passed, write an `escape` record naming the stage that missed it. Across WIs this gives a **per-stage miss rate**. That measures which stage leaks, and feeds `framework-learnings.jsonl` and `evaluate-rule` with data instead of anecdotes.

### Nudge early, at the stage boundary, with native features

- A `PreToolUse` hook with `if: "Bash(git commit *)"` checks that the current stage's staging receipt exists for the staged tree (the staging-by-tree-hash slot already exists). One process, only on commits.
- A **`Stop` hook that returns `decision: block` plus the repair path** when the active stage's exit criteria aren't met. The model gets one more turn to fix it before the user sees "done". This is the "nudge before it's too late" mechanism, and it's native.
- `/goal "check-chain-receipts passes for HEAD and CI is green"` keeps the chain moving without prose reminders.
- The status line shows the stage, missing receipts and any drift events: always visible, zero tokens.

### The self-eval gauntlet (proposed new tier-4)

An end-to-end run across lanes on pinned fixtures, graded only by deterministic checks. It is cheap to repeat on every model release.

1. **Onboard (brownfield-conversion).** Start from an *unconverted* snapshot of `examples/todo-api` and run `onboard-repo`. Graders: the project-state, spec and journey artifacts pass their contract validators, and the specs match code facts from a hidden answer key.
2. **Build on the converted repo (greenfield-style feature).** Run 2–3 seeded WIs with hidden acceptance tests through the full chain. Graders: hidden tests pass, `check-chain-receipts` and `svc-reconcile` pass, the AC baton binds.
3. **Bugfix and drift.** Seed one real bug (hidden repro test) and one spec/code drift. Graders: the repro turns green, the drift is detected and reconciled.
4. **Process mutation testing (the new part).** Re-run step 2 with one fault injected at a time into a stage's output, for example:
   - the plan drops an AC,
   - exec skips a test,
   - review is fed a stale diff,
   - a receipt is forged against the wrong tree.

   Score the **catch rate per gate**, and the **stage that caught each fault**. This tests whether the safety net works, not just whether the happy path passes. A gate that catches nothing is a candidate to retire. A fault that escapes to land is a P0 for the framework.
5. **Baseline arm.** Run steps 1–3 with bare Claude Code (plugin or skills off). The gap between the two arms is the honest answer to "what does SSVE add". Report it per lane, with token and time cost.

**Output:** one JSON scorecard per run (lane pass rates, gate catch matrix, self-corrections before land, escapes, tokens and time, with-svc vs bare delta). It's checked into `test-framework/results/` so model releases can be compared. Run it as a saved workflow (`svc-gauntlet`) or `claude -p` under `EVALS=1`. It's paid, so it's gated and never runs in default CI.

**Build order** (after Phase 0, alongside Phase 1):
1. The scorecard schema and fault-injection hooks for one gate.
2. The onboarding step plus its answer key.
3. The feature, bugfix and drift steps.
4. The full mutation matrix.
5. The baseline arm.

Prediction-carrying receipts and repair paths (Receipts 2.0) come next, because the gauntlet is what proves they raise the catch rate.

## Sources

- [Skills](https://code.claude.com/docs/en/skills) (frontmatter, listing budget, compaction, `skillOverrides`, `/skill-doctor`)
- [Memory and rules](https://code.claude.com/docs/en/memory) (path-specific rules)
- [Hooks reference](https://code.claude.com/docs/en/hooks) (`if`, `async`, `onFailure`, skill hooks, StopFailure)
- [Subagents](https://code.claude.com/docs/en/sub-agents) (model, effort, memory, isolation, omitClaudeMd)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Workflows](https://code.claude.com/docs/en/workflows)
- [/goal](https://code.claude.com/docs/en/goal)
- [Plugin components](https://code.claude.com/docs/en/plugins/components), [Plugin evals](https://code.claude.com/docs/en/plugin-evals), [Measure plugins](https://code.claude.com/docs/en/plugins/measure)
