---
name: blend-private
version: "1.0"
description: >-
  Blend patterns from a private repo you own into svc WITHOUT leaving source identifiers in the tree (repo/org/service/client names, private URLs, proprietary terms) — sibling to blend-external for when attribution is neither required nor possible. Use when: "blend from my private repo", "take this pattern but scrub the source". Also: "blend without attribution", "take this pattern from my own code". Also: "extract from my internal repo".
phases:
  - id: P1-AuthorizationGate
    trigger: always
    reads: ["task request", "authorization assertion"]
    writes: [".svc/blend-private-authorization.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-RedactionMapBuild
    trigger: always
    reads: ["private source identifiers", "source marker grep output"]
    writes: ["~/.svc/tmp-redaction-map-<date>.txt"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-PatternExtraction
    trigger: always
    reads: ["private source files", "redaction map", "target svc skill"]
    writes: [".svc/blend-private-patterns.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-RedactedBlendPlan
    trigger: always
    reads: ["candidate patterns", "redaction map hash", "target svc anchors"]
    writes: ["proposals/<date>-blend-internal-<pattern-slug>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-LocalLedgerAndScopeGate
    trigger: blend-approved-or-implemented
    reads: ["blend proposal", "target diff estimate", "~/.svc/private-blends.log"]
    writes: ["~/.svc/private-blends.log"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-PostApplyLeakQualityGate
    trigger: post-apply
    reads: ["redaction map", "framework tree", "tier-1 eval output"]
    writes: [".svc/blend-private-post-apply.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P7-SelfVerifyContinuation
    trigger: always
    reads: ["proposals/<date>-blend-internal-<pattern-slug>.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
    - authorization-assertion (Phase 0, not a file — must be recorded in proposal)
  optional:
    - { path: "references/knowledge/svc/CAPABILITIES.md", artifact: svc-capabilities }
outputs:
  produces:
    - { path: "proposals/<date>-blend-internal-<pattern-slug>.md", artifact: blend-plan }
    - { path: "~/.svc/private-blends.log", artifact: private-blend-ledger }
chain:
  lanes:
    framework: { position: 3 }
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Private Blend

Blend patterns from a private repo the user owns or has rights to, into svc,
without leaving source identifiers in the tree.

**Announce at start:** "I'm using the blend-private skill to blend a pattern from a private source into svc. Authorization gate runs first."

## Scope vs `blend-external`

| | `blend-external` | `blend-private` (this skill) |
|---|---|---|
| Source type | Public repo, permissive license | Private repo user owns or has rights to |
| Gate | License check (MIT/Apache/BSD required) | Authorization assertion (three categories) |
| Attribution | Mandatory (NOTICES + blend-registry) | Forbidden (redaction map enforced) |
| Output filename | `blend-<source-name>.md` | `blend-internal-<pattern-slug>.md` |
| Ledger | `references/blend-registry.json` (tracked) | `~/.svc/private-blends.log` (local, global) |
| Diff scope | Unconstrained (let the blend find its shape) | ≤ 30% of target file, must extend existing anchors |
| Quality gate | Human review | Human review + tier-1 evals MUST PASS post-apply |

If the source is public and attributable, use `blend-external`. If the source is
a private repo the user owns, use this skill. If the source is someone else's
private repo the user does not own and does not have explicit rights to,
**STOP — this skill is not for that case.**

## Required Sequence

Phase 0 through Phase 6 (7 phases). Do not skip Phase 0. Do not skip Phase 6.

## Phase 0 — Authorization gate (MANDATORY FIRST STEP)

Before any file read from the source repo, ask the user to confirm ONE of
these three categories verbatim. If none applies, STOP and tell the user this
skill is not appropriate for their situation.

1. **I am the sole author** of the source repo and all code within it.
2. **I have explicit rights from the owner** to reuse patterns from this
   source (contract, license grant, written permission).
3. **This is my employer's repo** and my employment agreement / IP assignment
   terms permit reuse of architectural patterns (not verbatim code) in
   unrelated personal open-source work.

Record the user's exact assertion in the proposal under `## Authorization`.
This is the safety fence that keeps this skill from being a code-laundering
vector. Do not continue without it.

If the user hedges ("I think so", "probably", "not sure"), treat it as
STOP. Point them to legal counsel or the repo owner. This is non-negotiable.

## Phase 1 — Build the redaction map

Before any analysis, assemble the identifier redaction map. Ask the user:

1. What is the source repo URL / name / org? (goes in map — must not leak)
2. What internal service names or codenames must not appear?
3. What client / customer / partner names must not appear?
4. What proprietary domain terms must not appear?
5. What private URLs, hostnames, or endpoint patterns must not appear?

Then grep the source for common private markers to catch what the user forgot:

```bash
# Run from inside the source repo (user acquires locally — this skill does not clone)
grep -rEI --include="*.md" --include="*.{ts,js,py,go,rs,yaml,yml,json}" \
  -o '[A-Z][a-zA-Z]{3,}(Service|Client|Gateway|Manager|Provider)' . \
  | sort -u | head -50

grep -rEI '\.internal|\.local|\.corp|@[a-z]+\.(com|io|ai)' . | head -50
```

Show the collected candidate list to the user and ask them to confirm which
strings are private. Produce the final redaction map as a sorted list of
strings. Write it to disk at the canonical path — this is the machine-readable
copy used by all three bash checks in Phase 3 and Phase 6:

```bash
REDACTION_DATE=<date>   # e.g. 2026-04-13
mkdir -p ~/.svc
printf '%s\n' "<identifier-1>" "<identifier-2>" ... | sort -u \
  > ~/.svc/tmp-redaction-map-${REDACTION_DATE}.txt
```

The proposal stores only the SHA256 of this file (in the header's `Redaction
map hash` field) — **never the identifier list itself**. The list is ephemeral
and local; it MUST NOT appear in any tracked file. The SHA is the audit record.

**The redaction map is the invariant.** Every artifact this skill writes is
checked against the map before save. Any match → fail, fix, retry.

## Phase 2 — Extract patterns only (NO verbatim code)

Read the source files the user points at. For each candidate pattern, produce
a pattern description — NEVER a verbatim code block. This means:

- Describe the *mechanism* (what the pattern does, how it works structurally)
- Describe the *design choice* (why it works, what it trades off)
- Describe the *shape* using generic names (not the source's names)
- Never copy function bodies, never copy comment text verbatim, never copy
  variable names that match redaction-map entries

If a pattern is impossible to describe without copying source code verbatim,
it's too concrete to blend safely. Skip it and tell the user why.

Build the candidate table:

| Pattern shape | Target svc skill / section | Novelty vs svc | Recommend |
|---|---|---|---|
| ... | ... | gap / improvement / duplicate | BLEND / SKIP |

## Phase 3 — Produce the redacted blend plan

For each BLEND item, specify ALL of the following sections. Same structure as
`blend-external` Phase 3 (problem today / how source solves it / what changes /
what NOT to take / why it matters) but with redacted framing.

**Filename:** `proposals/<date>-blend-internal-<pattern-slug>.md`

The `<pattern-slug>` is the name of the pattern itself (`queue-batching`,
`lease-renewal`, `dual-read-cache`) — NOT the source repo name. Never include
the source name, org, or any redaction-map entry in the filename.

**Template:**

```markdown
# Private Blend Plan: <pattern-slug>

**Date:** <today>
**Source type:** private (author / rights-granted / employment-permitted)
**Redaction map hash:** <sha256 of sorted redaction map>

## Authorization

<verbatim user assertion from Phase 0 — e.g. "I am the sole author of the
source repo and all code within it. — Stefan, 2026-04-13">

## Pattern origin / Into

- **Pattern origin:** the origin codebase (generic — no source name)
- **Into:** <svc skill file:section>

## The problem in svc today

<What currently happens. Name the failure mode with a concrete scenario —
inputs, behavior, wrong outcome. Read the target svc file first to describe
the current state accurately.>

## How the pattern solves it

<The mechanism. Why it works. Design choice rationale. Use generic role
nouns ("the origin codebase", "a production system", "the source") never
the repo/org name.>

## What this changes in svc

<Concrete before/after. Which section of which file changes. What new
checks, rules, or patterns are added. Must cite an existing svc anchor
(section header, numbered step) that is modified or extended. Net-new
top-level sections require an explicit `NEW SECTION:` marker with
rationale.>

**Diff scope check (pre-apply estimate):**
- Target file: `<path>`
- Target file line count: <N>
- Estimated diff size: <M> lines added/modified (<M/N * 100>%)
- Must be ≤ 30%. If over, the pattern is too large to adopt safely without
  degrading — split into multiple smaller patterns or reject.

## What NOT to take

<Parts to skip and why — conflicts with svc doctrine, duplicates existing
behavior, or would require copying verbatim code (redaction-map risk).>

## Why this matters

<The argument for this blend item. Connect failure mode to impact.>

## Hybrid opportunity

<Same as blend-external Phase 2c. Can svc's existing machinery
(progressive narrowing, 7 gates, spec-first, knowledge system) make this
pattern fundamentally better than the origin had it? If pure transplant
is the right move, say so explicitly.>
```

**Redaction check (mandatory before save):**

```bash
# From the framework repo root
REDACTION_DATE=<date>   # must match the date used in Phase 1
for term in $(cat ~/.svc/tmp-redaction-map-${REDACTION_DATE}.txt); do
  if grep -F "$term" proposals/<date>-blend-internal-<slug>.md; then
    echo "LEAK: $term appears in proposal — fix before save"
    exit 1
  fi
done
```

If any redaction-map entry appears in the proposal body, fail self-verify.
The map list never appears in the proposal at all (only the SHA hash does),
so this check catches accidental identifier bleed during pattern writing.

## Phase 4 — "Slight mod" adaptation rule

Before implementation, enforce quantitatively:

1. **Diff scope:** target svc file diff ≤ 30% of the target file's line count.
   Blends that rewrite a skill wholesale from a single private source are a
   red flag — they suggest either that svc already had this and the blend is
   redundant, or that the pattern is too large to adopt safely without
   degrading.
2. **Anchor citation:** every changed section must cite an existing svc
   anchor (section header, numbered step) that it modifies or extends. No
   net-new top-level sections without an explicit `NEW SECTION:` marker and
   rationale.
3. **No verbatim code carry-over:** grep the target svc file's diff against
   the redaction map — must be empty match. Also grep for common source-repo
   tells: file paths from the origin (`src/internal/...`), identifier
   conventions that don't match svc's (e.g. `PascalCaseClient` if svc uses
   kebab-case-skill).

## Phase 5 — Write to the local ledger (no registry, no NOTICES)

Private blends do NOT update `references/blend-registry.json` (public, tracked)
and do NOT update `NOTICES` (attribution file). Instead, append to a global,
user-local ledger:

```bash
mkdir -p ~/.svc
cat >> ~/.svc/private-blends.log <<EOF
---
date: <today>
authorization: <category — author/rights/employment>
pattern_slug: <slug>
target_svc_file: <path>
target_skill_name: <skill-name>
diff_line_count: <N added/modified>
target_file_total_lines: <total>
diff_percent: <N/total * 100>
redaction_map_sha256: <hash>
replay_tier1_result: <PASS/FAIL — filled at Phase 6>
EOF
```

`~/.svc/` is the existing global-artifact location (co-lives with
`~/.svc/builder-profile.md`). It is per-user, per-machine, never committed.
This gives the user a cross-project audit trail of private blends without any
source-identifying data touching any git repo.

## Phase 6 — Post-apply leak check and quality gate

After the proposal is implemented (by `improve-framework` or direct edit),
run BOTH checks before the proposal is marked done:

**Leak check:**
```bash
# From the framework repo root
for term in $(cat ~/.svc/tmp-redaction-map-<date>.txt); do
  if git grep -F "$term"; then
    echo "LEAK: $term appears in framework tree — fix before commit"
    exit 1
  fi
done
rm ~/.svc/tmp-redaction-map-<date>.txt  # ephemeral, never committed
```

**Quality gate (the "not deteriorating" invariant):**
```bash
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh --tier1
```

Both must PASS. If either fails, the blend has deteriorated quality —
roll back and iterate. Only after both pass AND the leak check is clean does
the proposal move to `proposals/done/`, and only then does the `~/.svc/private-blends.log`
entry get its `replay_tier1_result: PASS`.

The proposal never contained the identifier list (only the SHA hash), so no
stripping is needed before move to `proposals/done/`. Delete the ephemeral
map file after Phase 6 passes: `rm ~/.svc/tmp-redaction-map-<date>.txt`.

## Rules

- **No verbatim code.** Ever. Patterns, shapes, mechanisms — never function
  bodies, never comment text. If a pattern can't be described without copying
  verbatim, it's too concrete to blend.
- **No source identifiers in the tree.** Proposal filename, proposal body,
  target skill diff — all must pass the redaction-map grep.
- **No registry, no NOTICES.** This is the key divergence from `blend-external`.
  The user is the author; attribution is inapplicable. The local ledger
  (`~/.svc/private-blends.log`) is the user's private audit trail.
- **30% diff ceiling.** Keep blends surgical. If a pattern demands more, split
  it or reject it.
- **Tier-1 evals must PASS post-apply.** Mechanical "not deteriorating" check.
- **Do not implement.** This skill produces the plan. Implementation is
  `improve-framework` or direct edit. Phase 6 runs AFTER implementation.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Proposal file exists | `test -f proposals/<date>-blend-internal-<slug>.md` | |
| 2 | Authorization section present and verbatim | Proposal has `## Authorization` with user's exact assertion from Phase 0 | |
| 3 | Redaction map file written to disk | `test -f ~/.svc/tmp-redaction-map-<date>.txt` AND SHA recorded in proposal header | |
| 4 | Redaction map leak check clean | grep of `~/.svc/tmp-redaction-map-<date>.txt` entries against proposal body → 0 matches | |
| 5 | No verbatim code blocks from source | Proposal has pattern descriptions, not source code fences | |
| 6 | Filename free of source identifiers | grep filename against redaction map → 0 matches | |
| 7 | Every blend item has all 5 sections + hybrid opportunity | problem today / how pattern solves it / what changes / what NOT to take / why it matters / hybrid opportunity | |
| 8 | Diff scope ≤ 30% | Estimated or actual diff line count ≤ 30% of target file line count | |
| 9 | Every changed section cites existing svc anchor | No net-new top-level sections without `NEW SECTION:` marker + rationale | |
| 10 | Global ledger updated | `~/.svc/private-blends.log` has new entry with all fields | |
| 11 | NO registry mutation | `references/blend-registry.json` untouched in this proposal's diff | |
| 12 | NO NOTICES mutation | `NOTICES` untouched in this proposal's diff | |
| 13 | Post-apply leak check clean (Phase 6) | `git grep` of redaction map across framework tree → 0 matches | |
| 14 | Tier-1 evals PASS post-apply (Phase 6) | `lint-skills-manifest.mjs` exits 0 AND `run-all-evals.sh --tier1` exits 0 | |
| 15 | Ephemeral map file deleted after Phase 6 | `test ! -f ~/.svc/tmp-redaction-map-<date>.txt` (deleted once all checks pass) | |

## Proposal Lifecycle

Private-blend plans live in `proposals/` while pending. When implemented and
verified by Phase 6 (leak check + tier-1 evals pass), move to `proposals/done/`:

```bash
# After stripping the redaction map section:
mv proposals/<date>-blend-internal-<slug>.md proposals/done/
```

Only the hash of the redaction map survives in the header — enough for audit,
not enough to reconstruct private identifiers.

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `blend-private` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-AuthorizationGate --evidence command_output:.svc/blend-private-authorization.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-RedactionMapBuild --evidence file:~/.svc/tmp-redaction-map-<date>.txt
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-PatternExtraction --evidence command_output:.svc/blend-private-patterns.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-RedactedBlendPlan --evidence file:proposals/<date>-blend-internal-<pattern-slug>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-LocalLedgerAndScopeGate --evidence file:~/.svc/private-blends.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-PostApplyLeakQualityGate --evidence command_output:.svc/blend-private-post-apply.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/blend-private-self-verify.log
```

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

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill does not chain progressively. It produces a blend plan in
`proposals/`. Implementation happens in `improve-framework` or by direct
edit, then Phase 6 runs the post-apply leak + quality gate.

After completion, update `FRAMEWORK-STATE.md` with the blend entry (skill
target, pattern slug — NOT the source repo name).

## Failure modes this skill prevents

- **Accidental source leak:** redaction map + pre-save grep + post-apply
  `git grep` catch identifier bleed at three layers.
- **Scope creep:** 30% diff ceiling rejects blends that would degrade svc
  by wholesale-replacing a skill with a private pattern.
- **Quality regression:** tier-1 evals enforce "not deteriorating"
  mechanically — no vibes judgment.
- **Code laundering misuse:** Phase 0 authorization gate requires the user
  to assert authorship or explicit rights in one of three defined categories.
  Hedged or absent assertion → STOP.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
