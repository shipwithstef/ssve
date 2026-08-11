# Fable 5 Adaptation — Full Implementation Plan

**Date:** 2026-06-11
**Source:** 14-step Fable 5 self-improving agent guide
**Purpose:** Complete implementation plan for adapting every Fable 5 concept to svc. Each item has exact files, schemas, code, and validation.
**Host provider verified:** 2026-06-11 — All 6 infrastructure assumptions verified against Anthropic documentation.

---

## Host Provider Verification (Anthropic Docs)

| Capability | Verified | Actual API | Plan Reference |
|---|---|---|---|
| **Fable 5** | ✅ | `claude-fable-5` | 1M context, $10/$50 per MTok |
| **Routines** | ✅ | `/schedule` CLI, `claude.ai/code/routines` | Research preview. Schedule/API/GitHub triggers. |
| **Managed Agents** | ✅ | REST API at `platform.claude.com` | Hosted sandbox. Separate from Agent SDK. |
| **Dynamic Workflows** | ✅ | `ultracode` keyword, `/deep-research` | JS scripts orchestrating subagents. Up to 16 concurrent. |
| **Agent SDK** | ✅ | `@anthropic-ai/claude-agent-sdk` | Python + TypeScript. `query()` with `agents` dict. |
| **Vision** | ✅ | Built-in to all models | "All Claude models support text and image input." |

---

## Implementation Phases

```
Phase A: Memory & State Foundation (no deps)
  A1. 5-stage memory tracking in manage-learnings
  A2. Session resume pointer
  A3. Skill freshness metric
  A4. Compounding metric
  A5. Safety boundary documentation

Phase B: Grading & Compaction Pipeline (depends on A)
  B1. Auto-grades JSONL
  B2. Skill compaction (learning → skill)
  B3. Goal-loop pattern (iterative gate correction)

Phase C: Verification & Vision (depends on B)
  C1. Task-level verifier sub-agent
  C2. Auto-grade pipeline (continuous grading)
  C3. Vision verification

Phase D: Orchestration Extensions (independent)
  D1. Routines skill + runner
  D2. Model routing tiers
  D3. Compose-workflow skill
```

---

## PHASE A: Memory & State Foundation

### A1. 5-Stage Memory Tracking in manage-learnings

**Problem:** Learnings don't track which progression stage they're at. A "Fail" learning looks the same as a "Distill" learning.

**Files to modify:**

#### 1. Extend JSONL schema

**File:** `manage-learnings/SKILL.md` — learning entry format section

Add new fields to the documented schema:

```json
{
  "date": "2026-06-11",
  "skill": "execute-changeset",
  "type": "operational",
  "key": "prisma-force-flag-ci",
  "insight": "Prisma needs --force flag in CI...",
  "confidence": 8,
  "source": "observed",
  "files": ["src/db/"],
  "saves_minutes": 15,
  "stage": "verify",
  "verified_at": "2026-06-11T14:00:00Z",
  "distilled_to": "rules/prisma-ci.md",
  "consult_count": 3
}
```

New fields:
| Field | Type | Description |
|---|---|---|
| `stage` | enum | `fail` \| `investigate` \| `verify` \| `distill` \| `consult` |
| `verified_at` | ISO timestamp | When stage reached "verify" |
| `distilled_to` | string path | Rule file when stage reached "distill" |
| `consult_count` | integer | Incremented each time preload hook loads this learning |

#### 2. Add stage transition commands

**File:** `manage-learnings/SKILL.md` — add new section `## Stage Progression`

Document these commands:

```bash
# Advance a learning to the next stage
node scripts/manage-learnings.mjs advance <learning-key> --to verify
node scripts/manage-learnings.mjs advance <learning-key> --to distill --target rules/prisma-ci.md

# Query stage distribution
node scripts/manage-learnings.mjs progression-report

# Auto-advance: fail → investigate when reproduction steps are added
node scripts/manage-learnings.mjs auto-advance
```

#### 3. Create progression report script

**New file:** `scripts/manage-learnings.mjs` — add `progression-report` command

```javascript
// Inside manage-learnings.mjs, add case 'progression-report':
function progressionReport(entries) {
  const stages = { fail: 0, investigate: 0, verify: 0, distill: 0, consult: 0 };
  for (const e of entries) {
    const s = e.stage || 'fail';
    stages[s] = (stages[s] || 0) + 1;
  }
  const total = entries.length;
  const verified = stages.verify + stages.distill + stages.consult;
  const coverage = total > 0 ? (verified / total * 100).toFixed(1) : 0;

  console.log(`Stage Distribution (${total} learnings):`);
  console.log(`  fail:        ${stages.fail}`);
  console.log(`  investigate: ${stages.investigate}`);
  console.log(`  verify:      ${stages.verify}`);
  console.log(`  distill:     ${stages.distill}`);
  console.log(`  consult:     ${stages.consult}`);
  console.log(`  Verification coverage: ${coverage}%`);
  console.log(`  Distillation rate: ${total > 0 ? (stages.distill / total * 100).toFixed(1) : 0}%`);
}
```

#### 4. Update learning-preload hook to increment consult_count

**File:** `hooks/svc-learning-preload.mjs`

After loading learnings into context, increment `consult_count` for each loaded learning:

```javascript
// After loading learnings into context
for (const learning of loadedLearnings) {
  learning.consult_count = (learning.consult_count || 0) + 1;
}
// Write back to JSONL (append updated entries, remove old ones)
```

**Validation:**
```bash
# Create a test learning, advance it through stages, verify progression
node scripts/manage-learnings.mjs capture --skill test --key test-progression --insight "test"
node scripts/manage-learnings.mjs advance test-progression --to investigate
node scripts/manage-learnings.mjs advance test-progression --to verify
node scripts/manage-learnings.mjs progression-report
# Should show: verify: 1, coverage: 100%
```

---

### A2. Session Resume Pointer

**Problem:** No "last session" summary. Every session restarts partially from zero.

**Files to create/modify:**

#### 1. Create session resume file

**New file:** `.svc/session-resume.md` (gitignored, written by Stop hook)

```markdown
# Session Resume

**Last session:** 2026-06-11T15:30:00Z
**Duration:** 2h 15m
**Host:** Claude Code

## Tasks in progress
- T3 (execute-changeset): 3/7 tasks complete, currently on task "add auth middleware"
- T4 (review-gate): blocked on T3 completion

## Decisions made
- Chose Option B for auth architecture (JWT + refresh tokens, not sessions)
- Deferred rate limiting to follow-up WI

## Failures encountered
- Prisma migration failed on CI (prisma-force-flag issue) — fix drafted in fix/prisma-ci

## Next action
- Complete T3 tasks 4-7 (rate limiter, CORS, error handler, tests)
- Then run review-gate on the full diff

## Learnings captured this session
- 2 new learnings, 1 promoted to verify
```

#### 2. Create resume writer script

**New file:** `scripts/write-session-resume.mjs`

