#!/usr/bin/env node
// skills/ingest-guide-batch/scripts/parallel-orchestrator.mjs
// Fan out a batch of pasted guides into N parallel ingest-guide sessions.
//
// USAGE:
//   node skills/ingest-guide-batch/scripts/parallel-orchestrator.mjs \
//     --batch-id <id> \
//     [--concurrency N]     (default 4, hard cap 8)
//     [--fail-fast]         (default: isolated — failures do not stop siblings)
//     [--dry-run]           (enumerate + show plan, no worktree creation)
//
// INPUTS:
//   Batch directory at docs/specs/ingest-guide/batch-<id>/ containing one
//   file per guide (.md or .txt). Optional sources.json mapping filenames
//   to source-ids.
//
// OUTPUTS:
//   docs/specs/ingest-guide/batch-<id>/digest.md — aggregate report.
//   Per-child: worktrees named ingest-<source-id> with their own
//   .svc/pipeline-decisions.jsonl entries.
//
// NOTES:
//   - Minimum guide size: 200 chars (smaller guides skipped as 'too-short').
//   - Failure isolation: one child failing does not stop siblings.
//   - Concurrency cap: hard-limited to 8 to avoid worktree thrash.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MIN_GUIDE_CHARS = 200;
const MAX_CONCURRENCY = 8;
const DEFAULT_CONCURRENCY = 4;

function parseArgs(argv) {
  const args = { concurrency: DEFAULT_CONCURRENCY, failFast: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--batch-id') args.batchId = argv[++i];
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (a === '--fail-fast') args.failFast = true;
    else if (a === '--dry-run') args.dryRun = true;
  }
  if (args.concurrency > MAX_CONCURRENCY) args.concurrency = MAX_CONCURRENCY;
  if (args.concurrency < 1) args.concurrency = 1;
  return args;
}

function die(msg, code = 1) {
  console.error(JSON.stringify({ verdict: 'failed', reason: msg }, null, 2));
  process.exit(code);
}

function kebab(s) {
  return s
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function enumerateGuides(batchDir) {
  if (!fs.existsSync(batchDir) || !fs.statSync(batchDir).isDirectory()) {
    die(`batch directory not found: ${batchDir}`);
  }
  const sourcesPath = path.join(batchDir, 'sources.json');
  const mapping = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8'))
    : {};
  const entries = fs.readdirSync(batchDir)
    .filter(f => /\.(md|txt)$/.test(f))
    .filter(f => f !== 'digest.md')
    .map(f => {
      const full = path.join(batchDir, f);
      const content = fs.readFileSync(full, 'utf8');
      const sourceId = mapping[f] || kebab(f);
      return {
        file: f,
        path: full,
        sourceId,
        size: content.length,
        tooShort: content.length < MIN_GUIDE_CHARS,
      };
    });
  return entries;
}

function runChild(guide, batchId, repoRoot) {
  // Dispatch: creates a worktree and runs ingest-guide inside it.
  // This is a STUB harness call — the actual implementation wires up
  // scripts/worktree.sh + scripts/dispatch-worker.sh.
  //
  // For v1 we emit a plan line and rely on scripts/worktree.sh + the
  // harness to actually do the work. The child is responsible for:
  //   1. `scripts/worktree.sh create ingest-<source-id>`
  //   2. Copy <guide.path> to the worktree at docs/specs/ingest-guide/<source-id>-raw.md
  //   3. Invoke ingest-guide with that file as input
  //   4. Append a line to the worktree's .svc/pipeline-decisions.jsonl
  //
  // Returns a promise resolving to { sourceId, exitCode, stdoutTail }.
  return new Promise((resolve) => {
    const cmd = path.join(repoRoot, 'skills', 'ingest-guide-batch', 'scripts', 'child-worker.sh');
    const args = [guide.sourceId, guide.path, batchId];
    const stdoutLines = [];
    const child = spawn('bash', [cmd, ...args], { cwd: repoRoot, env: { ...process.env, SVC_SUBAGENT: '1' } });
    child.stdout?.on('data', d => stdoutLines.push(d.toString()));
    child.stderr?.on('data', d => stdoutLines.push(d.toString()));
    child.on('close', (code) => {
      const stdoutTail = stdoutLines.join('').split('\n').slice(-40).join('\n');
      resolve({ sourceId: guide.sourceId, exitCode: code ?? -1, stdoutTail });
    });
    child.on('error', (err) => {
      resolve({ sourceId: guide.sourceId, exitCode: -1, stdoutTail: `spawn error: ${err.message}` });
    });
  });
}

async function fanOut(guides, concurrency, batchId, repoRoot, failFast) {
  const results = [];
  const queue = [...guides];
  const inflight = new Set();

  async function startOne() {
    const g = queue.shift();
    if (!g) return;
    const p = runChild(g, batchId, repoRoot).then(r => {
      inflight.delete(p);
      results.push(r);
      if (failFast && r.exitCode !== 0) {
        // kill remaining queue
        queue.length = 0;
      } else {
        return startOne();
      }
    });
    inflight.add(p);
    return p;
  }

  const starters = [];
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    starters.push(startOne());
  }
  await Promise.all(starters);
  await Promise.all([...inflight]);
  return results;
}

