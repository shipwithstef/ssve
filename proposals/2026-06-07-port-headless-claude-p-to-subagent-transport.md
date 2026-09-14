# Port headless `claude -p` surfaces to subagent transport (Agent SDK credit response)

- **Date:** 2026-06-07
- **Source:** Anthropic Agent SDK credit billing split, effective 2026-06-15. Knowledge:
  `references/knowledge/domains/agent-harnesses/details/anthropic-agent-sdk-credit-2026-06-15.md`
- **Deadline pressure:** 8 days. After 06-15, every `claude -p` call bills the separate
  monthly credit ($100 Max 5× / $200 Max 20×) at full API rates, no rollover, hard-stop
  on depletion unless overflow billing is enabled.

## Problem

The framework treats `claude -p` as a free isolated-session transport. Five live surfaces
shell out to it. After 06-15 the economics invert: interactive-session subagents
(Agent tool / Workflow) remain on subscription; headless sessions burn a capped dollar
credit at API list prices. The existing transport rule in `dispatch-waves` /
parallel-WI-dispatch proposal ("≥4 WIs default to `claude -p`") routes the HIGHEST-volume
work to the now-most-expensive transport — exactly backwards.

## Alternatives researched (2026-06-07)

| Option | Verdict |
|---|---|
| Claim the Agent SDK credit (one-time opt-in) | DO — keeps light headless calls working; watch the email from Anthropic before 06-15 |
| Agent tool / Workflow inside interactive sessions | DO — stays on subscription; primary port target |
| Cross-vendor CLIs (`kimi --print`, `opencode`, Codex CLI) | KEEP — already integrated; unaffected by Anthropic billing |
| API key for CI (GitHub Actions) | OK for true unattended CI; pay-as-you-go |
| TUI-puppeting workarounds ("clarp" etc.) | REJECT — billing-classification evasion, account-flag risk |

Conclusion: no sanctioned alternative preserves unlimited `claude -p`. Port is required
for high-volume surfaces; the credit absorbs only the cheap ones.

## Findings

### F-01 — `dispatch-worker.sh` / dispatch-waves transport rule (HIGH exposure)
**Today:** `scripts/dispatch-worker.sh` wraps `claude -p` per WI; doctrine says ≥4 WIs → `claude -p`.
**Port:** invert the default. All wave sizes dispatch via Agent tool (`isolation: worktree`
gives the same per-WI isolation the worktree + `claude -p` combo provided) or the Workflow
tool for deterministic fan-out (`agent()` calls with `isolation: 'worktree'`). The
orchestrating interactive session replaces the shell dispatcher.
**Mapping of old guarantees:**
- Fresh context per worker → Agent tool subagents start with only their prompt (equivalent).
- `SVC_SUBAGENT=1` host-mirror bypass → unnecessary; Agent tool has no TaskList access by design.
- `lane-tasks.json` file-state coordination → unchanged; file state remains the only
  cross-boundary channel (proposal 2026-04-14 already established this for both transports).
- stdout logs in `.svc/dispatch/` → subagent final message returns to orchestrator; persist
  via a log-write step in the worker prompt, or rely on harness transcripts.
**Keep `claude -p` path** behind an explicit flag (`SVC_DISPATCH_TRANSPORT=headless`) with a
cost warning, for cross-repo waves where the Agent tool cwd constraint genuinely bites.

### F-02 — tier-2/tier-3 evals (HIGH exposure on full suites)
**Today:** `run-tier2.sh` runs `claude -p` twice per scenario (~50K tok each).
**Port options:**
- (a) Orchestrated mode: an interactive session walks scenarios and spawns one Agent-tool
  subagent per scenario into the scaffolded workspace; assertions stay in bash. Fidelity
  caveat: subagents inherit the parent harness settings/hooks — acceptable for file-existence
  and content assertions, NOT identical to a cold `claude -p` session. Document the delta.
- (b) Stay headless but pin `--model claude-haiku-4-5` for scenarios that don't assert
  model-quality, and budget suites against the credit (~$200/mo covers many Haiku scenarios).
**Recommendation:** (a) as default runner mode, (b) for the subset needing true cold-session
fidelity. Drop the duplicate text+stream-json double-run where the stream-json log alone
can serve both checks — halves cost regardless of transport.

### F-03 — `haiku-extract.sh`, `eval-gate.mjs` ai-mode (LOW exposure)
Haiku-priced, pennies. **No port.** Let them draw the credit. They cannot use the Agent
tool anyway (invoked from scripts/hooks, not from a model turn).

### F-04 — create-skill description optimization `run_loop.py` (MEDIUM exposure)
Loops of `claude -p` subprocesses. Port to Agent-tool batches when run from an interactive
session (the normal case — create-skill runs inside a session). Keep the subprocess path
for Cowork/CI contexts, Haiku-pinned.

### F-05 — Doctrine/docs drift
`DOCTRINE.md:1076` ("claude -p (Max subscription)… transport identical either way") is now
false — transports have different billing. Update DOCTRINE, `FRAMEWORK-STATE.md` agents
primitive note, `dispatch-waves/SKILL.md`, and `rules/common/model-selection.md` to state:
**default transport = in-session subagents; headless = opt-in, credit-billed, Haiku-first.**

## Action plan (ordered)

1. **Before 06-15 (user action):** claim the Agent SDK credit when the opt-in email arrives;
   leave overflow billing OFF.
2. `dispatch-waves` + `dispatch-worker.sh`: invert transport default to Agent tool/Workflow;
   gate headless behind `SVC_DISPATCH_TRANSPORT=headless` + cost warning. (1 session)
3. `run-tier2.sh`: add orchestrated subagent mode; deduplicate the double `claude -p` run;
   Haiku-pin the remaining headless scenarios. (1 session)
4. Doc sweep per F-05. (same session as 2)
5. `create-skill` run_loop: in-session batch mode. (deferred until next skill-optimization need)

## Risks

- Subagent fidelity ≠ cold headless session (hooks/settings inheritance) — documented per F-02.
- Orchestrator context growth on large waves — Workflow tool's progress grouping + structured
  outputs mitigates; workers return summaries, not transcripts (existing subagent-context rules).
- Cross-repo waves still need headless or a second interactive session — explicit flag retained.
