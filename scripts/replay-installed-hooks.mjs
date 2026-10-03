#!/usr/bin/env node
// Offline activation gate. Execute hooks, NEVER the submitted tool commands.
// Only installer-owned temporary HOME/configs are mutated. Raw private samples
// stay in the ignored evidence directory; frozen expectations never change here.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseManagedCommand, isBlockingPayload } from '../hooks/svc-hook-boundary.mjs';
import { evaluatePreToolObservation } from '../hooks/lib/pretool-decision-engine.mjs';
import { writeJsonAtomic, writeJsonlAtomic, appendJsonlLine } from './state-io.mjs';
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (key, fallback) => argv.includes(key) ? argv[argv.indexOf(key) + 1] : fallback;
const samplesFile = opt('--samples'), out = opt('--out');
if (!samplesFile || !out) throw Error('Usage: replay-installed-hooks.mjs --samples <frozen private JSON> --out <evidence directory> [--jobs 6]');
const jobs = Number(opt('--jobs', 6));
assert.ok(Number.isInteger(jobs) && jobs > 0 && jobs <= 8);
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
const sampleBytes = fs.readFileSync(samplesFile);
const sampleHash = crypto.createHash('sha256').update(sampleBytes).digest('hex');
const samples = JSON.parse(sampleBytes);
assert.equal(samples.rows.filter(r => r.group === 'prepared').length, 50);
assert.equal(samples.rows.filter(r => r.group === 'additional').length, 200);
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'side01-offline-'));
const repo = path.join(home, 'governed'), scratch = path.join(home, 'scratch');
const env = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: home, USER: process.env.USER || '', LOGNAME: process.env.LOGNAME || '',
  CODEX_HOME: path.join(home, '.codex'), SVC_RUNTIME_DIR: path.join(home, 'runtime'), SVC_CODEX_RUNTIME_DIR: path.join(home, 'codex-runtime'),
  SVC_HOOK_MODE: 'advisory', SVC_SESSION_SCRATCHPAD: path.join(samples.owner_home, '.local/state/orch'),
  SVC_HOOK_POLICY: '', SVC_SESSION_ID: '', CLAUDE_SESSION_ID: '', CODEX_THREAD_ID: '' };
