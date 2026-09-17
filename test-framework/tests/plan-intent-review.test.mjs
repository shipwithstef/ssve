import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mechanical = path.join(root, 'scripts/verify-plan-mechanical.sh');
const reviewPlan = path.join(root, 'scripts/review-plan-codex.sh');

function writePlan(dir, body) {
  fs.mkdirSync(dir, { recursive: true });
  const planPath = path.join(dir, 'manifest.md');
  fs.writeFileSync(planPath, body);
  return planPath;
}

const PASSING_AGY_PLAN = `author: antigravity
orchestrator: agy

# Plan

## User Intent

Implement centralized worktree governance with fail-closed policy loading and leaf-only removal.

## Prerequisite Alignment Matrix

| Upstream | Status | Artifact |
|----------|--------|----------|
| write-spec | complete | docs/specs/worktree.md |

## Execution Command Sequence

\`\`\`bash
echo ok
\`\`\`
`;

const MISSING_INTENT_PLAN = `author: antigravity
orchestrator: agy

# Plan

## Prerequisite Alignment Matrix

| Upstream | Status | Artifact |
|----------|--------|----------|
| write-spec | complete | docs/specs/worktree.md |

## Execution Command Sequence

\`\`\`bash
echo ok
\`\`\`
`;

test('verify-plan-mechanical.sh passes on plan with ## User Intent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-plan-intent-pass-'));
  try {
    const planPath = writePlan(tmp, PASSING_AGY_PLAN);
    const result = spawnSync('bash', [mechanical, planPath, tmp], { encoding: 'utf8' });
    assert.equal(result.status, 0, `expected pass, got ${result.status}:\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /TIER-1 PASS/);
    assert.doesNotMatch(result.stdout, /AGY\/Gemini authored plan must include a non-empty '## User Intent' section/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('verify-plan-mechanical.sh rejects AGY-authored plan when ## User Intent is missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-plan-intent-fail-'));
  try {
    const planPath = writePlan(tmp, MISSING_INTENT_PLAN);
    const result = spawnSync('bash', [mechanical, planPath, tmp], { encoding: 'utf8' });
    assert.equal(result.status, 1, `expected exit 1, got ${result.status}:\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /\[FAIL\] AGY\/Gemini authored plan must include a non-empty '## User Intent' section/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

const QUOTED_MISSING_INTENT_PLAN = `---
author: "antigravity"
orchestrator: "agy"
---

# Plan

## Prerequisite Alignment Matrix

| Upstream | Status | Artifact |
|----------|--------|----------|
| write-spec | complete | docs/specs/worktree.md |

## Execution Command Sequence

\`\`\`bash
echo ok
\`\`\`
`;

test('verify-plan-mechanical.sh rejects quoted AGY author/orchestrator without ## User Intent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-plan-intent-quoted-'));
  try {
    const planPath = writePlan(tmp, QUOTED_MISSING_INTENT_PLAN);
    const result = spawnSync('bash', [mechanical, planPath, tmp], { encoding: 'utf8' });
    assert.equal(result.status, 1, `expected exit 1, got ${result.status}:\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /TIER-1 FAIL/);
    assert.match(result.stdout, /\[FAIL\] AGY\/Gemini authored plan must include a non-empty '## User Intent' section/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('verify-plan-mechanical.sh and review-plan-codex.sh share the unified AGY intent regex', () => {
  const needle = `^[[:space:]]*(author|orchestrator):[[:space:]]*["'"'"']?(antigravity|gemini|agy)["'"'"']?`;
  const mechanicalSrc = fs.readFileSync(mechanical, 'utf8');
  const reviewSrc = fs.readFileSync(reviewPlan, 'utf8');
  assert.equal(mechanicalSrc.includes(needle), true, 'mechanical script is missing the unified regex');
  assert.equal(reviewSrc.includes(needle), true, 'review-plan script is missing the unified regex');
});

test('verify-plan-mechanical.sh rejects indented quoted AGY author without ## User Intent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-plan-intent-indent-'));
  try {
    const planPath = writePlan(tmp, `---
  author: "antigravity"
  orchestrator: "agy"
---

# Plan

## Prerequisite Alignment Matrix

| Upstream | Status | Artifact |
|----------|--------|----------|
| write-spec | complete | docs/specs/worktree.md |

## Execution Command Sequence

\`\`\`bash
echo ok
\`\`\`
`);
    const result = spawnSync('bash', [mechanical, planPath, tmp], { encoding: 'utf8' });
    assert.equal(result.status, 1, `expected exit 1, got ${result.status}:\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /\[FAIL\] AGY\/Gemini authored plan must include a non-empty '## User Intent' section/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('review-plan-codex.sh derives WI from frontmatter work_item only', () => {
  const src = fs.readFileSync(reviewPlan, 'utf8');
  assert.match(src, /sed -n '\/\^---\$\/,\/\^---\$\/p'/);
  assert.match(src, /grep -E '\^work_item:\[\[:space:\]\]\*'/);
  assert.doesNotMatch(src, /grep -oE "\$WI_PATTERN"/);
  assert.doesNotMatch(src, /PLAN_WIS=/);
});

test('intent extraction in review-plan-codex.sh correctly extracts the user intent block', () => {
  const src = fs.readFileSync(reviewPlan, 'utf8');
  assert.match(src, /IS_AGY_PLAN=false/);
  assert.match(src, /\[\[:space:\]\]\*\(author\|orchestrator\):\[\[:space:\]\]\*/);
  assert.match(src, /MANDATORY USER INTENT EVALUATION/);
  assert.match(src, /awk '\/\^## \(4\\. \)\?User Intent\/\{flag=1; next\} \/\^## \//);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-plan-intent-extract-'));
  try {
    const numbered = writePlan(tmp, `# Plan

## 4. User Intent

Do not omit the leaf-only removal rule.
Keep fail-closed policy loading.

## Prerequisite Alignment Matrix

| Upstream | Status |
|----------|--------|
`);
    const extracted = execFileSync('awk', [
      '/^## (4\\. )?User Intent/{flag=1; next} /^## /{flag=0} flag',
      numbered,
    ], { encoding: 'utf8' });
    assert.match(extracted, /Do not omit the leaf-only removal rule/);
    assert.match(extracted, /Keep fail-closed policy loading/);
    assert.doesNotMatch(extracted, /Prerequisite Alignment Matrix/);

    const plain = writePlan(path.join(tmp, 'plain'), PASSING_AGY_PLAN);
    const extractedPlain = execFileSync('awk', [
      '/^## (4\\. )?User Intent/{flag=1; next} /^## /{flag=0} flag',
      plain,
    ], { encoding: 'utf8' });
    assert.match(extractedPlain, /Implement centralized worktree governance/);
    assert.doesNotMatch(extractedPlain, /Execution Command Sequence/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('review-plan-codex.sh fail-closes AGY plans with empty User Intent before launcher', () => {
  const src = fs.readFileSync(reviewPlan, 'utf8');
  const beforeLauncher = src.slice(0, src.indexOf('node "$LAUNCHER"'));
  assert.match(beforeLauncher, /USER_INTENT_BODY=/);
  assert.match(beforeLauncher, /missing a non-empty ## User Intent section/);
  assert.match(beforeLauncher, /refusing plan review before any provider call/);
  assert.match(beforeLauncher, /exit 4/);
});

test('review-plan-codex.sh reconciles frontmatter work_item with branch WI token', () => {
  const src = fs.readFileSync(reviewPlan, 'utf8');
  const beforeLauncher = src.slice(0, src.indexOf('node "$LAUNCHER"'));
  assert.match(beforeLauncher, /extractWiId/);
  assert.match(beforeLauncher, /does not match branch WI token/);
  assert.match(beforeLauncher, /plan_wi_lc=/);
  assert.match(beforeLauncher, /token_lc=/);
});
