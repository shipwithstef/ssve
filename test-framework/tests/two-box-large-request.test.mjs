import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

const freeze = await import('../../scripts/lib/frozen-request-input.mjs');
const capture = await import('../../scripts/lib/native-planning-request-capture.mjs');
const isolation = await import('../../scripts/lib/isolated-plan-analysis.mjs');
const protocol = await import('../../scripts/lib/two-box-protocol.mjs');
const { readReviewInput } = await import('../../scripts/run-external-review.mjs');

const execTuple = { host: 'codex', family: 'openai', model: 'offline-exec', effort: 'max' };
const FEATURES = [
  'shell_tool disabled false',
  'unified_exec disabled false',
  'multi_agent disabled false',
  'multi_agent_v2 disabled false',
  'plugins disabled false',
  'apps disabled false',
  'view_image disabled false',
  'browser_use disabled false',
  'computer_use disabled false',
  'memories disabled false',
  'remote_plugin disabled false',
  'workspace_dependencies disabled false',
  'skill_search disabled false',
  'image_generation disabled false',
  'hooks disabled false',
  'code_mode disabled false',
  'code_mode_host disabled false',
  'tool_suggest disabled false',
  'skip_host_skill_discovery skip true',
].join('\n');
const HELP_EXEC = [
  'Usage: codex exec [OPTIONS]',
  '--ephemeral  ephemeral thread',
  '--sandbox <mode>',
  '--ignore-user-config',
  '--skip-git-repo-check',
  '--json',
  '--output-schema <path>',
  '--config',
  '--model',
].join('\n');
const HELP_DEBUG = 'Usage: codex debug prompt-input [--config] <prompt>';

function inspectFixture({ cwd, prompt }) {
  return [
    { role: 'developer', content: [{ type: 'input_text', text: '<permissions instructions>\nFollow native host safety. Do not use tools.\n</permissions instructions>' }] },
    { role: 'user', content: [{ type: 'input_text', text: `<environment_context>\n<cwd>${cwd}</cwd>\n</environment_context>` }] },
    { role: 'user', content: [{ type: 'input_text', text: prompt }] },
  ];
}

