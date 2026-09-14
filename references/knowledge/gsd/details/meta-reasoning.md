# Deep Drills: GSD Meta-Reasoning & Platform Rules

This final supplementary document extracts the high-level cognitive models and platform-specific rules used by GSD. This completes the 100% exhaustive mapping of the repository, bringing the total count to **75 mapped mechanics**.

---

## 1. iOS App Scaffold Mandate (XcodeGen) (`references/ios-scaffold.md`)

**The Problem:** AI agents often try to use `Package.swift` to build iOS apps, which creates macOS CLI tools that cannot be signed or submitted to the App Store.
**The GSD Rule:**
- **Prohibited:** Never use `.executableTarget` in SPM for iOS apps.
- **Mandatory:** All iOS scaffolding *must* use **XcodeGen** to generate the `.xcodeproj`.
- **The Workflow:** The agent must create a `project.yml` spec, run `xcodegen generate`, and verify the build with `xcodebuild -scheme MyApp -destination 'platform=iOS Simulator' build`.

## 2. SwiftUI API Availability Gate (`references/ios-scaffold.md`)

**The Mechanic:** Prevents runtime crashes on older devices by forcing the agent to verify SwiftUI feature support against the `IPHONEOS_DEPLOYMENT_TARGET`.
**The Logic:**
GSD maintains a mapping of minimum iOS versions for common APIs (e.g., `NavigationStack` -> iOS 16, `SwiftData` -> iOS 17). If a plan uses an API newer than the target, the agent is forced to either (a) raise the deployment target or (b) wrap the call in `#available(iOS NN, *)`.

## 3. First Principles Thinking Model (`references/thinking-models-research.md`)

**The Mechanic:** A "System 2" thinking block for the researcher agent.
**The Instruction:** 
Before accepting a technology recommendation, decompose it to its fundamental components. If the agent cannot explain *why* a recommendation is correct from first principles, it must flag the confidence as `[LOW]` regardless of how many sources say it's "best practice."

## 4. Simpson's Paradox Awareness (`references/thinking-models-research.md`)

**The Mechanic:** Prevents the synthesizer from aggregating conflicting research incorrectly.
**The Instruction:** 
When two studies/docs contradict each other (e.g., "Library X is fast" vs. "Library X is slow"), the agent must look for a "hidden variable" split (e.g., "Library X is fast for small apps but slow for large apps"). It must resolve contradictions by identifying these subgroups rather than a majority vote.

## 5. Survivorship Bias & Confirmation Bias Counters (`references/thinking-models-research.md`)

**The Mechanic:** Forces the agent to actively search for failure.
**The Instruction:** 
- **Survivorship:** The agent *must* search for projects that ABANDONED a technology (e.g., "migrated away from X").
- **Confirmation:** The agent *must* spend one full research cycle searching strictly for criticisms and alternatives to its own initial hypothesis.

## 6. Steel Man Alternative Analysis (`references/thinking-models-research.md`)

**The Mechanic:** Strengthens the competition before dismissing it.
**The Instruction:** 
Before recommending against an alternative, the agent must construct its **strongest possible case**. If the "Steel Manned" alternative is competitive, the decision must be escalated to the user with a `[NEEDS DECISION]` flag.

## 7. Pre-Mortem Analysis Model (`references/thinking-models-planning.md`)

**The Mechanic:** De-risks the plan before execution.
**The Instruction:** 
The planner must assume the plan has *already failed* and list the 3 most likely reasons (missing dependency, wrong decomposition, etc.). It then adds specific verification steps to the plan to catch those failures in Task 1 or 2.

## 8. MECE Task Decomposition (`references/thinking-models-planning.md`)

**The Mechanic:** Ensures plan integrity (Mutually Exclusive, Collectively Exhaustive).
**The Instruction:** 
The planner must verify that: (1) every requirement maps to exactly one task's `<done>` criteria, and (2) if two tasks touch the same file, they modify different sections or serve different requirements, preventing merge conflicts.

## 9. Reversibility Test (Analysis vs Cost) (`references/thinking-models-planning.md`)

**The Mechanic:** Optimizes the agent's "thinking time."
**The Instruction:** 
Classify decisions as **REVERSIBLE** (low cost to change later) or **IRREVERSIBLE** (high cost/migration needed). The agent is instructed to spend analysis time proportional to the irreversibility of the decision, preventing it from over-analyzing cheap choices.

## 10. Curse of Knowledge Counter (`references/thinking-models-planning.md`)

**The Mechanic:** Scrubs instruction ambiguity between the Planner and the Executor.
**The Instruction:** 
The agent must re-read every `<action>` tag as if it has **never seen the codebase**. It must replace all vague nouns/verbs with specific file paths, function names, and expected side-effects to ensure the executor doesn't have to "guess" the intent.