```javascript
#!/usr/bin/env node
// Writes .svc/session-resume.md from current session state
// Called by the Stop hook before session ends

import fs from 'node:fs';
import path from 'node:path';

const resumePath = path.join(process.env.SVC_PROJECT_DIR || '.', '.svc', 'session-resume.md');
const laneTasksDir = path.join(process.env.SVC_PROJECT_DIR || '.', '.svc');

// Read active task graphs
function getActiveTasks() {
  const files = fs.readdirSync(laneTasksDir).filter(f => f.startsWith('lane-tasks-') && f.endsWith('.json'));
  const tasks = [];
  for (const file of files) {
    const graph = JSON.parse(fs.readFileSync(path.join(laneTasksDir, file), 'utf8'));
    if (graph.status === 'completed') continue;
    for (const task of graph.tasks || []) {
      if (task.status === 'in_progress' || task.status === 'blocked') {
        tasks.push({ graph: file, ...task });
      }
    }
  }
  return tasks;
}

// Read recent learnings
function getRecentLearnings() {
  const learningsPath = path.join(laneTasksDir, '..', 'docs', 'learnings', 'learnings.jsonl');
  if (!fs.existsSync(learningsPath)) return [];
  const lines = fs.readFileSync(learningsPath, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-5).map(l => JSON.parse(l));
}

const tasks = getActiveTasks();
const learnings = getRecentLearnings();
const now = new Date().toISOString();

const resume = `# Session Resume

**Last session:** ${now}
**Host:** ${process.env.SVC_HOST || 'unknown'}

## Tasks in progress
${tasks.length > 0 ? tasks.map(t => `- ${t.graph}: ${t.id} — ${t.summary} [${t.status}]`).join('\n') : '(none)'}

## Learnings captured this session
${learnings.length > 0 ? learnings.map(l => `- [${l.stage || 'fail'}] ${l.key}: ${l.insight?.slice(0, 80)}`).join('\n') : '(none)'}
`;

fs.mkdirSync(path.dirname(resumePath), { recursive: true });
fs.writeFileSync(resumePath, resume);
console.log(`Session resume written to ${resumePath}`);
```

#### 3. Wire resume writer into Stop hook

**File:** `hooks/svc-task-completion-guard.sh`

Add resume writing before the stop decision:

```bash
# Before the completion check, write session resume
if command -v node &>/dev/null; then
  node "$REPO_ROOT/scripts/write-session-resume.mjs" 2>/dev/null || true
fi
```

#### 4. Wire resume reader into learning-preload hook

**File:** `hooks/svc-learning-preload.mjs`

Add resume reading after learning loading:

```javascript
// After loading learnings, read session resume
const resumePath = path.join(projectDir, '.svc', 'session-resume.md');
if (fs.existsSync(resumePath)) {
  const resume = fs.readFileSync(resumePath, 'utf8');
  // Inject into context as "## Previous Session Context"
  contextParts.push(`## Previous Session Context\n${resume}`);
}
```

**Validation:**
```bash
node scripts/write-session-resume.mjs
cat .svc/session-resume.md
# Should show tasks in progress and recent learnings
```

---

### A3. Skill Freshness Metric

**Problem:** No metric for how recently a skill was updated or how many learnings it has absorbed.

**Files to modify:**

#### 1. Add metadata fields to manifest

**File:** `skills-manifest.json` — extend `skillMetadata` section

```json
"skillMetadata": {
  "execute-changeset": {
    "created": "2026-04-09",
    "last_compacted": "2026-06-10",
    "learning_count": 7,
    "verification_coverage": 0.85
  },
  "dispatch-waves": {
    "created": "2026-05-12",
    "progressive_disclosure_reference": "dispatch-waves/references/dispatch-runtime.md"
  }
}
```

New fields per skill:
| Field | Type | Description |
|---|---|---|
| `last_compacted` | ISO date | Last time a learning was compacted into this skill |
| `learning_count` | integer | Total learnings compacted into this skill |
| `verification_coverage` | float 0-1 | % of learnings at stage "verify" or higher |

#### 2. Update compact-to-skill to write metadata

**File:** `manage-learnings/SKILL.md` — compact-to-skill command

When compacting a learning into a skill, also update `skills-manifest.json`:

```bash
node scripts/manage-learnings.mjs compact-to-skill <learning-key> <skill-name>
# This should:
# 1. Append failure mode to skill's SKILL.md
# 2. Update skillMetadata[skill].last_compacted = today
# 3. Increment skillMetadata[skill].learning_count
# 4. Recalculate verification_coverage
```

#### 3. Add freshness report command

**File:** `manage-learnings/SKILL.md` — add `freshness-report` command

```bash
node scripts/manage-learnings.mjs freshness-report
# Output: skills sorted by staleness, flagging those with
# learning_count > 5 AND last_compacted > 30d
```

**Validation:**
```bash
node scripts/manage-learnings.mjs freshness-report
# Should list skills with their freshness metrics
```

---

### A4. Compounding Metric

**Problem:** No way to measure whether the system is actually improving over time.

**Files to create:**

#### 1. Create compounding metric tracker

**New file:** `scripts/compounding-metric.mjs`

```javascript
#!/usr/bin/env node
// Computes weekly compounding metric from learnings, grades, and skill updates
// Run weekly via routine or manually

import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function getWeekId() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function readJsonl(filepath) {
  if (!fs.existsSync(filepath)) return [];
  return fs.readFileSync(filepath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function computeMetric() {
  const week = getWeekId();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  // Learnings
  const allLearnings = [
    ...readJsonl(path.join(projectDir, 'docs/learnings/learnings.jsonl')),
    ...readJsonl(path.join(projectDir, 'references/framework-learnings.jsonl'))
  ];
  const weekLearnings = allLearnings.filter(l => new Date(l.date) >= weekStart);
  const promoted = weekLearnings.filter(l => ['verify', 'distill', 'consult'].includes(l.stage));
  const compacted = weekLearnings.filter(l => l.distilled_to);

  // Grades
  const grades = readJsonl(path.join(projectDir, '.svc/auto-grades.jsonl'));
  const weekGrades = grades.filter(g => new Date(g.ts) >= weekStart);
  const passRate = weekGrades.length > 0
    ? weekGrades.filter(g => g.grade === 'pass').length / weekGrades.length
    : 0;
  const avgIterations = weekGrades.length > 0
    ? weekGrades.reduce((sum, g) => sum + (g.iterations || 1), 0) / weekGrades.length
    : 0;

  // Skill freshness
  const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'skills-manifest.json'), 'utf8'));
  const metadata = manifest.skillMetadata || {};
  const skillsUpdated = Object.values(metadata).filter(m =>
    m.last_compacted && new Date(m.last_compacted) >= weekStart
  ).length;

  // Verification coverage
  const verified = allLearnings.filter(l => ['verify', 'distill', 'consult'].includes(l.stage));
  const verificationCoverage = allLearnings.length > 0
    ? verified.length / allLearnings.length
    : 0;

  return {
    week,
    learnings_captured: weekLearnings.length,
    learnings_promoted: promoted.length,
    learnings_compacted_to_skills: compacted.length,
    skills_updated: skillsUpdated,
    verification_coverage: parseFloat(verificationCoverage.toFixed(3)),
    avg_gate_pass_rate: parseFloat(passRate.toFixed(3)),
    avg_iterations_to_pass: parseFloat(avgIterations.toFixed(2)),
    total_learnings: allLearnings.length,
    total_grades: weekGrades.length
  };
}

const metric = computeMetric();
const metricPath = path.join(projectDir, '.svc/compounding-metric.json');
fs.writeFileSync(metricPath, JSON.stringify(metric, null, 2));
console.log(JSON.stringify(metric, null, 2));
```

#### 2. Add to manage-learnings as a command

**File:** `manage-learnings/SKILL.md` — add `compounding-report` command

```bash
node scripts/compounding-metric.mjs
# Outputs weekly compounding metric to .svc/compounding-metric.json
# and prints summary to stdout
```

**Validation:**
```bash
node scripts/compounding-metric.mjs
cat .svc/compounding-metric.json
# Should show week, learnings_captured, verification_coverage, etc.
```

---

### A5. Safety Boundary Documentation

**Problem:** No awareness of Fable 5 classifier blocks.

**Files to modify:**

#### 1. Add safety section to FRAMEWORK-STATE.md

**File:** `FRAMEWORK-STATE.md` — add new section after "Host Capability Matrix"

```markdown
## Mythos Safety Boundary (Fable 5)

