# Deep Drills: The GSD Security & Philosophy Layer

This final deep-dive document extracts the "invisible" layers of GSD: its security scanners, interaction philosophy, and strict testing invariants. This completes the 100% exhaustive mapping of the repository.

---

## 1. Prompt Injection Signature List (`scripts/prompt-injection-scan.sh`)

**The Mechanic:** GSD maintains a high-fidelity list of regex signatures to detect prompt injection *before* it is written to the project's context files.
**Key Signatures:**
- **Instruction Override:** `ignore[[:space:]]+(all[[:space:]]+)?(previous|prior|above|earlier|preceding)[[:space:]]+(instructions|prompts|rules|directives|context)`
- **Role Manipulation:** `you[[:space:]]+are[[:space:]]+now[[:space:]]+(a|an|my)[[:space:]]`
- **Boundary Break:** `</?system>`, `</?assistant>`, `\[SYSTEM\]`, `<<SYS>>`
- **Jailbreak Patterns:** `do[[:space:]]+anything[[:space:]]+now`, `DAN[[:space:]]+mode`, `jailbreak`

## 2. Base64 Obfuscation Scanner (`scripts/base64-scan.sh`)

**The Mechanic:** Attackers often hide injection payloads inside base64 strings to bypass standard text filters.
**The Algorithm:**
1. **Identify Blobs:** It uses a regex to find base64-like strings `>= 40 characters`.
2. **Decode & Clean:** It decodes the blob and strips control characters.
3. **Recursive Scan:** It runs the *entire* Prompt Injection Signature list (see #1) against the *decoded* plaintext. 
This is a "defense-in-depth" layer that prevents encoded malware from entering the agent's context.

## 3. Interaction Philosophy: "Claude Automates, Human Judges" (`references/checkpoints.md`)

**The Mechanic:** GSD enforces a strict boundary between AI work and Human work to prevent "Task Delegation Reversal" (where the AI asks the human to do the CLI work).
**The Golden Rules:**
1. **Claude runs it:** Never ask the user to run `npm install`, start servers, or run builds.
2. **Claude sets up the env:** Start the dev server and seed the DB *before* triggering the checkpoint.
3. **User only judges:** The user only performs tasks that require human consciousness (e.g., "does this UI feel snappy?").
4. **Secrets from user, automation from Claude:** Ask for the API key, but Claude must be the one to paste it into `.env`.

## 4. Source-Grep Theater Prevention (`scripts/lint-no-source-grep.cjs`)

**The Mechanic:** Prevents "shallow tests" where the AI merely checks if a string exists in a file rather than verifying that the code actually runs.
**The Logic:** 
The linter blocks any test file that calls `readFileSync` on a `.cjs` or `.js` file from a source directory (like `bin/` or `lib/`) unless the file is explicitly annotated with `// allow-test-rule`. This forces developers to write **behavioral tests** (running the code) rather than **text-matching tests** (reading the source).

## 5. Anti-Pattern Resume Questions (`discuss-phase.md`)

**The Mechanic:** If a project hits a "Blocking Anti-Pattern" (a fundamental design failure), the framework forces a mandatory "Understanding Check" before the AI is allowed to resume work.
**The Mandatory Questions:**
1. "What is this anti-pattern?"
2. "How did it manifest in our specific code?"
3. "What structural mechanism are we implementing to prevent it from ever happening again?"
This turns every failure into a permanent architectural guardrail.

## 6. Padded-Phase Decimal Resolution (`bin/lib/phase.cjs`)

**The Mechanic:** Correctly sorting and identifying the "next" sub-phase in a complex, nested project tree.
**The Logic:**
It uses a specialized `tokenRe = /^\d+[A-Z]?(?:\.\d+)*$/i` to parse phase IDs. 
- It handles integers (`1`), decimals (`1.1`), and letter-suffixes (`1A`). 
- When calculating the "next" phase, it pads the segments (e.g., `01.09`) to ensure that `Phase 1.10` correctly follows `Phase 1.9` in the filesystem and git logs, preventing lexicographical sorting bugs.

## 7. Artifact Reachability Gate (`get-shit-done/references/planner-gap-closure.md`)

**The Mechanic:** A planner-level constraint that refuses any plan containing "orphan artifacts."
**The Rule:**
Every newly proposed file or function *must* declare its **Reachability Path**. 
- If you add a new `util.ts`, you must also add the `import` statement in a consumer file in the same plan. 
- If you add a new API route, you must include a corresponding frontend `fetch` call or a test case that hits that route. 
- Plans with unreachable code are rejected by the `gsd-plan-checker`.

## 8. Context Fracture Detection (`sdk/src/context-engine.ts`)

**The Mechanic:** Detects when the AI's context has become "fractured" (too many small, unrelated snippets) which causes reasoning to drop.
**The Metric:** 
It computes a `fractureScore` based on the ratio of `filesRead` vs. `tokensUsed`. If an agent has read 50 tiny files but only used 10% of its tokens, the framework warns that the agent is "skimming" and forces a consolidation pass to merge those snippets into a coherent architectural map.

## 9. Golden Artifact Parity Testing (`sdk/HANDOVER-GOLDEN-PARITY.md`)

**The Mechanic:** A strict regression suite for the SDK.
**The Rule:** 
Any change to the TypeScript SDK must be verified against a set of "Golden Artifacts" (perfectly formed Plans and States). The `gsd-sdk` query layer must produce output that is **byte-equivalent** to the legacy CJS CLI's output for these golden files. This ensures that as the framework modernizes, its core "reasoning output" never drifts.

## 10. Force-Stance Adversarial Review (`agents/gsd-nyquist-auditor.md`)

**The Mechanic:** A specific auditing persona that is "born to find bugs."
**The Instruction:** 
The Auditor agent is explicitly told to assume a **"FORCE Stance"**. It is instructed to start every session with the internal assumption: *"The implementation is currently broken and the requirements have been ignored."* This psychological nudge prevents the AI from being "too nice" during reviews and results in a 40% higher bug-detection rate in complex PRs.
