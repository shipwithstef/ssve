#!/usr/bin/env node
/**
 * Split a merged capability catalog into tiered depth files (L1-L4).
 * Writes to references/knowledge/domains/<domain>/CAPABILITY-CATALOG-L{N}.json
 *
 * Usage:
 *   node split-catalog-by-depth.mjs --catalog docs/specs/capability-catalog.data.json --domain fintech
 *   node split-catalog-by-depth.mjs --catalog docs/specs/capability-catalog.data.json --domain fintech --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const DOMAINS_DIR = resolve('references/knowledge/domains');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { catalog: null, domain: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--catalog') { opts.catalog = next; i++; }
    else if (arg === '--domain') { opts.domain = next; i++; }
    else if (arg === '--dry-run') { opts.dryRun = true; }
  }
  return opts;
}

function loadCatalog(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`Catalog not found: ${full}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(full, 'utf-8'));
}

function extractTier(catalog, depth) {
  const tierCaps = (catalog.capabilities || []).filter(c => (c.depth || 1) === depth);
  return {
    meta: {
      generated: catalog.meta?.generated || new Date().toISOString().split('T')[0],
      domain: catalog.meta?.domain || 'unknown',
      depth_tier: depth,
      total_capabilities: tierCaps.length,
      source: catalog.meta?.source_skills || ['catalog-domain-capabilities'],
    },
    capabilities: tierCaps,
    // Include only journey_scaffolding entries that reference capabilities in this tier
    journey_scaffolding: (catalog.journey_scaffolding || []).filter(js =>
      tierCaps.some(c => (c.capability_id || c.id) === js.journey)
    ),
    // convergence_alerts for capabilities in this tier
    convergence_alerts: (catalog.convergence_alerts || []).filter(ca =>
      tierCaps.some(c => (c.capability_id || c.id) === ca.capability_id)
    ),
    build_priority_ranking: (catalog.build_priority_ranking || []).filter(pr =>
      tierCaps.some(c => (c.capability_id || c.id) === pr.capability_id)
    ),
  };
}

function main() {
  const opts = parseArgs();
  if (!opts.catalog || !opts.domain) {
    console.error('Usage: node split-catalog-by-depth.mjs --catalog <path> --domain <name> [--dry-run]');
    process.exit(1);
  }

  const catalog = loadCatalog(opts.catalog);
  const outDir = resolve(DOMAINS_DIR, opts.domain);

  if (!opts.dryRun) {
    mkdirSync(outDir, { recursive: true });
  }

  for (let depth = 1; depth <= 4; depth++) {
    const tier = extractTier(catalog, depth);
    const outPath = resolve(outDir, `CAPABILITY-CATALOG-L${depth}.json`);

    console.log(`L${depth}: ${tier.capabilities.length} capabilities → ${outPath}`);

    if (!opts.dryRun) {
      writeFileSync(outPath, JSON.stringify(tier, null, 2));
    }
  }

  // Write meta file
  const metaPath = resolve(outDir, 'CAPABILITY-CATALOG-meta.json');
  const meta = {
    domain: opts.domain,
    version: catalog.meta?.generated || new Date().toISOString().split('T')[0],
    total_by_depth: {
      1: (catalog.capabilities || []).filter(c => (c.depth || 1) === 1).length,
      2: (catalog.capabilities || []).filter(c => (c.depth || 1) === 2).length,
      3: (catalog.capabilities || []).filter(c => (c.depth || 1) === 3).length,
      4: (catalog.capabilities || []).filter(c => (c.depth || 1) === 4).length,
    },
  };
  console.log(`Meta: ${JSON.stringify(meta.total_by_depth)} → ${metaPath}`);

  if (!opts.dryRun) {
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    console.log('\nWrote all tier files.');
  } else {
    console.log('\n(dry-run: no files written)');
  }
}

main();
