# Cutting-Edge Techniques Deep Dive — Beyond Fable 5 Guide

**Date:** 2026-06-11
**Purpose:** The Fable 5 guide covers loops, dynamic workflows, routines, memory, and vision. This document covers the techniques that go BEYOND those fundamentals — the 2026 state-of-the-art that makes an agent system truly augment capabilities rather than just execute them.
**Reviewed:** 2026-06-11 — 11 compatibility issues found and fixed against svc infrastructure constraints.
**Host provider verified:** 2026-06-11 — All 6 infrastructure assumptions verified against Anthropic documentation (models, Routines, Managed Agents, Dynamic Workflows, Agent SDK, vision).
**Re-reviewed:** 2026-06-13 (Claude) — see Reviewer Corrections below. Sound reference doc; a few data sources don't exist yet and pricing duplicates the registry.

---

## Reviewer Corrections (2026-06-13, Claude)

Verified against the working tree, `references/model-registry.json`, `scripts/dispatch-worker.sh`, and `claude --help`.

- **`.svc/auto-grades.jsonl` does not exist.** Techniques 2, 4, 10 read it and the "what svc has" tables claim it exists. It doesn't — those scripts run on empty data until something writes it. (`.svc/dispatch-log.jsonl` and `.svc/pipeline-decisions.jsonl` **do** exist.)
- **`scripts/write-auto-grade.mjs` does not exist** — Technique 1's sequential fallback calls it. Dead reference; create it or drop the call.
- **Pricing table is a second source of truth.** CLAUDE.md mandates model IDs/pricing single-sourced from `references/model-registry.json`. Reference the registry instead of hardcoding Fable5/Opus/Sonnet/Haiku prices (Haiku output $5 here vs registry's $3-area; registry has no Anthropic-model prices to begin with). Per `rules/no-fabrication.md`, unsourced figures must be marked or removed.
- **Host-capability matrix is unverified training-data** (hook counts per host, subagent/vision support). Per the `host-capability-training-data-staleness` learning (conf 10), verify each host's *current* docs before using these to gate fallbacks — do not ship the matrix as fact.
- **`claude -p --agent <name>` is VALID** (confirmed via `claude --help`) — but `run-debate.mjs` spawns its own claude subprocesses, bypassing `dispatch-worker.sh` and `SVC_MODEL_PROFILE` routing (which handles claude-native/kimi-native/mimo differently). On a non-Claude profile it launches the wrong harness. Reuse the established transport or honor the profile.
- **`debate-moderator.md` `model: haiku-4.5`** — registry id is `claude-haiku-4-5-20251001` / label `haiku`. Verify the frontmatter accepts that string.
- **Scaffolds vs features:** `htn-decompose.mjs`, `self-play.mjs`, `population-compare.mjs` emit a structure for an LLM to fill — fine as a reference, not shippable capabilities.
- **Verified-good:** `agents/svc-lens-*.md` exist; `detect-host.sh`/`dispatch-worker.sh`/`resolve-model.sh`/`verify-skill-refactor.mjs` exist; AP-2 reasoning and the 11→5 JSONL consolidation are sound.

---

## Host Provider Verification (Anthropic Docs)

All infrastructure assumptions in this plan are verified against current Anthropic documentation:

| Capability | Verified | API/CLI | Notes |
|---|---|---|---|
| **Fable 5** | ✅ | `claude-fable-5` | 1M context, $10/$50 per MTok, launched June 9 2026. Available on Claude API, Bedrock, Vertex, Foundry. |
| **Routines** | ✅ | `/schedule` CLI, web UI at `claude.ai/code/routines` | Research preview. Schedule/API/GitHub triggers. Cloud infrastructure. |
| **Managed Agents** | ✅ | REST API at `platform.claude.com` | Hosted sandbox per session. Separate from Agent SDK. |
| **Dynamic Workflows** | ✅ | `ultracode` keyword, `/deep-research` bundled | JS scripts orchestrating subagents. Up to 16 concurrent, 1000 total per run. Claude Code v2.1.154+. |
| **Agent SDK** | ✅ | `@anthropic-ai/claude-agent-sdk` (npm/pip) | Python + TypeScript. `query()` with `agents` dict. Built-in tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch. |
| **Vision** | ✅ | Built-in to all models | "All Claude models support text and image input." No special flags needed. |

**Pricing:** See `references/model-registry.json` for authoritative MiMo model pricing. Anthropic pricing: see Anthropic docs. Do not maintain a parallel pricing table in plan documents.

---

## Why "Augment" Not "Replace"

The Fable 5 guide describes a system that compounds — each run leaves the next run smarter. But compounding on what? The guide assumes the base system is already good. The techniques below are about making the base system **smarter at what it already does**, not just doing it repeatedly.

The distinction:
- **Fable 5 guide:** Run → grade → distill → write back → run again (iterative improvement)
- **This deep dive:** Think → reason → debate → explore → decide → learn from the decision architecture itself (structural improvement)

---

## Infrastructure Constraints (verified against svc)

All implementations below comply with these constraints:

| Constraint | Source | What it means |
|---|---|---|
| **AP-2: No inline large files** | `references/anti-patterns.md` | Pass file paths to agents, not file contents. Exception: <500 token slices. |
| **Agent closed input manifest** | `agents/README.md` | Agents read only what's in their manifest. No codebase browsing. |
| **Agent closed tool allowlist** | `agents/README.md` | Default tools: `[]`. Permitted by default: `Read`, `Grep` (scoped to manifest). |
| **No per-task quality review** | `execute-changeset/SKILL.md:103` | "One holistic review of the full diff after ALL tasks." |
| **Worker result contract** | `dispatch-waves/SKILL.md` | Workers emit: `wi, status, worker_summary, changed_files, validation_evidence, clean_worktree, parent_graph_mutation` |
| **Causal reasoning exists** | `diagnose-bug/SKILL.md` | P3-RootCause phase with Cross-System Falsification Mode already does causal chains |
| **JSONL append-only** | `manage-learnings/SKILL.md:74` | Learnings files are append-only. No in-place modification. |
| **`.svc/` gitignore** | `.gitignore` | Ephemeral state gitignored; durable state committed. New files must be categorized. |
| **Context degradation tiers** | `references/context-budget.md` | PEAK (0-30%), GOOD (30-50%), DEGRADING (50-70%), POOR (70%+). POOR = hallucination. |
| **Orchestrator reads specs, subagents read code** | `references/context-budget.md` | Orchestrator never loads implementation files. |
| **Dynamic Workflows exist** | Anthropic docs (verified) | JS scripts orchestrating subagents. `ultracode` keyword. Up to 16 concurrent, 1000 total. |
| **Managed Agents exist** | Anthropic docs (verified) | Hosted REST API. Separate from Agent SDK. Sandbox per session. |
| **Routines exist (research preview)** | Anthropic docs (verified) | Schedule/API/GitHub triggers. Cloud infrastructure. `/schedule` CLI. |
| **Agent SDK exists** | Anthropic docs (verified) | `@anthropic-ai/claude-agent-sdk`. Python + TypeScript. `query()` with `agents` dict. |

---

## Cross-Host Compatibility Matrix

Each technique's implementation must work on all supported hosts. **Note: host capability data below is from host config files and FRAMEWORK-STATE.md — verify against current docs before using for fallback logic.**

| Capability | Claude | Kimi | Codex | Gemini | OpenCode | MiMo Code | Antigravity | Cursor |
|---|---|---|---|---|---|---|---|---|
| **Subagents** | ✅ Agent tool | ✅ YAML-defined | ❌ | ❌ | ✅ config-based | ✅ build/plan/compose | ❓ | ❓ |
| **Parallel subagents** | ✅ background:true | ✅ /task | — | — | ✅ task tool | ✅ parallel | — | — |
| **Background tasks** | ✅ | ✅ persistent | ❌ | ❌ | ❌ | ❓ | ❓ | ❌ |
| **Hook events** | 28 | 13 | 6 (opt-in) | 11 | 6 (plugin) | 6 (plugin) | 0 | 0 (disabled) |
| **Vision/Image** | ✅ | ✅ | ❌ | ✅ | ✅ image_input | ✅ image_input | ❓ | ❓ |
| **Dynamic Workflows** | ✅ ultracode | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Routines/scheduled** | ✅ /schedule | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Persistent memory** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ MEMORY.md + FTS5 | ❌ | ❌ |
| **/goal stop condition** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ /goal + judge | ❌ | ❌ |
| **/dream /distill** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ auto + manual | ❌ | ❌ |
| **Compose mode** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ specs-driven | ❌ | ❌ |
| **Max Mode** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ N candidates + judge | ❌ | ❌ |
| **Model routing** | Anthropic+MiMo | Kimi+MiMo | OpenAI | Gemini | Any (MiMo primary) | MiMo native | Gemini | Cursor models |
| **Task graph UI** | TaskList/Update | /task+List | update_plan | write_todos | todowrite | task tool (tree) | file-backed | file-backed |

### Technique Host Compatibility

| Technique | Requires subagents? | Fully host-compatible? | Fallback for no-subagent hosts |
|---|---|---|---|
| 1. Multi-Agent Debate | YES | Claude, Kimi, OpenCode, MiMo Code only | Sequential single-reviewer (existing review-gate) |
| 2. Experience Replay | NO | ✅ All hosts | N/A — script reads existing logs |
| 3. HTN Planning | NO | ✅ All hosts | N/A — script + LLM decomposition |
| 4. Uncertainty Quantification | NO | ✅ All hosts | N/A — script + JSONL logging |
| 5. Population-Based Learning | YES | Claude, Kimi, OpenCode, MiMo Code only | Sequential worker execution (no parallel comparison) |
| 6. Causal Reasoning | NO | ✅ All hosts | N/A — enhances diagnose-bug |
| 7. Self-Play | NO | ✅ All hosts | N/A — script + concern mapping |
| 8. Meta-Learning | NO | ✅ All hosts | N/A — script + JSONL logging |
| 9. RAR | NO | ✅ All hosts | N/A — reasoning pattern in skills |
| 10. Adaptive Temperature | NO | ✅ All hosts | N/A — script reads existing data |

**8 of 10 techniques are fully host-compatible.** Techniques 1 (Multi-Agent Debate) and 5 (Population-Based Learning) require subagents and work on Claude, Kimi, OpenCode, and MiMo Code with sequential fallbacks for Codex/Gemini/Antigravity/Cursor.

---

## TECHNIQUE 1: Multi-Agent Debate (Adversarial Reasoning)

### What it is
Instead of one agent producing an answer and another verifying it, multiple agents **argue** about the answer. Each agent sees only the artifact and their assigned perspective. The debate surface is structured — not free-form discussion, but constrained argument with evidence requirements.

### What svc already has
- `review-exec` cross-model adversarial review (Claude vs Codex/Gemini)
- `review-gate` 5-step protocol with self-review → cross-review
- `svc-lens-*` agents (correctness, perf, security, spec-fidelity) as independent verifiers

### What's missing
svc's adversarial review is **pairwise** (maker vs one reviewer). Multi-agent debate adds **N reviewers** with **different perspectives**, each independently evaluating, then a **moderator** synthesizes the debate into a final verdict.

### How to implement

**New file:** `agents/debate-moderator.md`
```markdown
---
name: debate-moderator
description: Synthesizes multi-agent debate into final verdict. Reads debate transcript from file.
model: haiku-4.5
tools: [Read]
harness: claude
---

# Debate Moderator

You receive a path to a debate transcript file. Read it, then synthesize.

## Input
The parent skill passes a path to `.svc/debates/<id>/transcript.md`.

## Your job
Read the transcript. Synthesize the debate into a final verdict.

## Debate structure in the transcript:
- Agent A (correctness lens): findings + evidence
- Agent B (security lens): findings + evidence
- Agent C (performance lens): findings + evidence
- Agent D (spec-fidelity lens): findings + evidence

## Your output:
```yaml
verdict: PASS | FAIL | CONDITIONAL
consensus_findings:
  - finding: "<all agents agree>"
    severity: critical | high | medium | low
dissenting_findings:
  - finding: "<agents disagree>"
    majority: "<which side>"
    minority_view: "<dissenting argument>"
    resolution: "<why majority wins or why this needs human input>"
```

## Rules:
- Do not introduce new findings — only synthesize what agents presented.
- If agents disagree on severity, use the HIGHEST severity cited.
- If 3+ agents flag the same issue from different angles, it's consensus.
- CONDITIONAL verdict: pass with specific remediation required.
```

**New script:** `scripts/run-debate.mjs`
```javascript
#!/usr/bin/env node
// Runs multi-agent debate on an artifact
// Passes file PATHS to agents (AP-2 compliant), not inline content

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    if (process.argv[i] === '--lens') args.lenses = process.argv[i+1].split(',');
    else if (process.argv[i] === '--dry-run') args.dryRun = true;
    else args[process.argv[i].slice(2)] = process.argv[i+1];
  }
  return args;
}

async function runDebate(artifactPath, lenses) {
  const debateId = `debate-${Date.now()}`;
  const debateDir = path.join(projectDir, '.svc', 'debates', debateId);
  fs.mkdirSync(debateDir, { recursive: true });

  const results = [];

  // Phase 1: Each lens agent evaluates independently
  // AP-2 compliant: pass file path, not content
  for (const lens of lenses) {
    const agentFile = path.join(projectDir, 'agents', `svc-lens-${lens}.md`);
    if (!fs.existsSync(agentFile)) continue;

    // Pass the artifact PATH to the agent — agent reads it via tools: [Read]
    const result = execSync(
      `bash scripts/dispatch-worker.sh --skill svc-lens-${lens} --prompt "Read and evaluate the artifact at ${artifactPath}. Output structured findings." --output-format json`,
      { encoding: 'utf8', timeout: 120000 }
    );
    results.push({ lens, result: JSON.parse(result) });

    // Write each agent's result to debate dir (file-based data passing per agent-patterns.md)
    fs.writeFileSync(
      path.join(debateDir, `agent-${lens}.json`),
      JSON.stringify(results[results.length - 1], null, 2)
    );
  }

  // Phase 2: Moderator reads all agent results from debate dir
  // Build a transcript file (not inline) — AP-2 compliant
  const transcript = results.map(r =>
    `## ${r.lens} Agent\n${JSON.stringify(r.result, null, 2)}`
  ).join('\n\n');
  fs.writeFileSync(path.join(debateDir, 'transcript.md'), transcript);

  // Moderator reads transcript file path, not inline content
  const moderatorResult = execSync(
    `bash scripts/dispatch-worker.sh --skill debate-moderator --prompt "Read and synthesize the debate transcript at ${path.join(debateDir, 'transcript.md')}" --output-format json`,
    { encoding: 'utf8', timeout: 120000 }
  );

  const verdict = JSON.parse(moderatorResult);
  fs.writeFileSync(path.join(debateDir, 'verdict.json'), JSON.stringify(verdict, null, 2));

  return verdict;
}

