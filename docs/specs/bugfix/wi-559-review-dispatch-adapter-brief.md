# WI-559 Bugfix Brief: review and execution dispatch adapter convergence

## Trigger / expected / actual

- **Trigger:** route a reviewed HoursHub named-WI plan through the canonical
  review adapter, then run mandatory execution preflight for owner-selected Grok.
- **Expected:** configured owner-policy review and Grok EXEC tuple are selected;
  exact review/dispatch evidence authorizes implementation.
- **Actual:** four legacy assumptions fail before review or contradict the EXEC
  tuple, leaving execution unauthorized.

**Domain:** code regression in framework compatibility adapters.
**Causal class:** action bug; dispatch never begins.

## Root cause

The WI-551 resolver landed, but the plan adapter, execution preflight, worker/log
transport, and commit guard retained their own policy decisions. Their combined
behavior is a second, inconsistent dispatch engine.

## Smallest safe fix

Keep the owner policy schema, resolver, review launcher, receipt schemas, and
phase guard unchanged. Convert only the active compatibility consumers to:

1. omit mode when not explicitly requested so the resolver uses `default_mode`;
2. delegate station eligibility/selection to the resolver;
3. derive one authoritative numeric or named WI from structured manifest/branch
   evidence, still rejecting absence, ambiguity, and mismatch;
4. resolve the exact EXEC tuple after the matching plan is authorized;
5. dispatch/log Grok with safe installed CLI flags; and
6. make the guard compare recent successful evidence with that exact tuple.

## Proof of fix

- New hermetic Tier-1 fixture for the four original failures and negative cases.
- Existing external-review launcher, WI-551 resolver, review-topology, and
  cross-host acceptance validators.
- Installed Grok CLI help/version proof: 1.0.5 exposes the required safe flags.
- Post-land replay from the original HoursHub worktree before any product edits.

## Pillar Revisit Audit

The complete eight-pillar audit and coverage matrix are in
`docs/specs/work-items/WI-559.md`. Journey, AC, architecture, and operations are
affected and bundled; product fit, UX, UI, and cost are unchanged or N/A.

## Pattern Scan

The scan found one bounded active dispatch-consumer family. No independent
correction was bundled; unrelated closeout-only numeric WI parsing is excluded.

## Register Discoveries

Single correction — no decomposition needed.

## Affected artifacts

WI-551, the review-plan/execute dispatch references, focused fixtures, framework
state/capabilities, and the downstream HoursHub review log after successful replay.

## Learnings

Test central policy migrations through every adapter and enforcing guard using a
deliberately non-default policy shape; unit-testing only the resolver is insufficient.
