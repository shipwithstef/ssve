# Raw Extraction: Claude Code Dynamic Workflows

**Date:** 2026-06-07
**Extractor:** Claude in-session (recorded gemini-cli mid-run failure; see prescope), with playwright-rendered DOM text + machine-readable endpoints
**Prescope:** `docs/specs/research-prescope-claude-code-dynamic-workflows.md`

All quotes are verbatim from the rendered page text / raw files.

## URL: https://claude.com/blog/introducing-dynamic-workflows-in-claude-code

**Status:** read
**Title:** Introducing dynamic workflows in Claude Code
**Date/Author:** May 28, 2026 — Product announcements, Claude Code. 5 min read.
**Body text (verbatim):**
> "Today we're introducing dynamic workflows in Claude Code, helping Claude take on the most challenging tasks end-to-end. Work you'd normally plan in quarters now finishes in days. Claude dynamically writes orchestration scripts that run tens to hundreds of parallel subagents in a single session, checking its work before anything reaches you."
> "Dynamic workflows are available today in research preview in the Claude Code CLI, Desktop, and the VS code extension for Max, Team, and Enterprise (if admin enabled) plans, as well as on the Claude API, on Amazon Bedrock, Vertex AI, and Microsoft Foundry."
> "Note: Dynamic workflows can consume substantially more tokens than a typical Claude Code session, so we recommend starting on a scoped task to get a feel for usage in your work."
> "For the best experience, turn on auto mode when using dynamic workflows."
> "Switch on a new Claude Code-specific setting called ultracode. This is accessible through the effort menu and it sets the effort level to xhigh, while letting Claude decide automatically when to use a workflow to handle your task."
> "Codebase-wide bug hunts, profiler-guided optimization audits, and security audits: Claude searches a service or repo in parallel, then runs independent verification on every finding so the report surfaces real issues."
> "Critical work you need checked twice: When the cost of a wrong answer is high, a workflow gives Claude independent attempts at the problem and adversarial agents working to break the result before you see it."
> "Dynamic workflows have been especially valuable for discovery and review tasks across large codebases. We've seen strong results using it to identify dead code and surface cleanup opportunities that traditional static analysis missed" — Alessio Vallero, Senior Engineering Manager
> "Dynamic workflows fill the gap between firing off a single subagent and building out a full agent team. Plan to implementation just flows, so we can trust longer runs without losing visibility." — Ken Takao, Lead Systems Engineer
> "Jarred Sumner used dynamic workflows to port Bun from Zig to Rust with 99.8% of the existing test suite passing, roughly 750,000 lines of Rust, and eleven days from first commit to merge."
> "One workflow mapped the right Rust lifetime for every struct field in the Zig codebase. The next wrote every .rs file as a behavior-identical port of its .zig counterpart, hundreds of agents working in parallel with two reviewers on each file. A fix loop then drove the build and test suite until both ran clean. After the port landed, an overnight workflow addressed unnecessary data copies and opened a PR for each for final review. While not yet in production, all of this was handled by dynamic workflows."
> "When a workflow kicks off, Claude plans dynamically based on your prompt, breaks it into subtasks, and fans the work out across subagents running in parallel. Results are checked before they're folded in, and you come back to a single, coordinated answer."
> "Agents address the problem from independent angles, other agents try to refute what they found, and the run keeps iterating until the answers converge—which is how a workflow reaches results a single pass can't."
> "Dynamic workflows are built for parallel and long-running work that can extend into hours and days, doing the most complex engineering work that previously would have taken weeks. Progress is saved as the run goes, so a job that's interrupted picks up where it left off instead of starting over."
> "Because the coordination happens outside the conversation, the plan stays on track no matter how big the task gets."
> "The first time a workflow triggers, Claude Code shows what's about to run and asks you to confirm. Organization admins can also optionally disable workflows through managed settings."
> "If you're on a Max or Team plan, or using Claude Code via the API, dynamic workflows are on by default. ... If you're on an Enterprise plan, dynamic workflows are off by default at launch."
**Full summary:** Launch announcement (May 28, 2026). Defines dynamic workflows as Claude-written orchestration scripts running tens-to-hundreds of parallel subagents in one session with verification before results reach the user. Research preview on CLI/Desktop/VS Code for Max, Team, Enterprise (admin-enabled), plus Claude API, Bedrock, Vertex AI, Microsoft Foundry. Two entry paths: ask directly ("Create a workflow") or `ultracode` setting via effort menu (= xhigh effort + Claude auto-decides workflow use). Use-case classes: codebase-wide bug/security/optimization audits with independent verification per finding; large migrations/modernization (framework swaps, API deprecations, language ports across thousands of files); critical work needing adversarial double-checks. Flagship case study: Bun ported Zig→Rust (99.8% tests passing, ~750K lines Rust, 11 days; lifetime-mapping workflow → per-file behavior-identical port with hundreds of agents + 2 reviewers per file → build/test fix loop → overnight data-copy optimization workflow opening per-fix PRs; not yet in production). Mechanism: dynamic planning → subtask fan-out → checked results → convergence loop ("agents address the problem from independent angles, other agents try to refute"). Progress persists across interruption. First-trigger confirmation prompt; org admins can disable via managed settings. Default-on for Max/Team/API; default-off for Enterprise at launch. Token-usage warning prominent.

## URL: https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code

