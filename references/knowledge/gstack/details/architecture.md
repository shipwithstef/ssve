# gstack Architecture — Details

## Multi-Agent Workflow

gstack turns a single LLM session into a virtual engineering team. It does this via:
1. **Specialized Skills**: 36+ directories containing `SKILL.md` files with strict personas (CEO, Eng, Designer, etc.).
2. **Context Passing**: Each skill writes an artifact (e.g., `/office-hours` -> `DESIGN.md`) that the next skill reads.
3. **Task Orchestration**: Commands like `/autoplan` chain these skills together, passing state automatically.

## Core Components

### 1. Browse Daemon (`browse/`)
- **Persistent Browser**: A Bun-compiled binary that keeps Chromium alive across tool calls.
- **Localhost API**: Communicates with the agent via HTTP POST to `localhost`.
- **Reference System**: Extracts the ARIA tree to create stable `@e1`, `@e2` element references.
- **Security**: 4 layers of prompt injection defense (datamarking, hidden element stripping, content filters, instruction hardening).
- **Authentication**: Constant-time token comparison hardened with UTF-8 byte-length checks.

### 2. Design Tool (`design/`)
- **CLI Interface**: `$D` binary for mockup generation.
- **Multi-Model Pipeline**: Uses GPT Vision for review and Image API for generation.
- **Pretext Renderer**: A 30KB, zero-dependency layout engine that converts visual mockups to responsive HTML/CSS.

### 3. Chrome Extension (`extension/`)
- **Live Sidebar**: Injects a chat interface and activity feed directly into the real browser.
- **Health Polling**: Continuously monitors the status of the local `gstack` daemon.
- **Direct Inspection**: Element picker that maps live styles back to gstack design tokens.

### 4. SDK (`sdk/`)
- **TypeScript Core**: Programmatic interface for all gstack capabilities.
- **Transport Layer**: Abstracts communication with different hosts (Claude Code, Codex, Cursor, etc.).
- **Event-Driven**: Emits rich events for costs, tool progress, and rate limits.

## Intelligence Assets

- **Preamble System**: Dynamically generated skill headers (`{{PREAMBLE}}`) that inject global rules, such as the CJK UTF-8 rule (never escape non-ASCII).
- **Thinking Models**: Curated cognitive models for Research, Planning, Debug, and Verification clusters (e.g., First Principles, Pre-Mortem, MECE).
- **Few-Shot Examples**: Calibration corpora for verifier and plan-checker agents.

## L4 Pointers

- **Browse src**: `browse/src/` (CDP bridge, security layers, server)
- **Extension code**: `extension/` (background, sidepanel, content)
- **SDK internals**: `sdk/src/` (event stream, phase runner, prompt builder)
- **Architecture doc**: `ARCHITECTURE.md`
- **Design doc**: `DESIGN.md`
