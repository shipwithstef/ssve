#!/usr/bin/env node
/**
 * WI-FW-CROSS-REPO-ORCH-02 — resolve a named WI or onboarded project to a
 * linked worktree. Default checkouts are never returned. Project ids are
 * discovered (any onboarded svc repo), not a hardcoded HoursHub/SSVE pair.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractWiId, isValidWiId } from "../../hooks/lib/wi-id.mjs";
import { migrateSession, resolveOriginHost } from "./cross-repo-orch.mjs";

const HOME = os.homedir();
export const PROJECT_SUBJECT_RE = /^(?:(?:work on|open|go to|take|continue)\s+)?([A-Za-z][A-Za-z0-9._-]{0,63})$/i;
export const USER_CLI_HOMEWORK_RE = /\b(?:please )?run (?:node|this command|the following)\b|copy[ -]?paste migrate|^\s*\$ /im;

function worktreesRoot() {
  return process.env.SVC_WORKTREES_ROOT || path.join(HOME, "worktrees");
}
function appWorkspacesRoot() {
  return process.env.SVC_APP_WORKSPACES_ROOT || path.join(HOME, "app-workspaces");
}
function aliasFile() {
  return process.env.SVC_PROJECT_ALIASES || path.join(HOME, ".svc", "project-aliases.json");
}
function discoverBudgetMs() {
  const n = Number(process.env.SVC_DISCOVER_BUDGET_MS);
  return Number.isFinite(n) && n >= 0 ? n : 150;
}

let discoverCalls = 0;
let discoverCache = null;
let walkStarted = 0;

export function resetDiscoverCache() {
  discoverCalls = 0;
  discoverCache = null;
}

export function discoverCallCount() {
  return discoverCalls;
}

function timedOut() {
  return (performance.now() - walkStarted) >= discoverBudgetMs();
}

export function isLinkedWorktree(dir) {
  try {
    const st = fs.lstatSync(path.join(dir, ".git"));
    return st.isFile() || st.isSymbolicLink();
  } catch {
    return false;
  }
}

export function isOnboarded(worktree) {
  try {
    if (fs.existsSync(path.join(worktree, "docs", "specs", "project-state.md"))) return true;
    const wiDir = path.join(worktree, "docs", "specs", "work-items");
    if (fs.existsSync(wiDir) && fs.readdirSync(wiDir).some((n) => n.startsWith("WI-") && n.endsWith(".md"))) return true;
    const svc = path.join(worktree, ".svc");
    if (fs.existsSync(svc) && fs.readdirSync(svc).some((n) => n.startsWith("lane-tasks-") && n.endsWith(".json"))) return true;
    if (fs.existsSync(path.join(worktree, "AGENTS.md")) && (fs.existsSync(svc) || fs.existsSync(path.join(worktree, "skills-manifest.json")))) return true;
  } catch {
    return false;
  }
  return false;
}

function mtimeMs(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

function normId(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function addProject(map, id, root) {
  const key = normId(id);
  if (!key || !root) return;
  const existing = map.get(key) || { id: String(id), roots: [] };
  const resolved = path.resolve(root);
  if (!existing.roots.includes(resolved)) existing.roots.push(resolved);
  map.set(key, existing);
}

function readOptionalAliasFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(aliasFile(), "utf8"));
    return Array.isArray(parsed?.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

export function discoverProjects() {
  discoverCalls += 1;
  if (discoverCache) return discoverCache;
  walkStarted = performance.now();
  const map = new Map();
  try {
    for (const ent of fs.readdirSync(worktreesRoot(), { withFileTypes: true })) {
      if (timedOut()) return [];
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      addProject(map, ent.name, path.join(worktreesRoot(), ent.name));
    }
  } catch { /* missing root */ }
  try {
    for (const ent of fs.readdirSync(appWorkspacesRoot(), { withFileTypes: true })) {
      if (timedOut()) return [];
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      if (ent.name.endsWith("-worktrees")) {
        addProject(map, ent.name.slice(0, -"-worktrees".length), path.join(appWorkspacesRoot(), ent.name));
      }
    }
  } catch { /* missing root */ }
  if (timedOut()) return [];
  for (const row of readOptionalAliasFile()) {
    const id = String(row.id || "");
    for (const root of row.roots || []) {
      addProject(map, id, String(root).replace(/^~(?=\/|$)/, HOME));
    }
  }
  discoverCache = [...map.values()];
  return discoverCache;
}

function listLinkedUnder(root, out, depth = 0) {
  if (timedOut() || depth > 2 || !root || !fs.existsSync(root)) return;
  if (isLinkedWorktree(root)) {
    out.push(path.resolve(root));
    return;
  }
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (timedOut()) return;
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    listLinkedUnder(path.join(root, ent.name), out, depth + 1);
  }
}

export function listProjectWorktrees(project) {
  const out = [];
  for (const root of project.roots) listLinkedUnder(root, out, 0);
  return [...new Set(out)].filter(isOnboarded);
}

function wiFiles(worktree, wi) {
  return [
    path.join(worktree, ".svc", `lane-tasks-${wi}.json`),
    path.join(worktree, "docs", "specs", "work-items", `${wi}.md`),
  ];
}

function newest(candidates) {
  let best = null;
  let bestM = -1;
  for (const dir of candidates) {
    const m = mtimeMs(dir);
    if (m >= bestM) {
      bestM = m;
      best = dir;
    }
  }
  return best;
}

