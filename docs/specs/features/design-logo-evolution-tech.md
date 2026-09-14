# Technical Design — WI-141: Design-Logo Evolution

**Status:** BASELINED
**Date:** 2026-05-05

## Decisions

1. **No new runtime dependencies.** All changes are markdown + bash. No npm/python/rust packages.
2. **No auth/payment/PII surface.** Skip `review-security` per `references/skip-conditions.json`.
3. **SKILL.md rewrite strategy:** Surgical — delete Phase 9b + handoff sections (~40 lines), then insert new phases at correct positions. Preserve all existing phases (0-7, 10-14) where unchanged.
4. **Validator harness:** Portable bash with `set -euo pipefail`. `validate-design-logo-no-handoff.sh` greps for 6 forbidden phrases. `validate-design-logo-ledger.sh` checks YAML frontmatter in `concept-ledger.md`.
5. **Exemplar bank format:** Append to existing `exemplar-bank-2026.md` using the same entry template (ID, mark, sector, principle, anti-copy, transferable-to, why-it-works, hook-discoverability).
6. **Intent-routing:** Append 1 paragraph to `route-workflow/references/intent-routing.md` under the existing "visual asset / image" section.
7. **Framework learnings:** Append 3 JSONL lines to `references/framework-learnings.jsonl`.

## Risk

- **Low:** Pure documentation/skill rewrite. No code execution paths changed.
- **Mitigation:** Tier-1 validators catch forbidden phrases and ledger schema drift.

## Industry Grounding

**Source:** `docs/specs/analyze-competitors.data.json` (framework-internal design-skill change; no product competitor dataset applies)
**Landscape state:** inapplicable
**Gate verdict:** SKIP
**Branch taken:** inapplicable

### What the industry does (baseline from training + live data)

Brand-design systems commonly preserve exemplar banks, concept ledgers, and explicit anti-copy constraints so logo work does not collapse into a generic handoff or imitation exercise.

| Competitor | Mechanism | Path | Cost / Constraint |
|-----------|-----------|------|-------------------|
| Brand identity workflows | Exemplar review plus concept rationale | Moodboards, ledgers, and review notes | Requires taste judgment and provenance discipline |
| Agentic design prompts | Direct generation from a brief | Prompt-only iteration | Fast but prone to generic or copied marks |

### What we're doing

The framework keeps `design-logo` as a documented skill workflow: remove handoff language, add concept-ledger checks, preserve exemplar-bank structure, and validate the no-handoff contract with tier-1 scripts.

### Why we differ (or align)

This aligns with professional identity work by requiring rationale, provenance, and iteration evidence before treating a mark as usable. It differs from prompt-only logo generation by making the concept ledger and no-handoff validator part of the framework contract.

### Reversibility

Two-way door. The exemplar-bank format and validator phrases can evolve without changing runtime code or user data.
