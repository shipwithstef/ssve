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
  const elements = Object.fromEntries(['tree', 'stamp', 'error', 'recovery', 'updates'].map(id => [id, new Element(id)]));
  fixture.updates = Array.from({ length: 25 }, (_, i) => `12:00 demo/build: task ${i} done`);
  let broken = false, clock = Date.parse(fixture.collector_heartbeat_at);
  const context = vm.createContext({ document: { getElementById: id => elements[id], createElement: tag => new Element(tag) },
    Date: class extends Date { static now() { return clock; } },
    fetch: async (url, options) => { assert.equal(url, '/status.json'); assert.equal(options.cache, 'no-store'); if (broken) throw Error('offline'); return { ok: true, json: async () => structuredClone(fixture) }; },
    setInterval: (_, ms) => { assert.equal(ms, 60000); },
  });
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  await vm.runInContext('refresh()', context);
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
  clock += 120000; await vm.runInContext('refresh()', context); assert.match(elements.error.text, /Collector stale/);
  broken = true; const before = elements.tree.text;
  await vm.runInContext('refresh()', context); assert.match(elements.error.text, /last snapshot/); assert.equal(elements.tree.text, before);
  vm.runInContext(`renderStatus(${JSON.stringify({ ...fixture, goals: [{ ...fixture.goals[1], title: '<script>unsafe</script>' }] })})`, context);
  assert.match(elements.tree.children[0].firstChild.textContent, /<script>unsafe<\/script>/); // textContent, never HTML.
});
