import fs from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from '../state-io.mjs';
import { execFileSync } from 'node:child_process';

export function derivePrReviewReceipt({ pr, sha, repo, envelope, chain }) {
  if (!/^[0-9a-f]{40}$/.test(sha) || !chain?.ok || !Array.isArray(chain.results)
      || !chain.results.length || chain.results.some(r => !r.ok || r.sha !== sha)) throw new Error('Passing exact-candidate chain required');
  const reviews = Object.values(envelope).filter(r => r?.receipt_type === 'review-exec' && (r.target_sha || r.sha) === sha);
  if (!reviews.length || reviews.some(r => !['pass', 'pass-with-findings', 'pass-with-acks'].includes(r.verdict))) throw new Error('Passing canonical G5 evidence required');
  return { schema_version: 1, pr: Number(pr), repo, candidate_sha: sha,
    review_gate_required: true, review_gate_task: 'G5', self_review: false, result: 'PASS',
    reviewed_at: reviews.map(r => r.timestamp).sort().at(-1),
    reviewer: [...new Set(reviews.map(r => r.adversarial_review?.primary_reviewer_host).filter(Boolean))].join(', '),
    evidence: reviews.map(r => `refs/notes/svc-receipts:${sha}:review-exec:${r.wi}`),
    source: 'validated canonical chain', source_wis: reviews.map(r => r.wi) };
}

export function generatePrReviewReceipt({ root, pr, repo, expectedHead, expectedSha }) {
  if (!/^[0-9]+$/.test(String(pr)) || !repo || !expectedHead || !/^[0-9a-f]{40}$/.test(expectedSha || '')) throw new Error('Automatic PR receipt requires exact repo/head/SHA binding');
  const run = (bin, args) => execFileSync(bin, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const live = JSON.parse(run('gh', ['pr', 'view', String(pr), '--repo', repo, '--json', 'headRefOid,headRefName']));
  if (live.headRefOid !== expectedSha || live.headRefName !== expectedHead) throw new Error('PR identity differs from reviewed candidate');
  const checker = new URL('../check-chain-receipts.mjs', import.meta.url).pathname;
  const chain = JSON.parse(run(process.execPath, [checker, '--sha', expectedSha, '--consumer', 'push']));
  const envelope = JSON.parse(run('git', ['notes', '--ref=svc-receipts', 'show', expectedSha]));
  const receipt = derivePrReviewReceipt({ pr, sha: expectedSha, repo, envelope, chain });
  if (!receipt.reviewer || !Number.isFinite(Date.parse(receipt.reviewed_at))) throw new Error('Canonical G5 reviewer identity or timestamp missing');
  const target = path.join(root, '.svc', 'review-receipts');
  for (const dir of [path.join(root, '.svc'), target]) {
    if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('Refusing symlinked receipt directory');
    fs.mkdirSync(dir, { recursive: true });
  }
  const output = path.join(target, `pr-${pr}.json`);
  writeJsonAtomic(output, receipt);
  return output;
}
