# Session Audit - active-intent guard

**Status:** ACCEPTED
accepted_wi: WI-354

## Scope

Audit the 2026-06-04 Codex session where an unrelated Example Marketplace `WI-335`
completion guard overrode the newest user intent. The active conversation had
shifted to accounting / launch vehicle decisions, then a Stop-hook prompt
forced remaining `WI-335` deployment and validation tasks. The audit target is
the framework contract failure that allowed stale/unrelated completion pressure
to outrank the newest user prompt and explicit correction.

This audit is proposal-only. It identifies the failing contract and the narrow
enforcement point for `improve-framework`; it intentionally does not implement
hook or eval changes.

## Evidence Inventory

- Prompt / session source: user supplied concrete replay plus Codex host traces.
- Codex transcript status: auto-discovered.
  - `~/.codex/history.jsonl:2532` records the accounting / launch
    vehicle thread.
  - `~/.codex/history.jsonl:2541` records the launch vehicle update
    request.
  - `~/.codex/history.jsonl:2542` records the explicit correction:
    "what are oyu doing this was a talk about totally unrelated thign?"
  - `~/.codex/sessions/2026/06/04/rollout-2026-06-04T16-22-28-019e92cc-ae74-7521-95c2-212d493423dd.jsonl:203`
    records `SVC COMPLETION GUARD (7/3)` for `WI-335`.
  - Same rollout line `533` records the second `SVC COMPLETION GUARD (8/3)`.
  - Same rollout line `205` records the assistant switching to
    `base44-environment`, `verify-promotion`, and `track-visuals`.
- Claude host trace search: attempted across `~/.claude/sessions` and
  `~/.claude/projects`; no current stop-hook replay matched. Older unrelated
  launch/accounting traces were found.
- Gemini host trace search: attempted across `~/.gemini/tmp`; no current
  stop-hook replay matched. Older unrelated launch/accounting traces were found.
- Example Marketplace `.svc/session-contract.jsonl` evidence:
  - Line 82: `WI-335`, `bound_to:"WI-335"`, `execution_mode:"end_to_end"`,
    request "Proceed with approval and required work, then summarize after."
  - Line 83: `WI-335`, `bound_to:"WI-335"`, skill `base44-environment`,
    production closeout request.
- Example Marketplace `.svc/pipeline-decisions.jsonl` evidence:
  - Lines 248 and 251 record that the assistant did perform the WI-335
    deployment and visual proof path after the stale guard.
- Framework files read:
  - `hooks/svc-task-completion-guard.sh`
  - `hooks/svc-prompt-stale-state.mjs`
  - `hooks/svc-session-contract-freshness.mjs`
  - `hooks/lib/resolve-wi.mjs`
  - `route-workflow/SKILL.md`
  - `route-workflow/references/prompt-composer.md`
  - `docs/specs/work-items/WI-352.md`
  - `.svc/session-contract.jsonl`
  - `.svc/pipeline-decisions.jsonl`
  - `references/model-routing.md`
  - `references/benchmark-findings.md`
  - `references/context-budget.md`
  - `FRAMEWORK-STATE.md`

## Expected Contract

- Newest user intent wins. A stale task graph or Stop-hook continuation can
  warn about unrelated work, but must not instruct execution unless the latest
  user prompt explicitly says to continue or resume that WI.
- Route-workflow requires intent normalization and correction classification
  before changing goals (`route-workflow/SKILL.md:43-77`).
- Route-workflow's self-verify already names two relevant checks:
  - latest user prompt must match dispatched WI or contain explicit continue
    instruction (`route-workflow/SKILL.md:186`);
  - guard directives must be reconciled with user intent
    (`route-workflow/SKILL.md:187`).
- The completion guard may hard-block only when the current session remains
  legitimately bound to the actionable WI. It should degrade to advisory when
  latest user intent is unrelated or corrective.
- Explicit corrections such as "stop", "ignore this", "unrelated", and
  "what are you doing" must immediately suppress continuation pressure for the
  named WI in the current session unless followed by an explicit
  `continue WI-XXX`.

## Actual Execution

1. The user discussed accounting, ZDDS, company launch-vehicle choices, and
   then asked to update and commit the launch vehicle stance.
   Evidence: Codex history lines `2532`, `2534`, and `2541`.
2. The local Example Marketplace session contract still pointed at `WI-335` with an
   end-to-end production closeout request.
   Evidence: Example Marketplace `.svc/session-contract.jsonl` lines `82-83`.
