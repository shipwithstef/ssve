# Framework Review — 2026-04-25 — Dynamic, Deterministic, and Reliable Process

## Method

Walked the framework looking specifically at **process behavior under different
situations**, not feature gaps. Three orthogonal axes:

| Axis | Question | Failure mode |
|------|----------|--------------|
| **Determinism** | Same input → same output? | Same prompt produces different routing, conflicting routes, non-canonical artifact |
| **Reliability** | Recovers from partial / mid-run / corrupted state? | Stale state machine, dangling worktrees, banner ghosts, half-applied state |
| **Dynamic adaptability** | Adjusts correctly across host / lane / project type / interactive vs autorun? | Wrong skill loaded, wrong host path, autorun behaves differently than interactive |

The 4 PRs that landed today (#26 verification policy, #27 12 findings, #28 deterministic
hooks, #30 G-4 authenticity) closed many concrete bypasses. This review covers the
**process-shape** issues those PRs do NOT address.

## Findings

### R-1. P0 — Hook coverage is 3 of ~27 Claude Code events; large blind spots remain

**Evidence:** `hooks/hooks.json` declares only `PreToolUse`, `PostToolUse`, `Stop`.
Per Claude Code host docs (per `rules/host-capability-research.md`), the host
supports ~27 lifecycle events. Missing entirely from svc:

- `SessionStart` — could re-validate symlinks (the bug WI-111 caused), capability
  registry freshness, framework-state coherence; would have caught the 79 dangling
  symlinks within 1 session of the worktree breaking them.
- `UserPromptSubmit` — could detect stale active-WI banner state and prune; could
  enforce per-prompt capability budget; could route freeform "I want X" prompts.
  (We have a hook here per the prompt banner above, but it's not in `hooks/hooks.json`.)
- `PreCompact` — could snapshot the active task graph + skill state to disk so
  post-compaction recovery is deterministic instead of model-best-guess.
- `SessionEnd` — could write a session summary to `.svc/sessions/`, enabling
  audit-session-execution without manual transcript export.
- `Notification` — could surface guard violations as proactive prompts rather than
  silent stderr.

**Why P0:** the same exploit class (find an unhooked path) repeats. Today closed
Edit-tool, Bash heredoc, and skill-output-path. Tomorrow the agent finds the next
unhooked path. The fix is not to keep hooking exploits one-by-one — it's to ensure
*every* lifecycle event has a checkpoint, with sensible defaults that are easy to
extend.

**Proposed fix:**

1. New file `hooks/hook-coverage-spec.md` enumerating all 27 events + svc's intended
   posture per event (block / warn / observe / skip-with-rationale).
2. New tier-1 validator `validate-hook-coverage.sh` that fails when an event is
   listed in the spec but not wired in `hooks/hooks.json`. Forces the spec → wiring
   contract.
3. Initial wiring for the 5 most-impactful missing events: SessionStart healthcheck,
   PreCompact state-snapshot, UserPromptSubmit stale-state-prune, SessionEnd
   session-log, Notification guard-violation surface.

### R-2. P0 — `pipeline-decisions.jsonl` has no schema validator; anything appends pass

**Evidence:** `.svc/pipeline-decisions.jsonl` is the source of truth used by
`svc-skill-artifact-authenticity` (WI-114), G-2 verification, audit-session-execution,
and others. Today: any process can append any JSON. There's no validator that the
entry has a schema-valid shape (`skill`, `timestamp`, `decision`, optional `run_id`,
optional `wi`).

**Reliability impact:** a malformed entry breaks every downstream reader. A
maliciously-shaped entry could spoof a skill invocation to bypass G-4 authenticity.
A skipped entry produces silent loss of audit trail.

**Proposed fix:**

1. Define a JSON Schema in `references/pipeline-decisions-schema.json` for the
   one-line-per-event format.
2. New tier-1 validator `validate-pipeline-decisions-schema.sh` that lints every
   line.
3. `scripts/log-decision.mjs` (already exists in `ingest-guide/scripts/`) becomes
   the canonical writer; other writers gradually migrate. PreToolUse hook on `Edit`
   to `.svc/pipeline-decisions.jsonl` rejects writes that don't go through the
   library (similar shape to G-1).

### R-3. P0 — Cross-host hook conformance is not tested; 4 hosts can drift

**Evidence:** `scripts/wire-hooks.mjs`, `wire-kimi-hooks.mjs`, `wire-codex-hooks.mjs`,
`wire-gemini-hooks.mjs` each install hooks per their host's settings format. Today
no tier-1 validator confirms that the **same set of canonical gates** is enforced
across all 4 hosts. The agent in this session found a Bash bypass on Claude Code;
nothing tells us Kimi/Codex/Gemini's bash-guard wiring catches the same case.

**Proposed fix:**

1. New file `references/canonical-gates.json` enumerating each gate (e.g.
   `block-no-verify`, `eval-gate-pre`, `skill-artifact-authenticity`) and whether
   each host MUST/MAY enforce it.
2. New tier-1 validator `validate-cross-host-hook-conformance.sh` that loads each
   host's wired settings and asserts every MUST gate is wired and points at an
   existing, working hook script.
3. Per-host hook wrappers (e.g. `hooks/kimi/svc-kimi-*.sh`) gain a `--smoke` mode
   that exits 0 only if the underlying check is actually wired and reachable.

### R-4. P1 — `route-workflow` autorun path is documented but not tested

**Evidence:** `route-workflow/SKILL.md` describes an Autorun Orchestrator and a
freeform intent table. None of the merged WIs/PRs in the recent backlog burndown
show `--autorun` actually being exercised end-to-end. The session-execution audits
all run through interactive routing.

**Reliability impact:** divergence between the documented autorun behavior and
what actually fires. The framework's "single prompt → verified product" promise is
unverified.

**Proposed fix:**

1. New tier-1.5 eval `validate-autorun-skeleton.sh` that runs `route-workflow`
   against 3 fixture prompts (greenfield idea, brownfield bug, framework gap) with
   `--autorun` and asserts:
   - the lane is correctly selected
   - the lane-tasks file is created with the canonical task sequence
   - no human_checkpoint skills are auto-invoked
   - the decision log records `autorun=true` on every entry
2. Document the contract: `--autorun` must produce identical artifacts to running
   the same lane interactively, except for human_checkpoint pauses.

### R-5. P1 — `.svc/orchestrator-state.json` and lane-tasks files have no atomicity / no concurrent-session protection

**Evidence:** Two parallel sessions today produced merge conflicts on `main` (my
"Ship 1" closeout collided with another session's commits — required `git pull
--rebase`). The orchestrator-state file (when present) is a single JSON read-modify-write.
Concurrent edits from two Claude/Kimi sessions could clobber.

**Proposed fix:**

1. Atomic write helper in `scripts/state-io.mjs`: write to `.tmp` file, fsync, rename.
2. Optional advisory lock via a `.lock` file with PID + timestamp; stale locks
   (>10 min) auto-released.
3. lane-tasks files gain a `version` integer; updaters do compare-and-set.
4. Tier-1 validator that scans for direct file writes to these state files outside
   the helper (a la G-1).

### R-6. P1 — `External State Lifecycle` gate (WI-112) is in `plan-changeset` only

**Evidence:** WI-112 (merged today) added the `## External State` section
requirement to `plan-changeset/SKILL.md` and the mechanical check to
`review-plan/SKILL.md`. But execute-changeset, review-gate, audit-implementation,
and land-changeset don't reference the section. An execution that drifts from the
plan's declared external-state surface is not detected.

**Proposed fix:** extend the wrapper question into a 4-stage checkpoint:
1. plan-changeset: declare external state. (DONE — WI-112)
2. execute-changeset: re-verify the change-set's writes match the declared
   external-state set; HIGH severity if it touches an undeclared environment.
3. review-gate G6/G7: re-verify after promotion.
4. audit-implementation: scan post-merge diff against declared external-state
   set as part of standard correctness audit.

### R-7. P2 — Skill input/output declarations are advisory, not enforced

**Evidence:** Every SKILL.md declares `inputs` and `outputs` in frontmatter. No
hook or validator enforces these at skill-load time. A skill can be invoked with
its required inputs missing and silently produce garbage.

**Proposed fix:** the existing `scripts/preflight.mjs` (per learning
`skills-need-preflight-to-fail-fast`) already exists for this. Wire it into a Skill
PreToolUse matcher so it fires automatically; require coverage of every skill
listed in `skills-manifest.json`.

### R-8. P2 — `ingest-guide` matrix conflict between catalog-overlap and addon-novel

**Evidence:** WI-111 merged the matrix but left an unresolved conflict (catalog-overlap-strong + addon-novel + project-fit-strong have two valid default routes). Already documented in conversation; carry into a backlog WI with the recommended `selective-blend` resolution.

## Implementation order

1. **R-1 hook coverage spec** (~3h) — foundational, unblocks R-2, R-3.
2. **R-2 pipeline-decisions schema validator** (~2h) — closes the spoofing gap.
3. **R-3 cross-host conformance** (~3h) — prevents host drift.
4. **R-6 external-state extension** (~2h) — extends WI-112 to its full footprint.
5. **R-5 atomic state writes** (~3h).
6. **R-4 autorun skeleton test** (~3h).
7. **R-7 preflight wiring** (~1h).
8. **R-8 ingest-guide matrix tie-break** (~30min).

Total ≈ 17.5 focused hours. Highest leverage is R-1 + R-2 + R-3 which collectively
close the entire "find an unhooked surface" exploit class at the framework level
rather than per-instance.

## Out-of-scope follow-ups (file separately as needed)

- Replay-test of the 2026-04-25 example-marketplace session per user's earlier request
- Strategic-decision Phase 1b rewrite (PR #27 F-12)
- G-2, G-3 hooks from PR #28
- Skill receipt auto-emission (PR #28 G-12)

## Decision: ship as one cohesive PR or one-WI-per-finding?

R-1 + R-2 + R-3 should ship as **separate PRs** so each can be reviewed and rolled
back independently. R-6 is a small extension to existing skills and can ride along
with R-1. R-5 and R-7 are independent and can ship anytime. R-8 is a 30-minute
fix and should ride a doc-only PR.

The very next ship should be R-1 (hook coverage spec) — every other finding
benefits from having the spec to reference.