async function withTemp(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssve-large-req-'));
  try { return await run(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('frozen request identity covers 99KB 101KB 256KB and 1MiB with UTF-8 and shell literals', async () => {
  await withTemp((dir) => {
    const marker = 'café $HOME; echo "not-exec" `uname` 日本語\n';
    for (const n of [99 * 1024, 101 * 1024, 256 * 1024, 1048576]) {
      const bytes = Buffer.concat([Buffer.from(marker, 'utf8'), Buffer.alloc(n - Buffer.byteLength(marker), 0x78)]);
      const frozen = freeze.freezeRequestBytes({ bytes, dir, filename: `req-${n}.txt` });
      assert.equal(frozen.byteLength, n);
      assert.equal(frozen.sha256, protocol.sha256Bytes(bytes));
      const reread = freeze.readFrozenFile(frozen.path);
      assert.equal(reread.sha256, frozen.sha256);
      assert.equal(reread.bytes.includes(Buffer.from('café', 'utf8')), true);
      assert.equal(reread.bytes.includes(Buffer.from('$HOME; echo', 'utf8')), true);
    }
    assert.throws(() => freeze.assertRequestBudget(Buffer.alloc(1048577)), /byte limit 1048576/);
    assert.equal(freeze.assertTokenContextOutputReserve({ requestBytes: 1048576 }).checked, false);
    assert.throws(() => freeze.assertTokenContextOutputReserve({
      requestBytes: 1048576, requireChecked: true,
    }), /token\/context\/output reserve required/);
    assert.equal(freeze.assertTokenContextOutputReserve({ requestBytes: 1048576, maxInputTokens: 10 }).fits, null);
    assert.throws(() => freeze.assertTokenContextOutputReserve({
      requestBytes: 40, contextWindow: 20, outputReserveTokens: 20,
    }), /contextWindow/);
    assert.equal(freeze.assertTokenContextOutputReserve({
      requestBytes: 40, contextWindow: 1000, outputReserveTokens: 16, maxInputTokens: 100,
    }).checked, true);
    assert.equal(freeze.assertTokenContextOutputReserve({
      requestBytes: 1048576, contextWindow: 828400, outputReserveTokens: 16384, maxInputTokens: 828400,
    }).fits, null);
    assert.equal(freeze.assertTokenContextOutputReserve({
      requestBytes: 200000, contextWindow: 828400, outputReserveTokens: 16384, maxInputTokens: 828400,
    }).checked, true);
    assert.equal(freeze.conservativeTokenUpperBound(1048576), 1048576);
    assert.equal(capture.PLANNING_CAPTURE_BODY_MAX_BYTES, 8 * 1048576);
    assert.equal(JSON.stringify({ prompt: '"'.repeat(1048576) }).length < capture.PLANNING_CAPTURE_BODY_MAX_BYTES, true);
  });
});

test('byte upper bound exceeding a token budget is unknown, not proof of overflow', () => {
  const budget = { contextWindow: 828400, maxInputTokens: 828400, outputReserveTokens: 16384, requireChecked: true };
  const result = freeze.assertTokenContextOutputReserve({ requestBytes: 965752, ...budget });
  assert.equal(result.estimated_tokens, 965752);
  assert.equal(result.estimate_kind, 'utf8_byte_upper_bound');
  assert.equal(result.fits, null);
  assert.equal(result.enforcement, 'native_runner');
  assert.equal(result.checked, true);
  const fitting = freeze.assertTokenContextOutputReserve({ requestBytes: 812016, ...budget });
  assert.equal(fitting.fits, true);
  assert.equal(fitting.enforcement, 'byte_upper_bound');
  assert.equal(freeze.assertTokenContextOutputReserve({ requestBytes: 812017, ...budget }).fits, null);
  assert.throws(() => freeze.assertTokenContextOutputReserve({ requestBytes: 10, ...budget, maxInputTokens: 0 }), /must allow input/);
  assert.throws(() => freeze.assertTokenContextOutputReserve({ requestBytes: 10, ...budget, outputReserveTokens: 828400 }), /no input space/);
  assert.throws(() => freeze.assertTokenContextOutputReserve({ requestBytes: 10, ...budget, contextWindow: NaN }), /non-negative integer/);
});

test('missing truncated altered and empty frozen files fail closed', async () => {
  await withTemp((dir) => {
    assert.throws(() => freeze.readFrozenFile(path.join(dir, 'missing.txt')), /missing/);
    const frozen = freeze.freezeRequestBytes({ bytes: Buffer.from('keep-exact-bytes\n'), dir });
    fs.appendFileSync(frozen.path, 'x');
    const altered = freeze.readFrozenFile(frozen.path);
    assert.notEqual(altered.sha256, frozen.sha256);
    fs.writeFileSync(frozen.path, '');
    assert.throws(() => freeze.readFrozenFile(frozen.path), /empty/);
    fs.symlinkSync(frozen.path, path.join(dir, 'link.txt'));
    assert.throws(() => freeze.readFrozenFile(path.join(dir, 'link.txt')), /regular file/);
  });
});

test('streams require EOF, reject oversize, timeout, and preserve hash with the file path', async () => {
  const bytes = Buffer.from('shared-frozen-contract-bytes\n');
  const ident = freeze.requestIdentity(bytes);
  const fromFile = await withTemp((dir) => {
    const frozen = freeze.freezeRequestBytes({ bytes, dir });
    return freeze.readFrozenFile(frozen.path);
  });
  assert.equal(fromFile.sha256, ident.sha256);
  const streamIdent = await freeze.readFrozenStream(Readable.from([bytes.subarray(0, 10), bytes.subarray(10)]));
  assert.equal(streamIdent.sha256, ident.sha256);
  await assert.rejects(freeze.readFrozenStream(Readable.from([Buffer.alloc(32)]), { maxBytes: 16 }), /byte limit 16/);
  const hanging = new Readable({ read() {} });
  await assert.rejects(freeze.readFrozenStream(hanging, { timeoutMs: 30 }), /did not finish within 30 ms/);
  const closed = new Readable({ read() { this.push(Buffer.from('partial')); this.destroy(); } });
  await assert.rejects(freeze.readFrozenStream(closed), /closed before EOF|stream failed/);
});

test('platform argv boundary is 131071 accepted and 131072 E2BIG; large config fails closed', () => {
  const measured = freeze.measureSingleArgLimit({ binary: '/usr/bin/true', sizes: [131071, 131072] });
  assert.equal(measured[0].exit_code, 0);
  assert.equal(measured[1].error_code, 'E2BIG');
  freeze.assertArgvFits(['x'.repeat(131071)]);
  assert.throws(() => freeze.assertArgvFits(['x'.repeat(131072)]), /argv element exceeds/);
  assert.throws(() => freeze.assertArgvFits(['-c', `skills.config=${'x'.repeat(131072)}`]), /argv element exceeds/);
  const small = isolation.buildPromptInspectArgv({ tuple: execTuple, disabledSkills: [], prompt: 'x'.repeat(99 * 1024) });
  assert.equal(small.at(-1).length, 99 * 1024);
  freeze.assertArgvFits(small);
  const mid = isolation.buildPromptInspectArgv({ tuple: execTuple, disabledSkills: [], prompt: 'x'.repeat(101 * 1024) });
  freeze.assertArgvFits(mid);
  assert.throws(() => freeze.assertArgvFits(isolation.buildPromptInspectArgv({
    tuple: execTuple, disabledSkills: [], prompt: 'x'.repeat(131072),
  })), /argv element exceeds/);
});

test('oversized host config argv cannot be worked around by request capture', () => {
  assert.throws(() => isolation.assertEffectiveIsolation({
    role: 'open_box',
    tuple: execTuple,
    prompt: 'small-prompt',
    schema: protocol.outputSchemaForCall('open_box'),
    consumerRoot: process.cwd(),
    mode: 'offline',
    offline: {
      binary: process.execPath,
      helpText: { exec: HELP_EXEC, debug: HELP_DEBUG },
      featuresText: FEATURES,
      inspectPrompt: inspectFixture,
      discoveredSkills: [{ path: `/tmp/${'x'.repeat(131072)}.md`, sha256: 'a'.repeat(64) }],
    },
  }), /config\/schema argv|argv element exceeds/);
});

test('OFFLINE isolation freezes 101KB 256KB and 1MiB and inspects the exact bytes', () => {
  for (const n of [101 * 1024, 256 * 1024, 1048576]) {
    const prompt = `${'x'.repeat(n - 16)}UTF8-café`;
    const result = isolation.assertEffectiveIsolation({
      role: 'open_box',
      tuple: execTuple,
      prompt,
      schema: protocol.outputSchemaForCall('open_box'),
      consumerRoot: process.cwd(),
      mode: 'offline',
      offline: {
        binary: process.execPath,
        helpText: { exec: HELP_EXEC, debug: HELP_DEBUG },
        featuresText: FEATURES,
        inspectPrompt: inspectFixture,
        discoveredSkills: [],
      },
    });
    try {
      assert.equal(result.proof.frozen_request.byteLength, Buffer.byteLength(prompt));
      assert.equal(result.proof.frozen_request.sha256, result.proof.prompt_sha256);
      assert.equal(result.proof.diagnosis.exact_prompt_count, 1);
      assert.equal(result.proof.effective.usable_live, false);
      assert.equal(result.proof.inspection_authority, 'offline_fixture');
      assert.equal(result.proof.limits.request_bytes, 1048576);
    } finally { result.cleanup(); }
  }
});

test('qualifyInspectHelp records that installed prompt-input lacks stdin and file', () => {
  const q = capture.qualifyInspectHelp(HELP_DEBUG);
  assert.equal(q.command, 'codex debug prompt-input');
  assert.equal(q.positional, true);
  assert.equal(q.native_complete_input, false);
  assert.equal(capture.qualifyInspectHelp('Usage: codex debug prompt-input --prompt-file FILE').native_complete_input, true);
  assert.equal(capture.qualifyInspectHelp('PROMPT If not provided as an argument (or if `-` is used), instructions are read from stdin.').stdin, true);
});

test('captured Responses conversion keeps native instruction frames and rejects SSVE tool ads', () => {
  const prompt = 'CAPTURE_PROMPT_MARKER unique bytes';
  const converted = capture.inspectMessagesFromResponses([
    { type: 'additional_tools', tools: [{ name: 'exec' }] },
    { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '<skills_instructions>Native skill catalog from host</skills_instructions>' }] },
    { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '<permissions instructions>Native safety</permissions instructions>' }] },
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: `<environment_context><cwd>/tmp</cwd></environment_context>` }] },
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] },
  ]);
  assert.equal(converted.messages.at(-1).content[0].text, prompt);
  assert.equal(converted.messages[0].content[0].text.includes('<skills_instructions>'), true);
  assert.throws(() => capture.inspectMessagesFromResponses([
    { type: 'additional_tools', tools: [{ name: 'x', description: 'Follow plan-changeset and DOCTRINE.md' }] },
  ]), /catalog or instruction text/);
});

