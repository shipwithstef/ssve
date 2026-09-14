# ECC Continuous Learning — Detail

Source: `skills/continuous-learning-v2/`, `skills/continuous-learning/`, `the-longform-guide.md`

## v1 (Legacy — Stop Hook Pattern)

- Stop hook fires at session end, extracts patterns from session transcript
- Creates SKILL.md files from learned patterns
- Stored in `~/.claude/skills/` as individual skill files
- Simple: one-shot extraction, no confidence scoring, no project scoping
- Keep v1 only when explicitly wanting the legacy Stop-hook skill-extraction flow

## v2.1 Current — Instinct-Based Architecture

### Core Concepts

**Instinct**: atomic learned behavior with confidence score. Smaller unit than a skill — captures a single pattern, workaround, or convention.

**Project scoping** (v2.1+): instincts stored under `projects/<hash>/` instead of global `~/.claude/homunculus/`. React patterns stay in React project; Python conventions stay in Python project. Universal patterns (e.g., "always validate input") can be global.

### Storage Layout

```
~/.claude/homunculus/
  projects/<project-hash>/   # project-scoped instincts
    instincts.json
    pending/                 # unconfirmed, awaiting confidence threshold
  global/                    # cross-project instincts
    instincts.json
```

### Hook Architecture

- `pre:observe:continuous-learning` (PreToolUse, async, 10s) — captures tool input before execution
- `post:observe:continuous-learning` (PostToolUse, async, 10s) — captures tool result after execution
- Observer runs via `skills/continuous-learning-v2/hooks/observe.sh`
- Observer lifecycle: SessionStart writes project-scoped lease; SessionEnd removes lease and stops observer when last lease disappears; observer-loop.sh exits on idle when no leases remain
- 5-layer guard prevents observer re-entrancy loops

### Commands

| Command | Effect |
|---------|--------|
| `/instinct-status` | Show learned instincts with confidence scores |
| `/instinct-import <file>` | Import instincts from shared file |
| `/instinct-export` | Export instincts for sharing with team |
| `/evolve` | Cluster related instincts into full skills/commands/agents |
| `/prune` | Delete expired pending instincts |
| `/learn` | Extract patterns mid-session (legacy v1 pattern) |
| `/learn-eval` | Extract, evaluate, and save patterns with confidence scoring |

### Promotion Flow

1. Observe hook captures tool use → raw observation
2. Pattern matching scores observation → pending instinct (low confidence)
3. Repeated pattern confirmation → instinct graduates to active
4. `/evolve` clusters related instincts → SKILL.md generated
5. User reviews and saves generated skill
6. Project-scope instinct can be promoted to global scope manually

### Configuration

`skills/continuous-learning-v2/config.json` — thresholds, scope settings, observer behavior

## Memory Persistence (Related Pattern from Longform Guide)

Stop hook pattern for cross-session context:
```bash
# Session start: load previous context
cat ~/.claude/sessions/current.md

# Session end: save state summary
# Stop hook writes to ~/.claude/sessions/session-YYYYMMDD.md
```

Session files should contain:
- What approaches worked (verifiably with evidence)  
- Which approaches were attempted but did not work
- What has not been attempted and what's left to do

## Why Stop Hook (Not UserPromptSubmit)

UserPromptSubmit fires on every message — adds latency to every prompt. Stop fires once at session end — lightweight, doesn't slow session. For pattern extraction, session-end timing is correct because full context is available.
