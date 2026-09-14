#!/usr/bin/env node
/**
 * Builds concerns/REGISTRY.json from concerns/*.md + skill frontmatter.
 *
 * - Reads every concerns/<name>.md (skipping SCHEMA.md, README.md, REGISTRY.json)
 * - Parses YAML frontmatter
 * - Cross-validates: every required_skill in a concern must be claimed by at
 *   least one skill via `handles_concerns` in its SKILL.md frontmatter
 * - Writes concerns/REGISTRY.json (committed; the runtime artifact)
 *
 * Exit codes:
 *   0 = OK
 *   1 = lint errors (orphan skill refs, malformed concerns, etc.)
 *   2 = io error
 *
 * Usage:
 *   node scripts/build-concern-registry.mjs              # build + lint
 *   node scripts/build-concern-registry.mjs --check      # lint only, don't write
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const CONCERNS_DIR = join(REPO_ROOT, 'concerns');
const REGISTRY_PATH = join(CONCERNS_DIR, 'REGISTRY.json');
const CHECK_ONLY = process.argv.includes('--check');

const SKIP_FILES = new Set(['SCHEMA.md', 'README.md', 'REGISTRY.json']);

// --- minimal YAML frontmatter parser (no dep) ----------------------------

/**
 * Parses a markdown file's leading YAML frontmatter (--- ... ---).
 * Returns { fm: object, body: string } or { fm: null, body: text } if no FM.
 * Supports: scalars, lists (- item), nested objects (one level), block scalars (| and >).
 */
function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return { fm: null, body: text };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { fm: null, body: text };
  const fmText = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n');
  return { fm: parseYaml(fmText), body };
}

function parseYaml(text) {
  const root = {};
  const stack = [{ obj: root, indent: -1, key: null }];
  const lines = text.split('\n');
  let inBlockScalar = false;
  let blockScalarKey = null;
  let blockScalarIndent = 0;
  let blockScalarLines = [];
  let blockScalarOwner = null;

  const finishBlockScalar = () => {
    if (blockScalarOwner && blockScalarKey) {
      blockScalarOwner[blockScalarKey] = blockScalarLines.join('\n').replace(/\n+$/, '');
    }
    inBlockScalar = false;
    blockScalarKey = null;
    blockScalarLines = [];
    blockScalarOwner = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '' && !inBlockScalar) continue;
    if (line.trim().startsWith('#')) continue;

    const indent = line.match(/^ */)[0].length;

    if (inBlockScalar) {
      if (line.trim() === '' || indent >= blockScalarIndent) {
        blockScalarLines.push(line.slice(blockScalarIndent));
        continue;
      } else {
        finishBlockScalar();
      }
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    const trimmed = line.slice(indent);
    if (trimmed.startsWith('- ')) {
      // list item
      const parentKey = stack[stack.length - 1].key;
      if (!parentKey) continue;
      const parentParent = stack[stack.length - 2]?.obj ?? root;
      if (!Array.isArray(parentParent[parentKey])) parentParent[parentKey] = [];
      const v = trimmed.slice(2).trim();
      parentParent[parentKey].push(stripQuotes(v));
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
      // nested object or list follows
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
  if (inBlockScalar) finishBlockScalar();
  return root;
}

function stripQuotes(s) {
  if (typeof s !== 'string') return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// --- concern loader ------------------------------------------------------

function listConcernFiles(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    if (SKIP_FILES.has(f)) continue;
    if (!f.endsWith('.md')) continue;
    out.push(join(dir, f));
  }
  return out;
}

function loadConcerns() {
  const concerns = [];
  const errors = [];
  for (const path of listConcernFiles(CONCERNS_DIR)) {
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch (e) {
      errors.push(`READ-FAIL ${path}: ${e.message}`);
      continue;
    }
    const { fm } = parseFrontmatter(text);
    if (!fm) {
      errors.push(`NO-FRONTMATTER ${path}`);
      continue;
    }
    if (!fm.name) {
      errors.push(`MISSING-NAME ${path}`);
      continue;
    }
    if (!fm.severity) {
      errors.push(`MISSING-SEVERITY ${path} (concern: ${fm.name})`);
    }
    if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(fm.severity)) {
      errors.push(`BAD-SEVERITY ${fm.name}: ${fm.severity}`);
    }
    fm.source_file = path.replace(REPO_ROOT + '/', '');
    concerns.push(fm);
  }
  return { concerns, errors };
}

// --- skill frontmatter scanner ------------------------------------------

function listSkillFiles(repoRoot) {
  const out = [];
  const skillsRoot = join(repoRoot, 'skills');
  for (const entry of readdirSync(skillsRoot)) {
    const p = join(skillsRoot, entry);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const skillFile = join(p, 'SKILL.md');
    try {
      statSync(skillFile);
      out.push({ name: entry, path: skillFile });
    } catch {
      // not a skill dir
    }
  }
  return out;
}

function loadSkillClaims() {
  const claims = {}; // concern_name -> [skill_names]
  for (const { name, path } of listSkillFiles(REPO_ROOT)) {
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    const { fm } = parseFrontmatter(text);
    if (!fm || !fm.handles_concerns) continue;
    const handled = Array.isArray(fm.handles_concerns) ? fm.handles_concerns : [];
    for (const c of handled) {
      claims[c] = claims[c] ?? [];
      claims[c].push(name);
    }
  }
  return claims;
}

// --- cross-validation ----------------------------------------------------

function lintConcernsAgainstSkills(concerns, claims) {
  const errors = [];
  for (const c of concerns) {
    const required = c.handled_by?.required_skills || [];
    for (const skill of required) {
      const claimedBy = claims[c.name] || [];
      if (!claimedBy.includes(skill)) {
        errors.push(
          `ORPHAN-SKILL-REF concern=${c.name} required_skill=${skill} ` +
            `but skill does NOT declare handles_concerns: [${c.name}] in its SKILL.md frontmatter. ` +
            `Either add ${c.name} to ${skill}/SKILL.md, or remove ${skill} from concern's required_skills.`,
        );
      }
    }
  }
  return errors;
}

// --- main ----------------------------------------------------------------

function main() {
  const { concerns, errors: loadErrors } = loadConcerns();
  const claims = loadSkillClaims();
  const lintErrors = lintConcernsAgainstSkills(concerns, claims);
  const allErrors = [...loadErrors, ...lintErrors];

  if (allErrors.length > 0) {
    console.error('CONCERN REGISTRY BUILD FAILED:');
    for (const e of allErrors) console.error('  ' + e);
    process.exit(1);
  }

  const registry = {
    schema_version: 1,
    generated: new Date().toISOString(),
    universal_count: concerns.length,
    concerns: concerns.sort((a, b) => a.name.localeCompare(b.name)),
    skill_claims: claims,
  };

  if (CHECK_ONLY) {
    console.log(`OK: ${concerns.length} concerns, ${Object.keys(claims).length} skill claims (check-only mode, did not write)`);
    return;
  }

  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
  console.log(`OK: wrote ${REGISTRY_PATH} (${concerns.length} concerns, ${Object.keys(claims).length} skill claims)`);
}

main();
