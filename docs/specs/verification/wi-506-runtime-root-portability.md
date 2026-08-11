# WI-506 Promotion Verification: Secure Runtime-Root Portability

**Date:** 2026-07-22
**Delivery tier:** full
**Target class:** system-only framework/runtime infrastructure
**Verdict:** PROMOTED-RUNTIME-VERIFIED
**Promotion:** PR #166, squash merge `4cce515f6cd6eb03a235d83e81e2393b3e2a5a45`

## Promotion identity

- The reviewed branch tree and the squash-merge tree are identical.
- The five mandatory chain receipts were re-emitted for the squash SHA and
  `node scripts/check-chain-receipts.mjs --sha 4cce515f6cd6eb03a235d83e81e2393b3e2a5a45`
  passed.
- The canonical checkout was fast-forwarded to the squash SHA before setup.
  Two unrelated append-only local audit records were preserved byte-for-byte;
  they are not part of WI-506.

## Acceptance verification

| AC | Promoted evidence | Result |
|---|---|---|
| RP-01..RP-07 | `validate-runtime-root-portability.sh` on promoted main; invalid XDG resolves to `/home/svc-user/.cache/svc-codex-runtime` with `source=home-cache-fallback` and `fallback_reason=xdg-enoent` | PASS |
| RP-08..RP-11 | `validate-codex-first-task-activation.sh` on promoted main, including preflight, injected graph-first crash, exact forward retry, stable receipt comparison, and production failpoint denial | PASS |
| RP-12 | Final full Tier-1: 265 pass, 2 fail, 0 timeout. Both failures reproduce at the base SHA and are outside the WI-506 diff; see Baseline classification. | PASS relative to classified baseline |
| RP-13 | Setup refreshed Antigravity, Claude, Codex, Cursor, Gemini, Kimi, MiMo Code, and OpenCode from canonical main; every per-host `check-install-drift.sh` returned exit 0 with all 85 skills current. | PASS |
| RP-14..RP-15 | Original Example Marketplace WI-496 ensure and installed loader commands ran with `XDG_RUNTIME_DIR=/run/user/1000/`, `/run/user/1000` absent, and both runtime overrides unset. Ensure transferred generation 2 to 3 once; second ensure remained 3. Loader succeeded twice and preserved graph bytes. | PASS |
| RP-16..RP-18 | `validate-external-review-launcher.sh` on promoted main: 157 passed, 0 failed, including exact blend-only allow, executable/exec-record deny, staged and committed rename denial, and receipted owner exception validation. | PASS |

## Original invalid-XDG replay

The live host state was:

```text
XDG_RUNTIME_DIR=/run/user/1000/
/run/user/1000 absent
SVC_RUNTIME_DIR unset
SVC_CODEX_RUNTIME_DIR unset
```

From `/home/svc-user/app-workspaces/example-marketplace`, the original ensure command
was run twice through the promoted canonical script. The first result was:

```json
{"wi":"WI-496","branch":"wi-496-native-splash-transition","base_sha":"939f0321d6fa80edbed45f8415f12f408f4644fb","absolute_worktree":"/home/svc-user/app-workspaces/example-marketplace/.worktrees/wi-496-native-splash-transition","absolute_graph":"/home/svc-user/app-workspaces/example-marketplace/.worktrees/wi-496-native-splash-transition/.svc/lane-tasks-WI-496.json","owner_session":"019f8840-f8bf-7a21-a50c-48d52ed0d526","claim_generation":3,"created":false,"resumed":true}
```

The second result was identical at generation 3. The old generation-2 binding
is released to the current session, and the current generation-3 binding is the
only authoritative tuple.

The installed Codex loader was then run twice for graph task `1` and
`route-workflow`, under the same invalid-XDG environment and with both runtime
overrides explicitly absent. Both calls exited 0 and returned the canonical
skill. The session receipt resolves the skill from canonical framework main:

```text
task_graph=/home/svc-user/app-workspaces/example-marketplace/.worktrees/wi-496-native-splash-transition/.svc/lane-tasks-WI-496.json
task_id=1
skill=route-workflow
skill_path=/workspace/seriousvibecoding/route-workflow/SKILL.md
skill_sha256=sha256:ffdd017342a5f468b6f702847b1d9c10df048caa1237ebde7e5a84d89c352bb5
runtime_root=/home/svc-user/.cache/svc-codex-runtime
runtime_source=home-cache-fallback
fallback_reason=xdg-enoent
```

