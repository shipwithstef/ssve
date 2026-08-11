#!/usr/bin/env node
/**
 * Tier 1: AST-based YAML frontmatter validation.
 *
 * Properly parses YAML frontmatter and validates:
 * - Required top-level fields exist with correct types
 * - inputs/outputs have correct nested structure
 * - chain.lanes have correct shape (position, prev, next)
 * - chain flags (progressive, self_verify, human_checkpoint) are booleans
 * - No type mismatches (string where object expected, etc.)
 *
 * No LLM, <5s. Exit 0 if all pass, 1 if any fail.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const MANIFEST = JSON.parse(readFileSync(resolve(REPO_ROOT, 'skills-manifest.json'), 'utf8'));

let pass = 0;
let fail = 0;
const errors = [];

function ok() { pass++; }
function bad(skill, msg) { fail++; errors.push(`  FAIL: ${skill} — ${msg}`); }

/**
 * Parse YAML frontmatter into a JS object.
 * Handles: scalars, block scalars (> | >- |-), inline objects { k: v },
 * inline arrays [], arrays of inline objects (- { ... }), nested keys.
 */
function parseFrontmatter(text) {
  const lines = text.split('\n');
  const root = {};
  const stack = [{ obj: root, indent: -1, key: null }];
  let blockScalarKey = null;
  let blockScalarIndent = -1;
  let blockScalarParts = [];
  let blockScalarParent = null;

  function flushBlockScalar() {
    if (blockScalarKey && blockScalarParent) {
      blockScalarParent[blockScalarKey] = blockScalarParts.join(' ').trim();
      blockScalarKey = null;
      blockScalarParts = [];
      blockScalarParent = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      if (blockScalarKey) blockScalarParts.push('');
      continue;
    }

    const indent = line.search(/\S/);
    const content = line.trim();

    // If collecting a block scalar, check if we should continue
    if (blockScalarKey) {
      if (indent > blockScalarIndent) {
        blockScalarParts.push(content);
        continue;
      } else {
        // Block scalar ended
        flushBlockScalar();
      }
    }

    // Pop stack to find parent at correct indent level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // Array item: - { ... } or - scalar
    if (content.startsWith('- ')) {
      const value = content.slice(2).trim();
      // Find which key in parent is an array
      const parentKeys = Object.keys(parent);
      let arrayKey = null;
      for (let k = parentKeys.length - 1; k >= 0; k--) {
        if (Array.isArray(parent[parentKeys[k]])) {
          arrayKey = parentKeys[k];
          break;
        }
      }
      if (arrayKey) {
        if (value.startsWith('{') && value.endsWith('}')) {
          parent[arrayKey].push(parseInlineObject(value));
        } else {
          parent[arrayKey].push(value);
        }
      }
      continue;
    }

    // Key: value
    const colonIdx = content.indexOf(':');
    if (colonIdx === -1) continue;

    const key = content.slice(0, colonIdx).trim();
    let rawValue = content.slice(colonIdx + 1).trim();

    // Block scalar indicators: > | >- |-
    if (rawValue === '>' || rawValue === '|' || rawValue === '>-' || rawValue === '|-') {
      blockScalarKey = key;
      blockScalarIndent = indent;
      blockScalarParts = [];
      blockScalarParent = parent;
      continue;
    }

    // Empty inline array: []
    if (rawValue === '[]') {
      parent[key] = [];
      continue;
    }

    // Empty inline object: {}
    if (rawValue === '{}') {
      parent[key] = {};
      continue;
    }

    // Inline object: { k: v, k2: v2 }
    if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
      parent[key] = parseInlineObject(rawValue);
      continue;
    }

    // Inline array: [ v1, v2 ]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1).trim();
      if (inner === '') {
        parent[key] = [];
      } else {
        parent[key] = inner.split(',').map(v => parseScalar(v.trim()));
      }
      continue;
    }

    if (rawValue === '') {
      // Check next line to determine type (nested object vs array)
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const nextTrimmed = nextLine.trim();
      const nextIndent = nextLine.search(/\S/);
      if (nextIndent > indent && nextTrimmed.startsWith('- ')) {
        parent[key] = [];
        stack.push({ obj: parent, indent, key });
      } else if (nextIndent > indent) {
        parent[key] = {};
        stack.push({ obj: parent[key], indent, key });
      } else {
        parent[key] = '';
      }
    } else {
      parent[key] = parseScalar(rawValue);
    }
  }

  // Flush any remaining block scalar
  flushBlockScalar();

  return root;
}

