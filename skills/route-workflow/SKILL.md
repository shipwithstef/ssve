---
name: route-workflow
version: "1.0"
description: >
  Universal entry point for any work. Routes freeform intent to the right svc skill
  based on repo state, change type, and current project artifacts. Handles: "do this",
  "build this", "I want to", "help me with", "make me a", "ship this", "fix this",
  or ANY freeform description of work; also handles explicit routing questions like
  "what should I do next", "which skill do I run", "what's the right order", and
  "what lane is this".
phases:
  - { id: P1-SessionContextLoad, trigger: always, reads: [".svc/session-contract.jsonl", "docs/specs/project-state.md", "~/.svc/builder-profile.md", "docs/specs/domain-profile.md"], writes: [".svc/session-contract.jsonl when needed", ".svc/orchestrator-state.json when initializing"], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-IntentNormalizationAndCorrection, trigger: always, reads: ["user request", "references/intent-normalization.md", "references/intent-classification.md", ".svc/session-contract.jsonl"], writes: [".svc/pipeline-decisions.jsonl when route-relevant"], evidence_kind: command_output, required_for_completion: true }
  - { id: P3-StateInitializationAndLaneRouting, trigger: always, reads: ["REPO_MODES.md", "skills-manifest.json", "skills/route-workflow/references/routing-rules.md", "skills/route-workflow/references/lane-model.md"], writes: [".svc/orchestrator-state.json", ".svc/lane-tasks-<WI>.json"], evidence_kind: file, required_for_completion: true }
  - { id: P4-ConcernAndPreDispatchGate, trigger: mutating-or-wi-dispatch, reads: ["concerns/REGISTRY.json", ".svc/session-contract.jsonl", ".svc/lane-tasks-<WI>.json"], writes: [".svc/pipeline-decisions.jsonl", ".svc/concern-hits.jsonl"], evidence_kind: command_output, required_for_completion: true }
  - { id: P5-TaskGraphDispatchAndEvidenceObligations, trigger: task-graph-mode, reads: [".svc/lane-tasks-<WI>.json", "target skill SKILL.md", "_shared/live-evidence.md"], writes: [".svc/lane-tasks-<WI>.json", "live evidence artifacts when visual-output skill"], evidence_kind: file, required_for_completion: true }
  - { id: P6-SelfVerifyDecisionLogContinuation, trigger: always, reads: [".svc/pipeline-decisions.jsonl", ".svc/lane-tasks-<WI>.json", "skills/route-workflow/references/task-graph-protocol.md"], writes: [".svc/pipeline-decisions.jsonl", ".svc/lane-tasks-<WI>.json"], evidence_kind: command_output, required_for_completion: true }
inputs:
  required: []
  optional:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { path: ".svc/orchestrator-state.json", artifact: orchestrator-state }
    - { path: ".svc/capability-registry.json", artifact: capability-registry }
outputs:
  produces: []
chain:
  lanes:
    greenfield: { position: 0, prev: null, next: write-vision }
    brownfield-conversion: { position: 0, prev: null, next: onboard-repo }
    brownfield-feature: { position: 0, prev: null, next: validate-feature }
    bugfix: { position: 0, prev: null, next: diagnose-bug }
    drift: { position: 0, prev: null, next: sync-spec-code }
    refactor: { position: 0, prev: null, next: sync-spec-code }
    framework: { position: 0, prev: null, next: test-framework }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

**Announce at start:** "I'm using the route-workflow skill to route your request to the right svc skill and lane."

# Workflow Compass

## Hot Path
1. Read the latest `.svc/session-contract.jsonl`; do not refresh it yet.
2. Normalize intent, then classify follow-ups before changing goals.
   If a Stop-hook completion guard, stale task graph, or old session contract
   conflicts with the latest user prompt or explicit correction, the latest user
   intent wins. Treat that guard as advisory unless the user explicitly says
   `continue WI-XXX` or `resume WI-XXX` for the same WI.
