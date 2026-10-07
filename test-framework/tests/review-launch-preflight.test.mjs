import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyProviderFailure, validateExternalReviewReceiptSemantics, agenticReviewInstructions, normalizeReviewFindings, invoke, reviewTreeSnapshot } from '../../scripts/run-external-review.mjs';
import { createReviewerPolicy } from '../../scripts/review-topology-v2.mjs';
import { cursorIndependentEligible } from '../../scripts/resolve-dispatch.mjs';
import { cursorCatalogDecision, cursorIndependentModelShape, cursorExactRouteEvidenceValid, resolveReviewTimeout } from '../../scripts/lib/review-launch-preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const self = { host: 'current', family: 'openai', model: 'gpt-6-astra', effort: 'medium' };
const reviewer = (model = 'grok-4.7-high', family = 'xai', authority = 'independent') => ({
  id: 'cursor', kind: 'external', required: true, authority,
  identity_requirement: 'requested_accepted',
  tuple: { host: 'cursor', family, model, effort: 'high' },
});
const options = r => ({ orchestrator: 'codex', self, reviewer: r });
const catalog = 'Available models\ngrok-4.7-high - Grok 4.7 High\nclaude-opus-5-5-high - Claude Opus 5.5 High\nclaude-4.6-opus-high - Claude Opus 4.6 1M\nauto - Auto\n';

test('Claude terminal auth envelope wins over subtype success', () => {
  const loggedOut = { type: 'result', subtype: 'success', is_error: true, terminal_reason: 'api_error',
    api_error_status: null, result: 'Not logged in · Please run /login', modelUsage: {} };
  assert.equal(classifyProviderFailure(JSON.stringify(loggedOut), '', false), 'authentication');
  assert.equal(classifyProviderFailure(JSON.stringify({ ...loggedOut, is_error: false }), '', false), 'unknown_provider');
  assert.equal(classifyProviderFailure(JSON.stringify({ type: 'result', is_error: true, terminal_reason: 'timeout' }), '', false), 'timeout');
});

test('Cursor independence follows exact provider shape and live catalog', () => {
  assert.equal(cursorIndependentEligible(reviewer()), true);
  assert.equal(cursorIndependentEligible(reviewer('claude-opus-5-5-high', 'anthropic')), true);
  assert.equal(cursorIndependentEligible(reviewer('claude-4.6-opus-high', 'anthropic')), true);
  assert.equal(cursorIndependentEligible(reviewer('future-unknown-high', 'xai')), true);
  assert.equal(cursorIndependentEligible(reviewer('grok-4.7-high', 'anthropic')), true);
  assert.equal(cursorIndependentEligible(reviewer('grok-4.7-medium', 'xai')), false);
  assert.doesNotThrow(() => createReviewerPolicy(options(reviewer('future-unknown-high', 'xai'))));
  assert.equal(cursorCatalogDecision(catalog, reviewer().tuple).ok, true);
  assert.equal(cursorCatalogDecision(catalog, reviewer('claude-opus-5-5-high', 'anthropic').tuple).ok, true);
  assert.equal(cursorCatalogDecision(catalog, reviewer('claude-4.6-opus-high', 'anthropic').tuple).ok, true);
  assert.equal(cursorCatalogDecision(catalog, reviewer('grok-4.7-high', 'anthropic').tuple).classification, 'model_mismatch');
  assert.equal(cursorCatalogDecision(catalog, reviewer('grok-9.9-high', 'xai').tuple).classification, 'model_unavailable');
  assert.equal(cursorCatalogDecision('future-high - Unknown Provider', reviewer('future-high', 'unknown', 'advisory').tuple, 'advisory').ok, true);
});

test('Cursor effort matching treats owner configuration as data, not a regular expression', () => {
  const tuple = reviewer().tuple;
  for (const effort of ['.*', 'high|low', '(', '(a+)+$', '', null]) {
    assert.equal(cursorIndependentModelShape({ ...tuple, effort }), false);
  }
  assert.equal(cursorIndependentModelShape({ ...tuple, model: 'future-high-fast' }), true);
  assert.equal(cursorIndependentModelShape({ ...tuple, model: 'future-high-other' }), false);
});

