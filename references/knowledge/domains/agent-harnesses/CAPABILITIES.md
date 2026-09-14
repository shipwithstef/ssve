# Agent Harnesses

Layer 2 knowledge extraction of primary agentic runtime harnesses.

## Primary Surfaces
- **Claude Code (CLI):** Implements dynamic MCP polling, inline shell integrations with immediate subagent orchestration capability. Extracted in full.
- **Codex (CLI):** Integrates directly with pseudo-TTY hooks and focuses strictly on native developer tool execution. Extracted in full.
- **Antigravity (Framework):** Artifact-driven semantic UI framework. Extracted in full.
- **Gemini CLI:** Tiered instruction hierarchy and policy-governed engineering runtime. Extracted in full.

## Enforcement Boundaries
- **Claude Code** manages context automatically via `.claude-plugin`, exposing high token risk during "Idle MCP bloat".
- **Codex** tightly scopes context via strict file inclusions. PTY injection blocks infinite loops effectively.
- **Antigravity** dictates behavior via rigid artifact configurations (`ANTIGRAVITY.md` and UI cues) rather than raw Bash PTY hooks.
- **Gemini CLI** uses a mandatory policy engine (`.toml`) to block or confirm destructive tool usage before execution.

## Billing Boundaries (corrected 2026-07-15)
- **Claude Code:** Anthropic paused the announced separate Agent SDK credit change. For now `claude -p` / Agent SDK usage continues to draw from Claude subscription usage limits, and no separate monthly Agent SDK credit is available. Treat this as volatile and re-check the official support article before using billing as a routing constraint. See `details/anthropic-agent-sdk-credit-2026-06-15.md`.

## External review automation (verified with Codex CLI 0.144.4 and Claude Code 2.1.211)
- **Codex:** use `codex exec`, not `codex -p`; in this CLI `-p` means profile. Prefer review packages on stdin, explicit model/effort, read-only sandbox, ephemeral/no-user-config/no-rules isolation that preserves `CODEX_HOME` auth, strict config, schema-constrained output, JSONL events, and a separate final-message artifact.
- **Claude:** use `claude -p` with explicit full model and effort, safe mode, disabled tools/MCP, plan permission mode, no session persistence, schema-constrained JSON, and turn/time/budget ceilings. `--bare` disables OAuth/keychain reads and therefore is not a universal default for subscription-authenticated automation.
- **Shared rule:** one paid review invocation doubles as the availability probe. Only classified model unavailable/model-entitlement/provider-overload results may activate a policy-authorized fallback; auth, shared subscription-quota exhaustion, network, timeout, and schema failures do not. Hash package + tuple + schema + launcher version; only a valid no-fallback receipt whose effective tuple equals the requested primary tuple is reusable for that primary request.
- **Structured-output turn semantics (2026-07-16):** Claude `max_turns` bounds agentic tool-use round trips, not paid provider invocations. Structured output uses a schema tool and can re-prompt on validation mismatch. A launcher may therefore allow the minimum bounded protocol turns needed for `structured_output` while separately enforcing one paid primary invocation. `error_max_turns` after schema tool use is a schema-turn-budget failure, never a model-availability fallback trigger.
- **Fable safeguard route (2026-07-16):** Claude Code enables Anthropic-managed automatic switching by default for Fable. A flagged request can be re-run on Opus 4.8 in the same conversation. This provider-managed route is distinct from CLI `--fallback-model` and from a launcher-created second invocation. Receipts must record it separately, suppress any second Opus launch, and prevent the Opus result from satisfying a later Fable-primary cache lookup.
- **Owner profile policy:** the framework's Codex-orchestrated reviewer profile is `fable-high` through 2026-07-19 and `opus-high` from 2026-07-20 00:00 Europe/Sofia. This is an owner policy, not a claim about Fable billing or entitlement after that date. A receipted explicit profile switch can re-enable `fable-high` without code edits.

## Dynamic Workflows (Claude Code, research preview since 2026-05-28)
- **What:** Claude writes a plain-JS orchestration script per task; a background runtime executes it — the script (not turn-by-turn judgment) holds loop/branching/intermediate state; Claude's context gets only the final answer. Dozens-to-hundreds of subagents per run (Cherny: "1-2 OOMs more agents" than agent teams, phased semi-structured execution).
- **Gating:** v2.1.154+, all paid plans (Pro opt-in via `/config`; Max/Team/API default-on; Enterprise default-off), API/Bedrock/Vertex/Foundry. Strict explicit opt-in: `ultracode` keyword (was `workflow` pre-v2.1.160), `/effort ultracode` (xhigh + auto-orchestration), own-words ask, skill instruction, or saved/bundled command (`/deep-research`).
- **Runtime API:** `agent()` (schema→validated StructuredOutput, model override, `isolation:'worktree'`, agentType), `pipeline()` (DEFAULT, no barrier), `parallel()` (barrier), `phase()`/`log()`, `args`, `budget` (`+500k`-style HARD ceiling — `agent()` throws past it), nested `workflow()` (1 level). Caps: min(16, cores−2) concurrent, 1,000 agents/run. Plain JS only; `Date.now()`/`Math.random()` throw (deterministic resume); resume = cached longest-unchanged-prefix via `runId`, same-session only.
- **Patterns:** fan-out-and-synthesize, adversarial verify (majority-refute kill), perspective-diverse verify, tournament/judge panel, loop-until-dry, multi-modal sweep, completeness critic, quarantine (untrusted-content privilege separation), no-silent-caps. Save via `/workflows`→`s` to `.claude/workflows/` (project) or `~/.claude/workflows/`; distributable inside skills as templates.
- **Proof points:** Bun Zig→Rust port (~750K lines, 99.8% tests, 11 days, 2 reviewers/file, not yet production); isitchristmas rebuild (484 agents, 16M tokens, $85 — review wave caught a bug a 148K-case test suite missed). Dominant critique: token burn ("tokenmaxxing"). See `details/claude-code-dynamic-workflows.md`.

See `details/*.md` for specific Layer 3 vulnerabilities and limits for each harness.
