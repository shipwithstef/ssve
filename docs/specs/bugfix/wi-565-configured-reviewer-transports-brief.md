# Bugfix brief — WI-565: configured reviewer transports

## Reproduce

Configure an external station with `host: cursor` or `host: grok`, then call `scripts/run-external-review.mjs --validate-capabilities` or run a review for that station. At base `c386080b`, both stop before provider invocation because `reviewTransport()` returns null.

## Expected behavior

Owner configuration selects the reviewer. Every review-capable host advertised by SSVE must either run through a canonical read-only, receipt-producing transport or return a precise capability receipt. Framework source must not override the selected station.

## Root cause

The topology layer intentionally accepts multi-model Cursor tuples and maps Grok to xAI, while the launcher transport registry, invocation switch, findings schema, and receipt-attestation rules were not extended when those hosts were provisioned.

The first live Grok invocation also exposed a pre-existing standards defect in the shared findings schema: its `$id` was a bare token rather than a URI reference. Grok rejected it at the API boundary while Codex and Claude had tolerated it.

## Smallest safe fix

Add Cursor and Grok entries to the existing launcher abstraction; probe their installed flags; invoke Cursor using `--print --mode plan --output-format json --sandbox disabled` and logical `cursor-auto` → CLI `auto` (the installed WSL host cannot start Cursor's optional AppArmor sandbox, while plan mode is Cursor's read-only execution contract); extract one locally schema-validated JSON object from Cursor's result envelope when it adds prose; invoke Grok through a protected prompt file with `--permission-mode plan --json-schema`; parse each native result envelope; and preserve honest model attestation. Cursor Auto remains a required advisory station because its envelope cannot prove the selected provider family or effort. Grok Build/xAI is the required independent release-authority station.

## Pattern Scan

Scope: all hosts in `provision/hosts`, `review-topology-v2.mjs`, and `REVIEW_HOST_TRANSPORTS`. Codex, Claude, and AGY already have transports. Gemini review uses AGY. OpenCode and Kimi are multi-model harnesses not currently selected by an owner review topology. Cursor and Grok are the only reproduced missing siblings in the requested scope.

## Pillar Revisit Audit

| Pillar | Result | Evidence |
|---|---|---|
| Personas | unaffected | internal framework operator path |
| Journeys | unaffected | no product journey changes |
| Feature specs | affected | external-review contract documented in WI-565 |
| Acceptance criteria | affected | AC-1 through AC-6 added |
| E2E | unaffected | CLI integration validator is the applicable end-to-end surface |
| Data model | unaffected | receipt schema tuple already permits arbitrary host/family strings |
| Privacy/security | affected | both invocations are read-only; diagnostics remain redacted |
| Operations | affected | all-host install and original failure replay required |

## Pillars Coverage Matrix

All eight pillars are classified above. Affected pillars are bundled in this WI; no follow-up is required.

## Affected artifacts

Launcher, findings schema, deterministic tier-1 integration validator, framework state/capability matrix, research log, and installed host copies.

## Proof of fix

1. Full `validate-external-review-launcher.sh` pass including hermetic Cursor and Grok stations.
2. Live capability receipts for installed Cursor and Grok CLIs.
3. Live canonical review receipts for both stations.
4. All-host setup plus drift check.
5. Replay the frozen HoursHub G5 package through configured Cursor Auto.

## Learnings

A configured-host abstraction needs executable parity coverage: topology acceptance without a matching canonical transport is a false capability claim.

## Causal chain

```yaml
symptom: "configured Cursor/Grok reviewer fails before invocation"
proximate_cause: "reviewTransport(host) returns null"
root_cause: "launcher transport registry and parser switch omit provisioned review hosts"
systemic_cause: "no parity test joins topology-supported hosts to canonical transports"
prevention: "hermetic per-host launcher integration coverage plus live installed capability replay"
```
