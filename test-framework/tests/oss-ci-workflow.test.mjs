import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(root, 'docs/ci/workflows/ssve-checks.yml');
const dependabotPath = path.join(root, 'docs/ci/workflows/dependabot.yml');
const activationPath = path.join(root, 'docs/ci/ACTIVATION.md');
const wrapperPath = path.join(root, 'scripts/ci/run-free-checks.sh');
const liveWorkflowDir = path.join(root, '.github/workflows');
const liveWorkflowPath = path.join(liveWorkflowDir, 'ssve-checks.yml');
const liveDependabotPath = path.join(root, '.github/dependabot.yml');
const checkoutSha = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const setupNodeSha = '820762786026740c76f36085b0efc47a31fe5020';
const requiredCheckName = 'SSVE Required';
const nodeBin = process.env.GITHUB_ACTIONS === 'true' ? 'node' : '/usr/bin/node';

function loadYaml(file) {
  const result = spawnSync('/usr/bin/python3', [
    '-c',
    'import json,sys,yaml; json.dump(yaml.safe_load(open(sys.argv[1], encoding="utf-8")), sys.stdout)',
    file,
  ], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || `yaml parse failed for ${file}`);
  return JSON.parse(result.stdout);
}

function triggerBlock(doc) {
  // PyYAML 1.1 treats the GitHub key "on" as boolean true; json then stringifies it.
  return doc.on ?? doc.true;
}

function listYamlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /\.ya?ml$/i.test(name)).sort();
}

function usesEntries(workflow) {
  const found = [];
  for (const job of Object.values(workflow.jobs || {})) {
    for (const step of job.steps || []) {
      if (step.uses) found.push(step.uses);
    }
  }
  return found;
}

const workflow = loadYaml(workflowPath);
const dependabot = loadYaml(dependabotPath);
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const activation = fs.readFileSync(activationPath, 'utf8');
const workflowText = fs.readFileSync(workflowPath, 'utf8');

test('reference templates parse as YAML and keep live configuration equivalent', () => {
  assert.equal(typeof workflow, 'object');
  assert.equal(workflow.name, 'SSVE Checks');
  assert.match(workflowText, /DORMANT TEMPLATE/);
  assert.match(fs.readFileSync(dependabotPath, 'utf8'), /DORMANT TEMPLATE/);
  assert.equal(fs.existsSync(path.join(root, '.github/workflows')), fs.existsSync(liveWorkflowDir));

  const liveFiles = listYamlFiles(liveWorkflowDir);
  if (liveFiles.length === 0) {
    assert.equal(fs.existsSync(liveWorkflowPath), false);
    return;
  }
  assert.deepEqual(liveFiles, ['ssve-checks.yml']);
  assert.deepEqual(
    loadYaml(liveWorkflowPath),
    workflow,
    'activated workflow must preserve every template configuration value',
  );
  assert.deepEqual(
    loadYaml(liveDependabotPath),
    dependabot,
    'activated Dependabot config must preserve every template configuration value',
  );
});

test('event coverage includes pull_request and push to main, without dispatch or path skips', () => {
  const on = triggerBlock(workflow);
  assert.ok(on, 'workflow trigger block missing');
  assert.ok(on.pull_request !== undefined);
  assert.deepEqual(on.push.branches, ['main']);
  assert.equal(on.workflow_dispatch, undefined);
  assert.doesNotMatch(workflowText, /^on:\n(?:  .*\n)*  workflow_dispatch:/m);
  assert.equal(on.schedule, undefined);
  assert.equal(on.pull_request_target, undefined);
  assert.equal(workflowText.includes('pull_request_target'), false);
  assert.equal(workflowText.includes('workflow_run'), false);
  assert.doesNotMatch(workflowText, /^ {2}paths:/m);
  assert.doesNotMatch(workflowText, /paths-ignore:/);
});

test('permissions stay read-only and checkout does not persist write credentials', () => {
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  const free = workflow.jobs['free-checks'];
  const required = workflow.jobs.required;
  assert.deepEqual(free.permissions, {contents: 'read'});
  assert.deepEqual(required.permissions, {contents: 'read'});
  const checkout = free.steps.find((step) => String(step.uses || '').startsWith('actions/checkout@'));
  assert.equal(checkout.with['persist-credentials'], false);
  assert.equal(workflowText.includes('persist-credentials: true'), false);
  assert.equal(workflowText.includes('contents: write'), false);
  assert.equal(workflowText.includes('id-token'), false);
  assert.equal(workflowText.includes('pull-requests: write'), false);
});

