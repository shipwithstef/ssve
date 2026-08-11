# gbrain Intelligence Models — Details

## 1. Personality & Mission (SOUL.md)

gbrain uses a **Soul Audit** interview process to generate the agent's identity.
- **Vibe Calibration**: Calibrates tone (Formal, Direct, Technical, Casual) against user preferences.
- **Mission Mapping**: Identifies user goals to prioritize relevant knowledge capture.
- **Operational Cadence**: Defines "Heartbeat" intervals for briefings and maintenance.

## 2. Salience & Emotional Weight

gbrain ranks information by its "importance" to the user:
- **Take Count**: More takes (opinions/reflections) on a page increases its weight.
- **Emotional Score**: Sentiment-aware analysis that prioritizes life events over routine logistics.
- **Salience Boost**: Injected into search rankings so "what matters" surfaces first.

## 3. The Take/Fact Lifecycle

gbrain distinguishes between objective facts and subjective perspectives (takes):
1.  **Extraction**: Haiku extracts atomic claims from chat.
2.  **Verification**: Agents cross-modal verify facts against world-state.
3.  **Consolidation**: Sonnet clusters multiple facts into a single, high-fidelity "Take."
4.  **Decay**: Old or contradictory takes are flagged and eventually consolidated.

## 4. Requirement Traceability (Cathedral II)

For development brains, gbrain implements a symbol-aware graph:
- **Symbol Indexing**: Classes, functions, and methods are treated as first-class entities.
- **Edge Extraction**: Automatically maps `calls`, `references`, and `implements` relations.
- **Gap Detection**: Scans requirements against implementation edges to find missing code.

## 5. Self-Evaluation (Takes Quality Rubric)

A 5-dimensional rubric used to benchmark model quality:
- **Accuracy**: Faithfulness to source text.
- **Attribution**: Correct speaker/holder identification.
- **Calibration**: Confidence weight alignment (0.05 grid).
- **Classification**: Correct kind assignment (fact, bet, hunch).
- **Signal Density**: Information value vs. metadata noise.

## L4 Pointers

- **Soul Audit**: `skills/soul-audit/SKILL.md`
- **Signal Detection**: `skills/signal-detector/SKILL.md`
- **Quality Rubric**: `src/core/takes-quality-eval/rubric.ts`
- **Code Graph**: `src/core/link-extraction.ts`
