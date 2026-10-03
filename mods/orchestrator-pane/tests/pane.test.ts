import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';
import { recorded } from './fixtures/status';

const PLUGIN = 'orchestrator-pane';
const props = { title: 'Orchestrator', isFocused: true, bodyColumns: 48, placement: 'inline', scroll: { offset: 0, bodyRows: 20, totalRows: 20 }, view: {} } as const;
const bandProps = { hasSurvey: false, isWorking: false, maxRows: 1, bodyColumns: 48, scroll: props.scroll, view: {} };
const PANE = { plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'orch', props } as const;
function setup(on: On) {
  const snapshot = JSON.parse(JSON.stringify(recorded));
  const clock = mock.clock(on, { now: Date.parse(snapshot.collector_heartbeat_at) });
  mock.env(on, { HOME: '/recorded/home' });
  const seen = { reads: 0, models: 0, prompts: 0, appends: 0, writes: 0, processes: [] as unknown[], copies: [] as string[], counters: [] as (string | undefined)[], registered: [] as string[], opens: 0, closes: 0, openArgs: [] as any[], toasts: [] as string[] };
  const control = { raw: null as string | null, clipboard: true, missing: false, sessionId: 'unbound-test', placed: true, opened: false, processCode: 0 };
  on('fs.stat', () => { if (control.missing) return { deny: 'ENOENT status.json' }; return { value: { kind: 'file', size: 10000, mtimeMs: clock.now(), isLink: false } }; });
  on('fs.read', ($, e) => { seen.reads++; expect(e.path).toBe('/recorded/home/.local/state/orch/status.json'); return { value: control.raw ?? JSON.stringify(snapshot) }; });
  on('fs.write', () => { seen.writes++; throw new Error('Unexpected write'); });
  on('ui.status', ($, e) => { seen.counters.push(e.text); return { value: undefined }; });
  on('ui.invalidate', () => ({ value: undefined }));
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined }; });
  on('command.register', ($, e) => { seen.registered.push(e.name); return { value: undefined }; });
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('session.end', ($, e) => ({ sessionId: e.sessionId }));
  on('session.surfaces', () => ({ value: ['terminal'] }));
  on('session.id', () => ({ value: control.sessionId }));
  on('ui.open', ($, e) => { seen.opens++; seen.openArgs.push(e); control.opened = true; return { value: control.placed ? { isPlaced: true } : { isPlaced: false, reason: 'below 144 columns' } }; });
  on('ui.panes', () => ({ value: control.opened ? [{ id: 'orch', title: 'Orchestrator', isShown: true, isFocused: false, isPlaced: control.placed }] : [] }));
  on('ui.close', () => { seen.closes++; control.opened = false; return { value: undefined }; });
  on('ui.copy', ($, e) => { seen.copies.push(e.text); return { value: control.clipboard ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } }; });
  on('model.complete', () => { seen.models++; throw new Error('Unexpected model'); });
  on('model.fork', () => { seen.models++; throw new Error('Unexpected model'); });
  on('prompt.submit', () => { seen.prompts++; throw new Error('Unexpected prompt'); });
  on('session.append', () => { seen.appends++; throw new Error('Unexpected context'); });
  on('process.run', ($, e) => {
    seen.processes.push(e.argv);
    if (e.argv[1].endsWith('/dispatch.mjs')) {
      expect(e.init?.env).toEqual({ ORCH_STATE_DIR: '/recorded/home/.local/state/orch' });
      expect(e.init?.timeoutMs).toBe(45000);
      return { value: { exitCode: control.processCode, stdout: '{}', stderr: control.processCode ? 'Control attempt changed' : '' } };
    }
    expect(e.argv[0]).toBe('node'); expect(e.argv[1]).toContain('/scripts/orch/tail.mjs');
    expect(e.argv[2]).toBe('/recorded/logs/p1c-r.jsonl'); expect(e.init?.timeoutMs).toBe(5000);
    return { value: { exitCode: 0, stdout: JSON.stringify({ text: 'token=private\nlast event', at: '2026-10-03T00:00:00Z', truncated: true }), stderr: '' } };
  });
  return { snapshot, clock, seen, control };
}
async function start($: Engine) { await $.session.start({ cwd: '/recorded/worktree', surface: 'terminal', isInteractive: true }); }
function noEffects(seen: ReturnType<typeof setup>['seen']) {
  expect([seen.models, seen.prompts, seen.appends, seen.writes]).toEqual([0, 0, 0, 0]);
}

