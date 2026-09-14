# Deep Drills: Final GSD Architectural Layers

This final document in the deep drill series extracts the deepest, most complex architectural layers found in GSD's SDK queries, ADRs, and core lifecycle modules. This brings our total count to **60 unique or common mechanics**.

---

## 1. Trackable Decision Parser (`sdk/src/query/decisions.ts`)

**The Architecture:** GSD uses `CONTEXT.md` as the source of truth for architectural decisions. It must distinguish between "enforced" decisions and "discretionary" side-notes.
**The Implementation (`parseDecisions`):**
- **Block Concatenation:** It reads *every* `<decisions>` block in `CONTEXT.md`, preventing the "dropped carry-over" bug where only the first block was processed.
- **Trackability Logic:** A decision is only trackable if it matches `D-NN` and is *not* under a "Claude's Discretion" heading or tagged with `[informational, folded, deferred]`.
- **Indentation Stack:** Uses a stack-based parser to correctly attribute decisions to the nearest `### Category` heading, even across multiple markdown lists.

## 2. Non-Canonical Plan Diagnostic (`bin/lib/phase.cjs`)

**The Architecture:** Agents often deviate from the strict `{padded_phase}-{NN}-PLAN.md` naming convention, causing the executor to see "zero plans" and crash.
**The Implementation (`describeNonCanonicalPlans`):**
Instead of just failing silently, GSD runs a "diagnostic net" (`looksLikePlanFile`).
- It flags any `.md` file containing the string `PLAN` that isn't derivative (like `-OUTLINE.md` or `.pre-bounce.md`).
- It explicitly warns the user: *"Found plan-shaped file '01-PLAN-foundation.md' that doesn't match canonical form '01-01-PLAN.md'."*
- This transforms a "silent framework failure" into a "loud user correction."

## 3. ADR-Driven Evolution (`docs/adr/`)

**The Architecture:** GSD uses its own ADR system to manage framework complexity.
**The Insight:**
The GSD repo contains 7 major ADRs (e.g., `0001-dispatch-policy-module.md`, `0004-worktree-workstream-seam-module.md`). These aren't just docs; they define the "seams" where the framework is designed to be extended. For example, ADR-0004 defined exactly how worktrees and workstreams interact, which prevented the race conditions we see in other parallel-execution frameworks.

## 4. Phase Decimal Increment Logic (`bin/lib/phase.cjs`)

**The Architecture:** When a phase needs a sub-phase (e.g., Phase 1.1), the framework must mathematically resolve the "next" index.
**The Implementation (`cmdPhaseNextDecimal`):**
It doesn't just add `.1`. It parses the directory list, extracts the decimal segments of the specific base phase (e.g., `1.x`), converts them to integers, finds the `max()`, and increments. This allows for deep nesting like `Phase 1.9.4` → `Phase 1.9.5` without string-concatenation errors.

## 5. Architectural Debt Markers (`sdk/src/phase-runner.ts`)

**The Architecture:** Verification isn't just binary (pass/fail); it must track "debt."
**The Implementation (`VerificationOutcome`):**
GSD's verifier can return `architectural_debt`. This happens when the code passes tests but contains specific debt markers (e.g., `// TODO`, `// FIX`, or `// HACK`). The `PhaseRunner` specifically scans for these and reports them as a "passed with debt" status, preventing hacks from being permanently merged into the codebase.

## 6. Atomic State Update Loop (`bin/lib/state.cjs`)

**The Architecture:** Updating `STATE.md` is dangerous if an agent crashes mid-write.
**The Implementation (`readModifyWriteStateMd`):**
- It reads the file into memory.
- It applies a `patch` function.
- It writes the entire file back using `atomicWriteFileSync` (writing to a `.tmp` file and then `fs.renameSync`).
- This ensures that even if the process is SIGKILL'd, the `STATE.md` file is either 100% old or 100% new—never half-written garbage.

## 7. Intelligent Markdown Normalization (`bin/lib/core.cjs`)

**The Architecture:** Markdown files must be kept clean to be readable by LLMs.
**The Implementation (`normalizeMd`):**
GSD has an O(n) "insideFence" rewrite algorithm. It parses the entire markdown file and ensures that only one trailing newline exists, and that all fenced code blocks (`` ``` ``) have a blank line before and after them. This creates a "predictable surface" for the LLM's next `Read` call, reducing parsing errors.
