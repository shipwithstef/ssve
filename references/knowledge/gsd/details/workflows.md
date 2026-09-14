# GSD Workflows Details

Workflows form the core orchestration layer.

## Major Workflows
- **new-project**: Interactive initialization. Employs 4x parallel research agents to scaffold requirements and roadmap.
- **discuss-phase**: Resolves gray areas before any planning. Employs codebase-first assumptions via `gsd-assumptions-analyzer`.
- **plan-phase**: Generates XML plans. Runs a checking loop (up to 3x) via `gsd-plan-checker` to catch missed requirements.
- **execute-phase**: Spins up isolated executors per plan task, committing atomically.
- **verify-work & ship**: User acceptance test mapping and PR generation.

## Routing and Grouping (v1.41.0+)
- **Namespace Meta-Skills**: Workflows are grouped into 6 namespaces (e.g. `gsd:workflow`, `gsd:ideate`). This two-stage routing reduces cold-start overhead from ~12k tokens to ~120 tokens.
- **TDD Pipeline Mode**: Extends `execute-phase` to track test creation and red/green cycles explicitly.
- **Autonomous `--to N` / `--interactive`**: Allows bounded or mixed-interaction autonomous runs.
