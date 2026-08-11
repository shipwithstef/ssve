# GSD (Get Shit Done) — Capabilities

Source: https://github.com/gsd-build/get-shit-done
Version: v1.50.0-canary.1 / v1.41.0 stable (npm: get-shit-done-cc)
SHA: latest main as of 2026-05-11
Analyzed: 2026-05-11
Stars: 48K+
Author: TÂCHES
License: MIT
Node: >=22.0.0

## What It Is

Lightweight meta-prompting, context engineering, and spec-driven development system for AI coding agents. Solves "context rot" — the quality degradation as an AI fills its context window. Installs as slash commands + hooks + agents into a massive array of runtimes (Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, Augment, Trae, Cline, CodeBuddy, Qwen Code).

## Core Architecture

- **4-layer stack**: Command (.md) → Workflow (.md) → Agent (.md) → CLI tools (.cjs)
- **File-based state**: `.planning/` directory with Markdown + JSON, no DB, no server.
- **Fresh context per agent**: each subagent gets clean 200K (or 1M) context — zero accumulated garbage.
- **Thin orchestrators**: workflows load context, spawn agents, collect results, update state.
- **Vertical MVP / TDD / UAT planning track (v1.50.0)**: End-to-end "MVP mode" pipeline.
- **Six namespace meta-skills (v1.41.0)**: Hierarchical routing (`gsd:workflow`, `gsd:project`, `gsd:review`, `gsd:context`, `gsd:manage`, `gsd:ideate`). Cuts cold-start overhead dramatically.
- **Absent = enabled**: missing config flags default to true; users opt out, not in.

## Pipeline

discuss → plan → execute → verify → ship (per phase, per milestone)

| Stage | What happens | Agent(s) | Produces |
|---|---|---|---|
| new-project | Questions + 4x parallel research → synthesis → requirements → roadmap | project-researcher, research-synthesizer, roadmapper | PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, research/ |
| discuss-phase | Identify gray areas, capture decisions | assumptions-analyzer OR advisor-researcher | CONTEXT.md |
| plan-phase | Research → plan → verify loop (max 3) | phase-researcher, planner, plan-checker | RESEARCH.md, PLAN.md files |
| execute-phase | Wave execution with atomic commits | executor (parallel per wave), verifier | code, commits, SUMMARY.md, VERIFICATION.md |
| verify-work | Human acceptance testing | debugger (for failures) | UAT.md |
| ship | PR creation | — | Git branch + PR |

## New Core Mechanisms (v1.35.0 - v1.50.0)

- **Package Legitimacy Gate (v1.42.0)**: Three-layer defense against AI-hallucinated package names.
- **Graphify Commit-Based Staleness (v1.41.0)**: Embeds `built_at_commit` into `graph.json` to detect staleness accurately.
- **Context-Window Utilization Guard (v1.40.0)**: Warns at 60%, critical at 70% to prevent reasoning degradation.
- **Phase-Lifecycle Status-Line**: Reads `active_phase`, `next_action`, `next_phases`, and `progress` from STATE.md for UI display.
- **TDD Pipeline Mode (v1.36.0)**: Native test-driven development tracking across plans.
- **Plan Bounce (v1.36.0)**: Mechanism to bounce back inadequate plans.

## SDK (@gsd-build/sdk v0.1.0+)

TypeScript SDK for headless/programmatic GSD execution. Built on @anthropic-ai/claude-agent-sdk.
Supports Workstream namespacing seamlessly.

See `details/` for deep-dives on Architecture, Workflows, SDK, Hooks, Agents, and Unique Mechanics.
