import test from 'node:test';
import assert from 'node:assert/strict';
import { overview } from '../../mods/orchestrator-pane/hooks/overview.mjs';
import { summaries } from './seed-goals.mjs';

test('overview bounds work/next, removes task codes, maps worker names and counts distinct tasks completed today', () => {
  const goal = { id: 'novisenti', title: 'Novisenti', ...summaries.novisenti };
  const task = { goal_id: goal.id, title: 'CP4 plain-language overview', state: 'running', executor: { cli: 'codex' }, elapsed_ms: 720000, estimate_ms: { high: 5400000 } };
  const finished_at = '2026-10-03T10:00:00.000Z';
  const tasks = [task, ...Array.from({ length: 5 }, () => ({ ...task, executor: { cli: 'agy' } })),
    { ...task, state: 'done', finished_at, attempt_history: [{ state: 'done', finished_at }] },
    { ...task, state: 'done', finished_at: '2026-10-02T10:00:00.000Z' },
    { ...task, state: 'failed', finished_at }, { ...task, state: 'done', finished_at: null },
    { ...task, goal_id: 'another-goal', state: 'done', finished_at }];
  const card = overview(goal, tasks, Date.parse('2026-10-03T12:00:00Z'));
  assert.equal(card.working.length, 3); assert.equal(card.next.length, 3);
  assert.equal(card.working[0], 'Codex is working on plain-language overview · 12m/90m');
  assert.match(card.working[1], /^Antigravity is/);
  assert.equal(card.footer, '1 task done today');
  assert.equal(card.needsYou.length, 1); assert.deepEqual(card.next, ['Opus gate (~23:00 UTC)', 'Paid test ≤$10', 'Report']);
  assert.equal(overview(goal, [], Date.parse('2026-10-04T00:00:00Z')).footer, '0 tasks done today');
});

test('legacy/empty goals remain readable; summaries are text and secrets/control bytes are redacted', () => {
  const card = overview({ id: 'legacy', title: 'Legacy', blockers: [{ code: 'needs_owner', description: 'Technical hold' }], info: [{ code: 'unbound' }] }, []);
  assert.equal(card.headline, 'Waiting for a progress update.');
  assert.deepEqual(card.needsYou, []); assert.deepEqual(card.working, []); assert.deepEqual(card.next, []);
  const safe = overview({ id: 'safe', title: '<script>literal</script>', headline: 'Bearer private\ntext' }, []);
  assert.equal(safe.title, '<script>literal</script>'); assert.equal(safe.headline, 'Bearer [redacted] text');
});
