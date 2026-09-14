#!/usr/bin/env node
// skills/research/scripts/coverage-check.mjs
//
// Verifies that every URL on the pre-scope checklist appears in the
// extracted .sources.jsonl. If any URL is missing → exit non-zero with
// the delta listed.
//
// USAGE:
//   node skills/research/scripts/coverage-check.mjs \
//     --prescope docs/specs/research-prescope-<slug>.md \
//     --domain references/knowledge/<domain>/

import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { writeJsonAtomic } from '../../../scripts/state-io.mjs';
import { resolveKnowledgePath } from './lib/knowledge-paths.mjs';

const args = process.argv.slice(2);
const get = (k) => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
const prescope = get('--prescope');
const domainArg = get('--domain');
if (!prescope || !domainArg) {
  console.error('usage: coverage-check.mjs --prescope <path> --domain <path>');
  process.exit(2);
}
const domainDir = resolveKnowledgePath(domainArg);

const sourcesPath = path.join(domainDir, '.sources.jsonl');
if (!existsSync(prescope)) { console.error(`prescope not found: ${prescope}`); process.exit(2); }
if (!existsSync(sourcesPath)) { console.error(`provenance not found: ${sourcesPath} — extraction REFUSED until written`); process.exit(1); }

const ps = await readFile(prescope, 'utf8');
const checklist = [...ps.matchAll(/^- \[[ x]\] (https?:\/\/\S+)/gm)].map(m => m[1].trim());

const provLines = (await readFile(sourcesPath, 'utf8')).trim().split('\n').filter(Boolean);
const provUrls = new Set(provLines.map(l => { try { return JSON.parse(l).url; } catch { return null; } }).filter(Boolean));

const missing = checklist.filter(u => !provUrls.has(u));
const coverage = checklist.length === 0 ? 0 : ((checklist.length - missing.length) / checklist.length * 100).toFixed(1);
const prescopeSha256 = createHash('sha256').update(ps).digest('hex');
const lockId = createHash('sha256')
  .update(`${path.resolve(prescope)}\0${domainDir}\0${prescopeSha256}`)
  .digest('hex')
  .slice(0, 16);
const passTokenPath = path.join('.svc', 'coverage.lock');
const lockDir = path.join('.svc', 'coverage-locks');
const domainPassTokenPath = path.join(lockDir, `${lockId}.json`);

const result = {
  verdict: missing.length === 0 ? 'pass' : 'fail',
  prescope,
  prescope_sha256: prescopeSha256,
  domain: domainDir,
  lock_id: lockId,
  lock_path: domainPassTokenPath,
  checklist_count: checklist.length,
  provenance_count: provUrls.size,
  coverage_pct: Number(coverage),
  missing
};
console.log(JSON.stringify(result, null, 2));

if (missing.length === 0) {
  mkdirSync(lockDir, { recursive: true });
  writeJsonAtomic(passTokenPath, result);
  writeJsonAtomic(domainPassTokenPath, result);
  process.exit(0);
} else {
  if (existsSync(passTokenPath)) {
    unlinkSync(passTokenPath);
  }
  process.exit(1);
}
