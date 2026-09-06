# Framework improvement: canonical transports for configured reviewers

backlog_wi: WI-565
reason: Existing transport work remains owned by WI-565; current exact-route review evidence is required before completion.

**Status:** accepted — WI-565 executing
**Date:** 2026-08-30
**Category:** reviewer topology / host integration
**Severity:** high

## Evidence

HoursHub's owner configuration selected Cursor Auto, but the canonical launcher emitted a capability failure without invoking it. The same launcher omitted provisioned Grok Build. Live CLI probes confirmed both installed products expose the required noninteractive read-only and JSON contracts.

## Decision

Keep reviewer selection entirely in owner configuration. Repair SSVE's generic transport layer so Cursor Auto and Grok Build can satisfy that configuration with canonical findings and receipts. Do not hardcode either station into framework routing policy.

## Acceptance

WI-565 AC-1 through AC-6 and the original consumer replay define completion.
