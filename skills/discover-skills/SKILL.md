---
name: discover-skills
version: "1.0"
description: >
  Discover and install external skills from the open agent skill ecosystem.
  Wraps npx skills find/add. Invoked by analyze-domain or research when they
  encounter a capability gap an external skill could fill. Also works standalone:
  "find a skill for X", "is there a skill that can", "what skills exist for".
phases:
  - id: P1-CapabilityGapScope
    trigger: always
    reads: ["user request", "calling skill context", "docs/specs/domain-profile.md", "docs/specs/research-log.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-MarketplaceSearch
    trigger: always
    reads: ["skills.sh search results", "SkillHub search results", "fallback WebSearch results"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ResultDedupQualityRank
    trigger: search-results-present
    reads: ["raw marketplace results", "install counts", "quality ratings", "publisher reputation"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-RecommendationDecision
    trigger: always
    reads: ["ranked skill candidates", "guided or auto mode"]
    writes: ["assistant recommendation or install decision"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-ResearchLogPersistence
    trigger: always
    reads: ["search outcome", "install outcome"]
    writes: ["docs/specs/research-log.md", "references/knowledge/skills/<name>/CAPABILITIES.md", "references/domains/<stack>/"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyReturnControl
    trigger: always
    reads: ["Self-Verify checklist", ".svc/lane-tasks-<WI>.json", "calling skill context"]
    writes: [".svc/lane-tasks-<WI>.json", "assistant response"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
outputs:
  produces:
    - { path: "docs/specs/research-log.md", artifact: research-log }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Skill Finder

Discover external skills when svc encounters a capability gap. Searches multiple
skill marketplaces (skills.sh + SkillHub) to maximize coverage and uses combined
quality signals (install count + AI ratings) for better recommendations.

**Announce at start:** "I'm using discover-skills to search for external skills that could help."

**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction, storage, and staleness rules.

## Sources

Two skill marketplaces are searched — each has different strengths:

| Source | CLI | Index size | Quality signal | Strength |
|---|---|---|---|---|
| **skills.sh** (primary) | `npx skills find` | ~90K+ | Install count | Largest index, established ecosystem |
| **SkillHub** (secondary) | `npx @skill-hub/cli search` | ~80K+ | 5-dimension AI rating (Practicality, Clarity, Automation, Quality, Impact) | Semantic search, quality ratings |

Both sources index SKILL.md-format skills from GitHub. There is overlap — many
skills appear in both. The value of searching both is: skills.sh has broader
coverage and install-count popularity signal; SkillHub adds AI quality ratings
that skills.sh completely lacks.

**Sources NOT searched (and why):**
- SkillsMP (700K+ claimed): no API, blocks bots (403), inflated count from GitHub scraping, 2-star minimum filter only
- LobeHub: web-only, blocked, unclear index size
- claudemarketplaces.com: meta-directory of other marketplaces, no own skill index

## When Invoked

- `analyze-domain` finds a domain where a specialized skill would help
- `research` can't resolve a question from internal knowledge + WebSearch
- User asks directly: "is there a skill for X?"
- During `execute-changeset` when the tech stack needs expertise not in stack convention packs (`references/domains/`)

## Process

### Step 1: Search both sources

Run both searches. They're independent so run them in the same turn when possible.

**Primary — skills.sh:**
```bash
npx skills find "[query]" 2>/dev/null
```

**Secondary — SkillHub:**
```bash
npx @skill-hub/cli search "[query]" 2>/dev/null
```

If neither CLI is available:
```bash
which npx >/dev/null 2>&1 && echo "NPX_AVAILABLE" || echo "NPX_NOT_AVAILABLE"
```

If not available, fall back to WebSearch:
- "claude code skill [capability] site:skills.sh"
- "claude code skill [capability] site:skillhub.club"
- "github claude skills [topic]"

### Step 2: Merge and deduplicate results

Combine results from both sources. Skills appearing in both get a boost — it
means the skill is indexed more broadly. Deduplicate by skill name and author
(same `owner/repo@skill-name` = same skill).

For each unique skill, collect:
- **Name and source** (GitHub repo)
- **What it does** (from description)
- **Install count** (from skills.sh — primary popularity signal)
- **AI quality score** (from SkillHub if available — secondary quality signal)
- **Publisher reputation** (known publishers like `vercel-labs`, `anthropics`, `microsoft` get a trust boost)

### Step 3: Rank and evaluate

**Ranking formula (applied mentally, not computed):**

| Signal | Weight | Why |
|---|---|---|
| Install count (skills.sh) | High | Proven adoption — people actually use it |
| AI quality score (SkillHub) | Medium | Quality assessment — but opaque methodology |
| Publisher reputation | Medium | Known publishers have more skin in the game |
| Freshness (last commit) | Low | Stale skills may still work; fresh ones may be half-baked |

**Quality thresholds:**
- 1K+ installs on skills.sh: strong signal
- 100-1K installs: moderate — read the SKILL.md before recommending
- <100 installs: weak — only recommend if the skill is from a reputable publisher or clearly fills a unique gap
- S-rank (9.0+) or A-rank (8.0+) on SkillHub: strong quality signal
- No rating on SkillHub: neutral (many good skills aren't indexed there)

**Relevance assessment** for each result:
- **High** — directly addresses the capability gap
- **Medium** — partially addresses it or is in an adjacent domain
- **Low** — tangential match, probably not worth installing

### Step 4: Present recommendation

**Guided mode:**
```
Found N skills for [query] across skills.sh + SkillHub:

1. [name] by [author] — [description]
   skills.sh: [N] installs | SkillHub: [rating or "not indexed"]
   Relevance: high | Trust: [publisher reputation, freshness]
   RECOMMENDED

2. [name] by [author] — [description]
   skills.sh: [N] installs | SkillHub: [rating or "not indexed"]
   Relevance: medium

3. [name] by [author] — [description]
   skills.sh: [N] installs | SkillHub: [rating or "not indexed"]
   Relevance: low

Install the recommended one? (yes / pick another / skip)
```

**Auto mode:**
Install the highest-relevance, highest-trust skill automatically. Log the installation.

### Step 5: Install (if approved)

```bash
npx skills add [package]
```

After installation:
- Log to `docs/specs/research-log.md`: "Installed skill [name] for [reason]"
- If the skill provides domain-specific knowledge, write to `references/knowledge/skills/<name>/CAPABILITIES.md`
- If it provides stack-level coding conventions, write to `references/domains/<stack>/`

### Step 6: Report

If no relevant skills found:
"No external skills found for [query] across skills.sh and SkillHub. The analyze-domain or research skill should build this knowledge from primary sources (docs, WebSearch)."

If a skill was installed:
"Installed [name]. It provides [capability]. Available as /[skill-name] in future sessions."

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Both sources searched | npx skills find AND npx @skill-hub/cli search executed (or fallback) | |
| 2 | Results merged and deduplicated | combined list with no duplicate skills | |
| 3 | Results ranked with quality signals | install count + AI rating (if available) + publisher reputation | |
| 4 | Finding logged | entry in research-log.md | |
| 5 | Knowledge protocol conformance | Library checked first, project artifact written, knowledge persisted, .version updated | |

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-CapabilityGapScope --evidence command_output:.svc/discover-skills-scope.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-MarketplaceSearch --evidence command_output:.svc/discover-skills-search.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ResultDedupQualityRank --evidence command_output:.svc/discover-skills-rank.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-RecommendationDecision --evidence command_output:.svc/discover-skills-recommendation.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ResearchLogPersistence --evidence file:docs/specs/research-log.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyReturnControl --evidence command_output:.svc/discover-skills-self-verify.log
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

discover-skills does not participate in progressive chains.
After completing, control returns to the calling skill (analyze-domain, research) or the user.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
