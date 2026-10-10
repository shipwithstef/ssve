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
| 20 | Orchestrator knows when to compact, per layer | open | Policy to add in the cockpit/orchestrator layer: layer 2 compacts after a sequential phase closes, layer 3 sub-sessions end instead of compacting |

## Founder cockpit (the product surface)

| # | Requirement | Status | Evidence / what remains |
|---|---|---|---|
| 21 | One focal point: a private page as the decision panel for any harness, Claude Code first | open | Building `cockpit`: a private artifact page whose shared database the orchestrator writes and the owner steers |
| 22 | Three layers: L1 intent and goals, L2 session orchestration (knows harnesses, subscriptions, subagents), L3 sub-sessions | open | Cockpit model: goal → cards → expandable layers |
| 23 | Input box for steering that controls the rest cheaply; voice later | open | Steering entries land in the cockpit database; the orchestrator reads them at checkpoints |
| 24 | Goal cards: what, why, expected outcome, progress, "why this happened" expansions, grounded in market, business and internal knowledge | open | |
| 25 | Drill down as deep as the user wants; boxes that teach why something was decided; challenge any box, which triggers analysis and re-planning | open | Challenge entries become re-plan inputs |
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