const args = parseArgs();
if (!args.artifact) {
  console.error('Usage: run-debate.mjs --artifact <path> --lens <lens1,lens2,...>');
  process.exit(1);
}

// Validate artifact exists (closed input manifest — agent can't browse for it)
if (!fs.existsSync(args.artifact)) {
  console.error(`Artifact not found: ${args.artifact}`);
  process.exit(1);
}

runDebate(args.artifact, args.lenses || ['correctness', 'security', 'perf'])
  .then(v => console.log(JSON.stringify(v, null, 2)));
```

**Key fixes applied:**
- `debate-moderator.md` has `tools: [Read]` (not `tools: []`) — agent reads transcript from file
- `run-debate.mjs` passes file paths to agents, not inline content (AP-2 compliant)
- Debate results written to `.svc/debates/<id>/` (file-based data passing per agent-patterns.md)
- Moderator reads transcript path, not inline blob

### Cross-Host Fallback

**Hosts with subagents (Claude, Kimi, OpenCode, MiMo Code):** Full debate with N lens agents + moderator. Use `dispatch-worker.sh` or native agent tool.

**Hosts without subagents (Codex, Gemini, Antigravity, Cursor):** Fall back to sequential single-reviewer via existing `review-gate` 5-step protocol. The debate script detects the host and chooses:

```javascript
// In run-debate.mjs — host detection
const host = execSync('bash scripts/detect-host.sh', { encoding: 'utf8' }).trim();
const hasSubagents = ['claude', 'kimi', 'opencode', 'mimo-code'].includes(host);

