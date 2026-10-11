---
name: route-workflow
version: "2.0"
description: >
  Entry for any build, fix, or review request in a user project, including a project with no
  .svc yet. Sets up state and a worktree, classifies the lane, compiles the lane graph, and
  hands off to the first skill. Not needed for questions, explanations or read-only lookups.
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

# User-project entry

Follow the steps in order. Do not write product code until step 7 hands you a skill. An assumption is one line under `assumptions` in `.svc/route-record.json`; it never drops a stage, review or receipt. A small task still runs the lane the compiler gives: the compiler, not you, decides what is short.

1. Root. Run every script as `node "$SVC_ROOT"/scripts/<name>.mjs` from the project directory. If `$SVC_ROOT` is empty, use the path on the session line `SSVE framework root:`. If `skills-manifest.json` exists in this directory, this is the framework repo: stop here and follow `references/framework-and-host-route.md`.
2. Init. If `.svc/` is missing, run `node "$SVC_ROOT"/scripts/init-project-state.mjs`.
3. Bootstrap. Run `node "$SVC_ROOT"/scripts/svc-bootstrap-repo.mjs` from the project directory. It gives a repo with no commit a root commit and a local `origin/main`. Stop if it fails.
4. Classify. Take the first row that fits. Decide the values now; write them in step 6. A new request gets a new WI id, `WI-PREFIX-` plus `$(date -u +%y%m%d%H%M%S)`; reuse an id only to continue work you were told to continue. SLUG is the WI id in lowercase.

| Request | lane | change_type | PREFIX | risk_flags |
|---|---|---|---|---|
| continue earlier work: a `.svc/lane-tasks-*.json` task is pending or in_progress | that graph's lane | that graph's | that graph's WI id, as is | that graph's |
| docs or typo only | refactor | docs | DOCS | none |
| security review only (auth, payment, secrets) | bugfix if source exists, else greenfield | bugfix or feature | SEC | auth-sensitive |
| bug report, source exists | bugfix | bugfix | FIX | none |
| new behavior, source exists, `git rev-parse --verify HEAD` works | brownfield-feature | feature | FEAT | user-facing if a person uses the result |
| anything else, including "build what spec.md asks" | greenfield | feature | NEW | user-facing if a person uses the result |

5. Worktree. The session id is the one already in your environment (`SVC_SESSION_ID`, `CLAUDE_SESSION_ID`, `CODEX_THREAD_ID` or the host's equivalent): check with `env | grep -E '_(SESSION|THREAD|CONVERSATION)_ID='`. If there is none, make one UUID for this session, remember it, and start every Bash call that runs a svc script with `export SVC_SESSION_ID=<uuid>;`. Never keep it in a file in the repo. Run `node "$SVC_ROOT"/scripts/svc-ensure-worktree.mjs --wi WI --branch SLUG --from origin/main --json` and `cd` to `absolute_worktree`. On any error, stop; never build in place.
6. Record and compile, inside the worktree. Write `.svc/route-record.json` here with class, wi, lane, change_type, risk_flags, assumptions. The worktree starts with a one-task placeholder graph, so compile only when it is not yet compiled: `grep -q '"delivery_graph"' .svc/lane-tasks-WI.json || node "$SVC_ROOT"/scripts/compile-delivery-graph.mjs --wi WI --lane LANE --change-type TYPE --intent "ONE LINE" --repo-mode MODE --risk-flags FLAGS --out .svc/lane-tasks-WI.json --force`
   MODE is `bootstrap` for greenfield, else `convert`. Leave out `--risk-flags` when there are none. Never pass `--delivery-profile`. Never compile a graph that is already compiled.
7. Hand off. Run `node "$SVC_ROOT"/scripts/svc-next.mjs --root .` and read the card. Load exactly the SKILL on its `SKILL` line and follow it. When that skill ends, run the `CLOSEOUT` line it names, read the next card, and repeat.
8. Finish only when `svc-next` prints `STATUS done`. `STATUS not_done` means a required receipt is missing: produce what `MISSING` lists. Nothing else ends the run, not a finished product and not a passing test.

## Before ending

### Self-Verify

Before ending, check each row and mark PASS or FAIL.

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Finished by the card | The last `svc-next` card printed `STATUS done` | |
| 2 | Assumptions recorded | the worktree's `.svc/route-record.json` lists every assumption; no stage, review or receipt was dropped | |
| 3 | Stages in compiler order | Every skill the graph lists ran in the order `svc-next` gave | |

**Terminal skill tagging:** none; this skill ends only when `svc-next` prints `STATUS done`.
