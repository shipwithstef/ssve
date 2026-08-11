#!/usr/bin/env node
/**
 * Runtime concern scanner.
 *
 * Given a change set (file paths, optionally with diff content), returns the
 * concerns matched, with severity and required handlers.
 *
 * Modes:
 *   --diff                 use `git diff --name-only HEAD` against the repo
 *   --staged               use `git diff --cached --name-only`
 *   --paths <a> <b> ...    explicit path list (paths separated by spaces)
 *   --json                 emit JSON instead of human-readable
 *   --project <path>       project root (for project-side concern overrides at <path>/.svc/concerns/)
 *
 * Always merges universal (this repo) + project (--project) concerns.
 * Project concerns with the same `name` override universal ones (shallow merge over frontmatter).
 *
 * Exit codes:
 *   0 = no CRITICAL/HIGH matches (advisory output may still be present)
 *   3 = CRITICAL matches present (caller should hard-block)
 *   4 = HIGH matches present without explicit ack (caller should require ack)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVC_ROOT = join(__dirname, '..');
const UNIVERSAL_REGISTRY_PATH = join(SVC_ROOT, 'concerns', 'REGISTRY.json');

// --- arg parsing ---------------------------------------------------------

function parseArgs(argv) {
  const args = { mode: 'diff', paths: [], json: false, project: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diff') args.mode = 'diff';
    else if (a === '--staged') args.mode = 'staged';
    else if (a === '--paths') {
      args.mode = 'paths';
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.paths.push(argv[++i]);
    } else if (a === '--json') args.json = true;
    else if (a === '--project') args.project = argv[++i];
  }
  return args;
}

// --- registry loading ----------------------------------------------------

function loadUniversalRegistry() {
  return JSON.parse(readFileSync(UNIVERSAL_REGISTRY_PATH, 'utf8'));
}

function loadProjectConcerns(projectRoot) {
  if (!projectRoot) return [];
  const dir = join(projectRoot, '.svc', 'concerns');
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const concerns = [];
  for (const f of entries) {
    if (!f.endsWith('.md')) continue;
    if (['SCHEMA.md', 'README.md', 'REGISTRY.json'].includes(f)) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    const fm = parseFrontmatter(text);
    if (fm && fm.name) {
      fm.source_file = join(projectRoot, '.svc', 'concerns', f);
      fm._project_override = true;
      concerns.push(fm);
    }
  }
  return concerns;
}

function mergeConcerns(universal, projectAdditions) {
  const byName = new Map();
  for (const c of universal) byName.set(c.name, c);
  for (const p of projectAdditions) {
    const existing = byName.get(p.name);
    if (existing) {
      // shallow merge: project fields override
      byName.set(p.name, { ...existing, ...p });
    } else {
      byName.set(p.name, p);
    }
  }
  return [...byName.values()];
}

// --- minimal YAML parser (kept in sync with build-concern-registry.mjs) ---

function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  return parseYaml(lines.slice(1, end).join('\n'));
}

function parseYaml(text) {
  const root = {};
  const stack = [{ obj: root, indent: -1, key: null }];
  let inBlockScalar = false;
  let blockScalarKey = null;
  let blockScalarIndent = 0;
  let blockScalarLines = [];
  let blockScalarOwner = null;

  const finish = () => {
    if (blockScalarOwner && blockScalarKey) {
      blockScalarOwner[blockScalarKey] = blockScalarLines.join('\n').replace(/\n+$/, '');
    }
    inBlockScalar = false;
    blockScalarKey = null;
    blockScalarLines = [];
    blockScalarOwner = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '' && !inBlockScalar) continue;
    if (line.trim().startsWith('#')) continue;
    const indent = line.match(/^ */)[0].length;

    if (inBlockScalar) {
      if (line.trim() === '' || indent >= blockScalarIndent) {
        blockScalarLines.push(line.slice(blockScalarIndent));
        continue;
      } else {
        finish();
      }
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    const trimmed = line.slice(indent);

    if (trimmed.startsWith('- ')) {
      const parentKey = stack[stack.length - 1].key;
      if (!parentKey) continue;
      const parentParent = stack[stack.length - 2]?.obj ?? root;
      if (!Array.isArray(parentParent[parentKey])) parentParent[parentKey] = [];
      parentParent[parentKey].push(stripQuotes(trimmed.slice(2).trim()));
      continue;
    }
    const m = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal.trim();
    if (val === '|' || val === '>') {
      inBlockScalar = true;
      blockScalarKey = key;
      blockScalarOwner = parent;
      blockScalarIndent = indent + 2;
      blockScalarLines = [];
      continue;
    }
    if (val === '') {
      parent[key] = parent[key] ?? {};
      stack.push({ obj: parent[key], indent, key });
      continue;
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim();
      parent[key] = inner === '' ? [] : inner.split(',').map((s) => stripQuotes(s.trim()));
      continue;
    }
    parent[key] = stripQuotes(val);
  }
  if (inBlockScalar) finish();
  return root;
}