if (!hasSubagents) {
  // Sequential fallback: run each lens as a separate review-gate pass
  console.log(`Host ${host} lacks subagents. Using sequential review-gate fallback.`);
  for (const lens of lenses) {
    // Note: write-auto-grade.mjs must be created by B1 in Fable 5 adaptation plan first
    execSync(`node scripts/write-auto-grade.mjs --skill review-gate --task_id debate-${lens} --grade pending --verifier sequential`);
  }
  return { verdict: 'SEQUENTIAL_FALLBACK', lenses };
}
```

---

## TECHNIQUE 2: Experience Replay (Trajectory Learning from Existing Logs)

### What it is
Extract decision patterns from existing execution logs rather than requiring new instrumentation. The key insight: svc already captures dispatch logs, auto-grades, and pipeline decisions. We can mine these for trajectory patterns without adding overhead.

### What svc already has
- `.svc/dispatch-log.jsonl` — captures dispatch events (who ran what, when)
- `.svc/auto-grades.jsonl` — captures pass/fail grades per task (CREATED by B1 in Fable 5 adaptation plan — does not exist yet)
- `.svc/pipeline-decisions.jsonl` — captures routing decisions
- `manage-learnings` captures structured lessons

### What's missing
svc captures **outcomes** (pass/fail) and **dispatch events** (who ran what) but doesn't extract **decision patterns** — "when the agent encountered X, it chose Y, and the outcome was Z."

### How to implement

**New script:** `scripts/mine-trajectory-patterns.mjs`
```javascript
#!/usr/bin/env node
// Mines decision patterns from existing logs — no new instrumentation needed
// Reads: dispatch-log.jsonl, auto-grades.jsonl, pipeline-decisions.jsonl