3. Select repo mode, change type, lane, WI, branch, and next skill from `references/lane-model.md`, `references/routing-rules.md`, and `references/intent-routing.md` using read-only evidence.
4. Before the first repository write — including session-contract refresh, WI/plan creation, task-graph initialization, claim, append, or generated output — run `node scripts/svc-ensure-worktree.mjs --wi <WI> --branch <branch> --from origin/main --json --print-cd`. Change to its returned absolute worktree path. Retain and pass the exact `wi`, `absolute_worktree`, `branch`, and `owner_session` baton to every mutating skill; refuse identity or cwd mismatch.
5. Check whether the user is asking for confidence in the right design before planning. If the prompt says "best solution", "right design", "all cards on the table", "golden standard", "real examples", "cost/caching", "by design auto", or equivalent, load `references/solution-confidence-protocol.md`, set `solution_confidence_required: true`, and choose a mode:
   - `design_auto` by default. The framework evaluates, grounds, designs, plans, and implements automatically through the normal lane once the confidence artifact selects a direction.
   - `post_design_human_gate` only when the user explicitly asks to review/approve after design or wait before the plan/implementation part.
   - `intake_only` only when the user explicitly says no design/decision yet or only asks for a parking lot/WI.
   Human gates are not default; they exist after design only when requested.
   The confidence artifact must include an action-by-action approval packet before `plan-changeset` or any approval request: what changes, why, how, positive outcome, negative/risk outcome, impact if skipped, and proof gates.
