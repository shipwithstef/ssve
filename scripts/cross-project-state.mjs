#!/usr/bin/env node
// scripts/cross-project-state.mjs (WI-105)
//
// Read-only aggregator. Scans a configured list of project roots from
// ~/.svc/projects.json and emits a compact cross-project snapshot at
// ~/.svc/state-snapshot.json. Does NOT mutate anything outside ~/.svc/.
//
// ~/.svc/projects.json shape:
//   { "projects": [ { "id": "example-marketplace", "path": "/abs/path/to/example-marketplace" }, ... ] }
//
// Snapshot entry per project:
//   {
//     "id": "example-marketplace",
//     "path": "/abs/path/...",
//     "active_wi_count": N,
//     "backlog_count": N,
//     "blocked_on": [ "WI-NNN: reason", ... ],
//     "time_since_last_commit_hours": X,
//     "last_commit_subject": "...",
//     "last_learning_lines": [ ... tail 5 ... ]
//   }
// Plus a framework row with source=FRAMEWORK-STATE.md.
//
// CLI:
//   node scripts/cross-project-state.mjs [--out <path>] [--projects-file <path>] [--max 10]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeJsonAtomic } from './state-io.mjs';
import { execSync } from 'node:child_process';
import { WI_ID_BODY } from '../hooks/lib/wi-id.mjs';

const HOME = os.homedir();
const DEFAULT_PROJECTS_FILE = path.join(HOME, '.svc', 'projects.json');
const DEFAULT_OUT = path.join(HOME, '.svc', 'state-snapshot.json');

function parseArgs(argv) {
  const args = { max: 10 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--projects-file') args.projectsFile = argv[++i];
    else if (a === '--max') args.max = Number(argv[++i]);
  }
  return args;
}

function die(msg, code = 1) {
  console.error(JSON.stringify({ verdict: 'failed', reason: msg }, null, 2));
  process.exit(code);
}

function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function readFileSafe(p) {
  return safe(() => fs.readFileSync(p, 'utf8'), '');
}

function countMatches(text, regex) {
  const m = text.match(regex);
  return m ? m.length : 0;
}

function inspectProject(entry) {
  const root = entry.path;
  if (!fs.existsSync(root)) {
    return { id: entry.id, path: root, error: 'path does not exist' };
  }

  const indexPath = path.join(root, 'docs', 'specs', 'work-items', 'INDEX.md');
  const indexText = readFileSafe(indexPath);
  const activeWiCount = countMatches(indexText, /status:(backlog|in-progress)/gi);
  const backlogCount = countMatches(indexText, /status:backlog/gi);

  const blockedOn = [];
  for (const line of indexText.split('\n')) {
    const m = line.match(/WI-(\d+).*status:blocked(?:-on-([A-Z0-9-]+))?/i);
    if (m) blockedOn.push(`WI-${m[1]}: ${m[2] || 'unknown'}`);
  }

  let hoursSinceLastCommit = null;
  let lastCommitSubject = '';
  try {
    const gitDir = path.join(root, '.git');
    if (fs.existsSync(gitDir)) {
      const iso = execSync(`git -C "${root}" log -1 --format=%cI`, { encoding: 'utf8' }).trim();
      lastCommitSubject = execSync(`git -C "${root}" log -1 --format=%s`, { encoding: 'utf8' }).trim();
      const ago = (Date.now() - Date.parse(iso)) / (1000 * 60 * 60);
      hoursSinceLastCommit = Math.round(ago * 10) / 10;
    }
  } catch { /* not a git repo or git missing */ }

  const learningsPath = path.join(root, 'docs', 'learnings', 'learnings.jsonl');
  const learningsText = readFileSafe(learningsPath);
  const lastLearningLines = learningsText
    ? learningsText.trim().split('\n').slice(-5)
    : [];

  return {
    id: entry.id,
    path: root,
    active_wi_count: activeWiCount,
    backlog_count: backlogCount,
    blocked_on: blockedOn,
    time_since_last_commit_hours: hoursSinceLastCommit,
    last_commit_subject: lastCommitSubject,
    last_learning_lines: lastLearningLines,
  };
}

function inspectFramework() {
  const root = process.env.SVC_REPO_ROOT || process.cwd();
  const fsPath = path.join(root, 'FRAMEWORK-STATE.md');
  const text = readFileSafe(fsPath);
  const activeWiCount = countMatches(text, new RegExp("active:\\s*" + WI_ID_BODY, "g"))
    || countMatches(text, /in-progress/gi);
  let lastCommitSubject = '';
  let hoursSinceLastCommit = null;
  try {
    const iso = execSync(`git -C "${root}" log -1 --format=%cI`, { encoding: 'utf8' }).trim();
    lastCommitSubject = execSync(`git -C "${root}" log -1 --format=%s`, { encoding: 'utf8' }).trim();
    hoursSinceLastCommit = Math.round(((Date.now() - Date.parse(iso)) / 3600000) * 10) / 10;
  } catch {}
  return {
    id: 'framework',
    path: root,
    source: 'FRAMEWORK-STATE.md',
    active_wi_count: activeWiCount,
    time_since_last_commit_hours: hoursSinceLastCommit,
    last_commit_subject: lastCommitSubject,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectsFile = args.projectsFile || DEFAULT_PROJECTS_FILE;
  const out = args.out || DEFAULT_OUT;

  let projects = [];
  if (fs.existsSync(projectsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
      projects = Array.isArray(data.projects) ? data.projects : [];
    } catch (err) {
      die(`projects file ${projectsFile} unreadable: ${err.message}`);
    }
  }

  if (projects.length > args.max) projects = projects.slice(0, args.max);

  const start = Date.now();
  const projectRows = projects.map(inspectProject);
  const frameworkRow = inspectFramework();
  const durationMs = Date.now() - start;

  const snapshot = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    duration_ms: durationMs,
    project_count: projectRows.length,
    rows: [...projectRows, frameworkRow],
  };

  writeJsonAtomic(out, snapshot);

  console.log(JSON.stringify({
    verdict: 'snapshot-written',
    out,
    project_count: projectRows.length,
    duration_ms: durationMs,
  }, null, 2));
}

main();