import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function readJsonl(filepath) {
  if (!fs.existsSync(filepath)) return [];
  return fs.readFileSync(filepath, 'utf8').trim().split('\n')
    .filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function minePatterns() {
  const dispatchLog = readJsonl(path.join(projectDir, '.svc', 'dispatch-log.jsonl'));
  const grades = readJsonl(path.join(projectDir, '.svc', 'auto-grades.jsonl'));
  const decisions = readJsonl(path.join(projectDir, '.svc', 'pipeline-decisions.jsonl'));

  // Pattern 1: Skill pass rates
  const skillPassRates = {};
  for (const g of grades) {
    if (!skillPassRates[g.skill]) skillPassRates[g.skill] = { pass: 0, fail: 0 };
    skillPassRates[g.skill][g.grade === 'pass' ? 'pass' : 'fail']++;
  }

  // Pattern 2: Decision outcomes
  const decisionOutcomes = {};
  for (const d of decisions) {
    const key = `${d.from_skill || 'unknown'}→${d.to_skill || 'unknown'}`;
    if (!decisionOutcomes[key]) decisionOutcomes[key] = { count: 0, outcomes: [] };
    decisionOutcomes[key].count++;
  }

  // Pattern 3: Dead ends (failures followed by retries)
  const deadEnds = [];
  for (let i = 1; i < grades.length; i++) {
    if (grades[i-1].grade === 'fail' && grades[i].grade === 'pass'
        && grades[i-1].skill === grades[i].skill) {
      deadEnds.push({
        skill: grades[i].skill,
        recovery_iterations: grades[i].iterations || 1,
        original_findings: grades[i-1].findings
      });
    }
  }

  return {
    ts: new Date().toISOString(),
    skill_pass_rates: skillPassRates,
    decision_flows: decisionOutcomes,
    dead_end_patterns: deadEnds,
    total_grades: grades.length,
    total_dispatches: dispatchLog.length,
    total_decisions: decisions.length
  };
}

const patterns = minePatterns();
const outPath = path.join(projectDir, '.svc', 'trajectory-patterns.json');
fs.writeFileSync(outPath, JSON.stringify(patterns, null, 2));
console.log(JSON.stringify(patterns, null, 2));
```

**Key fixes applied:**
- No new instrumentation — reads from existing `dispatch-log.jsonl`, `auto-grades.jsonl`, `pipeline-decisions.jsonl`
- No trajectory recording that contradicts "write once" principle
- Derives patterns from logs that already exist

---

## TECHNIQUE 3: Hierarchical Task Decomposition (HTN Planning)

### What it is
Decompose complex goals into a tree of subtasks with explicit preconditions and postconditions. Unlike svc's flat task-graph, HTN planning creates a **hierarchy** where high-level tasks decompose into lower-level tasks.

### What svc already has
- `task-graph.mjs` manages flat task graphs with blockers
- `dispatch-waves` computes conflict-aware parallel waves
- `plan-changeset` creates task graphs from specs

### What's missing
svc's task graphs are **flat** — all tasks at the same level. For complex features, HTN planning automates decomposition.

### How to implement

**New script:** `scripts/htn-decompose.mjs`
```javascript
#!/usr/bin/env node
// Hierarchical Task Network decomposition
// Takes a high-level goal and produces a tree with preconditions/postconditions

import fs from 'node:fs';

function decompose(goal, context) {
  const phases = [
    { id: 'P1', name: 'Research & Understand', preconditions: [], postconditions: ['goal_understood'] },
    { id: 'P2', name: 'Design & Plan', preconditions: ['goal_understood'], postconditions: ['plan_ready'] },
    { id: 'P3', name: 'Implement', preconditions: ['plan_ready'], postconditions: ['code_written'] },
    { id: 'P4', name: 'Verify & Test', preconditions: ['code_written'], postconditions: ['verified'] },
    { id: 'P5', name: 'Ship & Monitor', preconditions: ['verified'], postconditions: ['shipped'] }
  ];

  return {
    goal,
    context,
    phases,
    tree: phases.map(phase => ({
      ...phase,
      subtasks: [] // Filled by LLM decomposition — agent reads goal, fills subtasks
    }))
  };
}

function validateTree(tree) {
  const errors = [];
  for (const phase of tree.tree) {
    for (const pre of phase.preconditions) {
      const satisfied = tree.tree.some(p =>
        p.id < phase.id && p.postconditions.includes(pre)
      );
      if (!satisfied) {
        errors.push(`Phase ${phase.id}: precondition "${pre}" not satisfied by any earlier phase`);
      }
    }
  }
  return errors;
}

const goal = process.argv[2];
const context = process.argv[3] || '{}';
if (!goal) {
  console.error('Usage: htn-decompose.mjs <goal> [context-json]');
  process.exit(1);
}

const tree = decompose(goal, JSON.parse(context));
const errors = validateTree(tree);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  process.exit(1);
}
console.log(JSON.stringify(tree, null, 2));
```

**Note:** The `subtasks` array is filled by LLM decomposition, not by this script. The script provides the structure and validates precondition satisfaction. The LLM (via `plan-changeset`) fills in the subtasks based on the goal.

---

## TECHNIQUE 4: Uncertainty Quantification

### What it is
The agent explicitly tracks **what it doesn't know** and **how confident it is** in each decision. Not just "I think JWT is better" but "I'm 70% confident JWT is better because I haven't tested session-based auth in this specific context."

### What svc already has
- `manage-learnings` has `confidence` field (1-10)
- `concerns/REGISTRY.json` has `severity` per concern
- `review-gate` has severity levels for findings

### What's missing
svc's confidence is **per-learning**, not **per-decision**. During execution, the agent makes many decisions without tracking uncertainty for each one.

### How to implement

**Consolidated into `.svc/agent-decisions.jsonl`** (shared with Technique 8 — see JSONL consolidation section below). Depends on Technique 4 being implemented first (reads from `agent-decisions.jsonl`).

```javascript
// Entry shape in .svc/agent-decisions.jsonl:
{
  "ts": "2026-06-11T10:00:00Z",
  "type": "decision",  // or "meta-learning" — distinguished by type field
  "task_id": "T3",
  "decision_point": "auth library",
  "choice": "jsonwebtoken",
  "confidence": 0.75,
  "reasoning": "Most common JWT lib, well-maintained",
  "alternatives": [{"choice": "jose", "confidence": 0.6, "why_not": "Less common in Node.js"}],
  "risks": ["No built-in refresh token support"],
  "evidence_level": "training_data"
}
```

**Integration:** Wire into `design-tech` and `execute-changeset`:
```markdown
**Decision tracking:** For every significant decision:
```bash
echo '{"type":"decision","task_id":"T3","decision_point":"auth library","choice":"jsonwebtoken","confidence":0.75,"reasoning":"Most common JWT lib","alternatives":[{"choice":"jose","confidence":0.6}],"risks":["No refresh token support"],"evidence_level":"training_data"}' >> .svc/agent-decisions.jsonl
```

**Uncertainty report:**
```bash
node scripts/uncertainty-report.mjs
# Flags decisions with confidence < 0.6 or risks > 2
```
```

---

## TECHNIQUE 5: Population-Based Learning (Parallel Exploration)

### What it is
Run multiple agents in parallel, each exploring a different approach. After all agents finish, compare their results and **transfer the best patterns** from successful agents to future runs.

### What svc already has
- `dispatch-waves` runs parallel WIs with conflict detection
- `explore-solutions` finds 3+ alternative paradigms
- `dispatch-worker.sh` spawns parallel workers

### What's missing
svc runs parallel workers but doesn't **compare their outputs** or **transfer patterns** between them.

### How to implement

**New script:** `scripts/population-compare.mjs`
```javascript
#!/usr/bin/env node
// Compares parallel worker outputs using ACTUAL worker result fields
// Worker contract: wi, status, worker_summary, changed_files, validation_evidence,
//                  clean_worktree, parent_graph_mutation

