#!/usr/bin/env node
/**
 * cockpit-state.mjs — one live model of everything the orchestrators are doing.
 *
 *   node scripts/cockpit-state.mjs [--repo <dir>]... [--out <file.json>]
 *
 * Layer 1 is this machine's top orchestrator: capacity (parallel slots from the plan) and
 * every repository it watches. Layer 2 is one goal per work item, each driven by its own
 * orchestrator session: its lane, profile, stages, progress and estimate. Layer 3 is the
 * stage (a skill run by an agent). Everything is read from the task graphs the framework
 * already keeps (.svc/lane-tasks-*.json); nothing is entered by hand.
 *
 * Estimates come from measured history, not guesses: the median minutes each skill took
 * when it last ran here (skill_receipt.loaded_at to completed_at), applied to the stages a
 * goal still has. Every estimate carries its basis (how many past runs it rests on).
 */
import fs from "node:fs";
import path from "node:path";
import { isMain } from "./lib/is-main.mjs";
import { maxParallel } from "./lib/parallelism.mjs";

const STATUS = { completed: "done", done: "done", skipped: "skipped", in_progress: "active", active: "active", pending: "pending", planned: "pending", blocked: "blocked" };
const norm = (s) => STATUS[String(s || "pending").toLowerCase()] || "pending";
const minutes = (a, b) => { const t = (Date.parse(b) - Date.parse(a)) / 60000; return Number.isFinite(t) && t > 0 && t < 60 * 24 * 7 ? t : null; };
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export function readGoals(repo) {
  const dir = path.join(repo, ".svc");
  if (!fs.existsSync(dir)) return [];
  const goals = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^lane-tasks-.+\.json$/.test(x))) {
    let g; try { g = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    const stat = fs.statSync(path.join(dir, f));
    const stages = (g.tasks || []).map((t) => {
      const r = t.skill_receipt || {};
      const started = r.loaded_at || t.delivery_started_at || null;
      const finished = t.completed_at || r.completed_at || null;
      return {
        id: t.id, skill: t.skill || t.metadata?.skill || "task", title: t.subject || t.title || t.name || t.skill || "",
        status: norm(t.status), started_at: started, finished_at: finished,
        minutes: started && finished ? minutes(started, finished) : null,
        owner: t.metadata?.orchestrated_by || null, artifact: r.output_artifact || t.output_artifact || null,
        blocked_reason: t.blocked_reason || t.metadata?.blocked_reason || null,
      };
    });
    // Last activity is the newest time an orchestrator wrote into the graph (a stage started
    // or finished). The file's modified time is a fallback only for a goal with no times yet:
    // copies, checkouts and backups reset it.
    const times = [g.created, ...stages.flatMap((x) => [x.started_at, x.finished_at])].map((t) => Date.parse(t)).filter(Number.isFinite);
    const updated = times.length ? new Date(Math.max(...times)).toISOString() : stat.mtime.toISOString();
    goals.push({ repo: path.basename(path.resolve(repo)), id: g.wi || f.replace(/^lane-tasks-|\.json$/g, ""), title: g.title || g.delivery_graph?.user_intent || "", lane: g.lane || g.delivery_graph?.lane || "", profile: g.delivery_graph?.planning?.profile || g.delivery_graph?.delivery_tier?.mode || null, created: g.created || null, updated, stages });
  }
  return goals;
}

// Median minutes per skill from every finished stage seen, with the sample size.
export function skillDurations(goals) {
  const by = {};
  for (const g of goals) for (const s of g.stages) if (s.minutes) (by[s.skill] ??= []).push(s.minutes);
  const all = Object.values(by).flat();
  return { bySkill: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { median: median(v), n: v.length }])), overall: { median: median(all), n: all.length } };
}

// A goal whose graph has not changed for this long while it claims an active stage is
// shown as stalled: its session most likely ended mid-stage, and it is not using a slot.
export const STALL_HOURS = 6;

export function summarise(goal, durations, now = new Date()) {
  const counted = goal.stages.filter((s) => s.status !== "skipped");
  const done = counted.filter((s) => s.status === "done").length;
  const remaining = counted.filter((s) => s.status !== "done");
  let est = 0, basis = 0, guessed = 0;
  for (const s of remaining) {
    const d = durations.bySkill[s.skill];
    if (d?.median) { est += s.status === "active" ? d.median / 2 : d.median; basis += d.n; }
    else if (durations.overall.median) { est += durations.overall.median; guessed++; }
  }
  const active = goal.stages.filter((s) => s.status === "active");
  const blocked = goal.stages.filter((s) => s.status === "blocked");
  const idleHours = (now - Date.parse(goal.updated)) / 3600000;
  const stalled = active.length > 0 && idleHours > STALL_HOURS;
  const status = !counted.length ? "pending" : done === counted.length ? "done" : blocked.length ? "blocked" : stalled ? "stalled" : active.length ? "active" : done ? "paused" : "pending";
  return { ...goal, status, idle_hours: +idleHours.toFixed(1), progress: counted.length ? +(done / counted.length).toFixed(3) : 0, done, total: counted.length, active_stages: active.map((s) => s.skill), agents: stalled ? 0 : active.length,
    estimate: remaining.length ? { minutes: Math.round(est), basis_runs: basis, stages_without_history: guessed } : null };
}

export function buildState(repos, { plan = process.env.SVC_PLAN, override = process.env.SVC_MAX_PARALLEL, now = new Date() } = {}) {
  const raw = repos.flatMap(readGoals);
  const durations = skillDurations(raw);
  const ORDER = ["active", "blocked", "stalled", "paused", "pending", "done"];
  const goals = raw.map((g) => summarise(g, durations, now)).sort((a, b) => (ORDER.indexOf(a.status) - ORDER.indexOf(b.status)) || (b.updated > a.updated ? 1 : -1));
  const cap = maxParallel({ plan, override });
  const inUse = goals.reduce((n, g) => n + g.agents, 0);
  const open = goals.filter((g) => g.status !== "done");
  const agentMinutes = open.reduce((n, g) => n + (g.estimate?.minutes || 0), 0);
  return {
    generated_at: now.toISOString(),
    orchestrator: { repos: repos.map((r) => path.basename(path.resolve(r))), capacity: { slots: cap.max_parallel, why: cap.why, in_use: inUse, free: Math.max(0, cap.max_parallel - inUse) } },
    totals: {
      goals: goals.length, active: goals.filter((g) => g.status === "active").length, blocked: goals.filter((g) => g.status === "blocked").length, stalled: goals.filter((g) => g.status === "stalled").length,
      done: goals.filter((g) => g.status === "done").length, open: open.length,
      remaining_agent_hours: +(agentMinutes / 60).toFixed(1),
      // Wall-clock at full use of the free slots, in 8-hour working days.
      days_at_capacity: cap.max_parallel ? +(agentMinutes / 60 / cap.max_parallel / 8).toFixed(1) : null,
    },
    durations: { overall: durations.overall },
    goals,
  };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (argv[i - 1] === "--repo" ? [a] : []));
  const oi = argv.indexOf("--out");
  const state = buildState(repos.length ? repos : ["."]);
  const text = JSON.stringify(state, null, 2) + "\n";
  if (oi >= 0) fs.writeFileSync(argv[oi + 1], text); else process.stdout.write(text);
}