function readChildDecision(repoRoot, sourceId) {
  // Read the most recent ingest-guide entry for this source-id from the
  // child worktree's decision log.
  const worktree = path.join(repoRoot, '.worktrees', `ingest-${sourceId}`);
  const log = path.join(worktree, '.svc', 'pipeline-decisions.jsonl');
  if (!fs.existsSync(log)) return null;
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.skill === 'ingest-guide' && entry.source_id === sourceId) return entry;
    } catch { /* skip malformed */ }
  }
  return null;
}

function renderDigest(args) {
  const { batchId, guides, results, concurrency, repoRoot } = args;
  const tooShort = guides.filter(g => g.tooShort);
  const processed = guides.filter(g => !g.tooShort);
  const succeeded = results.filter(r => r.exitCode === 0);
  const failed = results.filter(r => r.exitCode !== 0);

  const lines = [];
  lines.push(`# Batch Ingest Digest: ${batchId}`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Guides processed:** ${guides.length} (${succeeded.length} succeeded, ${failed.length} failed, ${tooShort.length} skipped-too-short)`);
  lines.push(`**Concurrency:** ${concurrency}`);
  lines.push('');
  lines.push('## Per-guide Decisions');
  lines.push('');
  lines.push('| Source-id | Decision Mix | Experiments Pending | Report |');
  lines.push('|-----------|--------------|---------------------|--------|');
  for (const g of processed) {
    const r = results.find(x => x.sourceId === g.sourceId);
    if (!r || r.exitCode !== 0) continue;
    const entry = readChildDecision(repoRoot, g.sourceId);
    if (!entry) {
      lines.push(`| ${g.sourceId} | (no decision log found) | — | — |`);
      continue;
    }
    const mix = `store:${entry.routing?.store ?? 0} promote:${entry.routing?.promote ?? 0} discard:${entry.routing?.discard ?? 0}`;
    lines.push(`| ${g.sourceId} | ${mix} | ${entry.experiments_pending ?? 0} | ${entry.report_path ?? '—'} |`);
  }
  lines.push('');
  if (tooShort.length) {
    lines.push('## Skipped (too short)');
    lines.push('');
    for (const g of tooShort) lines.push(`- ${g.sourceId} (${g.size} chars, < ${MIN_GUIDE_CHARS})`);
    lines.push('');
  }
  if (failed.length) {
    lines.push('## Failures');
    lines.push('');
    for (const r of failed) {
      lines.push(`- **${r.sourceId}** — exit=${r.exitCode}`);
      lines.push('  ```');
      lines.push(r.stdoutTail.split('\n').map(l => '  ' + l).join('\n'));
      lines.push('  ```');
    }
    lines.push('');
  }
  lines.push('## Next Steps');
  lines.push('');
  lines.push('- Review any `promote` decisions with `create-skill` (human checkpoint).');
  lines.push('- `store` decisions are already on disk under `references/knowledge/` (each passed the domain gate inside its child session).');
  lines.push('- `discard` decisions require no further action.');
  lines.push('- Worktrees for failed children are preserved for post-mortem.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const repoRoot = process.env.SVC_REPO_ROOT || process.cwd();
  const args = parseArgs(process.argv.slice(2));
  if (!args.batchId) die('missing --batch-id');

  const batchDir = path.join(repoRoot, 'docs', 'specs', 'ingest-guide', `batch-${args.batchId}`);
  const guides = enumerateGuides(batchDir);
  if (guides.length === 0) die(`no guides found in ${batchDir}`);

  console.log(JSON.stringify({
    action: 'plan',
    batchDir,
    total: guides.length,
    processable: guides.filter(g => !g.tooShort).length,
    tooShort: guides.filter(g => g.tooShort).map(g => g.sourceId),
    concurrency: args.concurrency,
    failFast: args.failFast,
  }, null, 2));

  if (args.dryRun) {
    console.log(JSON.stringify({ verdict: 'dry-run', guides: guides.map(g => ({ sourceId: g.sourceId, size: g.size, tooShort: g.tooShort })) }, null, 2));
    return;
  }

  const processable = guides.filter(g => !g.tooShort);
  const results = await fanOut(processable, args.concurrency, args.batchId, repoRoot, args.failFast);

  const digest = renderDigest({ batchId: args.batchId, guides, results, concurrency: args.concurrency, repoRoot });
  const digestPath = path.join(batchDir, 'digest.md');
  fs.writeFileSync(digestPath, digest);

  console.log(JSON.stringify({
    verdict: 'complete',
    digest: digestPath,
    succeeded: results.filter(r => r.exitCode === 0).length,
    failed: results.filter(r => r.exitCode !== 0).length,
    tooShort: guides.filter(g => g.tooShort).length,
  }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ verdict: 'error', reason: err.message, stack: err.stack }, null, 2));
  process.exit(2);
});