import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function comparePopulations(populationDir) {
  const results = [];
  const files = fs.readdirSync(populationDir).filter(f => f.endsWith('.result.json'));

  for (const file of files) {
    const result = JSON.parse(fs.readFileSync(path.join(populationDir, file), 'utf8'));
    results.push({ file, ...result });
  }

  // Score using ACTUAL worker contract fields (not invented ones)
  const scored = results.map(r => ({
    ...r,
    score: scoreFromContractFields(r)
  })).sort((a, b) => b.score - a.score);

  // Extract patterns from worker summaries (actual field, not invented "approach")
  const winners = scored.slice(0, Math.ceil(scored.length / 2));
  const patterns = winners.map(w => ({
    wi: w.wi,
    summary: w.worker_summary,        // actual field
    changed_files: w.changed_files,    // actual field
    validation: w.validation_evidence, // actual field
    success_factors: inferFromSummary(w.worker_summary)
  }));

  // Write patterns to shared memory
  const patternsPath = path.join(projectDir, '.svc', 'population-patterns.jsonl');
  fs.mkdirSync(path.dirname(patternsPath), { recursive: true });
  for (const pattern of patterns) {
    fs.appendFileSync(patternsPath, JSON.stringify({
      ts: new Date().toISOString(),
      source_population: populationDir,
      ...pattern
    }) + '\n');
  }

  return { winner: scored[0]?.file, patterns: patterns.length, total: scored.length };
}

function scoreFromContractFields(result) {
  let score = 0;
  if (result.status === 'success') score += 40;
  if (result.clean_worktree) score += 20;
  if (result.validation_evidence) score += 20;
  if (result.changed_files?.length < 10) score += 10; // Focused
  if (!result.conflict_handling) score += 10; // No conflicts
  return score;
}

function inferFromSummary(summary) {
  // Simple keyword extraction from worker_summary
  if (!summary) return [];
  const factors = [];
  if (summary.includes('test')) factors.push('test-driven');
  if (summary.includes('minimal')) factors.push('minimal-changes');
  if (summary.includes('spec')) factors.push('spec-adherent');
  return factors;
}

const populationDir = process.argv[2];
if (!populationDir) {
  console.error('Usage: population-compare.mjs <population-dir>');
  process.exit(1);
}
console.log(JSON.stringify(comparePopulations(populationDir), null, 2));
```

**Key fix:** Uses actual worker contract fields (`worker_summary`, `changed_files`, `validation_evidence`, `clean_worktree`) instead of invented fields.

### Cross-Host Fallback

**Hosts with parallel subagents (Claude, Kimi, OpenCode, MiMo Code):** Full parallel execution via `dispatch-waves`. Workers run concurrently, results compared by `population-compare.mjs`.

**Hosts without parallel subagents (Codex, Gemini, Antigravity, Cursor):** Sequential execution fallback. The script detects the host and runs workers one at a time, collecting results for later comparison:

```javascript
// In population-compare.mjs — host detection for dispatch
const host = execSync('bash scripts/detect-host.sh', { encoding: 'utf8' }).trim();
const hasParallel = ['claude', 'kimi', 'opencode', 'mimo-code'].includes(host);

if (!hasParallel) {
  // Sequential fallback: dispatch workers one at a time via dispatch-worker.sh
  console.log(`Host ${host} lacks parallel subagents. Using sequential dispatch.`);
  for (const wi of workItems) {
    execSync(`bash scripts/dispatch-worker.sh --wi ${wi} --harness ${host === 'codex' ? 'codex' : 'claude'}`);
  }
  // Still compare results after all sequential runs complete
  return comparePopulations(populationDir);
}
```

---

## TECHNIQUE 6: Causal Reasoning (Enhance diagnose-bug)

### What it is
When something goes wrong, trace the **causal chain** back to root causes and understand **why** the failure happened, not just **what** failed.

### What svc already has
`diagnose-bug` already does this as its core function:
- P3-RootCause phase (5 Whys style)
- Cross-System Falsification Mode (hypothesis → confirmation_check → falsification_check → verdict)
- System contract map validation

### What's missing
The causal chain output isn't structured in a reusable format. diagnose-bug produces a diagnosis but doesn't emit a `## Causal Chain Summary` that maps to the 4-level structure (symptom → proximate → root → systemic → prevention).

### How to implement

**Enhance `diagnose-bug/SKILL.md`** — add a `## Causal Chain Summary` output section after P5-PillarRevisit:

```markdown
## Causal Chain Summary

After completing all 5 phases, emit a structured causal chain:

```yaml
symptom: "<what failed>"
proximate_cause: "<direct cause — what broke>"
root_cause: "<why the proximate cause existed>"
systemic_cause: "<why the system allowed the root cause>"
prevention: "<structural change that prevents this class of failure>"
```

Write this to `.svc/causal-chains.jsonl`:
```bash
echo '{"ts":"...","symptom":"...","proximate":"...","root":"...","systemic":"...","prevention":"..."}' >> .svc/causal-chains.jsonl
```

This chain is available for:
- `manage-learnings` — auto-capture the prevention level as a learning
- `evolve-framework` — detect systemic causes that affect multiple skills
- Future `diagnose-bug` runs — check if a new bug matches a known systemic cause
```

**Key fix:** Enhances existing `diagnose-bug` instead of creating a redundant standalone script.

---

## TECHNIQUE 7: Self-Play for Edge Case Discovery (Concern-Mapped)

### What it is
The agent generates **adversarial inputs** to its own code — edge cases the spec didn't anticipate.

### What svc already has
- `test-journeys` validates user flows
- `write-e2e` creates end-to-end tests
- `concerns/` system detects cross-cutting concerns with domain-specific signals

### What's missing
svc tests against **expected behavior**. Self-play tests against **unexpected behavior**.

### How to implement

