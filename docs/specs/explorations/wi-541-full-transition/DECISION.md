# Decision: WI-541 Full Framework Transition

## Selected approach

**A1 — small pure enforcement primitives with existing consumers.** Preserve the current controller, worktree, receipt, hook, learning-ledger, and install architecture; make its missing seams executable and verified.

## Confidence

High: researched across current source/runtime plus official worktree, locking, provenance, authorization, Codex subagent, and hook contracts; analyzed against all W541-01..25 criteria. No pre-plan prototype was needed or authorized because the differentiator is architectural fit, not an unknown algorithm or performance claim.

## Evidence chain

- Problem framing: `PROBLEM_BRIEF.md`
- Alternatives: `SOLUTION_MAP.md` — 4 paradigms, 8 approaches
- AC analysis: `ANALYSIS.md`
- Technical baseline: `docs/specs/tech/wi-541-full-transition.md`
- Approval/proof packet: `docs/specs/decisions/wi-541-solution-confidence/SOLUTION-CONFIDENCE.md`

## Why this approach

- It is the only option that satisfies the full W541-01..25 denominator without a new service, database, policy language, or history migration.
- It keeps authorization and containment explicit and domain-specific, which makes foreign/path/generation/replay negatives reviewable.
- It reduces, rather than adds, sources of truth: chain topology and plan evidence each get one executable contract.
- It preserves local-first, offline fixtures and all-host content-addressed installation.
- It provides controller fallback and future generated-topology evolution without baking either into unsafe heuristics.

## Why not the alternatives

- **Universal policy engine:** more abstraction than evidence supports; risk of becoming the next inert mechanism.
- **Full manifest generation:** current manifest arrays have intentionally distinct roles and cannot safely serve as an implicit universal policy source.
- **SQLite control plane:** strong transaction model but disproportionate migration and audit-byte risk for bounded file-state defects.
- **External service:** conflicts with local-only, offline, credential-free, zero-provider-cost operation.
- **Controller-only:** valuable fallback, but fails required contained mutation and promotion-recovery capabilities.
- **Docs-only:** preserves every reproduced false-green.

## Runner-up

**B2 — generated topology hybrid.** Choose it after a future explicit manifest-role migration creates a dedicated exact mandatory-chain array and proves byte-stable generation across every lane consumer.

## Impact on technical design

- [x] No changes needed; the baseline is confirmed.
- [ ] Tech design revised.

The solution-confidence options, rejected alternatives, action packet, and proof gates already reflect this decision. Planning may proceed automatically under `design_auto`.
