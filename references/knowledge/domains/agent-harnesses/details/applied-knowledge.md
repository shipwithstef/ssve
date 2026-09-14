```markdown
# applied-knowledge.md

## 1. Distilled positions per theme

### Theme: Billing & Execution Boundaries
* Anthropic paused the announced separate Agent SDK credit change.
  * **Interpretation:** As of 2026-07-15, `claude -p` and Agent SDK usage still draws from Claude subscription usage limits and no separate monthly Agent SDK credit exists. Headless review still needs cost and duplicate-call controls because it consumes the shared allowance, but billing alone does not require porting it to TUI-native orchestration.
  * **Source:** `details/anthropic-agent-sdk-credit-2026-06-15.md` (Section: Current state)

* Codex and Claude now expose stronger non-interactive isolation and structured-output controls than the framework's older examples use.
  * **Interpretation:** Cross-family review should enter through one canonical launcher: stdin input, explicit model/effort, non-persistence, configuration/tool isolation, structured schema, separate streams, time/budget ceilings, effective-model receipt, and content-addressed reuse.
  * **Source:** current installed `codex exec --help` / `claude --help`, plus official non-interactive/headless CLI references, checked 2026-07-15.

### Theme: Dynamic Workflows & Orchestration
* "A dynamic workflow is a plain-JavaScript orchestration script that Claude writes for your task; a runtime executes it in the background... and the script — not Claude's turn-by-turn judgment — holds the loop, branching, and intermediate results."
  * **Interpretation:** Claude Code provides a native, deterministic orchestration layer that shifts state management from the LLM context window to a standard JavaScript runtime.
  * **Source:** `details/claude-code-dynamic-workflows.md` (Section: What it is)

* "standard built-ins available EXCEPT Date.now() / Math.random() / argless new Date() which throw — they would break deterministic resume"
  * **Interpretation:** Native workflows enforce strict determinism to allow aggressive caching and safe resumption of partial workflow runs.
  * **Source:** `details/claude-code-dynamic-workflows.md` (Section: Runtime API)

### Theme: Hook Ecosystems & Intercepts
* "Codex has a full native hook system with 6 lifecycle events (SessionStart, PreToolUse, PermissionRequest, PostToolUse, UserPromptSubmit, Stop), JSON-on-stdin / JSON-on-stdout wire protocol, regex matchers..."
  * **Interpretation:** Pre-flight and post-flight validation gates can now be natively enforced on Codex, achieving parity with Claude Code and Gemini CLI hook systems.
  * **Source:** `details/codex.md` (Section: Native Hooks (CORRECTION))

* "Because it relies on tool schemas, it lacks a pre-tool PTY intercept. A user cannot hit Ctrl+C to cleanly break a sub-process without the system handling termination signals."
  * **Interpretation:** Antigravity cannot rely on dynamic terminal intercepts to stop bad actions; enforcement must occur either via rigid artifact schemas prior to execution or post-execution auditing.
  * **Source:** `details/antigravity.md` (Section: Framework Defenses Required (svc compatibility))

### Theme: Memory & Context Constraints
* "Rebuilds MEMORY.md with a strict 200-line / 25KB context budget."
  * **Interpretation:** Long-lived framework state and rules cannot safely persist in `MEMORY.md` if they exceed the 200-line limit; they will be aggressively pruned by AutoDream.
  * **Source:** `details/claude-code.md` (Section: 2. Memory & Context (AutoDream))


## 2. Cross-domain implications

**Context:** svc framework orchestrates multi-skill pipelines on Claude Code with refuse-mode receipts. Key question: which pipeline stages should delegate to native workflows vs keep svc's own orchestration.

*   **Implication for Billing & Dispatch:**
    Do not deprecate `claude -p` solely because of the paused Agent SDK credit policy. Choose headless versus TUI-native orchestration from isolation, durability, authentication, observability, and shared-allowance cost. For external review, a bounded non-persistent `claude -p` call remains legitimate.
*   **Implication for External Review:**
    SVC must replace consumer-local Claude/Codex commands with one schema-driven launcher. Codex uses `codex exec`; Claude uses `claude -p`. The invocation receipt must prove the effective model/effort and distinguish model unavailability from auth, network, timeout, or schema failure before any fallback.
*   **Implication for Delegation vs. Orchestration:** 
    SVC should delegate map-reduce execution phases (e.g., `audit-implementation` coverage sweeps, `review-cross-model` adversarial panels, bulk refactoring) to native Claude Dynamic Workflows. However, SVC must RETAIN macro-orchestration (`route-workflow`, `plan-changeset` -> `execute-changeset`) via `lane-tasks.json`. Why? Because Claude Workflows drop state when a session exits, whereas `lane-tasks.json` provides cross-session, host-agnostic durability.
*   **Implication for Receipt & Review Enforcement (Hooks):**
    Because Codex now possesses a native `PreToolUse` and `PostToolUse` hook system, SVC's L3 receipt gate (`scripts/emit-receipt.mjs`) and pre-commit checks can be universally applied across Claude, Gemini, and Codex. Antigravity requires a different path (audit-based) due to its lack of PTY intercepts.
*   **Implication for Knowledge Durability (Memory limits):**
    Because Tengu/AutoDream compacts `MEMORY.md` to 25KB/200 lines, SVC's architectural decisions to keep rules mapped in explicit `.md` files (like `GEMINI.md`, `CLAUDE.md`, and `rules/*.md`) rather than relying on dynamic chat memory is fundamentally validated and must be strictly maintained.


## 3. Contradictions / open questions

*   **Contradiction on Workflow Resumption:** 
    The official Mintlify Claude Code docs state that exiting Claude Code mid-run means the next session starts fresh (resume is same-session only). However, the engineering blog claims "quitting the terminal, resuming the session will allow the workflow to pick up." 
    *Resolution Strategy provided by source:* Treat the official docs as canonical (same-session only). Fallback requires hand-authoring continuation scripts from `agent-<id>.jsonl`.
*   **Open Question on Antigravity Safety:**
    Since Antigravity lacks a `PreToolUse` PTY intercept, it relies entirely on semantic UI guardrails and `ANTIGRAVITY.md` schema constraints. It is an open question whether SVC's "refuse-mode" strict receipt gates can be reliably enforced on Antigravity without an un-bypassable terminal hook.


## 4. Recency-weighted insights

*   **Billing correction (2026-07-15):** The announced separate Agent SDK credit distinction is paused. The older claim that `claude -p` necessarily exits the subscription pool is superseded; re-verify the official support article before future routing changes.
*   **External invocation correction (2026-07-15):** Current Codex uses `codex exec` for non-interactive work and reserves `-p` for profiles. Current Claude supports safe-mode, non-persistence, schema, and budget controls; `--bare` deliberately disables OAuth/keychain auth.
*   **Structured-review runtime correction (2026-07-16):** Claude schema output may consume an agentic tool-use round trip after the primary response, so one paid invocation must be enforced independently of a bounded CLI turn budget. Anthropic-managed Fable safeguard switching is a same-conversation provider route to Opus 4.8, not proof that the launcher invoked its explicit availability fallback. Effective-model, route-kind, cache, and duplicate-Opus behavior must follow that distinction.
*   **Trigger Keywords (Updated v2.1.160):** The explicit opt-in for dynamic workflows has changed. The `workflow` keyword was deemed too generic and changed to `ultracode`. Any SVC skills generating dynamic prompts must use the new `ultracode` keyword.
*   **Codex Hooks (Revised 2026-04-23):** Supersedes earlier documentation that stated Codex operated without hooks. Codex absolutely supports a native, regex-based JSON-on-stdin hook architecture.


## 5. Source map

*   Programmatic billing correction: `details/anthropic-agent-sdk-credit-2026-06-15.md` (Section: Current state)
*   External review invocation: official Codex non-interactive/command references and Claude headless/CLI references, recorded in `.sources.jsonl`
*   Dynamic workflows definition: `details/claude-code-dynamic-workflows.md` (Section: What it is)
*   Determinism rules (Date.now): `details/claude-code-dynamic-workflows.md` (Section: Runtime API)
*   Codex hook capabilities: `details/codex.md` (Section: Native Hooks (CORRECTION))
*   Antigravity PTY intercept lack: `details/antigravity.md` (Section: Framework Defenses Required (svc compatibility))
*   AutoDream memory compaction: `details/claude-code.md` (Section: 2. Memory & Context (AutoDream))


## 6. What this distillation does NOT capture

*   **Raw Workflow Code Implementations:** Specific JavaScript orchestration examples (e.g., `pipeline()` vs `parallel()` syntax blocks) from the Dynamic Workflows SKILL.md archive were excluded in favor of structural implications.
*   **Older Agentic Approaches:** Earlier methods of orchestrating manual "agent teams" are ignored as they are superseded by Dynamic Workflows.
*   **Gemini/Codex MCP Tool Lists:** Exhaustive lists of 60+ internal tools and schema payloads were set aside to focus strictly on orchestration boundaries and lifecycle hooks.
*   **Specific Pricing Tiers:** Details regarding the exact API list rates or seat-Premium tier configurations beyond the $20-$200 SDK credit brackets were omitted as they fluctuate and do not alter the technical routing decisions of the framework.
```