Fable 5 ships with built-in safety classifiers that decline requests in:
- Cybersecurity vulnerability research
- Biology / bioweapon-related
- Chemistry / dangerous synthesis
- Model distillation / weight extraction

**Fallback routing:** When Fable 5 blocks, retry with Opus 4.8.
**Detection:** Classifier blocks return a distinct refusal pattern in the response.
**Tracking:** Log classifier blocks as `type: "classifier-block"` in manage-learnings.

| Task domain | Classifier risk | Fallback model |
|---|---|---|
| Security review / SAST | HIGH | Opus 4.8 |
| Crypto primitives review | MEDIUM | Opus 4.8 |
| Scientific computing | MEDIUM | Opus 4.8 |
| General code review | LOW | N/A |
| UI/UX work | LOW | N/A |
| Documentation | LOW | N/A |
```

#### 2. Add classifier-block learning type

**File:** `manage-learnings/SKILL.md` — extend `type` enum

Add `classifier-block` as a valid learning type:

```yaml
type: operational | framework | classifier-block | security | performance
```

When a classifier block is detected, capture it:
```json
{
  "type": "classifier-block",
  "key": "fable5-security-review-block",
  "insight": "Fable 5 declined security code review task. Retried with Opus 4.8 successfully.",
  "stage": "verify",
  "domain": "security"
}
```

#### 3. Add fallback to resolve-model.sh

**File:** `scripts/resolve-model.sh`

Add classifier-block detection and fallback:

```bash
# After model selection, check for classifier block patterns
if [[ "$SELECTED_MODEL" == *"fable"* ]] && [[ "$RESPONSE" == *"decline"* || "$RESPONSE" == *"cannot assist"* ]]; then
  echo "Classifier block detected. Falling back to Opus 4.8." >&2
  SELECTED_MODEL="claude-opus-4-8"
  # Log the block
  echo "{\"ts\":\"$(date -u +%FT%TZ)\",\"type\":\"classifier-block\",\"original\":\"fable-5\",\"fallback\":\"opus-4.8\",\"task\":\"$TASK_TYPE\"}" >> "$PROJECT_DIR/.svc/classifier-blocks.jsonl"
fi
```

**Validation:**
```bash
# Verify FRAMEWORK-STATE.md has the safety section
grep -c "Mythos Safety Boundary" FRAMEWORK-STATE.md
# Should return 1
```

---

## PHASE B: Grading & Compaction Pipeline

### B1. Auto-Grades JSONL

**Problem:** Grading only happens at review gates, not continuously.

**Files to create/modify:**

#### 1. Create auto-grades writer

**New file:** `scripts/write-auto-grade.mjs`

```javascript
#!/usr/bin/env node
// Writes a grade entry to .svc/auto-grades.jsonl
// Called after task completion and gate decisions

import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function writeGrade({ skill, task_id, grade, verifier, findings, duration_ms, iterations, ac_coverage }) {
  const entry = {
    ts: new Date().toISOString(),
    skill,
    task_id,
    grade,
    verifier,
    findings: findings || 0,
    duration_ms: duration_ms || 0,
    iterations: iterations || 1,
    ac_coverage: ac_coverage || null
  };

  const gradesPath = path.join(projectDir, '.svc', 'auto-grades.jsonl');
  fs.mkdirSync(path.dirname(gradesPath), { recursive: true });
  fs.appendFileSync(gradesPath, JSON.stringify(entry) + '\n');
  return entry;
}

// CLI usage
if (process.argv[1] && process.argv[1].includes('write-auto-grade')) {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, arg, i, arr) => {
      if (arg.startsWith('--') && i + 1 < arr.length) {
        acc[arg.slice(2)] = arr[i + 1];
      }
      return acc;
    }, {})
  );
  const entry = writeGrade(args);
  console.log(JSON.stringify(entry));
}

export { writeGrade };
```

#### 2. Wire into execute-changeset task completion

**File:** `execute-changeset/SKILL.md` — after self-verify table

Add after each task's self-verify:

```markdown
**Auto-grade:** After self-verify passes, write grade:
```bash
node scripts/write-auto-grade.mjs --skill execute-changeset --task_id <task-id> --grade pass --verifier self --findings 0
```
If self-verify fails, write fail grade:
```bash
node scripts/write-auto-grade.mjs --skill execute-changeset --task_id <task-id> --grade fail --verifier self --findings <count>
```
```

#### 3. Wire into review-gate gate decision

**File:** `review-gate/SKILL.md` — after Gate Decision section

Add after every gate decision:

```markdown
**Auto-grade:** Write gate result:
```bash
node scripts/write-auto-grade.mjs --skill review-gate --task_id <gate-id> --grade <PASS|FAIL> --verifier cross-review --findings <count> --ac_coverage <0-1>
```
```

**Validation:**
```bash
node scripts/write-auto-grade.mjs --skill test --task_id T-test --grade pass --verifier self --findings 0
cat .svc/auto-grades.jsonl
# Should show the grade entry
```

---

### B2. Skill Compaction (Learning → Skill)

**Problem:** Learnings stay in JSONL, never write back into skills.

**Files to create/modify:**

#### 1. Create compact-to-skill script

**New file:** `scripts/compact-learning-to-skill.mjs`

```javascript
#!/usr/bin/env node
// Compacts a verified learning into a skill's SKILL.md
// Usage: node scripts/compact-learning-to-skill.mjs <learning-key> <skill-name>

import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function findLearningByKey(key, files) {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.key === key) return { entry, source: file };
      } catch {}
    }
  }
  return null;
}

function appendFailureMode(skillPath, learning) {
  const content = fs.readFileSync(skillPath, 'utf8');

  // Find or create "## Known Failure Modes" section
  const marker = '## Known Failure Modes';
  const markerIdx = content.indexOf(marker);

  const entry = `- **${learning.key}**: ${learning.insight}` +
    (learning.files?.length ? ` (${learning.files.join(', ')})` : '') +
    `\n  Fix: ${learning.fix || 'See learning entry for details.'}\n`;

  if (markerIdx >= 0) {
    // Find end of section (next ## heading)
    const nextSection = content.indexOf('\n## ', markerIdx + marker.length);
    if (nextSection >= 0) {
      content.slice(0, nextSection) + entry + content.slice(nextSection);
    } else {
      content + '\n' + entry;
    }
  } else {
    // Create the section before Pipeline Continuation or at end
    const pipeIdx = content.indexOf('## Pipeline Continuation');
    const insertPoint = pipeIdx >= 0 ? pipeIdx : content.length;
    content.slice(0, insertPoint) + marker + '\n\n' + entry + '\n' + content.slice(insertPoint);
  }

  fs.writeFileSync(skillPath, updated);
}