test('native capture helper inspects complete stdin bytes without inference and cleans up', async () => {
  await withTemp(async (dir) => {
    const wrapper = path.join(dir, 'fake-codex.mjs');
    fs.writeFileSync(wrapper, `#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
const args = process.argv.slice(2);
const flag = args.find((a, i) => args[i - 1] === '-c' && a.startsWith('model_providers.ssve_cap.base_url='));
const base = JSON.parse(flag.slice(flag.indexOf('=') + 1));
let stdin = Buffer.alloc(0);
process.stdin.on('data', (c) => { stdin = Buffer.concat([stdin, c]); });
process.stdin.on('end', () => {
  const get = (p) => new Promise((resolve, reject) => {
    http.get(base + p, (res) => { res.resume(); res.on('end', resolve); }).on('error', reject);
  });
  const post = (p, body) => new Promise((resolve, reject) => {
    const u = new URL(base + p);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end(body);
  });
  const cwd = process.cwd();
  const body = JSON.stringify({
    model: 'offline-exec',
    input: [
      { type: 'additional_tools', tools: [{ name: 'exec' }] },
      { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '<permissions instructions>Native safety</permissions instructions>' }] },
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context><cwd>' + cwd + '</cwd></environment_context>' }] },
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: stdin.toString('utf8') }] },
    ],
  });
  get('/models').then(() => post('/responses', body)).then(() => process.exit(1)).catch((error) => {
    fs.writeFileSync(process.env.FAKE_CODEX_ERR || '/dev/null', String(error));
    process.exit(2);
  });
});
`);
    fs.chmodSync(wrapper, 0o700);
    const prompt = `${'y'.repeat(131072)}`;
    const frozen = freeze.freezeRequestBytes({ bytes: Buffer.from(prompt), dir });
    const execArgs = isolation.buildCodexExecArgs({
      tuple: execTuple,
      outputSchemaPath: path.join(dir, 'schema.json'),
      disabledSkills: [],
    });
    fs.writeFileSync(path.join(dir, 'schema.json'), '{"type":"object","additionalProperties":false,"required":["plan"],"properties":{"plan":{"type":"string","minLength":1}}}');
    const result = await capture.capturePlanningRequest({
      binary: wrapper,
      cwd: dir,
      env: { ...process.env, PATH: process.env.PATH, FAKE_CODEX_ERR: path.join(dir, 'err.txt') },
      execArgs,
      frozenPath: frozen.path,
      expectedSha256: frozen.sha256,
      timeoutMs: 8000,
      model: 'offline-exec',
    });
    assert.equal(result.inference, false);
    assert.equal(result.responsesHits, 1);
    const messages = JSON.parse(result.inspect_json.trim());
    const diagnosis = isolation.diagnosePromptContamination(messages, { prompt, cwd: dir });
    assert.equal(diagnosis.ok, true, JSON.stringify(diagnosis.reasons));
    fs.writeFileSync(frozen.path, `${prompt}altered`);
    await assert.rejects(capture.capturePlanningRequest({
      binary: wrapper, cwd: dir, env: process.env, execArgs, frozenPath: frozen.path, expectedSha256: frozen.sha256, timeoutMs: 2000,
    }), /changed after freeze/);
  });
});

