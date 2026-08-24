# Receipt Format Charter (WI-562 IP-R1)

Normative convention set for EVERY new or modified receipt format in svc. Enforcement is mechanical via `scripts/lint-receipt-formats.mjs` over `references/receipt-kind-registry.json` (the machine-readable denominator of all receipt kinds).

## The rules

| # | Rule |
|---|---|
| 1 | `schema_version` is an integer, monotonic, starting at 1. No string versions for NEW kinds (`runtime-projection-v2` is grandfathered). |
| 2 | Timestamp field is named **`ts`**, RFC3339 `date-time`. Legacy aliases (`timestamp`, `completed_at`, …) are tolerated on READ for grandfathered kinds; new kinds write only `ts`. |
| 3 | Keys are snake_case. |
| 4 | Identity fields are UUIDs or content digests shaped `sha256:<64 hex>`. |
| 5 | Schemas use JSON Schema draft **2020-12**. |
| 6 | `additionalProperties: false` by default; open objects require a dated exception entry. |
| 7 | **No schema file ⇒ no emitter may merge** (and at runtime both emit-receipt and check-chain-receipts fail closed on missing schemas — IP-R2). |

## Digest domain (IP-R9)

Receipt integrity digests hash the CANONICAL OBJECT: `sha256(JSON.stringify(receipt))` with keys in insertion order as written by the emitter (the emitter's serialization IS canonical because it is deterministic). Within a notes envelope, digests are keyed by the composite slot identity WITHOUT the note target sha: `"digests": { "<type>::<wi>[::<phase>]": "sha256:…" }` — the note target supplies the sha component.

## Annex: grok TOML round-trip contract (HW-5)

`scripts/wire-grok-hooks.mjs` implements a TOML subset (bracket-depth scanning, inline-object regex). Unrecognized grammar (multiline strings, dotted keys) is classified as opaque text and preserved byte-verbatim — acceptable documented degradation, guarded by `validate-grok-hook-toml-roundtrip.sh`.

## Exceptions

Grandfathered outliers live in `references/receipt-format-exceptions.json`, each with `{owner_wi, reason, revisit_by}`. The linter fails on any violation NOT listed there.
