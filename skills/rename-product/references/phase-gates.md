# Rename-specific gates

Lane 10 and `skills/design-ui/templates/infra-cutover-runbook.md` own the phase order, soak, and decommission. This file is only the rename rules those documents do not state. A phase is finished when its evidence file exists and names the fields below.

The runbook's "uninstall target" and "source removed" steps are Phase 20+ deletion, not earlier rollback. Rollback retains the new estate until Phase 20+ (`retire-cloud-resources`) has finished its own dependency and data checks. Until then, do not delete it. Old production is not restarted after decommission; before that, rollback follows the runbook (unfreeze the source, return traffic).

## Recorded approval

Write one block per step. A later step needs its own block. The owner supplies `incremental_cost` from their source. Leave the field blank rather than inventing a figure. This skill does not treat the block as written until the owner has approved that step in the session.

```text
approval: spending | stop-production | rotate-credentials | switch-traffic | deploy
scope: <which resources or origin>
resource_plan: <path of the plan the owner approved>
incremental_cost: <owner-supplied figure, spending blocks only>
approver: <owner>
recorded: <date>
```

- `spending` before each new stage resource (P2) and again before each new production resource (P3). `plan-blast-radius` SEV-4 does not replace this block.
- `stop-production` before stopping old production.
- `rotate-credentials` before rotating a credential. Keep the new secret out of the receipt.
- `switch-traffic` before P4.
- `deploy` before each deploy. `verify-promotion` covers that release. This block is the owner's approval to deploy it.

## P3 production data, before P4

The stage copy in the runbook is not the production migration. Before P4, the P3 receipt names all four:

1. Reviewed production migration: the `plan-changeset` manifest and finished `review-plan` for the data move.
2. One consistent snapshot or replication checkpoint, the same identifier on the source and the destination.
3. Destination content reconciliation against that checkpoint: names and counts, or a checksum manifest. No secret values.
4. Application-level read and write verification on the destination, against the new identity, before any traffic switch.

If production holds user data the new identity cannot accept, stop and record an owner decision before any relying-party change. Copying ciphertext is not an account migration.

## P4 probes

A probe matrix with host, method, path, and expected status. Sample on the interval the plan names. Every expected sample must be present. A missing observation fails the gate. Record timestamp, host, status, and pass or fail. No bodies, no secret URLs.

- Safe methods redirect to the same path and query on the new origin.
- Mutating API calls return gone, with a pointer. They are not redirected into a write on the new host.
- Do not follow redirects while probing.
- A private old origin is proven by an authenticated request that sees the redirect or the gone response.
- Immutable historical deployment URLs may keep serving old builds. List them. Do not link them.

## P5 Phase 20+

This skill does not delete. When `retire-cloud-resources` is in the framework manifest, the receipt is that skill's outcome. When it is not, the outcome is `deferred`, the frozen resources stay, and P6 and P7 still finish. `deferred` is not a successful retirement.

## P6 and P7

P6 starts only after production exists and the owner has registered the domain. This skill does not register it and does not contact the registrar. The holding origin then follows the same path and query rules as P4. Keep the holding hostname on the historical deny list.

P7: docs, runbooks, and agent instructions describe the landed name. Historical records and deny-lists stay. The doc change is its own reviewed release when it ships to a place readers treat as current.

## P8

See `references/local-moves-checklist.md`. The operator runs it after the agent session has ended.

## Retrospective

See `references/retrospective.md`.
