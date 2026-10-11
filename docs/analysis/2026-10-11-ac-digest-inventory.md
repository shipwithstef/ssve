# AC-digest inventory (before Gate C)

Date: 2026-10-11. Scope: every place that writes or reads the plan-manifest AC digest
(`ac_digests`, `spec_ac_table_sha256`, `normalize-ac-table.mjs`). Line numbers are from
branch `organism/s11-gov`; re-grep before editing.

## What the digest is

`plan-manifest.ac_digests` = `{ spec_path, spec_ac_table_sha256, entries[{ac_id, digest, anchor}] }`.
The hash is `acTableSha256(specText)`: a sha256 over the normalized AC signatures of the spec.
It is a navigation index; the live spec stays the authority. Required for plan-manifest
`schema_version >= 3`; v1/v2 are grandfathered.

## Producers (write or compute)

| File:line | What it writes or computes |
|---|---|
| `scripts/lib/normalize-ac-table.mjs:27,46,74` | `extractAcSection`, `acSignatures`, `acTableSha256`: the only hash definition. Insensitive to checkbox/progress and proof-column edits. |
| `skills/plan-changeset/SKILL.md:354-357` | Instructs the planner to author `ac_digests.spec_path`, `.spec_ac_table_sha256` (via the node one-liner on the helper above) and `.entries[]`. |
| `skills/plan-changeset/references/manifest-templates.md:155,169` | Manifest template for v5 bodies; same fields. |
| `scripts/prepare-plan-handoff.mjs:59` | Builds the spec reader used to validate a handoff body that carries `ac_digests`. |
| `scripts/lib/transmutation-seal.mjs:235` | Runs `validatePlanBody` over the transmuted body, which includes the AC binding check. |
| `scripts/emit-receipt.mjs:210-215` | Emits the plan-manifest receipt; drops `ac_digests` from `required` for v<3. |
| `agents/svc-stage-plan.md:67` | Stage summary baton field `ac_digest_sha`. Name differs from the schema field `spec_ac_table_sha256`; no script reads it. |

## Consumers (read or verify)

| File:line | What it reads | Effect |
|---|---|---|
| `scripts/lib/plan-manifest-contract.mjs:141` | `ac_digests` required for `schema_version >= 3`. | Receipt invalid without it. |
| `scripts/lib/plan-manifest-contract.mjs:174-182` | Shape check, then recompute `acTableSha256(readSpec(spec_path))` and compare; derives spec AC ids with `acSignatures`. | `stale authoritative AC binding` fails the body. |
| `scripts/lib/plan-manifest-contract.mjs:274` | Embeds the authoritative AC section (`extractAcSection`) into the per-task handoff chunks. | Executor prompt content. |
| `scripts/check-chain-receipts.mjs:834-838` | Version gate on `ac_digests` requirement. | Chain validator. |
| `scripts/check-chain-receipts.mjs:1130-1160` | Recomputes the hash from `git show <sha>:<spec_path>`; fails on a missing spec, bad hex, bad path, or mismatch (`baton STALE`). | Pre-push / CI receipt check. |
| `scripts/lib/receipt-issuance-epoch.mjs:312-316,408-409` | Bootstrap snapshot must carry the same hash as the body; recomputes it from the spec; copies `spec_path` and hash into `specBindings`. | Issuance epoch for the pinned bootstrap v4 snapshot. |
| `scripts/emit-receipt.mjs:210-215` | Same version gate on emit. | Emit-time validation. |
| `scripts/overengineering-index.mjs:56` | `acIds(plan)` reads `ac_digests.entries[].ac_id` to count ACs. | Advisory score only. |
| `skills/execute-changeset/SKILL.md:9`, `audit-implementation/SKILL.md:13`, `land-changeset/SKILL.md:11`, `verify-promotion/SKILL.md:13` | Declare `plan-manifest.json#ac_digests` as a first read ("nav index; live spec stays authoritative"). | Prompt contract. |
| `agents/svc-stage-exec.md:23`, `agents/svc-lens-spec-fidelity.md:21,24`, `svc-lens-security.md:20`, `svc-lens-correctness.md:21` | Read the baton; the spec-fidelity lens maps every `entries` row to a diff hunk. | Review lenses. |
| `references/stage-context-isolation.md:37`, `schemas/stage-summary.schema.json:14` | Stage input is the baton (`baton_read`), never a prose recap. | Stage handoff. |
| `skills/write-spec/SKILL.md:191` | Uses `acSignatures` to check the AC table is machine-parseable. | Spec lint. |

## Schemas and docs

| File:line | Role |
|---|---|
| `schemas/receipts/plan-manifest.schema.json:255,740-752,981-997` | Declares `ac_digests`, `spec_ac_table_sha256` (top level and inside the v5 `allOf` branch). `required` is enforced only by the custom validators, not a JSON-Schema run. |
| `references/chain-receipt-contract.md:55-72` | Baton contract: navigation not authority; staleness binding. |

## Tests and validators that depend on it

| File | Depends on |
|---|---|
| `test-framework/evals/tier-1/validate-baton-ac-binding.sh` | Schema `required`, hash stability across progress/proof edits, `check-chain-receipts` recompute, version-gate bypass. |
| `test-framework/evals/tier-1/validate-planning-signals.mjs` | `ac_digests.entries[].ac_id` read by the overengineering score. |
| `test-framework/evals/tier-1/validate-conditional-plan-blueprints.sh:89,149` | Fixtures with a zero hash and empty `entries`. |
| `test-framework/evals/tier-1/validate-risk-triggered-contracts.sh:475` | Fixture with `ac_digests: {}`. |
| `test-framework/evals/tier-1/validate-retroactive-attestation.sh:11` | Copies `normalize-ac-table.mjs` into a sandbox. |
| `test-framework/evals/tier-1/validate-external-review-launcher.sh:872` | Same copy into a sandbox. |
| `test-framework/evals/tier-1/validate-two-box-transmutation.sh` | Imports `plan-manifest-contract`. |
| `test-framework/tests/delivery-plan-contract.test.mjs:15,36,97-101` | v4/v5 bodies; stale hash rejected, revised spec re-hashed. |
| `test-framework/tests/two-box-receipts.test.mjs:9,33,38` | Builds v4/v5 plan-manifests with the hash. |
| `test-framework/evals/tier-1/fixtures/two-box/canary03-execute-changeset-contract.md` | Frozen copy of the execute-changeset `reads` line. |

## Receipts and validators that fail if the digest changes

1. `plan-manifest` (v3+): `emit-receipt.mjs` and `check-chain-receipts.mjs` both require the field and, for a present baton, recompute it against the spec in the commit tree.
2. `review-plan`, `exec-record`, `review-exec`, `audit-implementation`: no field of their own, but the chain check fails the whole envelope when the plan-manifest binding is stale.
3. Issuance epoch bootstrap snapshot: pinned to one hash; changing `normalize-ac-table.mjs` output breaks the pinned v4 snapshot.

## Gate C notes

- Any change to `normalize-ac-table.mjs` output changes every stored hash; historical commits then read as STALE at the next range check. Version the normalization rather than editing it in place.
- Two names exist for the same value (`spec_ac_table_sha256` in receipts, `ac_digest_sha` in the stage-plan summary). Nothing reads the second; pick one before Gate C.
- Three scripts recompute the hash from the spec: `check-chain-receipts.mjs`, `plan-manifest-contract.mjs` and `receipt-issuance-epoch.mjs` (line 316, bootstrap snapshot check). Every skill and agent consumer trusts the field as written.
