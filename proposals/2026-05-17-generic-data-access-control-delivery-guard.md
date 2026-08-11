# Framework Improvement - 2026-05-17 - Generic Data Access Control Delivery Guard

**Status:** DRAFT
**Severity:** HIGH - persistence-layer authorization drift can expose customer, tenant, owner, admin, audit, token, payment, or operational records even when UI and backend gateway code look correct.
**Risk class:** security / hot-path / data-boundary
**Proposed validator path:** `test-framework/evals/tier-1/validate-data-access-control-guard.sh`
validator_path: `test-framework/evals/tier-1/validate-data-access-control-guard.sh`
failure_class: persistence-authorization-drift
promotion_signal: A repo changes a persistence authorization boundary, direct data-client call, schema policy, migration, grant, rule, or service-role/admin bypass without a provider-neutral data-access-control task and actor probe evidence in the delivery graph.

## Evidence

- **Source:** Example Marketplace RLS hardening discussion on 2026-05-17.
- **Finding:** The framework has strong Base44-specific RLS doctrine, and some generic security-rule probe language, but no dedicated provider-neutral skill/guard for persistence-layer authorization. Supabase/Postgres should not be solved as a one-off separate from Base44; both are provider adapters under the same failure class.
- **Read-only inventory:** Searching installed/local skills for Supabase/Postgres/RLS/data-access skills found no Supabase or Postgres RLS skill. The only concrete RLS doctrine was Base44-specific, plus unrelated Supabase mentions for Docker local-dev behavior and design/launch references.

## Diagnosis

The generic failure mode is **persistence-layer authorization drift**:

1. A repo changes entities, tables, policies, rules, migrations, ORM schema, service-role functions, or direct frontend data calls.
2. The normal feature/testing route validates the product journey, but not the storage-layer actor boundary.
3. The UI may hide buttons and backend functions may enforce ownership, while a direct data client, service role, grant, policy, or rule still permits unintended access.
4. Review may catch this late, but route-time task graphs do not force authorization matrix, actor probes, deploy/readback, and mapped journey evidence as first-class obligations.

Current framework state is partial:

- `skills-manifest.json` registers `rules/base44/rls-policy.md` as a Base44 stack correction.
- `review-security` says Base44/Supabase/Firebase-style entity security needs before/after probe evidence, but the concrete audit path is Base44-specific.
- `review-gate` requires probe evidence for access-control/RLS/IAM/function auth changes, but has no provider-neutral detector or delivery-graph family for data-access work.
- `rules/docker-local-dev.md` mentions Supabase/Postgres only for local container restart policy, not data authorization.

This leaves Base44 better-covered than Supabase/Postgres/Firebase/Firestore/ORM-backed apps, and it leaves direct data-client calls and service-role/admin bypasses dependent on reviewer memory.

## Required Framework Change

### F-001 - Add a provider-neutral `data-access-control` skill

Create a reusable skill that applies whenever a change touches a persistence authorization boundary, regardless of provider.

The skill should define:

- the authorization matrix: actor, role, tenant/org/customer/location/resource owner, operation, expected allow/deny;
- affected data surfaces: tables/entities/collections/buckets/functions/gateways/direct clients;
- privileged bypasses: service role, admin SDK, backend-only clients, migration roles, generated tokens;
- required proof: before/after unauthorized actor probe, authorized actor probe, privileged gateway still works, product journey still works, deployed/readback state matches intended rules;
- explicit anti-proof: "UI hides the button" is never enough.

### F-002 - Add provider adapters instead of provider-specific one-offs

Start with adapters for:

- **Base44:** `entities/*.json`, `base44/entities/*.json`, Base44 SDK entity calls, `asServiceRole`, `secureOperation`, `coding/write entities/*`, live entity RLS audit.
- **Supabase/Postgres:** `supabase/migrations/**`, `*.sql`, `supabase.toml`, `@supabase/supabase-js` direct calls, `create policy`, `alter table ... enable row level security`, grants, security definer functions, service-role key use, PostgREST exposure.
- **Firebase/Firestore:** `firestore.rules`, admin SDK use, client SDK collection reads/writes.
- **ORM-backed SQL:** Prisma/Drizzle/schema migrations plus server routes that enforce ownership in code while tables remain broadly reachable.

Base44 remains an adapter with deeper known doctrine. It should not be the generic abstraction.

### F-003 - Teach route-workflow and delivery graph to detect `data-access-risk`

Route-time detection should fire for:

- entity/table/collection/storage schema changes;
- SQL policy/grant/RLS migrations;
- direct frontend data client usage such as `client.from(...)`, `base44.entities.*`, Firebase client calls, or generated SDK entity calls;
- backend functions using service-role/admin bypasses;
- auth-sensitive migrations or ownership field changes;
- security-rule or RLS policy changes;
- tests or helpers that query data differently from the app path.

When detected, the compiled delivery graph must insert `data-access-control` before closeout and require evidence families for:

- `authorization-matrix`;
- `unauthorized-actor-probe-before` when proving a gap or changing an existing rule;
- `unauthorized-actor-probe-after`;
- `authorized-actor-probe-after`;
- `privileged-gateway-proof`;
- `deploy-migration-readback`;
- `mapped-product-journey-proof`.

