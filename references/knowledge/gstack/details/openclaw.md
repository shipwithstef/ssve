# gstack OpenClaw Integration — Details

## Mechanism

OpenClaw is a Telegram-based AI orchestrator by Peter Steinberger. gstack
integrates as a methodology source — OpenClaw's ACP runtime spawns Claude Code
sessions natively, and gstack provides planning discipline + skills.

### Architecture

```
OpenClaw (Telegram)                  gstack repo
  ├── Native skills (conversational)    ├── Generates native skills
  │   office-hours, ceo-review,         │   via gen-skill-docs pipeline
  │   investigate, retro                │
  ├── sessions_spawn(runtime: "acp")    ├── Generates gstack-lite
  │   └── Claude Code                   │   (planning discipline)
  │       └── gstack installed          ├── Generates gstack-full
  └── Dispatch routing (AGENTS.md)      │   (complete pipeline)
                                        └── gstack-plan (review gauntlet)
```

### Dispatch Tiers

| Tier | When | Injected |
|---|---|---|
| Simple | <10 lines, typos, config | No gstack context |
| Medium | Multi-file, obvious approach | gstack-lite CLAUDE.md appended |
| Heavy | Named skill (/cso, /review) | "Load gstack. Run /X" |
| Full | Complete features/objectives | gstack-full pipeline appended |
| Plan | Planning only | gstack-plan pipeline appended |

### Behavioral Rules

1. Always spawn, never redirect (never tell user to open Claude Code)
2. Resolve the repo (set working directory)
3. Autoplan runs end-to-end (full pipeline, report back)

### gstack-lite (Medium tier)

~15 lines of planning discipline:
1. Read every file before modifying
2. State plan: what, why, which files, test case, risk
3. Prefer completeness, existing patterns, reversible choices
4. Self-review before reporting done
5. Report: what shipped, decisions, uncertainties

A/B tested: 2x time, meaningfully better output.

### gstack-full (Full tier)

Chains skills: Read CLAUDE.md → /autoplan → implement → /ship → report PR URL.

### gstack-plan (Plan tier)

Review gauntlet: /office-hours → /autoplan (CEO+eng+design+DX+codex) → save plan.
No implementation. Orchestrator persists plan link.

### Native ClawHub Skills (4)

Pure methodology, no gstack infrastructure. Published to ClawHub:
- `gstack-openclaw-office-hours` (375 lines) — 6 forcing questions
- `gstack-openclaw-ceo-review` (193 lines) — 10-section review, 4 modes
- `gstack-openclaw-investigate` (136 lines) — 4-phase debugging
- `gstack-openclaw-retro` (301 lines) — weekly review

### Spawned Session Detection

`OPENCLAW_SESSION=1` env var → skip interactive prompts, upgrade checks,
telemetry prompts. Focus on task completion and prose reporting.

## Analysis

The OpenClaw integration is a clean separation: OpenClaw handles orchestration
(messaging, calendar, memory), gstack handles methodology (planning, review,
QA). The 5-tier dispatch routing is pragmatic — simple tasks skip gstack
overhead entirely, only complex work gets the full pipeline.

The native ClawHub skills (hand-crafted conversational adaptations vs generated
10-25K token versions) show maturity: the generated versions were too heavy,
so they were replaced with focused 136-375 line methodology skills.

## L4 Pointers

- OpenClaw docs: `docs/OPENCLAW.md`
- Agents section: `openclaw/agents-gstack-section.md`
- gstack-lite: `openclaw/gstack-lite-CLAUDE.md`
- gstack-full: `openclaw/gstack-full-CLAUDE.md`
- gstack-plan: `openclaw/gstack-plan-CLAUDE.md`
- Native skills: `openclaw/skills/` (4 subdirs)
- Host config: `hosts/openclaw.ts`
- Adapter: `scripts/host-adapters/openclaw-adapter.ts`
