# Anthropic Agent SDK Credit — announced June 15, 2026, now paused

**Status:** PAUSED / superseded by Anthropic's current support guidance, verified 2026-07-15.
**Announced:** 2026-05-14. **Originally scheduled:** 2026-06-15. **Current effect:** none.

## Current state

Anthropic paused the separate Agent SDK credit change. For now, Agent SDK usage—including `claude -p`—continues to draw from Claude subscription usage limits, and no separate monthly Agent SDK credit is available. This is the current load-bearing billing fact. Re-check the official support article before any future framework routing decision because Anthropic says it is evaluating a revised approach.

The sections below preserve the originally announced policy and the 2026-06-07 call-site audit as historical context. They are **not current billing behavior**.

## Historical announced policy (not in effect)

The announcement said programmatic Claude usage would exit the subscription pool and draw from a separate
monthly **Agent SDK credit**, billed at **standard API list rates**, per-user,
**no rollover**, one-time opt-in to claim (refreshes automatically after).

### Counts against the Agent SDK credit
- `claude -p` (headless / non-interactive mode)
- Claude Agent SDK calls (Python / TypeScript)
- Claude Code GitHub Actions integration
- Third-party apps authenticating with a Claude subscription via Agent SDK / ACP (Zed, JetBrains, etc.)

### Stays on interactive subscription limits
- Interactive Claude Code TUI (terminal/IDE) — **including Agent-tool subagents,
  Workflow fan-outs, and hooks inside interactive sessions** (not listed as programmatic)
- claude.ai web/desktop/mobile, Claude Cowork (incl. Cowork scheduled tasks)
- Direct API keys (unchanged pay-as-you-go, separate from all of this)

### Credit amounts (monthly)
| Plan | Credit |
|---|---|
| Pro | $20 |
| Max 5× | $100 |
| Max 20× | $200 |
| Team Standard / Premium | $20 / $100 |
| Enterprise usage-based / seat-Premium | $20 / $200 |

### Exhaustion behavior
Agent SDK usage draws from the credit first. When depleted: overflow to usage
credits at standard API rates **only if explicitly enabled**; otherwise requests
**hard-stop** until the cycle resets. The mental model from community coverage:
the "Enter Key Test" — if a human pressed enter, it is interactive; if
automation did, it bills against the credit.

## Historical impact analysis and svc call-site audit (2026-06-07)

| Call site | What it does | Trigger | Exposure under the paused proposal |
|---|---|---|---|
| `scripts/dispatch-worker.sh:60` | `claude -p` worker per WI (worktree isolation) | manual — dispatch-waves skill / orchestrator | HIGH (Opus/Sonnet at API rates) |
| `scripts/dispatch-log.sh:67` | logging wrapper around dispatch-worker | manual — same path | HIGH (same calls) |
| `scripts/haiku-extract.sh:50` | `claude -p --bare --tools "" --agent summary-extractor` (Haiku) | manual — orchestrator after fan-out, to extract worker summary blocks | LOW (Haiku) |
| `scripts/eval-gate.mjs:174` + `~/.claude/skills/scripts/eval-gate.mjs:174` | AI quality check on TaskUpdate evidence | **hook-wired**: PreToolUse(TaskUpdate) in `~/.claude/settings.json:164` — fires every TaskUpdate, but `claude -p` only when `SVC_EVAL_MODE=ai` (default `structural`; not set anywhere → currently inert) | LOW (~$0.001/task) |
| `test-framework/evals/test-helpers.sh:26` → `tier-2/run-tier2.sh:84-91` (2× per scenario), `tier-3/run-tier3.sh:99` | integration eval sessions (~50K tok each) | manual — test-framework skill tier-2/3 runs | HIGH on full suites |
| `create-skill/scripts/run_eval.py`, `improve_description.py` (orchestrated by `run_loop.py`) | skill description-optimization loops | manual — create-skill optimization phase | MEDIUM (loops) |
| Plugin copies: official skill-creator (same py scripts), superpowers tests, last30days `test-v1-vs-v2.sh` | plugin eval/test harnesses | manual only | LOW |
| security-guidance plugin hook `security_reminder_hook.py:246` | mentions `claude -p` in a docstring only — **no invocation** | n/a | NONE |
| GitHub Actions | none found in svc or novisenti `.github/` | n/a | NONE |

**Historical audit facts:** (1) The ONLY automatic trigger path is the PreToolUse(TaskUpdate) eval-gate
hook, and it is gated behind `SVC_EVAL_MODE=ai` which is unset → zero automatic `claude -p`
today. (2) WI-357 observed `claude -p` is **auth-dead on this machine** anyway — current
real usage is zero. (3) WI-372 (agents → native `.claude/agents/`) and WI-373 (Workflow-tool
transport for analysis fan-outs) were already filed 2026-06-07 by the native-transport
rebase spike (`docs/analysis/native-transport-rebase-2026-06-07.md`) and align with the
billing-driven port proposal.

## Historical alternatives considered (researched 2026-06-07)

1. **Claim the credit** was the announced path; it is not currently available because the change is paused.
2. **Port heavy fan-out to interactive-session subagents** — Agent tool /
   Workflow tool inside the TUI stays on subscription. See proposal
   `proposals/2026-06-07-port-headless-claude-p-to-subagent-transport.md`.
3. **Cross-vendor CLIs already in the framework** — `kimi --print`, `opencode`,
   Codex CLI (cross-model review path). Unaffected by Anthropic billing.
4. **API key for true CI headless** (GitHub Actions) — pay-as-you-go, predictable.
5. **Cowork scheduled tasks** remain on subscription per community coverage.

**Do NOT adopt:** TUI-puppeting workarounds (e.g. the "clarp" gray-area tool
circulating) — billing-classification evasion, account-flag risk.

## Sources
- Official docs note (historical announced policy): https://code.claude.com/docs/en/agent-sdk/overview
- Official support article (current PAUSED state): https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- Zed (historical announced policy): https://zed.dev/blog/anthropic-subscription-changes
- The Register (historical announcement, 2026-05-14): https://www.theregister.com/ai-ml/2026/05/14/anthropic-tosses-agents-into-the-api-billing-pool/5240748
- The Decoder (historical announced policy): https://the-decoder.com/claude-subscriptions-get-separate-budgets-for-programmatic-use-billed-at-full-api-prices/
