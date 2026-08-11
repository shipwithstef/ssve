# Framework Improvement: Pass-through extractor + locked-down agents

**Status:** IMPLEMENTED (2026-04-20)

## Evidence
- **Source:** User question during OpenCode integration session 2026-04-20: *"the Haiku part needs special instruction to just take input and pass it — not to do some crazy explore and stuff on its end and just pass back maybe special agent etc"*
- **Finding:** Four concrete gaps in `proposals/2026-04-20-evolution-summary-extractor-and-pass-through-agents.md`:
  - F-001 (P0): worker summary contract emits blocks but no extractor script exists
  - F-002 (P0): no locked-down cheap-model wrapper — cheap models without CLI lockdown "helpfully" explore
  - F-003 (P1): no fan-out helper — parallel orchestration is ad-hoc
  - F-004 (P1): `agents/` primitive doesn't exist in svc despite CLI support (`claude -p --agent`, `opencode run --agent`) and wide ecosystem adoption (ECC: 47 agents)
- **Severity:** P0 for F-001/F-002 — blocks practical multi-worker orchestration. P1 for F-003/F-004 — degrades quality and re-invents plumbing.

## Diagnosis
- **Root cause:**
  - F-001: contract was defined without its reader; orchestrators would either hold entire logs in their context or re-implement awk each turn
  - F-002: svc had no codified pattern for "cheap mechanical distillation agent"; every orchestrator either re-invented lockdown flags or forgot them
  - F-003: fan-out is a distinct primitive from single-dispatch; dispatch-worker.sh never intended to handle the N-way case
  - F-004: `agents/` as a top-level directory + definition format was a missing abstraction layer — skills ended up embedding 30-50 lines of system-prompt boilerplate that should be reusable agent definitions
- **Category:** gap (all four)
- **Already in FRAMEWORK-STATE.md?** No — new gaps, not previously tracked

## Implementation
- **Route:** direct file additions + light edits (no SKILL.md deletions, no lane disruption)
- **Files changed:**
  - `scripts/extract-summary.sh` (new, 35 lines) — deterministic awk Tier-A extractor
  - `scripts/haiku-extract.sh` (new, 55 lines) — locked Tier-B Haiku salvage with `--bare --tools "" --agents <inline JSON> --agent summary-extractor --model claude-haiku-4-5-20251001`, fails loud if `ANTHROPIC_API_KEY` env var is missing
  - `scripts/fanout.sh` (new, 95 lines) — parallel dispatch orchestrator with per-worker log + table aggregation
  - `agents/README.md` (new, 78 lines) — primitive documentation: skill-vs-agent table, invocation patterns, design principles
  - `agents/summary-extractor.md` (new, 48 lines) — first agent definition: frontmatter with model/tools/harness/cognitive_label; body with strict pass-through prompt and fail-shape contract
  - `references/model-routing.md` — added 7th cognitive label `[PASS-HAIKU]` with canonical-use pointer to `scripts/haiku-extract.sh` + `agents/summary-extractor.md`
  - `FRAMEWORK-STATE.md` — Current State gained `Agents: 1` + `Worker transport scripts: 4`; Primitives line updated to include `agents` alongside skills + rules; Analysis History 2026-04-20 entry covering F-001..F-004 with locked decisions
- **Commits:** pending on next push

## Replay Verification
- **Replay targets:**
  1. Tier-A `extract-summary.sh` on valid fixture → exit 0, emit block
  2. Tier-A on missing-block fixture → exit 1, stderr message
  3. Tier-A on unreadable file → exit 2, usage message
  4. Tier-B `haiku-extract.sh` fails loud when `ANTHROPIC_API_KEY` absent → exit 3, clear stderr
  5. End-to-end `fanout.sh` with 2 parallel OpenCode+MiMo probe workers → markdown table with status/files/blockers/next_action columns, both workers reported `success`
- **Result:** ALL PASS
- **Evidence (session transcript 2026-04-20):**
  - Fixture 1 (valid): script printed the 12-line block verbatim, exit 0
  - Fixture 2 (missing): `no valid summary block in /tmp/svc-test-missing.log`, exit 1
  - Fixture 3 (missing file): usage + error, exit 2
  - Haiku no-key test: `haiku-extract.sh requires ANTHROPIC_API_KEY env var (--bare mode does not read OAuth or keychain).`, exit 3
  - Fanout 2-worker test: MiMo-via-OpenCode round-tripped both probes, fanout.sh emitted:
    ```
    | worker | status | files_changed | blockers | next_action |
    | A | success | 0 | none | none |
    | B | success | 0 | none | none |
    ```
    Total wall time ~8s for both workers in parallel (single-worker probe ~3s baseline; parallelism verified).
- **Deferred:** live Haiku Tier-B end-to-end (requires orchestrator shell to have `ANTHROPIC_API_KEY` set for non-OAuth auth path). Mechanical path validated; agent-definition JSON verified well-formed against `claude -p --agents` schema; CLI signature matches `claude -p --help` output. Real Haiku call will fire on first production Tier-A miss.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** 2026-04-20 entry added above the prior 2026-04-20 OpenCode-harness entry (this session produced two 2026-04-20 entries as the framework evolves intra-day; both are preserved in chronological order newest-first)
- **Current State:** Primitives updated (now 3: skills, rules, agents); new `Agents: 1` line; new `Worker transport scripts: 4` line
- **Decisions (new):**
  - Agents default to `tools: []`; any deviation requires explicit justification
  - Tier-A always runs before Tier-B (free grep before paid Haiku)
  - Agent format is trans-harness (claude + opencode); no CLI-specific tricks without flagging
  - Fail-shape is contractual — every agent emits a defined fail block when input is malformed
- **Capabilities:** `references/knowledge/svc/CAPABILITIES.md` NOT edited this loop — the fix is a primitive addition, not a capability surface change; will update when the first skill consumer adopts the agents/ primitive

## Deferred follow-ups
- F-005: version the `workers.jsonl` spec file format (gated on first production fanout.sh usage)
- F-006: per-dispatch cost/latency telemetry (already deferred per prior entry)
- First skill consumer: update `review-gate` or `audit-implementation` to invoke `agents/summary-extractor` via `scripts/haiku-extract.sh` when aggregating multi-worker outputs — will demonstrate the end-to-end pattern

## External sources consulted
- `claude -p --help` output — confirmed `--bare`, `--tools`, `--agent`, `--agents <json>`, `--system-prompt` flags exist and compose as needed
- `opencode run --help` output — confirmed `--agent` flag for future trans-harness compatibility
- `everything-claude-code` (v1.10.0, 47-agent ecosystem) — reference for the agent-as-first-class-primitive pattern; svc's implementation is scoped to pipeline-bounded pass-through roles, not ECC's broad general-purpose agent set