test('recorded snapshot: /orch, goal/lane/task expansion, joins, counters and 60s refresh', async ($, on) => {
  const { snapshot, clock, seen } = setup(on);
  const owned = snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r');
  owned.depends_on = ['d1a', 'p1b'];
  await start($);
  expect(seen.registered).toEqual(['orch']);
  expect(await $.command.run({ command: 'orch', args: '' })).toEqual({});
  expect(seen.opens).toBe(1);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  expect(await ui.find({ key: 'task-p1c-r' })).toBeDefined();
  expect(await ui.find({ key: 'description-p1c-r' })).toBeUndefined();
  await ui.press({ key: `goal-${owned.goal_id}` });
  expect(await ui.find({ key: 'task-p1c-r' })).toBeUndefined();
  await ui.press({ key: `goal-${owned.goal_id}` });
  await ui.press({ key: `lane-${owned.goal_id}-${owned.lane}` });
  expect(await ui.find({ key: 'task-p1c-r' })).toBeUndefined();
  await ui.press({ key: `lane-${owned.goal_id}-${owned.lane}` });
  await ui.press({ key: 'task-p1c-r' });
  expect((await ui.find({ key: 'description-p1c-r' }))?.text).toContain(owned.description);
  expect((await ui.find({ key: 'executor-p1c-r' }))?.text).toContain('gpt-6.1-sol');
  expect((await ui.find({ key: 'needs-p1c-r' }))?.text).toBe('Needs: d1a + p1b');
  const before = seen.reads;
  await clock.advance(59999); expect(seen.reads).toBe(before);
  snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r').state = 'stalled';
  snapshot.collector_heartbeat_at = new Date(clock.now() + 1).toISOString();
  await clock.advance(1); expect(seen.reads).toBe(before + 1);
  expect((await ui.find({ key: 'task-p1c-r' }))?.text).toContain('stalled');
  expect(await ui.find({ key: 'description-p1c-r' })).toBeDefined();
  expect(seen.processes.length).toBe(0); noEffects(seen);
});

test('details are bounded helper reads; stop confirms dispatch and steer retains shell-safe copy fallback', async ($, on) => {
  const { seen, snapshot } = setup(on); await start($);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' }); await ui.press({ key: 'task-p1c-r' });
  await ui.press({ key: 'details-p1c-r' });
  expect((await ui.find({ key: 'log-p1c-r' }))?.text).toBe('token=[redacted]\nlast event');
  expect(seen.processes.length).toBe(1);
  await ui.press({ key: 'stop-p1c-r' });
  expect(seen.processes.length).toBe(1);
  await ui.press({ key: 'orch-confirm' });
  expect(seen.processes[1]).toEqual(['node', expect.stringContaining('/scripts/orch/dispatch.mjs'), 'stop', 'p1c-r', '--expected-attempt', snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r').attempt_id, '--expected-session', 'recorded-session-p1c-r']);
  await ui.press({ key: 'steer-p1c-r' });
  const message = "owner's $() `literal`\nsecond line";
  await ui.input({ key: 'orch-steer-text', text: message });
  await ui.press({ key: 'orch-steer-copy' });
  expect(seen.copies[0]).not.toContain(" && ");
  expect(seen.copies[0]).toContain("steer 'p1c-r' 'owner'\\''s $() `literal`\nsecond line'");
  expect(seen.processes.length).toBe(2); noEffects(seen);
  await ui.press({ key: 'task-d1a' });
  expect(await ui.find({ key: 'stop-d1a' })).toBeUndefined();
  expect(await ui.find({ key: 'steer-d1a' })).toBeUndefined();
});

test('stale, malformed/missing snapshots retain last view and disable control buttons', async ($, on) => {
  const { clock, seen, control } = setup(on); await start($);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' }); await ui.press({ key: 'task-p1c-r' });
  await clock.advance(120000);
  expect(await ui.find({ key: 'orch-stale' })).toBeDefined();
  expect(await ui.find({ key: 'stop-p1c-r' })).toBeUndefined();
  control.raw = '{broken'; await ui.press({ key: 'orch-refresh' });
  expect(await ui.find({ key: 'orch-error' })).toBeDefined();
  expect(await ui.find({ key: 'task-p1c-r' })).toBeDefined();
  expect(seen.counters.at(-1)).toContain('updates delayed');
  control.missing = true; await ui.press({ key: 'orch-refresh' });
  expect((await ui.find({ key: 'orch-error' }))?.text).toContain('ENOENT');
  control.missing = false; control.raw = '{"schema_version":2}'; await ui.press({ key: 'orch-refresh' });
  expect((await ui.find({ key: 'orch-error' }))?.text).toContain('Unsupported');
  noEffects(seen);
});

test('one-line band respects width/survey; other surfaces receive no custom pane', async ($, on) => {
  const { seen } = setup(on);
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['host fallback'] }));
  await start($);
  const band = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: bandProps });
  expect((await band.find({ key: 'orch-band' }))?.text.length).toBeLessThanOrEqual(40);
  await band.redraw({ ...bandProps, hasSurvey: true });
  expect(await band.find({ key: 'orch-band' })).toBeUndefined();
  await band.redraw({ ...bandProps, maxRows: 0 });
  expect(await band.find({ key: 'orch-band' })).toBeUndefined();
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ key: 'orch-count' })).toBeUndefined();
  }
  noEffects(seen);
});

