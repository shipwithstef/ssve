# ECC Token Optimization & Parallelization — Detail

Source: `the-longform-guide.md`, `the-shortform-guide.md`, `skills/context-budget/`, `contexts/`

## Model Routing Strategy

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Exploration/search/finding files | Haiku | Fast, cheap, sufficient |
| Simple edits (single file, clear instructions) | Haiku | Mechanical |
| Multi-file implementation | Sonnet | Best balance for coding |
| Complex architecture, first attempt failed | Opus | Deep reasoning needed |
| PR reviews | Sonnet | Understands context, catches nuance |
| Security analysis | Opus | Can't afford to miss vulnerabilities |
| Writing docs | Haiku | Structure is simple |
| Debugging complex bugs (system-wide) | Opus | Needs entire system in mind |

Default: Sonnet for 90% of coding tasks. Escalate to Opus when: first attempt failed, task spans 5+ files, architectural decisions, or security-critical code.

## Context Window Management

### Dynamic System Prompt Injection (from CLI)

```bash
# Context loads dynamically, not always in CLAUDE.md
claude --system-prompt "$(cat memory.md)"
claude --system-prompt "$(cat ~/.claude/contexts/dev.md)"

# Aliases for different modes
alias claude-dev='claude --system-prompt "$(cat ~/.claude/contexts/dev.md)"'
alias claude-review='claude --system-prompt "$(cat ~/.claude/contexts/review.md)"'
alias claude-research='claude --system-prompt "$(cat ~/.claude/contexts/research.md)"'
```

System prompt content has higher authority than user messages, which have higher authority than tool results.

### Dynamic Contexts

ECC provides pre-built context files:
- `contexts/dev.md` — development mode context
- `contexts/review.md` — code review mode context  
- `contexts/research.md` — research/exploration mode context

### CLI-over-MCP Pattern

Replace always-on MCPs with CLI-based skills to save context:
- Instead of GitHub MCP: create `/gh-pr` command wrapping `gh pr create`
- Instead of Supabase MCP: skills using Supabase CLI directly
- Context savings: MCP tool schemas eat context window even when unused

### Strategic Compaction

- Disable auto-compact; compact manually at logical intervals
- `pre:edit-write:suggest-compact` hook suggests compaction points
- `skills/strategic-compact/` — manual compaction guidance
- Pattern: after plan is set and exploration context is no longer needed, compact and work from plan

### `context-budget` Skill

Tracks context usage, provides read-depth rules, advises when to compact. Located at `skills/context-budget/`.

## Tool Efficiency

### mgrep (Recommended Replacement for grep)

~50% token reduction vs traditional grep/ripgrep. In 50-task benchmark, mgrep + Claude Code used ~2x fewer tokens at similar/better quality. By @mixedbread-ai.

### Modular Codebase Benefits

Files in hundreds of lines (not thousands) = better first-pass success + lower token cost per task.

## Verification Patterns

### pass@k vs pass^k

```
pass@k: At least ONE of k attempts succeeds
        k=1: 70%  k=3: 91%  k=5: 97%
        Use when: you need it to work once

pass^k: ALL k attempts must succeed  
        k=1: 70%  k=3: 34%  k=5: 17%
        Use when: consistency is essential (security, migrations)
```

### Eval Types

- **Checkpoint-Based**: set explicit checkpoints, verify against defined criteria, fix before proceeding
- **Continuous**: run every N minutes or after major changes, full test suite + lint
- **Benchmarking**: fork conversation, run with/without skill, diff results

## Parallelization

### Git Worktrees

Fork conversation → initiate new worktree in one → minimal scope overlap → diff at end. Well-defined scope per fork is critical.

### Multi-Claude Terminal Setup

Multiple Claude instances, each with scoped responsibilities. Avoid overlapping file changes.

### PM2 / Multi-Agent Commands (ECC)

For complex multi-service workflows:
```bash
/pm2              # PM2 service lifecycle management
/multi-plan       # Decompose task across multiple agents
/multi-execute    # Orchestrated multi-agent execution
/multi-backend    # Backend multi-service orchestration
/multi-frontend   # Frontend multi-service orchestration
/multi-workflow   # General multi-service workflows
```

Requires `npx ccg-workflow` runtime for external dependencies (`~/.claude/bin/codeagent-wrapper`, `~/.claude/.ccg/prompts/*`).

### Cascade Method

Sequence agents in cascade: planner → implementer → reviewer → verifier. Each stage receives output of previous. Cleaner than parallel when dependencies exist.

### Iterative Retrieval Pattern

`skills/iterative-retrieval/` — progressive context refinement for subagents. Fetch minimal context first, expand only when needed. Prevents context explosion in exploration phases.
