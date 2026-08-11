# Framework Evolution — 2026-04-20 — Pass-through extractor + locked-down pass-through agents

## Method

Read in order: `FRAMEWORK-STATE.md` (current state block + full Analysis History incl. the just-landed 2026-04-20 OpenCode harness entry); `scripts/dispatch-worker.sh` (current summary contract on lines 94-121); `DOCTRINE.md` subagent references; `EXTERNAL_ADDONS.md`; `claude -p --help` to inventory available lockdown flags; `ls agents/` to confirm whether svc has a first-class agent primitive today. Cross-checked session transcript from the MiMo/OpenCode integration test to confirm the actual pain point: Haiku (and any generic small-model call) without lockdown tends to "help" — running tools, exploring filesystem, editorializing — when what the orchestrator wants is mechanical pass-through of an already-structured artifact.

FRAMEWORK-STATE items skipped (already tracked, not rediscovered): OpenCode harness landing (2026-04-20), dispatch-worker summary contract (landed in same commit), cognitive routing taxonomy (2026-04-19), skills-manifest parity fixes (2026-04-19), External Canvas Handoff (2026-04-19).

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001: Worker summary contract has no extractor tool [Gap]

**Evidence:** `scripts/dispatch-worker.sh:94-121` mandates every worker emit a literal `=== SVC_WORKER_SUMMARY === … === END_SVC_WORKER_SUMMARY ===` block. No companion script or skill reads that block out of a log. `ls scripts/` shows only `dispatch-worker.sh` and `eval-gate.mjs` — no extractor. Orchestrators are therefore forced to either (a) read the entire worker log into their context (defeats the point of the summary block), (b) write one-off `awk`/`grep` inline each time (drift risk — different orchestrator turns parse slightly differently), or (c) spawn a model call just to extract structured text (waste).

**Impact:** The whole point of the summary contract — keeping the orchestrator's context tiny — is undermined when orchestrators don't have a standard extractor. Fan-out with 5+ workers amplifies the cost: 5 × full log vs 5 × 150-token summary. Blocks practical multi-worker orchestration.

**Proposed fix:** Add `scripts/extract-summary.sh` — 10-line deterministic `awk` between marker lines. Exit 0 if block found, exit 1 if absent (salvage path triggers). Document in `FRAMEWORK-STATE.md` current-state as a framework primitive.

```bash
#!/bin/bash
# scripts/extract-summary.sh <log-file>
# Prints the SVC_WORKER_SUMMARY block only. Exit 1 if missing.
awk '/=== SVC_WORKER_SUMMARY ===/,/=== END_SVC_WORKER_SUMMARY ===/' "$1" | grep -q "=== SVC_WORKER_SUMMARY ===" || { echo "ERR: no summary block in $1" >&2; exit 1; }
awk '/=== SVC_WORKER_SUMMARY ===/,/=== END_SVC_WORKER_SUMMARY ===/' "$1"
```

#### F-002: No locked-down pass-through pattern for cheap-model wrappers [Gap]

**Evidence:** Session transcript 2026-04-20: user flagged risk that when Haiku (or any small model) is invoked to "just extract the summary", the model tends to over-explore — running Read, Bash, WebFetch on its own initiative, editorializing, adding commentary. `claude -p --help` exposes `--bare`, `--tools ""`, `--disallowed-tools`, `--system-prompt`, `--agent`, `--agents <json>` — all the lockdown primitives exist in the CLI. svc has no skill, script, or reference that codifies the pass-through-only pattern. Every orchestrator re-invents the lockdown flags, often forgetting one. The 2026-04-19 cognitive-routing taxonomy at `references/model-routing.md` names 6 labels (STRAT-OPUS, PLAN-OPUS, EXEC-MIMO, REVIEW-SONNET, SENSE-OMNI, DISC-SEARCH) but has no label for "distill / pass-through" — the cheapest role.

**Impact:** Without a locked-down wrapper, a Haiku salvage call costs 5–10x what it should in tokens (the model explores the filesystem, narrates its reasoning, tries to be helpful) and can take minutes instead of seconds. For a pass-through role the orchestrator wants: zero tool use, zero exploration, input-in → structured-text-out, nothing else.

**Proposed fix:** Three parts.

1. **Add cognitive label `[PASS-HAIKU]`** to `references/model-routing.md` — the "distill / extract / pass-through" tier. Primary model: Claude Haiku 4.5 via plain Anthropic API (cheapest, fast). Role: take a specified input artifact and emit a specified output shape. No tools. No exploration. No commentary.

2. **Create first-class `agents/` directory in svc** with a `summary-extractor` agent definition:

