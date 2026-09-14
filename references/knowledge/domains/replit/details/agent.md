# Replit Agent 4 — Detailed Capability Breakdown

## Mechanism
Agent 4 is an autonomous coding system built into Replit's cloud IDE. It uses a structured pipeline: Ideation → Design → Build → Review. The build phase can spin up parallel subagents that work on different parts of the codebase simultaneously. An orchestrating agent coordinates threads and resolves merge conflicts automatically (~90% success rate).

## Analysis
- **Strength:** All-in-one workflow from idea to deployed app in one browser tab
- **Strength:** Parallel execution makes complex multi-file builds significantly faster
- **Strength:** Self-testing reduces the "it works on my machine" problem
- **Weakness:** Can forcefully apply unrequested changes (full refactors for small tweaks)
- **Weakness:** Credit consumption can spiral if Agent gets stuck in loops
- **Weakness:** No way to downgrade to earlier Agent versions

## L4 Pointers
- `docs.replit.com/core-concepts/agent`
- `docs.replit.com/core-concepts/agent/task-system`
- `docs.replit.com/core-concepts/agent/plan-mode`
- `docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks`