function listCandidateWis(worktree) {
  const found = new Set();
  try {
    for (const name of fs.readdirSync(path.join(worktree, ".svc"))) {
      const m = name.match(/^lane-tasks-(WI-[A-Z0-9]+(?:-[A-Z0-9]+)*)\.json$/);
      if (m) found.add(m[1]);
    }
  } catch { /* no .svc */ }
  try {
    for (const name of fs.readdirSync(path.join(worktree, "docs", "specs", "work-items"))) {
      const m = name.match(/^(WI-[A-Z0-9]+(?:-[A-Z0-9]+)*)\.md$/);
      if (m) found.add(m[1]);
    }
  } catch { /* no work-items */ }
  return [...found].sort();
}

function inProgressLaneWis(worktree) {
  const dir = path.join(worktree, ".svc");
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return []; }
  const hits = [];
  for (const name of entries) {
    const m = name.match(/^lane-tasks-(WI-[A-Z0-9]+(?:-[A-Z0-9]+)*)\.json$/);
    if (!m) continue;
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")); } catch { continue; }
    if (parsed?.status === "in_progress") hits.push(m[1]);
  }
  return hits;
}

export function allOnboardedLinked() {
  const hits = [];
  walkStarted = walkStarted || performance.now();
  for (const project of discoverProjects()) {
    if (timedOut()) break;
    hits.push(...listProjectWorktrees(project));
  }
  return [...new Set(hits)];
}

export function resolveWorktreeForWi(wi, cwd) {
  if (!isValidWiId(wi)) return null;
  if (cwd && isLinkedWorktree(cwd) && wiFiles(cwd, wi).some((file) => fs.existsSync(file))) {
    return path.resolve(cwd);
  }
  const hits = [];
  for (const wt of allOnboardedLinked()) {
    if (wiFiles(wt, wi).some((file) => fs.existsSync(file))) hits.push(wt);
  }
  return newest(hits);
}

function subjectProject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const firstLine = raw.split(/\r?\n/, 1)[0].trim();
  const shaped = firstLine.match(PROJECT_SUBJECT_RE);
  if (!shaped) return null;
  const token = shaped[1];
  const projects = discoverProjects();
  return projects.find((p) => normId(p.id) === normId(token)) || null;
}

export function resolveWorktreeForProject(project, cwd) {
  if (cwd && isLinkedWorktree(cwd) && isOnboarded(cwd)) {
    const real = path.resolve(cwd);
    if (project.roots.some((root) => real === path.resolve(root) || real.startsWith(`${path.resolve(root)}${path.sep}`))) {
      return real;
    }
  }
  return newest(listProjectWorktrees(project));
}

export function resolveOriginIntent(text, cwd = process.cwd()) {
  const wi = extractWiId(text);
  if (wi) {
    const worktree = resolveWorktreeForWi(wi, cwd);
    if (worktree) return { wi, worktree, how: "wi", miss: null, candidate_wis: listCandidateWis(worktree) };
    return { wi, worktree: null, how: "wi", miss: "no_target", candidate_wis: [] };
  }
  const project = subjectProject(text);
  if (!project) return null;
  const worktree = resolveWorktreeForProject(project, cwd);
  if (!worktree) return { wi: "", worktree: null, project: project.id, how: "project", miss: "no_target", candidate_wis: [] };
  const inProgress = inProgressLaneWis(worktree);
  const laneWi = inProgress.length === 1 ? inProgress[0] : "";
  return {
    wi: laneWi,
    worktree,
    project: project.id,
    how: "project",
    miss: null,
    candidate_wis: listCandidateWis(worktree),
  };
}

export function originOrchestratorContext(intent, { host = "cursor", bound = false } = {}) {
  if (intent?.miss === "no_target") {
    return [
      "ORIGIN ORCHESTRATOR: no onboarded linked worktree for the named WI/project.",
      "Stay put. Do not use a repository default checkout.",
      "Do not tell the user to run a command, cd, or ./setup.",
    ].join("\n");
  }
  if (!intent?.worktree) return "";
  if (!intent.wi) {
    const names = (intent.candidate_wis || []).join(", ") || "(none listed)";
    return [
      "ORIGIN ORCHESTRATOR (automatic). The user does not run a CLI.",
      `Target linked worktree: ${intent.worktree}`,
      `Project: ${intent.project || ""}`,
      `Candidate WIs in that worktree: ${names}`,
      "Do not migrate until the user names a WI or exactly one lane-tasks file is in_progress.",
      "Stay origin. Do not invent a WI. Do not tell the user to run a command, cd, or ./setup.",
    ].join("\n");
  }
  return [
    "ORIGIN ORCHESTRATOR (automatic). The user does not run a CLI.",
    `Target linked worktree: ${intent.worktree}`,
    `WI: ${intent.wi}`,
    bound ? "Same-owner bind already recorded for this session tuple." : "Same-owner bind attempted when session identity exists.",
    "Stay origin. Children run IN that worktree.",
    "Next you perform (never print as homework): dispatch PLAN grok-4.6 --effort xhigh, then Fable REVIEW, then EXEC grok-4.6 --effort high, all --cwd that worktree.",
    "Do not paste. Do not use agy as the only escape. Do not ask them to cd. Do not treat ./setup as promotion.",
  ].join("\n");
}

export function bindIfNeeded(intent, { host, cwd, sessionId, request } = {}) {
  if (!intent?.worktree || !intent.wi) {
    return { bound: false, reason: intent?.miss || "no_wi" };
  }
  let originHost;
  try {
    originHost = resolveOriginHost(host);
  } catch (error) {
    return { bound: false, reason: error?.code || "orch_host_invalid" };
  }
  try {
    const baton = migrateSession({
      wi: intent.wi,
      worktree: intent.worktree,
      origin_host: originHost,
      origin_cwd: cwd,
      session_id: sessionId,
      request: String(request || "").slice(0, 400),
    });
    return { bound: true, baton };
  } catch (error) {
    const code = error?.code || "orch_bind_failed";
    return { bound: false, reason: code };
  }
}
