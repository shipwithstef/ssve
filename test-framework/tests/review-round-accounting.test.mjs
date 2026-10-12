// @organism-suite
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { putObject, putRelocation, getObject, lookupRelocation, relocatePath, resolveEvidenceBytes } from '../../scripts/lib/review-evidence-store.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acquireLock } from '../../scripts/state-lock.mjs';
import { boundEvidenceBytes, roundOutputDigest } from '../../scripts/lib/reviewer-evidence.mjs';
import { admitExternalReviewRound, externalReviewCycleCapacity, reserveExternalReviewRound } from '../../scripts/lib/external-review-provenance.mjs';
import { invoke, runProcess, AGY_REVIEWER_SPAWNED_MARKER } from '../../scripts/run-external-review.mjs';

function storeOpts(root) {
  const env = { ...process.env, SVC_REVIEW_EVIDENCE_STORE: path.join(root, 'store') };
  return { start: root, env };
}

test('round 2 reuses a findings path with new bytes without dropping round 1', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-reloc-'));
  const opts = storeOpts(root);
  try {
    const findings = path.join(root, 'artifacts', 'findings.json');
    fs.mkdirSync(path.dirname(findings), { recursive: true, mode: 0o700 });
    const round1 = Buffer.from('{"verdict":"fail","round":1}\n');
    const round2 = Buffer.from('{"verdict":"pass","round":2}\n');
    fs.writeFileSync(findings, round1, { mode: 0o600 });
    const first = relocatePath(findings, [], { ...opts, kind: 'plan', candidate_digest: 'a'.repeat(64) });
    fs.writeFileSync(findings, round2, { mode: 0o600 });
    const second = relocatePath(findings, [], { ...opts, kind: 'plan', candidate_digest: 'b'.repeat(64) });
    assert.notEqual(first.sha256, second.sha256);
    assert.equal(second.relocations.some((row) => row.created === true), true, 'new bytes are a new relocation record');
    assert.equal(getObject(first.sha256, opts).bytes.equals(round1), true, 'round 1 object bytes survive');
    assert.equal(getObject(second.sha256, opts).bytes.equals(round2), true);
    assert.equal(lookupRelocation(findings, { ...opts, sha256: first.sha256 }).sha256, first.sha256);
    assert.equal(lookupRelocation(findings, { ...opts, sha256: second.sha256 }).sha256, second.sha256);
    assert.equal(resolveEvidenceBytes({ path: findings, sha256: first.sha256 }, opts).bytes.equals(round1), true);
    assert.equal(resolveEvidenceBytes({ path: findings, sha256: second.sha256 }, opts).bytes.equals(round2), true);
    const again = putRelocation({ historical_path: findings, sha256: first.sha256, kind: 'plan' }, opts);
    assert.equal(again.created, false, 'repeating round 1 digest does not overwrite history');
    assert.equal(lookupRelocation(findings, { ...opts, sha256: first.sha256 }).sha256, first.sha256);
    const history = lookupRelocation(findings, opts).history.map((row) => row.sha256);
    assert.deepEqual([...history].sort(), [first.sha256, second.sha256].sort());

    const correct = putObject(Buffer.from('correct-log'), opts);
    const wrong = putObject(Buffer.from('wrong-log'), opts);
    const historical = path.join(root, 'review-log.yaml');
    putRelocation({ historical_path: historical, sha256: wrong.sha256 }, opts);
    assert.throws(
      () => resolveEvidenceBytes({ path: historical, sha256: correct.sha256 }, opts),
      /relocation digest mismatch/,
      'a conflicting relocation cannot fall back to a different bare object',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

async function withAuthority(root, fn) {
  const keys = ['SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE', 'SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT'];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE = '1';
  process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT = path.join(root, 'authority');
  try { return await fn(); }
  finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}

function roundReceipt(wi = 'WI-RVROUND') {
  return {
    request_id: crypto.randomUUID(),
    phase_guard: { wi },
    protocol: { feature_id: wi },
    review_kind: 'plan',
    candidate_digest: 'c'.repeat(64),
    effective_tuple: { orchestrator: 'codex', host: 'cursor', family: 'xai' },
  };
}

test('a launcher failure before the reviewer process starts does not consume cycle capacity', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-cap-'));
  try {
    await withAuthority(root, async () => {
      const anchor = roundReceipt();
      const open = externalReviewCycleCapacity(anchor);
      assert.equal(open.issued, 0);
      assert.equal(open.remaining, 2);
      assert.equal(open.allowed, true);

      const artifacts = path.join(root, 'artifacts');
      fs.mkdirSync(artifacts, { mode: 0o700 });
      let admitted = false;
      const missed = await invoke(
        { host: 'cursor', family: 'xai', model: 'cursor-grok-4.6-high', effort: 'high' },
        path.join(root, 'missing-reviewer'),
        Buffer.from('candidate'),
        'plan',
        Buffer.from('{}'),
        artifacts,
        1,
        2000,
        1,
        null,
        root,
        2,
        { onReviewerSpawned: () => { admitted = true; reserveExternalReviewRound(anchor, { reviewerInvoked: true }); } },
      );
      assert.equal(admitted, false, 'ENOENT must not admit a round');
      assert.equal(missed.attempt.classification, 'capability');
      assert.equal(externalReviewCycleCapacity(anchor).issued, 0);
      assert.equal(externalReviewCycleCapacity(anchor).remaining, 2);

      const preSpawn = roundReceipt();
      const parked = reserveExternalReviewRound(preSpawn, { reviewerInvoked: false });
      assert.equal(parked.reviewer_invoked, false);
      assert.equal(externalReviewCycleCapacity(anchor).issued, 0, 'pre-spawn reservation does not count');
      assert.equal(externalReviewCycleCapacity(anchor).allowed, true);

      let spawned = false;
      const bin = path.join(root, 'reviewer-ok');
      fs.writeFileSync(bin, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
      const ran = roundReceipt();
      await invoke(
        { host: 'cursor', family: 'xai', model: 'cursor-grok-4.6-high', effort: 'high' },
        bin,
        Buffer.from('candidate'),
        'plan',
        Buffer.from('{}'),
        artifacts,
        1,
        2000,
        1,
        null,
        root,
        2,
        { onReviewerSpawned: () => { spawned = true; reserveExternalReviewRound(ran, { reviewerInvoked: true }); } },
      );
      assert.equal(spawned, true);
      assert.equal(externalReviewCycleCapacity(anchor).issued, 1);

      reserveExternalReviewRound(roundReceipt(), { reviewerInvoked: true });
      const full = externalReviewCycleCapacity(anchor);
      assert.equal(full.issued, 2);
      assert.equal(full.remaining, 0);
      assert.equal(full.allowed, false);
      assert.throws(() => reserveExternalReviewRound(roundReceipt(), { reviewerInvoked: true }), /hard cap/);
      assert.equal(externalReviewCycleCapacity(anchor).issued, 2, 'rejected admission does not create a third counted round');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const STORE_URL = new URL('../../scripts/lib/review-evidence-store.mjs', import.meta.url).href;

test('relocation records are immutable per path+digest and concurrent writers keep every record', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-conc-')));
  const opts = storeOpts(root);
  try {
    const historical = path.join(root, 'findings.json');
    const a = putObject(Buffer.from('round-a'), opts).sha256;
    const b = putObject(Buffer.from('round-b'), opts).sha256;
    const firstRecord = putRelocation({ historical_path: historical, sha256: a }, opts);
    const before = fs.readFileSync(firstRecord.path);
    putRelocation({ historical_path: historical, sha256: b }, opts);
    assert.equal(fs.readFileSync(firstRecord.path).equals(before), true, 'later rounds never rewrite an earlier record');

    // Legacy v2 manifests (one file, many records) stay readable.
    const legacy = path.join(root, 'legacy.json');
    const key = crypto.createHash('sha256').update(legacy).digest('hex');
    const dir = path.join(root, 'store', 'relocations');
    const rec = (sha256) => ({ schema_version: 1, historical_path: legacy, sha256, repo_root: root, candidate_digest: null, kind: null, relocated_at: new Date().toISOString() });
    fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ schema_version: 2, historical_path: legacy, sha256: b, records: [rec(a), rec(b)] }));
    assert.equal(lookupRelocation(legacy, { ...opts, sha256: a }).sha256, a);
    assert.equal(lookupRelocation(legacy, { ...opts, sha256: b }).sha256, b);

    const digests = Array.from({ length: 12 }, (_, i) => putObject(Buffer.from(`concurrent-${i}`), opts).sha256);
    const target = path.join(root, 'contended.json');
    const script = `import(${JSON.stringify(STORE_URL)}).then(m=>{m.putRelocation({historical_path:process.argv[1],sha256:process.argv[2]},{start:process.argv[3],env:process.env});})`;
    const env = { ...process.env, SVC_REVIEW_EVIDENCE_STORE: path.join(root, 'store') };
    await Promise.all(digests.map((sha) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', script, target, sha, root], { env, stdio: 'ignore' });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`writer exited ${code}`))));
    })));
    for (const sha of digests) assert.equal(lookupRelocation(target, { ...opts, sha256: sha }).sha256, sha, 'no concurrent record is lost');
    assert.equal(lookupRelocation(target, opts).history.length, digests.length);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an earlier round verifies from preserved objects after a later round reuses its path', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-hist-')));
  const opts = storeOpts(root);
  const saved = process.env.SVC_REVIEW_EVIDENCE_STORE;
  process.env.SVC_REVIEW_EVIDENCE_STORE = opts.env.SVC_REVIEW_EVIDENCE_STORE;
  try {
    const dir = path.join(root, '.svc', 'external-review-artifacts');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, 'attempt-1-findings.json');
    const r1 = Buffer.from('{"round":1}\n');
    const r2 = Buffer.from('{"round":2}\n');
    fs.writeFileSync(file, r1, { mode: 0o600 });
    const one = relocatePath(file, [], opts);
    fs.writeFileSync(file, r2, { mode: 0o600 });
    const two = relocatePath(file, [], opts);
    assert.equal(boundEvidenceBytes(root, { path: file, sha256: one.sha256 }).bytes.equals(r1), true, 'round 1 resolves by its bound digest');
    assert.equal(boundEvidenceBytes(root, { path: file, sha256: two.sha256 }).bytes.equals(r2), true);
    assert.throws(() => boundEvidenceBytes(root, { path: file, sha256: 'e'.repeat(64) }), /digest mismatch/, 'an unpreserved wrong digest still fails');

    const declared = [{ path: file, sha256: one.sha256 }, { path: file, sha256: two.sha256 }];
    const used = new Set();
    assert.equal(roundOutputDigest(root, file, { declared, used }), one.sha256, 'first round keeps its own output digest');
    assert.equal(roundOutputDigest(root, file, { declared, used }), two.sha256, 'second round gets the next, not the latest twice');
    assert.equal(roundOutputDigest(root, file, { bound: new Map([[file, one.sha256]]) }), one.sha256, 'receipt-bound digest wins');
  } finally {
    if (saved === undefined) delete process.env.SVC_REVIEW_EVIDENCE_STORE; else process.env.SVC_REVIEW_EVIDENCE_STORE = saved;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('admission is reserved before spawn: lock contention aborts with nothing spawned, pending holds a slot, released frees it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-admit-'));
  try {
    await withAuthority(root, async () => {
      const anchor = roundReceipt('WI-RVADMIT');
      externalReviewCycleCapacity(anchor);
      const release = acquireLock(path.join(root, 'authority', 'feature-bindings'), { staleMs: 60_000 });
      try { assert.throws(() => admitExternalReviewRound(anchor), /held by pid/); } finally { release(); }
      assert.equal(externalReviewCycleCapacity(anchor).issued, 0, 'a failed admission records nothing');
      const first = admitExternalReviewRound(roundReceipt('WI-RVADMIT'));
      const second = admitExternalReviewRound(roundReceipt('WI-RVADMIT'));
      assert.equal(externalReviewCycleCapacity(anchor).issued, 2);
      assert.throws(() => admitExternalReviewRound(roundReceipt('WI-RVADMIT')), /hard cap/);
      first.release();
      assert.equal(externalReviewCycleCapacity(anchor).issued, 1);
      second.markInvoked();
      second.release();
      assert.equal(externalReviewCycleCapacity(anchor).issued, 1, 'an invoked admission is never released');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const PROVENANCE_URL = new URL('../../scripts/lib/external-review-provenance.mjs', import.meta.url).href;
function childAdmit(root, { failRewrite = false } = {}) {
  const script = `
    import(${JSON.stringify(PROVENANCE_URL)}).then(async (m) => {
      const fs = (await import('node:fs')).default;
      const crypto = (await import('node:crypto')).default;
      const receipt = { request_id: crypto.randomUUID(), phase_guard: { wi: 'WI-RVCONC' }, protocol: { feature_id: 'WI-RVCONC' }, review_kind: 'plan', candidate_digest: 'c'.repeat(64), effective_tuple: { orchestrator: 'codex', host: 'cursor', family: 'xai' } };
      let admission = null;
      for (let attempt = 0; attempt < 200 && !admission; attempt += 1) {
        try { admission = m.admitExternalReviewRound(receipt); }
        catch (error) {
          if (/hard cap/.test(error.message)) { console.log('denied'); return; }
          await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 20));
        }
      }
      if (!admission) { console.log('gaveup'); return; }
      ${failRewrite ? 'fs.renameSync = () => { throw new Error("ledger rewrite failed"); };' : ''}
      admission.markInvoked();
      ${failRewrite ? '' : 'await new Promise((resolve) => setTimeout(resolve, 300)); admission.release();'}
      console.log('invoked');
    });`;
  const env = { ...process.env, SVC_EXTERNAL_REVIEW_PROVENANCE_FIXTURE: '1', SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT: path.join(root, 'authority') };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('exit', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`child exited ${code}`))));
  });
}