3. The Stop hook read pending `WI-335` lane tasks and emitted a hard block:
   `SVC COMPLETION GUARD (7/3)`, "PROGRESS IS NOT COMPLETION", and
   "DO NOT NARRATE what remains. EXECUTE it."
   Evidence: Codex rollout line `203`; completion guard block text is generated
   at `hooks/svc-task-completion-guard.sh:780-793`.
4. The assistant obeyed the guard and resumed `WI-335` production deploy /
   verification work rather than staying on the accounting / launch vehicle
   request.
   Evidence: Codex rollout line `205`; Example Marketplace decision log lines `248` and
   `251`.
5. The user explicitly corrected the agent: "what are oyu doing this was a talk
   about totally unrelated thign?"
   Evidence: Codex history line `2542`; Codex rollout lines `511-512`.
6. A second Stop-hook completion prompt appeared for the same `WI-335`
   remainder after the correction.
   Evidence: Codex rollout line `533`.

## Expected vs Actual Matrix

| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Latest user intent | Accounting / launch vehicle request remains active unless user explicitly resumes WI-335 | Stop hook made WI-335 the operative instruction | FAIL | history `2532`, `2541`; rollout `203` |
| Explicit correction | Suppress WI-335 continuation pressure immediately | Another WI-335 guard appeared after correction | FAIL | history `2542`; rollout `533` |
| Completion guard mode | Advisory when active user request is unrelated | Hard block with imperative execution text | FAIL | `svc-task-completion-guard.sh:780-793` |
| Existing WI isolation | WI-scoped filtering prevents unrelated WI graphs from being mixed | WI resolution worked, but it resolved the stale active WI and ignored latest prompt semantics | WARN | WI-352 ACs; `resolve-wi.mjs:163-203` |
| Route-workflow classification | Correction and guard reconciliation should be enforced before dispatch | Contract exists as self-verify, not mechanical Stop-hook enforcement | FAIL | `route-workflow/SKILL.md:186-187` |
| User handoff | User should not have to stop stale continuation manually | User had to correct the agent | FAIL | history `2542` |

## Dimension Scores

| Dimension | Score | Evidence | Notes |
|---|---|---|---|
| Prompt fidelity | FAIL | Codex history `2532`, `2541`, `2542` | Agent solved a stale WI continuation instead of the active accounting request. |
| Routing correctness | FAIL | rollout `203`, `205` | Stop-hook continuation was treated as newer intent. |
| Contract compliance | FAIL | `route-workflow/SKILL.md:186-187` | Written checks exist but are not enforced across Stop hooks. |
| Skill-loading discipline | WARN | rollout `205` | The wrong skills were loaded for the stale WI; loading itself is not the root failure. |
| Verification sufficiency | WARN | Example Marketplace decision log lines `248`, `251` | WI-335 proof happened, but it was irrelevant to the active user topic. |
| Review discipline | WARN | no framework audit before product continuation | The user had to trigger the framework audit afterward. |
| User-handoff discipline | FAIL | history `2542` | User correction was required to stop drift. |
| Audit/log completeness | WARN | session contract retained WI-335; no active-intent suppression record existed | Logs explain what happened, but not why the latest prompt was overruled. |
| Token/context efficiency | WARN | ESTIMATED from large transcript and irrelevant deployment work | Stale continuation burned context and runtime proof on unrelated work. |
| Capability gaps | FAIL | no Stop-hook access to active-intent/suppression state | Missing mechanical bridge between user prompt semantics and completion guard. |
| Workflow Phase gaps | FAIL | no active-intent phase in Stop guard | Route self-verify is advisory, not a hook-level contract. |
| Systemic opportunities | FAIL | recurring stale continuation pressure class | Needs tier-1 replay coverage. |
| Safety/Governance audit | FAIL | hard hook prompt instructed unrelated deployment | Hook governance overrode user governance. |
| Harness efficiency audit | WARN | Codex hooks are partial-parity per `FRAMEWORK-STATE.md` | Codex has Stop hooks, but prompt semantics were not persisted. |
| Framework gap extraction | FAIL | current files lack suppression ledger or latest-prompt comparator | Must become WI-354. |

## Token / Context Notes

- EXACT: No provider token counts were exposed for the failed segment.
- ESTIMATED: The failure wasted a substantial amount of context and wall time by
  running deployment and production verification for an unrelated WI. Evidence is
  the Codex transcript sequence and Example Marketplace decision log.
- UNKNOWN: Exact wasted tokens, exact Stop-hook invocation payload, and exact
  assistant internal attention state are not available.
- Context degradation pattern: positional attention favored the later hook
  directive over the earlier active user topic. This matches the context-budget
  warning class where later instructions can silently override earlier scoped
  requirements unless the framework writes durable state.

## Findings

### F1 - Stop hook lacks active user intent isolation

