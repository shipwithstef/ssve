# Proposal — RLS Deployment Order by Caller Surface

**Filed:** 2026-04-28
**Status:** proposed
**Severity:** MEDIUM (improves first-time RLS deployment safety on Base44 / Supabase / Firebase)
**Affects:** `audit-entity-rls/SKILL.md` (proposal already filed); generic to any backend with row-level security

## Problem

When a project has 50+ entities lacking RLS (Example Marketplace WI-115 had 75/76 entities exposed), the natural instinct is to start with the highest-value attack surface (financial entities, PII, payment methods). That instinct produces the WORST first deployment because:

- High-value entities also have the most call sites
- Heavy frontend usage means RLS misconfigurations break customer/owner flows immediately
- A botched first deploy on a high-traffic entity dents confidence in the whole RLS rollout
- Rolling back is messy (entity schema is platform-managed)

A safer ordering exists: **deploy first to entities that minimize observable behavior change**, then expand to higher-value targets once the pattern is proven.

## Recommended ordering criteria (in priority order)

For each entity, compute three signals:

1. **Frontend caller count** — `grep -rn "entities\.X\." src/ | wc -l`. Zero is ideal.
2. **Backend access pattern** — does it use `asServiceRole` exclusively (RLS bypassed by design)? Then adding RLS cannot break app behavior.
3. **Real exploitability** — can a regular user currently `entities.X.list()` or `entities.X.create()` directly via SDK? If yes, the rule is non-trivial to deploy. If no, it's already safe and RLS is just defense-in-depth.

Rank entities by `frontend_callers_asc, then service_role_only_first, then exploitable_first`. Deploy in that order.

## Why this rule exists

Real first deployment 2026-04-28 (Example Marketplace WI-115) picked **AuditLog** as #1 by this ordering:

- Frontend callers: 0
- Backend usage: 100% `asServiceRole` (auditLog/cascadeDelete/deleteUserAccount functions)
- Exploitable: yes — customer SDK probe successfully created a forged audit-log entry pre-deploy

The deployment took 30 minutes end-to-end (probe → deploy → re-probe → smoke E2E → regression guard → ship), broke nothing in the running app, and produced a regression-guard test that prevents silent rollback. Picking a high-traffic entity (User, PaymentMethod, CustomerSubscription) instead would have risked breaking customer flows on first try — exactly the failure mode that delays the entire WI by weeks.

## Companion: do NOT pick by alphabetical order or "highest priority first"

WI-115's filed batch order ranks B1 (financial) first. That's the right business priority but the wrong DEPLOYMENT priority. Reverse them: deploy B8 (low-risk internal/logging entities) and AuditLog first to prove the pattern, then expand. This is the same logic as canary deploys — verify the deployment mechanism before risking the high-value targets.

## Proposed change

Add a **"Deployment Order"** section to the `audit-entity-rls` skill spec (proposal `2026-04-26-audit-entity-rls-skill.md`), formalizing the three-signal ordering. The skill should auto-rank entities by these signals when invoked and refuse to deploy a high-traffic entity until at least 2 zero-caller entities have been deployed and verified.

## How to enforce

- `audit-entity-rls` Phase 0: rank entities by signals above
- `review-gate` G3 for any RLS PR: block if the entity has >5 frontend callers AND fewer than 2 prior RLS deployments exist on the project
- Document the ordering rationale in the WI tracker so future RLS deploys follow the same principle

## Severity

MEDIUM — the alternative (high-traffic-first ordering) is technically possible but produces unnecessary failures. This proposal codifies the safer path.

## Source

Example Marketplace WI-115 first per-entity RLS deployment (AuditLog), 2026-04-28. Pattern took 30min and broke nothing.
