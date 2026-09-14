# Harness — Capabilities

Source: https://github.com/revfactory/harness
SHA: 2d84863bd10070c48b99b973e370f160e7a51ad4
Analyzed: 2026-04-07
License: Apache-2.0

## What It Is

Agent Team & Skill Architect — a Claude Code plugin (meta-skill) that designs
domain-specific agent teams, defines specialized agents, and generates the
skills they use. You say "build a harness for this project" and it generates
`.claude/agents/` definitions + `.claude/skills/` files tailored to the domain.

## Core Architecture

| Area | What |
|---|---|
| Team design | 6 architectural patterns for agent collaboration |
| Skill generation | Auto-generates skills with progressive disclosure |
| Orchestration | Inter-agent data passing, error handling, coordination |
| Validation | Trigger verification, dry-run, with-skill vs without-skill comparison |
| Evolution | Feedback loop, change history, regression prevention |
| CLAUDE.md integration | Registers harness context so agent teams persist across sessions |

## 6 Architecture Patterns

| Pattern | When to use |
|---|---|
| Pipeline | Sequential dependent tasks |
| Fan-out/Fan-in | Parallel independent tasks |
| Expert Pool | Conditional agent selection based on context |
| Producer-Reviewer | Generate then quality-check |
| Supervisor | Central agent manages state + dynamic distribution |
| Hierarchical Delegation | Upper agent recursively delegates to lower |

## 7-Phase Workflow

| Phase | What it does |
|---|---|
| 0: Audit | Check existing harness state, decide: new/extend/maintain |
| 1: Domain Analysis | Identify work types, tech stack, user skill level |
| 2: Team Architecture | Choose execution mode (team vs subagent) + pattern |
| 3: Agent Generation | Write `.claude/agents/{name}.md` with roles, protocols, communication |
| 4: Skill Generation | Write `.claude/skills/{name}/SKILL.md` with progressive disclosure |
| 5: Orchestration | Wire agents into orchestrator skill, data passing, error handling |
| 6: Validation | Structure check, trigger testing, dry-run, execution test |
| 7: Evolution | Feedback collection, iterative improvement, change tracking |

## Key Design Decisions

- Agent teams as default execution mode (not subagents)
- Agent definitions MUST be files (`.claude/agents/*.md`) — never inline prompts
- All agents use `model: "opus"` for maximum quality
- CLAUDE.md is the session persistence mechanism — registers harness so next session finds it
- Orchestrator carries workflow detail, CLAUDE.md carries existence + trigger rules
- One team per session, but teams can be dissolved and reformed between phases
- `_workspace/` for intermediate artifacts, preserved for audit trail
- Feedback-driven evolution: same feedback 2x → auto-suggest modification

## Execution Modes

| Mode | When | How |
|---|---|---|
| Agent Team (default) | 2+ agents need to collaborate | TeamCreate → TaskCreate → SendMessage between members |
| Subagent | 1 agent only, or no inter-agent communication needed | Agent tool → background tasks → collect results |

## Data Passing Protocols

| Strategy | Mechanism | When |
|---|---|---|
| Message-based | SendMessage between team members | Real-time coordination, lightweight |
| Task-based | TaskCreate/TaskUpdate | Progress tracking, dependency management |
| File-based | Write/read at agreed paths | Large data, structured artifacts, audit trail |

## Dependencies

None — single plugin, 21 files total. No external deps.