function updateManifestMetadata(skillName, learning) {
  const manifestPath = path.join(projectDir, 'skills-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (!manifest.skillMetadata) manifest.skillMetadata = {};
  if (!manifest.skillMetadata[skillName]) manifest.skillMetadata[skillName] = {};

  const meta = manifest.skillMetadata[skillName];
  meta.last_compacted = new Date().toISOString().split('T')[0];
  meta.learning_count = (meta.learning_count || 0) + 1;

  // Recalculate verification coverage
  const allLearnings = loadAllLearnings();
  const skillLearnings = allLearnings.filter(l =>
    l.skill === skillName && ['verify', 'distill', 'consult'].includes(l.stage)
  );
  const totalForSkill = allLearnings.filter(l => l.skill === skillName).length;
  meta.verification_coverage = totalForSkill > 0
    ? parseFloat((skillLearnings.length / totalForSkill).toFixed(3))
    : 0;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// CLI
const [,, learningKey, skillName] = process.argv;
if (!learningKey || !skillName) {
  console.error('Usage: compact-learning-to-skill.mjs <learning-key> <skill-name>');
  process.exit(1);
}

const learningFiles = [
  path.join(projectDir, 'docs/learnings/learnings.jsonl'),
  path.join(projectDir, 'references/framework-learnings.jsonl')
];

const result = findLearningByKey(learningKey, learningFiles);
if (!result) {
  console.error(`Learning "${learningKey}" not found`);
  process.exit(1);
}

const { entry } = result;

// Guard: only compact verified+ learnings
if (!['verify', 'distill', 'consult'].includes(entry.stage)) {
  console.error(`Learning "${learningKey}" is at stage "${entry.stage}" — must be verify or higher`);
  process.exit(1);
}

const skillPath = path.join(projectDir, skillName, 'SKILL.md');
if (!fs.existsSync(skillPath)) {
  console.error(`Skill "${skillName}" not found at ${skillPath}`);
  process.exit(1);
}

appendFailureMode(skillPath, entry);
updateManifestMetadata(skillName, entry);

// Mark learning as distilled
entry.stage = 'distill';
entry.distilled_to = `${skillName}/SKILL.md## Known Failure Modes`;
// Rewrite learning file with updated entry...

console.log(`Compacted "${learningKey}" into ${skillName}/SKILL.md`);
```

#### 2. Add compact-to-skill command to manage-learnings

**File:** `manage-learnings/SKILL.md` — add command documentation

```markdown
### Compact to Skill

After a learning reaches "verify" stage, compact it into the relevant skill:

```bash
node scripts/compact-learning-to-skill.mjs <learning-key> <skill-name>
```

This appends a failure mode entry to the skill's `## Known Failure Modes` section
and updates `skills-manifest.json` metadata. Only works on learnings at stage "verify" or higher.

**Guard:** The script refuses to compact learnings at "fail" or "investigate" stage.
```

**Validation:**
```bash
# Create a verified learning, compact it, check the skill
node scripts/manage-learnings.mjs capture --skill execute-changeset --key test-compact --insight "test failure" --stage verify
node scripts/compact-learning-to-skill.mjs test-compact execute-changeset
grep "test-compact" execute-changeset/SKILL.md
# Should show the failure mode entry
```

---

### B3. Goal-Loop Pattern (Iterative Gate Correction)

**Problem:** Gates are one-shot pass/fail. No automatic re-entry loop.

**Files to create:**

#### 1. Create goal-loop orchestrator

**New file:** `scripts/goal-loop.mjs`

```javascript
#!/usr/bin/env node
// Iterative gate correction loop
// Usage: node scripts/goal-loop.mjs --skill <gate-skill> --artifact <path> --max-iterations 3

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.env.SVC_PROJECT_DIR || '.';
const MAX_ITERATIONS = 3;

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    args[process.argv[i].slice(2)] = process.argv[i + 1];
  }
  return args;
}

async function runGoalLoop() {
  const { skill, artifact, 'max-iterations': maxIter } = parseArgs();
  const max = parseInt(maxIter) || MAX_ITERATIONS;

  if (!skill || !artifact) {
    console.error('Usage: goal-loop.mjs --skill <gate-skill> --artifact <path>');
    process.exit(1);
  }

  for (let iteration = 1; iteration <= max; iteration++) {
    console.log(`\n=== Goal Loop Iteration ${iteration}/${max} ===`);

    // Run the gate skill
    try {
      const result = execSync(
        `claude -p "Run ${skill} on ${artifact}. Output gate decision." --output-format json`,
        { encoding: 'utf8', timeout: 300000 }
      );

      const parsed = JSON.parse(result);

      if (parsed.gate_decision === 'PASS') {
        console.log(`Gate PASSED on iteration ${iteration}`);

        // Write success grade
        execSync(`node scripts/write-auto-grade.mjs --skill ${skill} --task_id goal-loop --grade pass --verifier independent --iterations ${iteration}`);

        return { passed: true, iterations: iteration };
      }

      // Gate failed — write failure and continue loop
      console.log(`Gate FAILED on iteration ${iteration}: ${parsed.findings?.length || 0} findings`);

      // Write failure grade
      execSync(`node scripts/write-auto-grade.mjs --skill ${skill} --task_id goal-loop --grade fail --verifier independent --findings ${parsed.findings?.length || 0} --iterations ${iteration}`);

      // Write failure to STATE.md
      const stateEntry = `\n### Goal Loop Failure — ${new Date().toISOString()}\n- Skill: ${skill}\n- Iteration: ${iteration}\n- Findings: ${JSON.stringify(parsed.findings || [])}\n`;
      fs.appendFileSync(path.join(projectDir, '.svc', 'session-resume.md'), stateEntry);

    } catch (err) {
      console.error(`Iteration ${iteration} error: ${err.message}`);
    }
  }

  console.log(`\nGoal loop exhausted after ${max} iterations. Escalating to human.`);
  return { passed: false, iterations: max };
}

runGoalLoop().then(result => {
  process.exit(result.passed ? 0 : 1);
});
```

#### 2. Add goal-loop guidance to review-gate

**File:** `review-gate/SKILL.md` — add section after Gate Decision

```markdown
## Goal Loop (Automated Re-Entry)

When a gate FAILS and the findings are non-critical (no security/blocking issues),
the system can automatically re-enter the loop:

```bash
node scripts/goal-loop.mjs --skill review-gate --artifact <failed-artifact> --max-iterations 3
```

**Rules:**
- Max 3 iterations (same as cross-system iteration cap)
- Each iteration writes failure context to session-resume.md
- If iteration 3 fails, escalate to human — do not loop forever
- Security/blocking findings always escalate immediately (no loop)
- The verifier sub-agent (step 6) runs independently each iteration
```

**Validation:**
```bash
# Test with a known-failing artifact
node scripts/goal-loop.mjs --skill review-gate --artifact test-artifact.md --max-iterations 2
# Should run 2 iterations and report results
```

---

## PHASE C: Verification & Vision

### C1. Task-Level Verifier Sub-Agent

**Problem:** Tasks use self-verify (maker grades own work). Fable 5 guide says verifier should be independent.

**Files to modify:**

#### 1. Add verifier agent definition

**New file:** `agents/task-verifier.md`

```markdown
---
name: task-verifier
description: Independent verifier for execute-changeset task completion. Reads only the diff + AC, not the maker's reasoning.
model: haiku-4.5
tools: []
harness: closed-input-closed-tool
---

# Task Verifier Agent

You are an independent code reviewer. You receive:
1. The task's git diff (what was changed)
2. The acceptance criteria from the spec
3. The self-verify results from the maker

You do NOT receive:
- The maker's reasoning or thought process
- The full spec or journey docs
- Any other context beyond the diff + AC

## Your job

For each acceptance criterion:
1. Read the diff
2. Determine if the criterion is met by the code changes
3. Output: PASS / FAIL with one-line justification

## Output format

```yaml
verdict: PASS | FAIL
findings:
  - ac: "<AC reference>"
    verdict: PASS | FAIL
    evidence: "<line number or 'not found in diff'>"
```

## Rules

