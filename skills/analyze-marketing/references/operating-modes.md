## Operating Modes

### Mode 1: Full Scan (Iterative)

Mine all features across multiple conversations. Each session handles 3-4 features.

**First invocation:** Start with highest-value unmined features.
**Subsequent invocations:** User pastes the follow-up prompt -> skill picks up where it left off.

### Mode 2: Single Feature

Mine one named feature. Fits in a single conversation.

### Mode 3: Refresh

1. Read tracker -> check `last_mined` dates
2. Compare against spec file modification times (use `stat` or `ls -l`)
3. Only re-mine specs modified since `last_mined`
4. If nothing changed, report "All features current" and stop
5. **Weight-correction pass:** For each re-mined feature, scan existing insights for `"status": "pending_validation"` or `"weight_note"` containing "Planned feature". Check the spec's Implementation Notes using sync-spec-code status model:
   - `RESOLVED` / `FIXED`: treat as live. Remove planned-feature penalty, recalculate weight, update status, clear `weight_note`.
   - `UPDATED`: treat as live only if behavior is verified equivalent at the new reference; then remove penalty and refresh provenance.
   - `DRIFT` / `REVERTED`: do not treat as live. Keep penalty or mark affected insight `deprecated`/`pending_validation` and flag in output.
6. **Foundation consistency check:** After correcting any insight's key facts, scan the context doc's foundational sections for occurrences of the old value. Flag mismatches in "Suggested Foundation Updates" with exact location and old -> new value. Do NOT auto-edit foundational sections.
7. **Status alignment gate (required):** Before finishing Refresh, fail the run if either:
   - an insight still has planned penalties while source evidence is qualifying live status (`RESOLVED`/`FIXED`, or verified `UPDATED`)
   - an insight is still marketed as live while latest status is `DRIFT` or `REVERTED`
   Report exact insight IDs that need correction.

### Mode 4: Foundation

Initialize or update the foundational sections (1-12) of the context doc.

**Auto-draft from codebase** (new projects): Read README, landing pages, specs, package.json. Draft foundational sections. User reviews and corrects.

**Incremental update** (during mining): When mining reveals new evidence for a foundational section, add to "Suggested Foundation Updates" list. Present at end of session for user approval. Never auto-edit foundational sections.

**Foundational sections** (from marketing framework):

| # | Section | What to capture |
|---|---------|----------------|
| 1 | Product Overview | One-liner, what it does, category, type, business model |
| 2 | Target Audience | Who, primary use case, jobs to be done |
| 3 | Core Problem | What breaks, why alternatives fail, cost of inaction |
| 4 | Switching Dynamics | Push (frustrations), Pull (attraction), Habit (inertia), Anxiety (risk) |
| 5 | Competitive Landscape | Direct, secondary, indirect competitors + why they fall short |
| 6 | Differentiators | Capabilities alternatives lack, why better |
| 7 | Objections & Anti-Personas | Top objections + who is NOT a fit |
| 8 | Customer Language | Verbatim phrases, words to use/avoid, glossary |
| 9 | Brand Voice | Tone, style, personality |
| 10 | Proof Points | Stats, testimonials, value themes |
| 11 | Quick Stats Reference | Citable numbers for copy |
| 12 | Goals | Business goal, conversion action, current metrics |

### Mode 5: Compact

Remove low-weight insights from the context doc to bring it back under the 500-line threshold. The tracker is never modified — all insights remain there.

**When to run:** Context doc exceeds 500 lines, or user explicitly requests compaction.

**Steps:**
1. Read context doc, count total lines
2. Identify compaction candidates: insights with `weight < 55`, legacy pre-structured content that duplicates tracker data
3. Remove candidates from context doc (NOT from tracker — tracker is the source of truth)
4. Update section header date
5. Report: lines before, lines after, insights now tracker-only

**Never compact:** weight >= 55 insights, foundational sections (1-12), narratives, any content added in the last 7 days.

### Mode 6: Capability Combinations

Cross-feature combination reasoning. Read `references/capability-combinations.md` for the full process and ExampleProduct-specific combination patterns to test.

**When to run:** After a full scan completes, user asks for combination reasoning, or a new high-value feature is added.

### Mode 7: Quality Eval

Systematic evaluation pass across all mined content. Read `references/quality-eval.md` for the 10 eval criteria and output format.

**When to run:** After Mode 6 completes, when insights feel generic, or after major spec changes. Do NOT run during active mining.

### Mode 8: Persona Validation

Construct virtual buyer personas from mined data and have them interrogate the marketing context. Read `references/persona-validation.md` for the full process.

This is NOT a generic interview. Every persona is built from actual audience segments, pain points, and insights already extracted. The personas then "read" our marketing at three touchpoints (first encounter, evaluation, decision) and surface gaps, wrong-voice issues, and missing objection handling.

**When to run:** After 8+ features are mined AND Mode 4 (Foundation) has been run. Run when you want to validate that the marketing context actually speaks to real buyers, not just documents features.

**Output:** Per-persona coverage scorecards + unified gap list with prioritized actions (new mining needed, copy rewrites, foundation updates).

### Mode 9: Completeness Gap-Check (missed-opportunity audit)

Independent, blind product-vs-context audit that hunts for what the context does NOT say. Read `references/completeness-gap-check.md` for the full protocol (surface inventory from pages/function-slugs/flags — not just specs; blind two-phase reviewer; owner surface-check; remediation under the no-loss discipline; coverage ledger).

**When to run (MANDATORY, not optional):** before declaring any refresh/foundation pass "complete"; before the context feeds a marketing plan, campaign, or major copy wave; whenever the owner questions coverage; or 30+ days since the last gap-check. **Origin:** 2026-07-15 example-marketplace — a passing refresh still missed ~12 live sellable capabilities that a blind dual review caught; the author re-reading their own output can verify correctness but never absence.

---
