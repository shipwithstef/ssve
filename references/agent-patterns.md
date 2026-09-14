# Agent Patterns

Reference for how svc dispatches work across multiple agents. Consulted by
`execute-changeset`, `plan-changeset`, and `improve-framework` when deciding
how to split and coordinate parallel work.

Source: adapted from [Harness](https://github.com/revfactory/harness) agent
team architecture patterns.

## Execution Modes

### Subagent Mode (svc default)

Main agent spawns background agents via Agent tool. Each returns results to
main only. No inter-agent communication.

```
[orchestrator] → Agent(task-1, background) → result
               → Agent(task-2, background) → result
               → Agent(task-3, background) → result
               → integrate results
```

**Use when:** tasks are independent, no cross-task discovery needed.
This is what `execute-changeset` does today.

### Team Mode (when available)

Leader creates a team. Members communicate via SendMessage and coordinate via
shared TaskCreate/TaskUpdate. Members can share discoveries in real-time.

```
[leader] ←→ [member-A] ←→ [member-B]
   ↕              ↕              ↕
   └────── shared task list ──────┘
```

**Use when:** tasks benefit from cross-pollination during execution.
Requires Claude Code's Agent Teams API (TeamCreate, SendMessage).

### Decision Tree

```
2+ agents needed?
├── Yes → Do they need to communicate during work?
│         ├── Yes → Team mode (if API available, else subagent with file-based handoff)
│         └── No  → Subagent mode
└── No  → Single agent (no dispatch needed)
```

## 6 Architecture Patterns

Choose the pattern that matches the work structure:

| Pattern | Shape | When to use | svc application |
|---|---|---|---|
| **Pipeline** | `[A] → [B] → [C]` | Sequential dependency — each step needs previous output | Progressive narrowing phases (analyze-domain → analyze-competitors → build-personas) |
| **Fan-out/Fan-in** | `[split] → [A] \| [B] \| [C] → [merge]` | Parallel independent work on same input | execute-changeset parallel task groups |
| **Expert Pool** | `[router] → {A \| B \| C}` | Conditional — pick the right specialist | route-workflow selecting the right skill |
| **Producer-Reviewer** | `[create] → [review] → (retry)` | Quality loop with bounded retries | execute-changeset + review-gate |
| **Supervisor** | `[boss] → [workers]` | Dynamic task assignment at runtime | Not yet used — candidate for large task graphs |
| **Hierarchical Delegation** | `[top] → [mid] → [low]` | Recursive decomposition of complex work | Not yet used — candidate for nested feature trees |

### Team Size Guidelines (for team mode)

| Scale | Members | Tasks per member |
|---|---|---|
| Small (5-10 tasks) | 2-3 | 3-5 |
| Medium (10-20) | 3-5 | 4-6 |
| Large (20+) | 5-7 | 4-5 |

3 focused members > 5 scattered members.

## Agent Definition Convention

When dispatching agents with distinct roles, define them as files rather than
inline prompts. This makes them reusable, auditable, and consistent.

### Agent Definition File

Location: `.claude/agents/{name}.md` (project-level) or referenced in skill instructions.

Required sections:
1. **Core role** — what this agent does (one sentence)
2. **Working principles** — how it approaches work
3. **Input/output protocol** — what it reads, what it produces, where
4. **Error handling** — what to do when things fail
5. **Collaboration** — how it interacts with other agents (if team mode: communication protocol)

### WHO vs HOW

- **Agent definition** = WHO (role, principles, communication)
- **Skill instructions** = HOW (step-by-step procedure)

An agent uses one or more skills. A skill can be shared across agents.
Separate them — don't put role definitions inside skill instructions.

### When to Use Agent Files vs Inline Prompts

| Situation | Approach |
|---|---|
| Subagent for one-off task | Inline prompt is fine |
| Subagent with a reusable role (QA, reviewer, researcher) | Agent definition file |
| Team member | Agent definition file (required for communication protocol) |
| Same role dispatched across multiple features | Agent definition file |

## Data Passing Between Agents

| Strategy | Mechanism | When |
|---|---|---|
| File-based | Write/read at agreed `_workspace/` paths | Default — works in all modes, audit trail |
| Message-based | SendMessage (team mode only) | Real-time coordination, lightweight |
| Task-based | TaskCreate/TaskUpdate (team mode only) | Progress tracking, dependency management |

**File naming:** `{phase}_{agent}_{artifact}.{ext}`
**Intermediate artifacts:** preserved in `_workspace/` for audit — never auto-deleted.
