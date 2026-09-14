# Proposal — RLS Pattern for Entities With Derived (Cross-Entity) Ownership

**Filed:** 2026-04-28
**Status:** proposed
**Severity:** HIGH (blocks ~30% of WI-115 entities; affects any multi-tenant Base44/Supabase project)
**Affects:** `audit-entity-rls` (proposal); `references/knowledge/domains/base44/CAPABILITIES.md`

## Problem

Most platform RLS engines (Base44, Supabase, Firebase) match rules against **fields on the entity record itself** plus the **requesting user's claims**. They do NOT support cross-entity joins in policies — you cannot write a rule like "this Exception is writable if Location[exception.location_id].owner_id == user.id".

This is fine for entities with a direct ownership field (Location.owner_id, BankAccount.user_email). It is a problem for entities whose ownership is **derived** through a foreign key:

| Entity | Owner-by-traversal |
|---|---|
| Exception | Location[location_id].owner_id |
| WeeklyHours / WeeklyBreak | Location[location_id].owner_id |
| Item / Deal / FlashSlot | Location[location_id].owner_id |
| EmployeeBreak | Employee[employee_id].user_email |
| Shift | Employee[employee_id] OR TeamMember[…] |

A naive RLS encoding `{ "owner_id": "{{user.id}}" }` cannot work — the field doesn't exist on the entity. There are three real fixes; the proposal picks one as the canonical svc pattern.

## Three options

### Option A — Denormalize owner_id

Add `owner_id` (or equivalent) as a top-level field on the derived entity. Populate at create time from the parent entity. Maintain on parent ownership transfer via a trigger / hook.

**Pros:** RLS rule mirrors the parent entity exactly (`owner_id == {{user.id}}`); one platform-native pattern across all entities.
**Cons:** schema migration on every derived entity; per-entity backfill; risk of drift if `Location.owner_id` changes and Exception.owner_id isn't updated; doubles ownership-data surface.

### Option B — Defense-in-depth with role check + secureOperation

RLS rule: `{ "user_condition": { "user_type": "owner" } }` for writes. This blocks customers/anonymous users via direct API but does NOT enforce per-location ownership at the entity layer. Per-location authorization stays in the `secureOperation` function gateway (existing pattern).

**Pros:** zero schema changes; ships fast; blocks 95% of the actual attack surface (anonymous + non-owner users).
**Cons:** any owner can write to any other owner's Location-derived entities via direct SDK (in theory). Mitigated by the fact that no realistic attacker has owner credentials yet, and `secureOperation` is the single authoritative gateway.

### Option C — Custom RPC / function gateway

Move all writes through a custom function that does the ownership check server-side, return 403 otherwise. Disable direct entity API for the derived entity.

**Pros:** strongest enforcement.
**Cons:** breaks every direct-SDK call site; large refactor; defeats the purpose of having RLS as a primary defense.

## Recommendation

**Pre-launch:** Option B for B4-B8 derived-ownership entities. Ship now, fail-closed on direct anonymous/customer access. Document the per-owner-cross-write risk explicitly in `docs/specs/audit/wi-115-rls-recommendations-from-dashboard.md`.

**Post-launch (if multi-tenant adversarial behavior emerges):** migrate to Option A entity-by-entity as a B9 batch. The migration is mechanical: add `owner_id` field, backfill, swap RLS rule.

**Never Option C** unless platform RLS turns out to have a critical gap not addressable by A or B.

## Proposed change

1. Document the three-option choice in `references/knowledge/domains/base44/CAPABILITIES.md` § RLS Limitations.
2. Add a "Derived Ownership Decision" subsection to the `audit-entity-rls` skill spec — when ranking entities for deployment, the skill must classify derived-ownership entities and choose A or B per the recommendation above.
3. Make the choice per-entity, not project-wide. Some derived entities (Exception, WeeklyHours) where `secureOperation` already does the ownership check are fine on Option B; others where direct SDK access is heavier (Item, Deal, FlashSlot) may justify the Option A migration cost.

## Severity

HIGH — without this pattern, ~30% of WI-115's 73 remaining entities cannot be RLS-enforced cleanly. The proposal unblocks the whole batch.

## Source

Example Marketplace WI-115 first deployment (AuditLog) surfaced this on entity #2 lookahead. Exception/WeeklyHours/Item/Deal all hit this gap immediately when picking the next target after AuditLog.