test('changed attempt and clipboard failure cannot run a command; clear cancels timer', async ($, on) => {
  const { snapshot, clock, seen, control } = setup(on); await start($);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' }); await ui.press({ key: 'task-p1c-r' });
  control.clipboard = false; await ui.press({ key: 'steer-p1c-r' }); await ui.input({ key: 'orch-steer-text', text: 'continue' }); await ui.press({ key: 'orch-steer-copy' });
  expect(seen.toasts.at(-1)).toContain('Clipboard unavailable');
  snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r').attempt_id = 'new-attempt';
  await ui.press({ key: 'orch-refresh' }); await ui.press({ key: 'orch-steer-copy' });
  expect(seen.copies.length).toBe(1);
  await $.session.end({ reason: 'clear', sessionId: 'test', resume: { id: 'test' } });
  const before = seen.reads; await clock.advance(60000); expect(seen.reads).toBe(before);
  await $.command.run({ command: 'orch', args: '' }); expect(seen.reads).toBe(before + 1);
  await clock.advance(60000); expect(seen.reads).toBe(before + 2);
  expect(seen.processes.length).toBe(0); noEffects(seen);
});

test('500 tasks page at 100 rows and shrink back to page one; polling stays free of model calls', async ($, on) => {
  const { snapshot, clock, seen } = setup(on);
  const base = snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r');
  snapshot.tasks = Array.from({ length: 500 }, (_, i) => ({ ...base, id: 'load-' + i }));
  snapshot.goals = [{ id: base.goal_id, title: base.goal_id, lanes: [{ id: base.lane, title: base.lane, tasks: snapshot.tasks }] }];
  await start($); const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  expect(await ui.find({ key: 'task-load-99' })).toBeDefined();
  expect(await ui.find({ key: 'task-load-100' })).toBeUndefined();
  await ui.press({ key: 'orch-next' });
  expect(await ui.find({ key: 'task-load-100' })).toBeDefined();
  expect(await ui.find({ key: 'task-load-0' })).toBeUndefined();
  for (let tick = 0; tick < 10; tick++) {
    snapshot.collector_heartbeat_at = new Date(clock.now() + 60000).toISOString();
    await clock.advance(60000);
  }
  snapshot.tasks = [base]; snapshot.goals[0].lanes[0].tasks = [base];
  await ui.press({ key: 'orch-refresh' });
  expect(await ui.find({ key: 'task-p1c-r' })).toBeDefined();
  expect(seen.processes.length).toBe(0); noEffects(seen);
});