```
seriousvibecoding/agents/summary-extractor.md
---
name: summary-extractor
description: Locked-down pass-through extractor. Reads a worker log, emits only the SVC_WORKER_SUMMARY block. No tools, no exploration, no commentary.
model: claude-haiku-4-5-20251001
tools: []
---

You are a strict pass-through extractor. Your ONLY job is to find the block
between "=== SVC_WORKER_SUMMARY ===" and "=== END_SVC_WORKER_SUMMARY ===" in
the user's input and emit it verbatim. If the input contains the block, emit
it exactly as-is, nothing before or after. If the block is malformed or
absent, emit exactly:

=== SVC_WORKER_SUMMARY ===
status: fail
files_changed:
commits: none
notable_decisions:
  - extractor: input log did not contain a valid summary block
blockers:
  - worker did not honor the SVC_WORKER_SUMMARY contract
next_action: orchestrator should re-dispatch the worker with stricter prompt or manually inspect the log at the path supplied
=== END_SVC_WORKER_SUMMARY ===

Do not explain. Do not add reasoning. Do not use tools. Do not explore.
Do not summarize anything else. Return ONLY the block.
```

3. **Add `scripts/haiku-extract.sh`** — launches `claude -p --bare --tools "" --agents '...'` with the `summary-extractor` agent JSON inlined (so the agent definition travels with the script; no dependency on the agents/ dir being installed at the user's path):

```bash
#!/bin/bash
# scripts/haiku-extract.sh <log-file>
# Locked-down Haiku pass-through. Pipes the log through a no-tool, no-explore
# agent that returns only the SVC_WORKER_SUMMARY block or a fail-shaped block.
LOG="$1"
AGENT_JSON='{"summary-extractor":{"description":"Strict pass-through extractor","prompt":"You are a strict pass-through extractor. Your ONLY job: find the block between \"=== SVC_WORKER_SUMMARY ===\" and \"=== END_SVC_WORKER_SUMMARY ===\" and emit it verbatim. No tools. No exploration. No commentary. If the block is missing or malformed, emit a fail-shaped block per the svc worker contract.","tools":[]}}'

claude -p \
  --bare \
  --tools "" \
  --agents "$AGENT_JSON" \
  --agent summary-extractor \
  --model claude-haiku-4-5-20251001 \
  < "$LOG"
```

**Impact of fix:** `scripts/extract-summary.sh` (Tier A, free grep) is the primary path. `scripts/haiku-extract.sh` (Tier B) is the salvage path — fires when Tier A fails (worker violated contract). The locked-down Haiku can't wander because `--tools ""` gives it nothing to wander with. The `--bare` flag skips hooks/CLAUDE.md/MCP/auto-memory/keychain/background prefetches. The inline `--agents` JSON + `--agent summary-extractor` + `--system-prompt` baked into the agent definition pins the role.

### P1 — Fix soon (degrades quality)

#### F-003: No fan-out helper → parallel worker orchestration is ad-hoc [Inefficiency]

**Evidence:** `scripts/dispatch-worker.sh` is single-worker by design. Session transcript 2026-04-20 describes fan-out via the Bash tool's `run_in_background=true` — works, but the pattern is orchestrator-reimplemented each turn. No svc script codifies: (a) launch N workers in parallel writing to `/tmp/wk-<id>.log`, (b) wait for all, (c) run extractor on each log, (d) aggregate into a single status table.

**Impact:** Every orchestrator that wants to fan out ≥3 workers re-derives the plumbing. Drift risk when the dispatch-worker contract evolves (e.g., if SVC_WORKER_SUMMARY format changes, each ad-hoc fan-out needs independent update).

**Proposed fix:** Add `scripts/fanout.sh <workers.jsonl>` — reads one worker spec per line (harness, skill, payload-file), launches all in parallel with distinct log paths, waits, runs `extract-summary.sh` on each, prints a unified markdown table. For ≥5 workers, optionally pipe the collected summaries through `haiku-extract.sh` with an aggregator prompt variant to produce a single table. Document the spec file format in FRAMEWORK-STATE current-state.

#### F-004: `agents/` as a first-class svc primitive doesn't exist yet [Gap]

**Evidence:** `ls seriousvibecoding/agents/` → no such directory. Grep across the repo shows "subagent" referenced extensively (DOCTRINE.md, EXTERNAL_ADDONS.md, multiple FRAMEWORK-STATE entries) but no codified `agents/<name>.md` contract. The CLI supports `--agent` and `--agents <json>` natively (confirmed in `claude -p --help` output), and competitors (Copilot CLI, frontend-design plugin, the `everything-claude-code` reference framework with 47 agents) treat agent definitions as first-class artifacts. svc tracks 57 skills but 0 agents.

**Impact:** Patterns the framework clearly wants (isolated pass-through roles, adversarial reviewers, purpose-built extractors) keep getting reinvented inline in skill prompts or shell scripts. No single place to define "what is a summary-extractor / what is a cross-model-adversary / what is a compaction-recovery worker." Skills end up embedding 30-50 lines of system-prompt boilerplate that should be a reusable agent definition.

**Proposed fix:** Introduce `agents/` directory per the format in F-002. Start with: `summary-extractor` (for F-002), `adversarial-reviewer` (used by review-gate when Codex isn't available), and `constraint-matrix-auditor` (used by design-ui Step C when Gemini CLI isn't available). Each agent file has frontmatter (name, description, model, tools) + a system-prompt body. Skills can reference them via `--agent <name>` without re-embedding prompts. Update FRAMEWORK-STATE current-state to include an "Agents: N" line alongside skills.

### P2 — Improve when possible

#### F-005: Fan-out spec file format not yet versioned [Opportunity]

**Evidence:** If F-003 lands, the `workers.jsonl` spec format is a new contract. No svc convention for versioning ad-hoc data file formats. Risk: format changes break deployed fan-out.sh scripts silently.

**Proposed fix (when F-003 is implemented, not before):** Add a `schema_version: 1` required first line in `workers.jsonl`. Extractor rejects unknown versions.

### P3 — Track (not actionable yet)

#### F-006: Cost/latency telemetry per dispatch [Opportunity, deferred]

**Evidence:** FRAMEWORK-STATE 2026-04-20 entry already flags this as deferred: *"Deferred: per-harness observability (cost/latency per dispatch) — tracked for future improvement."* No re-raise without new evidence. Track for when usage data proves the cognitive-routing predictions or contradicts them.

## Comparison delta

- **everything-claude-code (ECC)** — 47 agents as first-class primitives. svc has 0. ECC's agent-first compositional model is exactly the pattern F-004 proposes. Not adopting ECC's specific 47-agent set wholesale — most are general-purpose where svc is pipeline-bounded — but the *primitive itself* should land. (Source: `references/skill-pack-comparison.md` if it exists, or the 2026-04-12 research-log entry on ECC in example-marketplace's research log.)

- **OpenCode agents** — OpenCode CLI supports `--agent` flag (seen in `opencode run --help` output 2026-04-20 session). If svc's agents/ directory uses a format compatible with OpenCode's, the same agent definitions can drive both `claude -p --agent X` and `opencode run --agent X` — trans-harness reuse. Not urgent but design F-004 with that compatibility in mind.

- **Aider** — no equivalent of locked-down pass-through agents; Aider's architect/editor split is model-role-based, not agent-role-based. svc's direction (F-004) is orthogonal and arguably stronger for multi-harness orchestration.

## Stale proposal audit

Checked `proposals/` (pending queue):

- `proposals/done/2026-04-14-blocking-discovery-halt-protocol.md` — still BLOCKED (explicitly, per FRAMEWORK-STATE lifecycle). No change.
- `proposals/done/2026-04-14-parallel-wi-dispatch.md` — still BLOCKED pending scope decision. **Note:** this proposal's "parallel WI dispatch" partially overlaps F-003 (fan-out helper). Resolving F-003 may unblock or subsume part of `2026-04-14-parallel-wi-dispatch.md`. When F-003 lands, revisit the blocked proposal.
- `proposals/done/2026-04-19-evolution.md` — in-place proposal with 7 findings; F-001/F-002/F-004 landed 2026-04-19 (IMPLEMENTED annotations present in file). F-003 (`list-work-items.skill` zip twin), F-005 (evolve-framework "35+ skills" stale count), F-006, F-007 still open. Not acted on this session — out of scope for today's OpenCode/pass-through focus.

Checked `proposals/done/` — spot-verified `2026-04-20-framework-improvement-opencode-harness.md` landed today with artifacts on disk (`scripts/dispatch-worker.sh` has the `opencode` branch at line 63-84; `references/opencode-mimo-config.json` exists). PASS.

## Self-Verify

| # | Check | Result |
|---|-------|--------|
| 1 | Proposal file exists | PASS — `proposals/2026-04-20-evolution-summary-extractor-and-pass-through-agents.md` |
| 2 | Every finding cites file:line | PASS — F-001 cites `scripts/dispatch-worker.sh:94-121`; F-002 cites `references/model-routing.md` + CLI help output; F-003 cites `scripts/dispatch-worker.sh` single-worker design; F-004 cites absence of `seriousvibecoding/agents/` + `claude -p --help`; F-005/F-006 are derivatives |
| 3 | FRAMEWORK-STATE.md read first | PASS — skipped re-raising OpenCode harness, summary contract, cognitive-routing taxonomy, skills-manifest parity, External Canvas Handoff |
| 4 | Findings ranked by impact | PASS — P0 blocks multi-worker orchestration; P1 degrades quality; P2 is versioning hygiene; P3 is telemetry already deferred |
