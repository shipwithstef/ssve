# svc agents/

First-class **agent** primitive for the svc framework. Agents are small, purpose-built role definitions invoked as locked-down sub-sessions — distinct from skills, which are procedural contracts for orchestrator-level work.

## Agent vs skill

| Aspect | Skill | Agent |
|---|---|---|
| Scope | A multi-step procedure with inputs, outputs, self-verify gates | A single locked-down role in a single call |
| Invoked by | `Skill` tool (orchestrator) | `claude -p --agent <name>` or `opencode run --agent <name>` (subprocess) |
| State | Reads/writes project artifacts (specs, work items, lane-tasks) | Stateless — input in, structured output out, done |
| Tools | Usually has full tool access | Usually `tools: []` (zero tools, pure pass-through) |
| Context bloat | Expected — does real work | Minimized — fresh session, often `--bare` |
| Use when | Work crosses multiple files or decisions | Work is a single mechanical transform over one input |

Skills are the procedural layer. Agents are the smallest-unit cognitive layer underneath. A skill may invoke several agents.

## Agent definition format

Each agent is one markdown file with frontmatter + system-prompt body:

```markdown
---
name: <agent-name>
description: <one-line description, shown in routing tables>
model: <model identifier — default is a cheap pass-through model>
tools: []                       # empty = zero tool access
harness: any | claude | opencode | openclaw
---

<strict system prompt body — describes the agent's role, what it must do,
what it must NOT do, and the exact output shape it should return>
```

- **`name`** must match the filename (`summary-extractor.md` → `name: summary-extractor`).
- **`tools: []`** is the recommended default for pass-through agents. Any tool access must be explicitly justified in a comment.
- **`harness`** indicates which CLI the agent is tested against. `any` means it works trans-harness (both `claude -p --agent X` and `opencode run --agent X` with the same definition).

## Invocation patterns

### Direct CLI call (embedded JSON)

```bash
# Extract the frontmatter+body once, pass as inline JSON.
# This is what scripts/haiku-extract.sh does — self-contained, no file dependency.
claude -p --bare --tools "" --agents "$AGENT_JSON" --agent summary-extractor < input.log
```

### Direct CLI call (file reference)

```bash
# When the target host has the svc framework installed at a known path.
claude -p --bare --tools "" --agent summary-extractor --agents-dir /path/to/svc/agents/
```

### From inside a skill

A skill that needs a locked pass-through call invokes the appropriate script:

```bash
# In a skill body, when you want to extract a summary block from a worker log.
scripts/extract-summary.sh /tmp/worker.log || scripts/haiku-extract.sh /tmp/worker.log
```

## Current roster

| Agent | Role | Cognitive label |
|---|---|---|
| [`summary-extractor`](./summary-extractor.md) | Locked pass-through: extract SVC_WORKER_SUMMARY block from a worker log, or emit a fail-shaped block. Zero tools. | `[PASS-HAIKU]` |
| [`plan-reviewer`](./plan-reviewer.md) | Adversarial reviewer for plan-changeset manifests. Structured YAML findings with provable analysis. | `[REVIEW]` |
| [`strategic-reviewer`](./strategic-reviewer.md) | Adversarial reviewer for strategic-decision artifacts (ADR-level). Process-fidelity audit + output adversarial attack. | `[REVIEW]` |

## Execution Policy (applies to ALL agents)

### Closed input manifest

Agents operate on a **closed input manifest** passed by the parent skill at invocation.
Agents MUST NOT:

- Browse files outside the manifest
- Explore the codebase to "be thorough"
- Extend their input set after invocation

The parent skill is responsible for resolving which files are relevant and passing them
explicitly. If an agent needs a file not in the manifest, it emits a scoping-violation
finding — it does not fetch the file.

### Closed tool allowlist

Every agent MUST declare an explicit `tools:` allowlist in frontmatter. Defaults:

**Permitted by default:**
- `Read` — bounded file access within the input manifest
- `Grep` — pattern matching within the input manifest

**Denied by default (require explicit allowlist + documented justification):**

| Tool | Why denied |
|---|---|
| `Skill` (other skills) | Breaks eval contract; skill composition explodes eval space |
| `Agent` (other agents) | Recursion breaks observability; parent orchestrator handles fan-out |
| `WebSearch` / `WebFetch` | Non-deterministic external access; research belongs at parent level |
| `Bash` | Arbitrary command execution; excessive attack surface |
| `Edit` / `Write` | Agents return structured data; parent writes artifacts |
| `TaskCreate` / `TaskUpdate` / `TaskList` | Task state is orchestrator-only; subagents MUST NOT attempt these |
| MCP server plugins | External attack surface; declare per-agent if needed |

If an agent genuinely needs a denied tool, frontmatter declares it + documents why. This
is a reviewable decision, not an implicit permission.

### Enforcement tiers (hosts enforce what they can)

| Host | Closed Input | Closed Tool | Mechanism |
|---|---|---|---|
| Claude Code | ✅ Hard | ✅ Hard | `Agent` tool spawns fresh context with explicit tool allowlist in agent config |
| Kimi CLI | ✅ Hard | ✅ Hard | `dispatch-worker.sh` spawns subprocess; agent YAML tool list runtime-enforced |
| Codex CLI | ⚠️ Soft | ⚠️ Soft | No subagent primitive — inline system-prompt load; prompt discipline + eval regression catches drift |
| Gemini CLI | ⚠️ Soft | ⚠️ Soft | Same as Codex — inline load, prompt-level enforcement |

On soft-enforcement hosts, the agent file's system-prompt-append block should include an
explicit "Tool scoping (MANDATORY)" directive telling the model to emit a scoping-violation
finding rather than attempt an out-of-list tool call. Modern models (Sonnet 4.6, Haiku 4.5,
Gemini 2.5, o3) follow this reliably for narrow tasks; tier-2 evals catch regressions.

For security-critical agents (deploy, mutating production state), explicitly restrict to
hard-enforcement hosts only. For review-class agents (plan-reviewer, strategic-reviewer),
soft tier is acceptable because output is advisory.

### System prompt pattern: APPEND, never REPLACE

All svc agents use the `systemPrompt: { type: "preset", preset: "claude_code", append: <agent-file-contents> }` pattern per Anthropic Agent SDK docs. Never ground-up replacement — that forfeits tool-use instructions, built-in safety, environment context, and formatting defaults (per https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts).

Agent files in this directory contain ONLY the APPEND text (specialized role + constraints
+ output schema), NOT a full system prompt.

More agents will be added as skills identify other locked pass-through roles. Every new
agent must conform to this execution policy.

## Design principles

1. **Zero tools by default.** If an agent needs tools, the skill that invokes it should probably be the one doing that work, not the agent.
2. **Output shape is part of the contract.** Every agent defines exactly what its output looks like. Orchestrators parse deterministically.
3. **Fail shape is non-negotiable.** Every agent must emit a defined "fail" output when the input is malformed — silent failure deadlocks orchestrators.
4. **Trans-harness compatibility.** Agent definitions should work against any model/CLI combination. Don't bake in model-specific prompt tricks unless absolutely necessary.
5. **No exploration.** The agent role, by construction, is a mechanical transform. If exploration is needed, route to a skill, not an agent.

## Cognitive routing

See `references/model-routing.md` for the cognitive label taxonomy. Agent files carry the `[PASS-HAIKU]` label by default — the cheapest/fastest tier in the 7-label routing matrix.
