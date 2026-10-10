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
| 8 | Add-ons lazy and optional; a "hot router" | done | `addon-gateway`, `scripts/addon-index.mjs` |
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
| 26 | Knows usage and limits; parallelises as far as the subscription allows (sequential on a $20 plan) | open | Subscription profile in the cockpit model; `route-model` supplies cost |
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
| 36 | Prompts improve themselves from measured experience, per model, as models change | open | Prompt-variant ledger on top of the mirror ledger; `harness-drift` triggers re-tests on model releases |
| 37 | Best blueprint, not every variation: proven foundations and templates over boilerplate; innovation by trial and error only where nothing proven exists | partial | Over-engineering index and delivery profiles exist; no curated foundation catalog yet |
| 38 | Chief of staff rebuilt with real memory (Claude memory, repo files or an open-source store, chosen by evidence) | open | Evaluate recall quality and cost of the three options; the CoS writes decisions to it and reads it at session start |
| 39 | Front ends feel alive, not boilerplate; growth changes ship safely; token spend only where it buys value | open | Ties to rows 32 and 37 |
| 40 | Evaluate everything we build: fix the outcome and how it is verified, leave the path free; known problems use proven technique at full speed, uncharted ones go by measured trial | partial | Hook speed is now an eval: `scripts/hook-bench.mjs` with `references/hook-budgets.json` (base commit fails the pre-edit gate, this branch passes). Still to do: outcome evals for the cockpit loop, the fleet merge (row 6) and prompts (row 36) |
| 41 | Ground everything in research, test and measure it; it must work even on Haiku | partial | `scripts/outcome-eval.mjs` runs real models against hidden graders, and each grader is checked against a reference and a planted bug. 66 Haiku 5.5 runs: every arm solves every task; the written blueprint costs 3.3× more on matched tasks for no gain, so the default method is now the lean verifier loop (`references/delivery-profiles.json` `method`). `references/claims.json` plus `scripts/verify-claims.mjs` reproduce every number. One-sentence product request: the production method scored 14.67/16 vs 6.0/16 for plain under a blind Opus judge (12–21 verified journeys vs 0) at about $0.70 per build; it is now the method for underspecified work. Browser verification added after its smoke failures; v2 rerun in progress |
| 42 | Become the meta-harness: subscription-first, any harness, a fast engine underneath (Rust or Go where it pays) | open | `harness-playbook`, `route-model` and the cockpit are the start; the Go front door (H3) awaits approval |