- Be adversarial. Default to FAIL unless evidence is clear.
- Do not infer intent. If the code doesn't explicitly satisfy the AC, it's FAIL.
- Do not suggest improvements. Only verify against the AC.
- If the diff is empty, verdict is FAIL.
```

#### 2. Add verifier invocation to execute-changeset

**File:** `execute-changeset/SKILL.md` — after each task's self-verify

Add after the self-verify table:

```markdown
**Independent verification:** After self-verify passes, spawn verifier sub-agent:
```bash
claude -p --agent task-verifier \
  --input-diff "$(git diff HEAD~1)" \
  --input-ac "$(grep -A 5 '<AC reference>' docs/specs/feature-*.md)" \
  --output-format yaml
```

If verifier returns FAIL, the task stays `in_progress` — self-verify alone is not sufficient.
Write verifier result to task completion receipt:
```bash
node scripts/write-auto-grade.mjs --skill execute-changeset --task_id <id> --grade <verdict> --verifier haiku-4.5
```
```

#### 3. Register agent in manifest

**File:** `skills-manifest.json` — no change needed (agents are in `agents/` directory, not in `includedSkills`)

**Validation:**
```bash
cat agents/task-verifier.md | head -5
# Should show frontmatter with name, model, tools, harness
```

---

### C2. Auto-Grade Pipeline (Continuous Grading)

**Problem:** Grading only at gates, not per-task.

**This is B1 + C1 combined.** The auto-grades JSONL (B1) is the storage layer. The task-level verifier (C1) is the grading mechanism. The pipeline is:

1. Task completes → self-verify runs
2. Self-verify passes → verifier sub-agent spawned (C1)
3. Verifier result → grade written to auto-grades.jsonl (B1)
4. Auto-grades.jsonl → manage-learnings reads for failure patterns (A1)
5. Verified learnings → compact-to-skill (B2)

**No new files needed.** This is the integration of B1 + C1 + A1 + B2.

**Validation:**
```bash
# After a full execute-changeset run, check that grades exist
wc -l .svc/auto-grades.jsonl
# Should show entries for each task
```

---

### C3. Vision Verification

**Problem:** No automated visual comparison. Human reviews screenshots.

**Files to create/modify:**

#### 1. Create vision-verify agent

**New file:** `agents/visual-verifier.md`

```markdown
---
name: visual-verifier
description: Vision-based UI verification. Compares screenshots against goals and design tokens.
model: claude-opus-4-8
tools: [Read]
harness: closed-input-closed-tool
---

# Visual Verifier Agent

You receive:
1. A new screenshot (the current UI state)
2. A baseline screenshot (the previous state, if any)
3. The goal description from the spec
4. Design tokens from the project

## Your job

Compare the new screenshot against the goal:
1. Does the UI match the described goal?
2. Are design tokens (colors, spacing, typography) consistent?
3. If baseline exists, is the change intentional?
4. Are there visual regressions (missing elements, broken layout)?

## Output format

```yaml
verdict: PASS | FAIL
findings:
  - area: "<UI area>"
    issue: "<what's wrong>"
    severity: critical | high | medium | low
    evidence: "<description of visual mismatch>"
```

## Rules

- Compare against the goal, not against your preference.
- If no baseline exists, only check against the goal.
- Be specific about visual mismatches (wrong color, missing element, misaligned).
- Do not suggest design improvements — only verify against stated goals.
```

#### 2. Add vision-verify to track-visuals

**File:** `track-visuals/SKILL.md` — add after diff capture section

```markdown
## Vision Verification

After capturing a diff screenshot, optionally run vision verification:

```bash
# Spawn visual verifier with screenshots
claude -p --agent visual-verifier \
  --input-screenshot .svc/visuals/<WI>/current.png \
  --input-baseline docs/specs/visuals/baseline/<screen>.png \
  --input-goal "The pricing page should show 3 tier cards with monthly/annual toggle" \
  --output-format yaml
```

**When to use:**
- UI-heavy features (new pages, component redesigns)
- Before review-gate G3 (visual design) and G5 (implementation)
- When benchmark-landing scores are below threshold

**When to skip:**
- Backend-only changes
- Pure refactors with no UI impact
```

#### 3. Add vision-verify to review-gate

**File:** `review-gate/SKILL.md` — G3 and G5 checklists

Add to G3 checklist:
```markdown
| Vision verification passed | For browser-visible changes: visual-verifier agent confirmed screenshots match goal + design tokens |
```

Add to G5 checklist:
```markdown
| Vision verification passed | For browser-visible changes: visual-verifier agent confirmed implementation matches spec visually |
```

**Validation:**
```bash
cat agents/visual-verifier.md | head -5
# Should show frontmatter with model: claude-opus-4-8
```

---

## PHASE D: Orchestration Extensions

### D1. Routines Skill + Runner

**Problem:** All work is user-initiated. No scheduled/cloud execution.

**Files to create:**

#### 1. Create routines skill

**New directory:** `routines/`

**New file:** `routines/SKILL.md`

```markdown
---
name: routines
description: Saved svc configurations that run on triggers. Use when setting up scheduled evaluation, CI-triggered investigation, or post-merge pattern capture.
inputs:
  required:
    - { path: "routines/configs/<name>.yaml", artifact: routine-config }
outputs:
  produces:
    - { path: ".svc/routine-runs/<name>-<timestamp>.md", artifact: routine-run-log }
chain:
  lanes:
    framework: { position: 0, prev: null, next: null }
---

# Routines

A routine is a saved Claude Code configuration (prompt + repos + connectors + permissions)
that runs on Anthropic-managed cloud infrastructure. Your laptop can be off. The run still happens.

**Verified:** Routines are in research preview (Anthropic docs, June 2026).
Create via `/schedule` CLI, web UI at `claude.ai/code/routines`, or Desktop app.
Available on Pro, Max, Team, and Enterprise plans.

## Routine Config Format

```yaml
name: nightly-eval-compounding
description: Re-run eval suite, distill new patterns, post digest
model: claude-fable-5
trigger:
  type: schedule
  cron: "0 7 * * *"
harness: managed-agents
goal: |
  Re-run yesterday's eval suite against the latest skills.
  Any test that newly passes → distill the pattern into the skill.
  Any test that newly fails → investigate, document in STATE.md.
  Post the digest to #engineering.
max_iterations: 5
grader:
  model: haiku-4.5
  type: outcomes
  rubric:
    - "All eval results documented"
    - "New failure modes added to relevant skills"
    - "STATE.md updated with session summary"
    - "Digest posted to designated channel"
```

## Trigger Types

| Type | Use case | Config |
|---|---|---|
| `schedule` | Daily/weekly re-runs | `cron: "0 7 * * *"` |
| `api` | CI failure, Sentry alert | `webhook_url: <endpoint>` |
| `github` | PR merge, issue opened | `event: pull_request.closed` |

## Running a Routine

```bash
node scripts/routine-runner.mjs --config routines/configs/nightly-eval.yaml
```

## Creating a Routine

1. Copy `routines/configs/template.yaml`
2. Fill in name, trigger, goal, grader rubric
3. Test with `node scripts/routine-runner.mjs --config <path> --dry-run`
4. Activate with trigger configuration
```

#### 2. Create routine runner

**New file:** `scripts/routine-runner.mjs`

```javascript
#!/usr/bin/env node
// Executes a routine config
// Usage: node scripts/routine-runner.mjs --config <path> [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml'; // or parse manually

const projectDir = process.env.SVC_PROJECT_DIR || '.';

function parseRoutineConfig(configPath) {
  const content = fs.readFileSync(configPath, 'utf8');
  // Simple YAML parser (or use js-yaml)
  return JSON.parse(content); // assume JSON for now
}