**Status:** read
**Title:** A harness for every task: dynamic workflows in Claude Code
**Date/Author:** June 2, 2026 — by Thariq Shihipar and Sid Bidasaria, "members of technical staff at Anthropic working on Claude Code"
**Body text (verbatim):**
> "Claude Code can now write and orchestrate its own multi-agent harness on the fly. Here's how dynamic workflows work, and the patterns that get the most out of them."
> "While the default Claude Code harness is built for coding, it is also useful for many other types of tasks because, as it turns out, many tasks resemble coding tasks. But there are certain classes of tasks where we have had to build custom harnesses on top of Claude Code to achieve peak performance such as Research, security analysis, agent teams, or Code Review."
> "Workflows allow you to dynamically create harnesses built on top of Claude Code that enable Claude to solve all of those problems more natively. You can also share and reuse these workflows with others."
> "Dynamic workflows execute a javascript file with a few special functions that help spawn and coordinate subagents" (the function table itself ships as an image — image1.png — not text)
> "Dynamic workflows also include standard JavaScript functions like JSON, Math, and Array, to help process data."
> "It's particularly useful to know that dynamic workflows can decide which models an agent uses and whether subagents are run in their own worktree, allowing Claude to choose the intelligence level and isolation needed."
> "If a workflow is interrupted, for example by user action or quitting the terminal, resuming the session will allow the workflow to pick up where it left off."
> "Agentic laziness refers to when Claude stops before finishing a particularly complex, multi-part task and declares the job done after partial progress, for example addressing 35 of the 50 items in a security review."
> "Self-preferential bias refers to Claude's tendency to prefer its own results or findings, especially when asked to verify or judge them against a rubric."
> "Goal drift refers to the gradual loss of fidelity to the original objective across many turns, especially after compaction. Each summarization step is lossy, and details like edge-case requirements or 'don't do X' constraints can get lost."
> "You may have previously created a static workflow using the Claude Agent SDK or claude -p to coordinate multiple instances of Claude Code together. But because static workflows need to work for all edge cases, they are usually more generic. With Claude Opus 4.8 and dynamic workflows, Claude is now intelligent enough to write a custom harness tailor-made for your use case."
> "You can start using dynamic workflows just by asking Claude to make one, or by using the trigger word 'ultracode' to ensure that Claude Code creates a workflow."
> "Fan-out-and-synthesize: Split up a task into many smaller steps, run an agent on each step and then synthesize those results. ... The synthesize step is a barrier—it waits for all the fan-out agents, then merges their structured outputs into one result."
> "Tournament: Instead of dividing the work, have agents compete on it. Spawn N agents that each attempt the same task using different approaches. Prompts or models then judge the results in a pairwise fashion using a judging agent until you have a winner."
> "Loop until done: For tasks with an unknown amount of work, loop spawning agents until a stop condition is met (no new findings, or no more errors in the logs) instead of a fixed number of passes."
> "Bun was rewritten from Zig to Rust using workflows. You can read more about how that was done in Jarred's X thread."
> "We published a deep research skill (/deep-research) inside Claude Code that uses dynamic workflows. Specifically, it fans-out web searches, fetches sources, adversarially verifies their claims, and synthesizes a cited report."
> "But if you try to sort 1000+ rows in one prompt, quality degrades and it won't fit in context. Instead run a tournament, a pipeline of pairwise-comparison agents (comparative judgment is more reliable than absolute scoring), or bucket-rank in parallel then merge."
> "create a workflow with a list of rules that must be checked by verifier agents—one verifier per rule. Creating a skeptic persona subagent to review the rules to make sure they are in line will help avoid too many false positives."
> "A useful pattern for triage workflows is quarantine. This involves barring the agents that read untrusted public content from taking high-privilege actions, which are instead done by the agents in charge of acting on the information."
> "Pair triage workflows with /loop to have Claude do this continuously."
> "For regular coding tasks, try and ask yourself: does it really need more compute? For example, most traditional coding tasks do not need a panel of 5 reviewers."
> "Workflows are not just for large tasks. You can prompt the model to use a 'quick workflow.' For example, you can create a quick adversarial review of an assumption."
> "When using workflows that can be repeated, for example triage, research, or verification, pair them with /loop to be run at regular intervals, and /goal to set a hard completion requirement."
> "You can set explicit token usage budgets for dynamic workflows to limit how many tokens a task uses. You can prompt it with a budget like: 'use 10k tokens,' which will set the cap."
> "You can save workflows by pressing 's' in the workflow menu. You can check these into ~/.claude/workflows or distribute them via a skill. To share them via a skill, put your JavaScript workflow files in the skill and folder and reference them in the SKILL.MD. To allow for more flexibility, you may want to prompt Claude to think of the workflows in the skill as a template instead of a script that needs to be run verbatim."
**Full summary:** Engineering deep-dive (June 2, 2026) by the feature's builders. Frames workflows as Claude writing a custom harness per task — what previously required hand-built harnesses (research, security analysis, agent teams, code review) now generated on the fly. 8 example prompts (flaky-test race investigation with competing theories; mining last 50 sessions for recurring corrections → CLAUDE.md rules; Slack #incidents 6-month root-cause mining; business-plan teardown from investor/customer/competitor perspectives; 80-resume ranking with top-10 double-check + AskUserQuestion rubric interview; CLI-name brainstorm + tournament; codebase-wide rename; blog-draft claim verification against codebase). Mechanics: JS file with special spawn/coordinate functions (table shipped as image), standard JS built-ins, per-agent model choice + optional worktree isolation, resume after interruption including terminal quit. Rationale: three single-context failure modes — agentic laziness, self-preferential bias, goal drift (compaction-lossy) — combated via isolated subagent contexts. Dynamic vs static: Agent SDK / claude -p harnesses are generic; Opus 4.8 writes tailor-made ones. Six named patterns: Classify-and-act, Fan-out-and-synthesize (synthesize = barrier), Adversarial verification, Generate-and-filter, Tournament (pairwise judging), Loop until done. Use cases incl. migrations (Bun; per-fix worktree subagent + adversarial reviewer + merge; avoid resource-intensive commands to maximize parallelism), /deep-research, deep verification (per-claim subagents + source-quality checker), sorting at scale, memory/rule adherence (one verifier per rule + skeptic persona; reverse: mine sessions → cluster → adversarially verify → distill into CLAUDE.md), root-cause investigation (hypotheses from disjoint evidence — logs/files/data — facing verifier+refuter panels; also sales/data post-mortems), triage at scale (classify→dedupe→act; quarantine pattern for untrusted content; pair with /loop), exploration/taste with rubric review agents, lightweight evals (worktree variants + comparison agents), model/intelligence routing (classifier agent routes Sonnet vs Opus based on expected complexity). When NOT: most coding tasks don't need 5-reviewer panels; ask "does it really need more compute?". Tips: detailed prompting; "quick workflow" for small adversarial checks; combine /goal + /loop; prompt-level token budgets ("use 10k tokens" sets the cap); save via `s`; check into ~/.claude/workflows or distribute via skills (workflow JS in skill folder, referenced from SKILL.md, treated as template).

## URL: https://code.claude.com/docs/en/workflows.md

