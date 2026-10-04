# GOAL — Orchestrator OS (SSVE) + Novisenti M1 as the first tenant

Paste this as the goal for the parent Claude session. Started 2026-10-03.

## End state (all must be true and verified)
1. **Control pane replaces chat as the primary interface.** A Claude Code mod shows a zero-LLM, live (≤60 s) expandable flow of goals → lanes → tasks: executor (model/CLI/effort), estimate vs elapsed, state, blockers, cost so far. Expanding a task shows its description, acceptance and last events. Buttons: details (no LLM), btw (cheap model), steer (resume, owner confirms), stop. Chat output is optional; global steering is a single input.
2. **Hierarchical orchestration.** One parent orchestrator (Claude, low effort, owns budget, priorities and cross-goal conflicts) and one child orchestrator per goal (Claude session, low effort, owns that goal's PLAN.md/BOARD and its workers). Parent and children talk through session messaging (ListAgents/SendMessage) and a shared `status.json`; children never share write paths; only the parent changes budget or cross-goal priority. Workers (Codex Sol 6.1, Cursor Grok 4.7) are launched only through one dispatcher wrapper that registers task, session id, log, timeout and heartbeat.
3. **Orchestrator economy.** Cheap models draft card sections (architecture, style, tests, UI). Claude writes ≤10-line directions and ≤10-line corrections, and reads status/completion reports, not logs. Cross-family per-task review with repo access, proof-carrying blockers, ≤2 rounds per feature; Opus holistic review only at milestones. Opus share of the $20 plan is measured per goal and shown in the pane.
4. **SSVE restructured.** Review packet made agentic (fix `review-cross-model/SKILL.md:11,112-154,368`, `run-external-review.mjs:1262,736,1243,1903`). Hook noise for read-only calls removed. Skills audited for use: unused or duplicated skills disabled/merged only where 100% sure (evidence: invocation history + references), with a reversible list. One-living-plan validator. Worktree reconciliation.
5. **Spot-VM resilience.** On boot after eviction, a systemd unit runs a recovery script: reconcile worktrees/status.json, resume the parent Claude session, which resumes each interrupted child and worker via `claude --resume` / `codex exec resume` / `cursor-agent --resume`, without duplicating writers or re-running paid steps. The owner can attach to the parent from Claude Code on the web/desktop/mobile (Remote Control). Written as a generic runbook + code (Azure Spot VM: eviction notice via Scheduled Events, boot unit, state on persistent disk) that anyone can provision.
6. **Self-measurement.** Use Claude Code's eval tooling (`claude plugin eval`, `/skill-doctor`) and the session-replay fixture of the 21 Sep–3 Oct Novisenti run to show: fewer coordination calls per accepted task, zero false hook advisories, ≤2 review rounds, owner interruptions surfaced up front.
7. **Novisenti M1 delivered in parallel as the first child goal** (detected problem → evidenced, program-fit proposal, saved/reopened/exported on Azure, ≤$5/report, ≤$10 test cap). Novisenti is never blocked waiting on framework work.

## Roles
- **Astra high:** architecture plans and reviews of designs (control pane, hierarchy, recovery, skill restructure). **Sol 6.1 high:** implementation of framework code, mod, collector, recovery. **Grok 4.7 high (Cursor):** UI polish, per-task review of Sol code, web/X research. **Claude:** direction, short corrections, acceptance, milestone review.

## Order (gates)
0. Now: Astra control-pane design (running) → Claude corrections.
1. Astra high: one architecture for items 1, 2, 5 together (pane + hierarchy + recovery share `status.json` and the dispatcher). Claude review ≤1 round.
2. Sol high builds dispatcher + collector + pane (tests: `claude plugin validate/test`, recorded Codex/Cursor stream fixtures). Novisenti M1 workers switch to the dispatcher as soon as it exists.
3. Sol high: SSVE review fix + hook noise + plan validator (item 4), each with a replay test.
4. Astra high: skill usage audit → reversible disable/merge list → Claude approves → Sol applies.
5. Sol high: spot recovery + runbook; tested by a simulated reboot on this VM.
6. Measure (item 6); write results to the pane and a short report.

## Constraints
No paid Azure analysis without owner approval (Novisenti P8). No deletion of skills/worktrees without a reversible record. Every worker run has a generous hard timeout, memory cap and resume text. Every claim of "done" cites an acceptance command Claude re-ran.