6. Declare the delivery tier (`full`, `end_to_end`, `compressed`, or `rush`) before dispatch; compressed/rush requires a decision-log rationale.
   **Measured tiering (WI-383, default OFF):** `node scripts/mine-receipts.mjs --tier <lane>` returns a fenced, measured recommendation from the receipt ledger. It is **ADVISORY by default** — log the recommendation, but still declare `full`. Only act on a `compressed` recommendation (drop the plan-level adversarial round ONLY) when ALL hold: (a) `.svc/chain-policy.json` opts in with `"ceremony_tiering":"measured"`; (b) the predictor returns `tier:"compressed"` with `window_complete:true`; (c) the change is not infra/`.svc`/scripts/hooks/migration (the predictor's AC4 fence already refuses these). review-exec G6, audit-implementation, and the pre-push 5-receipt envelope are NEVER tiered — only the plan round, and never without the opt-in. Record the measured decision in `.svc/pipeline-decisions.jsonl`.
7. From the ensured worktree, refresh the session contract if needed, initialize or update `.svc/lane-tasks-<WI>.json`, and claim the active WI through the binding/claim API before downstream mutation.
8. Run the concern/pre-dispatch gates for mutating or WI-bound work.
9. For a normal human work request, Codex autorun mode self-dispatches after the baton is established: resolve repository/WI/branch, invoke `svc-ensure-worktree`, bind the session, retain the exact tuple, and continue in the same turn. If repository resolution is ambiguous, ask once; never guess. Prompt Composer remains the fallback for hosts without autorun support or when the user explicitly asks for a launch package.

### Codex autorun baton

When the host is Codex and the request is a mutation (`work on Y`, `resume Y here`,
`take over Y`, or equivalent), route-workflow is operational, not advisory. The
first mutation is the canonical bootstrap command; its private one-use handoff
bridges the payload session identity to `svc-ensure-worktree`. Preserve this
baton for every continuation:

`repository → WI → branch → absolute_worktree → session_id → binding_generation`.

The bound worktree is the default mutation directory. Reads may inspect another
location, but an explicit conflicting workdir, target, repository, or worktree is
denied. `take over` is an explicit generation-bound CAS transfer; it never
signals, terminates, renames, or probes a process as an authority action.

For convert/brownfield repos with app chrome, run `bash test-framework/evals/tier-1/validate-chrome-journey-coverage.sh --root .`; after the adaptation window, HIGH blocks lane execution until coverage exists or the lane-task file contains `concern-waived: chrome-coverage - <reason>`.

Operational detail moved out of the hot path: `references/hot-path-operational-details.md`, `references/end-to-end-continuation.md`, and `references/prompt-composer.md`.

## Before Starting
**Chain preflight:** `node scripts/svc-reconcile.mjs` runs before routing (see `references/chain-receipt-contract.md`); refuses on unaccounted commits when `.svc/chain-policy.json` is `refuse`. Build a bounded context plan before routing: start from the session contract, active WI or explicit artifact, use `.svc/spec-index.json`, work-item indexes, and manifest metadata to follow relevant dependencies, then read every artifact that can change the route. Do not bulk-read unrelated specs, and do not stop at a single obvious file when the index points to a dependent spec, validator, review, or WI. See `_shared/before-starting.md`.

## Product Questions
For feature-class intent, tell downstream skills that product questions use `_shared/product-question-format.md` with the 12-section format and the >=20 customer + >=20 system coverage floor.

### Pre-Routing Typo Normalization
Use `references/intent-normalization.md` before lane classification. Record `normalized_intent`, `normalization_applied`, and `normalization_evidence` when normalization affects routing. Route from the normalized interpretation, not the noisy surface form.

### Mid-Task Correction Classification
Use `references/intent-classification.md` before treating a follow-up as a new goal. If the message is a `method-correction`, keep the same goal and task graph, switch only the named method, and apply the minimum viable swap. Do not start a new lane, dispatch new agents, write new specs, or create new artifacts unless the user explicitly asks. Record `mid_task_classification`, `classification_evidence`, `minimum_viable_swap`, and `new_artifacts_allowed`.

For material corrections, append `mid_task_hints[]` to `.svc/lane-tasks-<WI>.json` with raw text, normalized intent, classification, method swap, timestamp, and `scripts/resolve-skill-hint.mjs` results.

## Session Contract And Direct Requests
When a `product-improvement-protocol-v2` run is active, preserve its explicit owner mode, language,
delegation digest, active-minute budget, and generation bindings in the routing baton. Route every
consequential owner question to `decide`; nested `research` is evidence-only. See
`references/owner-decision-runtime-v2.md`. Missing authority stops or asks once and must never become
a hidden default.

If no contract exists, write one only after entering the ensured worktree. If `execution_mode: end_to_end`, continue until the scoped problem is verified, blocked by real evidence, or explicitly redirected. Run mid-task correction classification before intent-switch detection. Direct user requests still route through this skill: select the lane, ensure and enter its worktree, update the session contract, log the routing decision, and load the skill contract before edits.
When `execution_mode: end_to_end` crosses a verification/review/closeout seam and discovers same-lane follow-up work, append an `end_to_end_continuation` decision record per `references/end-to-end-continuation.md` before mutating the next artifact.

`.svc/session-contract.jsonl`'s field schema (required + optional fields, including `authorization_envelope` — §4c) is canonically documented in `_shared/session-contract.md`; read it before writing or interpreting a contract row.

## Lane Model & Routing
Lane selection is mandatory: choose the lane from `references/lane-model.md`; use `references/framework-policy.md` for svc-on-svc work; use `references/routing-rules.md` for change-type signals; use `references/intent-routing.md` for phrase-to-skill mappings. If no lane fits, propose a new lane instead of forcing a bad match.

## Human-Invoked Prompt Composer
For human-invoked routing, produce a Prompt Composer package. It must include normalized intent, repo/session evidence read, lane and delivery tier, exact skill sequence, required artifacts, skip conditions, eval/verification commands, closeout requirements, and when to use `/goal`, `/loop`, `dispatch-waves`, or other host capabilities.
Self-dispatch is allowed only when an explicit host/platform autorun contract or internal continuation invokes route-workflow non-interactively. Codex's governed autorun contract above is such an explicit contract; ambiguous mode defaults to the human package.
Still end with exactly one `**Next:**` trailer per the Output Protocol, but in prompt-composer mode that trailer points to the full copy-paste prompt or target skill; it must not replace the package with a thin next-skill line.

## Conditional Stage Activation (P3, WI-521 Batch C — closes WI-519)
Before declaring lane routing complete, evaluate which conditional/situational stages the diff actually activates, mechanically (not by judgement):

```bash
node scripts/stage-activation.mjs --diff "$(git merge-base HEAD origin/main)..HEAD"
```

Exit 0 → a JSON array of `{stage, condition, evaluated_against, result}` is printed on stdout; essential stages (`plan`, `review-plan`, `implement`, `review-exec`, `spec-sync`, `index-restamp`, sourced from `references/stage-registry.json`) are always `result:"active"`. Exit 2 → usage/config error, including an attempt to condition an essential stage (never allowed) or a missing/invalid `--registry` target — halt and fix the input, never treat exit 2 as "no activations". Paste the JSON output into the session contract (`.svc/session-contract.jsonl`) so downstream stages and the task-graph generator (`scripts/task-graph.mjs generate --activation <this-output>`) read the same evaluation instead of re-deriving it.

## Operational Gates
Run SDKG, visual evidence, provider fidelity, cross-system maps, lifecycle re-activation, capability diagnosis, intended-owner/SME resolution, company fleet, and concern/pre-WI dispatch exactly as specified in `references/hot-path-operational-details.md`. The reachable mechanical entry points remain `validate-provider-fidelity-evidence.mjs`, `validate-system-contract-map.mjs`, `check-cross-system-iteration-cap.mjs`, `diagnose-capability-blocker.mjs`, `validate-capability-blocker-ledger.mjs`, `expertise.mjs`, and the concern scanner. These gates write their cited ledger/task-graph obligations before dispatch; ambiguity never silently skips them.

### Compact mandatory obligations

- Capability diagnosis writes `.svc/capability-blockers.jsonl` and validates it before dispatch.
- **Cross-System Contract Map Gate:** cross-system work carries the validated producer/consumer map and old-path/new-path falsification proof.
- **Universal change-impact routing:** classify cosmetic/logic/high impact and create the owned impact-triad task before mutation.
- For framework-evolution routing, a malformed registered SDKG registry fails closed; the router fail-opens for unrelated/user-request sessions.

## visual-evidence obligation for visual-output skills

This is a task-graph obligation, not a host-installed hook. A visual-output skill declares and resolves `artifact: live-page-screenshots`; route-workflow may close that task only after the declared live evidence passes `_shared/live-evidence.md`.
## Protocols & Output
Task graph, delivery-graph compiler, `**Next:**` output, blocking-discovery halt, decision-log, autorun, skip, and resume rules live in `references/task-graph-protocol.md`, `references/lane-model.md`, `references/blocking-discovery-format.md`, `references/decision-log.md`, and `references/autorun-orchestrator.md`. Human checkpoint behavior is controlled by the downstream skill and autorun contract.
When the latest request names multiple WI IDs and asks to handle them in parallel or concurrently, route to `dispatch-waves` before executing any WI. Do not manually spawn workers until the wave plan and merge-back contract pass.

Mutating, deploy-affecting, end-to-end, corrective, and framework-evolution runs must finish with one closeout classification from `scripts/classify-delivery-graph-closeout.mjs`.

## Universal Local Residue Closeout
Before a final response that declares repo work handled, complete, or clean, run `git status --short --untracked-files=all` in the active worktree. If the user asked for a clean repo, make the worktree clean by committing/pushing, preserving artifacts on a named branch or stash, restoring/deleting generated state, or adding confirmed gitignore coverage. A leftover-disposition ledger can explain remaining residue for normal closeouts, but it is not a substitute for actually cleaning the repo when cleanliness was requested. Apply `references/leftover-disposition.md` to classify every path, including untracked docs/specs, `.svc/lane-tasks-*.json`, `docs/logs/*.md`, and generated guard state such as `.svc/loop-guard-state.json`.

For tracked files, do not treat `.gitignore` as a disposition. If a generated local cache such as `.svc/loop-guard-state.json` is tracked, remove it from the index with `git rm --cached`, confirm/add the ignore rule, and commit the index removal. If a durable append-only artifact such as `.svc/pipeline-decisions.jsonl` or `docs/specs/research-log.md` is dirty, commit the valid append or restore the accidental write. The final `git status` check must run after route/research/decision logging and after branch/PR closeout, so hook or skill logging cannot dirty the worktree after the clean claim.

## Publication-State Closeout
For mutating framework work on `main`, before final response run `git status --short --branch`, `git fetch --prune origin`, compare `origin/main...HEAD`, and run `git push origin main` when safe/intended. If status rows remain, validate every path with `references/leftover-disposition.md`. Final closeout must say whether local `HEAD` and `origin/main` match.

If `git fetch` or `git push` fails with `remote: Repository not found`, HTTP 401/403, or `authentication required`, apply the deterministic auth-failure recovery defined in `improve-framework` Step 6c: derive owner from `git remote get-url origin`, verify it in `gh auth status`, run `gh auth switch --user <owner>`, retry once, then restore the previous account. Never create new auth, run `gh auth login`, change the remote URL, cycle accounts, or force-push; report both the original failure and auth-switch attempt if retry fails.

## Post-Deployment Evidence Lock

When the latest request, normalized intent, session contract, or local project instructions mention `post-deploy`, `post deployment`, `after deploy`, `production`, `prod`, `live`, or a production URL plus validation/testing/E2E/browser/visual/API/smoke proof, treat that as a hard evidence-stage constraint. Run the named proof after deployment against the deployed production/live URL. Pre-deploy, local, mock, staging, bundle-grep, or visual-only evidence is supporting only. If proof cannot run, closeout must say `post-deploy <proof> was not run` and why; in onboarded projects, read local `AGENTS.md`/`CLAUDE.md`/`KIMI.md` first because local deployment and validation rules override generic assumptions.

## Deploy-Source Provenance Gate
Before any deploy-affecting action that ships a build to a shared/production environment (CI deploy, `wrangler pages deploy`, a `deploy/*` script, container push), verify the deployed source is the source of truth: `HEAD` must be an ancestor of `origin/<default-branch>` (i.e. the work is merged), OR the run carries an explicit `do-not-merge-first` override decision logged in `.svc/pipeline-decisions.jsonl`. A deploy built from an unmerged/unpushed working tree silently diverges production from the branch others deploy from — a later deploy from a clean default-branch checkout then reverts it with no error. Closeout for a deploy-affecting run must state whether the deployed commit is on `origin/<default-branch>`; if not, name the reconciliation step (merge → redeploy-from-default, or the logged override). This is the route-side companion to the project-side deploy-script ancestor check; see Known Gap "Prod deploy not gated to merged source" (landing-audit F4).

## Worktree/Branch Hygiene Closeout
For completed temporary worktree/branch runs, follow `references/worktree-branch-hygiene-closeout.md`; scan every canonical scope alias (for example `wi304`, `wi-304`, `WI-304`, and the exact completed branch slug), not only the active branch name. Final closeout names the alias set, removed or preserved scoped worktrees, local branches, remote branches, and blockers.

## Run-Summary Visualization Closeout
Substantive-task closeout ALWAYS carries the **① What / ② How / ③ Issues** text report (every user, zero setup); ALSO emit a run-summary HTML named in the response **only when HTML is opted-in** (user asked, or `.svc/visualize-html.on` exists) — per `rules/common/visualize-decisions.md` (`node scripts/render-run-summary.mjs --run-id <WI> --out docs/status/<wi>-summary.html`; dashboard `scripts/render-status.mjs`). The HTML is a plain local file, not the Team/Enterprise publish feature. Trivial one-liners exempt; noisy execution stays in subagents.

## Wave Closeout Validation
When a run creates, fixes, audits, or closes a related WI batch and the closeout claim is "all are closed", "all follow-ups are done", or equivalent, run the wave validator before final response:

```bash
node scripts/validate-wave-closeout.mjs --from WI-<first> --to WI-<last> --expect-count <n>
```

Use `references/wave-closeout-validation.md` for non-contiguous WI lists, project-specific evidence roots, and scoped worktree tokens. A passing wave closeout must prove every WI doc, INDEX row, lane task graph, latest zero-fail runtime evidence artifact, and scoped worktree cleanup reconciles.

## Phase Receipt Contract
After loading this skill, record every frontmatter phase before completion with `node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> <phase-id> --evidence <kind:path>`. Auto-emission via `hooks/svc-phase-receipt-autoemit.mjs` is idempotent; use the command for evidence outside declared writes or hosts without that hook.

## Pipeline Continuation
Read and update the active `.svc/lane-tasks-<WI>.json`, load the named skill before doing work, mark the current task completed through `scripts/task-graph.mjs`, and update the host mirror.

**Post-exec review wave (WI-382 — Claude host).** After execute-changeset freezes the diff, dispatch the post-exec review as ONE read-only fan-out (review-exec G6 + G5 auditor + audit specialists + visual lens over a single frozen package) per `references/parallel-review-station.md`, not three serial skills — receipts still emit sequentially post-barrier and the pre-push envelope is byte-identical. Non-Claude hosts keep the serial chain. This is an in-class read-only fan-out (no S5 policy gate).

**Stage-context isolation (WI-380 — Claude host).** Run the mandatory chain as per-stage FRESH subagents instead of one degrading orchestrator context, split into 3 segments at the human_checkpoint seams (`scripts/stage-segment.mjs` `SEGMENTS`): seg-1-plan, seg-2-exec, seg-3-land. Each stage gets only its SKILL.md + the prior stage's hash-bound baton (WI-381, NEVER the prose summary), works in the shared worktree, emits its OWN receipts, and returns the `schemas/stage-summary.schema.json` shape (≤1K tokens). The orchestration VERIFIES the returned SHA (`stage-segment.mjs verify-receipt`) and HALTS on a missing receipt — it never re-emits. Backward control flow (patch/re-execute/re-plan, 3-iteration cap) is `nextStageAction`. Stages stay strictly SEQUENTIAL (isolates context, not ordering). Non-Claude hosts keep the prose chain. See `references/stage-context-isolation.md`. Permitted mutating transport per the S5 policy (recorded 2026-06-09).

### Self-Verify
Before declaring routing complete, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Lane matched to change type | Routing decision references one of the 7 lane definitions and the change-type detection signal that triggered it | |
| 2 | Skip conditions evaluated | For each lane skill listed in `<SKILLS_PATH>/references/skip-conditions.json`, state whether the skip applies and log the registry-backed justification in `.svc/pipeline-decisions.jsonl` | |
| 2b | `na` is evidence, not a shrug | Ran the `## Conditional Stage Activation (P3, WI-521 Batch C — closes WI-519)` block above (`node scripts/stage-activation.mjs --diff main..HEAD`) and pasted its output; for a conditionally-active STAGE (not a lane skill), `na` is valid ONLY when a cited condition evaluation accompanies it (`{stage, condition, evaluated_against, result:"na"}`) from that output — a bare "n/a" sentence with no evaluation is not a valid skip | |
| 3 | New-lane necessity checked | If no existing lane fits, respond with `**Proposal:** New lane <name> needed because <reason>` | |
| 4 | Task graph and WI claim initialized | `.svc/lane-tasks-<WI>.json` and `.svc/claims/<WI>.claim.json` exist | |
| 5 | Next trailer is valid | The `**Next:**` trailer references a skill in `includedSkills` and the current lane position, or in human prompt-composer mode points to the copy-paste prompt/continuation primitive while naming the target skill | |
| 6 | Decision logged | A `mechanical` or `taste` entry exists for every non-trivial routing choice | |
| 7 | Session intent matches dispatched WI | Latest user prompt references the WI subject/skill, OR `bound_to: wi-backlog`, OR an explicit continue instruction exists | |
| 8 | Guard directive reconciled with user intent | If a guard urged WI dispatch from a stale/corrected/unrelated context, confirm `.svc/active-intent-state.json` is absent or explicitly resumed for the same WI before executing; otherwise treat the guard as advisory and continue the current user request | |
| 9 | Lifecycle context confirmed before dispatching to recommendation-generating skill | Before `landing-page`, `cro`, `popups`, `signup`, `paywalls`, or `pricing`, read project lifecycle and log it | |
| 10 | No questions after user imperatives | If the latest message says "improve it", "proceed", "do it", "go", "ship it", "fix it", "build it", or "yes", proceed with reasonable defaults instead of asking | |
| 11 | Session contract fresh | `tail -1 .svc/session-contract.jsonl` is within 4 hours; otherwise write a fresh entry before proceeding | |
| 12 | Mid-task correction classified | Active follow-ups are classified as `method-correction`, `scope-correction`, `goal-change`, or `status-question`; method corrections preserve the same goal and use the minimum viable swap | |
| 13 | Publication state closed | Mutating framework closeout reports clean/dirty state, validates leftover dispositions when dirty, `origin/main...HEAD` divergence, push result or blocker, and whether local `HEAD` equals `origin/main` | |
| 14 | Worktree/branch hygiene closed | Runs scoped `git worktree list --porcelain`, `git branch --list`, and `git ls-remote --heads origin` checks for every canonical scope alias; removes completed clean worktrees/branches or records exact preservation blockers | |
| 15 | Wave closeout validated | Batch closeouts that claim all related WIs are done cite `scripts/validate-wave-closeout.mjs` with the resolved WI list/range, expected count, evidence root, and PASS result | |
| 16 | Post-deployment proof honored | If the request or project context asked for post-deploy/live/production E2E, visual, browser, smoke, API, or validation proof, closeout cites the command/artifact run after deploy against the production URL, or explicitly says it was not run. | |
| 17 | Prompt Composer package complete | For human-invoked routing, output follows `references/prompt-composer.md`: normalized intent, evidence, lane, sequence, required artifacts, evals, closeout, and host capability suggestions instead of thin self-dispatch. | |
| 18 | Closeout report emitted | Substantive-task closeout carries the 3-section text report (What / How / Issues) — always; the HTML run-summary is rendered + named ONLY when HTML is opted-in (`.svc/visualize-html.on` or user request). Trivial one-liners exempt. Per `rules/common/visualize-decisions.md`. | |
| 19 | Change impact routed | Mutating work records classifier tier/reasons and has an owned impact-triad task; read-only work cites N/A evidence | |

**Terminal skill tagging:** Terminal skills may declare `terminal: true`; after them, route-workflow defaults to advisory mode for backlog WIs unless the user explicitly switches context.
