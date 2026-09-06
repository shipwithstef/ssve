#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import * as provenance from '../../../scripts/lib/external-review-provenance.mjs';
import * as launcher from '../../../scripts/run-external-review.mjs';
import { createExternalReviewFixture } from './fixtures/external-review-fixture.mjs';
const frameworkRoot = path.resolve(import.meta.dirname, '../../..');
const tuple = { orchestrator: 'codex', host: 'cursor', family: 'xai', model: 'cursor-grok-4.6-high', effort: 'high' };

test('cycle capacity blocks before launch, preserves independent cycle scope, and leaves advisory review separate', () => {
  const previous = { ...process.env };
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-review-cap-'));
  try {
    process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE = '1';
    process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT = path.join(repo, 'authority');
    process.env.SVC_REVIEW_EVIDENCE_STORE = path.join(repo, 'objects');
    execFileSync('git', ['init', '-q', repo]);
    const receipt = { review_kind: 'plan', candidate_digest: 'a'.repeat(64), effective_tuple: tuple, phase_guard: { wi: 'WI-FIXTURE-CAP', pre_execution_base: 'b'.repeat(40) } };
    assert.equal(typeof provenance.externalReviewCycleCapacity, 'function');
    assert.equal(provenance.externalReviewCycleCapacity(receipt).remaining, 3);
    for (let i = 0; i < 3; i++) createExternalReviewFixture({ frameworkRoot, repo, reviewKind: 'plan', wi: 'WI-FIXTURE-CAP', tupleOverride: tuple, candidateDigestOverride: String(i + 1).repeat(64), preExecutionBaseOverride: 'b'.repeat(40), roundLabel: `round-${i}` });
    const full = provenance.externalReviewCycleCapacity(receipt);
    assert.equal(full.allowed, false);
    assert.equal(full.remaining, 0);
    assert.equal(full.issued, 3);
    assert.equal(provenance.externalReviewCycleCapacity({ ...receipt, candidate_digest: 'c'.repeat(64) }).allowed, false, 'changing plan bytes cannot reset cycle');
    assert.equal(provenance.externalReviewCycleCapacity({ ...receipt, phase_guard: { ...receipt.phase_guard, wi: 'WI-DISTINCT-TASK' } }).remaining, 3);
    assert.equal(provenance.externalReviewCycleCapacity({ ...receipt, effective_tuple: { ...tuple, family: 'openai', host: 'codex' } }), null, 'same-family advisory does not consume independent cap');
    assert.equal(path.dirname(full.lock_path), process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT);
  } finally { process.env = previous; fs.rmSync(repo, { recursive: true, force: true }); }
});

test('post-provider internal failure preserves the actual attempt, findings, tuple, usage, and non-approval status', () => {
  const original = {
    status: 'success', classification: 'success', finished_at: 'old',
    attempts: [{ index: 1, tuple, command: { binary: 'cursor-agent', argv: ['--model', tuple.model] }, artifacts: { findings: '/fixture/findings.json' }, usage: { inputTokens: 123 } }],
    requested_tuple: tuple, invocation_tuple: tuple, effective_tuple: tuple,
    protocol: { process_invocations: 1, reported_turns: 4, errors: [] },
    route: { kind: 'owner_config_primary', switching_enabled: false, cli_fallback_configured: false, evidence: 'requested_primary' },
    cache: { disposition: 'published', reusable: true, entry: '/fixture/cache' },
    artifacts: { findings: '/fixture/findings.json', package: '/fixture/package' },
    findings_sha256: 'd'.repeat(64), usage: { inputTokens: 123 },
  };
  assert.equal(typeof launcher.externalReviewFailureReceipt, 'function');
  const result = launcher.externalReviewFailureReceipt(original, '/fixture/error.txt');
  assert.equal(result.status, 'failure');
  assert.equal(result.classification, 'internal_failure');
  assert.deepEqual(result.attempts, original.attempts);
  assert.deepEqual(result.effective_tuple, tuple);
  assert.deepEqual(result.usage, original.usage);
  assert.equal(result.protocol.process_invocations, 1);
  assert.equal(result.protocol.reported_turns, 4);
  assert.equal(result.artifacts.provider_findings, original.artifacts.findings);
  assert.equal(result.artifacts.findings, null);
  assert.equal(result.findings_sha256, null);
  assert.equal(original.findings_sha256, 'd'.repeat(64));
  assert.equal(result.cache.reusable, false);
  assert.equal(result.route.kind, 'hard_failure');
  assert.equal(original.status, 'success', 'does not rewrite the original evidence object');
  assert.deepEqual(launcher.validateExternalReviewReceiptSemantics(result), []);
});

