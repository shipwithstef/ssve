#!/usr/bin/env node
// SOL-R2-001..005: drive the shipped checkers on real fail-closed paths.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPhaseForbiddenForSession } from '../../../scripts/resolve-continuation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CHECKER = path.join(ROOT, 'scripts/check-chain-receipts.mjs');
const INDEXER = path.join(ROOT, 'scripts/svc-wi-promotion-indexer.mjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-sol-r2-'));
const repo = path.join(tmp, 'repo');
fs.mkdirSync(repo);
execFileSync('git', ['init', '-q'], { cwd: repo });
execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: repo });
execFileSync('git', ['config', 'user.name', 'fixture'], { cwd: repo });
fs.writeFileSync(path.join(repo, '.gitignore'), '.svc/receipts/\n');
fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
execFileSync('git', ['add', '.gitignore', 'seed.txt'], { cwd: repo });
execFileSync('git', ['commit', '-qm', 'seed'], { cwd: repo });
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
execFileSync('git', ['update-ref', 'refs/remotes/origin/main', sha], { cwd: repo });

const wi = 'WI-546';
const failVerify = {
  receipt_type: 'verify-promotion',
  schema_version: 1,
  wi,
  passes: {
    p1_promotion_evidence: 'fail',
    p2_spec_ac_verification: 'fail',
    p3_runtime_validation: 'fail',
    p4_state_closeout: 'fail',
  },
  p3_target_type: 'install-validation',
  p3_outcome: 'fail',
  verdict: 'fail',
  sha,
  timestamp: new Date().toISOString(),
};
const passVerify = { ...failVerify, verdict: 'pass', p3_outcome: 'pass', passes: {
  p1_promotion_evidence: 'pass',
  p2_spec_ac_verification: 'pass',
  p3_runtime_validation: 'pass',
  p4_state_closeout: 'pass',
} };

const mirrorDir = path.join(repo, '.svc', 'receipts', sha.slice(0, 7));
fs.mkdirSync(mirrorDir, { recursive: true });
fs.writeFileSync(path.join(mirrorDir, 'verify-promotion.json'), `${JSON.stringify(passVerify, null, 2)}\n`);

function check(args) {
  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(process.execPath, [CHECKER, ...args], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    code = error.status ?? 1;
    stdout = String(error.stdout || '');
  }
  const parsed = stdout.trim() ? JSON.parse(stdout) : { ok: false };
  return { code, parsed, row: parsed.results?.[0] || null };
}

// SOL-R2-001: push/reconcile refuse a gitignored mirror-only envelope.
const pushMirror = check(['--sha', sha, '--wi', wi, '--consumer', 'push']);
assert.equal(pushMirror.row?.ok, false, 'SOL-R2-001 push must reject mirror-only');
assert.equal(pushMirror.row?.receipt_source, 'mirror');
assert.match(String(pushMirror.row?.missing?.[0] || ''), /note-sourced/);
const reconcileMirror = check(['--sha', sha, '--wi', wi, '--consumer', 'reconcile']);
assert.equal(reconcileMirror.row?.ok, false, 'SOL-R2-001 reconcile must reject mirror-only');
assert.equal(reconcileMirror.row?.receipt_source, 'mirror');

// SOL-R2-005: indexer refuses when only a gitignored mirror exists.
const stateHome = path.join(tmp, 'state');
fs.mkdirSync(stateHome, { mode: 0o700 });
let indexerOut = '';
let indexerCode = 0;
try {
  indexerOut = execFileSync(process.execPath, [
    INDEXER, 'index', '--wi', wi, '--sha', sha, '--summary', 'forged-mirror', '--repo', repo,
  ], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, SVC_STATE_HOME: stateHome },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  indexerCode = error.status ?? 1;
  indexerOut = `${error.stdout || ''}${error.stderr || ''}`;
}
assert.notEqual(indexerCode, 0, 'SOL-R2-005 indexer must not index a mirror-only envelope');
assert.match(indexerOut, /note-sourced envelope|mirrors are not authority/);

// SOL-R2-003: structurally valid failing verdict is not authorizing evidence.
const failNote = path.join(tmp, 'fail-note.json');
fs.writeFileSync(failNote, `${JSON.stringify({ 'verify-promotion': failVerify })}\n`);
execFileSync('git', ['notes', '--ref=svc-receipts', 'add', '-f', '-F', failNote, sha], { cwd: repo });
const failVerdict = check(['--sha', sha, '--wi', wi, '--consumer', 'verify-promotion']);
assert.equal(failVerdict.row?.ok, false, 'SOL-R2-003 failing verdict must not authorize');
assert.equal(failVerdict.row?.receipt_source, 'note');
assert.match(String((failVerdict.row?.missing || []).join(' ')), /verdict="fail"|verdict=\\?"fail\\?"|not authorizing evidence/);

// SOL-R2-004: Stop does not infer a pass from leftover receipts; default is the full envelope.
const leftover = {
  'plan-manifest': {
    receipt_type: 'plan-manifest',
    schema_version: 1,
    wi,
    mode: 'inline',
    timestamp: new Date().toISOString(),
  },
};
const leftoverNote = path.join(tmp, 'leftover-note.json');
fs.writeFileSync(leftoverNote, `${JSON.stringify(leftover)}\n`);
execFileSync('git', ['notes', '--ref=svc-receipts', 'add', '-f', '-F', leftoverNote, sha], { cwd: repo });
const stopInferred = check(['--sha', sha, '--wi', wi, '--consumer', 'stop']);
assert.equal(stopInferred.row?.ok, false, 'SOL-R2-004 stop must not pass on leftover plan-manifest alone');
const missing = (stopInferred.row?.missing || []).join(' ');
assert.match(missing, /review-plan|exec-record|review-exec|audit-implementation|ALL|no receipts|incomplete|missing/);

// SOL-R2-002: identified continuation child + missing ledger / foreign cwd is denied.
const missingLedger = isPhaseForbiddenForSession({
  sessionId: 'svc-continuation-foreign',
  skill: 'execute-changeset',
  cwd: path.join(tmp, 'foreign-cwd'),
});
assert.equal(missingLedger.forbidden, true);
assert.equal(missingLedger.reason, 'ledger-missing');
const tokenChild = isPhaseForbiddenForSession({
  sessionId: 'some-other-session',
  skill: 'plan-changeset',
  cwd: path.join(tmp, 'foreign-cwd'),
  continuationToken: 'deadbeef',
});
assert.equal(tokenChild.forbidden, true);
assert.equal(tokenChild.reason, 'ledger-missing');
const stranger = isPhaseForbiddenForSession({
  sessionId: 'unrelated-session',
  skill: 'plan-changeset',
  cwd: path.join(tmp, 'foreign-cwd'),
});
assert.equal(stranger.forbidden, false, 'unrelated sessions still fail open by absence');

console.log('validate-sol-r2-fail-closed: PASS (SOL-R2-001 push/reconcile mirror reject, SOL-R2-002 missing-ledger deny, SOL-R2-003 fail-verdict refuse, SOL-R2-004 stop no leftover infer, SOL-R2-005 indexer notes-only)');