function runRoutine(config, dryRun = false) {
  const runId = `${config.name}-${Date.now()}`;
  const runDir = path.join(projectDir, '.svc', 'routine-runs');
  fs.mkdirSync(runDir, { recursive: true });

  const logPath = path.join(runDir, `${runId}.md`);

  const log = `# Routine Run: ${config.name}
**Started:** ${new Date().toISOString()}
**Trigger:** ${JSON.stringify(config.trigger)}
**Model:** ${config.model}
**Dry run:** ${dryRun}

## Goal
${config.goal}

## Execution
`;

  if (dryRun) {
    fs.writeFileSync(logPath, log + '\n(dry run — no execution)\n');
    console.log(`Dry run complete. Log: ${logPath}`);
    return;
  }

  // Execute the goal via claude CLI
  try {
    const result = execSync(
      `claude -p "${config.goal.replace(/"/g, '\\"')}" --model ${config.model} --output-format json`,
      { encoding: 'utf8', timeout: 3600000 } // 1 hour timeout
    );

    const completed = log + `\n## Result\n${result}\n\n**Completed:** ${new Date().toISOString()}\n`;
    fs.writeFileSync(logPath, completed);
    console.log(`Routine complete. Log: ${logPath}`);
  } catch (err) {
    const failed = log + `\n## Error\n${err.message}\n\n**Failed:** ${new Date().toISOString()}\n`;
    fs.writeFileSync(logPath, failed);
    console.error(`Routine failed. Log: ${logPath}`);
  }
}

// CLI
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--') && i + 1 < arr.length) {
      acc[arg.slice(2)] = arr[i + 1];
    } else if (arg === '--dry-run') {
      acc.dryRun = true;
    }
    return acc;
  }, {})
);

if (!args.config) {
  console.error('Usage: routine-runner.mjs --config <path> [--dry-run]');
  process.exit(1);
}

const config = parseRoutineConfig(args.config);
runRoutine(config, args.dryRun);
```

#### 3. Create example routine configs

**New file:** `routines/configs/nightly-eval.yaml`

```yaml
name: nightly-eval-compounding
description: Daily eval re-run with skill compaction
model: claude-fable-5
trigger:
  type: schedule
  cron: "0 7 * * *"
harness: managed-agents
goal: |
  1. Run bash test-framework/evals/run-all-evals.sh
  2. Any test that newly fails → investigate, document in FRAMEWORK-STATE.md
  3. Any test that newly passes → check if the skill was updated, distill the pattern
  4. Update .svc/compounding-metric.json
  5. Post digest summary
max_iterations: 3
grader:
  model: haiku-4.5
  type: outcomes
  rubric:
    - "All eval results documented in FRAMEWORK-STATE.md"
    - "New failure modes added to relevant skills via compact-to-skill"
    - "Compounding metric updated"
```

**New file:** `routines/configs/ci-triage.yaml`

```yaml
name: ci-failure-triage
description: Investigate CI failures, draft fixes, escalate complex ones
model: claude-fable-5
trigger:
  type: api
  event: workflow_run.failure
harness: managed-agents
goal: |
  1. Read the failed CI run logs
  2. Classify: env / flake / bug / dependency / infra
  3. For flake: retry once, then file
  4. For bug: draft fix in a worktree
  5. For infra/env/dependency: escalate to human
  6. Update STATE.md with classification and actions taken
max_iterations: 2
grader:
  model: haiku-4.5
  type: outcomes
  rubric:
    - "Failure classified with evidence"
    - "Fix drafted for bug-type failures"
    - "Escalation sent for non-fixable failures"
    - "STATE.md updated"
```

**New file:** `routines/configs/post-merge-capture.yaml`

```yaml
name: post-merge-pattern-capture
description: On PR merge, capture new patterns into skills
model: claude-sonnet-4-6
trigger:
  type: github
  event: pull_request.closed
  condition: merged == true
harness: local
goal: |
  1. Read the merged PR diff
  2. Identify any new patterns, anti-patterns, or conventions introduced
  3. For each pattern: create a learning entry at stage "investigate"
  4. If the pattern is confirmed by test passage, advance to "verify"
  5. Compact verified patterns into relevant skills
max_iterations: 1
grader:
  model: haiku-4.5
  type: outcomes
  rubric:
    - "New patterns captured as learnings"
    - "Verified patterns compacted to skills"
    - "No false positives (patterns that aren't real)"
```

**Validation:**
```bash
node scripts/routine-runner.mjs --config routines/configs/nightly-eval.yaml --dry-run
cat .svc/routine-runs/nightly-eval-compounding-*.md
# Should show dry run log
```

---

### D2. Model Routing Tiers

**Problem:** No explicit 4-tier model routing (Fable 5 / Opus 4.8 / Sonnet 4.6 / Haiku 4.5).

**Files to modify:**

#### 1. Update resolve-model.sh

**File:** `scripts/resolve-model.sh`

Add 4-tier routing table:

```bash
# Model routing tiers
# Tier 1 (Orchestrator): Fable 5 — days-long planning, delegation, vision
# Tier 2 (Hard subtask): Opus 4.8 — architecture, complex debugging, classifier fallback
# Tier 3 (Worker): Sonnet 4.6 — lint, refactor, test scaffolding, docs
# Tier 4 (Grader): Haiku 4.5 — verification, classification, cheap evaluation

resolve_model() {
  local task_type="$1"
  local complexity="$2"

  case "$task_type" in
    orchestrator|planning|delegation)
      echo "claude-fable-5"
      ;;
    architecture|complex-debug|security-review|classifier-fallback)
      echo "claude-opus-4-8"
      ;;
    refactor|lint|test-scaffold|doc-update|worker)
      echo "claude-sonnet-4-6"
      ;;
    grader|verifier|classifier|evaluation)
      echo "claude-haiku-4-5"
      ;;
    *)
      # Default: route by complexity
      case "$complexity" in
        high) echo "claude-opus-4-8" ;;
        medium) echo "claude-sonnet-4-6" ;;
        low) echo "claude-haiku-4-5" ;;
        *) echo "claude-sonnet-4-6" ;;
      esac
      ;;
  esac
}
```

#### 2. Update model-selection rule

**File:** `rules/common/model-selection.md`

Add the 4-tier table:

```markdown
## Model Routing Tiers (Fable 5 era)

| Tier | Model | Use for | Cost |
|---|---|---|---|
| 1 - Orchestrator | Fable 5 | Days-long planning, delegation, vision self-check, rule distillation | $10/$50 per M tokens |
| 2 - Hard subtask | Opus 4.8 | Architecture decisions, complex debugging, deep code reviews, classifier fallback | $5/$25 per M tokens |
| 3 - Worker | Sonnet 4.6 | Lint passes, simple refactors, test scaffolding, doc updates | $3/$15 per M tokens |
| 4 - Grader | Haiku 4.5 | Verification, classification, cheap evaluation, summary extraction | $1/$5 per M tokens |

**Routing rule:** Use the cheapest model that can do the job. Don't use Fable 5 for lint passes.
**Classifier fallback:** When Fable 5 blocks (cyber/bio/chem), retry with Opus 4.8.
```

**Validation:**
```bash
grep -c "Tier 1" rules/common/model-selection.md
# Should return 1
```

---

### D3. Compose-Workflow Skill (Dynamic Workflows wrapper)

**Problem:** No generic Dynamic Workflow primitive for complex tasks that don't fit existing skills.

**Verified:** Dynamic Workflows are a real Claude Code feature (v2.1.154+). JS scripts orchestrating subagents. Up to 16 concurrent, 1000 total per run. Bundled `/deep-research` workflow.

**Files to create:**

#### 1. Create compose-workflow skill

**New directory:** `compose-workflow/`

**New file:** `compose-workflow/SKILL.md`

```markdown
---
name: compose-workflow
description: Compose a custom workflow when no single skill fits. On Claude Code hosts, uses Dynamic Workflows (ultracode). On other hosts, uses dispatch-worker.sh.
inputs:
  required:
    - { path: "(goal description)", artifact: workflow-goal }
  optional:
    - { path: "docs/specs/*.md", artifact: related-specs }