- Domain: framework-specific
- Severity: critical
- Description: `svc-task-completion-guard.sh` decides block/advisory from lane
  tasks plus the last session contract. It has no durable input representing
  the newest user prompt, an explicit user correction, or an active suppression
  for the stale WI.
- Evidence:
  - `hooks/svc-task-completion-guard.sh:588-603` computes `block` vs
    `advisory_contract` only from `sessionContract`, `bound_to`, and `wiList`.
  - `hooks/svc-task-completion-guard.sh:780-793` emits hard imperative text.
- Fix: Add an active-intent guard state that the Stop hook reads before hard
  blocking. If the latest prompt is unrelated or corrective for the resolved WI,
  the hook must emit advisory text or allow stop, never an execution directive.

### F2 - Prompt-time stale-state hook is detection-only and ignores prompt text

- Domain: framework-specific
- Severity: high
- Description: `svc-prompt-stale-state.mjs` consumes stdin but ignores the
  prompt content. It warns about stale lane state and long-running tasks, but it
  cannot suppress a WI after "what are you doing", "unrelated", "ignore this",
  or "stop".
- Evidence: `hooks/svc-prompt-stale-state.mjs:1-4` says it never blocks and
  ignores stdin; lines `41-70` only warn about stalled in-progress tasks.
- Fix: Convert or complement it with a prompt-intent state writer that records
  current prompt classification and WI suppression markers for the Stop hook.

### F3 - Session-contract freshness is temporal, not semantic

- Domain: framework-specific
- Severity: high
- Description: `svc-session-contract-freshness.mjs` blocks missing or old
  contracts and skill mismatches for edit/write tools, but a fresh contract can
  still be semantically stale when the user changes topics.
- Evidence: `hooks/svc-session-contract-freshness.mjs:64-103` checks timestamp
  and `SVC_CURRENT_SKILL`; it does not compare latest prompt intent.
- Fix: Extend the contract model or add companion intent state with
  `active_user_request`, `suppressed_wis`, `latest_prompt_hash`, and
  `resumed_wi` semantics.

### F4 - WI-scoped isolation fixed crosstalk but not stale-intent override

- Domain: framework-specific
- Severity: high
- Description: WI-352 correctly changed the isolation boundary to WI and
  prevented many parallel-session crosstalk classes, but this replay shows a
  second axis: a correctly resolved WI can still be stale relative to the
  user's newest topic.
- Evidence:
  - WI-352 scope at `docs/specs/work-items/WI-352.md:57-71`.
  - WI-352 ACs at lines `73-84`.
  - This replay's Stop hook resolved `WI-335` and still overrode unrelated
    accounting intent.
- Fix: File WI-354 for active user intent isolation / stale completion guard
  suppression; do not reopen WI-352 as if this were another WI-scoping bug.

### F5 - Explicit correction is not mechanically durable

- Domain: framework-specific
- Severity: high
- Description: The user correction existed in transcript state but not in
  framework state. Therefore the same WI-335 completion guard appeared again
  after correction.
- Evidence: Codex rollout lines `511-512` then `533`.
- Fix: On UserPromptSubmit, classify correction phrases and persist a
  session-scoped suppression record before the next Stop hook can fire.

## Framework Gaps For evolve-framework

The fix space is clear enough to route directly to `improve-framework`. No
separate `evolve-framework` discovery pass is required.

Required framework gap to implement:

1. Add active user intent isolation for completion guards.
2. Add a session/cwd scoped suppression ledger for stale WI continuation
   pressure.
3. Teach Stop-hook completion guard to prefer the suppression ledger over stale
   lane-task pressure.
4. Teach prompt-state logic to clear suppression only on explicit
   `continue WI-XXX`, `resume WI-XXX`, or equivalent.
5. Add tier-1 replay coverage for unrelated latest prompt, correction phrases,
   and explicit continue.

## Narrowest Enforcement Point

Primary enforcement point:

- `hooks/svc-task-completion-guard.sh`, before `status="block"` is allowed to
  emit the imperative `EXECUTE it` reason.

Required companion writer:

- `hooks/svc-prompt-stale-state.mjs`, or a new small helper under
  `hooks/lib/active-intent.mjs`, should parse UserPromptSubmit payload/stdin and
  write durable state under `.svc/` for the current cwd/session.

Suggested state shape:

```json
{
  "ts": "2026-06-04T20:43:36Z",
  "cwd": "/home/svc-user/app-workspaces/example-marketplace",
  "session_id": "019e92cc-ae74-7521-95c2-212d493423dd",
  "latest_prompt_hash": "sha256:...",
  "classification": "scope-correction|stop|unrelated|continue-wi",
  "active_request": "accounting / launch vehicle decision",
  "suppressed_wis": [
    {
      "wi": "WI-335",
      "reason": "latest user correction says unrelated",
      "expires_at": "2026-06-04T22:43:36Z"
    }
  ],
  "resumed_wi": null
}
```