test('HO1 goal headers, empty paused goal, partial counts, blockers and owner-only session commands', async ($, on) => {
  const { snapshot, clock, seen } = setup(on); await start($);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  expect((await ui.find({ key: 'goal-empty' }))?.text).toContain('#1 Empty goal · paused');
  expect((await ui.find({ key: 'goal-empty' }))?.text).toContain('LOW');
  expect((await ui.find({ key: 'goal-novisenti' }))?.text).toContain('active / needs_owner');
  expect((await ui.find({ key: 'goal-novisenti' }))?.text).toContain('native_ownership_unverified');
  expect((await ui.find({ key: 'budget-novisenti' }))?.text).toContain('Claude turns used 2 / cap 8 · reserved unknown · remaining 6');
  expect((await ui.find({ key: 'budget-novisenti' }))?.text).toContain('codex attempts used 1 / cap 4 · reserved active 1 · remaining 3');
  expect((await ui.find({ key: 'budget-novisenti' }))?.text).toContain('cursor attempts used 2 / cap unknown');
  expect((await ui.find({ key: 'goal-blocker-novisenti-0' }))?.text).toContain('needs_owner');
  expect((await ui.find({ key: 'goal-blocker-novisenti-1' }))?.text).toContain('Monitor expired');
  expect(await ui.find({ key: 'goal-empty-empty' })).toBeDefined();
  await ui.press({ key: 'goal-empty' }); expect(await ui.find({ key: 'goal-empty-empty' })).toBeUndefined();
  await ui.press({ key: 'orch-refresh' }); expect(await ui.find({ key: 'goal-empty-empty' })).toBeUndefined();
  await ui.press({ key: 'attach-parent-novisenti' });
  expect(seen.copies[0]).toBe(snapshot.orchestrators[0].attach_command);
  await ui.press({ key: 'resume-child-novisenti' });
  expect(seen.copies[1]).toBe(snapshot.orchestrators[1].resume_command);
  // Revision change holds command copying until freshly projected commands arrive.
  snapshot.registry_revision++;
  await ui.press({ key: 'orch-refresh' }); await ui.press({ key: 'attach-parent-novisenti' });
  expect(seen.copies.length).toBe(2); expect(seen.toasts.at(-1)).toContain('binding changed');
  await clock.advance(120000);
  expect(await ui.find({ key: 'attach-parent-novisenti' })).toBeUndefined();
  expect(await ui.find({ key: 'resume-child-novisenti' })).toBeUndefined();
  expect(seen.processes.length).toBe(0); noEffects(seen);
});

test('UPD1 updates and ST1 queued steering coexist without executing commands', async ($, on) => {
  const { snapshot, seen } = setup(on);
  const task = snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r');
  snapshot.updates = ['12:00 demo/build: merge check done'];
  task.steering = { mode: 'queue' };
  task.queued_steers = [{ id: 'first', at: snapshot.generated_at, text: 'first owner message' }];
  await start($); const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' }); await ui.press({ key: 'task-p1c-r' });
  expect((await ui.find({ key: 'steer-queued-p1c-r-first' }))?.text).toContain('first owner message');
  expect((await ui.find({ key: 'orch-updates' }))?.text).toContain('merge check done');
  expect(seen.processes.length).toBe(0); noEffects(seen);
});

test('UPD1: pane shows last 20 updates and one-line band hides raw updates, without model calls', async ($, on) => {
  const { snapshot, seen } = setup(on);
  snapshot.updates = Array.from({ length: 25 }, (_, i) => `12:00 demo/build: task ${i} done`);
  await start($);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  const updates = (await ui.find({ key: 'orch-updates' }))?.text ?? '';
  expect(updates).toContain('task 5 done');
  expect(updates).toContain('task 24 done');
  expect(updates).not.toContain('task 4 done');
  const band = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, bodyColumns: 100 } });
  expect((await band.find({ key: 'orch-band' }))?.text).not.toContain('task 24 done');
  noEffects(seen);
});


