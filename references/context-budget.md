# Context Budget Rules

Context is the scarcest resource in agentic execution. Every token loaded is
a token of attention that cannot go toward generation quality. These rules
prevent the slow, silent death of context degradation.

Source: adapted from GSD references/context-budget.md (MIT, Copyright 2025 TACHES).

## Context Degradation Tiers

| Tier | Window Used | Behavior | Action |
|------|-------------|----------|--------|
| **PEAK** | 0-30% | Full attention, accurate recall, precise generation | Normal operation. Read what you need. |
| **GOOD** | 30-50% | Slightly reduced recall of early context, still reliable | Be selective about new reads. Summarize before loading more. |
| **DEGRADING** | 50-70% | Noticeable quality loss. Early context fades. Spec adherence drifts. | Stop loading new files. Checkpoint and hand off if possible. Restate critical constraints before generating. |
| **POOR** | 70%+ | Silent partial completion, hallucinated details, skipped steps. The agent does not know it is degrading. | **Checkpoint immediately.** Spawn a fresh session or subagent. Do NOT continue generating — output is unreliable. |

The danger of POOR is that the agent has no self-awareness of degradation.
It continues confidently producing increasingly wrong output. External
checkpoints are the only defense.

## Read Depth Rules by Model

### 200K Context Models (Sonnet, Haiku)

| Operation | Budget |
|-----------|--------|
| Subagent task (single file change) | 15-25K tokens of context |
| Subagent task (multi-file change) | 25-40K tokens of context |
| Review pass | 30-50K tokens of context |
| Full orchestration session | Stay under 120K (60%) |

### 1M Context Models (Opus)

| Operation | Budget |
|-----------|--------|
| Orchestrator session (coordinating 5-10 tasks) | Stay under 300K (30%) |
| Complex review (full diff + spec + journeys) | 100-200K tokens |
| Planning session | 150-300K tokens |
| **Hard ceiling** | 500K (50%) — checkpoint beyond this |

More context does NOT mean load more. A 1M window means you have more
runway before degradation, not permission to load everything.

## Orchestrator vs Subagent Rules

### Rule: Orchestrator routes, subagents execute

The orchestrator reads specs, manifests, and task graphs to make routing
decisions. It does NOT load implementation files, test files, or full
source trees. That is the subagent's job.

**Never load subagent-scope content into the orchestrator.** If the
orchestrator needs to know whether a task succeeded, it reads the subagent's
summary output — not the files the subagent modified.

### Rule: Tell subagents to read from disk

When spawning a subagent, pass file paths, not file contents. A subagent
with a 200K window can read the files it needs with fresh attention. If you
inline 50K of context into the prompt, the subagent starts at 25% used with
stale positional encoding.

**Do this:**
```
Read the feature spec at docs/specs/features/feature-auth.md
Read the manifest at docs/plans/2026-04-01-auth/manifest.md
Implement task T3 from the manifest.
```

**Not this:**
```
Here is the feature spec:
[... 8000 tokens of spec content ...]
Here is the manifest:
[... 3000 tokens of manifest content ...]
Implement task T3.
```

Exception: When passing a small, targeted slice (under 500 tokens) — like a
single AC, a single type definition, or a constraint block — inlining is
acceptable and avoids a file read.

## Warning Signs of Context Degradation

Watch for these. They indicate the session is in DEGRADING or POOR tier:

1. **Silent partial completion.** The agent completes a task but omits 1-2
   requirements that were clearly stated in the spec. No error, no
   acknowledgment — they just vanish.

2. **Increasing vagueness.** Early outputs are specific ("add a 3-second
   debounce to the search input"). Late outputs become vague ("add
   appropriate debouncing").

3. **Skipped steps.** A 5-step process is completed in 3 steps. The agent
   does not mention the missing steps.

4. **Recycled patterns.** The agent starts copying patterns from files it
   read 50K tokens ago, even when those patterns don't apply to the current
   task.

5. **Contradicting earlier decisions.** The agent makes a choice that
   directly conflicts with a decision it made earlier in the same session.

6. **Spec drift.** Generated code diverges from spec requirements in ways
   that suggest the spec is no longer being attended to.

## Proactive Checkpoint Protocol

When context is heavy (entering DEGRADING tier):

1. **State what has been completed** — list completed tasks with one-line
   summaries.
2. **State what remains** — list remaining tasks.
3. **State any decisions made** — so the next session does not re-litigate.
4. **Commit the checkpoint** — ensure all completed work is on disk and
   committed.
5. **Hand off** — either spawn a fresh subagent for remaining work or
   inform the user that a new session is needed.

This protocol prevents the most expensive failure mode: an agent in POOR
tier that continues generating for 20 more minutes, producing work that
must be discarded.

## CLI-over-MCP: Reduce Idle MCP Overhead

When a session is **DEGRADING or POOR**, check which MCP servers are active.

An always-on MCP server injects its tools schema into every request, even when
the tool is not used that session. For a server with 15 tools at ~500 tokens
each, that's 7,500 tokens of idle overhead on every message.

**When to prefer CLI over MCP:**

| Situation | Use |
|---|---|
| Tool called frequently this session, structured output needed | MCP |
| Tool called once or twice this session | CLI via Bash |
| Session is DEGRADING or POOR | CLI via Bash (disable the MCP) |
| Auth setup is expensive (OAuth flows, API key injection) | MCP (amortizes setup cost) |
| One-shot task in a fresh session | CLI via Bash |

**Common CLI equivalents for popular MCPs:**

| MCP | CLI alternative |
|---|---|
| GitHub MCP | `gh` CLI |
| Supabase MCP | `supabase` CLI |
| Stripe MCP | `stripe` CLI |
| Vercel MCP | `vercel` CLI |
| File system MCP | Native Read/Write/Bash tools |

**DEGRADING tier action:** When entering DEGRADING context, audit active MCP
servers. Disable any MCP that has not been used in the last 5 tool calls.
Use the CLI equivalent for the remainder of the session.

Source: everything-claude-code SOUL.md CLI-over-MCP philosophy (MIT, Copyright 2026 Affaan M.).

## Cross-References

- `references/subagent-context-rules.md` — Rules for subagent prompt construction
- `references/anti-patterns.md` — Context-related anti-patterns
- `references/model-routing.md` — Model selection by task type (includes context-aware downgrade rule)