Suppression clears only when the newest prompt explicitly resumes the same WI,
for example `continue WI-335`, `resume WI-335`, or a route-workflow decision
that logs an explicit user-approved context switch.

## Concrete Improvement Proposal

Implement WI-354: "Active user intent isolation and stale completion guard
suppression."

Files to change in `improve-framework`:

- `hooks/svc-task-completion-guard.sh`
- `hooks/svc-prompt-stale-state.mjs`
- new helper if useful: `hooks/lib/active-intent.mjs`
- `route-workflow/SKILL.md`
- `route-workflow/references/task-graph-protocol.md`
- `route-workflow/references/prompt-composer.md`
- `test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh`
- new eval: `test-framework/evals/tier-1/validate-active-intent-guard.sh`
- `test-framework/evals/run-all-evals.sh` only if the eval registry requires
  explicit inclusion
- `FRAMEWORK-STATE.md`
- `docs/specs/work-items/WI-354.md`

Acceptance criteria:

- A latest unrelated user prompt makes a pending WI completion guard advisory
  only, not `decision:"block"` with execution instructions.
- Correction phrases suppress the named/resolved WI for the current
  session/cwd: `stop`, `ignore this`, `unrelated`, `what are you doing`.
- An explicit `continue WI-XXX` or `resume WI-XXX` clears suppression and allows
  normal completion-guard behavior for that WI.
- A stale `session-contract.jsonl` bound to a WI cannot override a newer
  unrelated prompt during Stop.
- Route-workflow treats this replay as framework regression work, not as
  product WI continuation.
- The suppression ledger is scoped enough that it cannot suppress unrelated
  sessions, unrelated repos, or a different WI.
- Tier-1 evals prove both the suppression and the normal continue case.

Verification commands for the implementation run:

```bash
bash test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh
bash test-framework/evals/tier-1/validate-active-intent-guard.sh
bash test-framework/evals/run-all-evals.sh
```

## Route To improve-framework

Use `/goal` for the implementation run with this objective:

> Implement and land WI-354 so Stop-hook completion guards cannot override the
> newest unrelated user intent, explicit correction suppresses stale WI
> continuation pressure for the current session, and explicit `continue WI-XXX`
> still resumes normal WI completion behavior.

Do not use `/loop` until the WI-354 replay artifact and WI exist. The next run
should load `improve-framework`, then implement the files and evals listed in
this audit.

## Non-Framework Corrections

- No Example Marketplace product correction is required from this audit. The product
  deployment was the symptom of the framework failure, not the desired work.
- No additional accounting/legal answer is included here. The active user
  accounting question should be answered separately when requested.
- No hook implementation is included in this pass because the user explicitly
  required replay and exact contract identification first.

## Confidence

High. The replay is supported by the user-provided evidence, Codex host history,
Codex rollout transcript, Example Marketplace session contract, and Example Marketplace decision log.
The exact hook payload at each Stop event was not preserved in a standalone
file, so payload fields beyond the visible prompt and resolved WI remain
unknown. That does not materially change the finding because the visible hard
block text and subsequent execution are recorded.

## Landing-State Verification

| Evidence | Command / Source | Interpretation |
|---|---|---|
| Worktree before audit artifact writes | `git status --short --branch --untracked-files=all` | Clean at start: `## main...origin/main`. |
| Current branch | `git branch --show-current` | Expected branch: `main`; final closeout must recheck. |
| PR state | Not applicable | This pass creates audit/WI artifacts only; no PR exists yet. |
| Merge evidence | Not applicable yet | Implementation is intentionally pending for WI-354. |
| Post-merge validation | Not applicable yet | Evals are specified for the implementation run. |

Verdict: `audit-report-complete` once this report, WI-354, and the index row
are committed. Hook implementation remains pending and must not be called
landed or verified until `improve-framework`, `test-framework`, and
`verify-promotion` complete.

> **ARCHIVED CLOSEOUT (2026-06-29):** The "pending / must not be called landed"
> wording above is the original audit-time state and is now **superseded** —
> WI-354 was subsequently implemented and is `status: VERIFIED`. This proposal is
> accepted + closed: registry `accepted_wi: WI-354`, residual map
> `docs/specs/work-items/WI-354-residual-map.json`, and a PROPOSAL-PROMOTION-LEDGER
> row. Retained verbatim as the historical audit record.
