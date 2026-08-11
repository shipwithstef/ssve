#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const historyRoot = process.argv.includes('--history-root');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const findings = [];
const secretFixtureFiles = new Set([
  'docs/specs/framework-parity/feature-deep-dives/04-memory-secret-redaction.md',
  'test-framework/evals/tier-1/validate-secret-redaction.sh',
]);

function report(kind, file, line = null) {
  findings.push({ kind, file, ...(line === null ? {} : { line }) });
}

const forbiddenPaths = [
  /(?:^|\/)(?:hourshub(?:-port)?|surge-software-eood)(?:\/|$)/i,
  /^(?:app|android|ios|supabase|base44)(?:\/|$)/i,
  /^scratch\//,
  /^\.svc\/(?:cross-model-reviews|review-receipts)\//,
  /^docs\/funding\//,
  /^docs\/logs\//,
  /^FRAMEWORK-STATE-ARCHIVE\//,
  /^roadmap-evaluation-workspace\//,
  /^references\/user-vault\.md$/,
  /\.local-backup$/,
  /\.(?:pem|key|p12|pfx|jks|keystore|kdbx|ovpn)$/i,
  /(?:^|\/)\.env(?:\.|$)/,
  /(?:^|\/)(?:review[^/]*-raw\.txt|[^/]+\.(?:err|log))$/i,
];

const forbiddenLiterals = [
  ['private-product-identity', /hourshub(?:-port)?|surgesoftwareeood|surge-software(?:-eood)?|surge software(?: eood)?/gi],
  ['private-product-fingerprint', /WI-SCOUT|lightning(?:[ _-]?slots?|slot)|scout[-_ ](?:revenue|economy|point|claim|photo)|processScout|Scout-class|Scout canary|Scout product|Scout worktree|Scout shadow|Scout FAB|sonic domain publisher/gi],
  ['alternate-contributor-alias', /thinkmakeshipiot|s7an-it-ez|david0775050-sys/gi],
  ['personal-name', /Stefan Angelov|david Angelov/gi],
  ['personal-workstation-path', /\/home\/dianast|\/Users\/Dell|\/mnt\/c\/Users\/Dell|C:\\Users\\Dell/gi],
];

const secretPatterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['github-token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,255}\b/g],
  ['openai-style-token', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['stripe-live-key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
];

const credentialAssignmentPattern = /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*(['"])([^'"\n]+)\1/gi;
const safeCredentialPlaceholder = /^(?:EXAMPLE(?:_[A-Z0-9]+)*|YOUR(?:_[A-Z0-9]+)*|REDACTED|PLACEHOLDER|DUMMY|FAKE|TEST(?:_[A-Z0-9]+)*|<[^>]+>|\$\{[A-Z0-9_]+\})$/i;
const egnWeights = [2, 4, 8, 5, 10, 9, 7, 3, 6];

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function allowedEmail(value) {
  const lower = value.toLowerCase();
  if (lower === 'angelovsan@gmail.com') return true;
  if (lower === 'git@github.com') return true;
  const domain = lower.slice(lower.lastIndexOf('@') + 1);
  return /^(?:example\.(?:com|org|net|test|invalid)|example\.test|example\.invalid|svc\.test)$/.test(domain);
}

function isValidBulgarianEgn(value) {
  if (!/^\d{10}$/.test(value)) return false;
  let year = Number(value.slice(0, 2));
  let month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month >= 21 && month <= 32) {
    year += 1800;
    month -= 20;
  } else if (month >= 41 && month <= 52) {
    year += 2000;
    month -= 40;
  } else {
    year += 1900;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return false;
  }
  const checksum = egnWeights.reduce((sum, weight, index) => sum + weight * Number(value[index]), 0);
  return (checksum % 11) % 10 === Number(value[9]);
}

for (const file of tracked) {
  if (forbiddenPaths.some((pattern) => pattern.test(file))) report('forbidden-path', file);

  let bytes;
  try {
    bytes = fs.readFileSync(path.join(root, file));
  } catch {
    report('unreadable-tracked-file', file);
    continue;
  }
  if (bytes.includes(0)) continue;

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    continue;
  }

  // The audit implementation necessarily contains the forbidden signatures it detects.
  if (file === 'scripts/audit-repository-privacy.mjs') continue;

  for (const [kind, pattern] of forbiddenLiterals) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) report(kind, file, lineAt(text, match.index));
  }

  for (const match of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    if (!allowedEmail(match[0])) report('non-publication-email', file, lineAt(text, match.index));
  }

  for (const match of text.matchAll(/(?:\+359|00359)[\s().-]*(?:\d[\s().-]*){8,9}/g)) {
    report('bulgarian-phone-number', file, lineAt(text, match.index));
  }

  for (const match of text.matchAll(/(?<![A-F0-9])\d{10}(?![A-F0-9])/gi)) {
    if (isValidBulgarianEgn(match[0])) report('bulgarian-egn', file, lineAt(text, match.index));
  }

  credentialAssignmentPattern.lastIndex = 0;
  for (const match of text.matchAll(credentialAssignmentPattern)) {
    const value = match[2];
    const surrounding = text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
    if (safeCredentialPlaceholder.test(value)) continue;
    if (/fixture|placeholder|redact|dummy|fake|example|test/i.test(surrounding)) continue;
    report('literal-credential-assignment', file, lineAt(text, match.index));
  }

  for (const [kind, pattern] of secretPatterns) {
    if (secretFixtureFiles.has(file)) continue;
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const surrounding = text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
      if (/fixture|placeholder|redact|dummy|fake|example|test/i.test(surrounding)) continue;
      report(kind, file, lineAt(text, match.index));
    }
  }
}

if (historyRoot) {
  const count = Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  if (count !== 1) report('history-not-single-root', '<git-history>');

  const metadata = execFileSync(
    'git',
    ['show', '-s', '--format=%P%n%an%n%ae%n%cn%n%ce', 'HEAD'],
    { cwd: root, encoding: 'utf8' },
  ).trimEnd().split('\n');
  const [parents = '', authorName = '', authorEmail = '', committerName = '', committerEmail = ''] = metadata;
  if (parents !== '') report('root-has-parent', '<git-history>');
  if (authorName !== 's7an-it' || committerName !== 's7an-it') report('non-canonical-commit-name', '<git-history>');
  if (authorEmail !== 'angelovsan@gmail.com' || committerEmail !== 'angelovsan@gmail.com') {
    report('non-canonical-commit-email', '<git-history>');
  }
}

if (findings.length > 0) {
  console.error(JSON.stringify({ ok: false, finding_count: findings.length, findings }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, tracked_files: tracked.length, history_root_checked: historyRoot }));
