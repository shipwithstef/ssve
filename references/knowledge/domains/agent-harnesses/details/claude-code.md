# Claude Code Capabilities (Layer 4 - Reverse Engineered)

This document provides absolute domain expertise on Claude Code's internal architecture, protocols, and hidden mechanisms, established through binary analysis and source-map forensics.

## 1. Core Architecture (Tengu Engine)
- **Runtime**: Bun Single-Executable Application (SEA). Bundles JavaScriptCore + 10MB minified JS bundle.
- **UI Architecture**: built on **React + Ink** for terminal rendering. Uses Yoga for flexbox layouts.
- **Orchestration**: Managed by `QueryEngine.ts`. Implements a layered agentic loop with parallel pre-fetching of memory and skills.
- **Internal Codenames**: 
  - **Tengu**: The project's core agentic protocol.
  - **Kairos**: Proactive background execution mode.
  - **Ultraplan**: Asynchronous architectural planning engine.

## 2. Memory & Context (AutoDream)
- **Algorithm**: A 4-phase "sleep-time" consolidation process (Orient → Gather → Consolidate → Prune).
- **Triggers**: 24h since last run AND 5+ sessions AND successful acquisition of `consolidation.lock`.
- **Elastic Compaction**: Dynamically compresses history by merging fragmented notes and converting relative dates to absolute timestamps.
- **Constraints**: Rebuilds `MEMORY.md` with a strict **200-line / 25KB** context budget.

## 3. Protocol & Tools
- **Tool Schema**: JSON-RPC based. Supports 60+ internal tools (e.g., `BashTool`, `FileReadTool`).
- **Coordinator Mode**: Allows a central coordinator agent to spawn workers that communicate via a shared gated scratchpad.
- **Permission Matrix**: Granular per-tool capability-based security enforced before system calls.

## 4. Extraction & Inspection
- **Bundle Extraction**: Locate the `Bun!` trailer to find the TOC offset, then use `dd` to carve out the JavaScript source bundle.
- **Schemas**: Unofficial JSON schemas for plugins and marketplaces are available via community mirrors (e.g., `hesreallyhim/claude-code-json-schema`).

## 5. Hidden Internal Flags
- `tengu_onyx_plover`: Core toggle for AutoDream/Memory consolidation.
- `undercover_mode`: Internal Anthropic employee mode that strips AI identifiers from outputs.
- `experimental_agent_handoff`: Protocol-level support for seamless session transfer between subagents.

## 6. Integration Notes for SVC
- **Protocol-Level Interfacing**: Map SVC skills to custom agents with `isolation: worktree` for native branching support.
- **Gated Scratchpad**: Utilize the shared directory protocol for multi-agent SVC lanes.
- **Elastic Context Defense**: Monitor `MEMORY.md` line counts to prevent framework instructions from being pruned by AutoDream.
