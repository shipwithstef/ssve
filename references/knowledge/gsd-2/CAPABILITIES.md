# GSD-2 — Capabilities

Source: https://github.com/gsd-build/gsd-2
Version: 2.78.1 (SHA: 42ef05fb)
Analyzed: 2026-04-30
License: MIT
Node: >=22.0.0

## What It Is

Standalone TypeScript CLI coding agent built on the Pi SDK. Unlike GSD-1 (meta-prompting slash commands), GSD-2 is a full agent harness that programmatically controls context windows, manages git worktrees, tracks cost/tokens, detects stuck loops, recovers from crashes, and auto-advances through milestones without human intervention. One command, walk away, come back to shipped code.

## Core Architecture

- **6 execution modes**: interactive TUI, headless RPC, web dashboard, print/one-shot, subcommands, auto shorthand
- **State machine auto mode**: Milestone → Slice → Task hierarchy; disk-first `.gsd/` state (Markdown + JSON + SQLite)
- **Fresh session per unit**: every task gets a clean ~200K-token context window
- **Git isolation via worktrees**: milestone branches, squash-merge on completion, bidirectional state sync
- **Extension-first loading**: 21 bundled extensions + user-installed; topological sort via Kahn's algorithm
- **Pi SDK monorepo**: pi-ai (LLM registry), pi-agent-core, pi-coding-agent (~400 symbols), pi-tui, daemon, mcp-server, rpc-client, native bindings
- **Native Rust engine**: libgit2, ripgrep, ast-grep (40+ languages), glob, fuzzy find, process tree, diff, truncation, TTSR regex engine

## Key Capabilities

| Area | Capability | Detail File |
|------|-----------|-------------|
| **CLI** | Multi-mode entry, headless RPC orchestration with restart loop, web mode boot with health polling, worktree lifecycle (create/switch/merge/remove) | [core-cli.md](details/core-cli.md) |
| **Auto Pipeline** | State-machine dispatch, supervisor signal handling, session locks (`proper-lockfile`), crash recovery, artifact verification per unit type, merge reconciliation, milestone classification | [auto-pipeline.md](details/auto-pipeline.md) |
| **Extensions** | Discovery (package.json `pi` manifest precedence), registry (opt-out by default), validation (D-03–D-10), topological loading, resource syncing with content fingerprinting, node_modules symlink management (incl. pnpm) | [extension-system.md](details/extension-system.md) |
| **GSD Extension** | `/gsd` command with 26 natural-language routes, 16-category preferences wizard, 12 bootstrap tool sets (exec/memory/query/journal/db/dynamic/hooks/shortcuts), write-gate with depth verification, tool-call loop guard (SHA-256) | [gsd-extension-core.md](details/gsd-extension-core.md) |
| **Pi SDK** | 20+ LLM provider support (Anthropic, OpenAI, Google, OpenRouter, Copilot, Bedrock, Azure, Groq, etc.), three-tier model registry (generated/custom/patches), OAuth + API key auth, compaction, session manager, blob store, artifact manager, skills loading | [pi-sdk.md](details/pi-sdk.md) |
| **Native Engine** | N-API Rust modules: git (libgit2 read/write), grep (ripgrep internals), AST (ast-grep 40+ langs), glob, fuzzy find, diff (Myers), process tree (Linux/macOS/Windows), TTSR (RegexSet), truncate, JSON parse, stream processing, xxHash | [native-engine.md](details/native-engine.md) |
| **Web/Studio** | Next.js web UI (API routes for live-state, steer, hooks, projects, visualizer, forensics), Electron studio (bootstrap), VS Code extension (48 commands, SCM provider, diagnostics bridge, git integration, 3 approval modes) | [web-studio.md](details/web-studio.md) |
| **Agents** | 5 built-in agents (worker, planner-sonnet, reviewer-sonnet, researcher, debugger-sonnet) with routing guards and conflict lists | [skills-agents.md](details/skills-agents.md) |
| **Memory** | 4-entry-point ingest (note/file/url/artifact), background LLM extraction with secret redaction (10 regex patterns), fire-and-forget with mutex/rate-limit | [skills-agents.md](details/skills-agents.md) |
| **Orchestrator** | Meta-skill for autonomous builds via headless CLI; 5-step spec→software workflow; monitor-and-poll with 13 phases; exit codes 0/1/10/11; answer injection; 13 event types | [docs-orchestrator.md](details/docs-orchestrator.md) |
