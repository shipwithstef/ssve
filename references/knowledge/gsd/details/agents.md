# GSD Agents Details

Agents in GSD are single-purpose LLM system prompts equipped with specific tools. They do not orchestrate; they execute tasks and report back.

## Catalog
- **Planning**: `gsd-planner`, `gsd-roadmapper`, `gsd-assumptions-analyzer`, `gsd-plan-checker`
- **Execution**: `gsd-executor`, `gsd-debugger`
- **Research**: `gsd-project-researcher`, `gsd-phase-researcher`, `gsd-research-synthesizer`, `gsd-codebase-mapper`
- **Verification**: `gsd-verifier`, `gsd-integration-checker`, `gsd-nyquist-auditor`, `gsd-security-auditor`, `gsd-ui-checker`, `gsd-ui-auditor`
- **Docs/Intel**: `gsd-doc-writer`, `gsd-doc-verifier`, `gsd-intel-updater`, `gsd-user-profiler`

## Agent Model Profiling
Controlled via `model_profile` in `config.json`.
Options: `quality`, `balanced`, `budget`, `adaptive`, `inherit`.
Each agent is mapped to a model tier (Opus, Sonnet, Haiku, or inherited from host).

## New Agents (v1.35+)
- **gsd-code-reviewer / gsd-code-fixer**: Full-cycle diff review and auto-fix loop.
- **gsd-eval-auditor / gsd-eval-planner**: AI integration phase checking and benchmarking.