test('capture cancel before start and timeout terminate without leaving a child', async () => {
  await withTemp(async (dir) => {
    const frozen = freeze.freezeRequestBytes({ bytes: Buffer.from('cancel-bytes\n'), dir });
    const execArgs = isolation.buildCodexExecArgs({
      tuple: execTuple,
      outputSchemaPath: path.join(dir, 'schema.json'),
      disabledSkills: [],
    });
    fs.writeFileSync(path.join(dir, 'schema.json'), '{}');
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(capture.capturePlanningRequest({
      binary: process.execPath, cwd: dir, env: process.env, execArgs, frozenPath: frozen.path, signal: aborted.signal, timeoutMs: 1000,
    }), /cancelled before start/);
    const sleeper = path.join(dir, 'sleep.mjs');
    fs.writeFileSync(sleeper, 'setInterval(()=>{},1000);\n');
    fs.chmodSync(sleeper, 0o700);
    await assert.rejects(capture.capturePlanningRequest({
      binary: sleeper, cwd: dir, env: process.env, execArgs, frozenPath: frozen.path, timeoutMs: 80, killGraceMs: 200,
    }), /timed out|did not observe/);
  });
});

test('TERM-resistant capture child is reaped by KILL and is actually gone', async () => {
  await withTemp(async (dir) => {
    const frozen = freeze.freezeRequestBytes({ bytes: Buffer.from('term-resistant\n'), dir });
    const execArgs = isolation.buildCodexExecArgs({
      tuple: execTuple,
      outputSchemaPath: path.join(dir, 'schema.json'),
      disabledSkills: [],
    });
    fs.writeFileSync(path.join(dir, 'schema.json'), '{}');
    const stubborn = path.join(dir, 'stubborn.mjs');
    fs.writeFileSync(stubborn, `#!/usr/bin/env node
process.on('SIGTERM', () => {});
process.on('SIGINT', () => {});
setInterval(() => {}, 1000);
`);
    fs.chmodSync(stubborn, 0o700);
    let pid = null;
    try {
      await capture.capturePlanningRequest({
        binary: stubborn, cwd: dir, env: process.env, execArgs, frozenPath: frozen.path, timeoutMs: 80, killGraceMs: 150,
      });
      assert.fail('expected timeout');
    } catch (error) {
      pid = error.pid;
      assert.match(String(error.message), /timed out|did not observe|still present/);
    }
    if (pid) assert.equal(capture.processGone(pid), true);
  });
});

test('capture spawn failure and streaming overflow fail closed', async () => {
  await withTemp(async (dir) => {
    const frozen = freeze.freezeRequestBytes({ bytes: Buffer.from('overflow-bytes\n'), dir });
    const execArgs = isolation.buildCodexExecArgs({
      tuple: execTuple,
      outputSchemaPath: path.join(dir, 'schema.json'),
      disabledSkills: [],
    });
    fs.writeFileSync(path.join(dir, 'schema.json'), '{}');
    await assert.rejects(capture.capturePlanningRequest({
      binary: path.join(dir, 'missing-codex'), cwd: dir, env: process.env, execArgs, frozenPath: frozen.path, timeoutMs: 1000,
    }), /spawn failed/);
    const noisy = path.join(dir, 'noisy.mjs');
    fs.writeFileSync(noisy, `#!/usr/bin/env node
process.stdout.write('x'.repeat(2048));
setTimeout(() => process.exit(1), 50);
`);
    fs.chmodSync(noisy, 0o700);
    await assert.rejects(capture.capturePlanningRequest({
      binary: noisy, cwd: dir, env: process.env, execArgs, frozenPath: frozen.path, timeoutMs: 2000, maxChildBytes: 64, killGraceMs: 150,
    }), /output exceeded|timed out|did not observe/);
    const huge = path.join(dir, 'huge-body.mjs');
    fs.writeFileSync(huge, `#!/usr/bin/env node
import http from 'node:http';
const args = process.argv.slice(2);
const flag = args.find((a, i) => args[i - 1] === '-c' && a.startsWith('model_providers.ssve_cap.base_url='));
const base = JSON.parse(flag.slice(flag.indexOf('=') + 1));
let stdin = Buffer.alloc(0);
process.stdin.on('data', (c) => { stdin = Buffer.concat([stdin, c]); });
process.stdin.on('end', () => {
  const u = new URL(base + '/responses');
  const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => { res.resume(); res.on('end', () => process.exit(1)); });
  req.end(JSON.stringify({ model: 'offline-exec', input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'x'.repeat(4096) }] }] }));
});
`);
    fs.chmodSync(huge, 0o700);
    await assert.rejects(capture.capturePlanningRequest({
      binary: huge, cwd: dir, env: process.env, execArgs, frozenPath: frozen.path, timeoutMs: 3000, maxBodyBytes: 128, killGraceMs: 150,
    }), /exceeded byte limit|did not observe|not contain/);
  });
});

