# Feature: Design-Logo Skill Evolution — Remove Designer-Handoff Exit, Reach Designer-Grade via AI Alone

**Status:** DRAFT
**Type:** framework
**Consumers:** `design-logo` skill, `route-workflow` skill, `design-logo/references/exemplar-bank-2026.md`
**Priority:** High
**Created:** 2026-05-05
**WI:** WI-141
**Source:** `proposals/2026-05-02-design-logo-evolution.md`
**Companion:** WI-139 (landing-page self-grading fix — same archetype, different skill)

---

## Problem Statement

`design-logo/SKILL.md` (v3) has a Phase 9 saturation gate that routes <65/70 outputs to a designer-handoff brief ("AI ceiling reached → hire human"). In the AI era this is the wrong exit. The framework's own founder explicitly: *"AI ERA → NO DESIGNER. Remove the designer rule. Change to achieve designer-grade creativity."*

Every plateau the skill currently treats as "AI hit ceiling, hand to human" is in fact a **search-space problem** — a constraint hasn't been added that breaks the pattern. The skill has no mechanism to escalate constraints when iterations flatline; it just gives up and produces a handoff brief. Result: real founders never get a designer-grade mark out of the skill.

**Secondary symptoms:**
1. Skill never auto-triggers from ad-hoc image-gen URL pastes (route-workflow gap).
2. No love-test gate — checks are "competent / legible / on-brand" but never "memorable / impressive / lovable."
3. No lockup-stutter test — monogram + wordmark duplication (e.g., "H + Example Marketplace") not caught.
4. Breadth-over-depth — generates new concepts each round rather than refining 2-3 survivors.
5. Founder-shrug not decisive — "fine / okay / I guess" does not trigger saturation failure.

**Without this fix:** every founder running design-logo gets a handoff brief or a ~58/70 mark that feels unspecial. The skill becomes shelfware in the very era it was designed for.

---

## User Stories

### US-1 (design-logo): No designer-handoff exit — plateau is a constraint problem

**As** the `design-logo` skill,
**I need** to delete all designer-handoff language and replace the Phase 9 saturation gate with a constraint-escalation loop that never exits to a human designer,
**So that** founders receive designer-grade marks via AI orchestration alone, and every plateau is treated as "search space not constrained enough" rather than "AI hit its ceiling."

#### Acceptance Criteria — US-1

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-01 | `design-logo/SKILL.md` no longer contains any of: "hire a designer", "designer handoff", "AI ceiling", "human designer", "external designer", "Designer-handoff brief" | — | 🔲 | — |
| LOGO-02 | Tier-1 validator `validate-design-logo-no-handoff.sh` greps SKILL.md for forbidden phrases; non-zero exit on match | — | 🔲 | — |
| LOGO-03 | Phase 9 rewritten: score ≥65/70 → promote with love-test re-check; 60–64 → Phase 8 full pipeline rerun + Phase 8b plateau escalation; 56–59 → all constraints stacked + cross-model judge re-score; <56 → brief broken, re-enter Phase 0 | — | 🔲 | — |
| LOGO-04 | `references/framework-learnings.jsonl` entry: `no-handoff-exit-rule` (confidence 10) | — | 🔲 | — |

### US-2 (design-logo): Concept commitment ledger — depth over breadth

**As** the `design-logo` skill,
**I need** a `docs/specs/logo-pack/concept-ledger.md` that tracks round number + mode (`exploration | refinement | polish | terminal`), with a hard rule that no new concepts may be introduced after round 2,
**So that** iterations focus on refining survivors rather than generating endless new concepts.

#### Acceptance Criteria — US-2

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-05 | Phase 1c concept-ledger schema documented in SKILL.md; ledger tracks `round`, `mode`, `concepts_introduced`, `concepts_advanced`, `new_concepts_allowed_next_round` | — | 🔲 | — |
| LOGO-06 | Tier-1 validator `validate-design-logo-ledger.sh` asserts concept-ledger.md exists for active logo-pack runs and validates round-mode rules (no new concepts after round 2) | — | 🔲 | — |

### US-3 (design-logo): Love-test gate — memorable, impressive, lovable

**As** the `design-logo` skill,
**I need** a Phase 5b love-test gate with 5 explicit questions (tattoo test, $5k test, reverse-jealousy test, 5-year test, stranger test) run on top-3 concepts,
**So that** competent-but-boring marks are caught before promotion, and failures route to constraint escalation rather than handoff.

#### Acceptance Criteria — US-3

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-07 | Phase 5b love-test 5 questions explicit in SKILL.md; each top-3 concept has documented yes/no answer per question in `docs/specs/logo-pack/judging/love-test-<round>.md` | — | 🔲 | — |

### US-4 (design-logo): Lockup-stutter test — disqualify visual duplication

**As** the `design-logo` skill,
**I need** a Phase 7b lockup-stutter check that renders mark + wordmark side-by-side and disqualifies monogram marks that visually duplicate the wordmark's first letter,
**So that** production lockups don't suffer from visual stutter (e.g., "H + Example Marketplace").

