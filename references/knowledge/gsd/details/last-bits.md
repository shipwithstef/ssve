# Deep Drills: Remaining GSD Nuggets

This final supplementary document extracts the last few high-value architectural details found in GSD's gap-checker, ultraplan design, and SDK adapters. This brings our total count to **65 mapped mechanics**.

---

## 1. Post-Planning Gap Analysis (`bin/lib/gap-checker.cjs`)

**The Architecture:** After the planning phase, the framework must prove that *every* requirement and *every* architectural decision was actually addressed in at least one plan.
**The Implementation (`runGapAnalysis`):**
1. **Requirement Extraction:** Parses `REQUIREMENTS.md` using a prefix-agnostic ID pattern: `/[A-Z][A-Z0-9]*-[A-Za-z0-9_-]+/`.
2. **Decision Extraction:** Calls the trackable decision parser on `CONTEXT.md`.
3. **Plan Concatenation:** Joins the text of all `*-PLAN.md` files in the current phase directory.
4. **Regex Word-Boundary Check:** For each ID (e.g., `REQ-01`), it runs:
   ```javascript
   const re = new RegExp('\\b' + escapeRegex(it.id) + '\\b');
   ```
   This prevents false positives where `REQ-1` would mistakenly match `REQ-10`.
5. **Traceability Table:** Emits a markdown table (`| Source | Item | Status |`) showing exactly which requirements were missed by the AI planner.

## 2. Ultraplan Cloud Offloading (`docs/superpowers/specs/...-ultraplan-phase-design.md`)

**The Architecture:** For massive features, local terminal context isn't enough. GSD allows offloading the entire planning session to the browser-based "Ultraplan" cloud infrastructure.
**The Implementation:**
1. **Runtime Gate:** Strictly checks `$CLAUDE_CODE_VERSION`. If unset, it blocks the command because `/ultraplan` only exists in Claude Code.
2. **Context Packaging:** It bundles the phase scope, requirements, and current research into one giant prompt for the cloud session.
3. **The "Teleport" Loop:**
   - User reviews and revises in the browser UI.
   - User approves in the browser, which "teleports" the control back to the terminal.
   - User cancels the terminal dialog (which saves the cloud-drafted plan to a local file).
   - User runs `/gsd-import --from <file>` to reintegrate the cloud plan into the local state.

## 3. Atomic State Patches (`bin/lib/state.cjs`)

**The Architecture:** State updates often involve changing just one field (like `progress: 85%`) in a giant YAML file.
**The Implementation (`stateReplaceField`):**
Instead of just appending or overwriting, GSD uses a regex-replace strategy within the YAML frontmatter:
```javascript
const re = new RegExp(`^${key}:\\s*.*$`, 'm');
const patched = raw.replace(re, `${key}: ${value}`);
```
If the key doesn't exist, it uses `stateReplaceFieldWithFallback` to find the exact line after `---` and inject the new key-value pair, preserving the rest of the file's formatting and comments perfectly.

## 4. Multi-Block Decision Merging (`sdk/src/query/decisions.ts`)

**The Architecture:** A phase might have new decisions *plus* carry-over decisions from a previous phase.
**The Implementation (`extractDecisionsBlock`):**
It uses a global regex match (`/<decisions>([\s\S]*?)<\/decisions>/g`) to find **all** decision tags in `CONTEXT.md`. It then concatenates their inner contents with double-newlines *before* parsing. This prevents the "logic-blindness" bug where the framework would only see the first block of decisions and ignore any appended ones.

## 5. Subprocess CLI Bridge (`sdk/src/query/query-cli-adapter.ts`)

**The Architecture:** The GSD SDK is written in modern TypeScript (`.ts`), but the core CLI tools are legacy CommonJS (`.cjs`).
**The Implementation:**
The SDK uses a "CLI Adapter" to bridge the two. It spawns the `gsd-tools.cjs` script as a detached child process, passes the query arguments, and pipes the output. Crucially, it parses the `exitCode` and `stderr` to map CLI failures back into typed SDK `QueryError` objects, allowing the TS SDK to "pretend" the legacy CJS logic is just a standard async function.
