# Owner requirements ledger (session of 2026-10-10)

Every requirement the owner stated in this session, with its status and evidence. Nothing is dropped: if a row is not done, it says what is missing. Update a row when its status changes.

Status values:
- **done**: shipped with tests.
- **partial**: shipped, but part of the request remains; the row says which part.
- **gated**: decided, waiting on data or approval.
- **open**: not started.

## Speed and reliability

| # | Requirement | Status | Evidence / what remains |
|---|---|---|---|
| 1 | Hooks must not slow the user; reliable first | partial | Git memo: dispatcher 428 → ~200 ms. `if` filters on two validators. Heartbeat async. Advisory mode no longer auto-provisions worktrees (3.9 s). The remaining ~60–80 ms per hook is Node start-up; the fix (native Go client plus warm daemon) is built but waits for owner approval, see `docs/decisions/2026-10-10-speed-and-defaults.md` H3 |
| 2 | Hooks run only when they add value | partial | `if` filters; D6 review in the decision record. Explore-time rule injection stays until H3 makes it free |
| 3 | Use the latest Claude Code and ML techniques, Rust or Go where they help | partial | Uses `if`, `async`, skill `!` dynamic context, `skillOverrides`, model aliases. Go front door built (H3) |
| 4 | Decide strategically myself; record and review | done | `docs/decisions/2026-10-10-speed-and-defaults.md`; strategic-reviewer pass |
| 5 | Never trade quality for speed | done | Each speed change in the decision record states why quality holds; one deferral (explore injection) for that reason |

## Framework mechanics

| # | Requirement | Status | Evidence / what remains |
|---|---|---|---|
| 6 | Merge 14 skills into 1 only if outcomes hold (growth example) | gated | D2: the target is a router skill with role reference files, agents and knowledge banks unchanged. Needs a before/after growth outcome scenario first |
| 7 | Receipts and self-eval; no slow backfill | done | Range attestation (delivery profiles); mirror ledger |
| 8 | Add-ons lazy and optional; a "hot router" | done | `addon-gateway`, `skills/addon-gateway/scripts/addon-index.mjs` |
| 9 | Dynamic model and effort router with escalation and evidence | done | `scripts/route-model.mjs`, `references/model-intel/` |
| 10 | Per-repo on/off | done | `scripts/svc-repo.mjs` |
| 11 | Claude Design import/sync; ad motion | partial | `design-sync` and `scripts/design-tokens.mjs` cover tokens and a storyboard mode. Rendering ad motion relies on the existing ad-video fleet |
| 12 | Optimised CLAUDE.md, AGENTS.md and other always-loaded files | open | Next context win (audit D7/D9) |
| 13 | Continuous learning; mirror protocol (with framework vs bare harness) | done | `scripts/mirror-ledger.mjs` |
| 14 | Prototype vs production planning; a prototype knows how to grow into production | done | `references/delivery-profiles.json`; `stage-activation --profile` |
| 15 | Self-improvement on harness version drift | done | `scripts/harness-drift.mjs` |
| 16 | Over-engineering index | done | `scripts/overengineering-index.mjs` |
| 17 | Reference prompts for Claude Code, Codex, agy, Grok, Cursor and others | done | `references/harness-playbook.json` |
| 18 | Planning defines the chain dynamically | done | `stage-activation --manifest --profile` |
| 19 | Worktree cleanup discipline; no fake receipts | partial | `svc-state-janitor` agent exists. No scheduled cleanup yet |
| 20 | Orchestrator knows when to compact, per layer | partial | Policy written (`references/cockpit-protocol.md`, Compaction by layer); not yet enforced by a hook |

## Founder cockpit (the product surface)