Example Marketplace proof after replay:

- branch and HEAD remain `wi-496-native-splash-transition` at
  `939f0321d6fa80edbed45f8415f12f408f4644fb`;
- `git status --short --untracked-files=all` is clean;
- graph SHA-256 remains
  `5627e293daeba545ca589b592bd88a9340687c77d8edb2c126e8dcd9b62b7426`;
- task 1 remains `in_progress` with the original stable graph skill receipt;
- no Example Marketplace product file or splash source changed.

## Promoted focused regression

| Command | Result |
|---|---|
| `bash test-framework/evals/tier-1/validate-runtime-root-portability.sh` | PASS |
| `bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh` | PASS |
| `bash test-framework/evals/tier-1/validate-external-review-launcher.sh` | PASS, 157/157 |
| `bash test-framework/evals/tier-1/validate-all-host-install-migration.sh` | PASS, 52/52 |
| `node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/svc-runtime-root-resolution.md` | PASS |
| `node scripts/validate-pre-post-validation-evidence.mjs --evidence .svc/wi506-pre-post-evidence.json` | PASS |

Test-quality review found no skipped requirement-linked WI-506 tests, circular
expected values, or placeholder assertions in the acceptance-critical focused
fixtures. The runtime and loader probes exercise real filesystem, process, Git,
task-graph, receipt, and installed-host boundaries.

## Baseline classification

The final full Tier-1 run produced 265 passing scripts, 2 failures, and 0
timeouts. The push hook reproduced the same outcome. Neither remaining failure
is represented as green:

1. `validate-proposal-triage-sla.sh` fails because the pre-existing
   `proposals/2026-07-21-session-audit-wi-472-reconcile-backlog.md` lacks triage
   metadata. The file and failure exist at the WI-506 base SHA.
2. `validate-skip-conditions-registry.sh` fails because the pre-existing
   `.svc/lane-tasks-WI-498.json` tasks 5 and 6 use an older receipt shape without
   top-level `output_artifact` and `validation_output`. The file and failure
   exist at the WI-506 base SHA.

Classification: `pre-existing` for both. WI-506 introduced no unclassified or
branch-introduced acceptance failure.

## Pre/post causal delta

```yaml
pre_post_validation:
  command: "canonical installed Codex loader for Example Marketplace WI-496 under XDG_RUNTIME_DIR=/run/user/1000/ with the directory absent"
  pre:
    status: fail
    evidence: ".svc/wi506-pre-post-evidence.json"
  post:
    status: pass
    evidence: "this report, Original invalid-XDG replay"
  comparison: fixed-by-change
  iterations: 1
```

The machine-readable pre/post evidence validator passes. The old path failed
with `EACCES`/`ENOENT` at the missing advertised XDG boundary; the promoted path
classifies that same input as unavailable, selects the private home-cache
fallback, proves authority before activation, and completes exact retry.

## G7 and evidence level

This change has no browser, visual, provider, customer, admin, or mobile-build
surface. Browser journeys, responsive screenshots, visual-baseline promotion,
and canary URL monitoring are therefore N/A. Its real journey is the headless
installed-host bootstrap and skill-load command, which was exercised end to end
against the original Example Marketplace worktree.

```yaml
single_lane_summary:
  item: WI-506
  target_class: system-only
  verification_tier: L4
  sampled: true
  evidence:
    - docs/specs/verification/wi-506-runtime-root-portability.md
    - .svc/wi506-pre-post-evidence.json
```

G7 verdict: PASS. There is no unresolved Critical or High drift. The two final
execution-review Medium findings remain explicitly bounded follow-up work and
do not invalidate the promoted acceptance contract.

## Leftovers

The WI-506 worktree retains tracked task-graph and closeout documentation only
until its closeout commit. Machine-local test/review logs remain under ignored
`.svc` evidence paths. The canonical main checkout still contains the two
unrelated append-only audit records that predated promotion verification; they
were preserved and are outside WI-506 ownership.
