# GSD SDK Details

The `@gsd-build/sdk` package provides a programmatic bridge to the GSD system, allowing CI/CD, headless workers, and other agent harnesses to drive the framework.

## Core Modules
- `cli.ts`: Entrypoint for external command ingestion.
- `phase-runner.ts`: Orchestrates Phase-level state machines.
- `plan-parser.ts`: Robust XML extraction for plan verification.
- `context-engine.ts`: Calculates tokens and applies smart markdown truncation to stay within budget.
- `config.ts` / `tool-scoping.ts`: Security and permissions boundaries.

## Transports
Supports a direct Subprocess (CLI) transport as well as a WebSocket transport for remote (agent-in-cloud) execution.

## v1.50.0 Extensions
- Deepened the package seam and phase lifecycle seams to facilitate cleaner module boundaries and integration with complex multi-workspace architectures.
- MVP Mode SDK Resolution Layer provides an accelerated track bypassing heavy planning.