test('historical Cursor plan-mode evidence is readable only under launcher 2.5.7 rules', () => {
  const old = { launcher_version: '2.5.7', invocation_tuple: { model: 'cursor-grok-4.6-high' },
    model_attestation: { evidence: 'cursor_plan_mode_exact_model_argv_plus_successful_json_exit_no_server_model_echo' },
    attempts: [{ tuple: { host: 'cursor', model: 'cursor-grok-4.6-high' }, command: { binary: 'cursor-agent', argv: ['--print', '--mode', 'plan', '--output-format', 'json', '--model', 'cursor-grok-4.6-high'] } }] };
  assert.equal(cursorExactRouteEvidenceValid(old), true);
  assert.equal(cursorExactRouteEvidenceValid({ ...old, launcher_version: '2.5.8' }), false);
  assert.equal(cursorExactRouteEvidenceValid({ ...old, attempts: [{ command: { ...old.attempts[0].command, argv: ['--print', '--mode', 'ask', '--output-format', 'json', '--model', 'cursor-grok-4.6-high'] } }] }), false);
  assert.equal(cursorExactRouteEvidenceValid({ ...old, invocation_tuple: { model: 'other-high' } }), false);
  const current = structuredClone(old);
  current.launcher_version = '2.5.8';
  current.model_attestation.evidence = 'cursor_catalog_exact_model_plus_ask_mode_success_no_server_model_echo';
  current.attempts[0].command.binary = '/fixture/cursor-agent';
  current.attempts[0].command.argv[2] = 'ask';
  assert.equal(cursorExactRouteEvidenceValid(current), true);
  const wrongMode = structuredClone(current);
  wrongMode.attempts[0].command.argv[2] = 'plan';
  assert.equal(cursorExactRouteEvidenceValid(wrongMode), false);
  const wrongModel = structuredClone(current);
  wrongModel.attempts[0].command.argv[6] = 'other-model';
  assert.equal(cursorExactRouteEvidenceValid(wrongModel), false);
  const duplicateModel = structuredClone(current);
  duplicateModel.attempts[0].command.argv.push('--model', 'other-model');
  assert.equal(cursorExactRouteEvidenceValid(duplicateModel), false);
});

test('review timeout precedence and lock lifetime follow the selected host', () => {
  const transportOptions = { grok: { timeout_seconds: 2400 }, cursor: { timeout_seconds: 1801 } };
  assert.deepEqual(resolveReviewTimeout({ host: 'claude', transportOptions }), { seconds: 1800, source: 'framework-default', staleSeconds: 3660 });
  assert.deepEqual(resolveReviewTimeout({ host: 'grok', transportOptions }), { seconds: 2400, source: 'owner-policy', staleSeconds: 4860 });
  assert.deepEqual(resolveReviewTimeout({ host: 'cursor', transportOptions }), { seconds: 1801, source: 'owner-policy', staleSeconds: 3662 });
  assert.deepEqual(resolveReviewTimeout({ host: 'grok', transportOptions, environment: { SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS: '7' } }), { seconds: 7, source: 'environment', staleSeconds: 3660 });
  assert.throws(() => resolveReviewTimeout({ host: 'grok', transportOptions, environment: { SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS: '4859' } }), /at least 4860/);
  assert.throws(() => resolveReviewTimeout({ host: 'grok', transportOptions: { grok: { timeout_seconds: 7201 } } }), /1 to 7200/);
  assert.throws(() => resolveReviewTimeout({ host: 'grok', transportOptions, environment: { SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS: 'bad' } }), /SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS/);
});

