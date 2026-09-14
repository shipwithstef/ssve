# Skill Chaining Findings

> Discovered 2026-04-04. Proven with chain-test-a/b/c.

## Core Discovery

Skill chaining works natively in Claude Code. A skill's SKILL.md says "invoke Skill: X" → Claude uses the Skill tool → next skill loads and runs. No orchestrator, no infrastructure, no Agent SDK. Proven with 3 minimal test skills (A→B→C) that chain without human intervention.

## Four Invocation Modes

Every svc skill supports the same inputs/outputs. The mode determines who drives the sequence.

| Mode | Driver | Mechanism | Control flow |
|------|--------|-----------|-------------|
| **Standalone** | User | `/write-spec` | Human decides what's next |
| **Progressive** | Skills | `--progressive` flag propagates | LLM chains skills, each checks preconditions |
| **Orchestrated** | Claude session | Agent tool + skills in standalone mode | LLM orchestrates with agent isolation |
| **Programmatic** | External program | Python/TS via `claude -p` OR Agent SDK | Deterministic code, feature toggle for transport |

### Standalone
User invokes a skill directly. Skill runs, reports results, stops. Also used by orchestrator (mode 3) to invoke skills between decision steps.

### Progressive
User invokes with a flag: `/write-vision --progressive`. Skill runs, succeeds, invokes next skill with same flag. Next skill checks its preconditions (do my inputs exist on disk?), runs, passes torch. Chain continues until pipeline completes or a skill fails.

Each skill independently:
1. Checks preconditions (required inputs exist?)
2. Does its work
3. Checks success
4. If `--progressive` + success → invoke next skill with `--progressive`
5. If `--progressive` + failure → stop, report to user
6. If no flag → stop, report results

### Orchestrated
A Claude session runs an orchestrator skill/agent that invokes other skills in standalone mode. The orchestrator reads each skill's output, makes decisions (retry? skip? branch?), and invokes the next. Skills don't know they're being orchestrated.

### Programmatic
A real Python/TypeScript program orchestrates the pipeline externally. Feature toggle swaps transport:

```python
transport = "cli"  # or "api"

if transport == "cli":
    result = subprocess.run(["claude", "-p", prompt])  # Max subscription
elif transport == "api":
    result = agent_sdk.query(prompt)  # API billing
```

Same orchestration logic either way. Real `if/else`, real `try/catch`, real state management. Most deterministic mode — control flow is code, not LLM instruction-following.

## Skill Interface Contract

Each skill declares inputs/outputs in its SKILL.md frontmatter:

```yaml
---
name: write-spec
inputs:
  required: [vision.md, personas/P*.md]
  optional: [ship-brief.md]
outputs:
  produces: [features/<name>.md]
  status: DRAFT
modes:
  standalone: true
  chain: true
---
```

The skill reads inputs from disk, produces outputs to disk. Who invoked it (user, chain, orchestrator, program) is irrelevant to the skill's logic.

## Key Design Principles

1. **Skills stay small and focused.** Don't merge skills into larger units. Each skill has standalone value (audit journeys, sync specs, write UX design).

2. **Skills are the same in all modes.** The skill logic doesn't change based on invocation mode. Only the "what happens after" changes.

3. **Progressive flag is self-propagating.** No central state, no pipeline manager. Each skill decides independently whether to continue.

4. **Re-read from disk at each step.** In progressive mode, context accumulates. Each skill should re-read key inputs from disk (fresh attention) rather than relying on prior context. This is the doctrine's checkpoint-as-attention-reset.

5. **Orchestrator is separate from skills.** Whether it's a Claude session (mode 3) or a Python program (mode 4), the orchestrator uses skills in standalone mode. Skills don't know about orchestration.

6. **`claude -p` bridges Max subscription to programmatic use.** No API key needed. Same subprocess pattern gstack uses for evals. Not the Agent SDK but functionally equivalent for sequential orchestration.

## What Serious Vibe Coding Gets Right (That Others Don't)

The four-mode architecture supports both greenfield and managed projects:
- **Greenfield:** `/write-vision --progressive` chains the full pipeline from zero
- **Managed project:** `/write-journeys` standalone audits current journey state
- **CI/CD integration:** Programmatic mode (mode 4) runs the pipeline in automation
- **Complex workflows:** Orchestrated mode (mode 3) handles conditional logic between skills

Other frameworks are single-mode:
- gstack's `/autoplan` is mode 3 only (orchestrator reads skill files as text — flawed)
- obra's brainstorming hardcodes chain to writing-plans (mode 2 only, no standalone)
- Raw has no skills at all

## Implementation Status

- [x] Skill chaining proven (chain-test-a/b/c)
- [ ] `--progressive` flag not yet implemented in svc skills
- [ ] Input/output contracts not yet in SKILL.md frontmatter
- [ ] Programmatic orchestrator (mode 4) not yet built
- [ ] Test skills (chain-test-*) at ~/.claude/skills/ — can be removed after findings are recorded
