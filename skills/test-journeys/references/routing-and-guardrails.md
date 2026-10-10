## Routing Rules

Route findings automatically. Every routing entry below also produces a WI file (see Step 4.5) — routing without a WI is incomplete.

- Missing ACs or vague AC wording -> `audit-ac` + WI
- Missing/incorrect journey transitions -> `write-journeys` + WI
- Spec-vs-code contradictions -> `sync-spec-code` + WI
- Behavioural defects / regressions -> `diagnose-bug` + WI
- Skipped-infeasible scenarios (from Step 0.5) -> `write-e2e` + WI with provisioning requirements
- Stable validated flow ready for automation -> `write-e2e`
- Pre-existing known-limitation ACs (⛔ E2E column) -> WI only if user confirms

---

## Scope and Inputs

Required input:
- `target_url`: any reachable app URL (`http://localhost:3000`, preview URL, staging, prod)

Optional inputs:
- `env=local|preview|staging|prod|custom` (reporting label only)
- `mode=smoke|regression|feature-ac|exploratory`
- `journey=<journey-id-or-file>`
- `feature=<feature-spec-file>`

Environment policy:
- Do not assume "live-only". Test whichever URL the user provided.
- Record `target_url` and `env` in every run summary.

Pre/post policy:
- For regression, corrective, deploy-validation, or "prove the fix" runs, load
  `references/pre-post-validation-loop.md` before execution.
- Run the selected journey or smoke path against the pre-change/pre-deploy
  target when reachable, then rerun the same journey, account, viewport stage,
  and target class after the fix or deploy.
- SUMMARY.md must classify the comparison as `fixed-by-change`,
  `branch-introduced`, `pre-existing`, or `blocked`. Do not mark ACs verified
  while an acceptance-critical changed signal is unclassified.
- When writing machine-readable evidence, validate it with
  `node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>`.

---

## Generated Outcome Journey Contract

For provider-backed generation flows, a journey is incomplete until it proves
all lifecycle states or records a blocked WI:

| State | Required evidence |
|---|---|
| Start | The user can reach the generation entry point. |
| Generate | The requested provider is invoked or the approved fallback is recorded. |
| Draft | The generated draft/result is visible before save. |
| Save | The user saves or commits the generated result. |
| Return | The user leaves and returns or reloads through the normal product path. |
| Persisted display | The saved result is still visible with provider/source evidence linked. |

Write provider/source, fallback policy, fallback approval, saved outcome, and
evidence paths into `PROVIDER_FIDELITY_EVIDENCE.md`; do not let a draft-only
preview satisfy a saved-result journey.

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

**Boilerplate rationale:** references/phase-receipts.md supersedes duplicate task-graph boilerplate cleanup for journey skills. The duplicated host-specific chaining blocks stay temporarily for host readability; future changes should update the shared phase-receipt/task-graph references first and use validators instead of hand-maintaining divergent journey-skill copies.