test('secure writer creates complete policy and refuses insecure parent', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-review-policy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'input.json');
  fs.writeFileSync(input, JSON.stringify(options(reviewer())));
  const file = path.join(dir, 'owner', 'reviewer-policy-v2.json');
  const created = spawnSync('node', [path.join(root, 'scripts/review-topology-v2.mjs'), 'create-policy', '--input', input, '--out', file], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);
  const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  for (const phase of ['plan', 'exec']) {
    const stations = policy.modes.production.orchestrators.codex[phase].stations;
    assert.equal(stations[0].kind, 'inline-self');
    assert.equal(stations.at(-1).id, 'cursor');
  }
  const bad = path.join(dir, 'bad');
  fs.mkdirSync(bad, { mode: 0o755 });
  const refused = spawnSync('node', [path.join(root, 'scripts/review-topology-v2.mjs'), 'create-policy', '--input', input, '--out', path.join(bad, 'policy.json')], { encoding: 'utf8' });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /mode 0700/);
});

test('Cursor exact model launches ask mode with catalog-bound receipt', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-review-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q', dir]);
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'Fixture review.');
  const config = path.join(dir, 'policy.json');
  fs.writeFileSync(config, JSON.stringify(createReviewerPolicy({ ...options(reviewer()), transport_options: { cursor: { timeout_seconds: 1801 }, grok: { timeout_seconds: 2400 } } })), { mode: 0o600 });
  const binary = path.join(dir, 'cursor-agent');
  const calls = path.join(dir, 'calls.jsonl');
  const findings = { schema_version: 1, review_kind: 'generic', rubric_score: 10,
    rubric_failures: null, dependencies_needing_read: null,
    reviewer: reviewer().tuple, verdict: 'pass', summary: 'Reviewed fixture',
    findings: [], certifications: [] };
  const script = [
    '#!/usr/bin/env node',
    "const fs=require('node:fs');",
    "const a=process.argv.slice(2);fs.appendFileSync(process.env.SVC_TEST_CALLS,JSON.stringify(a)+'\\n');",
    "if(a.includes('--help'))console.log('--print --output-format --mode --model --sandbox --workspace --trust --list-models');",
    "else if(a.includes('--version'))console.log('fixture-cursor');",
    "else if(a.includes('--list-models')){if(process.env.SVC_TEST_CATALOG_ERROR){console.error('unknown option --list-models');process.exit(2)}console.log(process.env.SVC_TEST_CATALOG);}",
    "else {fs.readFileSync(0);console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:process.env.SVC_TEST_FINDINGS}));}",
  ].join('\n');
  fs.writeFileSync(binary, script, { mode: 0o700 });
  const env = { ...process.env, SVC_EXTERNAL_REVIEW_FIXTURE: '1', SVC_EXTERNAL_REVIEW_FIXTURE_ROOT: dir,
    SVC_EXTERNAL_REVIEW_CURSOR_BIN: binary, SVC_EXTERNAL_REVIEW_CACHE_DIR: path.join(dir, 'cache'),
    SVC_EXTERNAL_REVIEW_POLICY_DIR: path.join(dir, 'selection'), SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS: '',
    SVC_TEST_CALLS: calls, SVC_TEST_CATALOG: catalog, SVC_TEST_FINDINGS: JSON.stringify(findings) };
  const out = path.join(dir, 'out');
  const run = spawnSync('node', [path.join(root, 'scripts/run-external-review.mjs'), '--orchestrator', 'codex',
    '--review-kind', 'generic', '--candidate-digest', 'a'.repeat(64), '--context-root', dir,
    '--reviewer-config', config, '--reviewer-phase', 'exec', '--reviewer-station', 'cursor',
    '--artifacts-dir', out], { env, cwd: dir, input: 'candidate_digest=' + 'a'.repeat(64) + '\nReview fixture', encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const receipt = JSON.parse(fs.readFileSync(path.join(out, 'receipt.json'), 'utf8'));
  assert.equal(receipt.classification, 'success');
  assert.equal(receipt.protocol.configured_timeout_seconds, 1801);
  assert.equal(receipt.protocol.configured_timeout_source, 'owner-policy');
  assert.equal(receipt.protocol.configured_lock_stale_seconds, 3662);
  assert.deepEqual(receipt.requested_tuple, { orchestrator: 'codex', ...reviewer().tuple });
  assert.equal(receipt.model_attestation.level, 'requested_accepted');
  assert.match(receipt.model_attestation.evidence, /catalog_exact_model_plus_ask_mode/);
  assert.deepEqual(validateExternalReviewReceiptSemantics(receipt), []);
  for (const [flag, replacement] of [['--mode', 'plan'], ['--model', 'other-model']]) {
    const forged = structuredClone(receipt);
    const args = forged.attempts.at(-1).command.argv;
    args[args.indexOf(flag) + 1] = replacement;
    assert.ok(validateExternalReviewReceiptSemantics(forged).includes('Cursor exact-route evidence missing'));
  }
  const argv = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(argv.some(a => a.includes('--list-models')));
  assert.ok(argv.some(a => a.includes('--print') && a.includes('ask') && a.includes('grok-4.7-high')));
  assert.ok(!argv.some(a => a.includes('--print') && a.includes('plan')));
  const envOverride = spawnSync('node', [path.join(root, 'scripts/run-external-review.mjs'), '--orchestrator', 'codex',
    '--review-kind', 'generic', '--candidate-digest', 'd'.repeat(64), '--context-root', dir,
    '--reviewer-config', config, '--reviewer-phase', 'exec', '--reviewer-station', 'cursor',
    '--artifacts-dir', path.join(dir, 'env-override')], { env: { ...env, SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS: '7' }, cwd: dir,
    input: 'candidate_digest=' + 'd'.repeat(64) + '\nReview fixture', encoding: 'utf8' });
  assert.equal(envOverride.status, 0, envOverride.stderr);
  const overridden = JSON.parse(fs.readFileSync(path.join(dir, 'env-override', 'receipt.json')));
  assert.equal(overridden.protocol.configured_timeout_seconds, 7);
  assert.equal(overridden.protocol.configured_timeout_source, 'environment');
  assert.equal(overridden.protocol.configured_lock_stale_seconds, 3660);
  const malformed = spawnSync('node', [path.join(root, 'scripts/run-external-review.mjs'), '--orchestrator', 'codex',
    '--review-kind', 'generic', '--candidate-digest', 'a'.repeat(40), '--context-root', dir,
    '--reviewer-config', config, '--reviewer-phase', 'exec', '--reviewer-station', 'cursor',
    '--artifacts-dir', path.join(dir, 'malformed')], { env, cwd: dir, input: 'Review fixture', encoding: 'utf8' });
  assert.equal(malformed.status, 1, malformed.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'malformed', 'receipt.json')), malformed.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'malformed', 'receipt.json'))).classification, 'input_invalid');
  assert.match(malformed.stderr, /64-character.*40-character/);
  const before = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse).filter(a => a.includes('--print')).length;
  const unsupported = spawnSync('node', [path.join(root, 'scripts/run-external-review.mjs'), '--orchestrator', 'codex',
    '--review-kind', 'generic', '--candidate-digest', 'b'.repeat(64), '--context-root', dir,
    '--reviewer-config', config, '--reviewer-phase', 'exec', '--reviewer-station', 'cursor',
    '--artifacts-dir', path.join(dir, 'unsupported')], { env: { ...env, SVC_TEST_CATALOG_ERROR: '1' }, cwd: dir,
    input: 'candidate_digest=' + 'b'.repeat(64) + '\nReview fixture', encoding: 'utf8' });
  assert.equal(unsupported.status, 1, unsupported.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'unsupported', 'receipt.json'))).classification, 'capability');
  const after = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse).filter(a => a.includes('--print')).length;
  assert.equal(after, before, 'unsupported catalog command must not launch a reviewer');
  const unlisted = spawnSync('node', [path.join(root, 'scripts/run-external-review.mjs'), '--orchestrator', 'codex',
    '--review-kind', 'generic', '--candidate-digest', 'c'.repeat(64), '--context-root', dir,
    '--reviewer-config', config, '--reviewer-phase', 'exec', '--reviewer-station', 'cursor',
    '--artifacts-dir', path.join(dir, 'unlisted')], { env: { ...env, SVC_TEST_CATALOG: 'other-high - Grok Other High\n' }, cwd: dir,
    input: 'candidate_digest=' + 'c'.repeat(64) + '\nReview fixture', encoding: 'utf8' });
  assert.equal(unlisted.status, 1, unlisted.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'unlisted', 'receipt.json'))).classification, 'model_unavailable');
  const paidCalls = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse).filter(a => a.includes('--print')).length;
  assert.equal(paidCalls, before, 'unlisted exact model must not launch a reviewer');
  fs.writeFileSync(config, JSON.stringify(createReviewerPolicy({ ...options(reviewer()), transport_options: { cursor: { timeout_seconds: 'invalid' } } })));
  const invalidTimeout = spawnSync('node', [path.join(root, 'scripts/run-external-review.mjs'), '--orchestrator', 'codex',
    '--review-kind', 'generic', '--candidate-digest', 'e'.repeat(64), '--context-root', dir,
    '--reviewer-config', config, '--reviewer-phase', 'exec', '--reviewer-station', 'cursor',
    '--artifacts-dir', path.join(dir, 'invalid-timeout')], { env, cwd: dir,
    input: 'candidate_digest=' + 'e'.repeat(64) + '\nReview fixture', encoding: 'utf8' });
  assert.equal(invalidTimeout.status, 1, invalidTimeout.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'invalid-timeout', 'receipt.json'))).classification, 'config_invalid');
  assert.match(invalidTimeout.stderr, /transport_options.cursor.timeout_seconds/);
  assert.equal(fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse).filter(a => a.includes('--print')).length, before);
});


