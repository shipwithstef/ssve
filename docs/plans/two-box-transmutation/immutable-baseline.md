# Immutable baseline — WI-FW-TWO-BOX-01

This file is the WI-553 immutable_baseline path. It names the pre-change package at public root 0dcd69d255642dcc78db521e95afa2b18ea1276f and must not be reused as rolling rollback.

Preserved package:
- plan-manifest schema maximum 4; issuance_versions [4]; modes inline only in packageCapabilities
- PLAN_MANIFEST_MAX_VERSION=4 in emit-receipt.mjs, check-chain-receipts.mjs, plan-manifest-contract.mjs
- review-inputs.mjs requires schema_version === 4
- control-plan schema v1 floor_verdict
- blind-floor-route.mjs decide() dual_track, dual-track.off, files<=3, infra, size M+
- no isolated_plan_analysis on provision/hosts
- compile-delivery-graph inserts research when solution_confidence.required

Historical receipts on this public root remain readable under those rules. This file is not rewritten by later rollback notes.