test('competing launcher processes admit at most two invoked reviewers', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-race-'));
  try {
    await withAuthority(root, async () => {
      const outcomes = await Promise.all(Array.from({ length: 4 }, () => childAdmit(root)));
      assert.equal(outcomes.filter((o) => o === 'invoked').length, 2, `outcomes: ${outcomes}`);
      assert.equal(outcomes.filter((o) => o === 'denied').length, 2);
      assert.equal(externalReviewCycleCapacity(roundReceipt('WI-RVCONC')).issued, 2);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a spawned round survives a failed ledger rewrite and launcher death', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-final-'));
  try {
    await withAuthority(root, async () => {
      assert.equal(await childAdmit(root, { failRewrite: true }), 'invoked');
      // The launcher has exited with its record still "pending"; the O_EXCL marker keeps the round.
      assert.equal(externalReviewCycleCapacity(roundReceipt('WI-RVCONC')).issued, 1);
      assert.equal(await childAdmit(root, { failRewrite: true }), 'invoked');
      assert.equal(externalReviewCycleCapacity(roundReceipt('WI-RVCONC')).allowed, false);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('AGY spawn marker is found when diagnostics share its stderr chunk', async () => {
  let admitted = 0;
  const noisy = `process.stderr.write('x'.repeat(4000) + ${JSON.stringify(AGY_REVIEWER_SPAWNED_MARKER)} + '\\n' + 'y'.repeat(4000))`;
  await runProcess(process.execPath, ['-e', noisy], Buffer.alloc(0), 10000, process.env, undefined, () => { admitted += 1; }, AGY_REVIEWER_SPAWNED_MARKER);
  assert.equal(admitted, 1);
  let split = 0;
  const half = AGY_REVIEWER_SPAWNED_MARKER.length >> 1;
  const chunks = `process.stderr.write(${JSON.stringify(AGY_REVIEWER_SPAWNED_MARKER.slice(0, half))}); setTimeout(() => process.stderr.write(${JSON.stringify(AGY_REVIEWER_SPAWNED_MARKER.slice(half))}), 150)`;
  await runProcess(process.execPath, ['-e', chunks], Buffer.alloc(0), 10000, process.env, undefined, () => { split += 1; }, AGY_REVIEWER_SPAWNED_MARKER);
  assert.equal(split, 1, 'a marker split across chunks is still found');
});

test('AGY admission follows the reviewer process, not the Node dispatcher', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rvround-agy-')));
  const keys = ['SVC_EXTERNAL_REVIEW_FIXTURE', 'PATH'];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.SVC_EXTERNAL_REVIEW_FIXTURE = '1';
    const tuple = { host: 'agy', family: 'google', model: 'Gemini 3.5 Flash (High)', effort: 'high' };
    const run = async (binDir, label) => {
      process.env.PATH = `${binDir}${path.delimiter}${path.dirname(process.execPath)}`;
      const artifacts = path.join(root, `artifacts-${label}`);
      fs.mkdirSync(artifacts, { mode: 0o700 });
      let admitted = 0;
      try {
        await invoke(tuple, path.join(binDir, 'agy'), Buffer.from('candidate'), 'plan', Buffer.from('{}'), artifacts, 1, 20000, 1, null, root, 1, { onReviewerSpawned: () => { admitted += 1; } });
      } catch { /* findings parsing is irrelevant to admission */ }
      return admitted;
    };
    const emptyDir = path.join(root, 'empty');
    fs.mkdirSync(emptyDir);
    assert.equal(await run(emptyDir, 'missing'), 0, 'dispatcher runs but agy never spawns: no round consumed');
    const okDir = path.join(root, 'ok');
    fs.mkdirSync(okDir);
    fs.writeFileSync(path.join(okDir, 'agy'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    assert.equal(await run(okDir, 'ok'), 1, 'agy spawn admits exactly once');
  } finally {
    for (const key of keys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