for (const dir of [repo, scratch, env.SVC_RUNTIME_DIR, env.SVC_CODEX_RUNTIME_DIR, path.join(home, '.local/state/orch')]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
for (const dir of [home, repo]) assert.equal(spawnSync('git', ['init', '-q', dir]).status, 0);
fs.mkdirSync(path.join(repo, '.svc'));
fs.writeFileSync(path.join(repo, 'input.txt'), 'read me\n');
const logFile = path.join(out, 'installed-replays.jsonl');
writeJsonlAtomic(logFile, []); fs.chmodSync(logFile, 0o600);
const failures = [], counts = { fixtures: 0, prepared: 0, additional: 0, read_envelopes: 0, read_hook_calls: 0, mutation_envelopes: 0, unproven_envelopes: 0, mutation_hook_calls: 0, paired_mutation_envelopes: 0, successful_hook_calls: 0 };
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function inputFiles(dir) {
  return fs.readdirSync(path.join(source, dir), { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? inputFiles(p) : d.isFile() ? [p] : [];
  });
}
const sourceInputs = ['setup', 'skills-manifest.json', 'test-framework/evals/tier-1/goal-delivery-hooks.test.mjs', 'test-framework/tests/hook-advisory-noise.test.mjs',
  ...['hooks', 'scripts', 'provision', 'rules', 'test-framework/evals/fixtures/side01'].flatMap(inputFiles)];
const inputHashes = Object.fromEntries(sourceInputs.map(p => [p, digest(fs.readFileSync(path.join(source, p)))]));
function run(file, args, input, childEnv = env, cwd = repo, timeout = 35000) {
  return new Promise(resolve => {
    let stdout = '', stderr = '', timedOut = false;
    const child = spawn(file, args, { env: childEnv, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.stdout.on('data', b => { stdout += b; if (stdout.length > 1024 * 1024) child.kill('SIGKILL'); });
    child.stderr.on('data', b => { stderr += b; if (stderr.length > 1024 * 1024) child.kill('SIGKILL'); });
    child.on('error', e => { stderr += e.message; });
    child.on('close', exit => { clearTimeout(timer); resolve({ exit, stdout, stderr, timedOut }); });
    child.stdin.on('error', () => {}); child.stdin.end(input || '');
  });
}
async function batch(rows, work) {
  let index = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (index < rows.length) { const row = rows[index++]; try { await work(row); } catch (e) { failures.push({ id: row.id, error: e.message }); } } }));
}
function snapshot(root) {
  return fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(d => {
    const p = path.join(root, d.name);
    return d.isDirectory() ? snapshot(p).map(v => d.name + '/' + v) : [d.name + ':' + (d.isSymbolicLink() ? fs.readlinkSync(p) : digest(fs.readFileSync(p)))];
  });
}
let configs = {};
function hooksFor(host, payload, mutation = false) {
  const name = payload.tool_name || payload.toolName || 'Shell';
  // Codex's recorded installed dispatcher receives code-mode through its Bash
  // bridge. Keep the original payload; select the same entrypoint as activation.
  const matchedName = host === 'codex' && ['exec', 'functions.exec', 'exec_command', 'shell'].includes(name) ? 'Bash' : name;
  const list = [];
  for (const [event, groups] of Object.entries(configs[host])) {
    if (host === 'cursor') {
      if (event !== 'preToolUse' && !(event === 'beforeShellExecution' && ['Shell', 'Bash', 'shell'].includes(name))) continue;
    } else if (event !== 'PreToolUse' && (mutation || event !== 'PostToolUse')) continue;
    for (const group of groups) {
      if (group.matcher && group.matcher !== '*' && !new RegExp(group.matcher).test(matchedName)) continue;
      for (const h of group.hooks || [group]) if (h.command?.includes('svc-hook-boundary')) list.push({ event, command: h.command });
    }
  }
  assert.ok(list.length, `No installed entrypoint for ${host}/${name}`);
  return list;
}
async function invoke(row, mode, mutation = false) {
  const childEnv = { ...env, SVC_HOST: row.host, SVC_HOOK_MODE: mode, ...(row.scratchpad ? { SVC_SESSION_SCRATCHPAD: row.scratchpad } : {}) };
  const results = [];
  for (const entry of hooksFor(row.host, row.payload, mutation)) {
    let p = { ...row.payload, hook_event_name: entry.event };
    if (row.host === 'cursor' && entry.event === 'beforeShellExecution' && !p.command) p = { ...p, command: p.tool_input?.command || p.tool_input?.cmd };
    const cmd = parseManagedCommand(entry.command, childEnv);
    const result = await run(cmd.file, cmd.args, JSON.stringify(p), cmd.env);
    appendJsonlLine(logFile, { id: row.id, group: row.group, expected: row.expected, host: row.host, mode, ...entry, payload: p, ...result });
    assert.equal(result.timedOut, false, 'Hook timeout');
    results.push(result);
    if (mutation) counts.mutation_hook_calls++; else counts.read_hook_calls++;
  }
  return results;
}
const warning = /\[svc advisory\b|AUTH_BINDING_|invalid mutation operation scope|\[SSVE CIRCUIT BREAKER\]/i;
function denial(result) {
  if (result.exit === 2) return true;
  try { return isBlockingPayload(JSON.parse(result.stdout)); } catch { return false; }
}
function relocated(row, mode) {
  const p = structuredClone(row.payload), sid = `offline-${row.id}-${mode}`;
  p.cwd = repo; p.session_id = sid;
  if (p.conversation_id) p.conversation_id = sid;
  if (p.workspace_roots) p.workspace_roots = [repo];
  if (p.tool_input && typeof p.tool_input === 'object') {
    for (const key of ['workdir', 'cwd', 'working_directory']) if (key in p.tool_input) p.tool_input[key] = repo;
    for (const key of ['file_path', 'path', 'target_directory']) if (key in p.tool_input) p.tool_input[key] = path.join(repo, 'mutation-target');
  }
  if (typeof p.tool_input === 'string') {
    const originalCwd = row.payload.cwd || row.payload.workspace_roots?.[0];
    if (originalCwd && path.isAbsolute(originalCwd)) p.tool_input = p.tool_input.replaceAll(originalCwd, repo);
  }
  return { ...row, payload: p };
}
try {
  const install = [];
  for (const [host, wirer] of [['claude', 'wire-hooks.mjs'], ['codex', 'wire-codex-hooks.mjs'], ['cursor', 'wire-cursor-hooks.mjs']]) {
    const skills = path.join(home, '.' + host, 'skills'); fs.mkdirSync(path.dirname(skills), { recursive: true, mode: 0o700 }); fs.symlinkSync(source, skills);
    for (const stage of ['materialize', 'wire', 'finalize']) {
      const args = stage === 'wire' ? [path.join(source, 'scripts', wirer), '--skills-path', skills]
        : [path.join(source, 'scripts/svc-migrate-install.mjs'), 'materialize', '--host', host, '--repo-root', source, '--skills-path', skills, '--json'];
      const result = await run(process.execPath, args, '', env, source);
      install.push({ host, stage, file: process.execPath, args, ...result });
      assert.equal(result.exit, 0, `${host}/${stage}: ${result.stderr}`);
    }
    const configFile = path.join(home, '.' + host, host === 'claude' ? 'settings.json' : 'hooks.json');
    configs[host] = JSON.parse(fs.readFileSync(configFile)).hooks;
    const receipt = JSON.parse(fs.readFileSync(path.join(home, `.svc/install-state/${host}.json`)));
    assert.equal(receipt.effective_source, source); assert.equal(receipt.governed_routed, true); assert.equal(receipt.hooks_installed, true);
  }
  for (const [name, value] of [['install.json', install], ['installed-commands.json', configs]]) {
    writeJsonAtomic(path.join(out, name), value); fs.chmodSync(path.join(out, name), 0o600);
  }
  const bundle = path.join(home, '.svc/enforcement/1');
  assert.equal(JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json'))).effective_source, source);
  for (const rel of ['hooks/svc-hook-boundary.mjs', 'hooks/lib/hook-policy.mjs', 'hooks/lib/session-findings.mjs', 'hooks/lib/svc-runtime-root.mjs', 'hooks/codex/lib/argv-lex.mjs']) assert.equal(digest(fs.readFileSync(path.join(bundle, rel))), digest(fs.readFileSync(path.join(source, rel))));
  process.stdout.write('Official materialize/wire/finalize + receipt/bundle verification: PASS (3 hosts)\n');
  const fixtureRoot = path.join(source, 'test-framework/evals/fixtures/side01');
  const reads = [];
  const commands = ['cat input.txt', 'grep read input.txt', 'ls -la', 'git log -1', 'git status --short', 'pwd && ls; cat input.txt', 'rg --no-config -n "alpha|beta" input.txt || true', "sed -n '1,3p' input.txt", 'cat input.txt > /tmp/side01-output', 'cat input.txt >> /tmp/side01-output', `cat input.txt > ${home}/.local/state/orch/output`, `cat input.txt > ${scratch}/output`];
  for (let i = 0; i < 1000; i++) {
    const host = ['codex', 'claude', 'cursor'][i % 3], command = commands[i % commands.length];
    let p = { session_id: 'fixture-read', cwd: repo, tool_name: host === 'claude' ? 'Bash' : 'exec_command', tool_input: { cmd: command, workdir: repo } };
    if (host === 'claude') p.tool_input = { command };
    if (host === 'cursor') p = { conversation_id: 'fixture-read', workspace_roots: [repo], command, tool_name: 'Shell', tool_input: { command } };
    if (host === 'codex' && i % 7 === 0) p = { ...p, tool_name: 'functions.exec', tool_input: `text(await tools.exec_command(${JSON.stringify(p.tool_input, null, i % 2 ? 2 : 0)}));` };
    reads.push({ id: 'fixture-' + i, group: 'fixtures', host, expected: 'read', payload: p, scratchpad: scratch });
  }
  for (const filename of ['installed-failure.json', 'installed-output-failure.json']) {
    const f = JSON.parse(fs.readFileSync(path.join(fixtureRoot, filename)));
    reads.push({ id: filename, group: 'fixtures', host: f.host, expected: 'read', payload: f.payload });
  }
  for (const f of JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'native-code-envelopes.json')))) {
    for (const name of ['exec', 'functions.exec']) reads.push({ id: `native-${f.shape}-${name}`, group: 'fixtures', host: 'codex', expected: 'read', payload: { session_id: 'native-read', cwd: repo, tool_name: name, tool_input: f.tool_input.replaceAll('@REPO@', repo) } });
  }
  // Retain all earlier installed recorded read replays as exact regression data.
  // The original HOME's orch root also contains the recorded session scratch
  // directory. Preserve that full allowed root when virtualizing HOME; narrowing
  // it to one historical session would invalidate sibling orch output paths.
  for (const f of JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'installed-read-replays.json')))) reads.push({ id: 'recorded-' + reads.length, group: 'fixtures', host: f.host, expected: 'read', payload: f.payload });
  reads.push(...samples.rows.filter(r => r.expected === 'read'));
  const before = { repo: snapshot(repo), runtime: snapshot(env.SVC_RUNTIME_DIR), codex: snapshot(env.SVC_CODEX_RUNTIME_DIR) };
  // Real samples stay unchanged, including original paths. No tool command is
  // executed, and the proof precondition prevents recovery touching real repos.
  await batch(reads, async row => {
    assert.ok(evaluatePreToolObservation(row.payload, { ...env, ...(row.scratchpad ? { SVC_SESSION_SCRATCHPAD: row.scratchpad } : {}) }), 'Frozen expected read is not proven; do not relabel or drop it');
    for (const mode of ['advisory', 'enforce']) {
      const results = await invoke(row, mode);
      for (const r of results) { assert.equal(r.exit, 0); assert.equal(r.stderr, ''); assert.equal(warning.test(r.stdout), false); assert.equal(denial(r), false); counts.successful_hook_calls++; }
    }
    counts[row.group]++; counts.read_envelopes++;
  });
  assert.deepEqual(snapshot(repo), before.repo); assert.deepEqual(snapshot(env.SVC_RUNTIME_DIR), before.runtime); assert.deepEqual(snapshot(env.SVC_CODEX_RUNTIME_DIR), before.codex);
  process.stdout.write(`Read replay: ${counts.read_envelopes} envelopes / ${counts.read_hook_calls} installed calls; ${failures.length} failures\n`);
  const controls = samples.rows.filter(r => r.expected !== 'read');
  // Every real read also receives a clearly marked mutation counterpart.
  for (const r of samples.rows.filter(r => r.expected === 'read')) {
    const p = structuredClone(r.payload);
    if (['exec', 'functions.exec'].includes(p.tool_name)) p.tool_input += '; await tools.exec_command({cmd:"touch side01-mutation"});';
    else { p.tool_name = r.host === 'claude' ? 'Bash' : 'Shell'; p.tool_input = { command: 'touch side01-mutation' }; delete p.command; }
    controls.push({ ...r, id: 'paired-' + r.id, group: 'paired', expected: 'mutation', payload: p });
  }
  await batch(controls, async row => {
    for (const mode of ['advisory', 'enforce']) {
      const isolated = relocated(row, mode);
      const results = await invoke(isolated, mode, true);
      if (mode === 'advisory') { assert.ok(results.some(r => /\[svc advisory\b/.test(r.stderr)), 'Governed input lacked advisory'); assert.ok(results.every(r => r.exit === 0 && !denial(r))); }
      else assert.ok(results.some(denial), 'Governed input lacked enforce denial');
      counts.successful_hook_calls += results.length;
    }
    if (row.group === 'paired') counts.paired_mutation_envelopes++;
    else { counts[row.group]++; if (row.expected === 'unproven') counts.unproven_envelopes++; else counts.mutation_envelopes++; }
  });
  assert.equal(fs.existsSync(path.join(repo, 'side01-mutation')), false);
  // Includes every remaining inline negative/dedupe/contract/rule fixture.
  const focused = await run(process.execPath, ['--test', path.join(source, 'test-framework/evals/tier-1/goal-delivery-hooks.test.mjs')], '', { ...env, PATH: process.env.PATH }, source, 180000);
  fs.writeFileSync(path.join(out, 'goal-delivery-hooks.log'), focused.stdout + focused.stderr, { mode: 0o600 });
  assert.equal(focused.exit, 0, 'Goal-delivery fixture suite failed');
  assert.equal(counts.prepared, 50); assert.equal(counts.additional, 200);
} catch (e) { failures.push({ id: 'gate', error: e.message }); }
finally {
  for (const [p, hash] of Object.entries(inputHashes)) if (digest(fs.readFileSync(path.join(source, p))) !== hash) failures.push({ id: 'source-stability', error: `Source changed during replay: ${p}` });
  if (digest(fs.readFileSync(samplesFile)) !== sampleHash) failures.push({ id: 'sample-stability', error: 'Frozen samples changed during replay' });
  const summary = { result: failures.length ? 'FAIL' : 'PASS', source, input_hashes: inputHashes, sample_sha256: sampleHash, inventory: samples.inventory, counts, failures, global_activation: false, submitted_tool_commands_executed: 0 };
  writeJsonAtomic(path.join(out, 'replay-summary.json'), summary); fs.chmodSync(path.join(out, 'replay-summary.json'), 0o600);
  console.log(JSON.stringify({ result: summary.result, counts, failures, sample_sha256: summary.sample_sha256, source_input_files: Object.keys(inputHashes).length, global_activation: false }));
  fs.rmSync(home, { recursive: true, force: true });
  if (failures.length) process.exitCode = 1;
}
