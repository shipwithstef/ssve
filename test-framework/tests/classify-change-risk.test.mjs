// @organism-suite
import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChangeRisk } from '../../scripts/classify-change-risk.mjs';

const classify = (file, body = '+reworded line', opts = {}) => classifyChangeRisk({
  diff: `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old line\n${body}\n`,
  rows: [{ status: 'M', paths: [file] }],
  ...opts,
});

test('README typo stays cosmetic', () => {
  assert.equal(classify('README.md').tier, 'cosmetic');
  assert.equal(classify('docs/guide/intro.md').tier, 'cosmetic');
});

test('skill instruction edits are logic, never cosmetic', () => {
  for (const f of ['skills/plan-changeset/SKILL.md', 'skills/plan-changeset/references/checklist.md', 'skills/foo/notes.md']) {
    const r = classify(f);
    assert.notEqual(r.tier, 'cosmetic', f);
    assert.equal(r.never_fast_lane, true, f);
    assert.ok(r.reasons.includes('semantic-document-path'), f);
  }
});

test('rules and agent-instruction files are logic or higher', () => {
  for (const f of ['rules/common/example.md', 'rules/example.md', 'CLAUDE.md', 'sub/CLAUDE.md', 'AGENTS.md', 'pkg/AGENTS.md']) {
    assert.notEqual(classify(f).tier, 'cosmetic', f);
  }
  assert.equal(classify('rules/example.md').tier, 'logic');
  assert.equal(classify('CLAUDE.md').tier, 'logic');
});

test('spec acceptance criteria edits are logic; other spec prose stays cosmetic', () => {
  const ac = classify('docs/specs/feature-x.md', '+- AC-3: the export MUST include totals');
  assert.equal(ac.tier, 'logic');
  assert.ok(ac.reasons.includes('spec-acceptance-criteria'));
  assert.equal(classify('docs/specs/feature-x.md', '+Given a user, When they log in, Then they see the dashboard').tier, 'logic');
  assert.equal(classify('docs/specs/feature-x.md', '+## Acceptance Criteria').tier, 'logic');
  assert.equal(classify('docs/specs/feature-x.md', '+Fixed a typo in the overview paragraph').tier, 'cosmetic');
});

test('AC section edit without an AC keyword is logic when file contents are known', () => {
  const content = ['# Spec', '', 'Overview text.', '', '## Acceptance Criteria', '', '- user can export', '- user can import', '', '## Notes', '', 'misc'].join('\n');
  const diffAt = (line) => `diff --git a/docs/specs/s.md b/docs/specs/s.md\n--- a/docs/specs/s.md\n+++ b/docs/specs/s.md\n@@ -${line} +${line} @@\n-old\n+new\n`;
  const rows = [{ status: 'M', paths: ['docs/specs/s.md'] }];
  const readNew = () => content;
  assert.equal(classifyChangeRisk({ diff: diffAt(7), rows, readNew }).tier, 'logic');
  assert.equal(classifyChangeRisk({ diff: diffAt(12), rows, readNew }).tier, 'cosmetic');
  assert.equal(classifyChangeRisk({ diff: diffAt(3), rows, readNew }).tier, 'cosmetic');
});

test('mixed change takes the highest tier', () => {
  const r = classifyChangeRisk({
    diff: 'diff --git a/README.md b/README.md\n+x\ndiff --git a/rules/a.md b/rules/a.md\n+y\n',
    rows: [{ status: 'M', paths: ['README.md'] }, { status: 'M', paths: ['rules/a.md'] }],
  });
  assert.equal(r.tier, 'logic');
});

test('nested headings under an AC heading stay inside the AC section until it closes', () => {
  const content = ['# Spec', '', '## Acceptance Criteria', '', '### Export', '', '- user can export csv', '', '#### Edge cases', '', '- empty file', '', '## Notes', '', '### Misc', '', 'misc text'].join('\n');
  const diffAt = (line) => `diff --git a/docs/specs/s.md b/docs/specs/s.md\n--- a/docs/specs/s.md\n+++ b/docs/specs/s.md\n@@ -${line} +${line} @@\n-old\n+new\n`;
  const rows = [{ status: 'M', paths: ['docs/specs/s.md'] }];
  const readNew = () => content;
  const tier = (line) => classifyChangeRisk({ diff: diffAt(line), rows, readNew }).tier;
  assert.equal(tier(7), 'logic');   // under ### Export
  assert.equal(tier(11), 'logic');  // under #### Edge cases
  assert.equal(tier(15), 'cosmetic'); // ### Misc under ## Notes (AC section closed by same-level heading)
});

test('an AC section ends at a heading of the same or higher level', () => {
  const content = ['# Spec', '### Acceptance Criteria', 'ac text', '## Design', 'design text'].join('\n');
  const d = (n) => `diff --git a/docs/specs/s.md b/docs/specs/s.md\n@@ -${n} +${n} @@\n-o\n+n\n`;
  const rows = [{ status: 'M', paths: ['docs/specs/s.md'] }];
  assert.equal(classifyChangeRisk({ diff: d(3), rows, readNew: () => content }).tier, 'logic');
  assert.equal(classifyChangeRisk({ diff: d(5), rows, readNew: () => content }).tier, 'cosmetic');
});
