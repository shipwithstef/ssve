# Harness Orchestration — Detail

## Mechanism

Phase 5 of the harness workflow. Wires agents + skills into a single
orchestrator skill that coordinates the team.

### Orchestrator Patterns by Mode

**Agent Team mode:**
```
[Orchestrator/Leader]
  ├── TeamCreate(team, members)
  ├── TaskCreate(tasks with dependencies)
  ├── Members self-coordinate (SendMessage)
  ├── Collect results
  └── Clean up team
```

**Subagent mode:**
```
[Orchestrator]
  ├── Agent(agent-1, background=true)
  ├── Agent(agent-2, background=true)
  ├── Wait + collect
  └── Integrate output
```

### Data Passing Protocols

| Strategy | Tool | Mode | Use when |
|---|---|---|---|
| Message | SendMessage | Team only | Real-time coordination, lightweight feedback |
| Task | TaskCreate/TaskUpdate | Team only | Progress tracking, dependency management |
| File | Write/Read at `_workspace/` | Both | Large data, structured artifacts, audit trail |

**Recommended combo for team mode:** Task (coordination) + File (artifacts) + Message (real-time)

**File naming convention:** `{phase}_{agent}_{artifact}.{ext}`
**Intermediate artifacts:** `_workspace/` — preserved for audit, not cleaned up.
**Final output:** user-specified path only.

### Error Handling

Core principle: 1 retry → if fails again, proceed without that result (note the gap in output). Conflicting data is kept with source attribution, never silently deleted.

### Team Size Guidelines

| Scale | Team size | Tasks per member |
|---|---|---|
| Small (5-10 tasks) | 2-3 | 3-5 |
| Medium (10-20) | 3-5 | 4-6 |
| Large (20+) | 5-7 | 4-5 |

3 focused members > 5 scattered members.

### CLAUDE.md Registration

After harness is built, orchestrator registers context in project's CLAUDE.md:
- Agent table (name + one-line role)
- Skill table (name + purpose + which agent uses it)
- Execution rules (when to use harness vs direct response)
- Directory structure
- Change history

**Key split:** CLAUDE.md = "harness exists, when to use it." Orchestrator = "how to execute it." No duplication.

### Follow-up Support

Orchestrator must handle re-runs:
- Check `_workspace/` existence → partial re-run (specific agents only)
- New input → full re-run (archive previous as `_workspace_prev/`)
- No workspace → initial run

## Analysis

- **Useful for:** Any multi-agent workflow that needs persistent orchestration. The CLAUDE.md registration pattern is smart — ensures next session knows the harness exists.
- **Trade-offs:** CLAUDE.md registration adds project-specific content that persists. Could clutter CLAUDE.md over time with multiple harnesses.
- **Similar to:** svc's `route-workflow` orchestrates skills but doesn't use Agent Teams API. GSD's autonomous mode orchestrates phases but uses single-agent with subagent dispatch. Harness adds true multi-agent team coordination.
- **Could improve svc by:** The CLAUDE.md registration pattern could work for svc — after pipeline setup, write a "## svc Harness" section to CLAUDE.md so next session knows the pipeline state. We already have `project-state.md` for this, but CLAUDE.md is auto-loaded while project-state.md needs to be read manually.
- **Assumptions:** Projects have a CLAUDE.md or will get one. One harness per domain.
- **Watch out for:** Team dissolution between phases loses conversational context. File-based handoff is the bridge but it's lossy compared to shared memory.

### Subagent Mode Template (from orchestrator-template.md:160-260)

Lighter than team mode. Orchestrator calls Agent tool directly:
- Phase 0: context check (`_workspace/` exists → partial re-run, new input → archive old workspace)
- Phase 1: prepare input in `_workspace/00_input/`
- Phase 2: spawn agents (parallel or sequential) with explicit table: agent, subagent_type, input, output path, model, background flag
- Phase 3: collect results, integrate
- Phase 4: preserve `_workspace/` (never delete — audit trail)

### Orchestrator Writing Principles (from orchestrator-template.md:264-289)

1. State execution mode at top (team or subagent)
2. Team mode: specify TeamCreate/SendMessage/TaskCreate usage concretely
3. Subagent mode: specify ALL Agent tool parameters (name, type, prompt, background)
4. Absolute file paths only — no relative, always `_workspace/` based
5. Explicit phase dependencies — which phase depends on which
6. Realistic error handling — don't assume everything succeeds
7. Test scenarios mandatory — 1 happy path + 1 error path minimum
8. Description MUST include follow-up keywords ("re-run", "update", "modify") or the harness dies after first use

## Key Source Files (L4)
- `skills/harness/SKILL.md:166-314` — Phase 5 orchestration
- `skills/harness/references/orchestrator-template.md:1-289` — full template (both modes)
