---
name: evaluate-rule
version: "1.0"
description: >
  Use when deciding whether a candidate rule file (for CLAUDE.md / AGENTS.md
  injection) earns its per-turn token cost, or whether it merely restates
  Claude's default behaviour. Triggers on "evaluate this rule", "should we
  adopt this rule", "is this rule worth it", "check if this rule beats the
  default", "rule evaluation", "evaluate a rule pack", "audit rules/",
  "prevent rule inflation", "does this rule change behaviour", "gate a
  blended rule pack before adoption", or whenever new rule files are being
  considered for `rules/` or `~/.claude/rules/`. Always use before
  registering a rule in `rulesRegistry`.
inputs:
  required:
    - { path: "rules/**/*.md", artifact: candidate-rule }
    - { path: "references/rules-policy.md", artifact: rules-policy }
  optional:
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "skills-manifest.json#rulesRegistry", artifact: rules-registry }
outputs:
  produces:
    - { path: "docs/specs/rules-evaluation/<rule-name>/default-transcript.md", artifact: default-transcript }
    - { path: "docs/specs/rules-evaluation/<rule-name>/diff-and-verdict.md", artifact: diff-and-verdict }
    - { path: "docs/specs/rules-evaluation/<rule-name>/verdict.json", artifact: verdict }
    - { path: "docs/specs/rules-evaluation/summary.md", artifact: batch-summary, condition: "batch mode" }
