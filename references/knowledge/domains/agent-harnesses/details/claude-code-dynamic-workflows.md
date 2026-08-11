# Claude Code — Dynamic Workflows (research preview, launched 2026-05-28)

Layer 3 extraction. Sources: official launch blog (2026-05-28), engineering deep-dive "A harness for every task" (2026-06-02, Thariq Shihipar + Sid Bidasaria), official docs (`code.claude.com/docs/en/workflows.md`, `agents.md`, `whats-new/2026-w22.md`), community-archived product SKILL.md (peymanvahidi/awesome-claude-dynamic-workflows), Benjamin Stein's 484-agent case study (2026-05-29), HN launch thread (200 pts, Boris Cherny + Jarred Sumner participating), @trq212 X post (9.8K likes). Full verbatim record: `docs/specs/research-raw-claude-code-dynamic-workflows.md`.

## Mechanism

### What it is

A dynamic workflow is a **plain-JavaScript orchestration script that Claude writes for your task**; a runtime executes it **in the background** (session stays responsive) and the script — not Claude's turn-by-turn judgment — holds the loop, branching, and intermediate results. Claude's context receives only the final answer. Scale: dozens to hundreds of agents per run (vs "a few" for subagents). Shipped in the Opus 4.8 release week (Claude Code v2.1.150–157; requires **v2.1.154+**).

Anthropic's framing: the default Claude Code harness is a coding harness; classes of tasks (research, security analysis, code review, agent teams) previously needed hand-built custom harnesses. Workflows let Claude **write the custom harness on the fly** ("a harness for every task"). Boris Cherny's differentiation vs agent teams: "1. Support for 1-2 OOMs more agents ... 2. A phased, semi-structured approach where work happens in steps."

### Why (failure modes it targets)

Single-context long tasks degrade via three named failure modes (engineering blog):
1. **Agentic laziness** — declaring done after partial progress (e.g. 35 of 50 security-review items).
2. **Self-preferential bias** — Claude prefers its own findings when verifying/judging them.
3. **Goal drift** — loss of fidelity across turns, especially post-compaction ("each summarization step is lossy").

Isolated subagent contexts with focused goals + deterministic script control combat all three. Verification is first-class: "agents address the problem from independent angles, other agents try to refute what they found, and the run keeps iterating until the answers converge."

### Availability and gating

| Aspect | State (2026-06-07 docs) |
|---|---|
| Status | Research preview |
| Version | Claude Code **v2.1.154+** |
| Plans | **All paid plans** (docs; launch blog said Max/Team/Enterprise-admin). **Pro: opt-in** via `/config` → Dynamic workflows row. Max/Team/API: **on by default**. Enterprise: **off by default** at launch, admin-enabled |
| Providers | Anthropic API, Amazon Bedrock, Google Vertex AI, Microsoft Foundry |
| Surfaces | CLI, Desktop app, IDE extensions, `claude -p` (headless), Agent SDK |
| Disable | `/config` toggle · `"disableWorkflows": true` in `~/.claude/settings.json` · `CLAUDE_CODE_DISABLE_WORKFLOWS=1` · org managed settings / admin page. Disabling removes bundled commands, the keyword trigger, and `ultracode` from `/effort` |
| Billing | Runs count toward plan usage/rate limits. Anthropic paused the separately metered Agent SDK credit change; as of 2026-07-15 `claude -p`/Agent SDK usage still draws from subscription limits. Re-check `details/anthropic-agent-sdk-credit-2026-06-15.md` before routing on billing. |

### Triggering (strict opt-in contract)