test('fixture proofs require declared token_budget and frozen transport before reuse validation', () => {
  const sha = 'a'.repeat(64);
  const fixture = {
    frozen_request: { sha256: sha, byteLength: 12, transport: 'offline_fixture' },
    prompt_sha256: sha,
    prompt: 'x'.repeat(12),
    inspection_authority: 'offline_fixture',
    mode: 'OFFLINE',
    effective: { usable_live: false },
    token_budget: { checked: false, fits: false, estimated_tokens: 12 },
  };
  isolation.assertIsolationAuthority(fixture, { fixture: true });
  assert.throws(() => isolation.assertIsolationAuthority({
    ...fixture,
    token_budget: undefined,
  }, { fixture: true }), /token_budget required/);
  assert.throws(() => isolation.assertIsolationAuthority({
    ...fixture,
    token_budget: { checked: true, fits: false, estimated_tokens: 12 },
  }, { fixture: true }), /checked must be false/);
  assert.throws(() => isolation.assertIsolationAuthority({
    ...fixture,
    frozen_request: { sha256: sha, byteLength: 12 },
  }, { fixture: true }), /transport required/);
  assert.throws(() => isolation.assertIsolationAuthority({
    ...fixture,
    frozen_request: { sha256: sha, byteLength: 12, transport: 'positional_prompt_input' },
  }, { fixture: true }), /transport must be offline_fixture/);
  assert.throws(() => isolation.assertIsolationAuthority({
    ...fixture,
    frozen_request: { sha256: sha, byteLength: 11, transport: 'offline_fixture' },
  }, { fixture: true }), /byteLength must match prompt bytes/);
});
test('diagnostic capture cannot flip usable_live and live requires a qualified authority', () => {
  const sha = 'a'.repeat(64);
  assert.throws(() => isolation.assertIsolationAuthority({
    frozen_request: { sha256: sha, byteLength: 12, transport: 'native_request_capture' },
    prompt_sha256: sha,
    inspection_authority: 'diagnostic_capture_not_live',
    effective: { usable_live: true },
  }), /diagnostic capture cannot be usable_live/);
  assert.throws(() => isolation.assertIsolationAuthority({
    frozen_request: { sha256: sha, byteLength: 12, transport: 'native_request_capture' },
    prompt_sha256: sha,
    inspection_authority: 'diagnostic_capture_not_live',
    effective: { usable_live: false },
  }), /cannot authorize live planning/);
  assert.throws(() => isolation.assertIsolationAuthority({
    frozen_request: { sha256: sha, byteLength: 12, transport: 'native_request_capture' },
    prompt_sha256: sha,
    inspection_authority: 'qualified_native_request_inspect',
    capture_inference: false,
    native_profile: { sha256: 'b'.repeat(64) },
    effective: { usable_live: true },
  }, { fixture: false }), /canonical profile|binary_sha256|native profile/);
  const binarySha = 'c'.repeat(64);
  const body = {
    binary_sha256: binarySha,
    model: 'gpt-5.6-sol',
    effort: 'high',
    schema: null,
    frames: [],
    tools: [],
    tool_choice: null,
    parallel_tool_calls: null,
  };
  const profile = { ...capture.nativeProfileBody(body), sha256: capture.nativeProfileDigest(body) };
  const inspectMessages = [{ role: 'user', content: [{ type: 'input_text', text: 'x'.repeat(12) }] }];
  const envelope_bytes = capture.completeRequestBytes({
    items: inspectMessages,
    schema: null,
    semantic: profile,
  });
  const token = {
    checked: true,
    fits: true,
    estimated_tokens: freeze.conservativeTokenUpperBound(envelope_bytes),
    envelope_bytes,
    maxInputTokens: 1000,
    contextWindow: 1000,
    outputReserveTokens: 16,
  };
  const proof = {
    frozen_request: { sha256: sha, byteLength: 12, transport: 'native_request_capture' },
    prompt_sha256: sha,
    prompt: 'x'.repeat(12),
    inspection_authority: 'qualified_native_request_inspect',
    capture_inference: false,
    binary: { path: '/bin/codex', sha256: binarySha },
    native_profile: profile,
    token_budget: token,
    effective: { usable_live: true },
  };
  isolation.assertIsolationAuthority(proof, {
    fixture: false,
    requested: { model: 'gpt-5.6-sol', effort: 'high' },
    inspectMessages,
  });
  const unknown = {
    ...proof,
    token_budget: {
      ...token,
      ...freeze.assertTokenContextOutputReserve({ requestBytes: envelope_bytes, maxInputTokens: 10, contextWindow: 1000, outputReserveTokens: 16 }),
      maxInputTokens: 10,
    },
  };
  assert.equal(unknown.token_budget.fits, null);
  isolation.assertIsolationAuthority(unknown, { fixture: false, requested: { model: 'gpt-5.6-sol', effort: 'high' }, inspectMessages });
  for (const mutation of [{ fits: true }, { enforcement: undefined }, { estimate_kind: 'model_token_count' }, { estimated_tokens: 1 }, { fits: undefined }]) {
    assert.throws(() => isolation.assertIsolationAuthority({ ...unknown, token_budget: { ...unknown.token_budget, ...mutation } }, {
      fixture: false, requested: { model: 'gpt-5.6-sol', effort: 'high' }, inspectMessages,
    }), /token_budget/);
  }
  assert.throws(() => isolation.assertIsolationAuthority({
    ...proof,
    native_profile: { ...profile, sha256: 'd'.repeat(64) },
  }, { fixture: false, requested: { model: 'gpt-5.6-sol', effort: 'high' }, inspectMessages }), /canonical profile/);
  assert.throws(() => isolation.assertIsolationAuthority({
    ...proof,
    binary: { path: '/bin/codex', sha256: 'e'.repeat(64) },
  }, { fixture: false, requested: { model: 'gpt-5.6-sol', effort: 'high' }, inspectMessages }), /binary_sha256 must match/);
  assert.throws(() => isolation.assertIsolationAuthority(proof, {
    fixture: false,
    requested: { model: 'other-model', effort: 'high' },
    inspectMessages,
  }), /native profile model/);
  assert.throws(() => isolation.assertIsolationAuthority({
    ...proof,
    native_tool_advertisements: [{ sha256: 'f'.repeat(64), names: ['exec'] }],
  }, { fixture: false, requested: { model: 'gpt-5.6-sol', effort: 'high' }, inspectMessages }), /tool advertisements/);
  assert.throws(() => isolation.assertIsolationAuthority(proof, {
    fixture: false,
    requested: { model: 'gpt-5.6-sol', effort: 'high' },
    schema: { type: 'object' },
    inspectMessages,
  }), /native profile schema required/);
});

