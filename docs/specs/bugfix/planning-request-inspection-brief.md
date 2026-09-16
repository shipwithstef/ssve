# Complete native planning-request inspection

**Superseded design direction, 2026-09-15:** the owner requested a generic
cross-harness evaluation. The current WI, proposal and
`docs/specs/research/large-review-input-harness-assessment-20260915.md` are
authoritative. The capture-helper steps below document an investigated alternative,
not an approved requirement. Prefer shared file/stdin ingestion and native
inspection support; qualify any replacement inspection path separately.

WI: WI-FW-PROMPT-INSPECTION-01. Diagnosis grounded in reproduced size failure and
native capture evidence. Design, formal plan review and implementation pending.

## Expected, actual and cause

Complete declared input must reach inspection and inference identically.
Inference accepts stdin; inspection currently takes the same input as a single
argument. Its 100 KB guard blocks the 210 KB account revision before execution.
Installed Codex 0.154.0 has no stdin prompt-inspection option. This is separate
from the invalid reverse-scout citation, which must continue to fail validation.

## Smallest complete correction

1. Add `scripts/lib/native-planning-request-capture.mjs`: a bounded asynchronous
   helper receiving its packet through stdin. Spawn the resolved Codex executable
   with existing execution flags and an invocation-only capture provider. Listen
   on 127.0.0.1, use an ephemeral port and nonce, serve actual selected cached model
   metadata when requested, capture one Responses request, and deliberately return
   a non-inference error. Own the child, buffers, sockets, timeout and cleanup.
2. Integrate into `scripts/lib/isolated-plan-analysis.mjs`, retaining its synchronous
   API through a bounded helper subprocess. Store immutable raw evidence; verify
   exact prompt, cwd, model, effort, strict schema, native template and tool
   schemas. Retain the existing detector for declared context/user frames.
3. Replace the argv-specific guard in `scripts/lib/two-box-role-launch.mjs` with
   the qualified stdin bound. Preserve all role separation, source validation,
   content-attempt limits and strict parsing of actual model output.
4. Add helper/integration tests and extend `test-framework/tests/two-box-plan.test.mjs`
   for the prompt bound and receipt/tool-event rejection invariants.

## Design constraints to resolve before implementation

- The capture request contains native instructions and tools absent from
  `debug prompt-input`. Dropping these frames indiscriminately is invalid. Their
  accepted profile must bind to verified binary/catalog provenance; unknown
  native profiles fail closed.
- A custom provider may alter request construction. Qualify parity with the live
  invocation or retain a blocking unsupported result. Do not claim usable-live
  solely because the probe preserved its user prompt.
- Native tool advertisements do not prove tools are disabled. Preserve actual
  tool-event rejection and read-only/ephemeral execution without claiming a
  stronger guarantee.
- Termination affects only the owned child/process group, with bounded escalation.
  Bound both request bytes and child stdout/stderr; preserve no credentials.

## Verification

Positive: complete 256 KB native capture; exact tuple/schema/frames; no auth
header; explicit refusal of inference; clean lifecycle.
Negative: missing/duplicate/truncated capture, wrong nonce/route/tuple/schema/cwd,
injected instruction, changed prompt, unknown tool schema, credentials, output
overflow, timeout, cancellation, child failure and SIGTERM resistance. Existing
role parser must still reject attempted tools, invalid citations, malformed data
and injected live fixtures.

## Pattern scan and affected layers

`buildRolePrompt` centralizes the six roles; `buildPromptInspectArgv` and
`assertEffectiveIsolation` contain the affected transport. `parseCodexJsonl`
already rejects tools and unknown items. No skill frontmatter, model-routing
policy, lease interface, product AC, pricing or marketed behavior changes.
Document actionable operator errors and the integrated native evidence format.

| Pillar | Effect and proof |
|---|---|
| Functionality | Complete declared input; real large-packet capture. |
| Security | Authenticated local capture, no credentials, strict provenance. |
| Reliability | Timeout/output/cleanup and cancellation negatives. |
| Performance | One bounded inspection per actual attempt; no blind retries. |
| Maintainability | One helper/integration point; versioned native assumptions. |
| Accessibility / operator UX | Actionable transport error instead of unrelated recovery/deploy instructions. |
| Data / privacy | Strip inherited authority and credentials; declared evidence only. |
| Observability / proof | Exact hashes and real process evidence; explicit offline/diagnostic/live distinctions. |

## Research and release

Installed CLI help and generated 0.154.0 schema were inspected. Official CLI,
app-server and config documentation checks are recorded in the consumer's
`native-inspection-research-20260915.json`. The normal plan/review/execute/review/
audit/land/verify chain applies. Do not install the prototype as enforcement.
Rollback restores explicit oversized-input failure, never an incomplete plan.
