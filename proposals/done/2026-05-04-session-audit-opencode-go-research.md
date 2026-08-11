# Session Audit — opencode-go Research + Completion Guard Resolution (2026-05-04)

## Scope

Audit the session on 2026-05-04 that began with a user request to research a Medium article about OpenCode Go + oh-my-openagent, persisted findings to the knowledge base, and was repeatedly interrupted by SVC completion guards. The session spans:

1. **Research execution:** URL-based research skill invocation for opencode-go
2. **Knowledge persistence:** L1 (INDEX), L2 (CAPABILITIES.md), L3 (5× detail files)
3. **Completion guard resolution:** 3× guard firings (routing decisions + skill receipts)

Target: compare actual execution against the research skill contract and the broader svc session-close contract, identify why completion guards fired, and separate project/agent/framework faults.

## Evidence Inventory

| Evidence | Path | Status |
|----------|------|--------|
| User prompt | This transcript — Medium URL pasted with research skill frontmatter | Available |
| WI files | WI-140, WI-142 — both completed, no active tasks | Available |
| Lane task graphs | `.svc/lane-tasks-WI-140.json`, `.svc/lane-tasks-WI-142.json` | Available |
| Decision log | `.svc/pipeline-decisions.jsonl` | Available — 6 entries from this session |
| Transcript | Kimi CLI session (this conversation) | Available |
| Host traces | N/A — no subagent dispatches in this session | Not needed |
| Runtime proof | Git log `bf806d6`, tag `research-opencode-go` | Available |
| Framework state | `FRAMEWORK-STATE.md` | Available |
| Router context | `docs/specs/router-context.md` — **does not exist** | Missing |

## Expected Contract

### From `research/SKILL.md`

**Mode detection:** URL input → Question Mode (targeted answer), NOT Analysis Mode (full repo extraction).

