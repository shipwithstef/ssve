// @organism-suite
// X3 safety regressions: secret redaction in topology snapshots, no auto-commit/push
// in research and assess-market-readiness, approval-gated install in discover-skills.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {symlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {REDACTED, redactSnapshot, diffSnapshots} from '../../skills/track-topology-diff/scripts/redact-topology.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// ---------- 1. track-topology-diff ----------
const PLAIN = 'c3VwZXItc2VjcmV0LXZhbHVl';
const secretManifest = {
  apiVersion: 'v1',
  kind: 'List',
  items: [
    {
      apiVersion: 'v1', kind: 'Secret', type: 'Opaque',
      metadata: {
        name: 'db-creds', namespace: 'prod',
        annotations: {'kubectl.kubernetes.io/last-applied-configuration': `{"data":{"password":"${PLAIN}"}}`},
      },
      data: {password: PLAIN, username: 'YWRtaW4='},
      stringData: {token: 'plain-token-123'},
    },
    {
      apiVersion: 'apps/v1', kind: 'Deployment', metadata: {name: 'api', namespace: 'prod'},
      spec: {template: {spec: {containers: [{
        name: 'api', image: 'api:1',
        env: [
          {name: 'DB_PASSWORD', value: 'hunter2-literal'},
          {name: 'LOG_LEVEL', value: 'debug'},
          {name: 'TOKEN', valueFrom: {secretKeyRef: {name: 'db-creds', key: 'password'}}},
        ],
      }]}}},
    },
    {apiVersion: 'v1', kind: 'ConfigMap', metadata: {name: 'cfg'}, data: {mode: 'fast'}},
  ],
};