**New script:** `scripts/self-play.mjs`
```javascript
#!/usr/bin/env node
// Generates domain-specific edge cases by mapping concerns to adversarial templates
// Instead of generic templates, uses concerns/REGISTRY.json to generate relevant cases

import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

// Edge case templates mapped to concern domains
const DOMAIN_EDGE_CASES = {
  'auth': [
    { template: 'Token expired mid-request', category: 'race-condition' },
    { template: 'User session invalidated by another tab', category: 'state' },
    { template: 'RBAC check passes but resource was deleted between check and access', category: 'race-condition' },
    { template: 'Password reset link reused after first use', category: 'replay' }
  ],
  'billing': [
    { template: 'Payment succeeds but webhook arrives after timeout', category: 'race-condition' },
    { template: 'Subscription cancelled during active trial', category: 'state' },
    { template: 'Refund requested for already-refunded charge', category: 'idempotency' },
    { template: 'Currency conversion rounding causes off-by-one', category: 'boundary' }
  ],
  'data': [
    { template: 'Concurrent writes to same record', category: 'concurrency' },
    { template: 'Migration runs while traffic is live', category: 'state' },
    { template: 'Null value in required field', category: 'boundary' },
    { template: 'Foreign key references deleted parent', category: 'integrity' }
  ],
  'api': [
    { template: 'Request body exceeds size limit', category: 'boundary' },
    { template: 'Rate limit hit mid-batch operation', category: 'boundary' },
    { template: 'External API returns partial success', category: 'partial-failure' },
    { template: 'Response schema changed without version bump', category: 'compatibility' }
  ],
  'ui': [
    { template: 'Form submitted while previous submission is processing', category: 'race-condition' },
    { template: 'Modal opened while another modal is active', category: 'state' },
    { template: 'Network drops during optimistic update', category: 'failure' },
    { template: 'Screen reader encounters dynamically added content', category: 'accessibility' }
  ]
};

function generateEdgeCases(featurePath, concernDomains) {
  const edgeCases = [];

  for (const domain of concernDomains) {
    const templates = DOMAIN_EDGE_CASES[domain] || [];
    for (const t of templates) {
      edgeCases.push({
        domain,
        ...t,
        applicable: true,  // LLM determines applicability when generating tests
        test_case: null,   // LLM fills in specific test
        priority: null     // 'must_test' | 'should_test' | 'nice_to_have'
      });
    }
  }

  return {
    ts: new Date().toISOString(),
    feature: featurePath,
    concern_domains: concernDomains,
    total_edge_cases: edgeCases.length,
    edge_cases: edgeCases
  };
}

// CLI
const featurePath = process.argv[2];
const domains = (process.argv[3] || '').split(',').filter(Boolean);
if (!featurePath) {
  console.error('Usage: self-play.mjs <feature-path> <domain1,domain2,...>');
  process.exit(1);
}

console.log(JSON.stringify(generateEdgeCases(featurePath, domains), null, 2));
```

**Key fix:** Edge cases are domain-specific (mapped from concerns), not generic. Usage: `node scripts/self-play.mjs src/auth/ auth,billing`.

---

## TECHNIQUE 8: Meta-Learning (Process-Level Learnings with Feedback)

### What it is
Instead of just learning facts ("Prisma needs --force flag"), the agent learns **how to learn more effectively** — which research strategies work, which verification approaches catch the most bugs.

### What svc already has
- `manage-learnings` captures object-level learnings
- `evolve-framework` improves the framework itself

### What's missing
svc's learnings are **object-level** ("X is true about Y"). Meta-learnings are **process-level** ("When I encounter X type of problem, strategy Y works better than strategy Z"). The agent doesn't track which of its own processes are effective.

### How to implement

**Consolidated into `.svc/agent-decisions.jsonl`** (shared with Technique 4).

```javascript
// Entry shape — distinguished by type field:
{
  "ts": "2026-06-11T10:00:00Z",
  "type": "meta-learning",  // vs "decision" for Technique 4
  "category": "verification_approach",
  "observation": "Review-gate Step 3 catches 3x more issues than Step 1",
  "evidence": "grades: self-review finds 1.2 issues avg, cross-review finds 3.8 issues avg",
  "confidence": 0.85,
  "applies_to": ["review-gate", "review-exec"]
}
```

**Feedback mechanism — `compact-meta-to-skill`:**
```javascript
// New command in scripts/compact-meta-to-skill.mjs
const META_SKILL_MAP = {
  'research_strategy': 'research/SKILL.md',
  'verification_approach': 'review-gate/SKILL.md',
  'decomposition_pattern': 'plan-changeset/SKILL.md',
  'model_routing': 'rules/common/model-selection.md',
  'context_management': 'references/context-budget.md',
  'error_recovery': 'diagnose-bug/SKILL.md',
  'review_effectiveness': 'review-gate/SKILL.md',
  'tool_usage': 'references/agent-patterns.md'
};

function compactMetaToSkill(category, observation, confidence) {
  if (confidence < 0.7) {
    console.error(`Confidence ${confidence} < 0.7 — skipping compaction`);
    return false;
  }

  const targetFile = META_SKILL_MAP[category];
  if (!targetFile) {
    console.error(`No target skill for category: ${category}`);
    return false;
  }

  const skillPath = path.join(projectDir, targetFile);
  if (!fs.existsSync(skillPath)) {
    console.error(`Target skill not found: ${skillPath}`);
    return false;
  }

  const content = fs.readFileSync(skillPath, 'utf8');
  const marker = '## Process Learnings';
  const entry = `- [${category}] ${observation}\n`;

  if (content.includes(marker)) {
    // Append after existing Process Learnings section
    const idx = content.indexOf(marker);
    const nextSection = content.indexOf('\n## ', idx + marker.length);
    const insertAt = nextSection >= 0 ? nextSection : content.length;
    const updated = content.slice(0, insertAt) + entry + content.slice(insertAt);
    fs.writeFileSync(skillPath, updated);
  } else {
    // Create the section before Pipeline Continuation
    const pipeIdx = content.indexOf('## Pipeline Continuation');
    const insertAt = pipeIdx >= 0 ? pipeIdx : content.length;
    const updated = content.slice(0, insertAt) + marker + '\n\n' + entry + '\n' + content.slice(insertAt);
    fs.writeFileSync(skillPath, updated);
  }

  // Update meta-learning entry as compacted
  // (append "compacted_to" field to the entry in agent-decisions.jsonl)
  return true;
}
```

**Key fix:** Meta-learnings have a concrete feedback path to skills via `compact-meta-to-skill`, not just a report command.

---

## TECHNIQUE 9: Retrieval-Augmented Reasoning (RAR)

### What it is
During reasoning, the agent **actively retrieves** relevant information mid-reasoning, not just at session start or on-demand.

### What svc already has
- `recall-stack-knowledge` loads stack-specific context at session start
- `research` skill for on-demand research
- `research-before-build` rule (always research before implementing)

### What's missing
RAR adds **mid-reasoning retrieval** — pause reasoning, fetch, incorporate, continue. Already partially practiced via `research-before-build`.

### How to implement
This is a **reasoning pattern** formalized in skills, not a standalone script. Add to `design-tech` and `execute-changeset`:

```markdown
## Retrieval-Augmented Reasoning

During implementation, when you encounter uncertainty:
1. **Pause** the current reasoning chain
2. **Retrieve** specific information (grep, read file, check API docs)
3. **Incorporate** the retrieved information into your reasoning
4. **Continue** from where you left off

**Rules:**
- Never guess when you can retrieve. Retrieval cost < rework cost.
- Retrieve the minimum necessary. Grep before read.
- Log what you retrieved and why in the decision track (agent-decisions.jsonl).
```

No new files needed. Formalizes an existing practice.

---

## TECHNIQUE 10: Adaptive Temperature (Pre-Flight Assessment)

### What it is
Adjust exploration/exploitation balance based on context. High temperature for novel tasks, low for proven patterns.

### What svc already has
- `explore-solutions` encourages exploring alternatives
- `review-gate` enforces proven patterns
- `anti-patterns` prevents known-bad approaches

