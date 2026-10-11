---
name: route-workflow
version: "2.0"
description: >
  Entry for any build, fix, or review request in a user project, including a project with no
  .svc yet. Sets up state and a worktree, classifies the lane, compiles the lane graph, and
  hands off to the first skill. Not needed for questions, explanations or read-only lookups.
phases:
  - { id: P1-Init, trigger: always, reads: [".svc/"], writes: [".svc/"], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-Classify, trigger: always, reads: ["user request"], writes: [".svc/route-record.json"], evidence_kind: file, required_for_completion: true }
  - { id: P3-Compile, trigger: always, reads: [".svc/route-record.json"], writes: [".svc/lane-tasks-<WI>.json"], evidence_kind: file, required_for_completion: true }
  - { id: P4-Handoff, trigger: always, reads: [".svc/lane-tasks-<WI>.json"], writes: [".svc/lane-tasks-<WI>.json"], evidence_kind: command_output, required_for_completion: true }
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
4. Classify. Take the first row that fits, then write `.svc/route-record.json` with class, wi, lane, change_type, risk_flags, assumptions.

| Request | lane | change_type | wi | risk_flags |
|---|---|---|---|---|
| continue earlier work: a `.svc/lane-tasks-*.json` task is pending or in_progress | that graph's lane | that graph's | that graph's WI | skip step 6, go to 5 |
| docs or typo only | refactor | docs | WI-DOCS | none |
| security review only (auth, payment, secrets) | bugfix if source exists, else greenfield | bugfix or feature | WI-SEC | auth-sensitive |
| bug report, source exists | bugfix | bugfix | WI-FIX | none |
| new behavior, source exists, `git rev-parse --verify HEAD` works | brownfield-feature | feature | WI-FEAT | user-facing if a person uses the result |
| anything else, including "build what spec.md asks" | greenfield | feature | WI-1 | user-facing if a person uses the result |

5. Worktree. Get a session id once and keep it in `.svc/session-id`: `[ -s .svc/session-id ] || printf %s "${CLAUDE_SESSION_ID:-$(node -e 'console.log(crypto.randomUUID())')}" > .svc/session-id`. Shell state does not persist, so start every Bash call that runs a svc script with `export SVC_SESSION_ID=$(cat PROJECT/.svc/session-id);` where PROJECT is the original project directory. Then run `node "$SVC_ROOT"/scripts/svc-ensure-worktree.mjs --wi WI --branch SLUG --from origin/main --json` and `cd` to `absolute_worktree`. On any error, stop; never build in place.
6. Compile, inside the worktree. The worktree starts with a one-task placeholder graph, so `--force` is right here and only here. Skip if `.svc/lane-tasks-WI.json` already has more than one task.
   `node "$SVC_ROOT"/scripts/compile-delivery-graph.mjs --wi WI --lane LANE --change-type TYPE --intent "ONE LINE" --repo-mode MODE --risk-flags FLAGS --out .svc/lane-tasks-WI.json --force`
   MODE is `bootstrap` for greenfield, else `convert`. Leave out `--risk-flags` when there are none. Never pass `--delivery-profile`.
7. Hand off. Run `node "$SVC_ROOT"/scripts/svc-next.mjs --root .` and read the card. Load exactly the SKILL on its `SKILL` line and follow it. When that skill ends, run the `CLOSEOUT` line it names, read the next card, and repeat.
8. Finish only when `svc-next` prints `STATUS done`. `STATUS not_done` means a required receipt is missing: produce what `MISSING` lists. Nothing else ends the run, not a finished product and not a passing test.

### Self-Verify

Before ending, check each row and mark PASS or FAIL.

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Finished by the card | The last `svc-next` card printed `STATUS done` | |
| 2 | Assumptions recorded | `.svc/route-record.json` lists every assumption; no stage, review or receipt was dropped | |
| 3 | Stages in compiler order | Every skill the graph lists ran in the order `svc-next` gave | |

**Terminal skill tagging:** none; this skill ends only when `svc-next` prints `STATUS done`.
