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
