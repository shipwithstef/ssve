#!/usr/bin/env node
// skills/research/scripts/domain-gate.mjs
// Domain classification gate for the research skill.
//
// BEHAVIOR:
//   Before writing extracted knowledge to references/knowledge/<domain>/,
//   the research agent MUST call this script with a domain proposal +
//   justification. The script:
//     1. Lists existing domains under references/knowledge/.
//     2. Validates the proposed domain against the taxonomy.
//     3. Requires EXPLICIT "--new-domain" flag + rationale to create a new
//        domain directory. Silent mis-filing is refused.
//
// USAGE:
//   node skills/research/scripts/domain-gate.mjs \
//     --source <source-name> \
//     --domain <domain> \
//     --justification "<why this domain fits>" \
//     [--new-domain]
//
// EXIT CODES:
//   0 — domain approved (existing domain OR new-domain with rationale)
//   1 — refused: domain doesn't exist and --new-domain was not passed
//   2 — refused: missing justification or source
//
// OUTPUT: JSON diagnostic to stdout on exit.

import fs from 'node:fs';
import path from 'node:path';
import { getKnowledgeRoot } from './lib/knowledge-paths.mjs';

const knowledgeRoot = getKnowledgeRoot();

function parseArgs(argv) {
  const args = { newDomain: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') args.source = argv[++i];
    else if (a === '--domain') args.domain = argv[++i];
    else if (a === '--justification') args.justification = argv[++i];
    else if (a === '--new-domain') args.newDomain = true;
  }
  return args;
}

function listExistingDomains() {
  if (!fs.existsSync(knowledgeRoot)) return [];
  const dirs = fs.readdirSync(knowledgeRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  // Also check domains/ subdirectory (newer organizational structure)
  const domainsDir = path.join(knowledgeRoot, 'domains');
  if (fs.existsSync(domainsDir)) {
    const domainDirs = fs.readdirSync(domainsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    dirs.push(...domainDirs);
  }
  return [...new Set(dirs)].sort();
}

function fail(code, verdict, reason, extra = {}) {
  const out = { verdict, reason, knowledge_root: knowledgeRoot, ...extra };
  console.log(JSON.stringify(out, null, 2));
  process.exit(code);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.source || !args.domain || !args.justification) {
    fail(2, 'refused', 'missing required args: --source, --domain, --justification',
      { received: args });
  }

  const existing = listExistingDomains();
  const domainExists = existing.includes(args.domain);

  if (domainExists) {
    fail(0, 'approved', 'domain exists in taxonomy',
      { domain: args.domain, source: args.source, justification: args.justification });
  }

  if (!args.newDomain) {
    fail(1, 'refused',
      `domain '${args.domain}' does not exist. Either pick an existing domain OR pass --new-domain with rationale.`,
      { proposed: args.domain, existing, hint: 'Silent mis-filing is the #1 failure mode — this gate refuses it.' });
  }

  // --new-domain path: approve with explicit rationale
  fail(0, 'approved',
    'new domain accepted with explicit --new-domain flag and justification',
    { domain: args.domain, source: args.source, justification: args.justification, newDomain: true });
}

main();