phases:
  - { id: P1-ContextLoadAndRuleEligibility, required_for_completion: true, evidence: "candidate rule and rules-policy read; skip/reject eligibility checked" }
  - { id: P2-BiasIsolatedDefaultProbe, required_for_completion: true, evidence: "default transcript written before rule-content diff" }
  - { id: P3-DiffScoreAndVerdict, required_for_completion: true, evidence: "diff, scores, verdict markdown, and verdict.json produced" }
  - { id: P4-Tier2CrossModelChallenge, required_for_completion: true, evidence: "Tier 2 result recorded, or skip evidence for non-global/non-cross-model scope" }
  - { id: P5-BatchSummaryIfApplicable, required_for_completion: true, evidence: "batch summary written, or single-rule skip recorded" }
  - { id: P6-NoManifestMutationCheck, required_for_completion: true, evidence: "skills-manifest.json remains unchanged by the skill" }
  - { id: P7-NextActionTrailer, required_for_completion: true, evidence: "next registration/rejection command emitted" }
  - { id: P8-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify complete and task graph continuation handled" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Evaluate Rule

You are deciding whether a candidate rule earns its per-turn token cost. The
framework's position: a rule is only worth adopting if it **changes Claude's
default behaviour in a measurable, desirable way**. Rules that merely restate
what Claude already does are called *rule inflation* — they burn tokens on
every turn for zero behaviour change, and we reject them.

**Announce at start:** "I'm using evaluate-rule to decide if this rule earns its token budget."

The load-bearing idea of this skill is **bias isolation**. If you show the
model the rule and then ask "what would you do by default?", the model is
already primed — its answer will drift toward the rule. So the evaluation is
always two passes, in a fixed order: **elicit the default first, then diff**.

## When to skip

- The rule is already registered in `rulesRegistry` and `last_evaluated` is
  less than 90 days old → skip; the prior verdict stands
- The rule is literally empty or only contains comments → reject without
  running the probe

## Inputs

Required arguments:
- `--rule <path>` *or* `--rule-pack <dir>` — one rule file, or a directory for batch mode
- `--stack <lang|universal>` — target stack context (affects convention-conflict scoring)
- `--scope project|global` — where the rule would land

Optional:
- `--project-context <path>` — path to project-state.md / domain-profile.md for convention-conflict scoring
- `--cross-model` — force Tier 2 cross-model challenge even for project scope
- `--output-dir <dir>` — override default `docs/specs/rules-evaluation/`

**Global scope auto-escalation:** if `--scope global` is set, Tier 2 runs
automatically regardless of `--cross-model`. Global rules fire on every turn
across every project — the extra rigor is justified.

## Process

### 1. Load context

Read the rule file. Read `references/rules-policy.md` for classification
definitions. If `--project-context` is provided, read those docs. Do NOT read
the rulesRegistry entry for this rule if one exists — you are evaluating the
rule on its own merits, not rubber-stamping a prior verdict.

### 2. Tier 1, Pass 1 — identify rule type, then elicit default (bias-isolated)

**Step 2a — classify the rule type** (do this BEFORE reading rule content deeply):

Read the rule's frontmatter and first heading only. Ask:
- Does this rule fix a *wrong or risky* behavior? → `correction`
- Does this rule collapse *valid alternative approaches* to a project convention? → `steering`
- Does this rule restate something Claude already does consistently? → likely inflation, continue to Pass 1 to confirm

The distinction matters because Pass 1 asks different questions for each type.

**Step 2b — identify scenarios** the rule covers.

For **correction** rules — a scenario is a situation where Claude might do the wrong thing:
> "Developer writes code that handles an API key"
> "Agent needs to find a string and knows the file path"

For **steering** rules — a scenario is a decision point with multiple valid paths:
> "Developer needs global state management in a React app"
> "Go function returns an error — what wrapping style to use?"

**Step 2c — elicit default without rule context:**

For **correction** rules, ask:
> In <scenario>, what do you do by default? Describe the decision you'd make, as if no rule existed.

For **steering** rules, ask instead:
> In <scenario>, what approaches would you reach for across 10 different projects?
> List the 2-3 most common options you'd consider, and describe what drives your choice between them.

Write the result to `docs/specs/rules-evaluation/<rule-name>/default-transcript.md`.

**Critical:** do NOT look at the rule while writing pass 1. The whole point
is that the default is elicited before the rule contaminates it.

### 3. Tier 1, Pass 2 — diff and score

Now load both the rule and the pass-1 default transcript. Produce a diff.
For each scenario, answer:

- **What does the rule prescribe?**
- **What did the default say?**
- **Are they the same, different, or contradictory?**

Then score on four integer axes (0-3 each, total 0-12):

| Axis | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| determinism_gain | default was already deterministic | rule narrows slightly | rule eliminates real ambiguity | rule resolves a frequent, costly inconsistency |
| correctness_delta | default was correct | rule marginally better | rule catches a real class of errors | rule prevents a major failure mode |
| friction_cost (inverted — higher is worse) | zero extra friction | minor verbosity | noticeable overhead in common flows | actively fights idiomatic work |
| convention_conflict (inverted — higher is worse) | aligns with project conventions | minor stylistic difference | contradicts a documented convention | contradicts a locked architectural decision |

**Scoring interpretation by type:**

For **correction** rules, `correctness_delta` is the primary signal — the rule
fixes something Claude gets wrong. `determinism_gain` is secondary.

For **steering** rules, `determinism_gain` is the primary signal — the rule
reduces implementation variance across projects. Reframe the axis question:
*"How many valid approaches does Claude have here, and does the rule collapse them to one?"*
A steering rule with 3+ valid alternatives it collapses → DG=3.
A steering rule where Claude already picks consistently → DG=0 → this is steering inflation,
and `defer-to-default` is still the right verdict.

`determinism_gain` and `correctness_delta` are positive signals. `friction_cost`
and `convention_conflict` are negative. The verdict is not a pure sum — it is
the judgment call below.

### 4. Emit the verdict

Map scores to one of exactly four verdicts:

| Verdict | When |
|---|---|
| `adopt-as-is` | determinism_gain ≥ 2 OR correctness_delta ≥ 2, AND friction_cost ≤ 1, AND convention_conflict ≤ 1 |
| `adopt-with-edits` | the rule has a real benefit but needs scoping, wording, or conflict-resolution edits before adoption — specify the edits |
| `reject` | friction_cost = 3 OR convention_conflict = 3, OR benefits are not worth the per-turn cost |
| `defer-to-default` | determinism_gain ≤ 1 AND correctness_delta ≤ 1 — the rule restates what Claude already does. **This is the rule-inflation catch.** |

Write the human-readable analysis to
`docs/specs/rules-evaluation/<rule-name>/diff-and-verdict.md` and the
machine-readable result to `docs/specs/rules-evaluation/<rule-name>/verdict.json`:

```json
{
  "rule_path": "rules/tool-selection.md",
  "rule_type": "correction",
  "scope": "project",
  "stack": "universal",
  "verdict": "adopt-as-is",
  "scores": {
    "determinism_gain": 3,
    "correctness_delta": 2,
    "friction_cost": 0,
    "convention_conflict": 0
  },
  "scenarios_evaluated": 3,
  "tier2_ran": false,
  "tier2_verdict": null,
  "evidence": {
    "default_transcript": "docs/specs/rules-evaluation/tool-selection/default-transcript.md",
    "diff_and_verdict": "docs/specs/rules-evaluation/tool-selection/diff-and-verdict.md"
  },
  "suggested_registry_entry": {
    "path": "rules/tool-selection.md",
    "type": "correction",
    "scope": "project",
    "stack": "universal",
    "source": "local",
    "last_evaluated": "2026-04-13",
    "source_sha": null
  },
  "evaluated_at": "2026-04-13"
}
```

### 5. Tier 2 — cross-model challenge (conditional)

Run Tier 2 when **any** of:
- `--scope global` is set (mandatory)
- `--cross-model` flag is set
- Tier 1 verdict is `adopt-as-is` and scope is global

Invoke `review-cross-model` with the Tier 1 artifacts as input. The reviewer's
job is to **challenge the adopt verdict**: find a reason the rule might
actually be defer-to-default or have a hidden friction cost.

If Tier 2 confirms: write `tier2_verdict: "confirmed"` in verdict.json.
If Tier 2 flips: the final verdict becomes the more conservative of the two
(Tier 1 `adopt-as-is` + Tier 2 `defer-to-default` → final `defer-to-default`;
Tier 1 `adopt-as-is` + Tier 2 `adopt-with-edits` → final `adopt-with-edits`).
Write `tier2_verdict: "flipped"` and update `verdict` accordingly.

### 6. Batch mode

If invoked with `--rule-pack <dir>`: iterate steps 1-5 per rule. At the end,
write `docs/specs/rules-evaluation/summary.md` with a table:

| Rule | Verdict | Scores (DG/CD/FC/CC) | Tier 2 | Notes |
|---|---|---|---|---|
| typescript/imports.md | adopt-as-is | 3/2/0/0 | ran, confirmed | — |
| typescript/null-checks.md | defer-to-default | 1/1/1/0 | — | restates strict null check behaviour |

Group by verdict in the summary — humans scanning the output want to see
*adopt* candidates separately from *reject* and *defer*.

### 7. Do NOT write the manifest

This skill never edits `skills-manifest.json`. The `suggested_registry_entry`
in verdict.json is a suggestion — a human or orchestrating skill
(e.g., future `blend-rules`) commits the registration. This separation keeps
evaluation and adoption as distinct reviewable steps.

## Rationalization Table

These thoughts mean STOP — you're about to contaminate the probe:

| Thought | Reality |
|---|---|
| "I can just read the rule and judge it directly" | That IS the contamination this skill exists to prevent. The whole bias-isolation story collapses if pass 1 sees the rule. |
| "This rule is obviously correct, skip pass 1" | If it is obviously correct, pass 1 will say so. The cost of doing pass 1 is one prompt. Do it. |
| "The scores look like a formality" | They are the audit trail. A future re-evaluation compares scores over time; narrative judgments cannot. |
| "Tier 2 is overkill, the Tier 1 verdict is clearly right" | For global-scope adoption, Tier 2 is mandatory, not optional. Global rules fire on every turn across every project. |
| "defer-to-default feels too harsh — let's adopt anyway" | Defer-to-default IS the value this skill produces. Rules that restate defaults are rule inflation. Say no. |
| "It's a steering rule so variance is expected — DG should be high" | Steering rules still get `defer-to-default` if Claude already picks consistently. Variance must be real, not assumed. |
| "Claude knows many options so DG must be high for steering" | Knowing options ≠ varying between them. If Claude consistently picks one approach for this scenario, DG=0. |

## Red Flags

- Pass 1 transcript mentions the rule by name or quotes it → pass 1 was contaminated; redo from scratch in a clean context
- All four scores clustered at 1 → the rule is borderline; verdict should be `defer-to-default` or `adopt-with-edits`, not `adopt-as-is`
- Verdict `adopt-as-is` with `convention_conflict ≥ 2` → inconsistent; the rule conflicts with project conventions and must at minimum be `adopt-with-edits`
- Batch mode summary has >80% `adopt-as-is` → suspect rubber-stamping; spot-check by re-running a sample with fresh context

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | default-transcript.md exists and was written before pass 2 | file present; does not mention the rule by name/content | |
| 2 | diff-and-verdict.md exists | file present | |
| 3 | verdict.json exists and validates | `jq .verdict < verdict.json` returns one of the 4 allowed strings | |
| 4 | Scores are integers 0-3 | `jq '.scores \| to_entries[] \| .value' verdict.json` all 0-3 | |
| 5 | Tier 2 ran for global scope | if `scope == global`, `tier2_ran == true` | |
| 6 | Registry entry suggested (not written) | `suggested_registry_entry` present; `skills-manifest.json` unchanged | |
| 7 | Batch summary present in batch mode | `docs/specs/rules-evaluation/summary.md` exists when `--rule-pack` was used | |

## Key Principles

- **Bias isolation first.** The default is elicited without the rule in view. This is the load-bearing claim; violate it and the verdict is worthless.
- **Four verdicts, no fifth.** `adopt-as-is | adopt-with-edits | reject | defer-to-default`. Do not invent a hedge verdict.
- **Defer-to-default is a feature, not a failure.** It is the mechanism that prevents rule inflation. Say it clearly when it applies.
- **Evaluation and adoption are separate.** This skill never edits the manifest. A different step — human review or a future `blend-rules` — commits the registration.
- **Global rules deserve more rigor.** Per-turn injection across every project is expensive; Tier 2 is the price of admission.

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextLoadAndRuleEligibility --evidence file:rules/<rule>.md --evidence file:references/rules-policy.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-BiasIsolatedDefaultProbe --evidence file:docs/specs/rules-evaluation/<rule-name>/default-transcript.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-DiffScoreAndVerdict --evidence file:docs/specs/rules-evaluation/<rule-name>/diff-and-verdict.md --evidence file:docs/specs/rules-evaluation/<rule-name>/verdict.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-Tier2CrossModelChallenge --evidence file:docs/specs/rules-evaluation/<rule-name>/verdict.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-BatchSummaryIfApplicable --evidence file:docs/specs/rules-evaluation/summary.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-NoManifestMutationCheck --evidence command_output:.svc/verify-manifest-unchanged-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-NextActionTrailer --evidence file:docs/specs/rules-evaluation/<rule-name>/diff-and-verdict.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/evaluate-rule-self-verify-<WI>.log
```

For conditional phases, still record the phase with skip evidence:
- `P4-Tier2CrossModelChallenge`: record `--evidence command_output:.svc/evaluate-rule-tier2-skip-<WI>.log` when scope is project and no `--cross-model` flag was used.
- `P5-BatchSummaryIfApplicable`: record `--evidence command_output:.svc/evaluate-rule-single-rule-<WI>.log` for single-rule mode.

If no task graph exists, write the same phase/evidence list in the final
response so an orchestrator can backfill the receipt.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

**Chaining:** standalone utility — invoked manually, from a future `blend-rules` skill, or during rule-pack blend reviews. Does not participate in product lanes.

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)**
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**After completion, emit the next command:**

Single-rule, `adopt-as-is` or `adopt-with-edits`:
```
**Next:** register the rule by adding the suggested entry to `skills-manifest.json` → `rulesRegistry.entries`, then `node scripts/lint-skills-manifest.mjs`.
```

Single-rule, `reject` or `defer-to-default`:
```
**Next:** do not register. Delete the candidate rule file or move it to `references/` if it is useful internal doctrine.
```

Batch mode:
```
**Next:** review `docs/specs/rules-evaluation/summary.md`. Register every `adopt-as-is` / `adopt-with-edits` row, delete or defer the rest.
```

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
