# Harness Team Examples — Detail

## Mechanism

5 concrete examples showing how agent teams are structured for different domains.
Each includes: architecture pattern, execution mode, agent composition, workflow,
communication patterns, and error handling.

### Example 1: Research Team (Fan-out/Fan-in, Agent Team)

4 researchers (official, media, community, background) work in parallel.
Each writes to `_workspace/`. Members share discoveries via SendMessage
(e.g., media shares investment news with background researcher). Leader
collects all 4 outputs, integrates into comprehensive report.

**Key pattern:** team members cross-pollinate during research. One agent's
discovery redirects another's investigation in real-time. This is impossible
with subagent mode (fire-and-forget).

### Example 2: SF Novel Writing (Pipeline + Fan-out, Agent Team)

Phase 1 (parallel team): worldbuilder + character-designer + plot-architect
collaborate via SendMessage to maintain consistency. Phase 2 (solo subagent):
prose-stylist writes from the 3 outputs. Phase 3 (new parallel team):
science-consultant + continuity-manager review, sharing findings. Phase 4:
prose-stylist applies review feedback.

**Key pattern:** team dissolution + reformation between phases. Session limit
is 1 active team, but teams can be dissolved and new ones created. Previous
team's artifacts persist in `_workspace/`.

**Full agent definition provided:** worldbuilder.md with all required sections
(role, principles, I/O protocol, team communication, error handling,
collaboration). Shows how agent files look in practice.

### Example 3: Webtoon Production (Producer-Reviewer, Subagent)

Artist generates panels → reviewer inspects with PASS/FIX/REDO → artist
regenerates REDO panels (max 2 loops). Only 2 agents, no inter-agent
communication needed → subagent mode is appropriate.

**Key pattern:** bounded retry loop. After 2 REDOs, force-PASS with warning.
If >50% panels are REDO, suggest prompt revision to user.

**Full agent definition provided:** webtoon-reviewer.md with 3-tier judgment
(PASS/FIX/REDO), objective criteria (consistency, readability, composition),
and error handling for image load failures.

### Example 4: Code Review (Fan-out + Discussion, Agent Team)

3 reviewers (security, performance, test coverage) work in parallel.
The key differentiator: reviewers talk to EACH OTHER directly, not through
the leader. Security asks performance about a SQL query. Performance asks
test reviewer about coverage. Test asks security about priority.

**Key pattern:** direct inter-reviewer communication without leader relay.
This catches cross-domain issues that individual reviews miss.

### Example 5: Code Migration (Supervisor, Agent Team)

Supervisor analyzes file list, estimates complexity, creates task batches via
TaskCreate. 3 migrators claim tasks from shared task list. When a migrator
finishes, they automatically get the next unclaimed task. If a migrator fails,
supervisor reassigns to another.

**Key pattern:** dynamic task assignment at runtime (vs fan-out's static
pre-assignment). Shared task list with self-service claiming. Supervisor
monitors but doesn't relay every message.

### Output Patterns Summary

- Agent definition: `.claude/agents/{name}.md` — role, principles, I/O, errors, collaboration + team communication protocol
- Skill: `.claude/skills/{name}/SKILL.md` — at project or global level
- Orchestrator: one skill that wires the team together, with execution mode explicit

## Analysis

- **Useful for:** Understanding how to structure agent teams for different task types. The examples are concrete enough to adapt.
- **Trade-offs:** Agent teams are 3-7x more expensive than solo execution (each member = full Claude instance). The cross-pollination benefit must justify the cost.
- **Similar to:** svc's `execute-changeset` dispatches subagents for parallel tasks but without inter-agent communication. The research team example is what our execute-changeset COULD be if we adopted team mode — task-3 agent sharing a discovery with task-5 agent.
- **Could improve svc by:** Three specific patterns worth taking: (1) Research team fan-out with cross-pollination — our `analyze-domain` + `analyze-competitors` could share findings in real-time if run as a team instead of sequentially. (2) Producer-reviewer bounded retry — our `execute-changeset` 3-attempt limit is similar but doesn't have the PASS/FIX/REDO granularity. (3) Code review direct inter-reviewer communication — our `review-gate` uses a single cross-reviewer, but 3 specialized reviewers talking to each other would catch more cross-domain issues.
- **Assumptions:** Claude Code's Agent Teams API (TeamCreate, SendMessage, TaskCreate) is available. One team per session limit. Opus model for all agents.
- **Watch out for:** Team dissolution between phases loses conversational context. The file-based handoff (`_workspace/`) is the bridge but it's lossy. The SF novel example shows this working across 4 phases — but each phase transition is a hard context boundary.

## Key Source Files (L4)
- `skills/harness/references/team-examples.md:1-328` — all 5 examples with full agent definitions
