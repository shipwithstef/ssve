import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createReviewerPolicy } from '../../scripts/review-topology-v2.mjs';

const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const adapter = path.join(frameworkRoot, 'scripts/review-plan-codex.sh');

function run(binary, args, cwd, env = process.env) {
  const result = spawnSync(binary, args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, `${binary} ${args.join(' ')}\n${result.stderr}`);
  return result;
}

test('plan reviewer receives the test-value rubric in its actual launch request', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-plan-test-value-'));
  try {
    const repo = path.join(root, 'repo');
    const bin = path.join(root, 'bin');
    fs.mkdirSync(repo);
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(repo, 'CLAUDE.md'), '# Fixture instructions\n');
    fs.writeFileSync(path.join(repo, 'plan.md'), '# WI-570 fixture plan\n');
    run('git', ['init', '-q', '-b', 'main'], repo);
    run('git', ['add', '-A'], repo);
    run('git', ['-c', 'user.name=SVC fixture', '-c', 'user.email=svc@example.com', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture'], repo);
    run('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], repo);
    run('git', ['checkout', '-q', '-b', 'framework-WI-570-test-value'], repo);
    const realNode = process.execPath;
    const wrapper = path.join(bin, 'node');
    fs.writeFileSync(wrapper, `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == */run-external-review.mjs && " $* " == *" --review-kind plan "* ]]; then
  cat > "$CAPTURE_PATH"
  while [[ "$#" -gt 0 ]]; do
    if [[ "$1" == "--artifacts-dir" ]]; then
      shift
      artifact_dir="$1"
      break
    fi
    shift
  done
  mkdir -p "$artifact_dir"
  printf '{"review_kind":"plan","rubric_score":10,"verdict":"pass","findings":[]}\n' > "$artifact_dir/findings.json"
  printf '{"ok":true,"findings":"%s","receipt":"%s"}\n' "$artifact_dir/findings.json" "$artifact_dir/receipt.json"
else
  exec "$REAL_NODE" "$@"
fi
`);
    fs.chmodSync(wrapper, 0o755);
    const capture = path.join(root, 'request.txt');
    const policyPath = path.join(root, 'reviewer-policy.json');
    const policy = createReviewerPolicy({
      orchestrator: 'claude',
      self: { host: 'current', family: 'anthropic', model: 'current', effort: 'high' },
      reviewer: { id: 'sol', kind: 'external', required: true, authority: 'independent', tuple: { host: 'codex', family: 'openai', model: 'fixture-sol', effort: 'high' } },
    });
    fs.writeFileSync(policyPath, JSON.stringify(policy), { mode: 0o600 });
    const env = {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      REAL_NODE: realNode,
      CAPTURE_PATH: capture,
      SVC_HOST: 'claude',
      SVC_DISPATCH_POLICY: policyPath,
      SVC_REVIEWER_STATION: 'sol',
      SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR: path.join(root, 'artifacts'),
    };
    const result = run('bash', [adapter, path.join(repo, 'plan.md')], repo, env);
    assert.equal(JSON.parse(result.stdout).verdict, 'pass');
    const request = fs.readFileSync(capture, 'utf8');
    assert.match(request, /FOCUS DIMENSIONS:[\s\S]*\(f\) execute risk and test value:/);
    assert.match(request, /material ACs, journeys, and credible risks/);
    assert.match(request, /independent expected result/);
    assert.match(request, /Reject mock echoes, implementation-mirroring assertions, invented bugs, and duplicate tests/);
    assert.match(request, /The test-value audit is part of dimensions a, d, and f/);
    assert.match(request, /A justified manual observation or no new test can pass/);
    assert.match(request, /every plan must name the user job and compare its chosen approach with a simpler adequate existing pattern/);
    assert.match(request, /For UI work only, require relevant same-job product-screen comparisons/);
    assert.match(request, /No mandatory browser or marketing work for CLI\/backend changes/);
    assert.match(request, /user intent and request fidelity for every author and host/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
