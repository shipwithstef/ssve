# Inventory classes

Read this during P0. The class table in `SKILL.md` is the decision. This file is the record shape.

## Source inventory

The external inventory is Lane 10 Phase 5a source assessment: `docs/specs/migrations/<slug>/source-state.md` (`skills/route-workflow/references/lane-model.md`). The source-tree universe is the Migration / sweep inventory from `plan-changeset` (`skills/plan-changeset/SKILL.md` Step 0 and `skills/plan-changeset/references/archetype-protocols.md`). Link both from P0.

Do not write a second list of resources, configs, secrets, RBAC, integrations, traffic, or dependencies. The only overlay is the rename occurrence class of each linked hit, from the class table in `SKILL.md`. Collect a fact here only when neither inventory states it.

A hit with no class is not edited. Do not mark it Historical to clear it.

## Historical class

A Historical hit stays only when P0 records the path and the reason. That row is the class overlay, not another inventory.

```
path	reason
docs/archive/incident.md	historical write-up keeps the old name
```

## Settings manifest

For every cloud app or service the phase rewrites, write a manifest with these columns. Names and actions only. Never values.

| Column | Meaning |
|---|---|
| preserve | Copy the existing setting. Cryptographic material stays while data it protects still exists. |
| replace | Point the setting at the new estate (connection, origin, worker URL). |
| generate | Create a new secret, set it on every peer in one step, and prove the old secret is rejected. |
| omit | Leave it unset on the new estate. Say why. |
| assert-absent | The deploy fails if this name is present. Use for credentials the new estate must not hold. |

## Dual-read rule

Production-read keys are not a hard rename in the release that switches writers.

- Cryptographic bindings: key purpose strings, key ids, and key bytes. Renaming a purpose makes existing ciphertext unreadable.
- Published compatibility contracts: protocol ids, discovery paths, and headers that other parties already send. Keep them until those consumers have moved, then remove them in their own reviewed release.
- Persisted client state: cookie names and cache keys. Readers still on the old name need a dual-read period.
- Historical deny markers: old hostnames and old resource names stay on the reject list after cutover.

## What does not stay

- User-visible copy, package names, script filenames, and docs that describe the current product.
- Cloud resources whose platform has no rename API. Create the new resource, copy, verify, cut over, then hand deletion to Phase 20+ (`retire-cloud-resources`).

## Third parties

Third-party consoles are already in the Phase 5a integrations inventory. The class is Third-party: the owner changes the other party's console. This skill does not contact that party. A repo edit is not that change.