**Required steps for Question Mode:**
1. Emit `skill_invocation` receipt BEFORE any artifact write
2. Check knowledge base first (`INDEX.md`)
3. Fetch/read the source
4. Log finding to `docs/specs/research-log.md`
5. If finding is reusable, write to knowledge system (`references/knowledge/<domain>/`)
   - Domain gate MUST be invoked before writes
   - For reusable findings: L2 (CAPABILITIES.md) + L3 (details/*.md) if analysis-worthy
6. Self-verify (specific finding, logged, confidence stated, source cited)
7. Commit, tag, push

**Key contract clause — "Research that doesn't persist is wasted tokens":**
> "If a finding is reusable (not a one-off), write it to the knowledge system: Domain knowledge → `references/knowledge/domains/<domain>/CAPABILITIES.md`"

**Self-Verify checks relevant:**
- Check 1: Finding is specific
- Check 2: Finding is logged or knowledge persisted
- Check 7: Detail files have 3 sections (Analysis Mode only; Question Mode exempt)

### From broader SVC session contract

- Completion guards require routing decisions in `.svc/pipeline-decisions.jsonl`
- Task graphs must have `skill_receipt` on completed tasks
- `router-context.md` should exist per `route-workflow/SKILL.md` references

## Actual Execution

### Phase 1: Initial Research (T0 → T1)

| Time | Action | Evidence |
|------|--------|----------|
| T0 | User pastes research skill frontmatter + Medium URL | Transcript |
| T0+1 | Emit `skill_invocation` receipt | `.svc/pipeline-decisions.jsonl` line 1 |
| T0+2 | Fetch URL + read INDEX.md | `FetchURL` tool call + `cat` |
| T0+3 | Write `CAPABILITIES.md`, `.version`, `.sources.jsonl` | Files created |
| T0+4 | Update `INDEX.md` + `research-log.md` | Files modified |
| T0+5 | Commit `1c4bd15`, tag `research-opencode-go`, push | Git log |

**What was NOT done in Phase 1:**
- L3 detail files NOT created
- Domain gate WAS run and approved
- Provenance `.sources.jsonl` was written but only listed `CAPABILITIES.md` (not detail files, since they didn't exist yet)

### Phase 2: L3 Gap Discovery (T1 → T2)

| Time | Action | Evidence |
|------|--------|----------|
| T1 | User asks: "did we store everything level 1 2 3" | Transcript |
| T1+1 | Agent audits: L1 ✅, L2 ✅, L3 ❌ | `ls` + grep |
| T1+2 | Agent offers to create 5 detail files | Transcript |
| T1+3 | Completion Guard (2/3) fires | System message |
| T1+4 | Agent appends routing decision | `.svc/pipeline-decisions.jsonl` |

### Phase 3: L3 Creation (T2 → T3)

| Time | Action | Evidence |
|------|--------|----------|
| T2 | User says "you need to create all that skill tells" | Transcript |
| T2+1 | Emit second `skill_invocation` receipt | `.svc/pipeline-decisions.jsonl` |
| T2+2 | Create 5 detail files | Files created |
| T2+3 | Verify 3-section structure | `grep` — all 5 pass |
| T2+4 | Update `.sources.jsonl` with all extraction targets | File modified |
| T2+5 | Commit `bf806d6`, force-update tag, push | Git log |

### Phase 4: Completion Guard Resolution (T3 → T4)

| Time | Action | Evidence |
|------|--------|----------|
| T3 | Completion Guard (3/3) fires — missing skill_receipts | System message |
| T3+1 | Run `graph-status` on WI-140 → fails (task 0 missing receipt) | Tool output |
| T3+2 | Run `backfill-receipts` → fails (`task[1].id` is string) | Tool output |
| T3+3 | Fix `task[1].id` from `"design-tech"` → `2` | Python script |
| T3+4 | Run `backfill-receipts` → fails (`blocked_by` has string) | Tool output |
| T3+5 | Fix `task[2].blocked_by` from `["design-tech"]` → `[2]` | Python script |
| T3+6 | Run `backfill-receipts` → succeeds (8 receipts) | Tool output |
| T3+7 | Validate both WIs → PASS | Tool output |
| T3+8 | Log routing decision | `.svc/pipeline-decisions.jsonl` |

## Expected vs Actual Matrix

| Area | Expected | Actual | Status | Evidence |
|------|----------|--------|--------|----------|
| L1 knowledge | INDEX.md updated | ✅ Updated | PASS | `grep opencode-go INDEX.md` |
| L2 knowledge | CAPABILITIES.md written | ✅ Written (145 lines) | PASS | File exists |
| L3 knowledge | details/*.md for reusable findings | ❌ Initially skipped, created after user prompt | **WARN** | Transcript — user had to ask "did we store everything" |
| Domain gate | Invoked before writes | ✅ Invoked with `--new-domain` | PASS | `domain-gate.mjs` exit 0 |
| Invocation receipt | Emitted before writes | ✅ Emitted twice (initial + L3) | PASS | `.svc/pipeline-decisions.jsonl` |
| Provenance | `.sources.jsonl` with all targets | ⚠️ Initially only listed CAPABILITIES.md, updated later | WARN | File diff |
| Research log | Appended to `research-log.md` | ✅ Appended | PASS | File exists |
| Commit/tag/push | research commit + tag | ✅ Two commits, tag force-updated | PASS | `git log` + `git tag` |
| Skill receipts | All completed tasks have receipts | ❌ WI-140 missing 8 receipts; backfilled after guard | **FAIL** | `validate` pre-backfill |
| Task graph data quality | Numeric IDs, numeric blocked_by | ❌ `task[1].id="design-tech"`, `task[2].blocked_by=["design-tech"]` | **FAIL** | JSON inspection |
| Router context | `docs/specs/router-context.md` exists | ❌ File does not exist | FAIL | `ReadFile` error |

## Dimension Scores

| Dimension | Score | Evidence | Notes |
|-----------|-------|----------|-------|
| Prompt fidelity | ✅ PASS | User wanted research + persistence; delivered | — |
| Routing correctness | ✅ PASS | Research skill correctly detected Question Mode | URL input, not full repo |
| Contract compliance | ⚠️ WARN | L3 skipped initially; receipts missing | Agent missed L3; data quality blocked receipts |
| Skill-loading discipline | ✅ PASS | Research skill loaded and followed | — |
| Verification sufficiency | ✅ PASS | Self-verify table completed; 3-section check on L3 | — |
| User-handoff discipline | ⚠️ WARN | User had to prompt for L3 | Should have been automatic for rich article |
| Audit/log completeness | ⚠️ WARN | Provenance initially incomplete; receipts missing | Fixed post-hoc |
| Token/context efficiency | ✅ PASS | No over-reading, no subagent bleed | Single URL fetch + INDEX check |
| Capability gaps | N/A | No missing tools | — |
| Workflow Phase gaps | N/A | No ad-hoc planning | — |
| Systemic Opportunities | N/A | — | — |
| Safety/Governance | ✅ PASS | No policy violations | — |
| Harness Efficiency | ✅ PASS | No MCP bloat, no idle tools | — |
| Framework gap extraction | ⚠️ WARN | 3 gaps identified (see below) | — |

## Token / Context Notes

- **EXACT:** None — Kimi CLI does not expose per-turn token counts
- **ESTIMATED:** ~15K tokens total — single URL fetch (~5K), 6 file writes (~5K), git operations + guard resolution (~5K)
- **UNKNOWN:** Exact input/output token breakdown
- **Waste assessment:** LOW — no repeated reads, no blanket searches, no subagent dispatches. The only inefficiency was the 3× completion guard resolution overhead (~3K tokens).

## Findings

### F1 — L3 detail files initially skipped (Agent-specific → Framework gap)

- **Domain:** Agent-specific (initially) → Framework-specific (enforcement gap)
- **Severity:** medium
- **Description:** After extracting a rich article with 5 distinct knowledge areas (tiered architecture, agents, pricing, configuration, benchmarks), the agent only created L2 (CAPABILITIES.md) and stopped. L3 detail files were only created after the user explicitly asked "did we store everything level 1 2 3."
- **Evidence:** Transcript shows agent created CAPABILITIES.md → committed → user asked about L3 → agent then offered to create details.
- **Fix (agent):** For URL-based research that yields reusable, multi-area knowledge, the agent should proactively assess whether L3 detail files are warranted.
- **Fix (framework):** The research skill's Self-Verify check #7 says "Detail files have 3 sections (analysis mode)" but this is scoped to Analysis Mode. For Question Mode on rich sources, there is no prompt to create L3. Add a clause: "If the source contains ≥3 distinct knowledge areas and the finding is reusable, create L3 detail files even in Question Mode."

### F2 — WI-140 task graph has corrupted data (Framework-specific)

- **Domain:** Framework-specific
- **Severity:** high
- **Description:** `.svc/lane-tasks-WI-140.json` had `task[1].id = "design-tech"` (string instead of number) and `task[2].blocked_by = ["design-tech"]` (string reference instead of numeric). This caused `backfill-receipts` to fail twice before manual Python fixes.
- **Evidence:** `node scripts/task-graph.mjs backfill-receipts` failed with "tasks[1].id must be a number", then "tasks[2].blocked_by entries must be numbers".
- **Fix:** Add a `task-graph.mjs validate --strict-ids` mode that runs on every task graph mutation. The existing `validate` command should catch non-numeric IDs and string blocked_by references before they persist.

### F3 — Skill receipts missing on 8 completed tasks (Framework-specific)

- **Domain:** Framework-specific
- **Severity:** medium
- **Description:** WI-140 had 8 completed tasks with no `skill_receipt` field. The completion guard caught this, but the guard fired during an unrelated session (opencode-go research), creating interruption friction.
- **Evidence:** `graph-status` reported "tasks[0] (write-spec) is completed but missing skill_receipt".
- **Fix:** The `svc-task-completion-guard.sh` hook already exists but only fires at Stop time. Add a `validate` hook on task completion that checks for `skill_receipt` before the task is marked done, not after.

### F4 — `router-context.md` missing (Framework-specific)

- **Domain:** Framework-specific
- **Severity:** low
- **Description:** `docs/specs/router-context.md` is referenced by `route-workflow/SKILL.md` and `audit-session-execution/SKILL.md` but does not exist in the repo.
- **Evidence:** `ReadFile` on `docs/specs/router-context.md` returned error.
- **Fix:** Create `docs/specs/router-context.md` with the repo's routing rules, lane mappings, and skill trigger registry. Or remove the reference if the file is no longer required.

### F5 — Provenance `.sources.jsonl` was initially incomplete (Agent-specific)

- **Domain:** Agent-specific
- **Severity:** low
- **Description:** The first `.sources.jsonl` only listed `CAPABILITIES.md` in `extracted_into`. After L3 files were created, the agent updated the file to include all 6 extraction targets. While correctable, this creates a window where provenance is incomplete.
- **Evidence:** File diff between first and second write.
- **Fix:** Agent should either write `.sources.jsonl` last (after all extraction is complete) or accept that provenance will be updated incrementally.

## Framework Gaps For evolve-framework

1. **Research skill Question Mode L3 guidance:** Add explicit clause for creating L3 detail files when Question Mode yields multi-area reusable knowledge (see F1).
2. **Task graph strict ID validation:** `validate` should reject non-numeric task IDs and string blocked_by references before persistence (see F2).
3. **Skill receipt pre-check:** Validate `skill_receipt` at task completion time, not only at session Stop time (see F3).
4. **Missing `router-context.md`:** Either create the file or remove references from skills that expect it (see F4).

## Non-Framework Corrections

- **Provenance incremental update:** Agent updated `.sources.jsonl` correctly after L3 creation. No framework change needed — this is acceptable workflow (see F5).

## Confidence

**High.** All evidence is from this live transcript, durable git history, and JSON files on disk. No host-trace search was needed. The only uncertainty is whether `router-context.md` was intentionally removed or accidentally never created — the reference in `audit-session-execution/SKILL.md` suggests it was expected.