async function launcherFixture(t, rounds = 0) {
  const { createReviewerPolicy } = await import('../../../scripts/review-topology-v2.mjs');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-launch-cap-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const home = path.join(repo, 'home');
  const bin = path.join(repo, 'bin');
  const authority = path.join(home, '.svc/external-review-authority-v1');
  fs.mkdirSync(bin); fs.mkdirSync(home, { mode: 0o700 });
  const calls = path.join(home, 'paid-calls');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'home/\n.svc/\n');
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'Isolated offline test fixture.');
  fs.writeFileSync(path.join(bin, 'cursor-agent'), `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv.includes('--help')) console.log('--print --mode --output-format --model --sandbox --workspace --trust');
else if (process.argv.includes('--version')) console.log('2026.09-fixture');
else {
  fs.readFileSync(0); fs.appendFileSync(${JSON.stringify(calls)}, 'called\\n');
  if (process.env.SVC_TEST_DELAY_MS) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.SVC_TEST_DELAY_MS));
  if (process.env.SVC_TEST_POISON_ISSUANCE === '1') fs.chmodSync(${JSON.stringify(authority)}, 0o777);
  console.log(JSON.stringify({subtype:'success', usage:{inputTokens:123, outputTokens:45}, result:JSON.stringify({schema_version:1,review_kind:'plan',rubric_score:10,rubric_failures:[],dependencies_needing_read:[],reviewer:{host:'cursor',family:'xai',model:'cursor-grok-4.6-high',effort:'high'},verdict:'pass',summary:'Offline stub only',findings:[],certifications:[]})}));
}
`, { mode: 0o700 });
  const policy = createReviewerPolicy({ orchestrator: 'codex', self: { host: 'current', family: 'openai', model: 'gpt-6-astra', effort: 'medium' }, advisories: [], reviewer: { id: 'cursor', kind: 'external', required: true, authority: 'independent', identity_requirement: 'requested_accepted', tuple: { host: tuple.host, family: tuple.family, model: tuple.model, effort: tuple.effort } } });
  const config = path.join(home, 'policy.json');
  fs.writeFileSync(config, JSON.stringify(policy), { mode: 0o600 });
  const git = args => execFileSync('git', ['-C', repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();
  git(['init', '-q']); git(['add', '.']); git(['commit', '-qm', 'fixture']);
  const base = git(['rev-parse', 'HEAD']);
  const env = { PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: home, LANG: 'C.UTF-8', SVC_REVIEW_EVIDENCE_STORE: path.join(home, 'store'), SVC_EXTERNAL_REVIEW_CACHE_DIR: path.join(home, 'cache'), SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS: '10' };
  const previous = { ...process.env };
  try {
    process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE = '1';
    process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT = authority;
    process.env.SVC_REVIEW_EVIDENCE_STORE = env.SVC_REVIEW_EVIDENCE_STORE;
    for (let i = 0; i < rounds; i++) createExternalReviewFixture({ frameworkRoot, repo, reviewKind: 'plan', wi: 'WI-FIXTURE-LAUNCH', tupleOverride: tuple, candidateDigestOverride: String(i + 1).repeat(64), preExecutionBaseOverride: base, roundLabel: `seed-${i}` });
  } finally { process.env = previous; }
  const options = (label, extraEnv = {}) => {
    const digest = (label === 'one' ? 'a' : 'b').repeat(64);
    const binding = path.join(home, `binding-${label}.json`);
    fs.writeFileSync(binding, JSON.stringify({ wi: 'WI-FIXTURE-LAUNCH', pre_execution_base: base, plan_manifest_sha256: digest }));
    const out = path.join(repo, '.svc', `out-${label}`);
    return { args: [path.join(frameworkRoot, 'scripts/run-external-review.mjs'), '--orchestrator', 'codex', '--review-kind', 'plan', '--candidate-digest', digest, '--context-root', repo, '--reviewer-config', config, '--reviewer-phase', 'plan', '--reviewer-station', 'cursor', '--phase-binding', binding, '--artifacts-dir', out], options: { cwd: repo, env: { ...env, ...extraEnv }, input: `candidate_digest=${digest}\nOffline fixture`, encoding: 'utf8', timeout: 15000 }, out };
  };
  return { repo, home, authority, calls, options };
}

test('actual governed launcher refuses capped review without executing the provider stub', async t => {
  const { spawnSync } = await import('node:child_process');
  const f = await launcherFixture(t, 3);
  const run = f.options('one');
  const result = spawnSync(process.execPath, run.args, run.options);
  assert.equal(result.status, 1, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(path.join(run.out, 'receipt.json')));
  assert.equal(receipt.classification, 'budget_exhausted', result.stderr);
  assert.equal(receipt.protocol.process_invocations, 0);
  assert.equal(fs.existsSync(f.calls), false);
});

test('actual governed launcher retains provider evidence when provenance fails after the stub returns', async t => {
  const { spawnSync } = await import('node:child_process');
  const f = await launcherFixture(t);
  const run = f.options('one', { SVC_TEST_POISON_ISSUANCE: '1' });
  const result = spawnSync(process.execPath, run.args, run.options);
  assert.equal(result.status, 1, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(path.join(run.out, 'receipt.json')));
  assert.equal(receipt.classification, 'internal_failure', result.stderr);
  assert.equal(receipt.attempts.length, 1, result.stderr);
  assert.equal(receipt.protocol.process_invocations, 1);
  assert.equal(receipt.usage.inputTokens, 123);
  assert.equal(receipt.effective_tuple.model, tuple.model);
  assert.equal(receipt.cache.reusable, false);
  assert.ok(fs.existsSync(receipt.artifacts.provider_findings));
  const original = JSON.parse(fs.readFileSync(receipt.artifacts.pre_failure_receipt));
  assert.equal(original.protocol.process_invocations, 1);
  assert.equal(original.findings_sha256.length, 64);
  fs.chmodSync(f.authority, 0o700);
  const retry = f.options('one');
  retry.args[retry.args.length - 1] = path.join(f.repo, '.svc', 'retry');
  const retried = spawnSync(process.execPath, retry.args, retry.options);
  assert.equal(retried.status, 0, retried.stderr);
  assert.equal(fs.readFileSync(f.calls, 'utf8').trim().split('\n').length, 2,
    'a failed issuance cannot leave its unissued success receipt reusable in cache');
});

test('two simultaneous candidates share the remaining cycle slot', async t => {
  const { spawn } = await import('node:child_process');
  const f = await launcherFixture(t, 2);
  const run = label => new Promise((resolve, reject) => {
    const invocation = f.options(label);
    const child = spawn(process.execPath, invocation.args, { ...invocation.options, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.resume(); let stderr = ''; child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => {
      try { resolve({ code, stderr, receipt: JSON.parse(fs.readFileSync(path.join(invocation.out, 'receipt.json'))) }); }
      catch (error) { reject(error); }
    });
    child.stdin.end(invocation.options.input);
  });
  const results = await Promise.all([run('one'), run('two')]);
  assert.deepEqual(results.map(row => row.receipt.classification).sort(), ['budget_exhausted', 'success'], JSON.stringify(results));
  assert.deepEqual(results.map(row => row.code).sort(), [0, 1]);
  assert.equal(fs.readFileSync(f.calls, 'utf8').trim().split('\n').length, 1);
});

test('classification write failure leaves no signed marker or consumed cycle slot', async t => {
  const { spawnSync } = await import('node:child_process');
  const f = await launcherFixture(t);
  const hook = path.join(f.home, 'classification-failure.cjs');
  fs.writeFileSync(hook, `const fs=require('node:fs'); const original=fs.openSync; fs.openSync=function(file,...args){if(String(file).includes('/classifications/'))throw new Error('fixture classification preparation failure');return original.call(this,file,...args)};`);
  const invocation = f.options('one');
  const result = spawnSync(process.execPath, ['--require', hook, ...invocation.args], invocation.options);
  assert.equal(result.status, 1, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(path.join(invocation.out, 'receipt.json')));
  assert.equal(receipt.classification, 'internal_failure');
  assert.equal(receipt.protocol.process_invocations, 1);
  assert.deepEqual(fs.readdirSync(path.join(f.authority, 'issuance')).filter(file => file.endsWith('.json')), []);
});

test('fault after marker commit preserves the signed success bytes and reports issued evidence', async t => {
  const { spawnSync } = await import('node:child_process');
  const f = await launcherFixture(t);
  const hook = path.join(f.home, 'post-issuance-failure.cjs');
  fs.writeFileSync(hook, `const original=process.stdout.write; process.stdout.write=function(data,...args){if(String(data).includes('"ok":true'))throw new Error('fixture output failure after issuance');return original.call(this,data,...args)};`);
  const invocation = f.options('one');
  const result = spawnSync(process.execPath, ['--require', hook, ...invocation.args], invocation.options);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /issued review preserved/);
  assert.match(result.stderr, /receipt=/);
  const receiptPath = path.join(invocation.out, 'receipt.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath));
  assert.equal(receipt.status, 'success');
  assert.equal(receipt.classification, 'success');
  assert.equal(receipt.protocol.process_invocations, 1);
  assert.equal(fs.existsSync(path.join(invocation.out, 'pre-failure-receipt.json')), false);
  const previous = { ...process.env };
  try {
    process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE = '1';
    process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT = f.authority;
    const marker = provenance.verifyExternalReviewProvenance({ receiptPath, packagePath: receipt.artifacts.package, findingsPath: receipt.artifacts.findings });
    assert.equal(marker.request_id, receipt.request_id);
    assert.equal(provenance.externalReviewCycleCapacity(receipt).issued, 1);
  } finally { process.env = previous; }
});

test('single-candidate and cycle inventory survive deleted receipt paths; corrupt archive fails closed', async () => {
  const { getObject } = await import('../../../scripts/lib/review-evidence-store.mjs');
  const previous = { ...process.env };
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-archived-review-'));
  try {
    process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE = '1';
    process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT = path.join(repo, 'authority');
    process.env.SVC_REVIEW_EVIDENCE_STORE = path.join(repo, 'objects');
    execFileSync('git', ['init', '-q', repo]);
    const fixture = createExternalReviewFixture({ frameworkRoot, repo, reviewKind: 'plan', wi: 'WI-FIXTURE-ARCHIVE', tupleOverride: tuple, candidateDigestOverride: 'c'.repeat(64), preExecutionBaseOverride: 'b'.repeat(40) });
    const receipt = JSON.parse(fs.readFileSync(fixture.receiptPath));
    const before = provenance.listExternalReviewProvenance({ receiptPath: fixture.receiptPath, candidateDigest: fixture.candidateDigest, reviewKind: 'plan' });
    fs.unlinkSync(fixture.receiptPath);
    assert.deepEqual(provenance.listExternalReviewProvenance({ receiptPath: fixture.receiptPath, candidateDigest: fixture.candidateDigest, reviewKind: 'plan' }), before);
    assert.equal(provenance.externalReviewCycleCapacity(receipt).issued, 1);
    const object = getObject(before[0].receipt_sha256);
    fs.writeFileSync(object.path, 'tampered fixture bytes');
    assert.throws(() => provenance.listExternalReviewProvenance({ receiptPath: fixture.receiptPath, candidateDigest: fixture.candidateDigest, reviewKind: 'plan' }), /unavailable|digest|mismatch/);
    assert.throws(() => provenance.externalReviewCycleCapacity(receipt), /unavailable|digest|mismatch/);
  } finally { process.env = previous; fs.rmSync(repo, { recursive: true, force: true }); }
});

test('persistence reads unstaged changes, spaces/Unicode, rename destination, and skips deleted files', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-persistence-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'scripts'));
  fs.copyFileSync(path.join(frameworkRoot, 'scripts/verify-file-persistence.sh'), path.join(repo, 'scripts/verify-file-persistence.sh'));
  for (const file of ['unstaged Български.txt', 'rename source.txt', 'deleted.txt']) fs.writeFileSync(path.join(repo, file), 'original');
  const git = args => execFileSync('git', ['-C', repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', '-c', 'commit.gpgsign=false', ...args]);
  git(['init', '-q']); git(['add', '.']); git(['commit', '-qm', 'fixture']);
  fs.writeFileSync(path.join(repo, 'unstaged Български.txt'), 'changed');
  git(['mv', 'rename source.txt', 'renamed 新.txt']);
  git(['rm', '-q', 'deleted.txt']);
  fs.writeFileSync(path.join(repo, 'untracked spaces.txt'), 'new');
  const result = spawnSync('bash', ['scripts/verify-file-persistence.sh', '--from-git-status'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: 3 file\(s\)/);
});

test('issuance lock cleanup failure cannot unwind the committed marker', async t => {
  const f = await launcherFixture(t);
  const hook = path.join(f.home, 'lock-cleanup-failure.cjs');
  fs.writeFileSync(hook, `const fs=require('node:fs');const original=fs.unlinkSync;fs.unlinkSync=function(file,...args){if(String(file).endsWith('/issuance-sequence.lock'))throw new Error('fixture lock cleanup failure');return original.call(this,file,...args)};require('node:module').syncBuiltinESMExports();`);
  const invocation = f.options('one');
  const result = spawnSync(process.execPath, ['--require', hook, ...invocation.args], invocation.options);
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(fs.readFileSync(path.join(invocation.out, 'receipt.json')));
  assert.equal(receipt.status, 'success');
  assert.equal(receipt.protocol.process_invocations, 1);
  assert.ok(fs.existsSync(path.join(f.authority, 'issuance-sequence.lock')), 'fault actually leaves cleanup pending');
  const previous = { ...process.env };
  try {
    process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE = '1';
    process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT = f.authority;
    assert.equal(provenance.verifyExternalReviewProvenance({ receiptPath: path.join(invocation.out, 'receipt.json'), packagePath: receipt.artifacts.package, findingsPath: receipt.artifacts.findings }).request_id, receipt.request_id);
  } finally { process.env = previous; }
});

test('a cache replay cannot steal the slot held by an in-flight paid review', { timeout: 10000 }, async t => {
  const { spawn } = await import('node:child_process');
  const { setTimeout: delay } = await import('node:timers/promises');
  const f = await launcherFixture(t, 1);
  const seed = f.options('one');
  const seeded = spawnSync(process.execPath, seed.args, seed.options);
  assert.equal(seeded.status, 0, seeded.stderr);
  const asyncRun = invocation => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, invocation.args, { ...invocation.options, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.resume(); let stderr = ''; child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => {
      try { resolve({ code, stderr, receipt: JSON.parse(fs.readFileSync(path.join(invocation.out, 'receipt.json'))) }); }
      catch (error) { reject(error); }
    });
    child.stdin.end(invocation.options.input);
  });
  const paid = asyncRun(f.options('two', { SVC_TEST_DELAY_MS: '300' }));
  const deadline = Date.now() + 3000;
  while (fs.readFileSync(f.calls, 'utf8').trim().split('\n').length < 2 && Date.now() < deadline) await delay(10);
  assert.equal(fs.readFileSync(f.calls, 'utf8').trim().split('\n').length, 2, 'paid stub started with the last slot held');
  const replay = f.options('one');
  replay.out = path.join(f.repo, '.svc', 'cache-replay');
  replay.args[replay.args.length - 1] = replay.out;
  const [paidResult, cacheResult] = await Promise.all([paid, asyncRun(replay)]);
  assert.equal(paidResult.receipt.classification, 'success', paidResult.stderr);
  assert.equal(cacheResult.receipt.classification, 'budget_exhausted', cacheResult.stderr);
  assert.equal(cacheResult.receipt.protocol.process_invocations, 0);
  assert.equal(fs.readFileSync(f.calls, 'utf8').trim().split('\n').length, 2);
});