test('UPD1 channel opt-out hides pane/band updates; parent orchestration notes are info', async ($, on) => {
  const { snapshot, seen } = setup(on);
  snapshot.updates = ['12:00 demo/build: secret update done'];
  snapshot.update_channels = { web: true, pane: false };
  snapshot.goals.find((g: { id: string }) => g.id === 'novisenti').info = [{ code: 'parent_orchestrated', description: 'No child bound' }];
  await start($); const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  expect((await ui.find({ key: 'orch-updates' }))?.text ?? '').not.toContain('secret update');
  expect((await ui.find({ key: 'goal-info-novisenti-0' }))?.text).toContain('Info: parent_orchestrated');
  const band = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, bodyColumns: 100 } });
  expect((await band.find({ key: 'orch-band' }))?.text).not.toContain('secret update');
  noEffects(seen);
});


test('adopted observations are informational and do not inflate the prompt blocker count', async ($, on) => {
  const { snapshot, seen } = setup(on);
  const base = snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r');
  snapshot.tasks = [{ ...base, id: 'p1b', adopted: true, state: 'stalled', blockers: [], info: [{ code: 'unknown_exit', description: 'Legacy observation only' }] }];
  snapshot.goals = [{ ...snapshot.goals[0], lanes: [{ id: base.lane, title: base.lane, tasks: snapshot.tasks }] }];
  snapshot.updates = [];
  await start($); const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  await ui.press({ key: 'task-p1b' });
  expect((await ui.find({ key: 'info-p1b-0' }))?.text).toContain('Info: unknown_exit');
  const band = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, bodyColumns: 100 } });
  expect((await band.find({ key: 'orch-band' }))?.text).toContain('0 need you');
  noEffects(seen);
});

test('CP3 bound parent defaults on, requests maximum size without focus, and hides assistant drawing only', async ($, on) => {
  const { control, seen } = setup(on); control.sessionId = 'parent-exact';
  on('ui.render', () => ({ type: 'Box', props: { key: 'host-chat' }, children: [{ type: 'Text', children: ['original assistant text'] }] }));
  await start($);
  expect(seen.opens).toBe(1);
  expect(seen.openArgs[0].rows).toBe(10000); expect(seen.openArgs[0].columns).toBe(10000);
  expect(seen.openArgs[0].focus).toBeUndefined();
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  const chat = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AssistantMessage', requestId: 'reply', props: { text: 'original assistant text', isFirstOfReply: true } });
  expect(await chat.find({ key: 'host-chat' })).toBeUndefined();
  await ui.press({ key: 'orch-chat' }); expect((await chat.find({ key: 'host-chat' }))?.text).toBe('original assistant text');
  await ui.press({ key: 'orch-chat' }); expect(await chat.find({ key: 'host-chat' })).toBeUndefined();
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const remote = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AssistantMessage', requestId: 'remote-' + surface, props: { text: 'original assistant text', isFirstOfReply: true } });
    expect(await remote.find({ key: 'host-chat' })).toBeDefined();
  }
  await $.command.run({ command: 'orch', args: 'off' }); expect(seen.closes).toBe(1);
  expect(await chat.find({ key: 'host-chat' })).toBeDefined();
  await ui.press({ key: 'orch-refresh' }); expect(seen.opens).toBe(1); // explicit off survives refresh
  await $.command.run({ command: 'orch', args: 'on' }); expect(seen.opens).toBe(2);
  expect(await chat.find({ key: 'host-chat' })).toBeUndefined();
  await ui.press({ key: 'orch-off' }); expect(await chat.find({ key: 'host-chat' })).toBeDefined();
  await ui.press({ key: 'orch-refresh' }); expect(seen.opens).toBe(2);
  expect(seen.processes.length).toBe(0); noEffects(seen);
});

