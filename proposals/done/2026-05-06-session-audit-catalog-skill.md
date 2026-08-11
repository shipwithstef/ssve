# Session Audit — catalog-domain-capabilities skill build

## Scope

Audit of the on-demand session on 2026-05-06 where the user proposed a new
framework skill idea (classified domain capability catalog) and the agent
built it. Target: this conversation + artifacts produced.

## Evidence Inventory

- **prompt / session source:** Current conversation transcript (Kimi CLI)
- **WI file:** None — on-demand request, no WI
- **lane task graph:** None — on-demand request, no task graph
- **decision log:** `.svc/pipeline-decisions.jsonl` — no entries for this session
- **transcript status:** auto-discovered (this session)
- **runtime proof artifacts:**
  - `catalog-domain-capabilities/SKILL.md` (created)
  - `references/schemas/capability-catalog.schema.json` (created)
  - `skills-manifest.json` (modified)
  - `README.md` (modified)
  - `EXTERNAL_ADDONS.md` (modified)
  - `REPO_MODES.md` (modified)
  - `route-workflow/references/routing-rules.md` (modified)
- **session contract:** `.svc/session-contract.jsonl` — last entry is 2026-05-06T12:30:00+03:00 (prior session). No entry for this session.

## Expected Contract

Per `route-workflow/SKILL.md` § "Handling Direct User Requests (No Active Lane)":

> When the user makes a direct request that bypasses normal routing... the
> assistant MUST still invoke route-workflow to:
> 1. Select the lane
> 2. Update the session contract
> 3. Log the routing decision
> 4. Load the skill contract before executing

Per `route-workflow/SKILL.md` § "Session Contract":
> At session start (first user message): create one with bound_to: user-request
> and the current prompt.

Per `create-skill/SKILL.md`:
> After creating the skill, also: Add to skills-manifest, README, EXTERNAL_ADDONS,
> REPO_MODES, route-workflow routing rules, run manifest linter, run installer.

## Actual Execution

| Step | What Happened | Evidence |
|------|--------------|----------|
| 1 | User proposed capability catalog idea | Transcript line 1 |
| 2 | Agent read analyze-competitors, analyze-domain, context-budget | Tool calls: ReadFile × 3 |
| 3 | Agent read knowledge-protocol, checked knowledge dirs | Tool calls: ReadFile, Shell, Glob |
| 4 | Agent gave long response with 4 open questions | Transcript |
| 5 | User said "improve it" | Transcript |
| 6 | Agent read skills-manifest, create-skill SKILL.md | Tool calls: ReadFile × 2 |
| 7 | Agent created catalog-domain-capabilities/SKILL.md | Tool call: WriteFile |
| 8 | Agent updated skills-manifest.json | Tool call: StrReplaceFile |
| 9 | Agent updated README.md | Tool call: StrReplaceFile |
| 10 | Agent updated EXTERNAL_ADDONS.md | Tool call: StrReplaceFile |
| 11 | Agent updated REPO_MODES.md | Tool call: StrReplaceFile |
| 12 | Agent updated route-workflow routing rules | Tool call: StrReplaceFile |
| 13 | Agent ran manifest linter | Tool call: Shell — exit 1, then fixed, re-ran, passed |
| 14 | Agent ran tier-1 validators | Tool call: Shell — all passed |
| 15 | Agent wrote JSON schema | Tool call: WriteFile |
| 16 | Agent repeatedly asked "what next?" | Transcript — 4+ times |
| 17 | User said "STOP ASKING ME CRAZY QUESTIONS" | Transcript |
| 18 | Agent started audit | This file |

**Missing steps:**
- No session contract written for this session
- No routing decision logged to pipeline-decisions.jsonl
- No route-workflow invocation
- No lane selected
- No create-skill skill formally invoked (read file only)

## Expected vs Actual Matrix

| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Session contract | Written at first message | Not written | FAIL | session-contract.jsonl has no entry for this session |
| Routing | route-workflow selects lane + logs decision | Skipped entirely | FAIL | No pipeline-decisions.jsonl entry |
| Skill loading | Load create-skill contract via route-workflow | Read file only, no formal invocation | FAIL | No skill tool call, no task graph |
| Question discipline | Decide, don't ask | Asked 4+ open questions, then asked "what next" repeatedly | FAIL | Transcript shows question fatigue |
| Sync file updates | All 5 files + manifest linter | All 5 files + linter + tier-1 | PASS | Files modified, linter passed |
| Schema | Required by self-verify | Written | PASS | capability-catalog.schema.json exists |
| Tier-1 validation | Run before declaring done | Structure + contract passed | PASS | 840 structure, 512 contract |
| Installer | Run setup script | Not run | FAIL | No ./setup invocation |

## Dimension Scores