test('agentic packet requires the unchanged caller and cost path, then bounded fix verification', () => {
  // Seed: the changed helper accepts zero, but an unchanged caller divides by its return.
  // This deterministic test proves packet scope, not actual paid-model discovery.
  const packet = agenticReviewInstructions('/candidate');
  for (const required of ['ENTRY POINT', 'whole touched files', 'callers/callees', 'callers outside the diff', 'config/routes', 'related tests', 'cost path', 'unchanged model defaults', 'Read-only contract']) assert.ok(packet.includes(required), required);
  const followup = agenticReviewInstructions('/candidate', 2);
  assert.match(followup, /original finding IDs/);
  assert.match(followup, /adjacent breakage caused by these fixes/);
  assert.match(followup, /No whole-feature discovery/);
});

test('unproved blocker is advisory with the raw claim retained; concrete proof remains blocking', () => {
  const raw = {id:'H1', severity:'high', confidence:'high', location:'caller.mjs:4', claim:'Might divide by zero', analysis:'Concern', evidence:[], proposed_fix:'Guard'};
  const report = {verdict:'fail', findings:[raw], certifications:[], rubric_failures:[], dependencies_needing_read:[]};
  const normalized = normalizeReviewFindings(report);
  assert.equal(normalized.findings[0].blocking, false);
  assert.equal(normalized.findings[0].disposition, 'advisory');
  assert.equal(normalized.findings[0].severity, 'info');
  assert.deepEqual(JSON.parse(normalized.findings[0].raw_finding), raw);
  assert.equal(normalized.verdict, 'pass-with-findings');
  const proof = {kind:'input-output', input:'0', actual:'Infinity', expected:'0'};
  assert.equal(normalizeReviewFindings({...report, findings:[{...raw, proof}]}).findings[0].blocking, true);
  assert.equal(normalizeReviewFindings({...report, findings:[{...raw, proof:{kind:'call-path', path:'caller → helper'}}]}).findings[0].blocking, false);
});

