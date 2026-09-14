# ECC 2.0 Alpha (Rust Control Plane) — Detail

Source: `ecc2/README.md`, `ecc2/Cargo.toml`, `WORKING-CONTEXT.md`, `README.md`

## Status

Alpha. In-tree (builds locally), not GA. Usable for local experimentation only.

## What It Is

ECC 2.0 is the layer above individual harness installs. Goal: manage many agent sessions from one surface with unified observability, orchestration, worktree management, and review controls. Claude Code first, future harness interoperability planned.

## Current Commands

```bash
ecc2 dashboard   # Terminal UI dashboard
ecc2 start       # Start a session
ecc2 sessions    # List sessions
ecc2 status      # Session status
ecc2 stop        # Stop a session
ecc2 resume      # Resume a session
ecc2 daemon      # Background daemon mode
```

## Current Capabilities

- Terminal UI dashboard (ratatui-based)
- Session store backed by SQLite
- Session start/stop/resume flows
- Background daemon mode
- Observability and risk-scoring primitives
- Worktree-aware session scaffolding
- Basic multi-session state and output tracking

## Build

```bash
cargo build --manifest-path ecc2/Cargo.toml
```

Dependencies: Rust toolchain, `ratatui` 0.30 with `crossterm_0_28`. Low advisory resolved (lru 0.16.3 via ratatui 0.30 upgrade).

## Roadmap Vision

- Multi-session management from one control surface
- Session state, output, and risk visibility in one dashboard
- Orchestration primitives (task dispatch, agent fan-out)
- Worktree management (create, promote, diff)
- Review controls (gate, approve, reject)
- Harness interoperability (Claude Code → Codex → others)

## Relationship to ECC v1.x

ECC v1.x is the current shipping product (hooks, skills, agents, commands). ECC 2.0 is the platform layer above it — it does not replace v1 but manages many v1 sessions. `WORKING-CONTEXT.md` notes active work: control-plane primitives, operator surface, self-improving skills.