**Status:** read
**Title:** Orchestrate subagents at scale with dynamic workflows (official docs, Mintlify .md endpoint)
**Date/Author:** Anthropic Claude Code docs, current as of 2026-06-07
**Body text (verbatim):**
> "Dynamic workflows are in research preview. They require Claude Code v2.1.154 or later and are available on all paid plans, with Anthropic API access, and on Amazon Bedrock, Google Cloud Vertex AI, and Microsoft Foundry. On Pro, turn them on from the Dynamic workflows row in `/config`."
> "A dynamic workflow is a JavaScript script that orchestrates subagents at scale. Claude writes the script for the task you describe, and a runtime executes it in the background while your session stays responsive."
> "Reach for a workflow when a task needs more agents than one conversation can coordinate, or when you want the orchestration codified as a script you can read and rerun."
> "A workflow moves the plan into code. With subagents, skills, and agent teams, Claude is the orchestrator: it decides turn by turn what to spawn or assign next, and every result lands in a context window. A workflow script holds the loop, the branching, and the intermediate results itself, so Claude's context holds only the final answer."
> "it can have independent agents adversarially review each other's findings before they're reported, or draft a plan from several angles and weigh them against each other, so you get a more trustworthy result than a single pass."
> "/deep-research <question> — Fans out web searches on a question across several angles, fetches and cross-checks the sources it finds, votes on each claim, and returns a cited report with claims that didn't survive cross-checking filtered out. Requires the WebSearch tool to be available"
> "To run a single task as a workflow without changing the session's effort level, include the keyword `ultracode` in your prompt. Asking in your own words, for example 'use a workflow' or 'run a workflow', also works ... Before v2.1.160 the literal trigger keyword was `workflow`; natural-language requests work in both versions."
> "Ultracode is a Claude Code setting that combines `xhigh` reasoning effort with automatic workflow orchestration. With it on, Claude plans a workflow for each substantive task instead of waiting for you to ask."
> "A single request can turn into several workflows in a row: one to understand the code, one to make the change, and one to verify it."
> "Ultracode lasts for the current session and resets when you start a new one. Drop back with `/effort high` when you return to routine work. It's available on models that support `xhigh` effort; on other models the `/effort` menu doesn't offer it."
> "Your permission mode controls only the launch prompt above. The subagents the workflow spawns always run in `acceptEdits` mode and inherit your tool allowlist, regardless of your session's mode. File edits are auto-approved."
> "Shell commands, web fetches, and MCP tools that aren't in your allowlist can still prompt you mid-run. To avoid this on a long run, add the commands the agents need to your allowlist before starting."
> "Run `/workflows`, select the run you want to keep, and press `s`. In the save dialog, Tab toggles between the two save locations: `.claude/workflows/` in your project: shared with everyone who clones the repo; `~/.claude/workflows/` in your home directory: available in every project, visible only to you"
> "The workflow runs as `/<name>` in future sessions from either location. If a project workflow and a personal workflow share a name, the project one runs."
> "A saved workflow can accept input through the `args` parameter. The script reads it as a global named `args`. ... Claude passes the list as structured data, so the script can call array and object methods on `args` directly without parsing it first."
> "The workflow runtime executes the script in an isolated environment, separate from your conversation. Intermediate results stay in script variables instead of landing in Claude's context."
> "Every run writes its script to a file under your session's directory in `~/.claude/projects/`. Claude receives the path when the run starts, so you can ask for it. You can open that file to read the orchestration Claude wrote, diff it against a previous run's script, or edit it and ask Claude to relaunch from the edited version."
> "No mid-run user input — Only agent permission prompts can pause a run. For sign-off between stages, run each stage as its own workflow"
> "No direct filesystem or shell access from the workflow itself — Agents read, write, and run commands. The script coordinates the agents"
> "Up to 16 concurrent agents, fewer on machines with limited CPU cores — Bounds local resource use"
> "1,000 agents total per run — Prevents runaway loops"
> "If you stop a run, you can resume it: agents that already completed return their cached results, and the rest run live. ... Resume works within the same Claude Code session. If you exit Claude Code while a workflow is running, the next session starts the workflow fresh."
> "A workflow spawns many agents, so a single run can use meaningfully more tokens than working through the same task in conversation. Runs count toward your plan's usage and rate limits like any other session."
> "To gauge the spend before committing to a large task, run the workflow on a small slice first: one directory instead of the whole repo, or a narrow question instead of a broad one."
> "Every agent in a workflow uses your session's model unless the script routes a stage to a different one."
> "Toggle Dynamic workflows off in `/config`. ... Set `\"disableWorkflows\": true` in `~/.claude/settings.json`. ... Set `CLAUDE_CODE_DISABLE_WORKFLOWS=1`."
> "To turn workflows off for your whole organization, set `\"disableWorkflows\": true` in managed settings, or use the toggle on the Claude Code admin settings page."
> "When workflows are disabled, the bundled workflow commands are unavailable, the `ultracode` keyword no longer triggers a run, and `ultracode` is removed from the `/effort` menu."
**Full summary:** Canonical reference. Availability: research preview, v2.1.154+, ALL paid plans (Pro opt-in via /config — broader than the launch blog's Max/Team/Enterprise), API + Bedrock + Vertex + Foundry. Decision table vs subagents/skills/agent teams across 6 dimensions (who decides next, where intermediate results live, what's repeatable, scale "dozens to hundreds", interruption/resumability). Bundled workflow: /deep-research (vote-per-claim cross-checking, needs WebSearch). UI: /workflows progress view with full keymap (↑↓ select, Enter/→ drill into agent prompt/tool calls/result, Esc, j/k scroll, p pause/resume, x stop agent or run, r restart agent, s save); task-panel progress line. Triggers: `ultracode` keyword (was `workflow` pre-v2.1.160) or natural language; Option+W/Alt+W dismiss highlight; /config toggle for keyword. /effort ultracode = xhigh + auto-orchestration, session-scoped, xhigh-capable models only. Approval matrix by permission mode (default/acceptEdits: every run unless per-project don't-ask-again; auto: first launch only, consent recorded in user settings, skipped under ultracode; bypass/claude -p/SDK: never). Ctrl+G opens script in editor; Tab adjusts prompt. Desktop: approval card Once/Always/Deny, Background-tasks pane. Security model: spawned subagents ALWAYS acceptEdits + inherit allowlist; file edits auto-approved; non-allowlisted shell/web/MCP can prompt mid-run. Save → .claude/workflows/ (project, shared) or ~/.claude/workflows/ (personal); /<name> command; project shadows personal; `args` global passed as structured data. Runtime: isolated env; script persisted under ~/.claude/projects/<session>/ (readable/diffable/editable + relaunch); limits table — no mid-run user input, no direct fs/shell from script, ≤16 concurrent agents (CPU-bounded), 1,000 agents/run cap. Resume: cached completed agents, same-session only; exit = fresh. Cost: counts toward plan usage/rate limits; small-slice gauging; per-agent token visibility; session model inherited unless script routes stages. Disable: /config, settings.json disableWorkflows, CLAUDE_CODE_DISABLE_WORKFLOWS=1 env, org managed settings/admin page; disabling removes bundled commands, keyword trigger, and ultracode from /effort. Surfaces: CLI, Desktop, IDE extensions, claude -p, Agent SDK.

## URL: https://code.claude.com/docs/en/agents.md

**Status:** read
**Title:** Run agents in parallel (official comparison doc)
**Date/Author:** Anthropic Claude Code docs, current as of 2026-06-07
**Body text (verbatim):**
> "Subagents, agent view, agent teams, and dynamic workflows each parallelize work in a different way."
> "Dynamic workflows — A script that runs many subagents and cross-checks their results, for work too big to coordinate one turn at a time or that needs more than a single pass. Research preview"
> "Use it when: A job outgrows a handful of subagents, or you want findings verified against each other: a codebase-wide audit, a 500-file migration, cross-checked research, or a plan drafted from several angles"
> "In every approach the workers are Claude sessions. To involve a different tool, expose it to Claude as an MCP server."
> "Worktrees give each session a separate git checkout, so parallel sessions never edit the same files."
> "`/batch` is a skill that has Claude split one large change into 5 to 30 worktree-isolated subagents that each open a pull request. It's a packaged use of subagents and worktrees, not a separate coordination style."
> "A script holds the plan instead of Claude's turn-by-turn judgment: dynamic workflows"
> "For dynamic workflows, `/workflows` lists running and completed runs, the phase each is in, and how many agents have finished."
> "Running several sessions or subagents at once multiplies token usage."
**Full summary:** Positions dynamic workflows among 4 parallelization approaches: subagents (delegated side tasks in one session), agent view (`claude agents` dispatch/monitor screen, research preview), agent teams (lead + peers w/ shared task list + messaging, experimental, disabled by default), dynamic workflows (script-held plan, cross-checked results, research preview). Decision axes: who coordinates (Claude turn-by-turn / you / lead agent / a script), whether workers talk (teams only), file collisions (worktrees; teams need manual partitioning). Related-but-different: /batch skill (5-30 worktree-isolated subagents each opening a PR), background bash, forked subagent (full-context inheritance), routines (scheduled cloud sessions). Monitoring command map: claude agents (agent view), /agents (running subagents + library), /tasks (background items), /workflows (runs, phases, agent counts).

## URL: https://code.claude.com/docs/en/whats-new/2026-w22.md

**Status:** read
**Title:** Week 22 · May 25–29, 2026 (What's new digest)
**Date/Author:** Anthropic Claude Code docs; releases v2.1.150 → v2.1.157
**Body text (verbatim):**
> "Run Claude Code on Claude Opus 4.8, orchestrate large tasks with dynamic workflows, catch security issues with the security-guidance plugin, and use fast mode on Opus 4.8 at a lower price."
> "Opus 4.8 is now the default on Max, Team Premium, Enterprise pay-as-you-go, and the Anthropic API. It defaults to high effort; use /effort xhigh for harder tasks. Requires v2.1.154 or later."
> "Dynamic workflows — research preview: A workflow is an orchestration script Claude writes for your task and runs across many subagents in the background. Use one when a task is too large for one conversation to coordinate: a codebase-wide audit, a large migration, a research question that needs cross-checking. Manage runs with /workflows."
> "> create a workflow that migrates every internal fetch() call to the new HttpClient wrapper"
> "Fast mode now defaults to Opus 4.8 at $10/$50 per MTok: 2x the standard rate for about 2.5x the speed. Opus 4.7 and 4.6 stay at $30/$150."
**Full summary:** Dynamic workflows shipped in the same release week (v2.1.150–157, May 25–29 2026) as Opus 4.8 (new default on Max/Team Premium/Enterprise PAYG/API; high effort default, xhigh available), the security-guidance plugin, and Opus 4.8 fast mode ($10/$50 per MTok). Context confirms the feature is coupled to Opus 4.8's launch (v2.1.154 requirement shared by both). Example prompt is natural-language workflow creation. Other wins same week: `!`-prefixed background jobs in claude agents / `claude --bg --exec`, auto-loaded `.claude/skills` plugins, /reload-skills, `disallowed-tools` frontmatter, MessageDisplay hook event, fallback-model auto-switch.

## URL: https://www.mindstudio.ai/blog/anthropic-dynamic-workflows-when-to-use-them

**Status:** read
**Title:** Anthropic Dynamic Workflows: What Everyone Gets Wrong About When to Use Them
**Date/Author:** MindStudio Team — June 3, 2026
**Body text (verbatim):**
> "Dynamic workflows burn tokens fast. Learn exactly when to use them vs sub-agents or /goal, and how to avoid costly mistakes in Claude Code."
> "In Anthropic's framework for agentic AI, a dynamic workflow refers to a system where Claude autonomously determines the sequence of actions at runtime."
> "Dynamic workflows put the most decision-making weight on the model itself. That's why they're powerful for genuinely open-ended problems — and expensive when applied to everything else."
> "They work during demos. On a short, well-scoped task, dynamic workflows look great. ... The token cost is invisible at that scale."
> "By step 15, you might be paying for 10,000+ tokens of context on every single model call — just to figure out what step 16 should be."
> "In a dynamic workflow, Claude may try to work around an error, attempt a different tool, reason about what went wrong, and retry — all of which consumes tokens. A workflow that hits a snag might spend 5x more tokens recovering than it would have if it had succeeded cleanly."
> "If your dynamic workflow spawns exploratory sub-tasks in parallel — common in research or code generation tasks — token costs multiply across those branches. Most of that exploration may be discarded, but you've already paid for it."
> "Sub-agents are where a lot of workflows should live but don't."
> "Ask: 'If I sat down and thought carefully, could I specify the steps in advance?' If yes — even roughly — you don't need a fully dynamic workflow."
> "A dynamic workflow for a one-off task is often fine. For anything you're running regularly, you want predictable costs and predictable behavior."
> "If a failed run costs time and money and requires manual cleanup, you want tight control and isolation. Sub-agents and checkpointed pipelines give you that. Dynamic workflows don't."
> "Mistake 2: Not Setting Token Budgets ... A dynamic workflow with no guardrails can run indefinitely on an edge case that a human would resolve in 30 seconds. Set explicit limits on steps, tool calls, and context length. Treat these like circuit breakers, not restrictions."
> "Mistake 3: Trusting the Model to Know When It's Done ... Either specify a clear completion condition, or build in a verification step where a separate call evaluates the output against the original objective."
> "Mistake 5: Building Dynamic Workflows Before Testing Static Ones ... Start with a static workflow. If it breaks on edge cases, add dynamism only where it's needed — not as a default."
> "Use /goal when you want Claude to pursue an objective across multiple steps in an interactive, supervised session ... /goal keeps you in the loop; dynamic workflows don't."
> "Dynamic workflows rely on a single model instance to reason through an entire task end-to-end. Sub-agents are separate model instances with defined, bounded tasks, coordinated by an orchestrator."
**Full summary:** Third-party when-to-use guide (June 3, 2026), heavily content-marketing (MindStudio/Remy promos inline). CAUTION — partial mechanics mismatch vs official docs: it frames "dynamic workflows" generically as model-driven runtime sequencing in a single accumulating context ("single model instance ... end-to-end"), which contradicts the actual Claude Code feature (deterministic script holds the plan; subagents have isolated contexts; intermediate results live in script variables; budget caps exist natively). Its token-cost mechanics (per-step reasoning context growth, 5x error-recovery overshoot, discarded parallel exploration) describe generic autonomous-agent loops more than the shipped feature. Still-useful contributions: 5-step decision framework (genuine unpredictability? repeated runs? mid-task human oversight? decomposable? failure cost?), 5 common mistakes (repetitive tasks, no token budgets, trusting self-termination, ignoring minimal-footprint principle, dynamic-before-static), /goal vs workflow positioning (supervised interactive sessions vs unattended runs), guardrails-as-circuit-breakers framing. Related posts show a cluster of mindstudio SEO articles on /workflows command (May 30 – June 5).

## URL: https://raw.githubusercontent.com/peymanvahidi/awesome-claude-dynamic-workflows/master/README.md

**Status:** read
**Title:** Awesome Claude Dynamic Workflows (community analysis repo, 9 stars, unofficial)
**Date/Author:** peymanvahidi, GitHub; default branch master
**Body text (verbatim):**
> "This repository is unofficial and intended as an educational breakdown of a Claude Dynamic Workflows skill."
> "The skill describes a workflow runtime for orchestrating many subagents in a controlled, deterministic way."
> "A major theme is explicit opt-in. The skill repeatedly says workflows should only run when the user clearly requested that level of orchestration, invoked a workflow-specific command, or when a higher-level mode already authorizes it."
> "In this mode [Ultracode], workflow orchestration becomes the default for substantive tasks, and token cost is treated as secondary to thoroughness."
> "each workflow script begins with a literal `export const meta = { ... }` block. ... the `meta` object must be a pure literal."
> "Phase titles in `meta.phases` are expected to match the runtime `phase()` calls exactly so the progress UI can group related work correctly."
> "`pipeline()` is arguably the most important primitive in the document. The skill explicitly frames it as the default for multi-stage work. Its main idea is that each item moves through stages independently, without waiting for all other items to finish the previous stage."
> "`parallel()` is described very differently: it is a barrier. All tasks in the batch must complete before execution continues."
> "`args` for parameterizing workflows with real JSON values. `budget` for token-aware scaling and hard ceilings. `workflow()` for invoking another workflow as a sub-step."
> "A major design principle in the skill is simple: default to `pipeline()`. Barriers are treated as exceptional, not normal."
> "Concurrent `agent()` calls are capped per workflow, and total agent count is capped across the workflow lifetime."
> "Adversarial verify: Instead of accepting a finding at face value, the workflow spawns independent skeptics and asks them to refute it. A claim survives only if enough verifiers fail to refute it."
> "Perspective-diverse verify: ... Rather than asking three identical critics the same thing, it recommends using different lenses such as correctness, security, performance, or reproducibility."
> "Judge panel: The workflow generates several independent attempts, scores them, and synthesizes from the winner while borrowing good ideas from the runners-up."
> "Loop-until-dry: ... the system keeps running until several consecutive rounds produce nothing new."
> "A workflow run can apparently be resumed using a `runId`, and unchanged prefixes of prior `agent()` calls can return cached results immediately."
> "APIs like `Date.now()` and `Math.random()` are blocked because they would break deterministic resume behavior."
**Full summary:** Community educational breakdown of the collected product SKILL.md. Seven-layer reading guide: purpose/opt-in, Ultracode, file structure (meta literal + phases), runtime primitives (agent/pipeline/parallel/phase/log + args/budget/workflow()), execution rules (default-to-pipeline, bounded scale), pattern catalog (adversarial verify, perspective-diverse verify, judge panel, loop-until-dry, multi-modal sweep, completeness critic), resume semantics (runId, cached prefixes, determinism constraints).

## URL: https://raw.githubusercontent.com/peymanvahidi/awesome-claude-dynamic-workflows/master/dynamic-workflows-skill/SKILL.md

**Status:** read
**Title:** workflows — the collected product skill/spec file (community-archived copy of Claude Code's internal Workflow tool instructions)
**Date/Author:** archived in peymanvahidi/awesome-claude-dynamic-workflows; reflects the shipped feature circa late May 2026
**Body text (verbatim):**
> "Execute a workflow script that orchestrates multiple subagents deterministically. Workflows run in the background — this tool returns immediately with a task ID, and a `<task-notification>` arrives when the workflow completes."
> "ONLY call this tool when the user has explicitly opted into multi-agent orchestration. Workflows can spawn dozens of agents and consume a large amount of tokens; the user must request that scale, not have it inferred."
> "The user included the `workflow` or `workflows` keyword (you'll see a system-reminder confirming it)."
> "When you do call it, the right move is often hybrid: scout inline first (list the files, find the channels, scope the diff) to discover the work-list, then call Workflow to pipeline over it."
> "Understand — parallel readers over relevant subsystems -> structured map; Design — judge panel of N independent approaches -> scored synthesis; Review — dimensions -> find -> adversarially verify; Research — multi-modal sweep -> deep-read -> synthesize; Migrate — discover sites -> transform each (worktree isolation) -> verify"
> "Ultracode. When a system-reminder confirms ultracode is on, that opt-in is standing: author and run a workflow for every substantive task by default. The goal is the most exhaustive, correct answer you can produce — token cost is not a constraint."
> "Pass the script inline via `script` — do not Write it to a file first. Every invocation automatically persists its script to a file under the session directory and returns the path in the tool result."
> "The `meta` object must be a PURE LITERAL — no variables, function calls, spreads, or template interpolation. Required fields: `name`, `description`. Optional: `whenToUse` (shown in the workflow list), `phases`."
> "agent(prompt: string, opts?: {label?: string, phase?: string, schema?: object, model?: string, isolation?: 'worktree', agentType?: string}): Promise<any> — spawn a subagent. Without schema, returns its final text as a string. With schema (a JSON Schema), the subagent is forced to call a StructuredOutput tool and `agent()` returns the validated object"
> "Returns `null` if the user skips the agent mid-run (filter with `.filter(Boolean)`)."
> "`opts.model` overrides the model for this agent call. Default to omitting it — the agent inherits the main-loop model (the resolved session model), which is almost always correct."
> "`opts.isolation: 'worktree'` runs the agent in a fresh git worktree — EXPENSIVE (~200–500ms setup + disk per agent), use ONLY when agents mutate files in parallel and would otherwise conflict; the worktree is auto-removed if unchanged."
> "`opts.agentType` uses a custom subagent type (e.g. `Explore`, `code-reviewer`) instead of the default workflow subagent — resolved from the same registry as the Agent tool"
> "pipeline(items, stage1, stage2, ...): Promise<any[]> — run each item through all stages independently, NO barrier between stages. Item A can be in stage 3 while item B is still in stage 1. This is the DEFAULT for multi-stage work. Wall-clock = slowest single-item chain, not sum-of-slowest-per-stage."
> "parallel(thunks: Array<() => Promise<any>>): Promise<any[]> — run tasks concurrently. This is a BARRIER: awaits all thunks before returning. A thunk that throws (or whose agent errors) resolves to `null` in the result array — the call itself never rejects"
> "budget: {total: number|null, spent(): number, remaining(): number} — the turn's token target from the user's `+500k`-style directive. ... The target is a HARD ceiling, not advisory: once `spent()` reaches `total`, further `agent()` calls throw."
> "workflow(nameOrRef: string | {scriptPath: string}, args?: any): Promise<any> — run another workflow inline as a sub-step ... The child shares this run's concurrency cap, agent counter, abort signal, and token budget ... Nesting is one level only: `workflow()` inside a child throws."
> "Workflow agents can reach all session-connected MCP tools via ToolSearch — schemas load on demand per agent. Caveat: interactively-authenticated MCP servers (e.g. `claude.ai`) may be absent in headless/cron runs."
> "Scripts are plain JavaScript, NOT TypeScript — type annotations (`: string[]`), interfaces, and generics fail to parse. The script body runs in an async context — use `await` directly. Standard JS built-ins (JSON, Math, Array, etc.) are available — EXCEPT `Date.now()` / `Math.random()` / argless `new Date()`, which throw (they would break resume); ... No filesystem or Node.js API access."
> "Concurrent `agent()` calls are capped at `min(16, cpu cores - 2)` per workflow — excess calls queue and run as slots free up. ... Total agent count across a workflow's lifetime is capped at 1000 — a runaway-loop backstop set far above any real workflow."
> "Adversarial verify: spawn N independent skeptics per finding, each prompted to REFUTE. Kill if majority refute. Prevents plausible-but-wrong findings from surviving."
> "Try to refute: ${claim}. Default to refuted=true if uncertain."
> "Loop-until-dry: for unknown-size discovery (bugs, issues, edge cases), keep spawning finders until K consecutive rounds return nothing new. Simple counters (`while count < N`) miss the tail."
> "No silent caps: if a workflow bounds coverage (top-N, no-retry, sampling), `log()` what was dropped — silent truncation reads as `covered everything` when it didn't."
> "Scale to what the user asked for. `find any bugs` -> a few finders, single-vote verify. `thoroughly audit this` or `be comprehensive` -> larger finder pool, 3–5 vote adversarial pass, synthesis stage."
> "Use this tool for multi-step orchestration where control flow should be deterministic (loops, conditionals, fan-out) rather than model-driven."
> "The tool result includes a `runId`. To resume after a pause, kill, or script edit, relaunch with `Workflow({scriptPath, resumeFromRunId})` — the longest unchanged prefix of `agent()` calls returns cached results instantly; the first edited/new call and everything after it runs live. Same script + same args -> 100% cache hit."
> "Fallback when no journal is available: read `agent-<id>.jsonl` files in the transcript directory and hand-author a continuation script."
**Full summary:** The de-facto runtime specification. Tool contract: Workflow tool, background execution, task ID + task-notification, /workflows for progress. Strict opt-in enumeration (keyword w/ system-reminder confirmation, ultracode standing opt-in, user's-own-words request, skill/command instruction, named/saved workflow) — "a task that would merely benefit from a workflow does not count"; otherwise suggest + cost estimate + mention the keyword. Hybrid guidance: inline scout to build the work-list, then pipeline. Five chainable single-phase shapes (Understand/Design/Review/Research/Migrate). Script protocol: inline `script` param; auto-persisted; iterate via scriptPath. meta pure-literal w/ name/description/whenToUse/phases (+ per-phase model display). Full API: agent() (label/phase/schema→forced StructuredOutput w/ validation retry/model override discouraged-by-default/worktree isolation ~200–500ms + auto-remove-if-unchanged/agentType from Agent-tool registry; null on user skip), pipeline() (default; per-item stage flow; (prevResult, originalItem, index) callbacks; throw→null+skip), parallel() (barrier; never rejects; nulls), log(), phase(), args (verbatim structured JSON), budget (from `+500k`-style user directive; shared pool across main loop + workflows; HARD ceiling — agent() throws past total; loop-until-budget + fleet-sizing idioms), workflow() (nested, one level max, shares caps/counter/abort/budget). MCP via ToolSearch per agent (headless caveat for interactively-authed servers). Language constraints: plain JS only (no TS syntax), async body, no fs/Node APIs, determinism bans (Date.now/Math.random/argless new Date throw — preserves resume cache). Concurrency: min(16, cores−2); queueing; 1,000 lifetime cap. Barrier doctrine with smell test + code examples (dedup/early-exit/cross-item prompts justify; flatten/map/cleanliness do not). Worked patterns with code: canonical review pipeline (dimensions→findings→per-finding adversarial verify w/ phase labels), barrier-dedup, loop-until-count, loop-until-budget (guard on budget.total else Infinity → 1000-cap), composed exhaustive review (loop-until-dry w/ 2 dry rounds, 3-lens judging ≥2 votes, dedup vs seen-not-confirmed to ensure convergence). Quality patterns: adversarial verify (majority-refute kill; "default to refuted=true if uncertain"), perspective-diverse verify, judge panel (synthesize from winner + graft runner-up ideas), loop-until-dry, multi-modal sweep, completeness critic, no-silent-caps logging. Effort scaling tied to user phrasing. Resume: runId + resumeFromRunId; longest-unchanged-prefix caching; 100% cache on identical script+args; transcript-dir agent-<id>.jsonl fallback for hand-authored continuation.

## URL: https://benjaminste.in/isitchristmas/

**Status:** read
**Title:** Is It Christmas? (the rebuilt demo app)
**Date/Author:** Benjamin Stein, 2026
**Body text (verbatim):**
> "NO"
> "Inspired by @konklone Learn about dynamic workflows"
> "value is the static fallback for clients without JavaScript. Determining the answer in a visitor's own timezone requires running code in their browser, so without JS we fall back to \"NO\" (correct on all but one day of the year)." (HTML comment)
**Full summary:** The live demo product of the case study — a single-purpose page answering whether it is Christmas, shipping 121 client-side voting algorithms and a vote counter. Links to the build write-up (next block). Substantive content lives in the write-up.

## URL: https://benjaminste.in/blog/2026/05/29/building-isitchristmas/

**Status:** read
**Title:** Building 'Is It Christmas' in 2026 — "484 AI agents. 16 million tokens. Turns out today is not Christmas."
**Date/Author:** Benjamin Stein (co-founder/CEO of SuperDuper), May 29, 2026
**Body text (verbatim):**
> "Claude Code added a feature I intellectually understood but don't have a great mental model for: dynamic workflows. The idea is simple - Claude writes code that spins up a swarm of subagents. Lots of them."
> "rather than just check the local user's timestamp, I decided to implement 121 voting algorithms that would decide in parallel if it was indeed Christmas or not."
> "At the top is one Claude Code instance I'll call the Coordinator. It's the one I talk to. The Coordinator wrote the test suite, wrote out 121 algorithm assignments, wrote the scripts that run the swarm, launched them, read the results back, and decided what to do next."
> "The Coordinator doesn't write 121 algorithms itself. It writes a script that calls 121 other Claudes, each to write their own. The script (new in Opus 4.8) is plain JavaScript with no model inside it, and the runtime runs it in the background. It gets a couple of special functions, and the one that matters is agent():"
> "// agent() boots a fresh Claude with its own context, shell, and tools, // points it at one task, and hands back a structured result. const result = await agent(\"write an algorithm that...\", { schema: RESULT });"
> "agent(prompt) spins up a complete Claude, gives it one job, and waits. Pass a schema and you get a clean object back instead of a wall of text. parallel() runs a list of those at once, sixteen at a time, up to a thousand"
> "A .map() wrapped in parallel(). That's the swarm: throwaway Claudes that each do one job and vanish, with their answers landing back in the script as plain objects. (There's a sibling, pipeline(), for stages instead of a batch.)"
> "So the chain is: I point the Coordinator at the problem, the Coordinator writes a script, the script hires the swarm, and the answers flow back up the same path. That last step, the answers flowing back up, is the half the headlines skip, and it's where the real question lives."
> "before the swarm, Claude wrote a test suite: a Node script that runs each algorithm against 148,488 known dates, covering every timezone, leap years, and the hours on either side of midnight where date bugs hide."
> "It's in what each agent was told in its prompt: 'write your algorithm, run it against the test suite, fix what fails, and don't report back until it's green.' Each subagent has its own shell, so it runs the tests and loops on its own."
> "115 passed on the first try. My favorite used Rata Die ... and got a single constant off by one: 719163 instead of 719162. That one digit pushed about 20,000 of the test dates a day early, specifically around midnight in the far-eastern timezones. The test suite caught it."
> "When all 121 reported done, the Coordinator ran the suite once more over the whole set, to be sure nothing slipped through on a self-report."
> "In Wave Two, the Coordinator wanted to verify and code review it all: 'Does this code do what it claims' and 'where would it break'. So the Coordinator fanned out a second swarm, 363 Claudes this time - three per algorithm"
> "Ooh! Fun fact: this swarm found a subtle bug that the test suite missed: the hash table version only works up until year 2200, which the test suite didn't test for."
> "All the local Node code never ships. It's all just code that Claude wrote and runs locally to organize the subagents deterministically."
> "And that's the new difference between Dynamic Workflows and the previous 'cross your fingers and spin up a subagent if your task description roughly matches the subagent's purpose' that I was hoping to grok with this exercise."
> "Agents 484 / Tokens used 16,000,000+ / What ships to your browser 121 algorithms and a vote counter / Learning to use Dynamic Workflows priceless (technically $85)"
**Full summary:** Best independent hands-on case study (May 29, 2026 — day after launch). Deliberately over-engineered rebuild of isitchristmas.com to learn the feature: 121 parallel "voting algorithms" written by 121 subagents, then a 363-agent review wave (3 per algorithm: "does it do what it claims" / "where would it break" / one-line description) = 484 agents, 16M+ tokens, $85 total. Confirms runtime mechanics from the user side: Coordinator (top session) writes test suite + assignments + script; script is plain JS, no model inside, background-run; agent() boots fresh Claude w/ own context/shell/tools and returns schema-validated objects; parallel() = "sixteen at a time, up to a thousand"; pipeline() sibling for stages. Key verification insights: embed the verification loop in each agent's prompt ("don't report back until green" — each subagent has its own shell to run tests autonomously); trust-but-verify on self-reports (Coordinator re-ran full suite after all 121 claimed done); adversarial review wave caught a bug the 148,488-date test suite missed (hash-table algorithm valid only to year 2200). One subtle bug among 121 first-pass agents: Rata Die constant 719163 vs 719162 → ~20K dates shifted a day in far-eastern timezones. Takeaway framing: the difference vs prior subagents is deterministic orchestration ("code that Claude wrote and runs locally to organize the subagents deterministically").

## URL: https://news.ycombinator.com/item?id=48311705

**Status:** read (via hn.algolia.com/api/v1/items/48311705 — machine-readable endpoint)
**Title:** "Dynamic Workflows in Claude Code" — HN discussion, 200 points, 135 comments, 2026-05-28
**Body text (verbatim):**
> "A few of us from the Claude Code team will be hanging around if anyone has questions! Very excited for this launch -- dynamic workflows have been a game changer for engineering here at Anthropic." — bcherny (Boris Cherny, Claude Code team)
> "There's two main differences [vs a team of sub-agents]: 1. Support for 1-2 OOMs more agents, to do more work in parallel 2. A phased, semi-structured approach where work happens in steps" — bcherny
> "Dynamic workflows, in my experience, make Claude more effective at complex long-running tasks. They help precisely with getting Claude to do the task correctly. It feels more like a bespoke build system for the specific task/project than prompting a freeform chat." — Jarred (Jarred Sumner, Bun)
> "I'm going to be honest, this very much reads like an exciting new way to burn up as many tokens as possible." — Deukhoofd
> "My initial reaction was that this is tokenmaxxing disguised as a product." — mattas
> "Cloudflare just launched a feature with this same name, just this month. Why would Anthropic choose the same exact name? https://blog.cloudflare.com/dynamic-workflows/" — SilverElfin
> "Using the keyword 'Workflow' like 'Ultrathink' is problematic? ... Workflow is generic keyword and used in so many contexts both inside the codebase and orchestration tooling like say temporal.io" — manquer
> "At this point, my limiting factor is not how quickly Claude can self-trudge through code. It's whether Claude is going to do the task correctly or not. I need more mechanisms for controlling long-running sessions and dynamically injecting my thoughts, correction, and nudges rather than faster ways to burn through my tokens" — SkyPuncher
> "Agents address the problem from independent angles, other agents try to refute what they found, and the run keeps iterating until the answers converge. ... Adversarial models are a longstanding technique in ML so it makes sense they would try to go this way." — wrs
> "one cannot complain that agents don't produce high quality code while at the same time not allowing them to thoroughly go through all the steps required to produce high quality code" — ithkuil
> "I tried creating a workflow in Claude 1.9255.2 ... and got API Error: 400 messages.3.content.11: `thinking` or `redacted_thinking` blocks in the latest assistant message cannot be modified." — wilg (early desktop bug report)
> "Quite a thing to use Bun rewrite to Rust as example of dynamic workflows, while now it is considered as anti pattern which leads team to stop supporting the tool due to inability to properly understand and navigate 1m vibe coded Rust lines" — vld_chk (unverified commenter claim)
**Full summary:** Community reception snapshot (200 pts / 135 comments, launch day). Anthropic engagement: Boris Cherny AMA-style presence; his canonical differentiation vs agent teams = 1-2 orders of magnitude more agents + phased semi-structured execution. Jarred Sumner first-hand endorsement ("bespoke build system for the specific task"). Dominant critical thread: token-burn skepticism ("tokenmaxxing") from several users; counterpoint (ithkuil, encoderer): thorough verification requires the compute. Quality-vs-throughput concern (SkyPuncher; correctness control > speed). Naming critiques: collision with Cloudflare's same-month "dynamic workflows" feature; `workflow` keyword being too generic (conflicts with users' own vocab/tooling like Temporal — later versions changed trigger keyword to `ultracode`, consistent with docs noting "Before v2.1.160 the literal trigger keyword was `workflow`"). Feature asks in-thread: shareable/team workflows, non-Anthropic model delegation, secrets manager, language of scripts (answered by docs: JavaScript, local). One unverified negative claim about the Bun rewrite's maintainability (vld_chk) — no corroboration found in this pass; treat as rumor. Bug report: thinking-block 400 error in pre-release desktop build attempting workflows.

## URL: https://twitter.com/trq212/status/2061907337154367865

**Status:** read (via cdn.syndication.twimg.com/tweet-result — machine-readable endpoint)
**Title:** X post by Thariq (@trq212) sharing the dynamic workflows article
**Date/Author:** @trq212 ("Thariq", Anthropic Claude Code team), 2026-06-02T20:26:32Z
**Body text (verbatim):**
> "https://t.co/R6exTuF7P8" (sole tweet text — link to x.com/i/article/2061850535708483585)
> Syndication metadata: "favorite_count: 9824", "created_at: 2026-06-02T20:26:32.000Z", "screen_name: trq212", "name: Thariq"
**Full summary:** Thariq Shihipar's share of the long-form X article version of the "A harness for every task" post on launch+5 days; 9,824 likes at retrieval time — the highest-engagement X artifact found for this feature. The tweet body is only the article link; substantive content is the article itself (blocked — next block) whose canonical content is the claude.com blog post (extracted above). HN submission 48380657 titled this exact post "A harness for every task: dynamic workflows in Claude Code", confirming content equivalence.

## URL: https://x.com/i/article/2061850535708483585

**Status:** inaccessible (error 500)
**Title:** X long-form article: "A harness for every task: dynamic workflows in Claude Code"
**Date/Author:** @trq212 (Thariq Shihipar), ~2026-06-02
**Verdict:** inaccessible — X returns HTTP 500 for this article URL across 3 playwright attempts with Googlebot UA (consistent "This page is down" body, 239 chars); tweet page renders empty body text under Googlebot UA; zero Wayback Machine snapshots for either the article or the parent tweet (archive.org/wayback/available + CDX both empty). Content is established as the X mirror of https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code (same title per HN 48380657; same author), which IS fully extracted above — so no information loss results from this block's inaccessibility.

## Coverage table

| # | URL | Status |
|---|-----|--------|
| 1 | claude.com/blog/introducing-dynamic-workflows-in-claude-code | read |
| 2 | claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code | read |
| 3 | code.claude.com/docs/en/workflows.md | read |
| 4 | code.claude.com/docs/en/agents.md | read |
| 5 | code.claude.com/docs/en/whats-new/2026-w22.md | read |
| 6 | mindstudio.ai/blog/anthropic-dynamic-workflows-when-to-use-them | read |
| 7 | raw.githubusercontent.com/.../README.md | read |
| 8 | raw.githubusercontent.com/.../dynamic-workflows-skill/SKILL.md | read |
| 9 | benjaminste.in/isitchristmas/ | read |
| 10 | benjaminste.in/blog/2026/05/29/building-isitchristmas/ | read |
| 11 | news.ycombinator.com/item?id=48311705 | read (Algolia API) |
| 12 | twitter.com/trq212/status/2061907337154367865 | read (syndication API) |
| 13 | x.com/i/article/2061850535708483585 | inaccessible (X 500; content mirrored by #2) |
