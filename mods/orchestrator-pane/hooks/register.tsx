import { atom, read, update } from 'claude-code';
import type { Register, EngineInterface, Timer } from 'claude-code';
import type { OrchStatus, OrchTask, OrchView, OrchExpansion, OrchDetail, OrchDraft, OrchGoal, OrchRecoverySession } from '../types/index';

const PANE = 'orch';
const view = atom<OrchView>({ plugin: 'orchestrator-pane', key: 'view' }, { snapshot: null, error: 'Waiting for collector', readAt: 0 });
const expanded = atom<OrchExpansion>({ plugin: 'orchestrator-pane', key: 'expanded' }, {});
const detail = atom<OrchDetail>({ plugin: 'orchestrator-pane', key: 'detail' }, null);
const draft = atom<OrchDraft>({ plugin: 'orchestrator-pane', key: 'draft' }, null);
const page = atom<number>({ plugin: 'orchestrator-pane', key: 'page' }, 0);

export function clean(value: unknown, limit = 1200): string {
  return String(value ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;"']+/gi, '$1[redacted]').slice(0, limit);
}
function quote(text: string): string { return "'" + text.replace(/'/g, "'\\''") + "'"; }
function live(task: OrchTask): boolean { return ['running', 'stalled'].includes(task.state); }
function stale(current: OrchView, now: number): boolean {
  const heartbeat = Date.parse(current.snapshot?.collector_heartbeat_at ?? '');
  return !!current.error || !Number.isFinite(heartbeat) || now - heartbeat > 90000 || heartbeat > now + 60000;
}
function count(current: OrchView, now: number): string {
  const tasks = current.snapshot?.tasks ?? [];
  const running = tasks.filter(task => live(task)).length;
  const blocked = tasks.filter(task => task.blockers.length || ['blocked', 'stalled'].includes(task.state)).length;
  const done = tasks.filter(task => task.state.startsWith('done')).length;
  return `${running} run / ${blocked} block / ${done} done (unverified)${stale(current, now) ? ' · STALE' : ''}`;
}
function minutes(ms: number | null): string { return ms === null ? '?' : `${Math.round(ms / 60000)}m`; }
const known = (value: number | null | undefined): string => value == null ? 'unknown' : String(value);
export function goalLabel(goal: OrchGoal): string {
  return `#${known(goal.priority)} ${clean(goal.title)} · ${clean(goal.desired_state ?? 'unregistered')} / ${clean(goal.observed_state ?? 'unknown')} · child ${clean(goal.child?.health ?? 'unobserved')} (${clean(goal.child?.state ?? 'needs_owner')}) · ${goal.child?.effort === 'low' ? 'LOW' : 'effort unknown'} · session ${clean(goal.child?.session_id ?? 'unbound')}`;
}
export function budgetLabel(goal: OrchGoal): string {
  const lines = [`Counts-v1 · Claude turns used ${known(goal.usage?.claude?.turns)} / cap ${known(goal.budget?.claude_turn_cap)} · reserved ${known(goal.reserved?.claude_turns)} · remaining ${known(goal.remaining?.claude_turns)}`];
  for (const cli of ['codex', 'cursor', 'agy']) lines.push(`${cli} attempts used ${known(goal.usage?.workers?.[cli]?.attempts)} / cap ${known(goal.budget?.worker_caps?.[cli]?.runs)} · reserved active ${known(goal.reserved?.worker_runs?.[cli])} · remaining ${known(goal.remaining?.worker_runs?.[cli])}`);
  lines.push('Active reservations are included in attempts used. Token/quota attribution unknown.');
  return lines.join('\n');
}
function timing(task: OrchTask): string {
  const estimate = task.estimate_ms;
  return `${minutes(task.elapsed_ms)} / est ${minutes(estimate.low)}${estimate.high !== estimate.low ? '–' + minutes(estimate.high) : ''}`;
}
function validSnapshot(value: unknown): value is OrchStatus {
  const s = value as OrchStatus;
  return !!s && s.schema_version === 1 && Number.isInteger(s.revision) && typeof s.collector_heartbeat_at === 'string'
    && Array.isArray(s.goals) && Array.isArray(s.tasks) && Array.isArray(s.warnings)
    && s.goals.every(g => typeof g.id === 'string' && Array.isArray(g.lanes) && g.lanes.every(l => typeof l.id === 'string' && Array.isArray(l.tasks)))
    && s.tasks.every(t => typeof t.id === 'string' && typeof t.state === 'string' && !!t.executor && !!t.estimate_ms
      && Array.isArray(t.blockers) && Array.isArray(t.events_last_3) && Array.isArray(t.depends_on) && Array.isArray(t.acceptance));
}

let timer: Timer | undefined;
let refreshing = false;
let stateDir = '';
let scriptRoot = '';
async function paths($: EngineInterface) {
  stateDir = (await $.env.get('ORCH_STATE_DIR')) || `${await $.env.get('HOME')}/.local/state/orch`;
  // Resolve from the loaded source folder, independent of the session cwd.
  scriptRoot = `${$.plugin.root}/../../scripts/orch`;
}
async function refresh($: EngineInterface) {
  if (refreshing) return;
  refreshing = true;
  try {
    if (!stateDir) await paths($);
    const now = await $.clock.now();
    try {
      const file = `${stateDir}/status.json`;
      const stat = await $.fs.stat(file);
      if (stat.kind !== 'file' || stat.size > 1024 * 1024) throw new Error('status.json exceeds 1 MiB or is not a file');
      const snapshot: unknown = JSON.parse(await $.fs.read(file));
      if (!validSnapshot(snapshot)) throw new Error('Unsupported status.json schema');
      await update($, view, () => ({ snapshot, error: null, readAt: now }));
    } catch (error) {
      await update($, view, old => ({ ...old, error: clean(String(error)), readAt: now }));
    }
    await $.ui.status(count(await read($, view), now));
    $.ui.invalidate('ui.render');
  } finally { refreshing = false; }
}
async function start($: EngineInterface) {
  await refresh($);
  if (!timer) timer = $.clock.every(60000, () => refresh($));
}
async function open($: EngineInterface) {
  await start($);
  await $.ui.open({ id: PANE, title: 'Orchestrator', focus: true });
}
async function toggle($: EngineInterface, key: string, defaultValue = false) {
  await update($, expanded, old => ({ ...old, [key]: !(old[key] ?? defaultValue) }));
}
function command(task: OrchTask, text?: string): string {
  const base = `env ORCH_STATE_DIR=${quote(stateDir)} node ${quote(scriptRoot + '/dispatch.mjs')}`;
  const stop = `${base} stop ${quote(task.id)}`;
  if (text === undefined) return stop;
  const resume = `${base} resume ${quote(task.id)} ${quote(text)}`;
  return live(task) ? `${stop} && ${resume}` : resume;
}
async function copy($: EngineInterface, id: string, attempt: string, surface: 'terminal', text?: string) {
  const current = await read($, view);
  const task = current.snapshot?.tasks.find(t => t.id === id && t.attempt_id === attempt);
  if (!task || task.adopted || stale(current, await $.clock.now()) || (text !== undefined && (!task.session_id || !text.trim()))) {
    await $.ui.toast('Task changed, stale, or read-only; refresh before copying.'); return;
  }
  const result = await $.ui.copy({ text: command(task, text), surface });
  await $.ui.toast(result.isCopied ? 'Command copied. Run it in your terminal.' : 'Clipboard unavailable; copy the command shown in the pane.');
}
async function copySession($: EngineInterface, entry: OrchRecoverySession, kind: 'attach_command' | 'resume_command', surface: 'terminal') {
  const current = await read($, view);
  const latest = current.snapshot?.orchestrators?.find(s => s.role === entry.role && s.goal_id === entry.goal_id && s.session_id === entry.session_id && s.generation === entry.generation);
  if (stale(current, await $.clock.now()) || latest?.registry_revision !== current.snapshot?.registry_revision || latest?.[kind] !== entry[kind] || !latest?.[kind]) {
    await $.ui.toast('Session binding changed, stale, or held; refresh before copying.'); return;
  }
  const result = await $.ui.copy({ text: latest[kind], surface });
  await $.ui.toast(result.isCopied ? 'Owner command copied. Verify native ownership before running; parent first.' : 'Clipboard unavailable; copy the command shown in the pane.');
}
async function details($: EngineInterface, task: OrchTask) {
  try {
    if (!task.log_path?.startsWith('/')) throw new Error('No registered absolute log path');
    const result = await $.process.run(['node', `${scriptRoot}/tail.mjs`, task.log_path], { timeoutMs: 5000 });
    if (result.exitCode !== 0) throw new Error(result.stderr || 'Log tail failed');
    const tail = JSON.parse(result.stdout);
    await update($, detail, () => ({ taskId: task.id, attemptId: task.attempt_id, path: task.log_path, text: clean(tail.text, 65536), at: tail.at, truncated: tail.truncated }));
  } catch (error) {
    await update($, detail, () => ({ taskId: task.id, attemptId: task.attempt_id, path: task.log_path, text: clean(String(error)), at: '', truncated: false }));
  }
}
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'orch', description: 'Open local worker status (no model calls)' });
    await start($);
    return next(e);
  });
  on('session.end', async ($, e, next) => {
    timer?.cancel(); timer = undefined;
    await $.ui.status(undefined);
    return next(e);
  });
  on('command.run', { command: 'orch' }, async ($, e) => {
    if ((await $.session.surfaces()).includes('terminal')) await open($);
    else await $.ui.toast('Orchestrator pane is local-terminal only. Use the read-only CP1 web view remotely.');
    return {};
  });
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey || e.props.maxRows < 1 || e.props.bodyColumns < 10) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    const current = await read($, view);
    const label = count(current, await $.clock.now());
    return <Box width={e.props.bodyColumns}><Box key="orch-band"><Text wrap="truncate-end">{label.slice(0, Math.max(1, e.props.bodyColumns - 9))} </Text></Box><Button key="orch-open" label="Open" onPress={() => open($)} /></Box>;
  });
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e);
    const { Box, Text, Button, Input } = $.ui.resolve(e);
    const current = await read($, view);
    const expansion = await read($, expanded);
    const log = await read($, detail);
    const steer = await read($, draft);
    const requestedPage = await read($, page);
    const isStale = stale(current, await $.clock.now());
    const tasks = current.snapshot?.tasks ?? [];
    const index = Math.min(requestedPage, Math.max(0, Math.ceil(tasks.length / 100) - 1));
    const visible = new Set(tasks.slice(index * 100, (index + 1) * 100).map(t => t.id));
    const currentSteer = tasks.find(t => t.id === steer?.taskId && t.attempt_id === steer?.attemptId);
    return <Box flexDirection="column" width={e.props.bodyColumns}>
      <Box key="orch-count"><Text>{count(current, await $.clock.now())}</Text></Box>
      <Text dimColor>Local view · refresh 60s · commands are copied for you to run</Text>
      {current.error && <Box key="orch-error"><Text color="yellow">{current.error}</Text></Box>}
      {isStale && <Box key="orch-stale"><Text color="yellow">Collector stale/unavailable · last update {current.snapshot?.collector_heartbeat_at ?? 'unknown'}</Text></Box>}
      <Button key="orch-refresh" label="Refresh" onPress={() => refresh($)} />
      {current.snapshot?.warnings.map((warning, i) => <Box key={`warning-${i}`}><Text color="yellow">{clean(warning.code)}: {clean(warning.description)}</Text></Box>)}
      {current.snapshot?.orchestrators?.length ? <Text>Owner sessions · parent first, then children · verify native ownership and LOW · no automatic launch</Text> : null}
      {current.snapshot?.orchestrators?.map(entry => <Box key={`session-${entry.role}-${entry.goal_id}`} flexDirection="column">
        <Text>{clean(entry.role)} {clean(entry.goal_id)} · {clean(entry.session_id)} · generation {entry.generation} · {clean(entry.state)} · auto_start=false</Text>
        <Text>{clean(entry.reason)}</Text>
        <Text>Live attach: {entry.attach_command ?? 'held'}</Text>
        <Text>Stopped resume (verify native supervisor stopped): {entry.resume_command ?? 'held'}</Text>
        {!isStale && entry.attach_command && <Button key={`attach-${entry.role}-${entry.goal_id}`} label="Copy live attach" onPress={() => copySession($, entry, 'attach_command', e.surface)} />}
        {!isStale && entry.resume_command && <Button key={`resume-${entry.role}-${entry.goal_id}`} label="Copy stopped resume" onPress={() => copySession($, entry, 'resume_command', e.surface)} />}
      </Box>)}
      {!current.snapshot?.orchestrators?.length && current.snapshot?.recovery?.parent && <Text>Owner attach: {current.snapshot.recovery.parent.resume_command ?? current.snapshot.recovery.parent.reason ?? 'held'}</Text>}
      {current.snapshot?.recovery?.tasks.map(entry => <Box key={`recovery-${entry.id}`}><Text>Recovery {clean(entry.id)}: {clean(entry.action)} {clean(entry.reason)}</Text></Box>)}
      {!tasks.length && <Box key="orch-empty"><Text>No registered tasks.</Text></Box>}
      {[...(current.snapshot?.goals ?? [])].sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)).map(goal => <Box key={`goal-box-${goal.id}`} flexDirection="column">
        <Button key={`goal-${goal.id}`} label={`${expansion['goal-' + goal.id] === false ? '▸' : '▾'} ${goalLabel(goal)}`} onPress={() => toggle($, 'goal-' + goal.id, true)} />
        <Box key={`budget-${goal.id}`}><Text>{budgetLabel(goal)}</Text></Box>
        {goal.blockers?.map((b, i) => <Box key={`goal-blocker-${goal.id}-${i}`}><Text color="yellow">Blocker: {clean(b.code)} · {clean(b.description)}</Text></Box>)}
        {expansion['goal-' + goal.id] !== false && !goal.lanes.length && <Box key={`goal-empty-${goal.id}`}><Text>No lanes or tasks registered.</Text></Box>}
        {expansion['goal-' + goal.id] !== false && goal.lanes.map(lane => <Box key={`lane-box-${goal.id}-${lane.id}`} flexDirection="column" paddingLeft={1}>
          <Button key={`lane-${goal.id}-${lane.id}`} label={`${expansion['lane-' + goal.id + '-' + lane.id] === false ? '▸' : '▾'} ${clean(lane.title)} · ${lane.tasks.length} tasks`} onPress={() => toggle($, 'lane-' + goal.id + '-' + lane.id, true)} />
          {expansion['lane-' + goal.id + '-' + lane.id] !== false && tasks.filter(t => t.goal_id === goal.id && t.lane === lane.id && visible.has(t.id)).map(task => <Box key={`task-box-${task.id}`} flexDirection="column" paddingLeft={1}>
            <Button key={`task-${task.id}`} label={`${expansion['task-' + task.id] ? '▾' : '▸'} ${clean(task.id)} · ${clean(task.title)} · ${clean(task.state)} · ${timing(task)}`} onPress={() => toggle($, 'task-' + task.id)} />
            {expansion['task-' + task.id] && <Box flexDirection="column" paddingLeft={1}>
              <Box key={`description-${task.id}`}><Text>{clean(task.description)}</Text></Box>
              <Box key={`executor-${task.id}`}><Text>{clean(task.executor.cli)} · {clean(task.executor.model ?? 'unknown model')} / {clean(task.executor.effort ?? 'unknown effort')}</Text></Box>
              <Box key={`timing-${task.id}`}><Text>Elapsed {timing(task)} · {clean(task.verification_state)}</Text></Box>
              <Box key={`needs-${task.id}`}><Text>Needs: {task.depends_on.length ? task.depends_on.map(id => clean(id)).join(' + ') : 'none'}</Text></Box>
              {task.acceptance.map((ac, i) => <Box key={`ac-${task.id}-${i}`}><Text>Acceptance: {clean(ac)}</Text></Box>)}
              {task.events_last_3.slice(-3).map((event, i) => <Box key={`event-${task.id}-${i}`}><Text>Event: {clean(event)}</Text></Box>)}
              {task.blockers.map((blocker, i) => <Box key={`blocker-${task.id}-${i}`}><Text color="yellow">Blocker: {clean(blocker.code)} · {clean(blocker.description)}</Text></Box>)}
              <Button key={`details-${task.id}`} label="Details (log tail)" onPress={() => details($, task)} />
              {task.adopted ? <Text>Read-only adopted task · owner controls unavailable</Text> : <Box flexDirection="column">
                {!isStale && live(task) && <Button key={`stop-${task.id}`} label="Stop: copy command" onPress={() => copy($, task.id, task.attempt_id, e.surface)} />}
                {!isStale && task.session_id && <Button key={`steer-${task.id}`} label="Steer: draft command" onPress={() => update($, draft, () => ({ taskId: task.id, attemptId: task.attempt_id, text: '' }))} />}
                {live(task) && <Box key={`stop-command-${task.id}`}><Text>{command(task)}</Text></Box>}
                {!task.session_id && <Text>Steer unavailable: session ID unknown</Text>}
              </Box>}
              {log?.taskId === task.id && log.attemptId === task.attempt_id && <Box flexDirection="column">
                <Text>Log {clean(log.path)} · {log.at} · {log.truncated ? 'truncated, last ≤64 KiB / 200 lines' : 'complete'}</Text>
                <Box key={`log-${task.id}`}><Text>{log.text}</Text></Box>
              </Box>}
            </Box>}
          </Box>)}
        </Box>)}
      </Box>)}
      {tasks.length > 100 && <Box>
        <Text>Page {index + 1} / {Math.ceil(tasks.length / 100)} </Text>
        <Button key="orch-prev" label="Previous" onPress={() => update($, page, p => Math.max(0, p - 1))} />
        <Button key="orch-next" label="Next" onPress={() => update($, page, p => Math.min(Math.ceil(tasks.length / 100) - 1, p + 1))} />
      </Box>}
      {steer && <Box flexDirection="column">
        <Text>Steer {clean(steer.taskId)} · exact owner text; run the copied command yourself.</Text>
        {currentSteer && live(currentSteer) && <Text color="yellow">This command stops the worker before resuming its recorded session.</Text>}
        <Input key="orch-steer-text" label="Message" value={steer.text} onInput={text => update($, draft, old => old ? { ...old, text: text.slice(0, 8192) } : null)} onSubmit={text => update($, draft, old => old ? { ...old, text: text.slice(0, 8192) } : null)} />
        {currentSteer && <Box key="orch-steer-command"><Text>{command(currentSteer, steer.text)}</Text></Box>}
        <Button key="orch-steer-copy" label="Copy steer command" onPress={() => copy($, steer.taskId, steer.attemptId, e.surface, steer.text)} />
        <Button key="orch-steer-cancel" label="Cancel" onPress={() => update($, draft, () => null)} />
      </Box>}
    </Box>;
  });
};