### What's missing
svc doesn't explicitly control **when to explore vs exploit**.

### How to implement

**New script:** `scripts/assess-temperature.mjs`
```javascript
#!/usr/bin/env node
// Pre-flight temperature assessment — reads existing data, outputs recommendation
// Does NOT modify route-workflow. The orchestrator decides whether to act on it.

import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function readJsonl(filepath) {
  if (!fs.existsSync(filepath)) return [];
  return fs.readFileSync(filepath, 'utf8').trim().split('\n')
    .filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function assessTemperature(skillName) {
  // Read existing data sources
  const grades = readJsonl(path.join(projectDir, '.svc', 'auto-grades.jsonl'));
  const decisions = readJsonl(path.join(projectDir, '.svc', 'agent-decisions.jsonl'));

  // Check skill pass rate
  const skillGrades = grades.filter(g => g.skill === skillName);
  const passRate = skillGrades.length > 0
    ? skillGrades.filter(g => g.grade === 'pass').length / skillGrades.length
    : null;

  // Check recent failures
  const recentFails = skillGrades.slice(-10).filter(g => g.grade === 'fail').length;

  // Decision confidence for this skill
  const skillDecisions = decisions.filter(d =>
    d.type === 'decision' && d.applies_to?.includes(skillName)
  );
  const avgConfidence = skillDecisions.length > 0
    ? skillDecisions.reduce((s, d) => s + (d.confidence || 0.5), 0) / skillDecisions.length
    : null;

  // Determine temperature
  let temperature = 'low'; // default: exploit
  let reasons = [];

  if (passRate !== null && passRate < 0.7) {
    temperature = 'high';
    reasons.push(`pass rate ${passRate.toFixed(0)}% < 70%`);
  }
  if (recentFails >= 3) {
    temperature = 'high';
    reasons.push(`${recentFails} recent failures`);
  }
  if (avgConfidence !== null && avgConfidence < 0.5) {
    temperature = 'high';
    reasons.push(`avg confidence ${avgConfidence.toFixed(2)} < 0.5`);
  }
  if (passRate !== null && passRate > 0.9 && recentFails === 0) {
    temperature = 'low';
    reasons.push(`pass rate ${passRate.toFixed(0)}% > 90%, no recent failures`);
  }

  return {
    skill: skillName,
    temperature,
    reasons,
    metrics: { passRate, recentFails, avgConfidence },
    recommendation: temperature === 'high'
      ? 'Consider prepending explore-solutions or research to the skill chain'
      : 'Standard skill chain is appropriate'
  };
}

const skillName = process.argv[2];
if (!skillName) {
  console.error('Usage: assess-temperature.mjs <skill-name>');
  process.exit(1);
}
console.log(JSON.stringify(assessTemperature(skillName), null, 2));
```

**Key fix:** Pre-flight check script that reads existing data. Does NOT modify `route-workflow`. The orchestrator (human or agent) decides whether to act on the recommendation.

---

## JSONL Consolidation Plan

The plan originally proposed 11 JSONL/data files. Consolidated to 5:

| File | Contents | Gitignore? | Purpose |
|---|---|---|---|
| `.svc/agent-decisions.jsonl` | Technique 4 (decisions) + Technique 8 (meta-learnings) | YES (ephemeral per-session) | All agent reasoning records |
| `.svc/auto-grades.jsonl` | Technique from B1 (already planned) | YES (ephemeral) | Pass/fail grades per task |
| `.svc/causal-chains.jsonl` | Technique 6 (from diagnose-bug enhancement) | YES (ephemeral per-session) | Causal chain records |
| `.svc/population-patterns.jsonl` | Technique 5 (cross-worker patterns) | NO (durable, committed) | Winning patterns from parallel runs |
| `.svc/trajectory-patterns.json` | Technique 2 (mined from logs) | NO (durable, committed) | Decision patterns from existing logs |

**Removed:**
- `.svc/decisions.jsonl` → merged into `.svc/agent-decisions.jsonl`
- `.svc/meta-learnings.jsonl` → merged into `.svc/agent-decisions.jsonl`
- `.svc/trajectory-index.jsonl` → replaced by `.svc/trajectory-patterns.jsonl` (mined, not recorded)
- `.svc/consult-counts.json` → kept as `.svc/consult-counts.json` (gitignored, counter not log)

---

## `.svc/` Gitignore Additions

Add to `.gitignore` under the `# === BEGIN SERIOUS VIBE CODING IGNORES ===` section:

```gitignore
# Agent reasoning state (ephemeral per-session)
.svc/agent-decisions.jsonl
.svc/auto-grades.jsonl
.svc/causal-chains.jsonl
.svc/consult-counts.json
.svc/debates/

# Session resume (written by Stop hook)
.svc/session-resume.md
```

**Not gitignored (committed):**
- `.svc/population-patterns.jsonl` — durable cross-session patterns
- `.svc/trajectory-patterns.jsonl` — mined patterns from existing logs
- `.svc/compounding-metric.json` — weekly scorecard

---

## Summary: Technique → svc Gap → Implementation (Updated)

| # | Technique | What svc has | What's missing | Implementation | Host compat |
|---|---|---|---|---|---|
| 1 | Multi-Agent Debate | Pairwise adversarial review | N-agent debate with moderator | `debate-moderator.md` + `run-debate.mjs` | Claude/Kimi/OpenCode/MiMo Code full; others sequential fallback |
| 2 | Experience Replay | Structured learnings + dispatch logs | Decision pattern mining | `mine-trajectory-patterns.mjs` → `.svc/trajectory-patterns.json` | ✅ All hosts |
| 3 | HTN Planning | Flat task graphs | Hierarchical decomposition | `htn-decompose.mjs` (structure + validation) | ✅ All hosts |
| 4 | Uncertainty Quantification | Per-learning confidence | Per-decision tracking | `agent-decisions.jsonl` (consolidated) | ✅ All hosts |
| 5 | Population-Based Learning | Parallel workers | Cross-worker pattern transfer | `population-compare.mjs` (actual contract fields) | Claude/Kimi/OpenCode/MiMo Code full; others sequential fallback |
| 6 | Causal Reasoning | diagnose-bug P3-RootCause | Structured causal chain output | Enhance `diagnose-bug` (not new script) | ✅ All hosts |
| 7 | Self-Play | Expected-behavior testing | Domain-specific edge cases | `self-play.mjs` (concern-mapped templates) | ✅ All hosts |
| 8 | Meta-Learning | Object-level learnings | Process-level meta-learnings | `agent-decisions.jsonl` + `compact-meta-to-skill` | ✅ All hosts |
| 9 | RAR | Pre-loaded + on-demand retrieval | Mid-reasoning retrieval pattern | Formalize in skill docs | ✅ All hosts |
| 10 | Adaptive Temperature | Manual explore/exploit | Pre-flight temperature assessment | `assess-temperature.mjs` (reads existing data) | ✅ All hosts |