test('CP3 unplaced auto-open keeps chat visible, parent binding can arrive later, clear resets preference', async ($, on) => {
  const { control, seen, snapshot } = setup(on); control.placed = false;
  on('ui.render', () => ({ type: 'Box', props: { key: 'host-chat' }, children: [{ type: 'Text', children: ['host text'] }] }));
  await start($); expect(seen.opens).toBe(0);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' });
  const chat = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AssistantMessage', requestId: 'reply', props: { text: 'host text', isFirstOfReply: false } });
  control.sessionId = 'parent-exact';
  snapshot.registry_revision++; // mismatched bindings must not auto-enable
  await ui.press({ key: 'orch-refresh' }); expect(seen.opens).toBe(0);
  snapshot.registry_revision--;
  await ui.press({ key: 'orch-refresh' }); expect(seen.opens).toBe(1);
  expect(await chat.find({ key: 'host-chat' })).toBeDefined();
  expect(seen.toasts.at(-1)).toContain('waiting');
  control.placed = true; await ui.press({ key: 'orch-refresh' });
  expect(await chat.find({ key: 'host-chat' })).toBeUndefined();
  await $.session.end({ reason: 'clear', sessionId: 'parent-exact', resume: { id: 'parent-exact' } });
  control.sessionId = 'new-unbound'; await $.command.run({ command: 'orch', args: 'off' });
  expect(await chat.find({ key: 'host-chat' })).toBeDefined();
  await $.command.run({ command: 'orch', args: 'invalid' }); expect(seen.toasts.at(-1)).toContain('Usage');
  noEffects(seen);
});

test('CP3 confirms exact argv once; cancel submits nothing; queued/live and --now semantics are separate', async ($, on) => {
  const { seen, snapshot } = setup(on); await start($);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' }); await ui.press({ key: 'task-p1c-r' });
  await ui.press({ key: 'stop-p1c-r' }); await ui.press({ key: 'orch-cancel' });
  expect(seen.processes.length).toBe(0);
  await ui.press({ key: 'steer-p1c-r' });
  const text = "owner's $() `literal`\nsecond line";
  await ui.input({ key: 'orch-steer-text', text }); await ui.press({ key: 'orch-steer-review' });
  expect((await ui.find({ key: 'orch-confirmation' }))?.text).toContain('otherwise queues');
  await Promise.allSettled([ui.press({ key: 'orch-confirm' }), ui.press({ key: 'orch-confirm' })]);
  const task = snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r');
  expect(seen.processes.length).toBe(1);
  expect(seen.processes[0]).toEqual(['node', expect.stringContaining('/scripts/orch/dispatch.mjs'), 'steer', task.id, text, '--expected-attempt', task.attempt_id, '--expected-session', task.session_id]);
  await ui.press({ key: 'steer-p1c-r' }); await ui.input({ key: 'orch-steer-text', text: 'now' });
  await ui.press({ key: 'orch-steer-now' });
  expect((await ui.find({ key: 'orch-confirmation' }))?.text).toContain('verifies exit');
  await ui.press({ key: 'orch-confirm' }); expect((seen.processes[1] as string[])[5]).toBe('--now');
  expect(seen.processes.length).toBe(2); noEffects(seen);
});

for (const changed of ['attempt', 'session', 'stale', 'adopted', 'missing', 'stopped'] as const) {
  test(`CP3 pending stop rejects ${changed} target before dispatch`, async ($, on) => {
    const { snapshot, seen } = setup(on); await start($);
    const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' }); await ui.press({ key: 'task-p1c-r' }); await ui.press({ key: 'stop-p1c-r' });
    const task = snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r');
    if (changed === 'attempt') task.attempt_id = 'replacement';
    if (changed === 'session') task.session_id = 'replacement';
    if (changed === 'stale') snapshot.collector_heartbeat_at = '2000-01-01T00:00:00Z';
    if (changed === 'adopted') task.adopted = true;
    if (changed === 'missing') snapshot.tasks = snapshot.tasks.filter((t: { id: string }) => t.id !== task.id);
    if (changed === 'stopped') task.state = 'stopped';
    await ui.press({ key: 'orch-confirm' });
    expect(seen.processes.length).toBe(0); expect(seen.toasts.at(-1)).toContain('control cancelled');
    expect(await ui.find({ key: 'orch-confirmation' })).toBeUndefined(); noEffects(seen);
  });
}