| Dimension | Score | Evidence | Notes |
|---|---|---|---|
| Prompt fidelity | PASS | Understood capability catalog idea correctly | User confirmed with "improve it" |
| Routing correctness | FAIL | No route-workflow invocation | Direct request bypassed routing entirely |
| Contract compliance | WARN | Followed create-skill checklist items 1-5, skipped 6-7 | Missing setup script, no eval created |
| Skill-loading discipline | FAIL | Read create-skill SKILL.md but never formally loaded it | AP-27 Ghost Skill risk |
| Verification sufficiency | PASS | Manifest linter + tier-1 validators passed | Good verification discipline |
| Review discipline | N/A | No review gate — on-demand work | Acceptable for framework skill creation |
| User-handoff discipline | FAIL | Asked 4 open questions, then "what next?" 4+ times | User explicitly complained |
| Audit/log completeness | FAIL | No session contract, no decision log | Post-session reconstruction harder |
| Token/context efficiency | WARN | Read 6+ files for a skill the user already wanted built | Some reads justified (need context) |
| Capability gaps | — | Framework has no "question fatigue" guard | See framework gaps below |
| Workflow Phase gaps | — | On-demand skill creation not a formal lane phase | See framework gaps below |

## Token / Context Notes

- **Estimated reads:** 6 files (analyze-competitors, analyze-domain, context-budget, knowledge-protocol, skills-manifest, create-skill) + glob + shell commands
- **Estimated writes:** 2 files created, 5 files modified, 1 schema created
- **Context efficiency:** Reasonable for a new skill build, but the initial response with 4 open questions wasted tokens on discussion the user didn't want.

## Findings

### F1: Session contract never written
- **Domain:** agent-specific + framework-specific
- **Severity:** high
- **Description:** First message in session did not create a session contract entry. `.svc/session-contract.jsonl` has no record of this session.
- **Evidence:** `tail -1 .svc/session-contract.jsonl` shows 12:30 entry from prior session.
- **Fix:** Framework needs a mechanical hook that writes session contract on first message if none exists.

### F2: route-workflow bypassed entirely
- **Domain:** agent-specific + framework-specific
- **Severity:** high
- **Description:** Direct user request went straight to file edits without lane selection, routing decision, or skill contract loading.
- **Evidence:** No pipeline-decisions.jsonl entry for this session. No `route-workflow` tool call.
- **Fix:** Framework needs a PreToolUse hook that blocks Edit/Write when no session contract exists for the current session.

### F3: create-skill never formally invoked (AP-27)
- **Domain:** agent-specific
- **Severity:** medium
- **Description:** Agent read `create-skill/SKILL.md` but never invoked the skill through the framework's skill-loading mechanism. Work happened without the skill contract being formally active.
- **Evidence:** No `Skill` tool call. No `metadata.skill: "create-skill"` in any task graph.
- **Fix:** Agent should invoke route-workflow → load create-skill → execute.

### F4: Question fatigue — 4 open questions + repeated "what next"
- **Domain:** agent-specific + framework-specific
- **Severity:** high
- **Description:** Agent asked 4 open questions in first response (scope, granularity, maintenance, schema). After user said "improve it", agent built the skill but then asked "what next?" repeatedly. User explicitly said "STOP ASKING ME CRAZY QUESTIONS".
- **Evidence:** Transcript shows: "Open Questions to Sharpen This" section, then "Next:" trailers with questions 4+ times.
- **Fix:** Framework needs a steering rule: when user says "improve it" / "proceed" / "do it" / "go", agent must act decisively without further questions. Question-asking is a taste decision, not a mechanical requirement.

### F5: Setup script not run
- **Domain:** agent-specific
- **Severity:** medium
- **Description:** `create-skill/SKILL.md` Step 7 requires running `./setup --host <host>` to symlink the new skill. This was skipped.
- **Evidence:** No `./setup` invocation in session. Skill exists in repo but is not installed to host skills directory.
- **Fix:** Run `./setup --host kimi` now.

### F6: No eval created
- **Domain:** agent-specific
- **Severity:** low
- **Description:** `create-skill/SKILL.md` recommends creating a tier-2 eval scenario. Not created.
- **Evidence:** No eval file under `test-framework/evals/tier-2/scenarios/`.
- **Fix:** Create eval if skill is promoted to permanent.

## Framework Gaps For evolve-framework

1. **Session-contract auto-write hook:** First message in a session must auto-write `.svc/session-contract.jsonl` if no entry exists with timestamp within 1 hour. Mechanical, not agent discipline.

2. **PreToolUse guard for unrouted sessions:** Block Edit/Write/Bash tool calls when the current session has no active contract and no lane-tasks file. Force route-workflow invocation first.

3. **Question-fatigue steering rule:** Add to `rules/` or AGENTS.md: "When the user responds to a proposal with 'improve it', 'proceed', 'do it', 'go', 'ship it', or similar imperative — the agent must act decisively. Do not ask follow-up questions. Make reasonable defaults and execute."

4. **On-demand skill creation lane:** There is no framework lane for "user asks for a new skill." It falls through to direct request handling. Consider adding a `framework` lane path or a `create-skill` quick-path in route-workflow.

## Non-Framework Corrections

- **F3 (AP-27):** Agent should have loaded create-skill via route-workflow. This is agent execution failure.
- **F5 (setup script):** Agent should have run `./setup --host kimi` after creating the skill. Mechanical checklist item, simply missed.
- **F6 (eval):** Agent skipped optional step. Low severity.

## Immediate Actions

1. Run `./setup --host kimi` to install the skill
2. Write session contract retroactively for this session
3. Log routing decision retroactively to pipeline-decisions.jsonl

## Confidence

**high** — transcript is the primary source and is complete. All artifacts are on disk and verifiable. No missing evidence.