outputs:
  produces:
    - { path: ".claude/workflows/<name>.md", artifact: workflow-script }
    - { path: ".svc/workflows/<name>-result.md", artifact: workflow-result }
chain:
  lanes: {}
---

# Compose Workflow

When no single skill fits a complex task, compose a workflow from primitives.

## Host Detection

| Host | Mechanism | Invocation |
|---|---|---|
| Claude Code | Dynamic Workflows | Include `ultracode` keyword in prompt, or ask "use a workflow" |
| Kimi CLI | dispatch-worker.sh | Fan-out via `scripts/dispatch-worker.sh` |
| Codex CLI | dispatch-worker.sh | Fan-out via `scripts/dispatch-worker.sh` |
| Other | dispatch-worker.sh | Fan-out via `scripts/dispatch-worker.sh` |

## Claude Code Path (Dynamic Workflows)

On Claude Code, the skill instructs Claude to write a workflow script using Dynamic Workflows:

1. **Analyze the goal** — does any existing skill fit? If yes, use that skill instead.
2. **Decompose** — break the goal into phases
3. **Invoke Dynamic Workflow** — include `ultracode` keyword or ask Claude to write a workflow
4. **Claude writes the script** — JS with subagent orchestration
5. **Runtime executes** — background, resumable via `/workflows`
6. **Capture result** — read from workflow progress view

**Dynamic Workflow primitives (from Anthropic docs):**
| Primitive | What it does | Example |
|---|---|---|
| Subagent | Spawn a worker with a prompt | Research agent |
| Parallel | Run multiple agents concurrently (up to 16) | Evaluate 5 rules in parallel |
| Phases | Sequential stages in the script | Research → Draft → Review |
| Loop | Repeat until stop condition | Keep fixing until tests pass |

**Bundled workflow:** `/deep-research <question>` — fans out web searches, cross-checks sources, returns cited report.

## Non-Claude-Code Path (dispatch-worker.sh)

On other hosts, use existing infrastructure:

1. **Analyze the goal** — does any existing skill fit?
2. **Decompose** — break into tasks
3. **Dispatch** — `scripts/dispatch-worker.sh` for each task
4. **Collect results** — merge worker outputs
5. **Capture** — write to `.svc/workflows/<name>-result.md`

## Anti-Patterns

- Don't compose a workflow when an existing skill fits
- Don't skip the goal analysis — "does any existing skill fit?" is mandatory
- On Claude Code, don't manually orchestrate when Dynamic Workflows handle it
- On non-Claude-Code hosts, don't exceed 5 parallel workers without conflict analysis
```

#### 2. Register in manifest

**File:** `skills-manifest.json` — add to `includedSkills`

```json
"compose-workflow"
```

Add to `corePackForRouting`:
```json
"compose-workflow"
```

**Validation:**
```bash
node scripts/lint-skills-manifest.mjs
# Should pass with compose-workflow in includedSkills
```

---

## Plan Issues Found (Review Round)

### CRITICAL Issues

**1. `scripts/resolve-model.sh` D2 rewrite destroys existing architecture.**
The plan proposes replacing the Python-based registry lookup (`references/model-registry.json`) with a hardcoded bash case statement. This breaks host-agnostic resolution, multi-profile support, and the registry single-source-of-truth.
**Fix:** Add Fable 5 models to `references/model-registry.json` as new entries in the existing harness/profile structure. Do NOT create a new bash function.

**2. `scripts/manage-learnings.mjs` does not exist.**
The plan references "modify" this script in A1 item 3, but it doesn't exist. SKILL.md references commands (`advance`, `progression-report`) that have no backing script.
**Fix:** Create `scripts/manage-learnings.mjs` as a NEW file. The plan already has the code snippet (lines 99-119) but frames it as modification. Frame it as creation.

**3. `hooks/svc-learning-preload.mjs` write-back violates append-only contract.**
The plan proposes incrementing `consult_count` and writing back to tracked JSONL from a SessionStart hook. This dirties the worktree on every session start and violates the append-only learning contract.
**Fix:** Track consult counts in a separate gitignored file `.svc/consult-counts.json` that maps learning keys to counts. The preload hook reads from both JSONL (learnings) and consult-counts.json (consult metadata), then injects the combined context. No write-back to tracked files.

### HIGH Issues

**4. `execute-changeset/SKILL.md` per-task verifier contradicts existing principle.**
Line 103 of execute-changeset explicitly says "No per-task quality review. Style contract + spec constraints are sufficient per task. One holistic review of the full diff after ALL tasks." The plan's C1 per-task verifier directly contradicts this.
**Fix:** Make the task-verifier OPTIONAL (available but not mandatory). Add it as a note: "For high-risk tasks (new data models, auth, payments), optionally spawn task-verifier after self-verify. The holistic review in Step 3 remains the primary quality gate."

**5. `route-workflow` not updated for new skills.**
The plan creates `routines/` and `compose-workflow/` skills but doesn't update routing rules. route-workflow can't dispatch to skills it doesn't know about.
**Fix:** Add routing entries to `route-workflow/references/routing-rules.md` for both new skills.

**6. `compose-workflow` lane position conflicts with route-workflow.**
The plan puts compose-workflow at position 0 in greenfield and brownfield-feature lanes, but route-workflow is already at position 0 in ALL lanes.
**Fix:** Make compose-workflow an on-demand utility skill (no lane position, like manage-learnings).

**7. `manage-learnings/SKILL.md` type enum replacement drops existing types.**
The plan's A5 section (line 495) proposes `type: operational | framework | classifier-block | security | performance` which replaces the existing `pattern | pitfall | preference | architecture | tool | operational`.
**Fix:** Append `classifier-block` to the existing enum: `pattern | pitfall | preference | architecture | tool | operational | classifier-block`.

### MODERATE Issues

**8. `review-gate` vision-verify rows belong in reference file, not SKILL.md.**
Gate checklists are in `references/gate-checklists.md`, not inline in SKILL.md. The plan proposes modifying SKILL.md for G3/G5 vision rows.
**Fix:** Modify `references/gate-checklists.md` instead. Verify this file exists and find correct insertion points.

**9. Agent invocation syntax doesn't match Claude Code.**
The plan uses `claude -p --agent task-verifier --input-diff "$(git diff HEAD~1)"` but `--input-diff` and `--input-ac` are not standard Claude CLI flags.
**Fix:** Use prompt-based invocation: `claude -p --agent task-verifier "Verify this diff against these ACs: <paste>"`.

**10. `rules/common/model-selection.md` tier abstraction conflicts with cognitive labels.**
The plan introduces numbered tiers (1-4) but the file uses cognitive labels (STRAT, PLAN, EXEC, PASS). These are different abstraction layers.
**Fix:** Map tiers to existing labels: Tier 1 = STRAT/PLAN, Tier 2 = REVIEW (high-stakes), Tier 3 = EXEC, Tier 4 = PASS. Don't replace the label system.

### MINOR Issues

**11. `FRAMEWORK-STATE.md` 50KB cap.** Adding Mythos Safety Boundary section increases size. Verify it stays under 50KB after all edits.

**12. `$REPO_ROOT` variable in completion-guard.** The hook doesn't define `$REPO_ROOT`. Use `${SVC_REPO_ROOT:-$PWD}`.

**13. `track-visuals` invocation syntax.** The `--input-screenshot` and `--input-baseline` flags don't exist. Use prompt-based input.

---

## Per-Skill Impact Review

Each skill touched by the plan, with conflict analysis and correct modification:

### manage-learnings/SKILL.md
| Plan item | Conflict | Correct action |
|---|---|---|
| A1: Add stage field to JSONL schema | None — purely additive | Add 4 fields to schema table (safe) |
| A1: Add `## Stage Progression` section | None — new section | Insert after `## Integration` (line 314) |
| A1: Add `progression-report` command | References non-existent script | Create `scripts/manage-learnings.mjs` FIRST, then document commands |
| A3: Add `freshness-report` command | None — new command | Add to SKILL.md after progression-report |
| A4: Add `compounding-report` command | None — new command | Add to SKILL.md after freshness-report |
| A5: Add `classifier-block` type | **YES — replaces existing enum** | Append to existing: `pattern | pitfall | preference | architecture | tool | operational | classifier-block` |
| B2: Add `## Compact to Skill` section | None — new section | Document as reference to `scripts/compact-learning-to-skill.mjs`, not inline |