The product SKILL.md is explicit: "ONLY call this tool when the user has explicitly opted into multi-agent orchestration ... the user must request that scale, not have it inferred. ... a task that would merely benefit from a workflow does not count." Opt-in paths:
1. Keyword **`ultracode`** in the prompt (highlighted in input; **before v2.1.160 the keyword was `workflow`** — renamed after community pushback that "workflow" is too generic; Option+W / Alt+W dismisses; keyword trigger can be disabled in `/config`). Natural-language asks ("use a workflow", "fan out agents") work in both versions.
2. **`/effort ultracode`** — session-scoped setting = `xhigh` reasoning effort + standing opt-in: Claude plans a workflow for every substantive task ("token cost is not a constraint"; multi-phase work becomes several workflows in sequence: understand → design → implement → review). Only on `xhigh`-capable models. Resets each session.
3. A skill/slash command whose instructions call Workflow.
4. Running a named/saved or bundled workflow (e.g. `/deep-research`).

Approval UX: first trigger shows planned phases + options (Yes / Yes-don't-ask-again-for-this-workflow-in-this-project / View raw script / No); `Ctrl+G` opens script in editor; `Tab` edits the prompt. Permission-mode matrix: default & acceptEdits → prompt every run unless per-project consent; **auto → first launch only** (consent recorded in user settings; skipped entirely under ultracode); bypass / `claude -p` / SDK → never prompts. Desktop: approval card (Once/Always/Deny), progress in Background-tasks pane. Launch blog recommends **auto mode** for best experience.

Security model: spawned subagents **always run in `acceptEdits`** and inherit the session tool allowlist regardless of session mode; file edits auto-approved; non-allowlisted shell/web/MCP calls can still prompt mid-run (pre-allowlist before long runs).

### Runtime API (from the archived product SKILL.md)

Script protocol: passed inline via `script` param; every invocation persists the script to a file under `~/.claude/projects/<session>/` and returns the path; iterate by editing the file and re-invoking with `{scriptPath}`. Tool returns immediately with a task ID; `<task-notification>` on completion. Script must start with a **pure-literal** `export const meta = {name, description, whenToUse?, phases?}` (phase titles matched exactly to `phase()` calls; per-phase `model` display field).

| Primitive | Contract |
|---|---|
| `agent(prompt, opts?)` | Spawns a subagent ("boots a fresh Claude with its own context, shell, and tools"). Returns final text, or with `schema` (JSON Schema) forces a StructuredOutput tool call and returns the **validated object** (validation at tool-call layer, model retries on mismatch). Returns `null` if user skips the agent mid-run. Opts: `label`, `phase` (explicit progress-group, avoids races inside pipeline stages), `schema`, `model` (override; **default = inherit session model**, "almost always correct"), `isolation:'worktree'` (fresh git worktree, "EXPENSIVE (~200–500ms setup + disk per agent)", only for parallel file mutation; auto-removed if unchanged), `agentType` (custom subagent types e.g. `Explore`, `code-reviewer`, resolved from the same registry as the Agent tool) |
| `pipeline(items, stage1, stage2, ...)` | **The DEFAULT for multi-stage work.** Each item flows through stages independently — NO barrier ("Item A can be in stage 3 while item B is still in stage 1"; wall-clock = slowest single-item chain). Stage callbacks receive `(prevResult, originalItem, index)`. A throwing stage drops that item to `null` and skips its remaining stages |
| `parallel(thunks)` | **A BARRIER** — awaits all thunks. Never rejects; errored thunks become `null` (`.filter(Boolean)`). Use ONLY when a step genuinely needs ALL prior results together (dedup/merge, zero-count early-exit, cross-item comparison prompts) |
| `phase(title)` / `log(msg)` | Progress grouping in `/workflows` UI / narrator lines above the progress tree |
| `args` | Caller-passed value, verbatim global (structured JSON, not stringified). Parameterizes saved workflows |
| `budget` | `{total, spent(), remaining()}` bound to the user's **`+500k`-style token directive**. Shared pool across main loop + all workflows. **HARD ceiling: `agent()` throws once spent ≥ total.** Idioms: `while (budget.total && budget.remaining() > 50_000)`, fleet sizing `Math.floor(budget.total / 100_000)` |
| `workflow(nameOrRef, args?)` | Nested sub-workflow (saved name or `{scriptPath}`); shares concurrency cap, agent counter, abort signal, and budget; **one nesting level only** |

Language constraints: **plain JavaScript, NOT TypeScript** (annotations fail to parse); async body (`await` directly); standard built-ins available EXCEPT **`Date.now()` / `Math.random()` / argless `new Date()` which throw — they would break deterministic resume**; no filesystem or Node.js API access from the script (agents do all I/O); MCP tools reachable per-agent via ToolSearch (interactively-authenticated servers may be absent headless).

Hard limits: concurrency `min(16, cpu cores − 2)` per workflow (excess queues); **1,000 agents total per run** (runaway backstop); a single `pipeline()`/`parallel()` call accepts at most **4,096 items** (explicit error, not silent truncation — verified against the live v2.1.16x tool schema, 2026-06-07); no mid-run user input (stage sign-off = run each stage as its own workflow).

### Resume semantics

Runtime journals each agent result. `/workflows` → `p` pauses/resumes; completed agents return **cached results**, rest run live. Tool result includes a `runId`; relaunch with `{scriptPath, resumeFromRunId}` replays the **longest unchanged prefix** of `agent()` calls from cache (same script + same args → 100% cache hit) — enables iterative workflow development (edit the tail, keep the prefix). Determinism bans exist to protect this. Per docs: resume works **within the same Claude Code session**; exiting Claude Code mid-run = next session starts fresh (engineering blog phrases it more generously — "quitting the terminal, resuming the session will allow the workflow to pick up" — treat docs as canonical; fallback: hand-author a continuation script from `agent-<id>.jsonl` files in the transcript directory).

### Saving, reuse, distribution

`/workflows` → select run → `s`: save to `.claude/workflows/` (project-shared) or `~/.claude/workflows/` (personal); runs as `/<name>`; project shadows personal on name collision. Saved workflows accept `args`. Bundled: **`/deep-research <question>`** (fan-out searches → fetch → cross-check → **vote per claim** → cited report with non-surviving claims filtered; requires WebSearch tool). Distribution via skills: put workflow JS files in the skill folder, reference from SKILL.md, "prompt Claude to think of the workflows in the skill as a template instead of a script that needs to be run verbatim."

### Orchestration pattern catalog

From the engineering blog (6 named) + product SKILL.md (quality patterns):
- **Classify-and-act** — classifier agent routes work (also: model/intelligence routing — classifier researches task complexity, routes Sonnet vs Opus).
- **Fan-out-and-synthesize** — split → per-step agents → synthesize (the synthesize step is a barrier).
- **Adversarial verification** — per finding, spawn N independent skeptics "each prompted to REFUTE. Kill if majority refute"; SKILL.md sample prompt: "Default to refuted=true if uncertain."
- **Perspective-diverse verify** — distinct lenses (correctness/security/perf/repro) instead of N identical refuters; "diversity catches failure modes redundancy can't."
- **Generate-and-filter** — generate ideas → rubric/verification filter → dedupe.
- **Tournament / judge panel** — N competing attempts, pairwise judging ("comparative judgment is more reliable than absolute scoring"); judge panel synthesizes from winner while grafting runner-up ideas.
- **Loop until done / loop-until-dry** — unknown-size discovery; stop after K consecutive empty rounds ("simple counters miss the tail"). Convergence trap documented: dedup vs **seen**, not confirmed, else judge-rejected findings reappear forever.
- **Multi-modal sweep** — parallel agents each searching a different way (by-container/content/entity/time).
- **Completeness critic** — final agent asks "what's missing"; findings feed the next round.
- **Quarantine** (triage) — agents reading untrusted public content are barred from high-privilege actions; separate acting agents take them.
- **No silent caps** — `log()` whatever coverage was dropped (top-N, sampling) — "silent truncation reads as 'covered everything'."
- **Hybrid scouting** — scout inline first to discover the work-list, then pipeline over it ("you don't need to know the shape before the task — only before the orchestration step").
- Canonical single-phase shapes: Understand (parallel readers → structured map), Design (judge panel → scored synthesis), Review (dimensions → find → adversarially verify), Research (multi-modal sweep → deep-read → synthesize), Migrate (discover sites → transform each w/ worktree isolation → verify).

### Flagship case studies (with numbers)

**Bun Zig→Rust port (Jarred Sumner):** ~750,000 lines of Rust, 99.8% of existing test suite passing, **11 days first commit → merge**. Sequence: workflow 1 mapped the right Rust lifetime for every struct field in the Zig codebase → workflow 2 wrote every `.rs` file as a behavior-identical port of its `.zig` counterpart ("hundreds of agents in parallel with **two reviewers on each file**") → fix loop drove build + tests clean → post-land overnight workflow eliminated unnecessary data copies, **one PR per fix**. Not yet in production. Jarred on HN: "It feels more like a bespoke build system for the specific task/project than prompting a freeform chat."

**isitchristmas.com rebuild (Benjamin Stein, 2026-05-29):** 121 voting algorithms each written by its own agent + wave-2 review of **363 agents (3 per algorithm)** = **484 agents, 16M+ tokens, $85**. Verification design: a 148,488-date test suite written BEFORE the swarm; each agent's prompt embedded the loop "run it against the test suite, fix what fails, and don't report back until it's green" (each subagent has its own shell); Coordinator re-ran the full suite after all self-reports; the adversarial review wave **caught a bug the test suite missed** (hash-table algorithm valid only to year 2200). 115/121 passed first try; nastiest first-pass bug: Rata Die constant off by one (719163 vs 719162) shifting ~20K far-eastern-timezone dates.

**Anthropic-internal:** dead-code discovery/cleanup beyond static analysis (Alessio Vallero quote); "fill the gap between firing off a single subagent and building out a full agent team" (Ken Takao quote).

## Analysis

### Comparison table (docs-canonical)

| | Subagents | Skills | Agent teams | **Workflows** |
|---|---|---|---|---|
| What it is | Worker Claude spawns | Instructions Claude follows | Lead supervising peer sessions | **Script the runtime executes** |
| Who decides next | Claude, turn by turn | Claude, following prompt | Lead agent | **The script** |
| Intermediate results | Claude's context | Claude's context | Shared task list | **Script variables** |
| Repeatable unit | Worker definition | Instructions | Team definition | **The orchestration itself** |
| Scale | Few per turn | Same | Handful of peers | **Dozens to hundreds per run** |
| Interruption | Restarts turn | Restarts turn | Teammates keep running | **Resumable in-session** |

### When to use / when not (synthesis across sources)

USE: job outgrows a handful of subagents; findings need cross-verification (audits, security sweeps); 500-file/large migrations; cross-checked research; plans drafted from several angles; high-cost-of-wrong-answer work; qualitative sorting at scale (1000+ rows via pairwise tournament — absolute scoring degrades); rule-adherence verification (one verifier per rule + skeptic persona); root-cause investigation (hypotheses from disjoint evidence facing refuter panels); backlog triage (+ `/loop` for continuous, `/goal` for hard completion); evals; non-technical work (resume ranking, business-plan teardown, Slack mining).

DON'T: "most traditional coding tasks do not need a panel of 5 reviewers" (Anthropic's own words); anything where the steps can be pre-specified (MindStudio's test: "If I sat down and thought carefully, could I specify the steps in advance?"); repetitive production pipelines wanting cost predictability; tasks needing mid-run human redirection (no mid-run input by design). MindStudio's guardrail framing is sound: explicit budgets/step limits as circuit breakers, never trust self-termination without a verification step, static-before-dynamic.

### Community reception and risks

- **Token-burn skepticism is the dominant critique** (HN: "tokenmaxxing disguised as a product"). Counterpoint in-thread: thorough verification requires the compute; Anthropic's mitigations: small-slice gauging, per-agent token visibility in `/workflows`, hard `budget` ceilings, 16/1000 caps, prompt-level budgets ("use 10k tokens").
- **Naming collision**: Cloudflare shipped a same-named "dynamic workflows" the same month; `workflow` keyword being generic caused real conflicts → renamed to `ultracode` in v2.1.160. (Same week, `/code-review`, MessageDisplay hook, auto-loaded `.claude/skills` plugins shipped — w21/w22 digests.)
- **Unverified negative claim** (HN, vld_chk): that the Bun Rust port became unmaintainable and led the team to stop supporting the tool — no corroboration found in this extraction; treat as rumor. Officially "not yet in production."
- **MindStudio mechanics mismatch**: its description (single model instance reasoning end-to-end, accumulating context) contradicts the shipped architecture (deterministic script + isolated subagent contexts + script-variable state). Its when-to-use heuristics remain useful; its mechanics should NOT be cited.

### Relevance to svc

- **Architecture convergence**: the workflow primitives map 1:1 onto svc concepts — adversarial verify ≈ review-cross-model/review-exec; loop-until-dry ≈ coverage gates; completeness critic ≈ audit-implementation; quarantine ≈ untrusted-content rule (AP-25); no-silent-caps ≈ svc's honest-coverage doctrine; judge panel ≈ explore-solutions. svc's pipeline could DELEGATE fan-out-heavy stages (audits, migrations, research) to a native workflow instead of sequential subagent dispatch — the deterministic-script property aligns with svc's "deterministic development" doctrine better than turn-by-turn orchestration.
- **`/deep-research` overlaps** the svc `research`/`deep-research` skills; the bundled workflow requires WebSearch and runs vote-per-claim cross-checking — comparable to svc's adversarial verification ambitions but without provenance hashing/knowledge persistence (svc's moat).
- **Distribution path**: workflows distributed via skills (JS in skill folder, referenced from SKILL.md, treated as templates) is directly actionable for svc skill packaging.
- **Caps matter for planning**: 16-concurrent/1,000-total and `budget` hard ceilings should inform any svc workflow-backed lane design. Headless usage still needs ceilings because it consumes the shared subscription allowance; the separate Agent SDK credit change is paused as of 2026-07-15.
- **Determinism bans** (`Date.now()`/`Math.random()` throw) are a portable lesson for svc's own resumable-orchestration designs.

