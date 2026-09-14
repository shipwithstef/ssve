# Applied Knowledge: gbrain — AI Brain Framework

## Distilled Positions

### 1. Memory as a Graph of Typed Facts
> "The user's language IS the insight. Don't paraphrase." (skills/signal-detector)
> "Entity slugs resolve against pages.slug to ensure existing graph and hot memory share identity." (core/entities/resolve)
- **Interpretation:** PERSISTENCE MUST BE ATOMIC AND UNCORRUPTED. gbrain avoids the "AI Summary Slop" by extracting verbatim claims as facts before consolidating them into higher-level takes.
- **Source:** `skills/signal-detector/SKILL.md`, `src/core/entities/resolve.ts`

### 2. Maintenance is Not Optional
> "Dream Cycle composes lint, backlinks, sync, extract, embed into one honest unit of work." (src/core/cycle.ts)
- **Interpretation:** RAG SYSTEMS DEGRADE WITHOUT PROACTIVE CURATION. The 11-phase Dream Cycle is the framework's answer to semantic drift and link rot.
- **Source:** `src/core/cycle.ts`

### 3. Agent Safety via Intent Classification
> "High-stakes ambiguity (architecture, data model) requires STOP and ASK." (preamble/generate-confusion-protocol)
- **Interpretation:** AUTONOMY HAS BOUNDARIES. gbrain uses a "One-Way Door" classifier to physically block agents from destructive operations without a human in the loop.
- **Source:** `src/core/one-way-doors.ts`, `generate-confusion-protocol.ts`

## Cross-Domain Implications

- **For SVC Pipelines:** gbrain's "Dispatcher Pattern" for skills is a direct improvement over flat skill manifests. We should adopt the `(dispatcher for: ...)` clause to reduce token usage and improve routing accuracy.
- **For Memory Extraction:** gbrain's "Notability Filter" (High/Medium/Low) should be integrated into our `manage-learnings` skill to prevent logistical noise from cluttering our knowledge base.

## Contradictions / Open Questions

- **Model Specificity:** gbrain strictly enforces Anthropic for sub-agents. How does this scale for users who prefer Gemini or local models for cheaper background tasks?
- **Git Lock Contention:** How does `gbrain sync --watch` handle rapid file edits from multiple agents in a high-velocity dev environment?

## Recency-Weighted Insights

- **Cathedral II (2026-05):** The framework has shifted from simple page indexing to symbol-aware code graphing. Agents can now "know" who calls a function, not just where the function is defined.
- **Salience Axis (2026-04):** Emotional weight and take counts now influence search ranking, ensuring that the "most important" thoughts surface over routine facts.

## Source Map

- **Architecture**: `details/architecture.md`
- **Mechanics**: `details/core-mechanics.md`
- **Intelligence**: `details/intelligence-models.md`
- **Self-Maintenance**: `src/core/cycle.ts`

## What This Distillation Does Not Capture

- This pass excluded the ~300 test files which likely contain edge-case behaviors and negative controls.
- The OCR and multimodal embedding paths were mapped but not deep-drilled in this pass.
