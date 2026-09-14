#!/usr/bin/env node
// scripts/capability-rediscover.mjs (WI-107)
//
// Flags stale registry entries (last_verified > 30 days) and emits a
// diff-proposal file under ~/.svc/capabilities/pending-updates/<id>.md for
// each. Does NOT auto-update the registry — human checkpoint required.
//
// In v1, rediscovery itself (web search against vendor docs) is a stub:
// the agent invoking this script is expected to pair it with the research
// skill (WI-090) to actually fetch fresh data. This script provides:
//   - the staleness detection
//   - the proposal file scaffold (ready for an agent to fill in)
//   - an accept command that applies a reviewed proposal to the registry
//
// CLI:
//   node scripts/capability-rediscover.mjs scan [--stale-days 30]
//   node scripts/capability-rediscover.mjs accept <resource-id>
//   node scripts/capability-rediscover.mjs list-pending

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readJsonAtomic, writeJsonAtomic } from './state-io.mjs';

const HOME = os.homedir();
const REGISTRY_PATH = process.env.SVC_BUILDER_CAPABILITY_REGISTRY
  || path.join(HOME, '.svc', 'capabilities', 'registry.json');
const PENDING_DIR = process.env.SVC_CAPABILITY_PENDING_DIR
  || path.join(HOME, '.svc', 'capabilities', 'pending-updates');

function die(msg, code = 1) {
  console.error(JSON.stringify({ verdict: 'failed', reason: msg }, null, 2));
  process.exit(code);
}

function parseArgs(argv) {
  const args = { staleDays: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stale-days') args.staleDays = Number(argv[++i]);
  }
  return args;
}

function readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) die(`registry not found: ${REGISTRY_PATH}`);
  return readJsonAtomic(REGISTRY_PATH);
}

function daysBetween(iso, now = new Date()) {
  const then = new Date(iso);
  return (now - then) / (1000 * 60 * 60 * 24);
}

function proposalPath(id) {
  return path.join(PENDING_DIR, `${id}.md`);
}

function cmdScan(args) {
  const reg = readRegistry();
  const stale = [];
  for (const [id, r] of Object.entries(reg.resources)) {
    const age = daysBetween(r.last_verified || '1970-01-01');
    if (age > args.staleDays) stale.push({ id, age: Math.round(age) });
  }

  fs.mkdirSync(PENDING_DIR, { recursive: true });
  const written = [];
  for (const { id, age } of stale) {
    const p = proposalPath(id);
    if (fs.existsSync(p)) continue; // already pending
    const body = renderProposalScaffold(id, reg.resources[id], age);
    fs.writeFileSync(p, body);
    written.push(p);
  }

  console.log(JSON.stringify({
    verdict: 'scan-complete',
    stale_count: stale.length,
    stale_ids: stale.map(s => s.id),
    proposals_written: written,
    pending_dir: PENDING_DIR,
  }, null, 2));
}

function renderProposalScaffold(id, resource, ageDays) {
  return `# Capability Rediscovery Proposal: ${id}

**Resource:** ${resource.label}
**Last verified:** ${resource.last_verified} (${ageDays} days ago)
**Scanned:** ${new Date().toISOString().slice(0, 10)}

## Current registry entry

\`\`\`json
${JSON.stringify(resource, null, 2)}
\`\`\`

## Proposed changes

<!--
Agent: pair this scaffold with the research skill (WI-090) to fetch the
vendor's current docs. Fill in the sections below with cited sources.

If no material change has happened since last_verified, note that and
propose only bumping last_verified.
-->

### What changed at the vendor

- [ ] Pricing change? ...
- [ ] New separate-budget capability? ...
- [ ] CLI tool added/removed/renamed? ...
- [ ] Quota changed? ...

### Proposed new entry

\`\`\`json
<!-- Fill in the full updated resource object here. -->
\`\`\`

### Sources

- <URL or vendor doc path> — <what it says>

## Acceptance

When the builder is satisfied with the proposed changes:

\`\`\`bash
node scripts/capability-rediscover.mjs accept ${id}
\`\`\`

This reads the 'Proposed new entry' JSON block from this file and applies it to the registry. The proposal file is then moved to \`pending-updates/done/\`.
`;
}

function cmdAccept(id) {
  if (!id) die('accept requires <resource-id>');
  const p = proposalPath(id);
  if (!fs.existsSync(p)) die(`no pending proposal for ${id} at ${p}`);
  const text = fs.readFileSync(p, 'utf8');

  const m = text.match(/### Proposed new entry\s*\n\s*```json\s*\n([\s\S]*?)\n\s*```/);
  if (!m) die('proposal does not contain a filled "### Proposed new entry" JSON block');
  const body = m[1].trim();
  if (body.startsWith('<!--')) die('proposed entry is still the scaffold comment — fill it in first');

  let entry;
  try { entry = JSON.parse(body); } catch (err) { die(`proposed entry JSON invalid: ${err.message}`); }

  const reg = readRegistry();
  reg.resources[id] = { ...entry, last_verified: new Date().toISOString().slice(0, 10) };
  writeJsonAtomic(REGISTRY_PATH, reg);

  // Move proposal to done/
  const doneDir = path.join(PENDING_DIR, 'done');
  fs.mkdirSync(doneDir, { recursive: true });
  fs.renameSync(p, path.join(doneDir, path.basename(p)));

  console.log(JSON.stringify({ verdict: 'accepted', id, moved_to: path.join(doneDir, `${id}.md`) }, null, 2));
}

function cmdListPending() {
  if (!fs.existsSync(PENDING_DIR)) {
    console.log(JSON.stringify({ verdict: 'empty', pending_dir: PENDING_DIR }, null, 2));
    return;
  }
  const entries = fs.readdirSync(PENDING_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(PENDING_DIR, f));
  console.log(JSON.stringify({ verdict: 'list', pending: entries }, null, 2));
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (cmd) {
    case 'scan': return cmdScan(args);
    case 'accept': return cmdAccept(rest[0]);
    case 'list-pending': return cmdListPending();
    default: die(`usage: capability-rediscover.mjs <scan|accept|list-pending> [args]`);
  }
}

main();