## L4 Pointers

- Raw verbatim extraction (13 URL blocks, coverage table): `docs/specs/research-raw-claude-code-dynamic-workflows.md`
- Prescope manifest + sub-agent failure record: `docs/specs/research-prescope-claude-code-dynamic-workflows.md`
- Official docs (canonical, Mintlify .md endpoints): `https://code.claude.com/docs/en/workflows.md`, `agents.md`, `whats-new/2026-w22.md`; changelog v2.1.150+
- Archived product SKILL.md (full API + worked code patterns): `https://github.com/peymanvahidi/awesome-claude-dynamic-workflows` → `dynamic-workflows-skill/SKILL.md`
- Launch blog: `https://claude.com/blog/introducing-dynamic-workflows-in-claude-code`; engineering deep-dive: `https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code` (X mirror: x.com/i/article/2061850535708483585 via @trq212, inaccessible 2026-06-07)
- Case study w/ working swarm code: `https://benjaminste.in/blog/2026/05/29/building-isitchristmas/` (author notes his "internal" workflow scripts are in the site repo)
- HN launch thread (Cherny/Sumner comments, criticism record): `https://news.ycombinator.com/item?id=48311705`
- Companion harness knowledge: `details/claude-code.md` (general harness), `details/anthropic-agent-sdk-credit-2026-06-15.md` (billing boundary)
- Jarred Sumner's fuller X thread on the Bun port: referenced by the engineering blog ("read more in Jarred's X thread") — not yet extracted; future-work pointer
