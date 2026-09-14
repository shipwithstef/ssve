# svc References — Detail

Source: references/*.md (13 files)
Extracted: 2026-04-08

## anti-patterns.md
34 anti-patterns across 8 categories (AP-1 through AP-34). Each has Problem + Fix format. Summary table at end.
- AP-1 to AP-4: Context/token management (orchestrator reads summaries, pass paths not contents, never read auto-loaded skills, constrain searches)
- AP-5 to AP-10: Execution discipline (specific git staging, respect locked decisions, progressive depth, no unrequested artifacts, stay in scope, no "while I'm here" fixes)
- AP-11 to AP-15: Code quality (Chesterton's Fence, don't cargo-cult, existence≠implementation, mock derivation gate, no hardcoded values)
- AP-16 to AP-18: Communication (ask on ambiguity, investigate failing tests, evidence for every claim)
- AP-19: Pushy skill descriptions (aggressive trigger situations, follow-up keywords)
- AP-20: CSO shortcut (never summarize workflow in description)
- AP-21: Anti-sycophancy (verify before implementing reviewer suggestions)
- AP-22: AI Slop blacklist (10 banned generic UI patterns)
- AP-23: Completion markers (## TASK COMPLETE / BLOCKED / CHECKPOINT)
- AP-24: Claim provenance (FROM-SPEC / FROM-CODE / FROM-RESEARCH / ASSUMED)
- AP-25: Untrusted content fencing (<untrusted_content>)
- AP-26 to AP-34: Framework discipline (no unapproved skill substitutions, no ghost executions, no premature handoffs, headless shell interaction hygiene, coupled external state, exhausted runtime verification, no permission-seeking stops, phase receipts, no silent fallbacks)

## verification-patterns.md (236 lines)
4-level verification hierarchy: Exists → Substantive → Wired → Functional.
Stub detection patterns for React/JSX, Node.js/Express, Python.
Wiring detection (exports without imports, routes without consumers).
Integration coherence: 4 boundary mismatch areas (API↔consumer type, paths↔links, state↔updates, endpoints↔hooks).

## context-budget.md (129 lines)
4 degradation tiers: PEAK (0-30%), GOOD (30-50%), DEGRADING (50-70%), POOR (70%+).
Per-tier actions. Key insight: agent has no self-awareness of degradation at POOR.
Read-depth rules: use frontmatter at DEGRADING+, full bodies only at PEAK/GOOD.

## thinking-models.md (174 lines)
5 structured reasoning models for execution decisions:
1. Circle of Concern vs Circle of Control (stay in scope)
2. Forcing Function (constraints that prevent bad decisions)
3. First Principles (decompose rather than analogize)
4. Occam's Razor (simplest explanation first)
5. Chesterton's Fence (understand before removing)
"When NOT to Think" section — skip for mechanical tasks.

## design-alternatives.md (129 lines)
5-ranked alternatives protocol for every key design decision.
Interactive vs Auto mode (user picks vs P0 picks).
Decision logging to docs/specs/decisions/<feature-name>.md.

## feature-toggles.md (141 lines)
Mock-by-default convention. Every external dep gets: toggle (OFF default), mock impl (ON default), real impl (behind toggle).
Toggle registry at docs/specs/toggle-registry.md.

## agent-patterns.md (116 lines)
6 architecture patterns: pipeline, fan-out, expert pool, producer-reviewer, supervisor, hierarchical.
Subagent vs Agent Teams decision tree. Team size guidelines.
Source: Harness.

## subagent-context-rules.md (89 lines)
5 rules: constraint block in every prompt, manifest-scoped file lists, bounded grep depth, no recursive exploration, summarize don't inline.

## browse-integration.md (44 lines)
gstack browse daemon as browser infrastructure. Skills use browser_navigate, browser_snapshot, browser_click, etc.

## knowledge-protocol.md (254 lines)
4-pass extraction protocol: Shape → Frontmatter → Compare → Deep dive.
Two storage layers: references/knowledge/ (library) vs docs/specs/ (project).
Staleness rules: SHA for repos, 7 days for competitors, 30 days for domains.

## skill-pack-comparison.md (274 lines)
svc vs gstack vs superpowers capability mapping across all dimensions.
Documents where each framework is stronger/weaker.

## benchmark-findings.md (269 lines)
Real measured results from framework testing. Covers: write-spec, design-ux, design-ui, design-tech, plan-changeset, review-gate, audit-ac, sync-spec-code, progressive narrowing, cascade discovery, spec-as-index, cache sharing, pipeline integrity, test-journeys, write-e2e.

## pillars-coverage-matrix.md (178 lines)
Canonical 8-pillar contract for product fit, journey, acceptance criteria, UX, UI, tech architecture, cost model, and operations & ownership. Defines allowed states, lane mappings, revisit protocol, and close-out enforcement.

## L4 Pointers
- All reference files: references/*.md
- Blend registry: references/blend-registry.json
- Knowledge index: references/knowledge/INDEX.md
