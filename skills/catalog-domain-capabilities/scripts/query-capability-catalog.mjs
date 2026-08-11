#!/usr/bin/env node
/**
 * Query capability catalog for downstream skills.
 * Reads docs/specs/capability-catalog.data.json (or --catalog-path override)
 * and filters/sorts capabilities by journey, status, kano, convergence, category, BPS.
 *
 * Usage:
 *   node query-capability-catalog.mjs --journey onboarding --status MISSING
 *   node query-capability-catalog.mjs --convergence explosive --sort bps --limit 10
 *   node query-capability-catalog.mjs --kano must-be --min-bps 20 --markdown
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function usage() {
  console.log(`
Usage: node query-capability-catalog.mjs [options]

Options:
  --catalog-path <path>  Path to capability-catalog.data.json (default: docs/specs/capability-catalog.data.json)
  --journey <name>       Filter by journey name (e.g., onboarding, core-loop)
  --status <status>      Filter by gap status: COVERED, PARTIAL, MISSING
  --kano <type>          Filter by Kano type: must-be, one-dimensional, attractive, indifferent, reverse
  --convergence <type>   Filter by convergence velocity: stable, growing, explosive, declining
  --category <name>      Filter by capability category
  --min-bps <n>          Minimum Build Priority Score (integer)
  --sort <field>         Sort field: bps (default), name, frequency, maturity
  --limit <n>            Max results (default: 0 = all)
  --depth <n>            Max capability depth tier to include: 1-4 (default: 4 = all)
  --markdown             Output markdown table instead of JSON
  --query <preset>       Shorthand preset: gaps, converging, top-p0, journey-scaffold
  --help                 Show this help

Presets:
  gaps          --status MISSING --sort bps
  converging    --convergence explosive --sort bps
  top-p0        --min-bps 25 --sort bps
  journey-scaffold --status MISSING --kano must-be --sort bps --limit 20
`);
  process.exit(0);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    catalogPath: 'docs/specs/capability-catalog.data.json',
    journey: null,
    status: null,
    kano: null,
    convergence: null,
    category: null,
    minBps: null,
    sort: 'bps',
    limit: 0,
    depth: 4,
    markdown: false,
    query: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case '--catalog-path': opts.catalogPath = next; i++; break;
      case '--journey': opts.journey = next; i++; break;
      case '--status': opts.status = next?.toUpperCase(); i++; break;
      case '--kano': opts.kano = next; i++; break;
      case '--convergence': opts.convergence = next; i++; break;
      case '--category': opts.category = next; i++; break;
      case '--min-bps': opts.minBps = parseInt(next, 10); i++; break;
      case '--sort': opts.sort = next; i++; break;
      case '--limit': opts.limit = parseInt(next, 10); i++; break;
      case '--depth': opts.depth = parseInt(next, 10); i++; break;
      case '--markdown': opts.markdown = true; break;
      case '--query': opts.query = next; i++; break;
      case '--help': opts.help = true; break;
    }
  }
  return opts;
}

function applyQueryPreset(opts) {
  if (!opts.query) return opts;
  const presets = {
    gaps: { ...opts, status: 'MISSING', sort: 'bps' },
    converging: { ...opts, convergence: 'explosive', sort: 'bps' },
    'top-p0': { ...opts, minBps: 25, sort: 'bps' },
    'journey-scaffold': { ...opts, status: 'MISSING', kano: 'must-be', sort: 'bps', limit: 20 },
  };
  if (!presets[opts.query]) {
    console.error(`Unknown preset: ${opts.query}`);
    console.error(`Known presets: ${Object.keys(presets).join(', ')}`);
    process.exit(1);
  }
  return presets[opts.query];
}

function loadCatalog(catalogPath) {
  const fullPath = resolve(catalogPath);
  if (!existsSync(fullPath)) {
    console.error(`Catalog not found: ${fullPath}`);
    process.exit(1);
  }
  try {
    const raw = readFileSync(fullPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to parse catalog: ${e.message}`);
    process.exit(1);
  }
}

function filterCapabilities(catalog, opts) {
  let caps = catalog.capabilities || [];

  // Build a quick lookup for gap status and journey mappings
  const gapMap = new Map((catalog.gap_report || []).map(g => [g.capability_id, g]));
  const journeyMap = new Map((catalog.journey_mappings || []).map(j => [j.capability_id, j]));

  if (opts.journey) {
    caps = caps.filter(c => {
      const j = journeyMap.get(c.id);
      return j && j.journey && j.journey.toLowerCase() === opts.journey.toLowerCase();
    });
  }

  if (opts.status) {
    caps = caps.filter(c => {
      const g = gapMap.get(c.id);
      return g && g.coverage_status === opts.status;
    });
  }

  if (opts.kano) {
    caps = caps.filter(c =>
      c.classification && c.classification.kano &&
      c.classification.kano.toLowerCase() === opts.kano.toLowerCase()
    );
  }

  if (opts.convergence) {
    caps = caps.filter(c =>
      c.classification && c.classification.convergence_velocity &&
      c.classification.convergence_velocity.toLowerCase() === opts.convergence.toLowerCase()
    );
  }

  if (opts.category) {
    caps = caps.filter(c =>
      c.category && c.category.toLowerCase() === opts.category.toLowerCase()
    );
  }

  if (opts.minBps !== null && !isNaN(opts.minBps)) {
    caps = caps.filter(c => (c.bps || 0) >= opts.minBps);
  }

  if (opts.depth !== null && !isNaN(opts.depth)) {
    caps = caps.filter(c => (c.depth || 1) <= opts.depth);
  }

  return { caps, gapMap, journeyMap };
}

function sortCapabilities(caps, sortField) {
  const sortKey = sortField.toLowerCase();
  const fieldMap = {
    bps: c => c.bps || 0,
    name: c => c.name || '',
    frequency: c => {
      const order = { universal: 5, common: 4, occasional: 3, rare: 2, emerging: 1 };
      return order[(c.classification?.frequency || '').toLowerCase()] || 0;
    },
    maturity: c => {
      const order = { enterprise: 5, growth: 4, mvp: 3, prototype: 2, experimental: 1 };
      return order[(c.classification?.maturity || '').toLowerCase()] || 0;
    },
  };
  const getter = fieldMap[sortKey] || fieldMap.bps;
  return [...caps].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (typeof av === 'number' && typeof bv === 'number') return bv - av; // desc for numeric
    return String(av).localeCompare(String(bv));
  });
}

function outputJson(caps, gapMap, journeyMap, catalog) {
  const enriched = caps.map(c => ({
    ...c,
    gap: gapMap.get(c.id) || null,
    journey: journeyMap.get(c.id) || null,
  }));
  console.log(JSON.stringify({
    query_summary: {
      total_in_catalog: (catalog.capabilities || []).length,
      matched: enriched.length,
    },
    capabilities: enriched,
  }, null, 2));
}

function outputMarkdown(caps, gapMap, journeyMap, catalog) {
  console.log(`# Capability Query Results`);
  console.log();
  console.log(`**Total in catalog:** ${(catalog.capabilities || []).length}  `);
  console.log(`**Matched:** ${caps.length}`);
  console.log();

  if (caps.length === 0) {
    console.log('No capabilities matched the query.');
    return;
  }

  console.log('| # | Capability | Depth | Category | Kano | Freq | Conv. | BPS | Status | Journey |');
  console.log('|---|-----------|-------|----------|------|------|-------|-----|--------|---------|');

  caps.forEach((c, idx) => {
    const g = gapMap.get(c.id);
    const j = journeyMap.get(c.id);
    console.log(
      `| ${idx + 1} | ${c.name} | ${c.depth || '—'} | ${c.category || '—'} | ` +
      `${(c.classification?.kano || '—')} | ${(c.classification?.frequency || '—')} | ` +
      `${(c.classification?.convergence_velocity || '—')} | ${c.bps || '—'} | ` +
      `${g?.coverage_status || '—'} | ${j?.journey || '—'} |`
    );
  });
}

function main() {
  const rawOpts = parseArgs();
  if (rawOpts.help) usage();

  const opts = applyQueryPreset(rawOpts);
  const catalog = loadCatalog(opts.catalogPath);
  const { caps, gapMap, journeyMap } = filterCapabilities(catalog, opts);
  const sorted = sortCapabilities(caps, opts.sort);
  const limited = opts.limit > 0 ? sorted.slice(0, opts.limit) : sorted;

  if (opts.markdown) {
    outputMarkdown(limited, gapMap, journeyMap, catalog);
  } else {
    outputJson(limited, gapMap, journeyMap, catalog);
  }
}

main();
