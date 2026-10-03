import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { html } from './serve.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('../../mods/orchestrator-pane/tests/fixtures/status.json', import.meta.url)));
class Element {
  children = []; textContent = ''; listeners = {}; open = false;
  constructor(tag) { this.tag = tag; }
  append(el) { this.children.push(el); }
  replaceChildren() { this.children = []; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  get firstChild() { return this.children[0]; }
  get text() { return this.textContent + this.children.map(el => el.text).join('\n'); }
}
test('web fixture: priority goal groups, empty goal, counts/unknowns, recovery commands, stale/error retention and safe text', async () => {
  const elements = Object.fromEntries(['tree', 'stamp', 'error', 'recovery', 'updates', 'overview', 'diagnostics'].map(id => [id, new Element(id)]));
  fixture.updates = Array.from({ length: 25 }, (_, i) => `12:00 demo/build: task ${i} done`);
  let broken = false, clock = Date.parse(fixture.collector_heartbeat_at);
  const context = vm.createContext({ document: { getElementById: id => elements[id], createElement: tag => new Element(tag) },
    Date: class extends Date { static now() { return clock; } },
    fetch: async (url, options) => { assert.equal(url, '/status.json'); assert.equal(options.cache, 'no-store'); if (broken) throw Error('offline'); return { ok: true, json: async () => structuredClone(fixture) }; },
    setInterval: (_, ms) => { assert.equal(ms, 60000); },
  });
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  await vm.runInContext('refresh()', context);
  const steered = structuredClone(fixture);
  for (const goal of steered.goals) for (const lane of goal.lanes) for (const task of lane.tasks) {
    task.steering = { mode: 'queue' }; task.queued_steers = [{ id: 'one', text: '<script>owner literal</script>' }];
  }
  vm.runInContext(`renderStatus(${JSON.stringify(steered)})`, context);
  assert.match(elements.tree.text, /queued_steers/); assert.match(elements.tree.text, /<script>owner literal<\/script>/);
  assert.equal(elements.updates.textContent.split('\n').length, 20);
  assert.ok(elements.updates.textContent.endsWith('task 24 done'));
  assert.equal(elements.tree.children.length, 2);
  assert.match(elements.tree.children[0].firstChild.text, /#1 Empty goal.*paused.*LOW/);
  assert.match(elements.tree.children[1].firstChild.text, /#2 novisenti.*needs_owner.*native_ownership_unverified.*child-exact/);
  assert.match(elements.tree.text, /Claude turns used 2 \/ cap 8 · reserved unknown · remaining 6/);
  assert.match(elements.tree.text, /codex attempts used 1 \/ cap 4 · reserved active 1 · remaining 3/);
  assert.match(elements.tree.text, /cursor attempts used 2 \/ cap unknown/);
  assert.match(elements.tree.text, /No lanes or tasks registered/);
  assert.match(elements.tree.text, /Blocker: attention_pending.*Monitor expired/);
  assert.ok(elements.recovery.text.includes(fixture.orchestrators[1].resume_command));
  assert.match(elements.recovery.text, /auto_start=false/);
  // Stable expansion across refresh; commands are text, never controls/requests.
  elements.tree.children[1].open = true; elements.tree.children[1].listeners.toggle();
  await vm.runInContext('refresh()', context); assert.equal(elements.tree.children[1].open, true);
  clock += 120000; await vm.runInContext('refresh()', context); assert.match(elements.error.text, /Updates are delayed/);
  broken = true; const before = elements.tree.text;
  await vm.runInContext('refresh()', context); assert.match(elements.error.text, /last snapshot/); assert.equal(elements.tree.text, before);
  vm.runInContext(`renderStatus(${JSON.stringify({ ...fixture, goals: [{ ...fixture.goals[1], title: '<script>unsafe</script>' }] })})`, context);
  assert.match(elements.tree.children[0].firstChild.textContent, /<script>unsafe<\/script>/); // textContent, never HTML.
});


test('web hot-reloaded channel opt-out hides updates and informational goal notes render safely', async () => {
  const elements = Object.fromEntries(['tree', 'stamp', 'error', 'recovery', 'updates', 'overview', 'diagnostics'].map(id => [id, new Element(id)]));
  const snapshot = { ...fixture, updates: ['12:00 goal/build: task done'], update_channels: { web: false, pane: true }, goals: [{ ...fixture.goals[0], info: [{ code: 'parent_orchestrated', description: 'No child bound' }] }] };
  const context = vm.createContext({ document: { getElementById: id => elements[id], createElement: tag => new Element(tag) }, Date, fetch: async () => ({ ok: true, json: async () => snapshot }), setInterval: () => {} });
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  await vm.runInContext('refresh()', context);
  assert.equal(elements.updates.textContent, ''); assert.match(elements.tree.text, /Info: parent_orchestrated.*No child bound/);
  snapshot.update_channels.web = true; await vm.runInContext('refresh()', context); assert.match(elements.updates.textContent, /task done/);
});

test('CP4 web defaults to human cards, keeps technical tree behind Details and preserves safe owner text', async () => {
  const { summaries } = await import('./seed-goals.mjs');
  const elements = Object.fromEntries(['tree', 'stamp', 'error', 'recovery', 'updates', 'overview', 'diagnostics'].map(id => [id, new Element(id)]));
  const snapshot = structuredClone(fixture);
  snapshot.goals = [{ ...snapshot.goals[1], ...summaries.novisenti, title: 'Novisenti', owner_actions: [{ text: '<script>Approve creating the Azure issuer job (create-only, no spend)</script>', since: snapshot.generated_at }] }];
  const context = vm.createContext({ document: { getElementById: id => elements[id], createElement: tag => new Element(tag) }, Date, fetch: async () => ({ ok: true, json: async () => snapshot }), setInterval: () => {} });
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context); await vm.runInContext('refresh()', context);
  assert.equal(elements.diagnostics.open, false);
  const card = elements.overview.children[0];
  assert.match(card.text, /Product built and deployed \(AI off\)/);
  assert.match(card.text, /Needs you.*\n<script>Approve creating/);
  assert.match(card.text, /✓ Plan/); assert.match(card.text, /● Issuer job/); assert.match(card.text, /○ Opus gate/);
  assert.doesNotMatch(card.text, /Counts-v1|reserved|unbound|Info:|Monitor expired|child-exact|auto_start|p1c-r/);
  const footer = card.children.at(-1), link = footer.children[0];
  assert.match(footer.text, /\d+ tasks done today/); assert.equal(link.textContent, 'Details');
  link.listeners.click(); assert.equal(elements.diagnostics.open, true);
  assert.match(elements.tree.text, /Counts-v1/);
  snapshot.goals[0].headline = 'Approved. Preparing the test.'; snapshot.goals[0].owner_actions = [];
  await vm.runInContext('refresh()', context);
  assert.match(elements.overview.text, /Approved. Preparing/); assert.doesNotMatch(elements.overview.text, /Needs you/);
  assert.equal(elements.diagnostics.open, true);
});
