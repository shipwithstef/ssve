# Distribution and Integration

## Mechanism

### Multi-Host Support
The skill runs on 5+ agent hosts:
- **Claude Code**: `.claude-plugin/plugin.json` + `marketplace.json` for marketplace distribution. SKILL.md at `skills/last30days-v3/SKILL.md` with bash setup block that resolves skill root across multiple install locations.
- **Gemini CLI**: `gemini-extension.json` with settings schema for API key configuration
- **OpenClaw**: `clawhub install last30days-official`, variants in `variants/open/SKILL.md`
- **Codex**: Codex auth (`~/.codex/auth.json`) for OpenAI Responses API via SSE streaming
- **Raw CLI**: `python3 scripts/last30days.py`

### SKILL.md Contract
The v3 SKILL.md (`skills/last30days-v3/SKILL.md`) is the runtime spec:
- Bash setup block resolves SKILL_ROOT from 7 possible locations
- Python version detection (3.12+ required)
- Default command: `$PYTHON $SKILL_ROOT/scripts/last30days.py $ARGUMENTS --emit=compact`
- Detailed synthesis guidance: source weighting, citation rules, comparison/recommendation templates, edge case handling, Polymarket interpretation
- Security disclosure: what the skill does and doesn't do

### Embedding in Other Skills
Four integration modes:
1. Inline context injection: `!python3 ... --emit=context` in skill markdown
2. File read: `cat ~/.local/share/last30days/out/last30days.context.md`
3. Path output: `--emit=path` returns output file path
4. JSON: `--emit=json` for programmatic consumption

### Hooks
SessionStart hook runs `hooks/scripts/check-config.sh` to validate environment on plugin load.

### Sync Script
`scripts/sync.sh` deploys skill files to:
- `~/.claude/skills/last30days/`
- `~/.agents/skills/last30days/`
- `~/.codex/skills/last30days/`

## Analysis

The multi-host approach is well-engineered — a single Python engine with host-specific shell wrappers. The SKILL.md serves as both documentation AND runtime configuration, which is the emerging pattern in the agent skill ecosystem.

The synthesis guidance in SKILL.md is notably detailed — it's essentially a prompt engineering contract that tells the host agent exactly how to present results. This is a differentiator vs. skills that just return raw data.

## L4 Pointers
- `skills/last30days-v3/SKILL.md`: runtime spec with synthesis guidance
- `.claude-plugin/plugin.json` + `marketplace.json`: Claude Code marketplace
- `gemini-extension.json`: Gemini CLI extension
- `SPEC.md`: architecture spec with embedding examples
- `hooks/hooks.json`: SessionStart hook
- `scripts/sync.sh`: multi-host deployment