| # | Requirement | Status | Evidence / what remains |
|---|---|---|---|
| 21 | One focal point: a private page as the decision panel for any harness, Claude Code first | partial | Private cockpit artifact live: goals, plan lanes, three layers of detail, steering feed, challenge analysis. `templates/cockpit/cockpit.html`, `references/cockpit-protocol.md`, `scripts/cockpit.mjs` |
| 22 | Three layers: L1 intent and goals, L2 session orchestration (knows harnesses, subscriptions, subagents), L3 sub-sessions | partial | Defined in `references/cockpit-protocol.md`; the page shows them. Orchestrator automation still manual | Cockpit model: goal → cards → expandable layers |
| 23 | Input box for steering that controls the rest cheaply; voice later | partial | Steering box live; the orchestrator reads it at checkpoints. Voice not started |
| 24 | Goal cards: what, why, expected outcome, progress, "why this happened" expansions, grounded in market, business and internal knowledge | open | |
| 25 | Drill down as deep as the user wants; boxes that teach why something was decided; challenge any box, which triggers analysis and re-planning | partial | Cards open into why / decided because / teach / technical / sub-tasks; a challenge is analysed on the page and re-planned at the next checkpoint |
| 26 | Knows usage and limits; parallelises as far as the subscription allows (sequential on a $20 plan) | partial | `scripts/lib/parallelism.mjs` with `references/plan-limits.json`: a pro plan runs 1 lane, usage at 85% or more of the limit drops to 1, and `SVC_MAX_PARALLEL` can only lower the width. It sets the execution controller's default wave width when `SVC_PLAN` is set, and the cockpit shows it. Tested in `validate-cockpit-and-hook-bench.mjs`. Missing: live usage numbers (the plan limit is not readable from the CLI) |
| 27 | Pitch-deck-quality explanation of product, spec and journeys, grounded in business | open | |
| 28 | Metrics portal: audits sessions, measures spend per harness, suggests different approaches, self-amends mid-task | partial | `route-model stats` and the mirror ledger supply the data; no portal yet |
| 29 | Onboarding: suggest agents, reviews and CI setup for a repo | open | |
| 30 | Anonymised by default; works in cloud, WSL, laptop or VPS; MCP or CLI | open | |

## Founder brain

| # | Requirement | Status | Evidence / what remains |
|---|---|---|---|
| 31 | Orchestrates the founder's bots (Grok, Codex, others) and governs cost across them | partial | `harness-playbook`, `route-model`. No cross-bot usage ledger yet |
| 32 | Learns what converts: pages are judged by real conversion, honestly measured | open | Needs an outcome ledger fed by analytics, plus the growth outcome eval (row 6) |
| 33 | Production-ready by default (payments, compliance, legal research, scale); proven foundations, not boilerplate; validate where internal knowledge is weak | partial | Existing skills cover parts; not audited against this bar |
| 34 | Lightweight; nothing that does not buy a large founder gain | standing rule | Over-engineering index; every row above must justify itself |

## Added later in the session

| # | Requirement | Status | Evidence / what remains |
|---|---|---|---|
| 35 | Challenge the plan at full changeset depth; each step says how to build it and how to verify it, down to the lowest useful detail, so any model, even a weak one, produces a provable result | open | Extend plan-changeset blueprints with a per-step verification command and expected evidence; review-plan rejects steps without one |
| 36 | Prompts improve themselves from measured experience, per model, as models change | partial | `node scripts/outcome-eval.mjs promote --candidate <variant> --baseline <current> <results>` changes a prompt or method only on an established judged gain (CI above zero and p < 0.05), a higher solve rate, or equal results at lower cost. It is tested on the recorded results: production promoted on the product task; blueprint and lean rejected on spec-complete work, which moved the default there to plain. Candidate prompts run as `svc:<variant>` arms; the standing-rules section was the first change adopted this way and re-measured after wiring (11/20 → 19/20). Missing: automatic generation of new variants and a schedule that re-runs them on model releases |
| 37 | Best blueprint, not every variation: proven foundations and templates over boilerplate; innovation by trial and error only where nothing proven exists | partial | Over-engineering index and delivery profiles exist; no curated foundation catalog yet |
| 38 | Chief of staff rebuilt with real memory (Claude memory, repo files or an open-source store, chosen by evidence) | partial | Measured first: in a two-session scenario, owner rules from session 1 reached session 2 in 10/20 bare runs and 11/20 with the old svc prompt; models that wrote to `CLAUDE.md` (loaded into every session) kept them. The standing-rules section in `_shared/before-starting.md` now records owner rules there: 19/20 (p = 0.002 vs bare). See `test-framework/outcome-evals/PILLARS.md`. Still to do: the CoS's own decision queue measured the same way, and an external store compared against `CLAUDE.md` |
| 39 | Front ends feel alive, not boilerplate; growth changes ship safely; token spend only where it buys value | open | Ties to rows 32 and 37 |
| 40 | Evaluate everything we build: fix the outcome and how it is verified, leave the path free; known problems use proven technique at full speed, uncharted ones go by measured trial | partial | Each svc stage is now an eval against the bare model (`test-framework/outcome-evals/PILLARS.md`): review-exec (two sizes), review-plan, security review, implementation audit, bugfix root cause, spec drift and multi-session continuity, each with a planted-fault or hidden-fact grader proven against a reference and a plausible wrong answer. Hook speed is also an eval: `scripts/hook-bench.mjs` with `references/hook-budgets.json` (base commit fails the pre-edit gate, this branch passes). Still to do: outcome evals for the cockpit loop, the fleet merge (row 6) and prompts (row 36) |
| 41 | Ground everything in research, test and measure it; it must work even on Haiku | partial | `scripts/outcome-eval.mjs` runs real models against hidden graders, and each grader is checked against a reference and a planted bug. 66 Haiku 5.5 runs: every arm solves every task; the written blueprint costs 3.3× more on matched tasks for no gain, so the default method is now the lean verifier loop (`references/delivery-profiles.json` `method`). `references/claims.json` plus `scripts/verify-claims.mjs` reproduce every number. One-sentence product request: the production method scored 14.71/16 vs 7.14/16 for plain under a blind Opus judge over 7 builds per arm (12–19 verified journeys vs 0) at about $0.79 per build; it is now the method for underspecified work. A grader defect (smoke counted only buttons) was found from recorded failure reasons and fixed; builds are now kept for free regrading |
| 42 | Become the meta-harness: subscription-first, any harness, a fast engine underneath (Rust or Go where it pays) | open | `harness-playbook`, `route-model` and the cockpit are the start; the Go front door (H3) awaits approval |

