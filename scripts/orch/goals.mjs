#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { stateRoot, init, atomicJson, readJson, taskPath, canonicalWorktree, git, withLocks, iso, options, isMain, sameProcess } from './common.mjs';

export const goalLock = root => path.join(root, 'locks', 'goals.lock');
const clis = ['codex', 'cursor', 'agy'];
const states = ['registered', 'active', 'paused', 'blocked', 'closing', 'closed'];
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(value);
function count(value, label, nullable = false) {
  if (nullable && value == null) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Invalid ${label}`);
  return n;
}
const overlaps = (a, b) => a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
function inside(root, file) { return file === root || file.startsWith(root + path.sep); }
function planning(plan) {
  const real = fs.realpathSync(plan);
  if (!fs.statSync(real).isFile()) throw new Error('Plan must be an existing file');
  const top = git(path.dirname(real), ['rev-parse', '--show-toplevel']);
  if (!top) throw new Error('Plan must belong to an existing Git planning worktree');
  const wt = canonicalWorktree(top);
  if (!inside(wt, real)) throw new Error('Plan escapes planning worktree');
  const board = path.join(path.dirname(real), 'BOARD.md');
  if (fs.existsSync(board) && !inside(wt, fs.realpathSync(board))) throw new Error('Board escapes planning worktree');
  return { plan: real, planning_worktree: wt, board };
}
function grantPaths(wt, value = ['.']) {
  const paths = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(paths) || !paths.length) throw new Error('Grant paths must be a nonempty array');
  for (const p of paths) {
    if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).some(x => ['..', '.git', '.svc'].includes(x)) || /(^|\/)(PLAN|BOARD)\.md$/.test(p)) throw new Error('Invalid or reserved grant path');
    let target = path.resolve(wt, p);
    if (!inside(wt, target)) throw new Error('Path escapes grant');
    while (!fs.existsSync(target) && target !== wt) target = path.dirname(target);
    if (!inside(wt, fs.realpathSync(target))) throw new Error('Linked path escapes grant');
  }
  // Check tracked and untracked links without walking ignored dependency trees.
  const files = git(wt, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (files == null) throw new Error('Cannot inspect grant paths');
  for (const file of files.split('\0').filter(Boolean)) {
    if (!paths.some(p => inside(path.resolve(wt, p), path.resolve(wt, file)))) continue;
    const target = path.join(wt, file);
    try { if (fs.lstatSync(target).isSymbolicLink() && !inside(wt, fs.realpathSync(target))) throw new Error('Linked file escapes grant'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return paths;
}
function allowedRoot(wt, roots) {
  return !roots.length || roots.some(root => root.endsWith('*') ? wt.startsWith(root.slice(0, -1)) && wt.length > root.length - 1 : inside(root, wt));
}
export function validateRegistry(registry) {
  if (registry?.schema_version !== 1 || !Number.isSafeInteger(registry.revision) || registry.revision < 0 || !Array.isArray(registry.goals) || !safeId(registry.parent?.principal) || registry.parent.depth !== 0 || registry.parent.effort !== 'low' || !Number.isSafeInteger(registry.parent.generation) || registry.parent.generation < 1) throw new Error('Invalid goals registry');
  const ids = new Set(), slots = [];
  for (const goal of registry.goals) {
    if (!safeId(goal.id) || ids.has(goal.id) || !states.includes(goal.desired_state) || !Number.isSafeInteger(goal.priority) || !Number.isSafeInteger(goal.generation) || goal.generation < 1 || !Array.isArray(goal.grants) || !Array.isArray(goal.worktree_roots)) throw new Error('Invalid goal schema');
    ids.add(goal.id);
    if (goal.child?.effort !== 'low' || typeof goal.title !== 'string' || typeof goal.objective !== 'string') throw new Error('Invalid goal contract');
    const bound = goal.child.session_id !== null;
    if (bound ? !safeId(goal.child.session_id) || !safeId(goal.child.principal) || goal.child.contract_ref !== `contracts/${goal.id}-v${goal.generation}.json` : goal.child.principal !== null || goal.child.contract_ref !== null) throw new Error('Invalid child binding');
    const configured = planning(goal.plan);
    if (configured.planning_worktree !== goal.planning_worktree || configured.plan !== goal.plan || configured.board !== goal.board) throw new Error('Planning worktree mismatch');
    slots.push({ goal: goal.id, worktree: goal.planning_worktree });
    if (goal.budget?.mode !== 'counts-v1' || goal.budget.paid_usd_cap !== 0 || !goal.budget.worker_caps) throw new Error('Invalid counts-v1 budget');
    if (goal.budget.claude_turn_cap !== null && !Number.isSafeInteger(goal.budget.claude_turn_cap)) throw new Error('Invalid Claude turn cap');
    count(goal.budget.claude_turn_cap, 'Claude turn cap', true);
    for (const cli of clis) {
      const cap = goal.budget.worker_caps[cli]?.runs;
      if (cap !== null && !Number.isSafeInteger(cap)) throw new Error(`Invalid ${cli} run cap`);
      count(cap, `${cli} run cap`, true);
    }
    for (const grant of goal.grants) {
      if (!safeId(grant.lane) || canonicalWorktree(grant.worktree) !== grant.worktree || !allowedRoot(grant.worktree, goal.worktree_roots)) throw new Error('Invalid worktree grant');
      grantPaths(grant.worktree, grant.paths);
      slots.push({ goal: goal.id, worktree: grant.worktree });
    }
  }
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) if (overlaps(slots[i].worktree, slots[j].worktree)) throw new Error('Worktree grant conflict (canonical, alias or nested ownership)');
  if (registry.parent.session_id !== null) {
    const parentGoal = registry.goals.find(g => g.id === registry.parent.goal_id);
    if (!safeId(registry.parent.session_id) || !parentGoal || registry.parent.planning_worktree !== parentGoal.planning_worktree || registry.parent.contract_ref !== `contracts/parent-v${registry.parent.generation}.json`) throw new Error('Invalid parent session/planning binding');
  }
  return registry;
}
export function readRegistry(root = stateRoot()) {
  const registry = readJson(path.join(root, 'goals.json'));
  return registry === null ? null : validateRegistry(registry);
}
export function childContract(goal, registry) {
  return { schema_version: 1, goal_id: goal.id, generation: goal.generation, parent_session_id: registry.parent.session_id,
    session_id: goal.child.session_id, principal: goal.child.principal, depth: 1, max_orchestrator_depth: 1, effort: 'low', objective: goal.objective,
    planning_worktree: goal.planning_worktree, plan: path.relative(goal.planning_worktree, goal.plan), board: path.relative(goal.planning_worktree, goal.board),
    allowed_writes: [path.relative(goal.planning_worktree, goal.plan), path.relative(goal.planning_worktree, goal.board)],
    grants_ref: `goals.json#${goal.id}`, budget_ref: `goals.json#${goal.id}/budget`, report_max_lines: 10,
    on_budget_or_conflict: 'checkpoint, stop admission, escalate', spawn_orchestrators: false };
}
export function validateChild(goal, contract) {
  const writes = [path.relative(goal.planning_worktree, goal.plan), path.relative(goal.planning_worktree, goal.board)];
  if (contract?.plan !== writes[0] || contract?.board !== writes[1] || JSON.stringify(contract?.allowed_writes) !== JSON.stringify(writes)) throw new Error('Child planning paths mismatch');
  if (contract?.schema_version !== 1 || contract.goal_id !== goal.id || contract.generation !== goal.generation || contract.depth !== 1 || contract.max_orchestrator_depth !== 1 || contract.spawn_orchestrators !== false || contract.effort !== 'low' || contract.planning_worktree !== goal.planning_worktree || contract.session_id !== goal.child.session_id || contract.principal !== goal.child.principal) throw new Error('Stale, foreign or grandchild contract denied');
  return contract;
}
export async function transact(command, o, root = stateRoot()) {
  init(root);
  return withLocks([goalLock(root)], () => {
    const registry = readRegistry(root) || { schema_version: 1, revision: 0, parent: { principal: process.env.ORCH_PRINCIPAL || 'owner', session_id: null, generation: 1, depth: 0, effort: 'low' }, goals: [] };
    if ((o.role || process.env.ORCH_ROLE || 'parent') !== 'parent' || Number(o.depth ?? process.env.ORCH_DEPTH ?? 0) !== 0 || (o.principal || process.env.ORCH_PRINCIPAL || 'owner') !== registry.parent.principal) throw new Error('Only the bound parent may write goals');
    if (o.expected_revision == null || count(o.expected_revision, 'expected revision') !== registry.revision) throw new Error('Registry revision conflict');
    if (!safeId(o.id)) throw new Error('Invalid goal id');
    let goal = registry.goals.find(x => x.id === o.id);
    if (command === 'bind-parent') {
      if (!goal || !safeId(o.parent_session)) throw new Error('Parent binding requires goal and exact session');
      const session = readJson(path.join(root, 'sessions', 'parent.json'));
      if (session && (sameProcess(session.supervisor_identity) || sameProcess(session.process_identity) || session.state !== 'released')) throw new Error('Parent handoff requires explicit reconciled release');
      for (const g of registry.goals.filter(g => g.child.session_id)) {
        const child = readJson(path.join(root, 'sessions', `child-${g.id}.json`));
        const tasks = fs.readdirSync(path.join(root, 'tasks')).filter(n => n.endsWith('.json')).map(n => readJson(path.join(root, 'tasks', n)));
        if (!['registered', 'paused', 'blocked'].includes(g.desired_state) || child?.state !== 'released' || sameProcess(child.supervisor_identity) || sameProcess(child.process_identity) || tasks.some(t => t.goal_id === g.id && !t.finished_at)) throw new Error('Parent handoff requires released children and quiescent/drained goals');
        g.generation++; g.child = { session_id: null, principal: null, effort: 'low', contract_ref: null };
      }
      registry.parent = { ...registry.parent, session_id: o.parent_session, generation: registry.parent.generation + 1,
        goal_id: goal.id, planning_worktree: goal.planning_worktree, contract_ref: `contracts/parent-v${registry.parent.generation + 1}.json` };
      fs.mkdirSync(path.join(root, 'contracts'), { recursive: true, mode: 0o700 });
      const contract = { schema_version: 1, role: 'parent', goal_id: goal.id, generation: registry.parent.generation,
        principal: registry.parent.principal, session_id: registry.parent.session_id, planning_worktree: goal.planning_worktree,
        depth: 0, max_orchestrator_depth: 1, effort: 'low', report_max_lines: 10, spawn_orchestrators: true };
      const file = path.join(root, registry.parent.contract_ref);
      if (fs.existsSync(file)) {
        if (JSON.stringify(readJson(file)) !== JSON.stringify(contract)) throw new Error('Immutable parent contract conflict');
      } else atomicJson(file, contract);
    } else if (command === 'create') {
      if (goal) throw new Error('Goal already exists');
      if (!o.title || !o.objective || !o.plan) throw new Error('Create requires title, objective and plan');
      const roots = o.worktree_roots ? (typeof o.worktree_roots === 'string' ? JSON.parse(o.worktree_roots) : o.worktree_roots) : [];
      if (!Array.isArray(roots) || roots.some(r => typeof r !== 'string' || !path.isAbsolute(r) || r.includes('..') || r.slice(0, -1).includes('*'))) throw new Error('Invalid worktree roots');
      goal = { id: o.id, title: o.title, objective: o.objective, ...planning(o.plan), priority: count(o.priority ?? 100, 'priority'), desired_state: 'registered', generation: 1,
        child: { session_id: null, principal: null, effort: 'low', contract_ref: null }, grants: [], worktree_roots: roots,
        budget: { mode: 'counts-v1', claude_turn_cap: count(o.claude_turn_cap, 'Claude turn cap', true), worker_caps: Object.fromEntries(clis.map(cli => [cli, { runs: count(o[`${cli}_runs`], `${cli} runs`, true) }])), paid_usd_cap: 0 }, acceptance_refs: [], last_decision_id: null };
      registry.goals.push(goal);
    } else {
      if (!goal) throw new Error('Unknown goal');
      if (command === 'grant-worktree') {
        const wt = canonicalWorktree(o.worktree);
        goal.grants.push({ lane: o.lane, worktree: wt, paths: grantPaths(wt, o.paths) });
      } else if (command === 'set-priority') goal.priority = count(o.priority, 'priority');
      else if (command === 'set-state') {
        if (!states.includes(o.state)) throw new Error('Invalid desired state');
        if (o.child_session || o.child_principal) {
          const session = readJson(path.join(root, 'sessions', `child-${goal.id}.json`));
          if (session && (sameProcess(session.supervisor_identity) || sameProcess(session.process_identity) || session.state !== 'released')) throw new Error('Child handoff requires explicit reconciled release');
          if (!['registered', 'paused', 'blocked'].includes(goal.desired_state)) throw new Error('Child handoff requires quiescent goal');
          if (!safeId(o.child_session) || !safeId(o.child_principal)) throw new Error('Child binding requires exact session and principal');
          const live = fs.readdirSync(path.join(root, 'tasks')).filter(x => x.endsWith('.json')).map(x => readJson(path.join(root, 'tasks', x)));
          if (live.some(t => t.goal_id === goal.id && !t.finished_at)) throw new Error('Child handoff requires drained workers');
          goal.generation++;
          goal.child = { session_id: o.child_session, principal: o.child_principal, effort: 'low', contract_ref: `contracts/${goal.id}-v${goal.generation}.json` };
        }
        if (o.claude_turn_cap != null) goal.budget.claude_turn_cap = count(o.claude_turn_cap, 'Claude turn cap');
        for (const cli of clis) if (o[`${cli}_runs`] != null) goal.budget.worker_caps[cli].runs = count(o[`${cli}_runs`], `${cli} run cap`);
        goal.desired_state = o.state;
      } else throw new Error('Expected create, grant-worktree, set-priority, set-state or list');
    }
    validateRegistry(registry);
    registry.revision++; registry.updated_at = iso();
    if (goal.child.contract_ref) {
      fs.mkdirSync(path.join(root, 'contracts'), { recursive: true, mode: 0o700 });
      const file = path.join(root, goal.child.contract_ref);
      // Immutable versions; an interrupted transaction can leave only an orphan contract.
      const contract = childContract(goal, registry);
      if (fs.existsSync(file)) {
        if (JSON.stringify(readJson(file)) !== JSON.stringify(contract)) throw new Error('Immutable child contract conflict');
      } else {
        const fd = fs.openSync(file, 'wx', 0o600);
        try { fs.writeFileSync(fd, JSON.stringify(contract, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        const dir = fs.openSync(path.dirname(file), 'r');
        try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
      }
    }
    atomicJson(path.join(root, 'goals.json'), registry);
    return registry;
  });
}
export function reportedUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const fields = ['input_tokens', 'output_tokens', 'cached_tokens', 'cache_read_tokens', 'cache_write_tokens', 'total_tokens', 'subscription_units', 'known_charge'];
  return { ...Object.fromEntries(fields.filter(k => typeof usage[k] === 'number' && Number.isFinite(usage[k]) && usage[k] >= 0).map(k => [k, usage[k]])), source: usage.source === 'worker_stream' ? 'worker_stream' : 'reported' };
}
export function goalUsage(id, root = stateRoot(), tasks = null) {
  tasks ||= fs.readdirSync(path.join(root, 'tasks')).filter(x => x.endsWith('.json')).map(x => readJson(path.join(root, 'tasks', x)));
  const workers = Object.fromEntries(clis.map(cli => [cli, { attempts: 0, elapsed_ms: 0, reported_usage: [] }]));
  const seen = new Set();
  for (const task of tasks.filter(t => t.goal_id === id)) {
    const worker = workers[task.executor?.cli]; if (!worker) continue;
    for (const a of [...(task.attempt_history || []), task]) {
      const key = `${task.id}:${a.attempt_id}`; if (!a.attempt_id || seen.has(key)) continue; seen.add(key);
      worker.attempts++;
      const elapsed = Date.parse(a.finished_at || new Date().toISOString()) - Date.parse(a.started_at);
      worker.elapsed_ms += Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
      worker.reported_usage.push({ task_id: task.id, attempt_id: a.attempt_id, usage: reportedUsage(a.usage), basis: 'latest_reported_snapshot_not_summed' });
    }
  }
  const turns = new Map(), snapshots = new Map(), reported = new Map(); let observed = false;
  const dir = path.join(root, 'sessions');
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir).filter(x => x.endsWith('.json') || x.endsWith('.events.jsonl'))) {
    const file = path.join(dir, name);
    if (fs.statSync(file).size > 4 * 1024 * 1024) throw new Error('Session events exceed bounded v1 read; compact before admission');
    const events = name.endsWith('.jsonl') ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [readJson(file)];
    for (const e of events) {
      if (e.goal_id !== id || !e.session_id) continue;
      if (e.usage) reported.set(e.session_id, { session_id: e.session_id, usage: reportedUsage(e.usage), basis: 'latest_reported_snapshot_not_summed' });
      if (e.type === 'turn.completed' && typeof e.turn_id === 'string') {
        observed = true; const ids = turns.get(e.session_id) || new Set(); ids.add(e.turn_id); turns.set(e.session_id, ids);
      } else if (Number.isSafeInteger(e.usage?.turns) && e.usage.turns >= 0) { observed = true; snapshots.set(e.session_id, Math.max(snapshots.get(e.session_id) || 0, e.usage.turns)); }
    }
  }
  const sessions = new Set([...turns.keys(), ...snapshots.keys()]);
  return { mode: 'counts-v1', claude: { turns: observed ? [...sessions].reduce((n, s) => n + Math.max(turns.get(s)?.size || 0, snapshots.get(s) || 0), 0) : null, source: observed ? 'session_events' : 'unknown', reported_usage: [...reported.values()] }, workers,
    future: ['cumulative_token_journals', 'quota_share_estimates'] };
}
export async function admitTask(task, root = stateRoot(), persist = t => atomicJson(taskPath(t.id, root), t)) {
  init(root);
  return withLocks([goalLock(root)], () => {
    const registry = readRegistry(root), goal = registry?.goals.find(x => x.id === task.goal_id);
    if (!goal || goal.desired_state !== 'active') throw new Error('Task goal must exist and be active');
    if (task.goal_generation != null && task.goal_generation !== goal.generation) throw new Error('Stale goal generation');
    if (task.child_session != null || task.child_depth != null || task.child_principal != null) {
      if (!goal.child.session_id || task.child_session !== goal.child.session_id || task.child_principal !== goal.child.principal || task.child_depth !== 1 || task.goal_generation !== goal.generation) throw new Error('Stale, foreign or grandchild dispatch denied');
      validateChild(goal, readJson(path.join(root, goal.child.contract_ref)));
      const session = readJson(path.join(root, 'sessions', `child-${goal.id}.json`));
      if (!session?.launch_nonce || session.state !== 'idle' || session.effort !== 'low' || session.session_id !== goal.child.session_id || session.principal !== goal.child.principal || session.generation !== goal.generation || session.worktree !== goal.planning_worktree || session.contract !== fs.realpathSync(path.join(root, goal.child.contract_ref)) || !sameProcess(session.supervisor_identity) || !sameProcess(session.process_identity)) throw new Error('Child launch not acknowledged/live; dispatch held');
    }
    if (!safeId(task.id) || !safeId(task.attempt_id)) throw new Error('Invalid task/attempt id');
    const wt = canonicalWorktree(task.worktree);
    if (!goal.grants.some(g => g.worktree === wt && g.lane === task.lane)) throw new Error('Worktree/lane is not granted to this goal');
    grantPaths(wt, goal.grants.find(g => g.worktree === wt && g.lane === task.lane).paths);
    const usage = goalUsage(goal.id, root), cli = task.executor.cli;
    const cap = goal.budget.worker_caps[cli]?.runs;
    if (cap == null) throw new Error('Worker run allowance unknown; parent must configure cap');
    if (usage.workers[cli].attempts >= cap) throw new Error('Worker run cap exhausted');
    if (task.child_session) {
      if (goal.budget.claude_turn_cap == null || usage.claude.turns == null) throw new Error('Claude turn allowance/usage unknown');
      if (usage.claude.turns >= goal.budget.claude_turn_cap) throw new Error('Claude turn cap exhausted');
    }
    if (task.paid || task.card?.paid) throw new Error('Paid admission disabled in counts-v1');
    task.goal_generation = goal.generation; task.registry_revision = registry.revision;
    persist(task); // Durable queued attempt is the reservation; goals.json has one writer.
    return task;
  });
}
export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (command === 'list') { console.log(JSON.stringify(readRegistry(), null, 2)); return; }
  console.log(JSON.stringify(await transact(command, options(rest)), null, 2));
}
if (isMain(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
