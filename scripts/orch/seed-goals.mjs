#!/usr/bin/env node
import { readRegistry, transact } from './goals.mjs';
import { isMain, stateRoot } from './common.mjs';

export const seeds = [
  { id: 'novisenti', title: 'Novisenti', objective: 'Execute the unified Novisenti plan', priority: 1,
    plan: '/home/dianast/worktrees/novisenti-unified-plan-20261002/docs/plans/PLAN.md',
    worktree_roots: ['/home/dianast/worktrees/novisenti/*'] },
  { id: 'orchestrator-os', title: 'Orchestrator OS', objective: 'Deliver the Orchestrator OS goal', priority: 2,
    plan: '/home/dianast/app-workspaces/ssve/docs/GOAL-orchestrator-os.md',
    worktree_roots: ['/home/dianast/worktrees/ssve-*'] }
];
export async function seed(root = stateRoot()) {
  for (const goal of seeds) {
    const registry = readRegistry(root), existing = registry?.goals.find(g => g.id === goal.id);
    if (existing) {
      if (existing.plan !== goal.plan || JSON.stringify(existing.worktree_roots) !== JSON.stringify(goal.worktree_roots)) throw new Error(`Existing ${goal.id} seed conflicts; parent decision required`);
      continue;
    }
    await transact('create', { ...goal, expected_revision: registry?.revision ?? 0 }, root);
  }
  return readRegistry(root);
}
if (isMain(import.meta.url)) seed().then(r => console.log(JSON.stringify({ revision: r.revision, goals: r.goals.map(g => g.id) }))).catch(e => { console.error(e.message); process.exitCode = 1; });