function stripQuotes(s) {
  if (typeof s !== 'string') return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// --- glob matcher (gitignore-ish, minimal) -------------------------------

function globToRegex(glob) {
  // Translate ** → match-any, * → no-slash, ? → single non-slash char
  // Escape regex metas; preserve / boundaries.
  const re = glob
    .replace(/[.+^$(){}|]/g, '\\$&')
    .replace(/\[!(.+?)\]/g, '[^$1]')
    .replace(/\*\*/g, '@@DSTAR@@')
    .replace(/\*/g, '[^/]*')
    .replace(/@@DSTAR@@/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp('^' + re + '$');
}

function pathMatchesAnyPattern(path, patterns) {
  if (!patterns || patterns.length === 0) return false;
  for (const pat of patterns) {
    if (globToRegex(pat).test(path)) return true;
  }
  return false;
}

// --- diff sources --------------------------------------------------------

function getDiffPaths(mode) {
  try {
    const cmd = mode === 'staged' ? 'git diff --cached --name-only' : 'git diff --name-only HEAD';
    const out = execSync(cmd, { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getDiffContent(mode, paths) {
  // For diff_keywords matching, we need the added-line content.
  try {
    const cmd = mode === 'staged' ? 'git diff --cached -U0' : 'git diff -U0 HEAD';
    return execSync(cmd, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

// --- matching engine -----------------------------------------------------

function matchConcern(concern, paths, diffText) {
  if (concern.status && concern.status !== 'active') return null;

  const filteredPaths = paths.filter(
    (p) => !pathMatchesAnyPattern(p, concern.fires_off || []),
  );
  if (filteredPaths.length === 0) return null;

  let signalHit = false;
  const reasons = [];

  // file path patterns
  const fpRaw = concern.signals?.file_path_patterns;
  const fp = Array.isArray(fpRaw) ? fpRaw : [];
  for (const p of filteredPaths) {
    if (pathMatchesAnyPattern(p, fp)) {
      signalHit = true;
      reasons.push(`path:${p}`);
    }
  }

  // diff keywords
  const kwsRaw = concern.signals?.diff_keywords;
  const kws = Array.isArray(kwsRaw) ? kwsRaw : [];
  if (diffText && kws.length > 0) {
    for (const kw of kws) {
      try {
        const re = new RegExp(kw, 'i');
        if (re.test(diffText)) {
          signalHit = true;
          reasons.push(`keyword:/${kw}/`);
        }
      } catch {
        // bad regex; skip
      }
    }
  }

  // packages_imported / env_vars_referenced — minimal: keyword-based on diff for now
  // (proper signal would parse package.json deltas; deferred to v2)
  const pkgsRaw = concern.signals?.packages_imported;
  const pkgs = Array.isArray(pkgsRaw) ? pkgsRaw : [];
  for (const p of pkgs) {
    if (diffText && diffText.includes(`"${p}"`)) {
      signalHit = true;
      reasons.push(`package:${p}`);
    }
  }
  const envsRaw = concern.signals?.env_vars_referenced;
  const envs = Array.isArray(envsRaw) ? envsRaw : [];
  for (const e of envs) {
    try {
      const re = new RegExp(e.replace(/\*/g, '\\w*'), 'g');
      if (diffText && re.test(diffText)) {
        signalHit = true;
        reasons.push(`env:${e}`);
      }
    } catch {
      // bad regex; skip
    }
  }

  if (!signalHit) return null;
  return {
    name: concern.name,
    severity: concern.severity,
    domain: concern.domain,
    matched_paths: [...new Set(reasons.filter((r) => r.startsWith('path:')))],
    other_signals: [...new Set(reasons.filter((r) => !r.startsWith('path:')))],
    handled_by: concern.handled_by,
    waiver_format: concern.waiver_format,
    source_file: concern.source_file,
  };
}

// --- output --------------------------------------------------------------

function emit(matches, json) {
  if (json) {
    console.log(JSON.stringify({ matches }, null, 2));
    return;
  }
  if (matches.length === 0) {
    console.log('No concerns matched.');
    return;
  }
  const bySev = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  for (const m of matches) bySev[m.severity || 'LOW'].push(m);
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    if (bySev[sev].length === 0) continue;
    console.log(`\n=== ${sev} ===`);
    for (const m of bySev[sev]) {
      const reqSkills = m.handled_by?.required_skills?.join(', ') || '(none)';
      const reqRules = m.handled_by?.required_rules?.join(', ') || '(none)';
      console.log(`  • ${m.name} [${m.domain}]`);
      console.log(`      required skills: ${reqSkills}`);
      console.log(`      required rules:  ${reqRules}`);
      const sigs = [...m.matched_paths, ...m.other_signals];
      if (sigs.length > 0) console.log(`      signals: ${sigs.slice(0, 5).join(', ')}${sigs.length > 5 ? '...' : ''}`);
    }
  }
}

// --- main ----------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  let universal;
  try {
    universal = loadUniversalRegistry().concerns || [];
  } catch (e) {
    console.error(`Failed to load universal registry: ${e.message}`);
    process.exit(2);
  }
  const projectAdditions = loadProjectConcerns(args.project);
  const merged = mergeConcerns(universal, projectAdditions);

  const paths = args.mode === 'paths' ? args.paths : getDiffPaths(args.mode);
  const diffText = args.mode === 'paths' ? '' : getDiffContent(args.mode, paths);

  const matches = [];
  for (const c of merged) {
    const m = matchConcern(c, paths, diffText);
    if (m) matches.push(m);
  }

  emit(matches, args.json);

  const hasCritical = matches.some((m) => m.severity === 'CRITICAL');
  const hasHigh = matches.some((m) => m.severity === 'HIGH');
  if (hasCritical) process.exit(3);
  if (hasHigh) process.exit(4);
  process.exit(0);
}

main();
