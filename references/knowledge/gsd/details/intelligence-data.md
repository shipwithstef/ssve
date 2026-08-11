# Deep Drills: The GSD Intelligence Data Layer

This final document in the deep drill series extracts the "intelligence" backing GSD's agents: the actual prompt text, few-shot examples, and gold-standard templates that define its high-fidelity behavior. This pushes our total mapped mechanics over 100 and completes the absolute exhaustive mapping.

---

## 1. Verifier Few-Shot Patterns (`references/few-shot-examples/verifier.md`)

**The Knowledge:** GSD uses a calibration corpus to teach agents that "File Exists" is not enough.
**The Three Levels of Proof:**
- **L1 (Existence):** Physical file path and non-zero line count.
- **L2 (Substantive):** Absence of TODO/FIXME, defined sections, non-trivial logic.
- **L3 (Wired):** Proving the artifact is imported and correctly called by its consumer with valid arguments.
**Common Gaps to Find:**
- **Missing Wiring (37% of gaps):** File exists and is tested but orphaned.
- **Config Layer Mismatch:** Toggles exist in code but are missing from JSON schema.

## 2. Plan-Checker Negative Control Examples (`references/few-shot-examples/plan-checker.md`)

**The Knowledge:** Trains the checker to reject "Success Theater."
**Key Lessons:**
- **Reject Trivial Verification:** Flag `echo "done"` in `<verify>` blocks because it cannot distinguish pass from fail.
- **Reject Horizontal Layering:** Force "Vertical Slices" (Model + API + UI in one plan) over "Layer Groups" (All APIs in one plan).
- **Stall Detection:** If the issue count doesn't decrease after 3 iterations, terminate the loop and escalate to human.

## 3. Parallel Phase XML Schema (`templates/phase-prompt.md`)

**The Knowledge:** The exact interface between the Planner and the parallel Executor.
**Key Schema Fields:**
- `wave`: Pre-computed integer (1, 2, 3...) for dependency grouping.
- `files_modified`: Array of strings for automated conflict prevention.
- `must_haves.truths`: Observable user behaviors.
- `must_haves.key_links`: Verification patterns for inter-file connections.
**The "Read-First" Constraint:** Every task must declare a `<read_first>` tag, ensuring the executor agent has the correct context before it attempts to `Edit`.

## 4. Requirement Traceability Table (`templates/requirements.md`)

**The Knowledge:** A machine-readable table linking Requirements to Plans.
**The Column Schema:**
`| REQ-ID | Status | Satisfied in Phase/Plan | Verification Method |`
**The Algorithm:** GSD's gap-checker script parses this table to identify requirements that have reached "Terminal Plan State" but haven't been verified in code.

## 5. UI-SPEC Visual Contract (`templates/UI-SPEC.md`)

**The Knowledge:** A strict template for frontend-heavy phases.
**Mandatory Sections:**
- **States:** Loading, Empty, Data, Error, Success.
- **Responsibility:** Desktop grid vs. Mobile stack behavior.
- **Accessibility:** ARIA labels, focus-trap requirements.
- **Interactions:** Animation curves and hover-state triggers.

## 6. Goal-Backward Verification Logic (`references/verification-patterns.md`)

**The Knowledge:** How to verify different stacks.
**GSD's Grep Patterns:**
- **React:** `grep -E "export (default |)function"` for existence + `grep -E "<[A-Z]"` for substantive UI.
- **API:** `wc -l` > 15 lines check + `grep -E "req\.json\(\)"` to prove body handling.
- **DB:** `npx prisma db execute` to verify the table exists in the live DB, not just the file.

## 7. Context Degradation Warning Signs (`references/context-budget.md`)

**The Knowledge:** Heuristics for detecting when the AI is "losing its mind" due to token pressure.
**Signs to Watch:**
- **Increasing Vagueness:** Using "standard patterns" instead of specific code.
- **Skipped Steps:**Success criteria has 8 items, but agent only reports 5.
- **Silent Partial Completion:** Claiming task is done when implementation is missing.

## 8. Continuous Context Thread Schema (`templates/thread.md`)

**The Knowledge:** How to persist workstreams across months.
**The Format:**
A YAML-headed markdown file storing `topic`, `participants`, `locked_state`, and `residue`. It acts as a "long-term memory" file that is re-injected whenever the agent detects the session is a continuation of that specific thread.

## 9. AI Framework Selection Matrix (`references/ai-frameworks.md`)

**The Knowledge:** A decision engine for selecting the right AI stack (LangGraph, CrewAI, LlamaIndex, etc.).
**The GSD Metric:**
Compares frameworks by "Evaluation Concerns" (e.g., LlamaIndex matters for faithfulness, LangGraph for state transition correctness).

## 10. Force-Stance Review Prompt (`agents/gsd-nyquist-auditor.md`)

**The Knowledge:** The specific prompt wording to prevent "Polite AI Bias."
**The Directive:**
*"Assume the implementation is a placeholder. Start by proving the Requirements have been ignored. Do not report a PASS until you have executed a behavioral test that would fail if a stub were present."*