test('failed emergency recovery never retries cache mutation after releasing its lock', async t => {
  const f = await launcherFixture(t);
  const hook = path.join(f.home, 'emergency-retry-failure.cjs');
  const observed = path.join(f.home, 'emergency-attempts.jsonl');
  fs.writeFileSync(hook, `const fs=require('node:fs'); const promises=require('node:fs/promises');
const original=promises.writeFile;
promises.writeFile=async function(file,...args){
  if(String(file).endsWith('/internal-error.txt')) {
    const locks=fs.readdirSync(${JSON.stringify(path.join(f.home, 'cache/locks'))}).filter(name=>name.endsWith('.lock'));
    fs.appendFileSync(${JSON.stringify(observed)},JSON.stringify({locks})+'\\n');
    throw new Error('fixture recovery write failure');
  }
  return original.call(this,file,...args);
}; require('node:module').syncBuiltinESMExports();`);
  const invocation = f.options('one', { SVC_TEST_POISON_ISSUANCE: '1' });
  const result = spawnSync(process.execPath, ['--require', hook, ...invocation.args], invocation.options);
  assert.equal(result.status, 1, result.stderr);
  const attempts = fs.readFileSync(observed, 'utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(attempts.length, 1, 'recovery must not be retried by the outer unlocked handler');
  assert.equal(attempts[0].locks.length, 1, 'recovery ran with the cache lock held');
  assert.match(result.stderr, /recovery write failure/);
  assert.match(result.stderr, /process_invocations=1/);
  assert.ok(fs.existsSync(path.join(invocation.out, 'attempt-1-events.jsonl')), 'raw provider evidence remains available');
  assert.deepEqual(fs.readdirSync(path.join(f.authority, 'issuance')).filter(name=>name.endsWith('.json')), [], 'no approval issued');
});

async function planFixture(t) {
  const { validatePlanContract } = await import('../../../scripts/validate-plan-contract.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-plan-phase-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, '.gitignore'), 'manifest.md\nplan-contract.json\n.svc/\n');
  fs.writeFileSync(path.join(root, 'src/current.sh'), 'echo existing\n');
  fs.writeFileSync(path.join(root, 'src/unchanged.sh'), 'echo unrelated\n');
  const git = args => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();
  git(['init', '-q']); git(['add', '.']); git(['commit', '-qm', 'base']);
  const manifest = `# Plan
## Files Planned
| Task | Operation | Path |
|---|---|---|
| T1 | MODIFY | src/current.sh |
| T1 | CREATE | src/future.sh |
## Task Graph
Future script: \`src/future.sh\`. Rollback output: \`.svc/rollback.json\`.
## Execution Command Sequence
\`\`\`bash
bash src/current.sh
\`\`\`
## Prerequisite Alignment Matrix
| Requirement | Evidence |
|---|---|
| Local script | Fixture |
`;
  const contract = {
    schema_version: 1, base_sha: git(['rev-parse', 'HEAD']), manifest: 'manifest.md',
    ownership: [{ task: 'T1', paths: ['src/current.sh', 'src/future.sh'] }],
    resource_writers: [], risk_flags: ['external_state_writer'],
    external_writer: { immutable_baseline: '.svc/original.json', rolling_rollback: '.svc/rollback.json', read_failure_policy: 'abort', file_mode_preservation: 'retain mode' },
    claims: [{ kind: 'absence', denominator: 0, evidence: { artifact: 'manifest.md', verification: 'diff-manifest-parity' } }, { kind: 'unused', denominator: 0, evidence: { artifact: 'manifest.md', verification: 'executable-consumers' } }],
    executables: [{ path: 'src/future.sh', consumers: [{ path: 'src/current.sh', query: 'future.sh' }] }],
    resource_review: { verification: 'changed-executable-census', denominator: 2, disposition: 'no-risky-resource-writers', evidence: 'Inspect both script changes before release' },
  };
  const write = () => { fs.writeFileSync(path.join(root, 'manifest.md'), manifest); fs.writeFileSync(path.join(root, 'plan-contract.json'), JSON.stringify(contract)); };
  write();
  return { root, contract, manifest, write, validate: (value = contract, phase = 'plan') => validatePlanContract(value, { root, phase }) };
}

test('plan validates declared future work; default execution still requires actual implementation and consumer wiring', async t => {
  const f = await planFixture(t);
  assert.deepEqual(f.validate(), []);
  const { validatePlanContract } = await import('../../../scripts/validate-plan-contract.mjs');
  const before = validatePlanContract({ ...f.contract, phase: 'plan' }, { root: f.root });
  assert.ok(before.some(error => error.includes('executable does not exist')));
  assert.ok(before.some(error => error.includes('no actual change')));
  assert.ok(before.some(error => error.includes('no direct reference')));
  assert.ok(before.some(error => error.includes('changed-executable-census')));
  fs.writeFileSync(path.join(f.root, 'src/future.sh'), 'echo future\n');
  fs.writeFileSync(path.join(f.root, 'src/current.sh'), 'bash src/future.sh\n');
  assert.deepEqual(validatePlanContract(f.contract, { root: f.root }), []);
  assert.deepEqual(f.validate(), [], 'already-created task files remain valid during plan corrections');
  assert.deepEqual(f.validate(f.contract, 'unknown'), ['phase must be plan or execution']);
});

test('plan mode retains ownership, feasibility, risk, unchanged consumers, and direct evidence checks', async t => {
  const f = await planFixture(t);
  const copy = () => structuredClone(f.contract);
  let c = copy(); c.ownership.push({ task: 'T2', paths: ['src/**'] });
  assert.ok(f.validate(c).some(error => error.includes('overlap')));
  c = copy(); c.executables[0].consumers[0].path = 'src/unchanged.sh';
  assert.ok(f.validate(c).some(error => error.includes('no direct reference')));
  c = copy(); c.executables[0].consumers = ['src/current.sh'];
  assert.ok(f.validate(c).some(error => error.includes('no direct reference')), 'planned MODIFY needs an explicit future query');
  c = copy(); c.executables[0].path = 'src/unplanned.sh';
  assert.ok(f.validate(c).some(error => error.includes('executable does not exist')));
  c = copy(); c.risk_flags.push('runtime_concurrency');
  assert.ok(f.validate(c).some(error => error.includes('requires a concurrency section')));
  c = copy(); c.claims.push({ kind: 'complete', denominator: 1, evidence: { artifact: 'missing-ledger.json', verification: 'source-ledger-count' } });
  assert.ok(f.validate(c).some(error => error.includes('cannot verify source ledger')));
  fs.writeFileSync(path.join(f.root, 'manifest.md'), f.manifest.replace('MODIFY | src/current.sh', 'CREATE | src/current.sh'));
  assert.ok(f.validate().some(error => error.includes('CREATE path already exists in base')));
  fs.writeFileSync(path.join(f.root, 'manifest.md'), f.manifest);
  fs.unlinkSync(path.join(f.root, 'src/current.sh'));
  assert.ok(f.validate().some(error => error.includes('MODIFY path does not exist')));
});

test('declared future paths reject escaping symlinks and a file used as a directory', async t => {
  const f = await planFixture(t);
  fs.symlinkSync(os.tmpdir(), path.join(f.root, 'escape'));
  const bad = structuredClone(f.contract);
  bad.ownership[0].paths[1] = 'escape/future.sh';
  fs.writeFileSync(path.join(f.root, 'manifest.md'), f.manifest.replaceAll('src/future.sh', 'escape/future.sh'));
  assert.ok(f.validate(bad).some(error => error.includes('escapes repository')));
  bad.ownership[0].paths[1] = 'src/unchanged.sh/future.sh';
  fs.writeFileSync(path.join(f.root, 'manifest.md'), f.manifest.replaceAll('src/future.sh', 'src/unchanged.sh/future.sh'));
  assert.ok(f.validate(bad).some(error => /not a directory|ENOTDIR/.test(error)));
});

test('phase CLIs preserve optional root order, reject invalid flags, and mechanically defer only exact future outputs', async t => {
  const f = await planFixture(t);
  const contract = path.join(f.root, 'plan-contract.json');
  const manifest = path.join(f.root, 'manifest.md');
  const contractCli = path.join(frameworkRoot, 'scripts/validate-plan-contract.mjs');
  const mechanical = path.join(frameworkRoot, 'scripts/verify-plan-mechanical.sh');
  const invoke = (binary, entry, args) => spawnSync(binary, [entry, ...args], { cwd: f.root, encoding: 'utf8' });
  for (const args of [[f.root, '--phase', 'plan'], ['--phase', 'plan', f.root], ['--phase', 'plan']]) {
    for (const [binary, entry, file] of [[process.execPath, contractCli, contract], ['bash', mechanical, manifest]]) {
      const result = invoke(binary, entry, [file, ...args]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  }
  for (const args of [['--phase'], ['--phase', 'bad'], ['--phase', 'plan', '--phase', 'execution'], ['--unknown'], [f.root, f.root]]) {
    assert.equal(invoke(process.execPath, contractCli, [contract, ...args]).status, 2);
    assert.equal(invoke('bash', mechanical, [manifest, ...args]).status, 2);
  }
  assert.equal(invoke(process.execPath, contractCli, [contract]).status, 1);
  assert.equal(invoke('bash', mechanical, [manifest]).status, 1);
  fs.appendFileSync(manifest, '\nUnplanned reference: `src/typo.json`\n');
  const invalid = invoke('bash', mechanical, [manifest, '--phase', 'plan']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout, /C1-FAIL: path does not exist: src\/typo.json/);
});

test('offline fixture isolates host roots, strips ambient credentials/authority, blocks real providers, and preserves exit status', t => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-outer-home-'));
  t.after(() => fs.rmSync(outer, { recursive: true, force: true }));
  const sentinel = path.join(outer, 'live-install-sentinel');
  fs.writeFileSync(sentinel, 'unchanged');
  const probe = path.join(outer, 'probe.mjs');
  fs.writeFileSync(probe, `import fs from 'node:fs'; import {spawnSync} from 'node:child_process';
const keys=['ANTHROPIC_API_KEY','OPENAI_API_KEY','GH_TOKEN','SVC_REVIEWER_POLICY','SVC_APPROVED_WORKTREE_ROOTS','SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT','CODEX_HOME'];
const paths=['HOME','XDG_CONFIG_HOME','XDG_CACHE_HOME','XDG_STATE_HOME','XDG_RUNTIME_DIR','XDG_DATA_HOME','TMPDIR'].map(key=>process.env[key]);
const tmpGit=spawnSync('git',['-C',process.env.TMPDIR,'rev-parse','--show-toplevel'],{encoding:'utf8'});
const child=process.env.TMPDIR+'/child'; fs.mkdirSync(child);
const childInit=spawnSync('git',['init',child],{encoding:'utf8'});
const childGit=spawnSync('git',['-C',child,'rev-parse','--show-toplevel'],{encoding:'utf8'});
const provider=spawnSync('cursor-agent',['--print','must not reach a provider'],{encoding:'utf8'});
fs.writeFileSync(process.env.HOME+'/test-mutation','isolated');
console.log(JSON.stringify({leaked:keys.filter(key=>process.env[key]),paths,ceiling:process.env.GIT_CEILING_DIRECTORIES,child,childInitStatus:childInit.status,childGitStatus:childGit.status,childRoot:childGit.stdout.trim(),tmpGitStatus:tmpGit.status,providerStatus:provider.status,providerError:provider.stderr}));process.exitCode=23;`);
  for (const directory of ['.cache', '.claude', 'xdg-config', 'xdg-state']) fs.mkdirSync(path.join(outer, directory));
  const outerEntries = fs.readdirSync(outer, { recursive: true }).sort();
  const helper = path.join(frameworkRoot, 'test-framework/evals/tier-1/lib/fixture-home.sh');
  const result = spawnSync('bash', ['-c', 'source "$1"; svc_run_fixture node "$2"', '_', helper, probe], {
    env: { ...process.env, HOME: outer, XDG_CONFIG_HOME: path.join(outer, 'xdg-config'), XDG_CACHE_HOME: path.join(outer, '.cache'), XDG_STATE_HOME: path.join(outer, 'xdg-state'), ANTHROPIC_API_KEY: 'fixture-key', OPENAI_API_KEY: 'fixture-key', GH_TOKEN: 'fixture-token', SVC_REVIEWER_POLICY: '/outside/policy', SVC_APPROVED_WORKTREE_ROOTS: '/outside', SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT: '/outside/authority', CODEX_HOME: '/outside/codex' }, encoding: 'utf8',
  });
  assert.deepEqual(fs.readdirSync(outer, { recursive: true }).sort(), outerEntries, 'operator HOME/XDG entries remain untouched');
  assert.equal(result.status, 23, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.leaked, []);
  assert.equal(data.ceiling, '/tmp');
  assert.notEqual(data.tmpGitStatus, 0, 'disposable temporary directories cannot inherit a parent repository');
  assert.equal(data.childInitStatus, 0);
  assert.equal(data.childGitStatus, 0);
  assert.equal(data.childRoot, data.child);
  assert.equal(new Set(data.paths).size, data.paths.length);
  assert.ok(data.paths.every(value => value && value !== outer && !fs.existsSync(value)), 'fixture roots cleaned after a failing validator');
  assert.equal(data.providerStatus, 78);
  assert.match(data.providerError, /SVC-OFFLINE-PROVIDER/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'unchanged');
  assert.equal(fs.existsSync(path.join(outer, 'test-mutation')), false);
});

test('Git discovery ceiling excludes synthetic parent repository and preserves nested repositories', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-git-ceiling-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const ceiling = path.join(root, 'temp');
  const scratch = path.join(ceiling, 'scratch');
  fs.mkdirSync(scratch, { recursive: true });
  const git = (args, extra = {}) => spawnSync('git', args, { encoding: 'utf8', env: { ...process.env, ...extra } });
  assert.equal(git(['init', root]).status, 0);
  assert.equal(git(['-C', scratch, 'rev-parse', '--show-toplevel'], { GIT_CEILING_DIRECTORIES: '' }).stdout.trim(), root);
  const env = { GIT_CEILING_DIRECTORIES: ceiling };
  assert.notEqual(git(['-C', scratch, 'rev-parse', '--show-toplevel'], env).status, 0);
  assert.equal(git(['init', scratch], env).status, 0);
  assert.equal(git(['-C', scratch, 'rev-parse', '--show-toplevel'], env).stdout.trim(), scratch);
});

test('aggregate runner records isolated failures and duration without GNU date nanoseconds', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-runner-clock-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const bin = path.join(temporary, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'date'), '#!/bin/sh\nprintf "1700000000N\\n"\n', { mode: 0o700 });
  const script = path.join(temporary, 'validator.sh');
  fs.writeFileSync(script, '#!/bin/bash\n[[ "$SVC_TIER1_FIXTURE_HOME" == "$HOME" ]] || exit 91\nexit 23\n');
  const results = path.join(temporary, 'results'); fs.mkdirSync(results);
  const source = fs.readFileSync(path.join(frameworkRoot, 'test-framework/evals/run-all-evals.sh'), 'utf8');
  const definition = source.match(/^_tier1_run_one\(\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(definition);
  const result = spawnSync('bash', ['-s', '--', script], {
    input: `set -euo pipefail\n${definition}\n_tier1_run_one "$1"\n`,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TIER1_RESULTS_DIR: results, VALIDATOR_TIMEOUT_SEC: '10', SCRIPT_DIR: path.join(frameworkRoot, 'test-framework/evals') }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(results, 'validator.sh.rc'), 'utf8'), '23');
  assert.match(fs.readFileSync(path.join(results, 'validator.sh.duration-ms'), 'utf8'), /^\d+$/);
});

test('runner summary binds dirty source and actual outcomes without certifying changed inputs', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-runner-summary-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const repo = path.join(temporary, 'repo');
  const evals = path.join(repo, 'test-framework/evals');
  fs.mkdirSync(path.join(evals, 'tier-1/lib'), { recursive: true });
  for (const file of ['run-all-evals.sh', 'tier-1/lib/fixture-home.sh']) fs.copyFileSync(path.join(frameworkRoot, 'test-framework/evals', file), path.join(evals, file));
  const validator = path.join(evals, 'tier-1/validate-fixture.sh');
  fs.writeFileSync(validator, '#!/bin/bash\necho fixture-failure\nexit 23\n');
  fs.writeFileSync(path.join(repo, 'input.txt'), 'baseline');
  const git = args => execFileSync('git', ['-C', repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args]);
  git(['init', '-q']); git(['add', '.']); git(['commit', '-qm', 'fixture']);
  const output = path.join(temporary, 'summary.json');
  const run = destination => spawnSync('bash', [path.join(evals, 'run-all-evals.sh')], { cwd: repo, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, EVALS: '0', FLAKE_CHECK: '0', SVC_TIER1_MODE: 'full', SVC_TIER1_CHANGED_FILES: '', SVC_TIER1_SUMMARY: destination, TIER1_JOBS: '1' } });
  let result = run(output);
  assert.equal(result.status, 1, result.stderr);
  let summary = JSON.parse(fs.readFileSync(output));
  assert.equal(summary.inputs_stable, true);
  assert.deepEqual(summary.totals, { passed: 0, failed: 1, timed_out: 0 });
  assert.equal(summary.validators[0].exit_code, 23);
  assert.ok(summary.validators[0].duration_ms >= 0);
  assert.equal(summary.before.head, git(['rev-parse', 'HEAD']).toString().trim());
  const firstHash = summary.before.source_sha256;
  fs.writeFileSync(path.join(repo, 'input.txt'), 'dirty');
  result = run(output);
  assert.equal(result.status, 1, result.stderr);
  summary = JSON.parse(fs.readFileSync(output));
  assert.equal(summary.inputs_stable, true);
  assert.notEqual(summary.before.source_sha256, firstHash, 'dirty bytes matter even at same HEAD');
  fs.writeFileSync(validator, '#!/bin/bash\nprintf changed > "$(dirname "$0")/mutated.txt"\n');
  result = run(output);
  assert.equal(result.status, 0, result.stderr);
  summary = JSON.parse(fs.readFileSync(output));
  assert.equal(summary.inputs_stable, false, 'source mutation during validator is visible');
  assert.equal(summary.totals.passed, 1);
  const original = fs.readFileSync(path.join(repo, 'input.txt'));
  result = run(path.join(repo, 'input.txt'));
  assert.notEqual(result.status, 0, 'tracked source cannot be a summary destination');
  assert.deepEqual(fs.readFileSync(path.join(repo, 'input.txt')), original);
  result = run(path.join(repo, 'untracked-summary.json'));
  assert.notEqual(result.status, 0, 'unignored summary would contaminate its own input identity');
});

