#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[process.argv.indexOf('--root') + 1] || process.cwd());
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'skills-manifest.json'), 'utf8'));
const metadata = manifest.skillMetadata || {};
const cutoff = '2026-04-28';
const failures = [];

const candidates = Object.entries(metadata)
  .filter(([skill, meta]) => (meta.created || '') >= cutoff && (manifest.includedSkills || []).includes(skill));

if (candidates.length === 0) {
  failures.push(`no included skill has skillMetadata.created >= ${cutoff}`);
}

for (const [skill, meta] of candidates) {
  const skillFile = path.join(root, 'skills', skill, 'SKILL.md');
  const refPath = meta.progressive_disclosure_reference || '';
  const lines = fs.existsSync(skillFile) ? fs.readFileSync(skillFile, 'utf8').split(/\r?\n/).length : 0;
  if (lines > 300) failures.push(`${skill}/SKILL.md has ${lines} lines; expected <= 300`);
  if (!refPath || !fs.existsSync(path.join(root, refPath))) {
    failures.push(`${skill} missing progressive_disclosure_reference file`);
  }
}

if (failures.length) {
  console.error('FAIL: progressive disclosure proof invalid');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS: progressive disclosure proof valid (${candidates.map(([skill]) => skill).join(', ')})`);
