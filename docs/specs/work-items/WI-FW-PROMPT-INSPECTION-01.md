# WI-FW-PROMPT-INSPECTION-01 — Complete large-input transport across review harnesses

Status: IMPLEMENTING in WI-FW-TWO-BOX-01 worktree `framework-two-box-transmutation`; companion original and failed-stage history preserved. Type: Bug. Lane: bugfix. Severity: high (delivery blocker).

## Intent and authorization

Repair the canonical planning transport that blocks the owner's authorized
completion of WI-ACCOUNT-MULTICONTEXT-01 in Codex. This is a necessary dependency,
not a reduction of product scope or a new release authorization. Preserve the
product worktree, other framework worktrees and all existing review gates.

Owner scope clarification, 2026-09-15: log the generic framework gap, evaluate
different harness options and explain exact recurring impact. The assessment is
complete locally; no implementation or provider switch is claimed by it.
Canonical proposal: `proposals/2026-09-15-framework-improvement-large-review-input.md`.
Assessment: `docs/specs/research/large-review-input-harness-assessment-20260915.md`.
This supersedes the earlier assumption that a local capture server must be the fix.

## Reproduction and cause

`scripts/lib/two-box-role-launch.mjs` previously rejected role prompts over
100,000 bytes. The account Contract revision packet measures 210,360 bytes
without its final reverse coverage object. Lossless deduplication still measures
172,743 bytes. Installed Codex 0.154.0 `debug prompt-input` is positional-only.
Owner authorization on 2026-09-15 folded PI-01..PI-12 into the active Two-Box
repair: freeze complete planning bytes (1 MiB), inspect/execute those same bytes,
and use diagnostic native-request capture only when argv cannot carry the prompt.

The non-authoritative native capture prototype preserved 256,029 prompt bytes
without inference. Three negative controls rejected injected instructions,
changed input and the wrong cwd. Evidence resides in the account worktree under
`.svc/evidence/account-completion-plan/v5-refresh/`:
`planning-prompt-budget-20260915.json`,
`large-prompt-inspector-prototype.mjs` and its `-result.json` file.

## Acceptance Criteria

| ID | Criterion |
|---|---|
| PI-01 | The launcher materializes complete request bytes once, binds them by hash and length, and supplies them through qualified stdin, native file input or structured request body. Complete requests through 1 MiB are supported where the model budget permits. No requirements or evidence are dropped to fit argv. |
| PI-02 | Inspection and execution use the same frozen bytes, declared context and host configuration. Inspection cannot accept only a filename or sentinel as proof that it inspected the complete request. |
| PI-03 | Each supported review transport declares and tests its input mechanism, limits, context/isolation behavior and evidence strength. An unsupported planning harness fails explicitly; model/host fallback requires existing owner policy. |
| PI-04 | An agent-mediated file read is distinct from native file ingestion. Where allowed, it needs immutable file contents, a lifetime covering the call and verifiable complete read coverage. It cannot silently replace a tool-free planning role. |
| PI-05 | Existing isolation, schema, model/effort, source-citation, receipt and tool-event checks remain intact. Native tool advertisements are not proof that tool execution is disabled. Diagnostic captures and offline fixtures cannot issue live authority. |
| PI-06 | Byte/resource limits and token/context/output budgets are separate checks. Known oversize or unsupported inputs fail before a paid call; later generated packets are checked before their next stage. No identical permanent-limit retry loop. |
| PI-07 | Hashes cover frozen request bytes and each declared envelope. Missing, changed, unreadable or truncated files/streams fail; resume reuses the exact saved request or makes an explicit new input revision. |
| PI-08 | Tests cover 99 KB, 101 KB, the platform single-argument boundary, 256 KB and 1 MiB; UTF-8, literal shell syntax, partial streams, missing EOF, cancellation, timeout, and cleanup. Large schemas/config values are included in argv auditing. |
| PI-09 | Each enabled adapter has deterministic transport tests and bounded native qualification at its claimed evidence level. Local input-reader success is never described as a live model review or proof of semantic comprehension. |
| PI-10 | Ordinary external reviews, Two-Box planning and inspection share the input contract. Existing compatible stdin/file paths are reused; native inspection stdin/file support is preferred over a new capture service. |
| PI-11 | A compatibility matrix covers all nine provisioned hosts, distinguishing native capability, implemented review adapter and qualified planning transport. Missing adapters are explicit backlog limitations, not implied support or mandatory automatic expansion of this fix. |
| PI-12 | Formal review, release checks, all-host install/drift verification and exact-source execution checks cover the final change. Original account delivery scope and failed-stage history remain intact. |

## Correction, release and rollback

See the proposal and assessment for the selected direction; the earlier
`docs/specs/bugfix/planning-request-inspection-brief.md` retains prototype history.
No new dependency,
model choice, credential change or public endpoint. The normal delivery chain
applies because inspection behavior changes. Rollback reverts the integration;
oversized plans must fail explicitly rather than silently lose requirements.