function parseInlineObject(text) {
  const inner = text.slice(1, -1).trim();
  if (inner === '') return {};
  const obj = {};
  const parts = splitOnCommas(inner);
  for (const part of parts) {
    const ci = part.indexOf(':');
    if (ci === -1) continue;
    const k = part.slice(0, ci).trim();
    const v = part.slice(ci + 1).trim();
    obj[k] = parseScalar(v);
  }
  return obj;
}

function splitOnCommas(text) {
  const parts = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (const ch of text) {
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true; quoteChar = ch; current += ch;
    } else if (inQuote && ch === quoteChar) {
      inQuote = false; current += ch;
    } else if (!inQuote && ch === ',') {
      parts.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseScalar(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val);
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

/**
 * Extract frontmatter string from SKILL.md content.
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

// --- Validation rules ---

const VALID_LANES = [
  'greenfield', 'brownfield-conversion', 'brownfield-feature',
  'bugfix', 'drift', 'refactor', 'framework'
];

for (const skill of MANIFEST.includedSkills) {
  const skillFile = resolve(REPO_ROOT, 'skills', skill, 'SKILL.md');
  let content;
  try {
    content = readFileSync(skillFile, 'utf8');
  } catch {
    bad(skill, 'SKILL.md not found');
    continue;
  }

  const fmStr = extractFrontmatter(content);
  if (!fmStr) {
    bad(skill, 'no YAML frontmatter found (missing --- delimiters)');
    continue;
  }

  // Check for duplicate top-level keys
  const topKeys = [];
  for (const line of fmStr.split('\n')) {
    if (line.match(/^\S+:/)) {
      const key = line.split(':')[0].trim();
      if (topKeys.includes(key)) {
        bad(skill, `duplicate top-level key: ${key}`);
      } else {
        ok();
      }
      topKeys.push(key);
    }
  }

  let fm;
  try {
    fm = parseFrontmatter(fmStr);
  } catch (e) {
    bad(skill, `frontmatter parse error: ${e.message}`);
    continue;
  }

  // 1. Required top-level fields
  for (const field of ['name', 'description', 'inputs', 'outputs', 'chain']) {
    if (fm[field] === undefined) {
      bad(skill, `missing required field: ${field}`);
    } else {
      ok();
    }
  }

  // 2. name must be a string matching directory name
  if (typeof fm.name === 'string') {
    if (fm.name !== skill) {
      bad(skill, `name '${fm.name}' does not match directory '${skill}'`);
    } else {
      ok();
    }
  } else if (fm.name !== undefined) {
    bad(skill, `name must be a string, got ${typeof fm.name}`);
  }

  // 3. description must be a non-empty string
  if (typeof fm.description === 'string') {
    if (fm.description.trim().length < 10) {
      bad(skill, `description too short (${fm.description.trim().length} chars, min 10)`);
    } else {
      ok();
    }
  } else if (fm.description !== undefined) {
    bad(skill, `description must be a string, got ${typeof fm.description} (value: ${JSON.stringify(fm.description).slice(0, 80)})`);
  }

  // 4. inputs must be an object with required array
  if (fm.inputs && typeof fm.inputs === 'object') {
    if (fm.inputs.required === undefined) {
      bad(skill, 'inputs missing required: sub-key');
    } else if (!Array.isArray(fm.inputs.required)) {
      bad(skill, `inputs.required must be array, got ${typeof fm.inputs.required}`);
    } else {
      ok();
      // Each required input should have path and artifact (unless empty array)
      for (const inp of fm.inputs.required) {
        if (typeof inp === 'object' && inp !== null) {
          if (!inp.path && !inp.note) {
            bad(skill, `input missing path: ${JSON.stringify(inp).slice(0, 100)}`);
          } else {
            ok();
          }
          if (!inp.artifact) {
            bad(skill, `input missing artifact: ${JSON.stringify(inp).slice(0, 100)}`);
          } else {
            ok();
          }
        }
      }
    }
    // Optional inputs
    if (fm.inputs.optional && Array.isArray(fm.inputs.optional)) {
      for (const inp of fm.inputs.optional) {
        if (typeof inp === 'object' && inp !== null) {
          if (!inp.path && !inp.note) {
            bad(skill, `optional input missing path: ${JSON.stringify(inp).slice(0, 100)}`);
          } else {
            ok();
          }
        }
      }
    }
  }

  // 5. outputs must be an object with produces array
  if (fm.outputs && typeof fm.outputs === 'object') {
    if (fm.outputs.produces === undefined) {
      bad(skill, 'outputs missing produces: sub-key');
    } else if (!Array.isArray(fm.outputs.produces)) {
      bad(skill, `outputs.produces must be array, got ${typeof fm.outputs.produces}`);
    } else {
      ok();
      for (const out of fm.outputs.produces) {
        if (typeof out === 'object' && out !== null) {
          if (!out.path && !out.note) {
            bad(skill, `output missing path: ${JSON.stringify(out).slice(0, 100)}`);
          } else {
            ok();
          }
          if (!out.artifact) {
            bad(skill, `output missing artifact: ${JSON.stringify(out).slice(0, 100)}`);
          } else {
            ok();
          }
        }
      }
    }
  }

  // 6. chain must be an object with lanes
  if (fm.chain && typeof fm.chain === 'object') {
    if (!fm.chain.lanes) {
      bad(skill, 'chain missing lanes: sub-key');
    } else {
      ok();
    }

    // Validate chain flags are booleans
    for (const flag of ['progressive', 'self_verify', 'human_checkpoint']) {
      if (fm.chain[flag] !== undefined) {
        if (typeof fm.chain[flag] !== 'boolean') {
          bad(skill, `chain.${flag} must be boolean, got ${typeof fm.chain[flag]} (${fm.chain[flag]})`);
        } else {
          ok();
        }
      }
    }

    // Validate each lane
    if (fm.chain.lanes && typeof fm.chain.lanes === 'object') {
      for (const [lane, config] of Object.entries(fm.chain.lanes)) {
        if (!VALID_LANES.includes(lane)) {
          bad(skill, `unknown lane: ${lane} (valid: ${VALID_LANES.join(', ')})`);
        } else {
          ok();
        }

        if (typeof config === 'object' && config !== null) {
          // position must be a number
          if (config.position !== undefined) {
            if (typeof config.position !== 'number') {
              bad(skill, `chain.lanes.${lane}.position must be number, got ${typeof config.position}`);
            } else {
              ok();
            }
          }

          // prev/next must reference included skills or be null
          for (const ref of ['prev', 'next']) {
            if (config[ref] !== undefined && config[ref] !== null && config[ref] !== 'null') {
              if (!MANIFEST.includedSkills.includes(config[ref])) {
                bad(skill, `chain.lanes.${lane}.${ref} references '${config[ref]}' which is not in includedSkills`);
              } else {
                ok();
              }
            }
          }
        }
      }
    }
  }
}

// Summary
console.log('=== Tier 1: Frontmatter AST Validation ===');
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('');
  errors.forEach(e => console.log(e));
  process.exit(1);
} else {
  console.log('  PASS — all frontmatter structurally valid');
  process.exit(0);
}