test('Secret data and stringData values are redacted; keys and metadata kept', () => {
  const out = redactSnapshot(structuredClone(secretManifest));
  const s = out.items[0];
  assert.deepEqual(Object.keys(s.data), ['password', 'username']);
  assert.ok(Object.values(s.data).every((v) => v === REDACTED));
  assert.equal(s.stringData.token, REDACTED);
  assert.equal(s.metadata.name, 'db-creds');
  assert.equal(s.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'], REDACTED);
  const text = JSON.stringify(out);
  for (const leak of [PLAIN, 'YWRtaW4=', 'plain-token-123', 'hunter2-literal']) {
    assert.ok(!text.includes(leak), `leaked ${leak}`);
  }
});

test('non-secret values and secret references survive redaction', () => {
  const out = redactSnapshot(structuredClone(secretManifest));
  const env = out.items[1].spec.template.spec.containers[0].env;
  assert.equal(env[0].value, REDACTED);
  assert.equal(env[1].value, 'debug');
  assert.deepEqual(env[2].valueFrom.secretKeyRef, {name: 'db-creds', key: 'password'});
  assert.equal(out.items[2].data.mode, 'fast'); // ConfigMap is not a secret
});

test('a bare Secret object and terraform sensitive_values are redacted', () => {
  const bare = redactSnapshot({kind: 'Secret', data: {k: 'v'}});
  assert.equal(bare.data.k, REDACTED);
  const tf = redactSnapshot({resources: [{type: 'aws_db_instance', values: {identifier: 'main', password: 'pw-literal', nested: {api_key: 'abc'}}, sensitive_values: {password: true}}]});
  assert.equal(tf.resources[0].values.password, REDACTED);
  assert.equal(tf.resources[0].values.nested.api_key, REDACTED);
  assert.equal(tf.resources[0].values.identifier, 'main');
});

test('last-applied-configuration is redacted on every resource kind', () => {
  const leak = 'lit-pw-9f3';
  const annotated = (kind, extra) => ({kind, metadata: {name: 'x', annotations: {'kubectl.kubernetes.io/last-applied-configuration': JSON.stringify({kind, ...extra}), keep: 'ok'}}});
  const dep = annotated('Deployment', {spec: {containers: [{env: [{name: 'DB_PASSWORD', value: leak}, {name: 'MODE', value: 'fast'}]}]}});
  const cm = annotated('ConfigMap', {data: {password: leak, mode: 'fast'}});
  const out = redactSnapshot({items: [dep, cm]});
  const text = JSON.stringify(out);
  assert.ok(!text.includes(leak), 'credential survived in annotation');
  for (const it of out.items) {
    const a = it.metadata.annotations;
    assert.equal(a.keep, 'ok');
    const v = a['kubectl.kubernetes.io/last-applied-configuration'];
    assert.ok(v === REDACTED || JSON.parse(v), 'annotation is redacted or valid redacted JSON');
  }
  const unparsable = redactSnapshot({kind: 'Deployment', metadata: {annotations: {'kubectl.kubernetes.io/last-applied-configuration': `not json ${leak}`}}});
  assert.ok(!JSON.stringify(unparsable).includes(leak));
});

test('terraform outputs marked sensitive lose their value', () => {
  const out = redactSnapshot({values: {outputs: {db_url: {sensitive: true, type: 'string', value: 'postgres://u:pw@h/db'}, region: {sensitive: false, type: 'string', value: 'eu-west-1'}, cfg: {sensitive: true, value: {a: ['x', 'y']}}}}});
  assert.equal(out.values.outputs.db_url.value, REDACTED);
  assert.equal(out.values.outputs.db_url.type, 'string');
  assert.equal(out.values.outputs.region.value, 'eu-west-1');
  assert.deepEqual(out.values.outputs.cfg.value, {a: [REDACTED, REDACTED]});
});

test('sensitive_values redacts ordinary keys, including nested arrays', () => {
  const tf = {resources: [{type: 't', values: {identifier: 'main', owner: 'alice-literal', endpoints: [{host: 'h1-literal', port: 5432}, {host: 'h2-literal', port: 5433}], flags: ['f1-literal', 'f2-literal']}, sensitive_values: {owner: true, endpoints: [{host: true}, {host: true}], flags: [true, false]}}]};
  const v = redactSnapshot(tf).resources[0].values;
  assert.equal(v.identifier, 'main');
  assert.equal(v.owner, REDACTED);
  assert.deepEqual(v.endpoints, [{host: REDACTED, port: 5432}, {host: REDACTED, port: 5433}]);
  assert.deepEqual(v.flags, [REDACTED, 'f2-literal']);
});

test('diff output never contains secret values', () => {
  const before = structuredClone(secretManifest);
  const after = structuredClone(secretManifest);
  after.items[0].data.password = 'bmV3LXNlY3JldA==';
  after.items[0].data.extra = 'ZXh0cmE=';
  const md = diffSnapshots(before, after, {from: 't1', to: 't2'});
  assert.match(md, /^# Topology Diff/);
  assert.match(md, /extra/); // key addition is visible
  for (const leak of [PLAIN, 'bmV3LXNlY3JldA==', 'ZXh0cmE=', 'plain-token-123']) {
    assert.ok(!md.includes(leak), `diff leaked ${leak}`);
  }
});

test('CLI redacts stdin JSON and fails closed on invalid JSON', () => {
  const script = join(root, 'skills/track-topology-diff/scripts/redact-topology.mjs');
  const ok = spawnSync('node', [script], {input: JSON.stringify(secretManifest), encoding: 'utf8'});
  assert.equal(ok.status, 0);
  assert.ok(!ok.stdout.includes(PLAIN));
  assert.ok(ok.stdout.includes(REDACTED));
  const bad = spawnSync('node', [script], {input: 'password=hunter2', encoding: 'utf8'});
  assert.notEqual(bad.status, 0);
  assert.equal(bad.stdout, '');
});

test('CLI body runs when invoked through a symlink', () => {
  const dir = mkdtempSync(join(tmpdir(), 'x3-link-'));
  const link = join(dir, 'redact-link.mjs');
  symlinkSync(join(root, 'skills/track-topology-diff/scripts/redact-topology.mjs'), link);
  const r = spawnSync('node', [link], {input: JSON.stringify(secretManifest), encoding: 'utf8'});
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes(REDACTED) && !r.stdout.includes(PLAIN));
});

test('track-topology-diff SKILL.md routes kubectl output through the redactor and bans raw secret dumps', () => {
  const md = readFileSync(join(root, 'skills/track-topology-diff/SKILL.md'), 'utf8');
  assert.match(md, /redact-topology\.mjs/);
  const raw = md.split('\n').filter((l) => /kubectl get [^\n]*secret/.test(l) && !/redact-topology/.test(l));
  assert.deepEqual(raw, [], 'a kubectl secret fetch is not routed through the redactor');
});

// ---------- 2 & 4. no auto commit/push ----------
const NEGATION = /\b(do not|does not|don't|never|must not|not auto|no auto|without being asked|without an explicit)\b/i;
const CMD = /\bgit\s+(-\S+\s+)*(commit|push|tag|add)\b|"git (commit|push|tag)"|\bgh pr (create|merge)\b/;
const PROSE = /Commit, Tag|commit, tag|and push\b|Committed,? (and )?(tagged|pushed|to git)|Commit the assessment|commit it so|commit after the pass|pushed\b/i;

function offenders(skill) {
  const bad = [];
  for (const f of walk(join(root, 'skills', skill))) {
    if (!/\.(md|mjs|js|sh)$/.test(f)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (NEGATION.test(line)) return;
      const hit = f.endsWith('.md') ? (CMD.test(line) || PROSE.test(line)) : /['"`]git['"`]\s*,\s*\[?['"`](commit|push|tag|add)\b|\bgit (commit|push|tag)\b/.test(line);
      if (hit) bad.push(`${f.slice(root.length + 1)}:${i + 1}: ${line.trim()}`);
    });
  }
  return bad;
}

for (const skill of ['research', 'assess-market-readiness']) {
  test(`${skill} instructs no automatic git commit/push/tag`, () => {
    assert.deepEqual(offenders(skill), []);
  });
  test(`${skill} tells the user to review and commit themselves`, () => {
    const md = readFileSync(join(root, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.match(md, /(does not|never|do not) (auto-)?(commit|run `?git)/i);
  });
}

// ---------- 3. discover-skills approval ----------
test('discover-skills install is approval-gated; no auto-install', () => {
  const md = readFileSync(join(root, 'skills/discover-skills/SKILL.md'), 'utf8');
  assert.match(md, /^\s*human_checkpoint:\s*true\s*$/m);
  assert.ok(!/Install the highest-relevance[^\n]*automatically/i.test(md), 'auto-install instruction present');
  assert.ok(!/\*\*Auto mode:\*\*\s*\n\s*Install/i.test(md));
  const body = md.split(/\n### Step 5/)[1];
  assert.ok(body, 'Step 5 present');
  const step5 = body.split(/\n### Step 6/)[0];
  const idxCmd = step5.indexOf('npx skills add');
  const idxGate = step5.search(/explicit (user )?approval/i);
  assert.ok(idxGate >= 0 && idxCmd > idxGate, 'approval gate must precede the install command');
  assert.match(step5, /Never install without/i);
  // every other mention of the install command must be inside a negation or the gated step
  const rest = md.replace(step5, '');
  assert.ok(!/npx skills add/.test(rest.split('\n').filter((l) => !NEGATION.test(l)).join('\n')));
});
