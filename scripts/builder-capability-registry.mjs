#!/usr/bin/env node
// scripts/builder-capability-registry.mjs
//
// Per-builder inventory CRUD for AI/dev resources (WI-104, part of WI-094
// meta-orchestrator chain). Persistent JSON at
// ~/.svc/capabilities/registry.json. Seeded from the svc-shipped seed at
// capability-registry/references/capability-registry-seed.json.
//
// NOTE: distinct from scripts/capability-registry.mjs which is a
// per-project capability manager. This one tracks the BUILDER's global
// AI-vendor inventory across all their projects.
//
// Commands: list | show <id> | set <id> | remove <id> | seed | validate

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeJsonAtomic } from './state-io.mjs';

const REGISTRY_PATH = process.env.SVC_BUILDER_CAPABILITY_REGISTRY
  || path.join(os.homedir(), '.svc', 'capabilities', 'registry.json');
const REPO_ROOT = process.env.SVC_REPO_ROOT || process.cwd();
const SEED_PATH = path.join(REPO_ROOT, 'references', 'capability-registry-seed.json');

const SCHEMA_VERSION = 1;
const VALID_TIERS = new Set(['paid', 'free', 'trial']);
const VALID_CADENCES = new Set(['monthly', 'weekly', 'daily', 'never']);

function readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    die(`registry at ${REGISTRY_PATH} is unreadable: ${err.message}`);
  }
}

function writeRegistry(data) {
  writeJsonAtomic(REGISTRY_PATH, data);
}

function die(msg, code = 1) {
  console.error(JSON.stringify({ verdict: 'failed', reason: msg }, null, 2));
  process.exit(code);
}

function validate(data) {
  const errors = [];
  if (!data || typeof data !== 'object') errors.push('registry is not an object');
  else {
    if (data.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
    if (!data.resources || typeof data.resources !== 'object') errors.push('resources must be an object');
    else {
      for (const [id, r] of Object.entries(data.resources)) {
        if (!r.label) errors.push(`${id}: missing label`);
        if (!VALID_TIERS.has(r.tier)) errors.push(`${id}: tier must be paid|free|trial`);
        if (!Array.isArray(r.host_cli)) errors.push(`${id}: host_cli must be an array`);
        if (!VALID_CADENCES.has(r.reset_cadence)) errors.push(`${id}: reset_cadence must be monthly|weekly|daily|never`);
        if (r.sub_budgets && typeof r.sub_budgets !== 'object') errors.push(`${id}: sub_budgets must be an object`);
      }
    }
  }
  return errors;
}

function cmdSeed() {
  if (fs.existsSync(REGISTRY_PATH)) {
    console.log(JSON.stringify({ verdict: 'noop', reason: 'registry already exists', path: REGISTRY_PATH }, null, 2));
    return;
  }
  if (!fs.existsSync(SEED_PATH)) die(`seed file missing: ${SEED_PATH}`);
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const errs = validate(seed);
  if (errs.length) die(`seed is invalid: ${errs.join('; ')}`);
  writeRegistry(seed);
  console.log(JSON.stringify({ verdict: 'seeded', path: REGISTRY_PATH, resource_count: Object.keys(seed.resources).length }, null, 2));
}

function ensureRegistry() {
  const data = readRegistry();
  if (!data) die('registry not found — run `builder-capability-registry.mjs seed` first');
  return data;
}

function cmdList() {
  const data = ensureRegistry();
  const lines = [];
  lines.push(`Capability registry — ${Object.keys(data.resources).length} resources (${REGISTRY_PATH})`);
  for (const [id, r] of Object.entries(data.resources)) {
    const sub = r.sub_budgets ? Object.keys(r.sub_budgets).length : 0;
    const cost = r.tier === 'paid' ? `$${r.cost_usd_monthly}/mo` : r.tier;
    lines.push(`  ${id.padEnd(24)} ${cost.padEnd(10)} cli=${(r.host_cli || []).join(',') || '-'}  subs=${sub}`);
  }
  console.log(lines.join('\n'));
}

function cmdShow(id) {
  const data = ensureRegistry();
  const r = data.resources[id];
  if (!r) die(`resource '${id}' not found`);
  console.log(JSON.stringify(r, null, 2));
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function cmdSet(id) {
  if (!id) die('set requires <resource-id>');
  const raw = await readStdin();
  let entry;
  try { entry = JSON.parse(raw); } catch (err) { die(`stdin is not JSON: ${err.message}`); }
  const data = readRegistry() || { schema_version: SCHEMA_VERSION, resources: {} };
  data.resources[id] = entry;
  const errs = validate(data);
  if (errs.length) die(`validation failed: ${errs.join('; ')}`);
  writeRegistry(data);
  console.log(JSON.stringify({ verdict: 'set', id, path: REGISTRY_PATH }, null, 2));
}

function cmdRemove(id) {
  if (!id) die('remove requires <resource-id>');
  const data = ensureRegistry();
  if (!data.resources[id]) die(`resource '${id}' not found`);
  delete data.resources[id];
  writeRegistry(data);
  console.log(JSON.stringify({ verdict: 'removed', id }, null, 2));
}

function cmdValidate() {
  const data = readRegistry();
  if (!data) die('registry not found');
  const errs = validate(data);
  if (errs.length) die(`invalid: ${errs.join('; ')}`);
  console.log(JSON.stringify({
    verdict: 'valid',
    schema_version: data.schema_version,
    resource_count: Object.keys(data.resources).length,
    with_sub_budgets: Object.values(data.resources).filter(r => r.sub_budgets && Object.keys(r.sub_budgets).length > 0).length,
  }, null, 2));
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case 'list': return cmdList();
    case 'show': return cmdShow(arg);
    case 'set': return cmdSet(arg);
    case 'remove': return cmdRemove(arg);
    case 'seed': return cmdSeed();
    case 'validate': return cmdValidate();
    default: die(`usage: builder-capability-registry.mjs <list|show|set|remove|seed|validate> [id]`);
  }
}

main().catch(err => die(err.message));