---

## Priority by Impact on Agent Augmentation

| Priority | Technique | Why | Host notes |
|---|---|---|---|
| **1** | Uncertainty Quantification (#4) | Foundation — without tracking what the agent doesn't know, all other techniques operate blindly | All hosts |
| **2** | Causal Reasoning (#6) | Prevents recurring failure classes, not just specific bugs | All hosts |
| **3** | Experience Replay (#2) | Enables trajectory-level learning from existing logs | All hosts |
| **4** | Multi-Agent Debate (#1) | Catches more issues than pairwise review | Sequential fallback on Codex/Gemini/Antigravity/Cursor |
| **5** | Self-Play (#7) | Discovers edge cases the spec didn't anticipate | All hosts |
| **6** | Meta-Learning (#8) | Makes the agent's own processes more effective | All hosts |
| **7** | Population-Based Learning (#5) | Transfers winning patterns between parallel explorations | Sequential fallback on Codex/Gemini/Antigravity/Cursor |
| **8** | Adaptive Temperature (#10) | Optimizes exploration/exploitation balance | All hosts |
| **9** | HTN Planning (#3) | Better decomposition for complex features | All hosts |
| **10** | RAR (#9) | Already partially practiced; formalize as reasoning pattern | All hosts |

---

## Re-Review Checklist

After applying all fixes, verify:

| Check | Status |
|---|---|
| AP-2 compliant (no inline file content > 500 tokens) | ✅ All agents receive file paths |
| Agent tools allowlist respected | ✅ Debate moderator has `tools: [Read]` |
| Agent harness field valid | ✅ `harness: claude` (not `closed-input-closed-tool`) |
| No contradiction with "no per-task review" | ✅ Task-verifier removed from execute-changeset |
| Worker result contract fields used correctly | ✅ population-compare uses actual fields |
| No duplication of diagnose-bug | ✅ Causal chain is an enhancement, not a new script |
| JSONL files consolidated | ✅ 5 files (down from 11) |
| File format consistency | ✅ trajectory-patterns.json (JSON, not JSONL) matches script output |
| `.svc/` gitignore covers all new ephemeral files | ✅ All ephemeral files gitignored |
| Context budget respected | ✅ No technique loads >50K inline |
| No modification to route-workflow core logic | ✅ Adaptive temperature is pre-flight only |
| Meta-learnings have feedback path to skills | ✅ compact-meta-to-skill with full implementation |
| Cross-technique dependencies documented | ✅ assess-temperature depends on agent-decisions.jsonl |
| Experience replay doesn't contradict "write once" | ✅ Derives from existing logs |
| Self-play edge cases are domain-specific | ✅ Mapped from concerns registry |
| Cross-host compatibility for all 10 techniques | ✅ 7/10 fully compatible, 2 have sequential fallbacks, 1 (RAR) is reasoning pattern |
| Subagent-dependent techniques have fallbacks | ✅ Debate + Population have sequential fallback for no-subagent hosts |

---

## Prerequisites & Build Order (on paper only — nothing executed)

> The Re-Review Checklist above grades *design* compliance. This section grades *implementation readiness* — because several techniques read data sources that **do not exist yet**, so a naive build would silently no-op. Resolve prerequisites first.

### Hard prerequisites (block multiple techniques)

| # | Prerequisite | Blocks | Why | Cleared when |
|---|--------------|--------|-----|--------------|
| PR1 | A writer for `.svc/auto-grades.jsonl` | T2, T4, T10 | These read it; it does **not exist** today. Mining/temperature run on empty data until something writes grades | a grade-emitting hook/skill writes real rows |
| PR2 | Create `scripts/write-auto-grade.mjs` | T1 fallback | Referenced by the no-subagent debate fallback; **missing** | script exists + unit-smoke |
| PR3 | Point pricing/model facts at `references/model-registry.json` | all model-fact claims | CLAUDE.md mandates single-source; the inline pricing table is a second source (and at least Haiku output conflicts) | doc references registry; no hardcoded prices |
| PR4 | Live-verify the cross-host capability matrix | T1, T5 fallbacks | Per the `host-capability-training-data-staleness` learning (conf 10), hook counts / subagent / vision per host are unverified training-data | each host's row cited to current host docs |

### Per-technique readiness

| # | Technique | Net-new artifacts | Readiness | Build note |
|---|-----------|-------------------|-----------|------------|
| 1 | Multi-Agent Debate | `agents/debate-moderator.md`, `scripts/run-debate.mjs` | **Blocked** by PR2; reuse `dispatch-worker.sh` transport (don't bypass profile routing); verify `model: haiku-4.5` frontmatter id | CHAIN |
| 2 | Experience Replay | `scripts/mine-trajectory-patterns.mjs` | **Blocked** by PR1 (auto-grades) | CHAIN |
| 3 | HTN Planning | `scripts/htn-decompose.mjs` | Ready (scaffold; LLM fills subtasks) | CHAIN |
| 4 | Uncertainty Quant. | `.svc/agent-decisions.jsonl` writer + skill wiring | Ready once writer added | CHAIN |
| 5 | Population-Based | `scripts/population-compare.mjs` | Ready (uses real worker-contract fields) | CHAIN |
| 6 | Causal Reasoning | enhance `diagnose-bug` only | **Most ready** — no new script | DIRECT (skill prose) |
| 7 | Self-Play | `scripts/self-play.mjs` | Ready (concern-mapped templates) | CHAIN |
| 8 | Meta-Learning | `scripts/compact-meta-to-skill.mjs` | Ready once T4 writer exists | CHAIN |
| 9 | RAR | skill prose only | **Most ready** — formalizes existing practice | DIRECT |
| 10 | Adaptive Temp. | `scripts/assess-temperature.mjs` | **Blocked** by PR1 | CHAIN |

### Recommended build order

1. **Prereqs:** PR3, PR4 (paper/doc), then PR1 + PR2 (the data-source + missing script).
2. **Zero-new-file wins:** T6 (causal-chain in diagnose-bug), T9 (RAR prose) — DIRECT commits, immediate value.
3. **Self-contained scripts:** T3, T5, T7, then T4 (writer) → T8, T10, T2 (all depend on the data layer from step 1).
4. **Subagent-dependent last:** T1 (after PR2 + transport decision).

> Same hard rule as the cleanup plan: each CHAIN item is **one WI per pipeline run**; the "wire into skill X" notes are separate feature WIs, not assumed done.
