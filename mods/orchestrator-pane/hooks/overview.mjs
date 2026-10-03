// Shared deterministic presentation for the terminal pane and read-only web page.
// Self-contained so serve.mjs can embed this function without a second renderer.
export function overview(goal, tasks, now = Date.now()) {
  const plain = value => String(value ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]').replace(/\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;"']+/gi, '$1[redacted]').trim();
  const work = task => (task.title === task.id ? '' : plain(task.title)).replace(/^(?:CP\d+|HO\d+-[A-Z]|SIDE-\d+|SR\d+|ST\d+|UPD\d+|[DP]\d+[a-z]?(?:-[a-z]+)?)\s+/i, '') || 'the current task';
  const minutes = ms => Number.isFinite(ms) ? Math.round(Math.max(0, ms) / 60000) + 'm' : '?';
  const own = tasks.filter(t => t.goal_id === goal.id);
  const milestones = (goal.milestones || []).map(m => ({ name: plain(m.name), state: m.state }));
  const today = new Date(now).toISOString().slice(0, 10);
  const doneToday = own.filter(t => [...(t.attempt_history || []), t].some(a => String(a.state).startsWith('done') && a.finished_at?.slice(0, 10) === today)).length;
  return {
    title: plain(goal.title), headline: plain(goal.headline) || 'Waiting for a progress update.',
    milestones: milestones.map(m => ({ ...m, symbol: ({ done: '✓', now: '●', next: '○' })[m.state] || '○' })),
    needsYou: (goal.owner_actions || []).map(a => ({ text: plain(a.text), since: a.since })),
    working: own.filter(t => ['running', 'stalled', 'interrupting'].includes(t.state)).slice(0, 3).map(t => {
      const who = ({ codex: 'Codex', claude: 'Claude', cursor: 'Cursor', agy: 'Antigravity' })[t.executor?.cli] || 'A worker';
      return who + ' is working on ' + work(t) + ' · ' + minutes(t.elapsed_ms) + '/' + minutes(t.estimate_ms?.high)
        + (t.state === 'stalled' ? ' · waiting for progress' : t.state === 'interrupting' ? ' · stopping safely' : '');
    }),
    next: milestones.filter(m => m.state === 'next').map(m => m.name).slice(0, 3),
    footer: doneToday + (doneToday === 1 ? ' task' : ' tasks') + ' done today'
  };
}