function writeEnvelopeCodex(dir) {
  const wrapper = path.join(dir, 'fake-codex-qualify.mjs');
  fs.writeFileSync(wrapper, `#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
const args = process.argv.slice(2);
const flag = args.find((a, i) => args[i - 1] === '-c' && a.startsWith('model_providers.ssve_cap.base_url='));
const base = JSON.parse(flag.slice(flag.indexOf('=') + 1));
const schema = JSON.parse(fs.readFileSync(new URL('./output-schema.json', import.meta.url)));
let stdin = Buffer.alloc(0);
process.stdin.on('data', (c) => { stdin = Buffer.concat([stdin, c]); });
process.stdin.on('end', () => {
  const get = (p) => new Promise((resolve, reject) => {
    http.get(base + p, (res) => { res.resume(); res.on('end', resolve); }).on('error', reject);
  });
  const post = (p, body) => new Promise((resolve, reject) => {
    const u = new URL(base + p);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end(body);
  });
  const cwd = process.cwd();
  const body = JSON.stringify({
    model: 'offline-exec',
    reasoning: { effort: 'max' },
    tool_choice: 'none',
    parallel_tool_calls: false,
    text: { format: { type: 'json_schema', schema } },
    input: [
      { type: 'additional_tools', tools: [{ name: 'exec' }] },
      { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '<permissions instructions>Native safety</permissions instructions>' }] },
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context><cwd>' + cwd + '</cwd></environment_context>' }] },
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: stdin.toString('utf8') }] },
    ],
  });
  get('/models').then(() => post('/responses', body)).then(() => post('/responses', body)).then(() => process.exit(1)).catch((error) => {
    fs.writeFileSync(process.env.FAKE_CODEX_ERR || '/dev/null', String(error));
    process.exit(2);
  });
});
`);
  fs.chmodSync(wrapper, 0o700);
  return wrapper;
}

test('fake capture qualifies probe and large envelopes without inference', async () => {
  await withTemp(async (dir) => {
    const schema = protocol.outputSchemaForCall('open_box');
    fs.writeFileSync(path.join(dir, 'output-schema.json'), `${JSON.stringify(schema)}\n`);
    const wrapper = writeEnvelopeCodex(dir);
    const prompt = `${'y'.repeat(131072)}`;
    const frozen = freeze.freezeRequestBytes({ bytes: Buffer.from(prompt), dir });
    const execArgs = isolation.buildCodexExecArgs({
      tuple: execTuple,
      outputSchemaPath: path.join(dir, 'output-schema.json'),
      disabledSkills: [],
    });
    const result = await capture.qualifyNativePlanningRequest({
      binary: wrapper,
      cwd: dir,
      env: { ...process.env, PATH: process.env.PATH, FAKE_CODEX_ERR: path.join(dir, 'err.txt') },
      execArgs,
      frozenPath: frozen.path,
      expectedSha256: frozen.sha256,
      timeoutMs: 8000,
      model: 'offline-exec',
      effort: 'max',
      schema,
    });
    assert.equal(result.inference, false);
    assert.equal(result.inspection_authority, 'qualified_native_request_inspect');
    assert.equal(result.retryHits >= 1, true);
    const diagnosis = isolation.diagnosePromptContamination(JSON.parse(result.inspect_json.trim()), {
      prompt, cwd: dir, profile: result.native_profile, requireEnv: true,
    });
    assert.equal(diagnosis.ok, true, JSON.stringify(diagnosis.reasons));
  });
});