## Added after the pillar evals (later on 2026-10-10)

| # | Requirement | Status | Evidence / what remains |
|---|---|---|---|
| 43 | Evaluate every SSVE pillar and checkpoint, in single-prompt and multi-session scenarios, not only product builds | partial | `test-framework/outcome-evals/PILLARS.md` measures 9 stages against the bare model (review-exec ×2, review-plan, security, audit, bugfix, drift, continuity, the game). `references/capability-coverage.json` lists every other unit with its next evaluation. Still to do: plan Phase 3 (Two-Box, review mechanisms, craft-prompt, kill signals, explore-solutions, full chain) |
| 44 | Grade on every dimension that defines production-ready and good software: correctness, security, slop, over-engineering, YAGNI, real tests, architecture, speed and taste, grounded in Anthropic's prompting and eval docs | partial | `references/quality-dimensions.json` (35 dimensions, 6 layers, each with its measure and source); `scripts/quality-probes.mjs` (test strength by mutation, size, duplication, slop, secrets, test hygiene). Still to do: load and latency probes for running servers, an accessibility probe |
| 45 | Use the per-model prompting guides (Haiku, Sonnet, Opus 5.5) and effort levels | partial | `scripts/outcome-eval.mjs` takes `--effort`; effort sweep reported in `test-framework/outcome-evals/PILLARS.md` (medium 18/18). Still to do: A/B the guides' named snippets (verification paragraph, early-stopping text, frontend anti-default list) as variant arms |
| 46 | A game benchmark with layers (rules, level design, feel, UX, art direction), informed by game developers' experience | done | `test-framework/outcome-evals/tasks/harbor-game/` (seed bots, determinism, frame time, screenshots, 13-claim judge); results in `test-framework/outcome-evals/PILLARS.md` |
| 47 | Run a free path and a constrained path, judge them, and learn which wins per kind of request | open | Plan Phases 3.1 and 4: build on Two-Box (`scripts/two-box-plan.mjs`) and the outcome learner in `scripts/route-model.mjs`, measured before anything new is built |
| 48 | No gaps: account for everything the framework already has (Two-Box, scouts, every mechanism) | done | `references/capability-coverage.json` (409 rows), built by `scripts/capability-coverage.mjs`; tier-1 `test-framework/evals/tier-1/validate-capability-coverage.mjs` fails when a shipped unit has no row |
| 49 | Boxes and the rest must work on every harness, Claude Code first | open | Plan Phase 3.1: a transport interface for Two-Box roles with a Claude Code transport and an isolation probe |
| 50 | Keep content only where it brings value now; drop the rest; re-decide per model as reality changes | partial | Procedure defined in the approved plan (value tests cheapest first, states keep/slim/lazy/retire/archive, per-model state, recheck on harness or model change). Still to do: `value-audit` script and its first run on this branch's reductions |
| 51 | Say honestly whether the public post's claims are backed | done | Answered in session with the measured evidence: gains on vague product requests, continuity and test strength; no gain on single checks or the small game |
