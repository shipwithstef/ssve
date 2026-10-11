// @organism-suite
import assert from 'node:assert/strict';
import test from 'node:test';
import { score, stripNegated } from '../../scripts/overengineering-index.mjs';

const plan = (text) => ({
  ac_digests: { entries: [{ ac_id: 'AC-1' }] },
  changeset_blueprints: [{ file: 'a.mjs', action: 'MODIFY', blueprint: `Serves AC-1. ${text}` }],
  decision_trace: '',
});
const hits = (text) => score(plan(text)).components.speculative.items;

test('affirmative speculative language is still flagged', () => {
  assert.deepEqual(hits('Build a pluggable framework with a registry.').sort(), ['framework', 'pluggable', 'registry']);
});

test('negation forms do not count as proposing the thing', () => {
  const cases = [
    'We do not add a pluggable framework.',
    "Don't build a registry for this.",
    'No factory is needed.',
    'Never introduce a generic abstraction layer.',
    'Implement the fix without a framework or registry.',
    'Avoid future-proofing and extensible designs.',
    'This is not a configurable system, it is one function.',
    'Do not add a cache; no queue needed; without microservices.',
  ];
  for (const text of cases) assert.deepEqual(hits(text), [], text);
});

test('negation only strips its own clause', () => {
  assert.deepEqual(hits('Do not add a registry. Build a pluggable loader.'), ['pluggable']);
  assert.deepEqual(hits('Without a factory, but make it configurable.'), ['configurable']);
});

test('negated dependency additions are not counted', () => {
  const p = plan('Do not add a new dependency; npm install is not needed.');
  assert.equal(score(p).components.deps.share, 0);
  assert.ok(score(plan('Add a new library for parsing.')).components.deps.share > 0);
});

test('negated items inside structured task_graph entries are stripped per field', () => {
  const p = { task_graph: [{ id: 't1', title: 'no framework', scope: 'pluggable loader AC-1' }] };
  assert.deepEqual(score(p).components.speculative.items, ['pluggable']);
});

test('stripNegated leaves unrelated text intact', () => {
  assert.equal(stripNegated('Add a parser.'), 'Add a parser.');
  assert.ok(!/registry/.test(stripNegated('There is no registry here.')));
});

test('score is advisory: a flagged plan still returns a result without throwing', () => {
  const r = score(plan('pluggable framework registry factory generic configurable'));
  assert.ok(r.index >= 0 && typeof r.band === 'string');
});

test('negation does not cross blueprint item or field boundaries', () => {
  const p = {
    ac_digests: { entries: [{ ac_id: 'AC-1' }] },
    changeset_blueprints: [
      { file: 'a.mjs', action: 'MODIFY', blueprint: 'AC-1 never add' },
      { file: 'b.mjs', action: 'MODIFY', blueprint: 'AC-1 a pluggable thing' },
    ],
    decision_trace: 'Do not',
    scope: 'a registry',
  };
  assert.deepEqual(score(p).components.speculative.items.sort(), ['pluggable', 'registry']);
  const q = { task_graph: [{ id: 't1', title: 'avoid', scope: 'framework AC-1' }] };
  assert.deepEqual(score(q).components.speculative.items, ['framework']);
});

test('trailing "is not needed" only removes its own clause', () => {
  assert.deepEqual(hits('Add a pluggable loader, but a registry is not needed.'), ['pluggable']);
  assert.deepEqual(hits('A registry is not needed; build a pluggable loader.'), ['pluggable']);
  assert.deepEqual(hits('Add a pluggable loader however a factory is not required.'), ['pluggable']);
});

test('quotes inside prose do not end a negation', () => {
  assert.deepEqual(hits('Do not add a "registry".'), []);
  assert.deepEqual(hits("Never build a 'pluggable' framework."), []);
  assert.deepEqual(hits('Without a "factory", but build a pluggable loader.'), ['pluggable']);
});