test('Codex shell reads succeed with VM bypass; edits invalidate review and preserve dirty work', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv1-codex-readonly-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const repo = path.join(dir, 'repo'), artifacts = path.join(dir, 'artifacts');
  fs.mkdirSync(repo); fs.mkdirSync(artifacts);
  const git = (...args) => {const r=spawnSync('git', args, {cwd:repo, encoding:'utf8'}); assert.equal(r.status,0,r.stderr);};
  git('init', '-q'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Fixture');
  fs.writeFileSync(path.join(repo,'helper.mjs'), 'export const denominator = 0;\n');
  fs.writeFileSync(path.join(repo,'caller.mjs'), 'import {denominator} from "./helper.mjs"; console.log(1 / denominator);\n');
  git('add','.'); git('commit','-qm','Seed caller outside diff');
  fs.appendFileSync(path.join(repo,'helper.mjs'), '// pre-existing dirty work\n');
  const before = reviewTreeSnapshot(repo);
  const cli = path.join(dir,'codex');
  fs.writeFileSync(cli, `#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const args=process.argv.slice(2),prompt=fs.readFileSync(0,'utf8');
if(!args.includes('--dangerously-bypass-approvals-and-sandbox') || args.includes('--sandbox') || !prompt.includes('Read-only contract'))process.exit(9);
const caller=fs.readFileSync('caller.mjs','utf8');
if(!caller.includes('1 / denominator'))process.exit(10);
if(prompt.includes('MUTATE'))fs.appendFileSync('helper.mjs','// reviewer edit\\n');
fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify({schema_version:1,review_kind:'exec',rubric_score:null,rubric_failures:[],dependencies_needing_read:[],reviewer:{host:'codex',family:'openai',model:'gpt-6.1-sol',effort:'high'},verdict:'pass',summary:'Read caller',findings:[],certifications:[],inspected_paths:['helper.mjs','caller.mjs']}));
console.log(JSON.stringify({type:'turn.completed',model:'gpt-6.1-sol'}));
`, {mode:0o700});
  const tuple={host:'codex',family:'openai',model:'gpt-6.1-sol',effort:'high'};
  const schema=fs.readFileSync(path.join(root,'schemas/external-review-findings.schema.json'));
  const read=await invoke(tuple,cli,Buffer.from('Task card + helper diff'), 'exec',schema,artifacts,1,5000,1,null,repo);
  assert.equal(read.attempt.classification,'success');
  assert.deepEqual(read.findings.inspected_paths,['helper.mjs','caller.mjs']);
  assert.equal(reviewTreeSnapshot(repo),before);
  assert.ok(!read.attempt.artifacts.findings.startsWith(repo));
  const edited=await invoke(tuple,cli,Buffer.from('MUTATE'), 'exec',schema,artifacts,2,5000,1,null,repo);
  assert.equal(edited.attempt.classification,'schema_invalid');
  assert.equal(edited.protocol.terminal_reason,'read_only_tree_changed');
  assert.equal(edited.findings,null);
  assert.match(fs.readFileSync(path.join(repo,'helper.mjs'),'utf8'),/pre-existing dirty work/);
  assert.match(fs.readFileSync(path.join(repo,'helper.mjs'),'utf8'),/reviewer edit/);
});


test('review routing table follows the code author and keeps milestone Opus on agy', () => {
 const skill=fs.readFileSync(path.join(root,'skills/review-cross-model/SKILL.md'),'utf8');
 assert.match(skill,/Grok-authored \| Sol 6\.1 \| Codex \/ high/);
 assert.match(skill,/Sol-authored \| Grok 4\.7 \| Cursor \/ high/);
 assert.match(skill,/Claude-authored \| Sol 6\.1 \| Codex \/ high/);
 assert.match(skill,/claude-opus-5-5-high.*agy \/ high; never Claude Pro/);
 assert.match(skill,/Never assign Astra or max effort/);
});