test('closed Responses envelope rejects extra fields and preserves frame order', () => {
  const prompt = 'ORDERED_PROMPT_BYTES';
  const tools = [{ name: 'exec', description: 'run code' }];
  const developer = `DEVELOPER_FRAME_${'D'.repeat(64)}`;
  const env = '<environment_context><cwd>/tmp</cwd></environment_context>';
  const baseInput = [
    { type: 'additional_tools', tools },
    { type: 'message', role: 'developer', content: [{ type: 'input_text', text: developer }] },
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: env }] },
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] },
  ];
  const body = {
    model: 'offline-exec',
    reasoning: { effort: 'max', context: 'all_turns' },
    tool_choice: 'none',
    parallel_tool_calls: false,
    store: false,
    stream: true,
    include: [],
    text: { verbosity: 'low', format: { type: 'json_schema', name: 'codex_output_schema', strict: true, schema: { type: 'object' } } },
    input: baseInput,
  };
  const stable = capture.stableNativeEnvelope(body, prompt);
  assert.equal(stable.frames[0].type, 'additional_tools');
  assert.equal(stable.frames[1].role, 'developer');
  assert.equal(stable.frames[2].role, 'user');
  assert.equal(stable.tools[0], stable.frames[0].sha256);
  const reordered = capture.stableNativeEnvelope({
    ...body,
    input: [baseInput[1], baseInput[0], baseInput[2], baseInput[3]],
  }, prompt);
  assert.notEqual(
    capture.nativeProfileFromStable(stable).sha256,
    capture.nativeProfileFromStable(reordered).sha256,
  );
  assert.throws(() => capture.stableNativeEnvelope({ ...body, truncation: 'auto' }, prompt), /unrecognized Responses field truncation/);
  assert.throws(() => capture.stableNativeEnvelope({
    ...body,
    input: [{ type: 'message', role: 'user', status: 'completed', content: [{ type: 'input_text', text: prompt }] }],
  }, prompt), /unrecognized captured message field status/);
  assert.throws(() => capture.stableNativeEnvelope({
    ...body,
    input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt, annotations: [] }] }],
  }, prompt), /unrecognized captured content field annotations/);
  const withCache = capture.nativeProfileFromStable(capture.stableNativeEnvelope({ ...body, prompt_cache_key: 'cache-a' }, prompt));
  const otherCache = capture.nativeProfileFromStable(capture.stableNativeEnvelope({ ...body, prompt_cache_key: 'cache-b' }, prompt));
  assert.equal(withCache.prompt_cache_key, 'string');
  assert.equal(withCache.sha256, otherCache.sha256);
  const withMeta = capture.nativeProfileFromStable(capture.stableNativeEnvelope({ ...body, client_metadata: { session: 'one' } }, prompt));
  const otherMeta = capture.nativeProfileFromStable(capture.stableNativeEnvelope({ ...body, client_metadata: { session: 'two' } }, prompt));
  assert.equal(withMeta.sha256, otherMeta.sha256);
  const extraMetaKey = capture.nativeProfileFromStable(capture.stableNativeEnvelope({ ...body, client_metadata: { session: 'one', extra: true } }, prompt));
  assert.notEqual(withMeta.sha256, extraMetaKey.sha256);
  assert.notEqual(
    Buffer.byteLength(JSON.stringify({ ...body, prompt_cache_key: 'cache-a' })),
    Buffer.byteLength(JSON.stringify({ ...body, prompt_cache_key: 'cache-bb' })),
  );
});

