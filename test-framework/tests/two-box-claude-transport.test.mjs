// @organism-suite
// Two-Box planning on a Claude Code orchestrator: the isolated Claude transport for the
// same-family roles, the cross-family Codex assessor, and fail-closed behavior. No model,
// no real Codex: OFFLINE fixtures and a fake `claude` executable stand in for providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveDispatchRoleTuple } from '../../scripts/resolve-dispatch.mjs';
import { runTwoBox, assertPlanningTransports, assertPlanningTransportsAvailable, planningTransportSummary, AssessorUnavailable } from '../../scripts/two-box-plan.mjs';
import * as protocol from '../../scripts/lib/two-box-protocol.mjs';
import * as scouts from '../../scripts/lib/two-box-scout-assign.mjs';
import * as transport from '../../scripts/lib/claude-plan-transport.mjs';
import * as launcher from '../../scripts/lib/two-box-role-launch.mjs';
import { validateControlPlanFixture, collectRetainedStageProofErrors } from '../../scripts/lib/control-plan-validate.mjs';

const ROLES = ['open_box', 'contract_box', 'scout_forward', 'scout_reverse', 'assessor'];
const claudeTuple = (model) => ({ host: 'claude', family: 'anthropic', model, effort: 'high' });
const codexTuple = (model) => ({ host: 'codex', family: 'openai', model, effort: 'high' });

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

function policyFile(root, mode) {
  const file = path.join(root, 'policy.json');
  fs.writeFileSync(file, JSON.stringify({ schema_version: 1, authority: 'repository-owner', default_mode: 'm', modes: { m: mode } }), { mode: 0o600 });
  return file;
}

function resolveAll(configPath, orchestrator, root) {
  return Object.fromEntries([...ROLES].map((role) => [role, resolveDispatchRoleTuple({ role, orchestrator, wi: 'WI-CLAUDE-T', cwd: root, configPath })]))
    ;
}
function withRevise(tuples) {
  return { ...tuples, contract_revise: { ...tuples.contract_box, role: 'contract_revise', tuple: { ...tuples.contract_box.tuple } } };
}

