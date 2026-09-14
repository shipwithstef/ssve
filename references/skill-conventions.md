# Skill Conventions

This document collects the structural conventions that all svc skills should follow. It is the index — individual conventions live in their own short docs or are codified directly here.

## 1. Progressive disclosure (progressive disclosure convention)

**The convention:**
- `SKILL.md` contains workflow + decision points. It is what the agent ALWAYS reads when the skill is invoked.
- `references/*.md` next to the SKILL.md contain depth, examples, deep-dive material, edge-case handbooks. They are loaded ON DEMAND when a specific decision in the workflow needs them.

**Why:** A 400-line SKILL.md gets fully loaded into context every time. If only ~80 lines are workflow and the other ~320 are encyclopedic content, the encyclopedic load is pure token waste on every invocation.

**How a skill author applies it:**

- Aim to keep `SKILL.md` to ≤300 lines of prose, ideally less.
- When a section grows past ~50 lines and is only relevant to a subset of invocations, extract it to `references/<topic>.md` and replace the SKILL.md content with a 1-2 line pointer:

  ```markdown
  ## Edge cases

  See `references/edge-cases.md` for the full handling matrix.
  ```

- Do not extract content that's needed on EVERY invocation. The cost of loading two files exceeds the savings.

**Explicit non-goal:**
> **Do NOT refactor existing skills wholesale to fit this convention.** This convention applies to new skills authored on or after 2026-04-28. Legacy skills are converted only when they are being substantively edited for other reasons.

The reason for the non-goal: refactoring all 47+ existing skills at once would be high-risk and low-yield. The token savings compound only as new skills are authored; converting old skills wastes more time than the convention saves.

**Validator behavior (advisory):**
The framework currently has no automated check for skill length. A loose advisory threshold of **300 lines** is recommended; skills above this should be reviewed for extraction opportunities. This may become a tier-1 advisory check in a future WI.

**Reference example:**
The `route-workflow` skill itself follows this convention — its SKILL.md is workflow-focused and points at `references/lane-model.md`, `references/routing-rules.md`, `references/intent-routing.md`, `references/task-graph-protocol.md`, and others for depth.

## 2. Before Starting context gate

See `_shared/before-starting.md`. Every new skill must include a `## Before Starting` section that defines how it builds a bounded context plan, follows indexes/dependencies to complete relevant context, and names skip conditions for reads that would not affect the run.

## Origins

Both conventions imported and adapted from coreyhaines/marketingskills v1.9.0 (commit 1bcff9fc). See WI-135 for the blend rationale.
