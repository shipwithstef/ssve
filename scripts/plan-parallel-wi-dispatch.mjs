#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

function readArgs(name) {
  const value = argValue(name);
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const root = path.resolve(argValue('--root') || process.cwd());
const wiArgs = readArgs('--wis');
const outPath = argValue('--out');
const maxWorkers = Number(process.env.SVC_MAX_WORKERS || argValue('--max-workers') || 3);
const inlineThreshold = Number(process.env.SVC_DISPATCH_MIN_COST || argValue('--inline-threshold') || 5);

if (wiArgs.length === 0) {
  console.error('Usage: node scripts/plan-parallel-wi-dispatch.mjs --wis WI-001,WI-002 [--out <file>]');
  process.exit(2);
}

const sharedConfigPatterns = [
  /^package(-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^tsconfig.*\.json$/,
  /^vite\.config\./,
  /^tailwind\.config\./,
  /^migrations\//,
  /^e2e\/fixtures\//,
  /^\.env/,
];

function normalizeWiId(input) {
  const base = path.basename(input, '.md');
  const match = base.match(/WI-[A-Z0-9-]+/i);
  return match ? match[0].toUpperCase() : input.toUpperCase();
}

function resolveWiPath(input) {
  if (input.endsWith('.md')) return path.resolve(root, input);
  const wi = normalizeWiId(input);
  return path.join(root, 'docs/specs/work-items', `${wi}.md`);
}

function parseSimpleFrontmatter(text) {
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---', 4);
  if (end === -1) return {};
  const lines = text.slice(4, end).split(/\r?\n/);
  const data = {};
  let current = null;
  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (keyMatch) {
      current = keyMatch[1];
      const raw = keyMatch[2].trim();
      if (raw === '') data[current] = [];
      else if (raw.startsWith('[') && raw.endsWith(']')) {
        data[current] = raw.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean);
      } else {
        data[current] = raw.replace(/^["']|["']$/g, '');
      }
    } else if (listMatch && current) {
      if (!Array.isArray(data[current])) data[current] = [];
      data[current].push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
    }
  }
  return data;
}

function extractStatus(text) {
  return text.match(/\*\*Status:\*\*\s*([^\n]+)/i)?.[1]?.trim() || null;
}

function extractField(text, name) {
  return text.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*([^\\n]+)`, 'im'))?.[1]?.trim() || null;
}

function extractTitle(text, wi) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() || wi;
}

function pathLike(token) {
  return /[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+/.test(token) || /^[A-Za-z0-9_.-]+\.(mjs|js|ts|tsx|jsx|json|md|sh|toml|yaml|yml)$/.test(token);
}

function cleanPath(value) {
  return value
    .trim()
    .replace(/^["'`]+|["'`,.;:)]+$/g, '')
    .replace(/^\.\//, '');
}

function extractAffectedFiles(text, fm) {
  const files = new Set();
  for (const key of ['affects_files', 'affected_files', 'files']) {
    const value = fm[key];
    if (Array.isArray(value)) value.forEach((item) => files.add(cleanPath(item)));
    else if (typeof value === 'string' && value) files.add(cleanPath(value));
  }

  const lines = text.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => /^#{2,4}\s+(Affected Files|Affected Specs|Files Touched|Touched Files)\s*$/i.test(line));
  if (sectionStart !== -1) {
    const sectionLines = [];
    for (const line of lines.slice(sectionStart + 1)) {
      if (/^#{2,4}\s+/.test(line)) break;
      sectionLines.push(line);
    }
    for (const line of sectionLines) {
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (bullet) {
        const first = cleanPath(bullet[1].split(/\s+/)[0]);
        if (pathLike(first)) files.add(first);
      }
    }
  }

  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const candidate = cleanPath(match[1]);
    if (pathLike(candidate) && !candidate.includes('<') && !candidate.includes('>')) files.add(candidate);
  }

  return Array.from(files).filter((item) => item && item !== 'unknown').sort();
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const dir = path.dirname(path.resolve(root, fromFile));
  const base = path.resolve(dir, specifier);
  const variants = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '/index.js', '/index.ts', '/index.tsx'];
  for (const suffix of variants) {
    const candidate = `${base}${suffix}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(root, candidate).replaceAll(path.sep, '/');
    }
  }
  return null;
}

function dependencyFiles(affectedFiles) {
  const deps = new Set();
  for (const file of affectedFiles) {
    const abs = path.resolve(root, file);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    if (!/\.(mjs|js|jsx|ts|tsx)$/.test(file)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const importRe = /(?:import\s+[^'"]*from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
    for (const match of text.matchAll(importRe)) {
      const resolved = resolveImport(file, match[1]);
      if (resolved) deps.add(resolved);
    }
  }
  return Array.from(deps).sort();
}

function walkSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.worktrees', 'dist', 'build'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSourceFiles(full, out);
    else if (/\.(mjs|js|jsx|ts|tsx)$/.test(entry.name)) out.push(path.relative(root, full).replaceAll(path.sep, '/'));
  }
  return out;
}

function projectImportGraphFiles(affectedFiles, directDeps) {
  const files = walkSourceFiles(root);
  if (files.length === 0) return { files: [], confidence: 'degraded', warning: 'no-js-ts-files-for-import-graph' };
  const targets = new Set([...affectedFiles, ...directDeps]);
  const reverseDeps = new Set();
  for (const file of files) {
    let text = '';
    try {
      text = fs.readFileSync(path.resolve(root, file), 'utf8');
    } catch {
      continue;
    }
    const importRe = /(?:import\s+[^'"]*from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
    for (const match of text.matchAll(importRe)) {
      const resolved = resolveImport(file, match[1]);
      if (resolved && targets.has(resolved)) reverseDeps.add(file);
    }
  }
  const hasTooling = fs.existsSync(path.join(root, 'tsconfig.json')) || fs.existsSync(path.join(root, 'package.json'));
  return {
    files: Array.from(reverseDeps).sort(),
    confidence: hasTooling ? 'project-scan' : 'degraded',
    warning: hasTooling ? null : 'no-package-or-tsconfig-import-tooling',
  };
}

function isSharedConfig(file) {
  return sharedConfigPatterns.some((pattern) => pattern.test(file));
}

function routeFor(fm, text) {
  if (fm.route) return fm.route;
  if (/bug|broken|regression/i.test(text)) return 'diagnose-bug';
  if (/e2e|playwright|journey/i.test(text)) return 'write-e2e';
  if (/spec|acceptance criteria|AC/i.test(text)) return 'sync-spec-code';
  return 'plan-changeset';
}

function estimateMinutes(fm) {
  const value = Number(fm.estimated_minutes || fm.estimate_minutes || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function runtimeResources(task) {
  const haystack = [task.title, task.path, ...(task.affected_files || []), ...(task.dependency_files || [])].join('\n');
  const resources = [];
  if (/base44|TEST_STREAM/i.test(haystack)) resources.push('base44-test-stream');
  if (/playwright|browser|screenshot|visual|e2e/i.test(haystack)) resources.push('browser-daemon');
  return resources;
}

function chooseTransport(task, totalDispatchable) {
  if (task.estimated_minutes !== null && task.estimated_minutes < inlineThreshold) return 'local-inline';
  if (/detached-kimi|kimi/i.test(task.needs_transport || task.needs_model || '')) return 'detached-kimi';
  if (totalDispatchable >= 4) return 'headless-worker';
  return 'subagent';
}

function selectWorkerModel(task) {
  if (task.needs_model) return { model: task.needs_model, rationale: 'wi-needs_model' };
  if (/track-visuals|visual|screenshot/i.test([task.route, task.title, ...(task.affected_files || [])].join(' '))) {
    return { model: 'mimo-v2-omni', rationale: 'visual-or-multimodal-surface' };
  }
  if (['critical', 'high'].includes(String(task.severity || '').toLowerCase())) {
    return { model: 'mimo-v2-pro', rationale: `${task.severity}-severity` };
  }
  if (/review|audit|security/i.test(`${task.type || ''} ${task.route || ''}`)) {
    return { model: 'mimo-v2-pro', rationale: 'review-audit-route' };
  }
  return { model: 'mimo-v2-pro', rationale: 'default-mechanical-execution' };
}

function assignRuntime(task, waveIndex, taskIndex) {
  const assignments = {};
  if ((task.runtime_resources || []).includes('base44-test-stream')) assignments.TEST_STREAM = `svc-wave-${waveIndex + 1}-worker-${taskIndex + 1}`;
  if ((task.runtime_resources || []).includes('browser-daemon')) assignments.browser_slot = `browser-${waveIndex + 1}-${taskIndex + 1}`;
  return assignments;
}

const tasks = wiArgs.map((input) => {
  const wiPath = resolveWiPath(input);
  if (!fs.existsSync(wiPath)) {
    return {
      wi: normalizeWiId(input),
      path: path.relative(root, wiPath).replaceAll(path.sep, '/'),
      missing: true,
      blocked_reason: 'missing-wi-file',
    };
  }
  const text = fs.readFileSync(wiPath, 'utf8');
  const fm = parseSimpleFrontmatter(text);
  const wi = normalizeWiId(input);
  const affected = extractAffectedFiles(text, fm);
  const deps = dependencyFiles(affected);
  const graphDeps = projectImportGraphFiles(affected, deps);
  const shared = affected.filter(isSharedConfig);
  const scopeUnknown = affected.length === 0;
  const task = {
    wi,
    path: path.relative(root, wiPath).replaceAll(path.sep, '/'),
    title: extractTitle(text, wi),
    status: extractStatus(text),
    severity: extractField(text, 'Severity'),
    type: extractField(text, 'Type'),
    route: routeFor(fm, text),
    estimated_minutes: estimateMinutes(fm),
    needs_model: fm.needs_model || null,
    needs_transport: fm.needs_transport || null,
    affected_files: affected,
    dependency_files: [...new Set([...deps, ...graphDeps.files])].sort(),
    dependency_confidence: graphDeps.confidence,
    dependency_warning: graphDeps.warning,
    shared_resources: shared,
    blocked_reason: scopeUnknown ? 'scope-unknown' : null,
  };
  task.runtime_resources = runtimeResources(task);
  task.worker_model = selectWorkerModel(task);
  return task;
});

const byWi = new Map(tasks.map((task) => [task.wi, task]));
const conflictMap = new Map(tasks.map((task) => [task.wi, new Set()]));

function conflict(a, b) {
  if (a.missing || b.missing) return true;
  if (a.blocked_reason || b.blocked_reason) return true;
  if (a.shared_resources.length || b.shared_resources.length) return true;
  if ((a.runtime_resources || []).some((resource) => (b.runtime_resources || []).includes(resource))) return true;
  const aFiles = new Set([...a.affected_files, ...a.dependency_files]);
  const bFiles = new Set([...b.affected_files, ...b.dependency_files]);
  for (const file of aFiles) if (bFiles.has(file)) return true;
  return false;
}

for (let i = 0; i < tasks.length; i += 1) {
  for (let j = i + 1; j < tasks.length; j += 1) {
    if (conflict(tasks[i], tasks[j])) {
      conflictMap.get(tasks[i].wi).add(tasks[j].wi);
      conflictMap.get(tasks[j].wi).add(tasks[i].wi);
    }
  }
}

const waves = [];
const sorted = [...tasks].sort((a, b) => conflictMap.get(b.wi).size - conflictMap.get(a.wi).size || a.wi.localeCompare(b.wi));
for (const task of sorted) {
  let placed = false;
  for (const wave of waves) {
    if (wave.tasks.length >= maxWorkers) continue;
    if (wave.tasks.every((existing) => !conflictMap.get(task.wi).has(existing.wi))) {
      wave.tasks.push(task);
      placed = true;
      break;
    }
  }
  if (!placed) waves.push({ id: `wave-${waves.length + 1}`, tasks: [task] });
}

for (const [waveIndex, wave] of waves.entries()) {
  wave.parallel = wave.tasks.length > 1;
  for (const [taskIndex, task] of wave.tasks.entries()) {
    task.conflicts_with = Array.from(conflictMap.get(task.wi)).sort();
    const totalDispatchable = tasks.filter((candidate) => !candidate.missing && !candidate.blocked_reason).length;
    task.transport = task.blocked_reason || task.missing ? 'blocked' : chooseTransport(task, totalDispatchable);
    task.runtime_assignment = task.blocked_reason || task.missing ? {} : assignRuntime(task, waveIndex, taskIndex);
    task.ownership = {
      write_scope: task.blocked_reason || task.missing ? [] : [...new Set([...task.affected_files, ...task.dependency_files])].sort(),
    };
    // WI-562 IP-H1/V-2: every dispatchable task declares its branch (workers
    // claim per-branch) and its validation_commands (derived from the WI file's
    // "## Validation" fenced block when present, else repo test script) so
    // merge-back can REPLAY declared evidence fail-closed.
    task.branch = `parallel/${task.wi}`;
    if (!task.blocked_reason && !task.missing) {
      task.validation_commands = deriveValidationCommands(root, task);
    }
  }
}

// WI-562: declared validation source — WI markdown "## Validation" lines first,
// then a repo test script; otherwise omitted (merge-back refuses until declared).
function deriveValidationCommands(root, task) {
  const cmds = [];
  try {
    const md = fs.readFileSync(path.join(root, 'docs/specs/work-items', `${task.wi}.md`), 'utf8');
    const section = md.match(/## Validation\n([\s\S]*?)(\n## |$)/)?.[1] || '';
    for (const m of section.matchAll(/^\s*[-*]\s+`([^`]+)`/gm)) cmds.push(m[1]);
    // Fenced ```bash blocks inside the section are declared commands too.
    for (const fence of section.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)) {
      for (const line of fence[1].split("\n")) {
        const t = line.trim();
        if (t && !t.startsWith("#")) cmds.push(t);
      }
    }
  } catch { /* no WI body */ }
  if (cmds.length === 0) {
    // Fallback: the repo's own test script — universally replayable when present.
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      if (pkg.scripts?.test) cmds.push('npm test');
    } catch { /* no package.json */ }
  }
  return cmds;
}

const plan = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  root,
  max_workers: maxWorkers,
  inline_threshold_minutes: inlineThreshold,
  requested_wis: wiArgs,
  dispatchable: tasks.every((task) => !task.missing && !task.blocked_reason),
  dispatch_blockers: tasks
    .filter((task) => task.missing || task.blocked_reason)
    .map((task) => ({ wi: task.wi, reason: task.missing ? 'missing-wi-file' : task.blocked_reason })),
  shared_config_serializers: sharedConfigPatterns.map((pattern) => pattern.source),
  waves,
  merge_back_contract: {
    result_glob: '.svc/dispatch/*.result.json',
    required_fields: [
      'wi',
      'status',
      'worker_summary',
      'changed_files',
      'validation_evidence',
      'clean_worktree',
      'parent_graph_mutation',
    ],
    validator: 'node scripts/validate-parallel-merge-back.mjs --plan <plan> --results .svc/dispatch',
  },
};

const json = `${JSON.stringify(plan, null, 2)}\n`;
if (outPath) {
  const absOut = path.resolve(root, outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, json);
}
process.stdout.write(json);
