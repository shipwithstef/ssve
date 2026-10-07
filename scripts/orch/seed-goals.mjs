#!/usr/bin/env node
import { readRegistry, transact } from './goals.mjs';
import { isMain, stateRoot, iso } from './common.mjs';

export const seeds = [
  { id: 'novisenti', title: 'Novisenti', objective: 'Execute the unified Novisenti plan', priority: 1,
    plan: '/home/dianast/worktrees/novisenti-unified-plan-20261002/docs/plans/PLAN.md',
    worktree_roots: ['/home/dianast/worktrees/novisenti/*'] },
  { id: 'orchestrator-os', title: 'Orchestrator OS', objective: 'Deliver the Orchestrator OS goal', priority: 2,
    plan: '/home/dianast/app-workspaces/ssve/docs/GOAL-orchestrator-os.md',
    worktree_roots: ['/home/dianast/worktrees/ssve-*'] }
];
export const summaries = {
  novisenti: {
    headline: 'Product built and deployed (AI off). Waiting for you: approve Azure issuer job. Then: one paid test ≤$10.',
    milestones: [
      { name: 'Plan', state: 'done' }, { name: 'Build M1', state: 'done' }, { name: 'Reviews', state: 'done' },
      { name: 'Deploy closed', state: 'done' }, { name: 'Issuer job (needs owner)', state: 'now' },
      { name: 'Opus gate (~23:00 UTC)', state: 'next' }, { name: 'Paid test ≤$10', state: 'next' }, { name: 'Report', state: 'next' }
    ],
    owner_actions: [{ text: 'Approve creating the Azure issuer job (create-only, no spend)' }]
  },
  'orchestrator-os': {
    headline: "Running. Redesigning the view so it's readable.",
    milestones: [
      { name: 'Launcher+panel', state: 'done' }, { name: 'Spot recovery', state: 'done' }, { name: 'Parent/child', state: 'done' },
      { name: 'Quiet hooks', state: 'done' }, { name: 'Steering', state: 'done' },
      { name: 'Whole-window view (redesign)', state: 'now' }, { name: 'Measure', state: 'next' }
    ], owner_actions: []
  }
};
export async function seedSummaries(root = stateRoot()) {
  for (const [id, summary] of Object.entries(summaries)) {
    const registry = readRegistry(root), goal = registry?.goals.find(g => g.id === id);
    if (!goal) throw new Error(`Missing ${id}; seed goals first`);
    // Once an orchestrator updates the summary, a seed rerun must not rewind it.
    if (goal.headline !== undefined) continue;
    await transact('set-summary', { id, ...summary, owner_actions: summary.owner_actions.map(a => ({ ...a, since: iso() })), expected_revision: registry.revision }, root);
  }
  return readRegistry(root);
}
export async function seed(root = stateRoot()) {
  for (const goal of seeds) {
    const registry = readRegistry(root), existing = registry?.goals.find(g => g.id === goal.id);
    if (existing) {
      if (existing.plan !== goal.plan || JSON.stringify(existing.worktree_roots) !== JSON.stringify(goal.worktree_roots)) throw new Error(`Existing ${goal.id} seed conflicts; parent decision required`);
      continue;
    }
    await transact('create', { ...goal, expected_revision: registry?.revision ?? 0 }, root);
  }
  return seedSummaries(root);
}
if (isMain(import.meta.url)) seed().then(r => console.log(JSON.stringify({ revision: r.revision, goals: r.goals.map(g => g.id) }))).catch(e => { console.error(e.message); process.exitCode = 1; });
