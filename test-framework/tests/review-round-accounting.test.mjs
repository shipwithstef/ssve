import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { putObject, putRelocation, getObject, lookupRelocation, relocatePath, resolveEvidenceBytes } from '../../scripts/lib/review-evidence-store.mjs';
import { externalReviewCycleCapacity, reserveExternalReviewRound } from '../../scripts/lib/external-review-provenance.mjs';
import { invoke } from '../../scripts/run-external-review.mjs';

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
    const manifest = fs.readFileSync(lookupRelocation(findings, opts).path, 'utf8');
    assert.match(manifest, new RegExp(first.sha256));
    assert.match(manifest, new RegExp(second.sha256));

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