### F-004 - Add closeout validation and stop-guard integration

Closeout must fail or hard-warn when `data-access-risk` is present and any required evidence family is missing.

The guard should integrate with:

- `scripts/compile-delivery-graph.mjs`;
- `scripts/classify-delivery-graph-closeout.mjs`;
- `review-gate`;
- `review-security`;
- `route-workflow` task graph construction;
- any existing security probe validator, extended to accept provider-neutral evidence metadata.

This should be a delivery-graph obligation, not only a reviewer checklist.

### F-005 - Add tier-1 fixtures for provider coverage and false positives

Positive fixtures should include:

- Base44 entity RLS/schema change;
- Supabase migration with `create policy`, `alter table ... enable row level security`, or `grant`;
- frontend `supabase.from("locations").select()` or `base44.entities.Location.list()` call added to a user-facing component;
- backend function using service-role/admin client;
- Firestore rules edit;
- ownership field migration such as `owner_id`, `tenant_id`, `organization_id`, `created_by`, or `location_id`.

Negative fixtures should include:

- README mention of Supabase pricing;
- Docker local-dev restart policy changes;
- UI-only copy change;
- SQL migration that only adds an index and does not touch ownership/auth/policy/grants;
- backend code that uses an already-reviewed gateway without changing data scope.

## Non-Goals

- Do not replace provider-specific skills such as `base44-environment`.
- Do not require a live exploit probe for every harmless schema or index-only migration.
- Do not block all direct data-client usage by policy; require proof that direct usage respects the declared actor matrix.
- Do not make Supabase/Postgres the generic model. They are adapters under a storage authorization contract.
- Do not rely on scanner output, intended policy text, or UI behavior as proof of protection.

## Relationship To Existing Framework Pieces

- `rules/base44/rls-policy.md` remains the Base44 adapter doctrine.
- `review-security` and `review-gate` already know that access-control changes need probe evidence; this proposal moves the obligation earlier and makes provider detection mechanical.
- `validate-security-rule-probe-evidence.mjs` can either be generalized or wrapped by a new validator so evidence can name provider, actor, operation, expected result, actual result, and deployed rule fingerprint.
- The existing helper-query parity rule is adjacent: tests must query through the same data boundary as the app unless the exception is documented.

## Proposed Implementation Path

1. Create `data-access-control/SKILL.md` with the provider-neutral contract and adapter table.
2. Add skill-manifest registration and route-workflow/delivery-graph trigger metadata for `data-access-risk`.
3. Extend delivery-graph compilation to insert `data-access-control` for detected data-access-risk diffs.
4. Extend closeout classification to require the data-access evidence families.
5. Generalize or wrap the existing security-rule probe validator for provider-neutral evidence.
6. Add tier-1 fixtures covering Base44, Supabase/Postgres, Firestore, ORM/service-role, and false-positive cases.
7. Update `review-security` and `review-gate` to delegate provider-neutral data-boundary checks to the new skill while keeping Base44-specific audit commands as adapter-specific add-ons.

## Replay Verification

Replay target: Example Marketplace RLS hardening discussion, generalized beyond Base44.

Before this proposal is implemented, a route can see Base44 RLS because a Base44 rule exists, but a similar Supabase/Postgres change has no dedicated skill and may only get generic security review language.

After implementation:

- Base44 entity changes still route through Base44-specific doctrine plus `data-access-control`.
- Supabase/Postgres RLS/grant/policy migrations route through `data-access-control` with a Supabase/Postgres adapter.
- Direct frontend data-client calls route through `data-access-control` even when no schema file changed.
- Service-role/admin bypass changes require privileged-gateway proof and deny/allow actor probes.
- Closeout cannot classify complete unless the compiled delivery graph contains the required data-access evidence families or an explicit justified N/A.

## Acceptance Criteria

- [ ] A `data-access-control` skill exists and is registered in the manifest.
- [ ] Route-workflow/delivery graph can classify `data-access-risk` from file paths and code patterns across Base44, Supabase/Postgres, Firestore, and generic ORM-backed SQL.
- [ ] Base44-specific RLS doctrine remains an adapter, not the generic rule.
- [ ] Supabase/Postgres policies, grants, service-role usage, and direct `supabase-js` calls trigger the generic guard.
- [ ] Closeout requires authorization matrix, actor probes, privileged gateway proof, deploy/migration/readback proof, and mapped journey evidence when data-access-risk is present.
- [ ] Tier-1 fixtures cover positive and negative cases for all initial adapters.
- [ ] Review-security and review-gate point to the generic skill for provider-neutral obligations while preserving adapter-specific commands.
- [ ] The guard can explicitly record justified N/A for low-risk data changes, and the validator tests at least one N/A case.

## Self-Verify

| # | Check | Result |
|---|---|
| 1 | Proposal is atomic | PASS |
| 2 | Base44 is treated as an adapter, not the whole design | PASS |
| 3 | Supabase/Postgres coverage is explicit | PASS |
| 4 | Acceptance criteria are mechanically testable | PASS |
| 5 | False-positive cases are named | PASS |