test('receipt inventory distinguishes digest metadata without accepting malformed or untyped receipts', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-receipt-index-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', repo]);
  fs.mkdirSync(path.join(repo, 'schemas/receipts'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'schemas/receipts/review-plan.schema.json'), '{}');
  const receipts = path.join(repo, '.svc/receipts/abc123'); fs.mkdirSync(receipts, { recursive: true });
  fs.writeFileSync(path.join(receipts, 'review-plan.json'), JSON.stringify({ receipt_type: 'review-plan' }));
  const index = path.join(receipts, 'digests.json');
  const run = () => spawnSync('bash', [path.join(frameworkRoot, 'test-framework/evals/tier-1/validate-chain-receipts-schema.sh')], { cwd: repo, encoding: 'utf8' });
  fs.writeFileSync(index, JSON.stringify({ 'review-plan::WI-FIXTURE': 'a'.repeat(64) }));
  assert.equal(run().status, 0);
  fs.writeFileSync(index, JSON.stringify({ 'review-plan::WI-FIXTURE': 'not-a-digest' }));
  assert.notEqual(run().status, 0, 'known metadata filename is not a blanket exemption');
  fs.writeFileSync(index, JSON.stringify({ 'unknown-type::WI-FIXTURE': 'a'.repeat(64) }));
  assert.notEqual(run().status, 0, 'unknown schema family fails');
  fs.writeFileSync(index, JSON.stringify({ 'review-plan::WI-FIXTURE': 'sha256:' + 'a'.repeat(64) }));
  fs.writeFileSync(path.join(receipts, 'untyped.json'), '{}');
  assert.notEqual(run().status, 0, 'other JSON still needs receipt type');
});