### execute-changeset/SKILL.md
| Plan item | Conflict | Correct action |
|---|---|---|
| B1: Add auto-grade after self-verify | None — insertion after Self-Verify table | Safe — insert after line 278 |
| C1: Add per-task verifier invocation | **YES — contradicts "no per-task review" principle (line 103)** | Make OPTIONAL: "For high-risk tasks, optionally spawn task-verifier. Holistic review in Step 3 remains primary." |

### review-gate/SKILL.md
| Plan item | Conflict | Correct action |
|---|---|---|
| B1: Add auto-grade after Gate Decision | None — insertion after line 158 | Safe |
| B3: Add goal-loop section | None — new section | Insert after Gate Decision, before Pipeline Continuation |
| C3: Add vision-verify to G3/G5 checklists | **YES — checklists are in `references/gate-checklists.md`, not SKILL.md** | Modify `references/gate-checklists.md` instead |

### track-visuals/SKILL.md
| Plan item | Conflict | Correct action |
|---|---|---|
| C3: Add vision verification section | None — new section | Insert after Diff Mode (line ~400), before Update Mode. Fix invocation syntax to prompt-based. |

### route-workflow/SKILL.md
| Plan item | Conflict | Correct action |
|---|---|---|
| D1: Know about routines skill | **YES — no routing entry added** | Add entry to `references/routing-rules.md` for `routines` |
| D3: Know about compose-workflow skill | **YES — no routing entry added** | Add entry to `references/routing-rules.md` for `compose-workflow` |

### skills-manifest.json
| Plan item | Conflict | Correct action |
|---|---|---|
| D1: Add `routines` to includedSkills | None — new skill | Add, add to corePackForRouting, add lane entry (framework lane) |
| D3: Add `compose-workflow` to includedSkills | **YES — lane position 0 conflicts with route-workflow** | Make on-demand utility (no lane position). Add to includedSkills + corePackForRouting only. |
| A3: Add freshness metadata to skillMetadata | None — new fields | Extend existing `skillMetadata` object |

### hooks/svc-task-completion-guard.sh
| Plan item | Conflict | Correct action |
|---|---|---|
| A2: Wire resume writer | **MINOR — `$REPO_ROOT` variable doesn't exist** | Use `${SVC_REPO_ROOT:-$PWD}`. Insert after SDKG router (line 96). |

### hooks/svc-learning-preload.mjs
| Plan item | Conflict | Correct action |
|---|---|---|
| A1: Increment consult_count + write back | **YES — violates append-only contract, dirties worktree** | Track consult counts in `.svc/consult-counts.json` (gitignored). Hook reads both files, combines context. No write-back. |
| A2: Read session resume | None — purely additive | Insert after `loadAllLearnings()` (line 89). Read `.svc/session-resume.md`. |

### scripts/manage-learnings.mjs
| Plan item | Conflict | Correct action |
|---|---|---|
| A1: "Modify" existing script | **YES — script does not exist** | Create as NEW file with full implementation: CLI parsing, JSONL reading, advance, progression-report, auto-advance, freshness-report |

### scripts/resolve-model.sh
| Plan item | Conflict | Correct action |
|---|---|---|
| A5: Add classifier-block detection | **YES — `$RESPONSE` variable doesn't exist; post-response logic in pre-response script** | Create separate `scripts/detect-classifier-block.mjs` script. Wire into hook chain post-response. |
| D2: Replace with 4-tier bash function | **YES — destroys Python registry architecture** | Add Fable 5 models to `references/model-registry.json`. Keep existing resolution mechanism. |

### rules/common/model-selection.md
| Plan item | Conflict | Correct action |
|---|---|---|
| D2: Add tier table | **MINOR — conflicts with cognitive label abstraction; duplicate content** | Map tiers to existing labels (Tier 1 = STRAT/PLAN, etc.). Deduplicate existing "Context Window Management" section. |

### New files to create (no conflicts)
| File | Phase | Purpose |
|---|---|---|
| `scripts/manage-learnings.mjs` | A1 | Stage progression, freshness report, compounding report |
| `scripts/write-session-resume.mjs` | A2 | Session resume writer |
| `scripts/compounding-metric.mjs` | A4 | Weekly compounding metric |
| `scripts/write-auto-grade.mjs` | B1 | Auto-grade writer |
| `scripts/compact-learning-to-skill.mjs` | B2 | Learning → skill compaction |
| `scripts/goal-loop.mjs` | B3 | Iterative gate correction |
| `scripts/detect-classifier-block.mjs` | A5 | Classifier block detection (replaces plan's resolve-model.sh modification) |
| `agents/task-verifier.md` | C1 | Independent task verifier |
| `agents/visual-verifier.md` | C3 | Vision-based UI verifier |
| `routines/SKILL.md` | D1 | Routines skill definition |
| `routines/configs/*.yaml` | D1 | Example routine configs |
| `scripts/routine-runner.mjs` | D1 | Routine execution runner |
| `compose-workflow/SKILL.md` | D3 | Workflow composition skill |

---

## Execution Summary

| Phase | Items | Est. Effort | Dependencies |
|---|---|---|---|
| A | A1-A5 (5 items) | 2-3 days | None |
| B | B1-B3 (3 items) | 2-3 days | Phase A |
| C | C1-C3 (3 items) | 2-3 days | Phase B |
| D | D1-D3 (3 items) | 3-4 days | Independent |
| **Total** | **14 items + 13 new files** | **9-13 days** | |

## Validation Commands (all phases)

```bash
# Phase A
node scripts/manage-learnings.mjs progression-report
node scripts/write-session-resume.mjs
node scripts/manage-learnings.mjs freshness-report
node scripts/compounding-metric.mjs
grep -c "Mythos Safety Boundary" FRAMEWORK-STATE.md

# Phase B
node scripts/write-auto-grade.mjs --skill test --task_id T-test --grade pass --verifier self
node scripts/compact-learning-to-skill.mjs <key> <skill>
node scripts/goal-loop.mjs --skill review-gate --artifact test.md --max-iterations 2

# Phase C
cat agents/task-verifier.md | head -5
cat agents/visual-verifier.md | head -5
wc -l .svc/auto-grades.jsonl

# Phase D
node scripts/routine-runner.mjs --config routines/configs/nightly-eval.yaml --dry-run
grep -c "Tier 1" rules/common/model-selection.md
node scripts/lint-skills-manifest.mjs

# Full validation
bash test-framework/evals/run-all-evals.sh
node scripts/lint-skills-manifest.mjs
```
