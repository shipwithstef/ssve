# Workflow-tool transport for read-only analysis fan-outs (WI-373)

On the Claude host, the **read-only analysis fan-out class** — multi-reader
sweeps, judge panels, parallel extraction over a known work-list — routes
through the native **Workflow tool** instead of the shell transport
(`scripts/fanout.sh` / `dispatch-worker.sh` / `wait-for-output.sh`) and the
extraction tier (`extract-summary.sh` / `haiku-extract.sh`).

## Why
Native pipeline/parallel give: schema-forced StructuredOutput (no extraction
tier), resume from a journal, a shared token-budget API, per-agent labels and
progress, and concurrency caps — everything the shell transport approximated.

## Class boundary (hard)
- **In-class:** read-only fan-outs only — readers, reviewers-as-analysis,
  judges, search sweeps. `pipeline()` by default; barriers only for genuine
  cross-item dependencies.
- **Mutating transport (REVISED 2026-06-09 — S5 policy reversal, user-authorized).**
  Mutating work MAY now run on **isolated/parallel transport** — per-stage fresh
  subagents (WI-380), disjoint-file worktree waves (WI-387/388), each in its own
  context, returning a schema-forced summary + receipt SHA — **provided the
  structural safety set holds**: claims discipline (`.svc/claims/`), a disjoint-file
  pre-dispatch fence (no two concurrent mutators share a path), post-barrier
  receipt emission (git-notes are not concurrent-safe), and the `.svc` 3-way merge
  driver (WI-398). The **sequential single-WI chain remains the DEFAULT**; parallel
  /isolated transport is **opt-in** and used only when those fences are in place.
  This supersedes the prior "ANY mutating work stays sequential" boundary
  (recorded in `.svc/pipeline-decisions.jsonl`, run_id `S5-policy`; approved
  in-conversation 2026-06-07, confirmed via AskUserQuestion 2026-06-09).
  `dispatch-waves` still governs multi-WI mutation.

## Opt-in semantics (unchanged)
Workflow runs require the user's explicit multi-agent opt-in (ultracode /
"use a workflow" / a skill that mandates it). This protocol does not loosen
that — it only fixes the TRANSPORT once a fan-out is legitimately requested.

## Per-run obligations
1. Log a `mechanical` decision naming the fan-out (class, N agents, schema).
2. Use the `budget` API when a token target is set; surface `budget.spent()`
   in the closeout line (cost note per run — WI-373 guardrail).
3. Schemas over prose: every reader returns StructuredOutput; the orchestrator
   never re-parses free text.

## Host parity
`fanout.sh` + companions are RETAINED for non-Claude hosts until injector/
workflow parity lands there; their headers carry the deprecation pointer.