test('CP3 dispatcher failure is surfaced without retry; blank steering sends nothing', async ($, on) => {
  const { seen, control } = setup(on); await start($);
  const ui = await $.ui.mount(PANE); await ui.press({ key: 'orch-details' }); await ui.press({ key: 'task-p1c-r' });
  await ui.press({ key: 'steer-p1c-r' }); await ui.press({ key: 'orch-steer-review' });
  expect(await ui.find({ key: 'orch-confirmation' })).toBeUndefined(); expect(seen.processes.length).toBe(0);
  control.processCode = 1; await ui.press({ key: 'stop-p1c-r' }); await ui.press({ key: 'orch-confirm' });
  expect(seen.toasts.at(-1)).toContain('Control failed: Error: Control attempt changed');
  expect(seen.processes.length).toBe(1); noEffects(seen);
});

test('CP4 default at 80 columns: owner-only cards, bounded work/next, hidden jargon; Details survives refresh', async ($, on) => {
  const { snapshot, clock, seen } = setup(on);
  const goal = snapshot.goals.find((g: { id: string }) => g.id === 'novisenti');
  goal.title = 'Novisenti'; goal.headline = 'Product built and deployed (AI off). Waiting for you: approve Azure issuer job.';
  goal.milestones = [{ name: 'Plan', state: 'done' }, { name: 'Issuer job', state: 'now' }, { name: 'Opus gate (~23:00 UTC)', state: 'next' }, { name: 'Paid test ≤$10', state: 'next' }, { name: 'Report', state: 'next' }, { name: 'Later', state: 'next' }];
  goal.owner_actions = [{ text: 'Approve creating the Azure issuer job (create-only, no spend)', since: snapshot.generated_at }];
  const base = snapshot.tasks.find((t: { id: string }) => t.id === 'p1c-r');
  base.title = 'CP4 plain-language overview'; base.elapsed_ms = 720000; base.estimate_ms = { low: 5400000, high: 5400000 };
  snapshot.tasks.push(...Array.from({ length: 5 }, (_, i) => ({ ...base, id: 'working-' + i, state: 'running' })));
  await start($);
  const ui = await $.ui.mount({ ...PANE, props: { ...props, bodyColumns: 80 } });
  expect((await ui.find({ key: 'headline-novisenti' }))?.text).toContain('Product built and deployed');
  expect((await ui.find({ key: 'owner-actions-novisenti' }))?.text).toContain('Needs you');
  expect((await ui.find({ key: 'owner-action-novisenti-0' }))?.text).toBe(goal.owner_actions[0].text);
  expect((await ui.find({ key: 'milestones-novisenti' }))?.text).toContain('✓ Plan');
  expect((await ui.find({ key: 'milestones-novisenti' }))?.text).toContain('● Issuer job');
  expect((await ui.find({ key: 'working-novisenti-0' }))?.text).toContain('Codex is working on plain-language overview · 12m/90m');
  expect(await ui.find({ key: 'working-novisenti-3' })).toBeUndefined();
  expect(await ui.find({ key: 'next-novisenti-3' })).toBeUndefined();
  for (const key of ['orch-tree', 'task-p1c-r', 'budget-novisenti', 'goal-blocker-novisenti-0', 'orch-updates', 'session-parent-novisenti']) expect(await ui.find({ key })).toBeUndefined();
  expect((await ui.find({ key: 'overview-details-novisenti' }))?.text).toContain('tasks done today · Details');
  const band = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, bodyColumns: 100 } });
  expect((await band.find({ key: 'orch-band' }))?.text).toContain('Needs you: Approve');
  await ui.press({ key: 'overview-details-novisenti' });
  expect(await ui.find({ key: 'task-p1c-r' })).toBeDefined();
  expect((await ui.find({ key: 'budget-novisenti' }))?.text).toContain('Counts-v1');
  goal.headline = 'Approved. Preparing the test.'; goal.owner_actions = [];
  snapshot.collector_heartbeat_at = new Date(clock.now() + 60000).toISOString();
  await clock.advance(60000);
  expect((await ui.find({ key: 'headline-novisenti' }))?.text).toBe(goal.headline);
  expect(await ui.find({ key: 'owner-actions-novisenti' })).toBeUndefined();
  expect(await ui.find({ key: 'task-p1c-r' })).toBeDefined();
  await ui.press({ key: 'orch-details' }); expect(await ui.find({ key: 'task-p1c-r' })).toBeUndefined();
  expect(seen.processes.length).toBe(0); noEffects(seen);
});