test('third-party actions are pinned to verified immutable SHAs and cache is off', () => {
  const uses = usesEntries(workflow);
  assert.deepEqual(uses, [
    `actions/checkout@${checkoutSha}`,
    `actions/setup-node@${setupNodeSha}`,
  ]);
  for (const entry of uses) {
    const sha = entry.split('@')[1];
    assert.match(sha, /^[0-9a-f]{40}$/);
  }
  assert.match(workflowText, new RegExp(`${checkoutSha} # v7\\.0\\.1`));
  assert.match(workflowText, new RegExp(`${setupNodeSha} # v7\\.0\\.0`));
  const setup = workflow.jobs['free-checks'].steps.find((step) => String(step.uses || '').startsWith('actions/setup-node@'));
  assert.equal(setup.with['node-version'], '24');
  assert.equal(setup.with['package-manager-cache'], false);
  assert.equal(setup.with.cache, undefined);
  assert.equal(workflowText.includes('actions/cache@'), false);
});

test('runner, bounds, and paid-tier exclusion stay on the free Linux path', () => {
  const free = workflow.jobs['free-checks'];
  const required = workflow.jobs.required;
  assert.equal(free['runs-on'], 'ubuntu-24.04');
  assert.equal(required['runs-on'], 'ubuntu-24.04');
  assert.equal(free['timeout-minutes'], 60);
  assert.equal(required['timeout-minutes'], 5);
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.match(String(workflow.concurrency.group), /ssve-free-checks-/);
  const runStep = free.steps.find((step) => step.run === 'bash scripts/ci/run-free-checks.sh');
  assert.equal(runStep.env.EVALS, '0');
  assert.equal(free.steps.some((step) => step.run === 'node --test test-framework/tests/oss-ci-workflow.test.mjs'), true);
  assert.equal(workflowText.includes('EVALS: "1"'), false);
  assert.equal(workflowText.includes('EVALS=1'), false);
  assert.equal(/larger|16core|gpu|macos-|windows-|self-hosted/i.test(workflowText), false);
});

test('stable required check fails on skipped, cancelled, or failed prerequisites', () => {
  const required = workflow.jobs.required;
  assert.equal(required.name, requiredCheckName);
  assert.equal(required.if, 'always()');
  assert.deepEqual(required.needs, ['free-checks']);
  const step = required.steps[0];
  assert.equal(step.env.FREE_CHECKS_RESULT, '${{ needs.free-checks.result }}');
  assert.match(step.run, /FREE_CHECKS_RESULT.*!= "success"/);
  assert.equal(required['continue-on-error'], undefined);
  assert.equal(workflowText.includes('continue-on-error'), false);
  assert.equal(workflowText.includes('!cancelled()'), false);

  for (const [result, expected] of [
    ['success', 0],
    ['failure', 1],
    ['cancelled', 1],
    ['skipped', 1],
    ['', 1],
  ]) {
    const probe = spawnSync('bash', ['-c', step.run], {
      encoding: 'utf8',
      env: {...process.env, FREE_CHECKS_RESULT: result},
    });
    assert.equal(probe.status, expected, `result=${result} stderr=${probe.stderr}`);
  }
});

test('wrapper refuses paid tiers and propagates command failures', () => {
  assert.match(wrapper, /^set -euo pipefail$/m);
  assert.match(wrapper, /EVALS=1/);
  assert.match(wrapper, /export EVALS=0/);
  assert.match(wrapper, /scripts\/lint-skills-manifest\.mjs/);
  assert.match(wrapper, /test-framework\/evals\/run-all-evals\.sh/);
  assert.doesNotMatch(wrapper, /\|\|\s*true/);
  assert.doesNotMatch(wrapper, /EVALS=1\s+bash test-framework/);
  const stat = fs.statSync(wrapperPath);
  assert.equal(stat.mode & 0o111, 0o111, 'wrapper must be executable');

  const paid = spawnSync('bash', [wrapperPath], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env, EVALS: '1', NODE_BIN: nodeBin},
  });
  assert.equal(paid.status, 2, paid.stderr + paid.stdout);
  assert.match(paid.stderr, /REFUSE: EVALS=1/);
  assert.doesNotMatch(paid.stdout + paid.stderr, /Tier 1\.5/);
});

test('Dependabot template targets GitHub Actions pins after live install', () => {
  assert.equal(dependabot.version, 2);
  assert.equal(dependabot.updates.length, 1);
  assert.equal(dependabot.updates[0]['package-ecosystem'], 'github-actions');
  assert.equal(dependabot.updates[0].directory, '/');
  assert.equal(dependabot.updates[0].schedule.interval, 'weekly');
});

test('activation checklist names hosted proof as pending and lists post-publication steps', () => {
  assert.match(activation, /hosted proof pending/i);
  assert.match(activation, /not an unlimited-free or future-pricing guarantee/i);
  assert.match(activation, /Confirm public visibility/);
  assert.match(activation, /\.github\/workflows\/ssve-checks\.yml/);
  assert.match(activation, /\.github\/dependabot\.yml/);
  assert.match(activation, /same-repo/);
  assert.match(activation, /fork/i);
  assert.match(activation, /SSVE Required/);
  assert.match(activation, /EVALS/);
  assert.doesNotMatch(activation, /hosted proof complete/i);
  assert.match(activation, /Do not call this a verified public release/i);
});
