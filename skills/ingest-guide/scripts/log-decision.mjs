#!/usr/bin/env node
// skills/ingest-guide/scripts/log-decision.mjs
// Append a validated ingest-guide decision line to .svc/pipeline-decisions.jsonl.
//
// USAGE:
//   node skills/ingest-guide/scripts/log-decision.mjs \
//     --source-id <id> \
//     --claims-extracted <N> \
//     --already-known <N> --new <N> --contradicts <N> \
//     --catalog-strong <N> --catalog-partial <N> --catalog-novel <N> \
//     --addon-check <tag> \
//     --project-fit-strong <N> --project-fit-weak <N> --project-fit-none <N> \
//     --upstream-fetch <ok|failed|n/a> \
//     --discard <N> --store <N> --blend-or-link <N> --selective-blend <N> --promote <N> \
//     --experiments-pending <N> \
//     --report-path <path>
//
// EXIT: 0 on success (JSONL line appended), 1 on validation failure.

import path from 'node:path';
import { appendJsonlLine } from '../../../scripts/state-io.mjs';

const repoRoot = process.env.SVC_REPO_ROOT || process.cwd();
const logPath = path.join(repoRoot, '.svc', 'pipeline-decisions.jsonl');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    switch (a) {
      case '--source-id': out.source_id = v; i++; break;
      case '--claims-extracted': out.claims_extracted = Number(v); i++; break;
      case '--already-known': out.already_known = Number(v); i++; break;
      case '--new': out.new_ = Number(v); i++; break;
      case '--contradicts': out.contradicts = Number(v); i++; break;
      case '--catalog-strong': out.catalog_strong = Number(v); i++; break;
      case '--catalog-partial': out.catalog_partial = Number(v); i++; break;
      case '--catalog-novel': out.catalog_novel = Number(v); i++; break;
      case '--addon-check': out.addon_check = v; i++; break;
      case '--project-fit-strong': out.project_fit_strong = Number(v); i++; break;
      case '--project-fit-weak': out.project_fit_weak = Number(v); i++; break;
      case '--project-fit-none': out.project_fit_none = Number(v); i++; break;
      case '--upstream-fetch': out.upstream_fetch = v; i++; break;
      case '--discard': out.discard = Number(v); i++; break;
      case '--store': out.store = Number(v); i++; break;
      case '--blend-or-link': out.blend_or_link = Number(v); i++; break;
      case '--selective-blend': out.selective_blend = Number(v); i++; break;
      case '--promote': out.promote = Number(v); i++; break;
      case '--experiments-pending': out.experiments_pending = Number(v); i++; break;
      case '--report-path': out.report_path = v; i++; break;
    }
  }
  return out;
}

function fail(msg, extra = {}) {
  console.error(JSON.stringify({ verdict: 'failed', reason: msg, ...extra }, null, 2));
  process.exit(1);
}

function main() {
  const a = parseArgs(process.argv.slice(2));

  if (!a.source_id) fail('missing --source-id');
  if (!a.report_path) fail('missing --report-path');
  if (a.claims_extracted == null || Number.isNaN(a.claims_extracted))
    fail('--claims-extracted must be a number');
  if (a.claims_extracted < 0) fail('--claims-extracted must be non-negative');

  // Reject negative counts for all numeric fields
  const numericFields = ['already_known', 'new_', 'contradicts', 'catalog_strong', 'catalog_partial', 'catalog_novel',
    'project_fit_strong', 'project_fit_weak', 'project_fit_none', 'discard', 'store', 'blend_or_link', 'selective_blend', 'promote', 'experiments_pending'];
  for (const f of numericFields) {
    if (a[f] != null && a[f] < 0) fail('--' + f.replace('_', '-') + ' must be non-negative');
  }

  // Classification sum must equal claims_extracted
  const classifiedSum = (a.already_known || 0) + (a.new_ || 0) + (a.contradicts || 0);
  if (classifiedSum !== a.claims_extracted) {
    fail(`classification sum (${classifiedSum}) != claims_extracted (${a.claims_extracted})`,
      { classified: { already_known: a.already_known, new: a.new_, contradicts: a.contradicts } });
  }

  // Catalog sum must equal claims_extracted (every claim gets a catalog tag)
  const catalogSum = (a.catalog_strong || 0) + (a.catalog_partial || 0) + (a.catalog_novel || 0);
  if (catalogSum !== a.claims_extracted) {
    fail(`catalog sum (${catalogSum}) != claims_extracted (${a.claims_extracted})`,
      { catalog_check: { strong: a.catalog_strong, partial: a.catalog_partial, novel: a.catalog_novel } });
  }

  // Project-fit sum must equal claims_extracted (every claim gets a fit tag)
  const fitSum = (a.project_fit_strong || 0) + (a.project_fit_weak || 0) + (a.project_fit_none || 0);
  if (fitSum !== a.claims_extracted) {
    fail(`project-fit sum (${fitSum}) != claims_extracted (${a.claims_extracted})`,
      { project_fit: { strong: a.project_fit_strong, weak: a.project_fit_weak, none: a.project_fit_none } });
  }

  // Routing sum must equal claims_extracted (every claim gets exactly one routing decision)
  const routingSum = (a.discard || 0) + (a.store || 0) + (a.blend_or_link || 0) + (a.selective_blend || 0) + (a.promote || 0);
  if (routingSum !== a.claims_extracted) {
    fail(`routing sum (${routingSum}) != claims_extracted (${a.claims_extracted}) — every claim must have exactly one routing decision`,
      { routing: { discard: a.discard, store: a.store, 'blend-or-link': a.blend_or_link, 'selective-blend': a.selective_blend, promote: a.promote } });
  }

  // Upstream fetch must be one of the allowed values
  const validUpstream = ['ok', 'failed', 'n/a'];
  if (a.upstream_fetch && !validUpstream.includes(a.upstream_fetch)) {
    fail(`--upstream-fetch must be one of: ${validUpstream.join(', ')}`, { upstream_fetch: a.upstream_fetch });
  }

  // Addon check must be one of the allowed values
  const validAddon = ['addon-known-blended', 'addon-known-not-blended', 'addon-novel', 'n/a'];
  if (a.addon_check && !validAddon.includes(a.addon_check)) {
    fail(`--addon-check must be one of: ${validAddon.join(', ')}`, { addon_check: a.addon_check });
  }

  const entry = {
    skill: 'ingest-guide',
    source_id: a.source_id,
    claims_extracted: a.claims_extracted,
    classified: {
      'already-known': a.already_known || 0,
      'new': a.new_ || 0,
      'contradicts-known': a.contradicts || 0,
    },
    catalog_check: {
      strong: a.catalog_strong || 0,
      partial: a.catalog_partial || 0,
      novel: a.catalog_novel || 0,
    },
    addon_check: a.addon_check || 'n/a',
    project_fit: {
      strong: a.project_fit_strong || 0,
      weak: a.project_fit_weak || 0,
      none: a.project_fit_none || 0,
    },
    upstream_fetch: a.upstream_fetch || 'n/a',
    routing: {
      discard: a.discard || 0,
      store: a.store || 0,
      'blend-or-link': a.blend_or_link || 0,
      'selective-blend': a.selective_blend || 0,
      promote: a.promote || 0,
    },
    experiments_pending: a.experiments_pending || 0,
    report_path: a.report_path,
    timestamp: new Date().toISOString(),
  };

  appendJsonlLine(logPath, entry);

  console.log(JSON.stringify({ verdict: 'logged', entry, log: logPath }, null, 2));
  process.exit(0);
}

main();