test('parallel stamp, refresh and router validators leave shared source bytes and mtimes untouched', async () => {
  const { promisify } = await import('node:util');
  const { execFile } = await import('node:child_process');
  const crypto = await import('node:crypto');
  const run = promisify(execFile);
  const paths = ['skills-manifest.json', '.svc/manifest-digest.json', 'references/skill-routing-index.json', 'references/knowledge/domains/startup-saas-finance/.version', '.svc/skill-router/decisions.jsonl'];
  const snapshot = () => paths.map(relative => {
    const file = path.join(frameworkRoot, relative);
    if (!fs.existsSync(file)) return { relative, absent: true };
    const stat = fs.statSync(file);
    return { relative, mode: stat.mode, mtimeMs: stat.mtimeMs, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  });
  const before = snapshot();
  const results = await Promise.allSettled(['validate-manifest-integrity-stamp.sh', 'validate-knowledge-refresh-scan.sh', 'validate-skill-router.sh'].map(name => run('bash', [path.join(frameworkRoot, 'test-framework/evals/tier-1', name)], { cwd: frameworkRoot, timeout: 20000, maxBuffer: 1024 * 1024 })));
  assert.deepEqual(snapshot(), before, 'even restored temporary writes would change mtime');
  for (const result of results) assert.equal(result.status, 'fulfilled', result.reason?.stderr || result.reason?.message);
});
