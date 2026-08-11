# Harness Skill Testing Guide — Detail

## Mechanism

Comprehensive methodology for testing generated skills: prompt design, with/without-skill comparison, assertion-based grading, specialized evaluation agents, iterative improvement, trigger verification, and workspace management.

### Test Framework: Qualitative + Quantitative

| Type | Method | Best for |
|---|---|---|
| Qualitative | User reviews output directly | Subjective quality (writing style, design) |
| Quantitative | Assertion-based auto-grading | Objective verification (file generation, data extraction) |

### Test Prompt Writing

Prompts must be realistic, not abstract:
- Bad: "Process the PDF" / "Extract data"
- Good: "Extract the table from page 3 of this PDF and convert to CSV. The table header has 2 rows — first is category, second is actual column names."

Diversity: mix formal/casual, explicit/implicit intent, simple/complex. Include abbreviations, typos, casual speech. Cover: 1 core use case + 1 edge case + 1 complex task.

### With-Skill vs Baseline Comparison

Spawn TWO subagents per test prompt simultaneously:
- With-skill: reads and follows the skill → saves to `with_skill/outputs/`
- Baseline: same prompt, no skill → saves to `without_skill/outputs/`

For skill IMPROVEMENTS: baseline is the previous version (snapshot preserved).

**Capture timing immediately from task notifications** — `total_tokens` and `duration_ms` are only available in the notification and not persisted elsewhere.

### Assertion-Based Grading

Good assertions: objectively true/false, descriptive names, verify the skill's core value.
Bad assertions: always pass regardless of skill (non-discriminating), require subjective judgment.

If assertion can be checked programmatically → write a script (faster, reusable across iterations).

**Non-discriminating assertion:** if both with-skill and without-skill pass it, the assertion doesn't measure skill value. Replace or remove.

Grading schema: `{ text, passed, evidence }` — NOT `{ name, met, details }`.

### Specialized Evaluation Agents

1. **Grader:** assertion judging + extracting verifiable claims from output
2. **Comparator:** blind A/B comparison (anonymized) — use when rigorously comparing versions
3. **Analyzer:** statistical patterns in benchmark data — finds non-discriminating assertions, high-variance evals, time/token tradeoffs

### Iterative Improvement Loop

1. Modify skill based on feedback
2. Re-run ALL tests in new `iteration-N+1/` directory
3. Present results with previous iteration comparison
4. Collect feedback
5. Repeat until: user satisfied, all feedback empty, or no meaningful improvement

**Improvement principles:**
- Generalize feedback (don't overfit to test examples)
- Remove instructions that cause unproductive work (read transcripts, not just outputs)
- Explain WHY, not just WHAT
- Bundle repeated helper scripts into `scripts/`
- Draft → re-read with fresh eyes → improve (don't try for perfect first draft)

### Trigger Verification

20 eval queries: 10 should-trigger + 10 should-NOT-trigger.

**The critical insight: near-miss negatives are the most valuable tests.** "Write a fibonacci function" as a negative for a PDF skill is worthless. "Extract this chart from an Excel file as PNG" (xlsx vs image tool boundary) is a real test.

Should-trigger: diverse phrasings, implicit intent, unusual use cases, competitive with other skills.
Should-NOT-trigger: keyword overlap but different context, adjacent domains, ambiguous phrasing.

**Conflict check:** verify new skill's trigger queries don't activate existing skills.

**Optional auto-optimization:** 60/40 train/test split, measure trigger accuracy, improve description, select best by TEST score (not train — avoids overfitting). Max 5 iterations.

### Workspace Structure

```
{skill}-workspace/
├── iteration-1/
│   ├── eval-{descriptive-name}/
│   │   ├── eval_metadata.json
│   │   ├── with_skill/ (outputs/, timing.json, grading.json)
│   │   └── without_skill/ (outputs/, timing.json, grading.json)
│   └── benchmark.json
├── iteration-2/ ...
└── evals/evals.json
```

Rules: descriptive eval names (not numbers), preserve all iterations, never delete workspace.

## Analysis

- **Useful for:** Any skill creation/improvement workflow. The with/without comparison is the gold standard for proving skill value.
- **Trade-offs:** Comprehensive testing is expensive (2 subagents per test prompt per iteration). Quick validation (1-2 prompts, no baseline) is cheaper but proves less.
- **Similar to:** Anthropic's `skill-creator` has the same with/without pattern (Harness likely derived from it). svc's `test-framework` has comparison mode but doesn't apply it per-skill — it applies it at the pipeline level.
- **Could improve svc by:** Our `create-skill` (forked from Anthropic) already has this infrastructure but we haven't enforced "every new skill gets a with/without test." The near-miss trigger methodology should be added to our tier 1.5 triggering tests. The workspace structure convention (descriptive names, preserve iterations) could improve our test-framework result organization.
- **Assumptions:** Each skill can be tested independently. Some skills (like route-workflow) are harder to test in isolation because they orchestrate other skills.
- **Watch out for:** Non-discriminating assertions are a real trap — they inflate pass rates without proving the skill adds value. Always check if baseline also passes.

## Key Source Files (L4)
- `skills/harness/references/skill-testing-guide.md:1-307` — full testing methodology
- `skills/harness/SKILL.md:315-369` — Phase 6 validation overview