test('complete request bytes count the serialized envelope, not digest summaries', () => {
  const prompt = 'P'.repeat(100);
  const developer = 'D'.repeat(500);
  const tools = [{ name: 'exec', description: 'x'.repeat(200) }];
  const schema = { type: 'object', additionalProperties: false, required: ['plan'], properties: { plan: { type: 'string' } } };
  const items = [
    { type: 'additional_tools', tools },
    { type: 'message', role: 'developer', content: [{ type: 'input_text', text: developer }] },
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] },
  ];
  const semantic = { model: 'gpt-5.6-sol', effort: 'high', store: false, stream: true };
  const measured = capture.completeRequestBytes({ items, schema, semantic });
  const hashSummary = Buffer.byteLength(protocol.canonicalJson({
    frames: [{ role: 'developer', sha256: 'a'.repeat(64) }],
    schema,
    tools: ['b'.repeat(64)],
  }), 'utf8');
  assert.equal(measured > hashSummary, true);
  assert.equal(measured > Buffer.byteLength(prompt, 'utf8') + Buffer.byteLength(developer, 'utf8'), true);
  freeze.assertTokenContextOutputReserve({
    requestBytes: Buffer.byteLength(prompt),
    maxInputTokens: 250,
    contextWindow: 280,
    outputReserveTokens: 16,
  });
  assert.equal(freeze.assertTokenContextOutputReserve({
    requestBytes: measured,
    maxInputTokens: 250,
    contextWindow: 280,
    outputReserveTokens: 16,
    requireChecked: true,
  }).fits, null);
  const padded = capture.completeRequestBytes({
    items,
    schema,
    semantic: { ...semantic, client_metadata: { pad: 'x'.repeat(400) } },
  });
  assert.equal(padded > measured, true);
  freeze.assertTokenContextOutputReserve({
    requestBytes: measured,
    maxInputTokens: measured + 50,
    contextWindow: measured + 80,
    outputReserveTokens: 16,
  });
  assert.equal(freeze.assertTokenContextOutputReserve({
    requestBytes: padded,
    maxInputTokens: measured + 50,
    contextWindow: measured + 80,
    outputReserveTokens: 16,
    requireChecked: true,
  }).fits, null);
  const capturedBody = measured + 80;
  assert.equal(capture.completeRequestBytes({ items, schema, semantic, capturedBodyBytes: capturedBody }), capturedBody);
  const binarySha = 'c'.repeat(64);
  const body = {
    binary_sha256: binarySha,
    model: 'gpt-5.6-sol',
    effort: 'high',
    schema,
    frames: capture.framesFromInspectMessages(items, prompt),
    tools: [protocol.sha256Bytes(Buffer.from(protocol.canonicalJson(tools), 'utf8'))],
    tool_choice: null,
    parallel_tool_calls: null,
  };
  const profile = { ...capture.nativeProfileBody(body), sha256: capture.nativeProfileDigest(body) };
  const measuredProof = capture.completeRequestBytes({ items, schema, semantic: profile });
  const sha = 'a'.repeat(64);
  assert.throws(() => isolation.assertIsolationAuthority({
    frozen_request: { sha256: sha, byteLength: Buffer.byteLength(prompt), transport: 'native_request_capture' },
    prompt_sha256: sha,
    prompt,
    inspection_authority: 'qualified_native_request_inspect',
    capture_inference: false,
    binary: { path: '/bin/codex', sha256: binarySha },
    native_profile: profile,
    token_budget: {
      checked: true,
      fits: true,
      estimated_tokens: Buffer.byteLength(prompt),
      envelope_bytes: 0,
      maxInputTokens: 100000,
      contextWindow: 100000,
      outputReserveTokens: 16,
    },
    effective: { usable_live: true },
  }, {
    fixture: false,
    requested: { model: 'gpt-5.6-sol', effort: 'high' },
    schema,
    inspectMessages: items,
  }), /envelope_bytes does not match the complete captured request/);
  isolation.assertIsolationAuthority({
    frozen_request: { sha256: sha, byteLength: Buffer.byteLength(prompt), transport: 'native_request_capture' },
    prompt_sha256: sha,
    prompt,
    inspection_authority: 'qualified_native_request_inspect',
    capture_inference: false,
    binary: { path: '/bin/codex', sha256: binarySha },
    native_profile: profile,
    native_tool_advertisements: body.tools,
    token_budget: {
      checked: true,
      fits: true,
      estimated_tokens: measuredProof,
      envelope_bytes: measuredProof,
      maxInputTokens: 100000,
      contextWindow: 100000,
      outputReserveTokens: 16,
    },
    effective: { usable_live: true },
  }, {
    fixture: false,
    requested: { model: 'gpt-5.6-sol', effort: 'high' },
    schema,
    inspectMessages: items,
  });
});

test('ordinary review file and stream share frozen identity through 1.23MB', async () => {
  await withTemp(async (dir) => {
    const prefix = Buffer.from('REVIEW_UTF8 café $HOME\n');
    const bytes = Buffer.concat([prefix, Buffer.alloc(1235010 - prefix.length, 0x61)]);
    const file = path.join(dir, 'review.bin');
    fs.writeFileSync(file, bytes);
    const fromFile = await readReviewInput({ inputFile: file });
    const fromStream = await readReviewInput({}, Readable.from([bytes.subarray(0, 600000), bytes.subarray(600000)]));
    assert.equal(protocol.sha256Bytes(fromFile), protocol.sha256Bytes(fromStream));
    assert.equal(fromFile.length, 1235010);
    assert.equal(fromFile.includes(Buffer.from('café', 'utf8')), true);
  });
});

test('retained native 1MiB qualification evidence is complete and never claims inference', () => {
  const evidence = JSON.parse(fs.readFileSync(new URL('../../docs/specs/evidence/framework-large-input/native-1mib-inspect.json', import.meta.url)));
  assert.equal(evidence.evidence_class, 'native_no_inference_1mib');
  assert.equal(evidence.inference_calls, 0);
  assert.equal(evidence.frozen_request.byteLength, 1048576);
  assert.match(evidence.frozen_request.sha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.frozen_request.transport, 'native_request_capture');
  assert.equal(evidence.inspection_authority, 'qualified_native_request_inspect');
  assert.equal(evidence.capture_inference, false);
  if (evidence.token_budget.enforcement === 'native_runner') {
    assert.equal(evidence.usable_live, true);
    assert.equal(evidence.token_budget.fits, null);
    assert.equal(evidence.token_budget.estimate_kind, 'utf8_byte_upper_bound');
  } else {
    assert.equal(evidence.token_budget.enforcement == null, true);
    assert.equal(evidence.usable_live, false);
    assert.equal(evidence.token_budget.fits, false);
  }
  assert.equal(evidence.token_budget.checked, true);
  assert.equal(Number.isInteger(evidence.token_budget.contextWindow), true);
});