test('default policy: Claude plan roles + Codex assessor pass the transport rules', () => {
  const home = tmp('tbc-home-');
  try {
    // A child process with an empty HOME, so no owner policy exists and the framework default applies.
    const script = `import('${new URL('../../scripts/resolve-dispatch.mjs', import.meta.url).href}').then((m) => {
      const out = {};
      for (const role of ${JSON.stringify(ROLES)}) out[role] = m.resolveDispatchRoleTuple({ role, orchestrator: 'claude', wi: 'WI-CLAUDE-T', cwd: process.cwd() });
      process.stdout.write(JSON.stringify(out));
    });`;
    const r = spawnSync(process.execPath, ['-e', script], { cwd: home, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
    assert.equal(r.status, 0, r.stderr);
    const tuples = withRevise(JSON.parse(r.stdout));
    assert.equal(tuples.open_box.source, 'framework-default-policy');
    assert.doesNotThrow(() => assertPlanningTransports(tuples));
    const summary = planningTransportSummary(tuples);
    for (const role of ['open_box', 'contract_box', 'scout_forward', 'scout_reverse']) {
      assert.equal(summary[role].host, 'claude');
      assert.equal(summary[role].family, 'anthropic');
      assert.equal(summary[role].transport, 'claude_isolated');
    }
    assert.deepEqual([summary.assessor.host, summary.assessor.family, summary.assessor.transport], ['codex', 'openai', 'codex_exec']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a same-family assessor is refused whatever the policy says', () => {
  const root = tmp('tbc-pol-');
  try {
    // Claude plan + Claude assessor (no assessor route: it inherits the plan tuple)
    const allClaude = policyFile(root, { labels: { PLAN: claudeTuple('p'), EXEC: claudeTuple('e') } });
    const refused = withRevise(resolveAll(allClaude, 'claude', root));
    assert.throws(() => assertPlanningTransports(refused), /assessor must be cross-family.*Codex|codex \(family openai\)/s);
    // Codex orchestrator + Codex plan + Codex assessor
    fs.rmSync(path.join(root, 'policy.json'));
    const allCodex = policyFile(root, { labels: { PLAN: codexTuple('p'), EXEC: codexTuple('e') } });
    assert.throws(() => assertPlanningTransports(withRevise(resolveAll(allCodex, 'codex', root))), /cross-family/);
    // Claude assessor under a Claude orchestrator even when the plan is on Codex
    fs.rmSync(path.join(root, 'policy.json'));
    const mixed = policyFile(root, { labels: { PLAN: codexTuple('p'), EXEC: codexTuple('e') }, roles: { assessor: claudeTuple('a') } });
    assert.throws(() => assertPlanningTransports(withRevise(resolveAll(mixed, 'claude', root))), /orchestrator/);
    // ...but is the right shape for a Codex orchestrator
    assert.doesNotThrow(() => assertPlanningTransports(withRevise(resolveAll(mixed, 'codex', root))));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('unsupported planning hosts and host/family mismatches are refused', () => {
  const root = tmp('tbc-pol2-');
  try {
    const grok = policyFile(root, { labels: { PLAN: { host: 'grok', family: 'xai', model: 'g', effort: 'high' }, EXEC: claudeTuple('e') }, roles: { assessor: codexTuple('a') } });
    assert.throws(() => assertPlanningTransports(withRevise(resolveAll(grok, 'claude', root))), /unsupported planning transport: grok/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Codex missing: issuance fails closed with an actionable error and never falls back to Claude', () => {
  const root = tmp('tbc-path-');
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  const fake = (name) => { fs.writeFileSync(path.join(bin, name), '#!/bin/sh\nexit 0\n', { mode: 0o755 }); };
  const policy = policyFile(root, { labels: { PLAN: claudeTuple('p'), EXEC: claudeTuple('e') }, roles: { assessor: codexTuple('a') } });
  try {
    const tuples = withRevise(resolveAll(policy, 'claude', root));
    fake('claude'); // Claude present, Codex absent
    assert.throws(() => assertPlanningTransportsAvailable(tuples, bin), (e) => {
      assert.ok(e instanceof AssessorUnavailable);
      assert.match(e.message, /cross-family assessor needs the codex CLI/);
      assert.match(e.message, /codex login/);
      assert.match(e.message, /never falls back to a same-family assessor/);
      return true;
    });
    fake('codex');
    assert.doesNotThrow(() => assertPlanningTransportsAvailable(tuples, bin));
    fs.rmSync(path.join(bin, 'claude'));
    assert.throws(() => assertPlanningTransportsAvailable(tuples, bin), /needs the claude CLI/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('claude result decoding is strict: structured output only, no tools, no errors', () => {
  const ok = transport.claudeResultFixture({ plan: 'x' });
  assert.deepEqual(transport.decodeClaudeResult(ok).value, { plan: 'x' });
  assert.deepEqual(launcher.parsePlanningStdout('claude', ok, 'open_box'), { plan: 'x' });
  assert.throws(() => transport.decodeClaudeResult('not json'), /not JSON/);
  assert.throws(() => transport.decodeClaudeResult(JSON.stringify({ type: 'result', is_error: true, subtype: 'error_max_turns' })), /claude result error/);
  assert.throws(() => transport.decodeClaudeResult(JSON.stringify({ type: 'result', result: '{"plan":"x"}' })), /no structured_output/);
  assert.throws(() => transport.decodeClaudeResult(JSON.stringify({ type: 'result', structured_output: { plan: 'x' }, permission_denials: [{ tool: 'Bash' }] })), /tool event/);
  assert.throws(() => launcher.parsePlanningStdout('claude', transport.claudeResultFixture({ plan: '   ' }), 'open_box'), /minLength|invalid/);
  assert.throws(() => launcher.parsePlanningStdout('claude', transport.claudeResultFixture({ plan: 'x', extra: 1 }), 'open_box'));
});

test('the isolated Claude argv is tool-free with no settings, MCP or session file', () => {
  const schema = protocol.outputSchemaForCall('open_box');
  const args = transport.buildClaudeExecArgs({ tuple: claudeTuple('claude-opus-5-5'), schema });
  const after = (flag) => args[args.indexOf(flag) + 1];
  assert.equal(after('--tools'), '');
  assert.equal(after('--setting-sources'), '');
  assert.ok(args.includes('--strict-mcp-config') && args.includes('--no-session-persistence'));
  assert.equal(after('--model'), 'claude-opus-5-5');
  assert.equal(after('--json-schema'), JSON.stringify(schema));
  assert.throws(() => transport.buildClaudeExecArgs({ tuple: { ...claudeTuple('m'), effort: 'provider-managed' }, schema }), /effort/);
  assert.throws(() => transport.buildClaudeExecArgs({ tuple: codexTuple('m'), schema }), /unsupported planning transport/);
  const env = transport.claudeEnv({ PATH: '/bin', HOME: '/h', SVC_HOST: 'claude', CLAUDECODE: '1', CODEX_THREAD_ID: 'x', ANTHROPIC_API_KEY: 'k' });
  assert.deepEqual(env, { PATH: '/bin', HOME: '/h', ANTHROPIC_API_KEY: 'k' });
});

// A fake `claude`: answers the canary probe with NONE and every role call with a canned
// structured output, from the same stdin/argv shape the real CLI sees.
function fakeClaudeDir(root, { leakCanary = false } = {}) {
  const dir = path.join(root, 'fakebin'); fs.mkdirSync(dir, { recursive: true });
  const script = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('9.9.9 (fake)'); process.exit(0); }
const input = fs.readFileSync(0, 'utf8');
const toolsEmpty = args[args.indexOf('--tools') + 1] === '';
const out = { type: 'result', subtype: 'success', is_error: false, usage: { input_tokens: 1, output_tokens: 1 }, modelUsage: { 'fake-claude': {} }, permission_denials: [] };
if (!args.includes('--json-schema')) {
  const dirCanary = fs.existsSync('CLAUDE.md') ? fs.readFileSync('CLAUDE.md', 'utf8') : '';
  out.result = ${leakCanary ? 'dirCanary || "NONE"' : '"NONE"'};
} else {
  out.structured_output = { plan: 'Fake plan for ' + (toolsEmpty ? 'tool-free' : 'UNSAFE') + ' call.' };
}
process.stdout.write(JSON.stringify(out));
`;
  fs.writeFileSync(path.join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

test('live Claude transport: canary probe, tool-free launch, retained proof verifies', async () => {
  const root = tmp('tbc-live-');
  const consumer = path.join(root, 'consumer'); fs.mkdirSync(consumer);
  const bin = fakeClaudeDir(root);
  const savedPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${savedPath}`;
  try {
    const probe = await transport.primeClaudeProbe();
    assert.equal(probe.ok, true);
    assert.equal(probe.canary_seen, false);
    const tuple = claudeTuple('claude-opus-5-5');
    const payload = { bindings: { wi: 'WI-LIVE-T' }, requirements: [{ id: 'AC1', text: 'Keep it.' }], facts: { a: 1 } };
    const launch = await launcher.launchRole({ role: 'open_box', tuple, payload, schema: protocol.outputSchemaForCall('open_box'), sourceBindings: { consumerRoot: consumer }, mode: 'live' });
    assert.equal(launch.evidence_class, 'LIVE');
    assert.match(launch.output.plan, /tool-free/);
    assert.equal(launch.invocation.host, 'claude');
    assert.equal(launch.invocation.transport, 'claude_isolated');
    assert.equal(launch.proof.transport, 'claude_isolated');
    assert.equal(launch.proof.effective.usable_live, true);
    assert.equal(launch.proof.isolation_probe.authority, 'claude_isolation_probe');
    assert.equal(path.relative(consumer, launch.invocation.cwd).startsWith('..'), true, 'neutral cwd is outside the consumer');
    // The stored envelope re-verifies from its own bytes.
    const stored = protocol.storeStageEnvelope({
      wi: 'WI-LIVE-T', role: 'open_box', input: payload, launch: { ...launch, evidence_class: 'LIVE' },
      policy: 'a'.repeat(64), source: { base_sha: 'b'.repeat(40), tree: 'c'.repeat(40), identity: {} }, parents: [], schema: protocol.outputSchemaForCall('open_box'), start: consumer,
    });
    assert.deepEqual(collectRetainedStageProofErrors(stored.envelope, { consumerRoot: consumer, fixture: false, role: 'open_box' }), []);
    // Tampering is caught: dropping a control, or claiming a codex-shaped proof.
    const weak = structuredClone(stored.envelope);
    weak.launch.proof.exec_args = weak.launch.proof.exec_args.filter((a) => a !== '--strict-mcp-config');
    weak.launch.invocation.exec_args = weak.launch.proof.exec_args;
    assert.ok(collectRetainedStageProofErrors(weak, { consumerRoot: consumer, fixture: false, role: 'open_box' }).length > 0);
    const noProbe = structuredClone(stored.envelope);
    noProbe.launch.proof.isolation_probe = { ...noProbe.launch.proof.isolation_probe, ok: false };
    assert.match(collectRetainedStageProofErrors(noProbe, { consumerRoot: consumer, fixture: false, role: 'open_box' }).join('\n'), /canary isolation probe/);
  } finally {
    process.env.PATH = savedPath;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a canary that reaches the model blocks live use', async () => {
  const root = tmp('tbc-leak-');
  const consumer = path.join(root, 'consumer'); fs.mkdirSync(consumer);
  // The fake leaks its working directory's CLAUDE.md, as a non-isolated CLI would.
  const bin = fakeClaudeDir(root, { leakCanary: true });
  const savedPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${savedPath}`;
  try {
    const probe = await transport.primeClaudeProbe({ probeModel: 'leaky-probe' });
    assert.equal(probe.ok, false);
    assert.equal(probe.canary_seen, true);
    const payload = { bindings: { wi: 'WI-LIVE-T' }, requirements: [{ id: 'AC1', text: 'Keep it.' }], facts: {} };
    await assert.rejects(
      () => launcher.launchRole({ role: 'open_box', tuple: claudeTuple('m'), payload, schema: protocol.outputSchemaForCall('open_box'), sourceBindings: { consumerRoot: consumer }, mode: 'live' }),
      /isolation probe did not pass/,
    );
  } finally {
    process.env.PATH = savedPath;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---- OFFLINE full cycle: Claude for the same-family roles, Codex for the assessor ----
function codexStdout(output) {
  return [
    { type: 'thread.started', thread_id: 'OFFLINE-FIXTURE' }, { type: 'turn.started' },
    { type: 'item.completed', item: { id: 'offline-answer', type: 'agent_message', text: JSON.stringify(output) } },
    { type: 'turn.completed', usage: { input_tokens: 0, output_tokens: 0 } },
  ].map((row) => JSON.stringify(row)).join('\n') + '\n';
}

async function withSource(run) {
  const root = tmp('tbc-src-');
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  try {
    git('init', '-q');
    fs.writeFileSync(path.join(root, 'source.mjs'), 'export const value = 1;\n'.repeat(16));
    git('add', '.');
    git('-c', 'user.name=Offline Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Offline source fixture');
    await run(root, git('rev-parse', 'HEAD'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

const contract = { plan: 'Preserve the declared value and check its consumers.', decisions: [{ id: 'D1', original_requirement_ids: ['AC1'], source_citations: [{ path: 'source.mjs', start_line: 5, end_line: 5, sha256: null }], text: 'Keep the public behavior.' }] };

async function claudeCycle(run, { assessor = codexTuple('offline-assessor'), plan = claudeTuple('offline-plan'), exec = claudeTuple('offline-exec'), orchestrator = 'claude' } = {}) {
  await withSource(async (root, baseSha) => {
    const configPath = policyFile(root, { labels: { PLAN: plan, EXEC: exec }, roles: { assessor } });
    const sourceSnapshot = protocol.buildSourceSnapshot({ consumerRoot: root, baseSha, scope: ['source.mjs'], ranges: [] });
    const assignments = scouts.assignDualPass({ sourceSnapshot, initialContract: contract, consumerRoot: root, constraints: { paths: [] }, scoutExposure: null });
    const outputs = {
      open_box: { plan: 'Preserve the public value.\n\nKeep its consumers compatible.' },
      contract_box: contract,
      contract_revise: { ...contract, dispositions: [] },
      assessor: { winner: 'open_win', selected_decisions: [{ original_requirement_id: 'AC1', decision_id: 'open:P1', source_ids: ['open:P1'], origin: 'open_box', reason: 'Preserves the original requirement with the simpler grounded approach.' }], rejection_dispositions: [], unresolved_conflicts: [] },
    };
    for (const role of ['scout_forward', 'scout_reverse']) outputs[role] = { findings: [], citations: [], unread_gaps: [], supplied_denominator: assignments[role].supplied_denominator, incomplete: false };
    const hostOf = { open_box: plan.host, contract_box: plan.host, contract_revise: plan.host, scout_forward: exec.host, scout_reverse: exec.host, assessor: assessor.host };
    const staged = Object.fromEntries(Object.entries(outputs).map(([role, output]) => [role, { output, stdout: hostOf[role] === 'claude' ? transport.claudeResultFixture(output) : codexStdout(output) }]));
    const opts = {
      consumerRoot: root, wi: 'WI-CLAUDE-CYCLE', originalRequirements: [{ id: 'AC1', text: 'Keep public behavior.' }],
      scope: ['source.mjs'], baseSha, facts: {}, mode: 'OFFLINE',
      dispatch: { configPath, orchestrator, sessionOverrideRequested: false }, offline: { outputs: staged },
    };
    await run(opts, root);
  });
}

test('OFFLINE cycle on a Claude Code orchestrator: Claude plan roles, Codex assessor, transports recorded', async () => {
  await claudeCycle(async (opts, root) => {
    const first = await runTwoBox(opts);
    assert.equal(first.status, 'completed');
    assert.equal(first.new_provider_calls, 6);
    assert.equal(first.planning_transports.open_box.transport, 'claude_isolated');
    assert.equal(first.planning_transports.assessor.transport, 'codex_exec');
    const env = Object.fromEntries(Object.entries(first.stages).map(([role, s]) => [role, protocol.getStageEnvelope(s.ref, { start: root })]));
    for (const role of ['open_box', 'contract_box', 'scout_forward', 'scout_reverse', 'contract_revise']) {
      assert.equal(env[role].launch.requested.host, 'claude', role);
      assert.equal(env[role].launch.requested.family, 'anthropic', role);
      assert.equal(env[role].launch.invocation.transport, 'claude_isolated', role);
      assert.equal(env[role].launch.proof.transport, 'claude_isolated', role);
    }
    assert.equal(env.assessor.launch.requested.host, 'codex');
    assert.equal(env.assessor.launch.requested.family, 'openai');
    assert.equal(env.assessor.launch.invocation.transport, 'codex_exec');
    // The control plan records each role's host/family honestly and validates as a fixture.
    assert.equal(first.control_plan.tuple.open_box.host, 'claude');
    assert.equal(first.control_plan.tuple.assessor.host, 'codex');
    const body = { ...first.control_plan, timestamp: '2026-09-15T00:00:00Z', tree_hash: first.control_plan.source.tree };
    delete body.draft; delete body.draft_for; delete body.issuance;
    const checked = validateControlPlanFixture({ consumerRoot: root, body });
    assert.equal(checked.ok, true, (checked.errors || []).join('\n'));
    // Resume reuses the retained Claude and Codex stages without new calls.
    const resumed = await runTwoBox(opts);
    assert.equal(resumed.new_provider_calls, 0);
    assert.deepEqual(resumed.stages, first.stages);
    // A control plan that names a same-family assessor is not valid, even as a fixture.
    const forged = structuredClone(body);
    forged.tuple.assessor = { ...forged.tuple.open_box };
    assert.match((validateControlPlanFixture({ consumerRoot: root, body: forged }).errors || []).join('\n'), /assessor must be cross-family/);
  });
});

test('runTwoBox refuses a Claude plan with a Claude assessor before any stage runs', async () => {
  await claudeCycle(async (opts, root) => {
    await assert.rejects(() => runTwoBox(opts), /assessor must be cross-family/);
    assert.equal(fs.existsSync(path.join(root, '.svc', 'two-box', 'WI-CLAUDE-CYCLE', 'journal.json')), false);
  }, { assessor: claudeTuple('offline-assessor') });
});

test('a Codex orchestrator may judge with a Claude assessor (cross-family in the other direction)', async () => {
  await claudeCycle(async (opts) => {
    const result = await runTwoBox(opts);
    assert.equal(result.status, 'completed');
    assert.equal(result.planning_transports.assessor.transport, 'claude_isolated');
    assert.equal(result.planning_transports.open_box.transport, 'codex_exec');
  }, { plan: codexTuple('offline-plan'), exec: codexTuple('offline-exec'), assessor: claudeTuple('offline-assessor'), orchestrator: 'codex' });
});

// ---- Round 2 regressions ----
test('R1-1: a policy cannot override the orchestrator identity; the resolved field is authoritative', () => {
  const root = tmp('tbc-orch-');
  const forms = {
    flat: { roles: { assessor: { ...codexTuple('a'), orchestrator: 'claude' } } },
    nested: { roles: { assessor: { tuple: { ...codexTuple('a'), orchestrator: 'claude' } } } },
    label: { labels: { PLAN: { ...codexTuple('p'), orchestrator: 'claude' }, EXEC: codexTuple('e') } },
  };
  try {
    for (const [name, extra] of Object.entries(forms)) {
      const file = policyFile(root, { labels: { PLAN: codexTuple('p'), EXEC: codexTuple('e') }, ...extra });
      assert.throws(() => resolveAll(file, 'codex', root), (e) => e.code === 'dispatch_policy_invalid' && /must not set an orchestrator/.test(e.message), name);
      fs.rmSync(file);
    }
    // Defense in depth: even a hand-built tuples object cannot smuggle an override through.
    const file = policyFile(root, { labels: { PLAN: codexTuple('p'), EXEC: codexTuple('e') }, roles: { assessor: codexTuple('a') } });
    const real = withRevise(resolveAll(file, 'codex', root));
    assert.throws(() => assertPlanningTransports(real), /cross-family/); // codex orchestrator + codex assessor
    const forged = structuredClone(real);
    for (const role of Object.keys(forged)) forged[role].tuple.orchestrator = 'claude'; // would make codex look cross-family
    assert.throws(() => assertPlanningTransports(forged), /orchestrator override is refused/);
    const mixedForged = structuredClone(real);
    mixedForged.assessor.tuple.orchestrator = 'claude';
    assert.throws(() => assertPlanningTransports(mixedForged), /orchestrator override is refused/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('R1-1: an unknown orchestrator family fails closed', () => {
  const root = tmp('tbc-orch2-');
  try {
    const file = policyFile(root, { labels: { PLAN: claudeTuple('p'), EXEC: claudeTuple('e') }, roles: { assessor: codexTuple('a') } });
    const tuples = withRevise(resolveAll(file, 'claude', root));
    for (const name of ['mystery', 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      const t = structuredClone(tuples);
      for (const role of Object.keys(t)) { t[role].orchestrator = name; t[role].tuple.orchestrator = name; }
      assert.throws(() => assertPlanningTransports(t), /unknown orchestrator family/, name);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('R1-2: the isolated process gets runtime and auth values only, never request or plugin channels', () => {
  const env = transport.claudeEnv({
    PATH: '/bin', HOME: '/h', LANG: 'C', ANTHROPIC_API_KEY: 'k', AWS_REGION: 'r', HTTPS_PROXY: 'p',
    CLAUDE_CODE_EXTRA_BODY: '{"x":1}', CLAUDE_CODE_PLUGIN_DIRS: '/evil', ANTHROPIC_CUSTOM_HEADERS: 'h: v',
    CLAUDE_CODE_SETTINGS: '{}', CLAUDE_CODE_MCP_CONFIG: 'm', ANTHROPIC_SYSTEM_PROMPT: 's', CLAUDE_CODE_APPEND_SYSTEM_PROMPT: 'a',
    CLAUDE_CODE_SESSION_ID: 'x', SOME_UNLISTED_VAR: 'u', NODE_OPTIONS: '--require=/evil.js',
  });
  assert.deepEqual(Object.keys(env).sort(), ['ANTHROPIC_API_KEY', 'AWS_REGION', 'HOME', 'HTTPS_PROXY', 'LANG', 'PATH']);
});

test('R1-2: the launched child receives the sanitized environment', async () => {
  const root = tmp('tbc-env-');
  const consumer = path.join(root, 'consumer'); fs.mkdirSync(consumer);
  const dir = path.join(root, 'fakebin'); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'claude'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('9.9.9'); process.exit(0); }
fs.readFileSync(0, 'utf8');
const leaked = ['CLAUDE_CODE_EXTRA_BODY', 'CLAUDE_CODE_PLUGIN_DIRS'].filter((k) => k in process.env);
const out = { type: 'result', is_error: false, modelUsage: { f: {} }, permission_denials: [] };
if (args.includes('--json-schema')) out.structured_output = { plan: leaked.length ? 'LEAK ' + leaked.join(',') : 'clean environment' };
else out.result = 'NONE';
process.stdout.write(JSON.stringify(out));
`, { mode: 0o755 });
  const saved = { PATH: process.env.PATH, a: process.env.CLAUDE_CODE_EXTRA_BODY, b: process.env.CLAUDE_CODE_PLUGIN_DIRS };
  process.env.PATH = `${dir}${path.delimiter}${saved.PATH}`;
  process.env.CLAUDE_CODE_EXTRA_BODY = '{"x":1}';
  process.env.CLAUDE_CODE_PLUGIN_DIRS = '/evil';
  try {
    await transport.primeClaudeProbe();
    const payload = { bindings: { wi: 'WI-ENV-T' }, requirements: [{ id: 'AC1', text: 'Keep it.' }], facts: {} };
    const launch = await launcher.launchRole({ role: 'open_box', tuple: claudeTuple('m'), payload, schema: protocol.outputSchemaForCall('open_box'), sourceBindings: { consumerRoot: consumer }, mode: 'live' });
    assert.equal(launch.output.plan, 'clean environment');
  } finally {
    process.env.PATH = saved.PATH;
    if (saved.a === undefined) delete process.env.CLAUDE_CODE_EXTRA_BODY; else process.env.CLAUDE_CODE_EXTRA_BODY = saved.a;
    if (saved.b === undefined) delete process.env.CLAUDE_CODE_PLUGIN_DIRS; else process.env.CLAUDE_CODE_PLUGIN_DIRS = saved.b;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('R1-3: the Claude request size is a declared conservative upper bound, not a claimed capture', () => {
  const schema = protocol.outputSchemaForCall('open_box');
  const tuple = claudeTuple('claude-opus-5-5');
  const plain = 'x'.repeat(1000);
  const escapey = '\n'.repeat(1000); // each newline serializes as two bytes
  const bound = (prompt) => transport.claudeRequestUpperBound({ prompt, schema, tuple });
  const floor = Buffer.byteLength(plain) + Buffer.byteLength(JSON.stringify(schema));
  assert.ok(bound(plain) >= floor + transport.CLAUDE_SYSTEM_ALLOWANCE_BYTES, 'includes the system allowance and the schema');
  assert.ok(bound(escapey) - bound(plain) >= 1000, 'JSON escaping overhead is counted');
  const root = tmp('tbc-bound-');
  try {
    const pre = transport.assertClaudeIsolation({ role: 'open_box', tuple, prompt: plain, schema, consumerRoot: root, mode: 'offline', offline: {} });
    try {
      assert.equal(pre.proof.token_budget.checked, false); // offline fixture: nothing authoritative claimed
    } finally { pre.cleanup(); }
    // A live-shaped proof must declare the bound exactly; claiming a capture or a smaller size is caught.
    const live = { ...pre.proof, mode: 'live', frozen_request: { ...pre.proof.frozen_request, transport: 'claude_stdin' }, inspection_authority: 'claude_isolation_probe',
      isolation_probe: { ok: true, canary_seen: false, authority: 'claude_isolation_probe', binary_sha256: pre.proof.binary.sha256 },
      token_budget: { checked: true, fits: null, enforcement: 'native_runner', estimate_kind: transport.CLAUDE_ESTIMATE_KIND, system_allowance_bytes: transport.CLAUDE_SYSTEM_ALLOWANCE_BYTES, estimated_tokens: null, envelope_bytes: bound(plain), captured_body_bytes: null } };
    const launch = { requested: tuple, invocation: { host: 'claude', transport: 'claude_isolated', exec_args: live.exec_args } };
    const run = (proof) => transport.collectClaudeProofErrors(proof, { launch, role: 'open_box', schema, proofPrompt: plain, fixture: false }).join('\n');
    assert.doesNotMatch(run(live), /request size|upper bound/);
    assert.match(run({ ...live, token_budget: { ...live.token_budget, envelope_bytes: floor } }), /upper bound differs/);
    assert.match(run({ ...live, token_budget: { ...live.token_budget, captured_body_bytes: 123 } }), /not a claimed capture/);
    assert.match(run({ ...live, token_budget: { ...live.token_budget, estimate_kind: 'request_bytes_only' } }), /not a claimed capture/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('R2-1: temporary cloud credentials survive; only agent/session identity variables are stripped', () => {
  const env = transport.claudeEnv({
    PATH: '/bin', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 's', AWS_SESSION_TOKEN: 't', AWS_PROFILE: 'p', AWS_REGION: 'r',
    GOOGLE_APPLICATION_CREDENTIALS: '/g.json', CLAUDE_CODE_USE_BEDROCK: '1',
    CLAUDE_CODE_SESSION_ID: 'x', CLAUDE_SESSION_ID: 'y', CLAUDECODE: '1', SVC_HOST: 'claude', CODEX_THREAD_ID: 'c',
    CLAUDE_CODE_EXTRA_BODY: '{}', CLAUDE_CODE_PLUGIN_DIRS: '/p',
  });
  assert.deepEqual(Object.keys(env).sort(), ['AWS_ACCESS_KEY_ID', 'AWS_PROFILE', 'AWS_REGION', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'GOOGLE_APPLICATION_CREDENTIALS', 'PATH']);
});
