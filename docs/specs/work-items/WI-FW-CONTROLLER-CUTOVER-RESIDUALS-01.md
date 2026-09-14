# WI-FW-CONTROLLER-CUTOVER-RESIDUALS-01: Reconcile controller provenance and cutover evidence

**Type:** framework
**Status:** backlog
**Filed:** 2026-09-06
**Lane:** framework
**Source:** proposals/2026-08-10-wi368-execution-controller-v2.md

## Problem

The imported controller proposal uses a product-origin WI368 identifier that
collides with this framework's unrelated verified Tier-3 judge WI-368. The
proposal describes local shadow readiness while real canary and default cutover
remain unproven. Existing WI-529 integration seams and adjacent WI-546 do not
own the entire controller promotion. Do not manufacture that ownership.

## Acceptance criteria

- Resolve original parent, branch, commits and governed landing evidence using
  actual Git objects and remote history. Sol's current read-only check could not
  resolve the merged SHA `0d75cb1d` referenced by framework state in this
  non-shallow repository. Treat it as an unresolved provenance claim; absence
  locally does not prove that the commit never existed elsewhere.
- Reconcile the proposal's P15 HOLD/default-cutover-false and local shadow-ready
  statements against `references/runtime-v2-cutover.md`, current selectors and
  actual source. Identify each current/default/experimental behavior explicitly.
- Preserve full fallback for unknown/global inputs and explicit unmapped-surface
  failure. No default flip from a registry entry or synthetic test alone.
- Before any future opt-in canary or cutover, define the bounded actual workload,
  owner authorization, existing rollback, and required three-run p95 evidence.
  Report unavailable resources honestly; no invented canary or performance gain.
- Attach real review/landing/install evidence to the correct canonical WI and
  source if promotion is pursued. Otherwise retain HOLD with named residuals.

## Boundaries

This is residual ownership, not a new review cycle for the current failed plan,
not a review-cap reset, and not approval of old bypass instructions. Preserve
all original controller and review evidence. No active product session may be
used as an unapproved canary. Swarm/fleet expansion remains deferred; this WI
must not prevent current dedicated-session recovery and clean-main verification
with the currently supported defaults.