#### Acceptance Criteria — US-4

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-08 | Phase 7b lockup-stutter check explicit in SKILL.md; if monogram matches wordmark first letter, mark disqualified for lockup use and loop-back to Phase 3 documented | — | 🔲 | — |
| LOGO-09 | `references/framework-learnings.jsonl` entry: `lockup-stutter-caught-2026-05-02` (confidence 9) | — | 🔲 | — |

### US-5 (design-logo): 5-stage multi-tool refinement pipeline

**As** the `design-logo` skill,
**I need** Phase 8 rewritten as a 5-stage pipeline (geometry refinement → style-transfer iteration → vector trace + kerning audit → motion/context test → sand-grain polish) with per-stage ≥2-point improvement gates,
**So that** AI-orchestrated refinement mimics how senior designers actually work.

#### Acceptance Criteria — US-5

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-10 | Phase 8 documents 5-stage pipeline with explicit stage names, inputs/outputs, and ≥2-point improvement gate per stage | — | 🔲 | — |
| LOGO-11 | Phase 8b constraint-escalation ladder documented with 5-step constraint stack (one-color only → negative space → hidden meaning → ≤5 path ops → brand-vocabulary glyph) | — | 🔲 | — |

### US-6 (design-logo): Founder-shrug as decisive saturation failure

**As** the `design-logo` skill,
**I need** Phase 13 amended so that a founder response of "fine / okay / I guess / sure" after in-app verification is a hard-fail that routes back to Phase 8 Stage A with constraint escalation,
**So that** rubric score cannot override genuine founder dissatisfaction.

#### Acceptance Criteria — US-6

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-12 | Phase 13 founder-shrug rule documented; "fine / okay / I guess / sure" routes to Phase 8 Stage A; cannot be overridden by rubric score | — | 🔲 | — |
| LOGO-13 | `references/framework-learnings.jsonl` entry: `founder-shrug-as-saturation-truth` (confidence 9) | — | 🔲 | — |

### US-7 (route-workflow): Auto-invoke on image-gen URL pastes

**As** `route-workflow`,
**I need** to recognize when a user pastes ≥3 image URLs from known image-gen domains AND mentions logo/mark/brand/concept, and auto-invoke `design-logo` in evaluation mode (skip Phases 1-3, enter at Phase 5 with pasted images as concepts),
**So that** ad-hoc image-gen sessions are formalized into the skill's structured progression.

#### Acceptance Criteria — US-7

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-14 | `route-workflow/references/intent-routing.md` updated with image-gen URL paste detection rule + evaluation mode invocation | — | 🔲 | — |

### US-8 (design-logo references): Exemplar bank hidden-hook entries

**As** the `design-logo` skill,
**I need** `design-logo/references/exemplar-bank-2026.md` extended with ≥10 hidden-meaning / hook exemplars (FedEx, Toblerone, Amazon, Hershey's, Tour de France, Pittsburgh Zoo, Wendy's, Baskin-Robbins, Tostitos, Galleries Lafayette),
**So that** the skill can benchmark concepts against the memorable-hook quality that separates great marks from competent ones.

#### Acceptance Criteria — US-8

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| LOGO-15 | `design-logo/references/exemplar-bank-2026.md` extended with ≥10 hidden-hook entries; each entry documents the hook's discoverability principle (≤200 words per entry) | — | 🔲 | — |

---

## Implementation Notes

- This is a **skill rewrite**, not a new skill. The output format (SVG concepts, judging records, iteration folders, brand system) remains unchanged.
- The `design-logo/SKILL.md` net change is approximately +150 lines after deleting the handoff section (~40 lines).
- No new image-generation tools are introduced; the skill orchestrates existing providers (Codex CLI, Base44 GPT-image).
- Vector trace uses existing `potrace` + manual cleanup pattern.
- Love-test answers are agent-generated + founder cross-checked; no automated LLM-as-judge for "lovability."

---

## Files Touched

| File | Change |
|------|--------|
| `design-logo/SKILL.md` | Major rewrite: delete handoff sections, add Phases 1c/5b/7b/8b, rewrite Phases 8/9/13 |
| `design-logo/references/exemplar-bank-2026.md` | +10 hidden-hook entries |
| `route-workflow/references/intent-routing.md` | +image-gen URL paste detection |
| `test-framework/evals/tier-1/validate-design-logo-no-handoff.sh` | New — greps forbidden phrases |
| `test-framework/evals/tier-1/validate-design-logo-ledger.sh` | New — enforces round-mode rules |
| `references/framework-learnings.jsonl` | 3 new entries |
| `proposals/done/2026-05-02-design-logo-evolution.md` | Move on land |

---

## Revision Log

| Date | Who | What |
|------|-----|------|
| 2026-05-05 | Kimi | DRAFT spec from WI-141 work item + proposal |
