# Framework improvement — complete large review input across harnesses

**Status:** DIAGNOSED; assessment complete locally, implementation pending.
**backlog_wi:** WI-FW-PROMPT-INSPECTION-01
**Reason:** Existing owned WI now carries the generic transport contract, immediate
Two-Box regression and compatibility assessment; this is not release approval.
**Severity:** High — blocks authorized delivery when a required planning packet
exceeds the inspection transport limit.

## Gap and measured impact

Two-Box allows only Codex transport and rejects all role packets above 100,000
bytes because its native inspection command takes a single prompt argument.
The account revision packet measures at least 210,360 bytes. On this Linux host,
131,071 argument bytes succeed while 131,072 fail with E2BIG; raising the framework
number to 1 MiB alone therefore fails again at the OS boundary.

This affects any consumer reaching this shared planning path with enough
requirements, source, findings or accumulated revisions. It can block the plan
review/execution gate after earlier planning calls already consumed time/tokens.
Repeating the same request cannot change a deterministic size failure. Removing
scope merely to get under the cap can produce an incomplete review and is not a
repair. No financial loss amount or frequency estimate has been measured.

It is not established that all ordinary reviews fail. The general review launcher
already supports `--input-file` and stdin; a new deterministic check preserved
1,235,010 bytes, including multibyte text and shell literals, through both readers.
That verifies acquisition only, not the downstream model request or review quality.
The earlier Cursor identity and Azure/ADB failures are separate defects.

## Proposed framework behavior

Freeze one complete request artifact; compute hash/length; resolve a versioned host
capability profile; send the actual bytes using stdin, a native file option or a
structured body. Use the same frozen data for inspection and execution. Prefer
native inspection file/stdin support; do not mandate a local capture server.

Agent-mediated file references are a separate capability. AGY already uses one;
such a route must prove complete reads and preserve the role's isolation policy.
No tool-free role may silently be changed to one that browses its workspace.

Make byte/resource limits configurable, with a tested 1 MiB contract where the
model budget permits; check tokens and output reserve separately. Include schema,
configuration and system-instruction arguments in the audit. Stop before paid
work on known unsupported/oversized inputs, and report the exact layer and repair.
Respect owner-selected models, providers and fallback policy.

## Harness assessment and acceptance

See `docs/specs/research/large-review-input-harness-assessment-20260915.md` for all
nine hosts and evidence strength. WI PI-01 through PI-12 define acceptance, covering
byte equality, source/context isolation, repeated/resumed calls, cancellation,
large and malformed input, native qualification and all-host installation.

## Scope, route and rollback

One generic defect class: inconsistent large-request ingestion and inspection
across review stages/adapters. Canonical affected code:
`scripts/lib/isolated-plan-analysis.mjs`, `scripts/lib/two-box-role-launch.mjs`,
and shared ingestion/adapter boundaries in `scripts/run-external-review.mjs`.
AGY dispatcher changes are conditional on its selected qualification approach;
new Gemini/Kimi/OpenCode/MiMo review adapters are separate work if required.

Use improve-framework to register and triage, then the bugfix diagnosis/plan/
review/execute/review/audit/land/verify chain. This contract-affecting change is
not a configuration-only adjustment. The current user request covers logging and
assessment; this artifact does not declare implementation or a paid benchmark run.

Rollback restores the previous reviewed integration and explicit unsupported
result, keeping saved requests and evidence. Never roll back by truncating data,
disabling isolation or accepting a different model without policy authority.

## Expected benefit and remaining uncertainty

One request format and compatibility suite prevent the same argument-size failure
from recurring across planning and review. File persistence permits exact restart
without reconstructing long prompts. Input fidelity is testable without claiming
that a model understood every line. Native inspection availability, provider
isolation parity and per-harness token limits still require implementation-time
qualification. This assessment performed no paid model calls and installed no fix.
