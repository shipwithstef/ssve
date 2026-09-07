#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { selectTier1Validators } from '../../../scripts/select-tier1-validators-v2.mjs';
const root = new URL('../../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const json = p => JSON.parse(read(p));
const skill = 'propose-ux-improvements';

test('on-demand skill is uniquely registered without becoming compulsory', () => {
  const m = json('skills-manifest.json');
  assert.equal(m.includedSkills.filter(s => s === skill).length, 1);
  assert(!m.corePackForRouting.includes(skill));
  assert(!m.bootstrapStartSequence.includes(skill));
  for (const lane of Object.values(m.laneDefinitions)) {
    assert(!JSON.stringify(lane).includes('"' + skill + '"'));
  }
  const body = read(`skills/${skill}/SKILL.md`);
  assert.match(body, /terminal: true/);
  assert.match(body, /progressive: false/);
  assert.match(body, /## Before Starting/);
  assert.equal(json('references/context-loading-registry.json').families.filter(f => f.skills.includes(skill)).length, 1);
});

test('proposal handoff is conditional and maps to the actual router consumer', () => {
  const rows = json('references/skill-runtime-contracts-v2.json').contracts.filter(c => c.skill === skill);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].consumers, ['route-workflow']);
  assert.equal(rows[0].artifact, 'ux-improvement-proposal');
  assert.match(rows[0].condition, /accepted.*owner authorizes/);
  assert(read('skills/route-workflow/references/intent-routing.md').includes('`propose-ux-improvements`'));
});

test('synthetic fixtures cover change, retention and missing evidence honestly', () => {
  const {scenarios} = json('test-framework/evals/fixtures/ux-graduation.json');
  assert.deepEqual(scenarios.map(s => s.expected_outcome), ['propose-change', 'retain-current', 'evidence-needed']);
  for (const s of scenarios) {
    for (const field of ['steer', 'persona_job', 'spec', 'code', 'decision_evidence']) assert(s[field]?.trim(), `${s.id}: missing ${field}`);
    assert(s.forbidden_claims.length > 0);
  }
  assert.equal(scenarios[2].observation, null);
  for (const s of scenarios.slice(0, 2)) assert.match(s.observation, /Synthetic rendered-state fixture/);
  // These are input/oracle completeness checks. Actual Sol/Cursor reasoning is separate evidence.
});

test('focused iteration selects UX validation and preserves unknown/global fallback', () => {
  for (const file of [`skills/${skill}/SKILL.md`, 'test-framework/evals/fixtures/ux-graduation.json']) {
    assert(selectTier1Validators([file]).selected.includes('validate-ux-graduation.mjs'));
  }
  assert.equal(selectTier1Validators(['future/unmapped-ux-surface.xyz']).fallback_full, true);
  assert.equal(selectTier1Validators(['AGENTS.md']).fallback_full, true);
});
