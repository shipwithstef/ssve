---
name: audit-session-execution
version: "1.0"
description: >
  Use when auditing how a real session, WI, or pipeline run actually unfolded
  versus how svc expected it to unfold. Triggers on "audit this session",
  "replay this WI", "compare what happened vs what should have happened",
  "read the audit log/transcript", "analyze the prompt and why the agent
  drifted", "session post-mortem", "execution forensics", "why did this run
  go wrong", "audit the prompt and logs", or when a concrete conversation/log/
  task-graph should be turned into framework evidence before `evolve-framework`.
phases:
  - id: P1-AuditTargetResolution
    trigger: always
    reads: ["task request", ".svc/session-contract.jsonl", ".svc/lane-tasks-*.json", ".svc/pipeline-decisions.jsonl"]
    writes: [".svc/audit-session-target.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-HarnessModelProfile
    trigger: always
    reads: ["session evidence", "references/model-routing.md", "references/benchmark-findings.md"]
    writes: ["proposals/<date>-session-audit-<slug>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-ExpectedContractReconstruction
    trigger: always
    reads: ["skills/route-workflow/SKILL.md", "target WI", ".svc/lane-tasks-<WI>.json", "skill contracts"]
    writes: ["proposals/<date>-session-audit-<slug>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ActualExecutionTimeline
    trigger: always
    reads: ["task graph", "decision log", "runtime proof artifacts", "host traces"]
    writes: ["proposals/<date>-session-audit-<slug>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ForensicAntiPatternSweep
    trigger: always
    reads: ["actual execution timeline", "references/context-budget.md", "anti-pattern checks"]
    writes: ["proposals/<date>-session-audit-<slug>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-FaultDomainReport
    trigger: always
    reads: ["findings", "FRAMEWORK-STATE.md", "landing-state evidence"]
    writes: ["proposals/<date>-session-audit-<slug>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-SelfVerifyContinuation
    trigger: always
    reads: ["proposals/<date>-session-audit-<slug>.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/router-context.md", artifact: router-context }
    - { path: "docs/specs/work-items/WI-*.md", artifact: work-item }
    - { path: ".svc/lane-tasks-*.json", artifact: lane-task-graph }
    - { path: ".svc/pipeline-decisions.jsonl", artifact: pipeline-decision-log }
    - { path: "~/.codex/history.jsonl", artifact: codex-history }
    - { path: "~/.codex/session_index.jsonl", artifact: codex-session-index }
    - { path: "~/.claude/sessions/*.json", artifact: claude-session }
    - { path: "~/.claude/projects/**", artifact: claude-project-trace }
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
    - { path: "references/model-routing.md", artifact: model-routing }
    - { path: "references/benchmark-findings.md", artifact: benchmark-findings }
outputs:
  produces:
    - { path: "proposals/<date>-session-audit-<slug>.md", artifact: session-audit-report }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Audit Session Execution

You are turning a real run into framework evidence. This skill is not for
generic code review and not for implementation correctness alone. Its job is
to reconstruct what happened, compare it to what the framework expected, and
separate three things cleanly:

1. project-specific mistakes
2. agent execution mistakes
3. framework contract gaps

**Announce at start:** "I'm using audit-session-execution to compare actual session behavior against the expected svc contract."

## When To Use

Use this skill when the source of truth is a real session:

- a WI that felt messy or drifted
- a conversation where the user had to correct the agent repeatedly
- a task graph that says one thing while the transcript says another
- an audit log or decision log that feels incomplete
- a prompt that should have routed one way but went another
- a suspected token/context failure mode that needs evidence, not vibes
- **no explicit target provided** → the skill auto-resolves the current session (see "No-Argument Default" below)

Do NOT use this skill when:

- you only need to check whether code is correct against a spec → use `audit-implementation`
- you only need to review a diff or artifact gate → use `review-gate`
- you already know the framework gap and want to land the fix → use `improve-framework`

## Scope

The unit under audit is one concrete run:

- one WI
- one task graph
- one session
- or one narrow bundle of consecutive sessions on the same item

If the evidence spans multiple unrelated WIs, split the audit. A broad "the
framework feels off lately" complaint is for `evolve-framework`, not this skill.

### No-Argument Default

When invoked without an explicit WI, session path, or target description, this
skill **must** resolve the audit target from the current runtime context rather
than asking the user. The resolution order is:

1. Read `.svc/session-contract.jsonl` (most recent line). If `wi` is set, use
   that WI as the target.
2. Else, list `.svc/lane-tasks-*.json` files sorted by `mtime` descending.
   The most recently touched file's WI is the target.
3. Else, read `.svc/pipeline-decisions.jsonl` — the most recent decision with
   a `wi` field sets the target.
4. Else, fall back to the current working directory repo name + today's date
   as a session-boundary audit.

The resolved target must be stated in the one-line target sentence before
proceeding to Step 1.5.

## Evidence Order

Load evidence in this order. Do not start with the transcript if stronger
artifacts already exist.

1. User prompt or problem statement for the run
2. `docs/specs/project-state.md`
3. `docs/specs/router-context.md`
4. Target WI file(s)
5. `.svc/lane-tasks-<WI>.json`
6. `.svc/pipeline-decisions.jsonl`
7. Runtime proof artifacts referenced by the WI (E2E specs, review notes, verify-promotion evidence)
8. Host-side session trace discovery (MANDATORY before declaring transcript unavailable)
9. Transcript / conversation log if available
10. `FRAMEWORK-STATE.md` only after the run has been reconstructed

Why this order matters:
- WI + task graph tell you the intended contract faster than chat does
- transcript alone is noisy and can over-weight what was merely said
- host traces often exist even when no transcript was explicitly attached
- framework memory comes last so it doesn't pre-bias the diagnosis

## Process

### 1. Define the audit target

Write a one-line target sentence:

> "Audit WI-064 shift-swap session on 2026-04-17 across WI file, lane task graph, decision log, security review, E2E, and transcript excerpt."

If no explicit target was provided, apply the **No-Argument Default** resolution
above and write the target sentence from the resolved WI/session. If the target
is ambiguous even after resolution, narrow it before reading more files.

### 1.5. Harness and Model Profiling

Before judging the agent's execution, identify the constraints of its environment:
- **Harness:** Identify the host (Claude Code, Sweep, Antigravity, Aider, CLI MCP, etc.)
- **Model Classification:** Identify the model used (Claude 3.5 Sonnet, Haiku, Opus, Gemini 1.5 Pro, etc.)
- **Capability Rules:** Read `references/model-routing.md` and `references/benchmark-findings.md`.

**Research Fallback:** If the harness, model type, or specifically applied workflow technique is undocumented in the framework artifacts, you MUST pause and invoke the `research` skill to systematically analyze external web benchmarks and techniques BEFORE passing judgment. Ignorance of a new capability is not an excuse for poor auditing.

Determine if the model had the required reasoning tier for the requested task. For example, trusting Haiku with an architectural refactor (`explore-solutions`) is a routing failure, not an execution failure. Mapping the model tier prevents placing the blame for inherent model limitations on "agent execution".

### 2. Build the expected contract

Reconstruct what **should** have happened from the framework and repo contract:

- repo mode and routing expectation
- expected lane
- required skills and mandatory inserts
- required verification tier
- required output artifacts
- required close-out obligations

**Translation Fidelity Audit:** Calculate a **Translation Fidelity Score** (0-100%) for the transition into this run (e.g., Tech Design → Plan → Code). If a constraint was defined in the source artifact but omitted in the target execution plan, record the drop and score it.

This expected contract must cite exact sources:

- `skills/route-workflow/SKILL.md`
- repo `router-context.md`
- relevant skill contracts
- WI acceptance criteria / lane task graph

Do not use memory. Reconstruct it from files.

### 3. Reconstruct the actual execution

Build the actual sequence from strongest to weakest evidence:

- task graph state changes
- decision log entries
- files created or updated
- review artifacts
- transcript actions and user corrections

For each step, write:

- what happened
- what evidence proves it

### 3.5. Mid-Task Correction Overreaction Check

If `.svc/lane-tasks-<WI>.json` contains `mid_task_hints[]`, compare each hint
to the artifacts created after its timestamp. A `method-correction` with
`new_artifacts_allowed: false` should produce a small method swap, not a new
spec, new lane, new WI, or broad plan. Flag **artifact-count overreaction** when
the actual artifacts are materially larger than the recorded
`applied_method_swap`, and cite the hint entry plus the file list.
- whether it matched the expected contract

### 4. Run the multi-lens audit

Score the run across these dimensions:

| Dimension | Question |
|---|---|
| Prompt fidelity | Did the agent actually solve the user's stated problem? |
| Routing correctness | Was the right entry skill/lane chosen? |
| Contract compliance | Were required skills, gates, and inserts actually followed? |
| Skill-loading discipline | Did work happen only after the named skill contract was loaded? |
| Verification sufficiency | Did runtime proof match the blast radius and lane rules? |
| Review discipline | Did review/security/audit steps happen at the right depth and order? |
| User-handoff discipline | Was the user only asked for things the framework could not discover or execute? |
| Audit/log completeness | Do lane-tasks, decision log, and artifacts tell a coherent story? |
| Token/context efficiency | Did the run waste context, over-read docs, or rewrite whole files unnecessarily? |
| Capability gaps | Was the agent forced into a fragile workaround because a specific skill, tool, or MCP was missing? |
| Workflow Phase gaps | Did the agent perform ad-hoc planning or exploratory work that should have been formalized into a lane phase? |
| Systemic Opportunities | Is there a structural bottleneck or overhead action in this session that slows down iteration? |
| Safety/Governance Audit | Did the agent trigger a project policy or host-side hook? Did it attempt a bypass via an alternative tool or shell? |
| Harness Efficiency Audit | Did the agent exhibit platform-specific waste: Claude "Idle MCP Bloat" or Gemini "Cache Layer Drift/Chapter Misalignment"? |
| Framework gap extraction | Are there repeatable framework enforcement actions needed to block these mistakes? |

Use one of:
- `PASS`
- `WARN`
- `FAIL`

Every non-PASS needs evidence.

### 4.5 Resolve host-side trace evidence before calling it unavailable

Before you mark transcript/session evidence unavailable, search the host traces
that exist on this machine.

Minimum search contract:

- **Codex:** `~/.codex/history.jsonl`, `~/.codex/session_index.jsonl`
- **Claude:** `~/.claude/sessions/*.json`, `~/.claude/projects/**`
- **Gemini:** `~/.gemini/tmp/<project_hash>/chats/`, `~/.gemini/tmp/<project_hash>/shell_history`

Search keys:

- repo cwd or repo name
- WI id
- date of the run
- distinctive user prompt fragments
- relevant skill names when the session was skill-driven

If a match is found, cite the path in the Evidence Inventory and use it for
transcript-sensitive judgments.

If no match is found, say so explicitly in the report:

- `Transcript status: auto-discovered`
- `Transcript status: searched host traces, none matched`
- `Transcript status: intentionally omitted by scope`

Do not write "unavailable" unless the host-trace search was attempted first.

### 5. Deep Context & Capability Analysis

First, carefully analyze **token execution efficiency**. Token claims must be tagged as one of:

- `EXACT` — provider/tool exposed actual token counts
- `ESTIMATED` — inferred from artifact size, repeated reads, duplicated dumps, or repeated retries
- `UNKNOWN` — not enough evidence

Proactively hunt for these waste and context-degradation patterns during the audit, referencing the framework's `context-budget.md` standards:
- **Over-reading / Subagent Bleed:** Re-reading unmodified files, scanning entire repos instead of targeted greps, or the orchestrator parsing massive `8000+` token files instead of delegating file paths to subagents.
- **Unconstrained Codebase Scans (AP-4):** Running blanket `grep -R` or `find .` across `src/` without using file-type guards or targeting specific directories (inevitably creating context avalanches).
- **Untrusted Content Ingestion (AP-25):** Failing to wrap raw web search data, external docs, or fetched pages in `<untrusted_content>` tags, leading to cross-context poisoning or hijacked LLM attention.
- **Over-writing:** Rewriting entire files via chat output instead of surgically using `multi_replace_file_content` or native tools.
- **Idle MCP Bloat:** Leaving heavy MCP servers active when a simple CLI call (`gh`, `stripe`, standard bash) would suffice, permanently inflating context window.
- **Missing Context Compression (Gemini):** Forgetting to use `/compress` or relying too heavily on uncompressed narrative chapters, allowing history to silently degrade.
- **Unstructured Output Bloat (Gemini):** Failing to utilize `ui.compactToolOutput` or equivalent native formatting for large file reads and directory listings.
- **Cyclic failure:** Repeating the identical command/reasoning after a constraint failure instead of pivoting.
- **Silent Context Loss & Context Degradation Warning Signs:** The hallmark symptom of a context window expanding past the `GOOD` tier into `DEGRADING` (50-70%) or `POOR` (70%+). Hunt for:
  - Agent completing a task but silently omitting 1-2 spec requirements.
  - Vague instructions replacing early specific ones.
  - Skipped steps in a predefined lane.
  - Recycled regex or code lines from 50k tokens ago applied incorrectly.
  - Spec drift.
- **Unnecessary Broad Searches:** Running heavy research when `project-state.md` or existing `lane-tasks` already possessed the answer.
- **Positional Attention Audit (Doctrine Forensics):** Hunt for the specific "Attention Decay" failure mode: Did the agent correctly execute a Layer 4 task detail but silently violate a constraint loaded at the top of the context (Layer 1 or 2)? If so, the task was likely too large or the attention-reset checkpoint was delayed.
- **Cache Hygiene Check (Doctrine Forensics):** Did the agent load artifacts in the mandatory L1 (Vision/Personas) → L2 (Spec/Design) → L3 (Code) → L4 (Task) order? Reordering or inserting raw content between these layers breaks prefix caching and increases token cost by ~50%+.

Second, analyze **structural capability gaps & opportunities**:
- **Missing Skills/MCPs:** What tool would have solved a messy 5-turn struggle in 1 turn?
- **Missing Knowledge Rules:** What missing global project rule caused the agent to repeatedly make wrong technological assumptions?
- **Missing Workflow Phases:** Was the agent forced to do chaotic, ad-hoc trial and error that should be explicitly codified into a mandatory pipeline phase?
- **Agent friction points:** Is there a systemic opportunity to smooth edge cases (e.g., auto-recovering from git errors)?

Never fabricate exact token counts. You MUST analyze these dimensions even if token claims are merely ESTIMATED.

### 5.5. Forensic Anti-Pattern Sweep

To enforce the `seriousvibecoding` behavioral contracts, you must explicitly cross-check the session execution against these high-severity structural anti-patterns. 
If an agent fails any of these checks, the session MUST be flagged as an **Execution FAIL** for that dimension, and a concrete enforcement constraint must be proposed.

1. **AP-27: "Ghost Skill" Forensics**
   - **Check:** Look at `lane-tasks.json`. Did the task description demand a specific skill `Invoke: /skill-name`, but the agent jumped straight into coding or decision-making without EVER calling the corresponding `Skill tool` or reading `SKILL.md`?
   - **Ruling:** If an agent acts on a skill-driven task without loading the contract first, it is an instant **Contract FAIL**. A task marked complete without the skill loaded is a Ghost Execution.

2. **AP-26: "Skill Substitution" Forensics**
   - **Check:** Did the user explicitly invoke an expansive skill (e.g., `test-journeys`), but the agent executed a much narrower shortcut (e.g., writing a single synthetic jest unit test) and claimed it "fulfilled" the request?
   - **Ruling:** Overriding user choice to take a locally cheaper shortcut that skips framework artifacts (SUMMARY.md, specs, E2E evidence) without surfing the explicit trade-off is an instant **Verification FAIL**.

3. **AP-28: Premature User Handoff Forensics**
   - **Check:** Scan the execution timeline. Did the agent encounter a single E2E failure, complex API error, or mock issue, and immediately bail out by asking the user to "verify manually" or "check on device"?
   - **Ruling:** Unless the requested check was purely aesthetic or blocked by a hard platform constraint, giving up at the first hurdle without exhausting the AI verification ladder (V0 static → V1 DOM → V2 interaction) is a **Verification FAIL**. AI executes; it does not assign its work back to the user.

### 6. Separate fault domains

Every issue must land in exactly one bucket first:

- **project-specific** — repo truth was weird; framework contract was fine
- **agent-specific** — skill existed, contract was clear, agent ignored it
- **framework-specific** — contract missing, ambiguous, contradictory, or unenforced

**CRITICAL SVC PHILOSOPHY:** "Agent ignored it" is not a terminal answer. If an agent-specific failure occurred, it means the framework failed to mechanically enforce the contract. Every agent-specific failure MUST immediately generate a related framework-specific gap requesting concrete mechanical enforcement (a tool hook, a check in a validator script, a required self-verify step). "The agent needs to be more disciplined" is an invalid recommendation. "The framework needs a hook to block completion if log is empty" is a valid one.

Therefore, both framework-specific findings AND mechanical-enforcement proposals for agent-specific faults must feed `evolve-framework`.

### 7. Write the report

Write `proposals/<date>-session-audit-<slug>.md` using this structure:

```markdown
# Session Audit — <slug>

## Scope
<what run was audited and why>

## Evidence Inventory
- prompt / session source
- WI file
- lane task graph
- decision log
- transcript status (`auto-discovered` | `searched host traces, none matched` | `intentionally omitted by scope`)
- runtime proof artifacts

## Expected Contract
<what svc and the repo contract required>

## Actual Execution
<what actually happened, in order>

## Expected vs Actual Matrix
| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|

## Dimension Scores
| Dimension | Score | Evidence | Notes |
|---|---|---|---|

## Token / Context Notes
<exact vs estimated vs unknown>

## Findings
### F1
- Domain: project-specific | agent-specific | framework-specific
- Severity: critical | high | medium | low
- Description:
- Evidence:
- Fix:

## Framework Gaps For evolve-framework
<only framework-specific findings>

## Non-Framework Corrections
<project or agent issues that should not become framework work>

## Confidence
<high / medium / low, and what evidence was missing>
```

## Decision Rules

- If the transcript contradicts the task graph, prefer the artifact with the stronger execution evidence and flag the mismatch
- If the run violated a written contract, do not soften it into "style"
- If the contract was missing or ambiguous, do not blame the agent for guessing
- If the same issue is already fixed in `FRAMEWORK-STATE.md`, mark it "known/fixed" and do not re-propose it

## Landing-State Closeout Gate

Before any final audit verdict says `closed`, `complete`, `verified`, or
equivalent for a session that created or modified repository files, add a
`## Landing-State Verification` section to the report and fill it from current
git evidence. A report can be complete while implementation is not landed; do
not collapse those states.

Minimum evidence:

| Evidence | Command / Source | Required Interpretation |
|---|---|---|
| Worktree cleanliness and upstream alignment | `git status --short --branch` | Empty short status and branch alignment are required for a landed verdict. Any dirty file means verdict `implementation-not-landed`. |
| Current branch | `git branch --show-current` | Must identify whether work is still on a feature/worktree branch or on `main` after landing. |
| PR state when a PR exists | `gh pr status`, `gh pr view <number> --json state,mergedAt,mergeCommit,url` or linked PR artifact | If a PR exists, cite open/closed/merged state. Open or unmerged PR means implementation is not landed. |
| Merge evidence | merge commit SHA, squash commit SHA, or `git log --oneline -1` after merge | A landed verdict needs the commit that reached the target branch. |
| Post-merge validation | command output from the relevant tier-1/full validators after merge | A landed verdict needs validation after the landing point, not only before commit. |

Landing-state verdicts:

| Verdict | Use When |
|---|---|
| `audit-report-complete` | The audit artifact is complete, but it did not involve implementation changes or landing is outside scope. |
| `implementation-not-landed` | Repo files changed but dirty local changes remain, the branch is unmerged, the PR is open, post-merge validation is missing, or upstream alignment is unknown. |
| `implementation-landed-verified` | The implementation commit is on the target branch, PR/merge state is resolved when applicable, the worktree is clean and aligned, and post-merge validation passed. |
| `do-not-land-approved` | The user explicitly approved not landing the implementation; cite the decision-log entry and keep the audit separate from implementation closure. |

If the verdict is `implementation-not-landed`, the recovery text must name the
next concrete action: commit the changes, open a PR, merge/squash-merge to the
target branch, run post-merge validation, or log an explicit user-approved
`do-not-land-approved` decision in `.svc/pipeline-decisions.jsonl`.

## Rationalization Table

| Thought | Reality |
|---|---|
| "The transcript is enough" | It is not. Start from WI + lane-task graph + decision log. |
| "The user corrected it, so that's fine" | A user correction is evidence of drift, not proof the framework worked. |
| "I can estimate tokens exactly from file length" | You cannot. Tag as `ESTIMATED` unless the tool exposed counts. |
| "Everything bad here is a framework gap" | No. Separate project truth, agent failure, and framework failure. |
| "This session felt messy, that's enough" | Feelings are not findings. Every claim needs file or transcript evidence. |
| "I should jump straight to improve-framework" | Not unless the framework gap is already concrete. This skill exists to make it concrete. |

## Red Flags

- Report has no Expected vs Actual matrix
- Token section states exact numbers without a source
- Findings mix project defects and framework defects in one bucket
- Framework gap section repeats something already locked as fixed in `FRAMEWORK-STATE.md`
- Transcript was read first even though WI/task graph existed
- Transcript was marked unavailable without a host-trace search

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Audit target is narrow and concrete | scope section names one WI/session bundle | |
| 2 | Expected contract cites the framework and repo contract | skills/route-workflow/skill/router-context references present | |
| 3 | Expected vs Actual matrix exists | matrix present with evidence column | |
| 4 | Every finding is bucketed into project/agent/framework | no unclassified findings | |
| 5 | Token claims are labeled EXACT/ESTIMATED/UNKNOWN | token section uses only these labels | |
| 6 | Framework gaps exclude already-fixed state entries | checked against `FRAMEWORK-STATE.md` | |
| 7 | Transcript absence was proven, not assumed | report says `auto-discovered` or `searched host traces, none matched` when transcript-sensitive judgments need it | |
| 8 | Output file exists at proposals/<date>-session-audit-<slug>.md | file present | |
| 9 | Final narrative is anchored to the latest artifact | close-out section cites the latest task output, failing assertion, or runtime artifact and does not foreground a superseded blocker | |
| 10 | No-arg target was resolved, not abandoned | if no explicit target: resolution method (session-contract / lane-tasks mtime / decision-log / repo fallback) is stated in scope | |
| 11 | No-arg resolution found at least one artifact | the resolved target yielded a WI file, lane-tasks file, or decision-log entry; pure repo fallback is last resort and noted as low-confidence | |
| 12 | Landing-state gate applied when repo files changed | report has `## Landing-State Verification` with git status, branch, PR state when applicable, merge evidence, post-merge validation, and a landing-state verdict | |

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `audit-session-execution` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-AuditTargetResolution --evidence command_output:.svc/audit-session-target.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-HarnessModelProfile --evidence file:proposals/<date>-session-audit-<slug>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ExpectedContractReconstruction --evidence file:proposals/<date>-session-audit-<slug>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ActualExecutionTimeline --evidence file:proposals/<date>-session-audit-<slug>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ForensicAntiPatternSweep --evidence file:proposals/<date>-session-audit-<slug>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-FaultDomainReport --evidence file:proposals/<date>-session-audit-<slug>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/audit-session-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

- If the report finds **framework-specific** repeatable gaps → route to `evolve-framework`
- If the report only finds project or agent execution issues → route to the corrective skill directly
- If the report already contains a concrete framework proposal or fix-ready file list → route to `improve-framework`

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)

- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not prose
- Update the current task status only after the report file exists and self-verify passes
- If this audit is a precursor task in framework work, the usual next step is `evolve-framework`

## Key Principles

- Reconstruct the contract before judging the execution
- Prefer durable artifacts over chat memory
- Separate framework gaps from agent mistakes
- Token analysis must be honest about uncertainty
- `evolve-framework` builds on evidence, not vibes

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.
