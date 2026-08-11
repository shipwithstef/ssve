#!/usr/bin/env node
/**
 * Merge tiered capability catalog files (L1-L4) into a single catalog.
 * Reads references/knowledge/domains/<domain>/CAPABILITY-CATALOG-L{1-4}.json
 * and produces a merged JSON with all capabilities up to the requested depth.
 *
 * Usage:
 *   node merge-tiered-catalog.mjs --domain fintech --depth 2 --output /tmp/merged.json
 *   node merge-tiered-catalog.mjs --domain fintech --depth 4 --output docs/specs/capability-catalog.data.json
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const DOMAINS_DIR = resolve('references/knowledge/domains');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { domain: null, depth: 4, output: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--domain') { opts.domain = next; i++; }
    else if (arg === '--depth') { opts.depth = parseInt(next, 10); i++; }
    else if (arg === '--output') { opts.output = next; i++; }
  }
  return opts;
}

function loadTier(domain, depth) {
  const path = resolve(DOMAINS_DIR, domain, `CAPABILITY-CATALOG-L${depth}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    console.error(`Failed to parse ${path}: ${e.message}`);
    return null;
  }
}

function main() {
  const opts = parseArgs();
  if (!opts.domain) {
    console.error('Usage: node merge-tiered-catalog.mjs --domain <name> [--depth 1-4] [--output <path>]');
    process.exit(1);
  }

  const merged = {
    meta: {
      generated: new Date().toISOString().split('T')[0],
      domain: opts.domain,
      source_skills: ['catalog-domain-capabilities'],
      total_capabilities: 0,
      depth_loaded: opts.depth,
    },
    capabilities: [],
    journey_scaffolding: [],
    gap_report: [],
    convergence_alerts: [],
    build_priority_ranking: [],
    zombie_capabilities: [],
  };

  const seenIds = new Set();

  for (let d = 1; d <= opts.depth; d++) {
    const tier = loadTier(opts.domain, d);
    if (!tier) {
      console.error(`Warning: L${d} not found for domain ${opts.domain}`);
      continue;
    }

    for (const cap of tier.capabilities || []) {
      if (!seenIds.has(cap.capability_id || cap.id)) {
        seenIds.add(cap.capability_id || cap.id);
        merged.capabilities.push(cap);
      }
    }

    // Merge non-capability arrays (allow duplicates for now)
    merged.journey_scaffolding.push(...(tier.journey_scaffolding || []));
    merged.gap_report.push(...(tier.gap_report || []));
    merged.convergence_alerts.push(...(tier.convergence_alerts || []));
    merged.build_priority_ranking.push(...(tier.build_priority_ranking || []));
    merged.zombie_capabilities.push(...(tier.zombie_capabilities || []));
  }

  merged.meta.total_capabilities = merged.capabilities.length;

  if (opts.output) {
    writeFileSync(opts.output, JSON.stringify(merged, null, 2));
    console.log(`Merged ${merged.capabilities.length} capabilities from L1-L${opts.depth} → ${opts.output}`);
  } else {
    console.log(JSON.stringify(merged, null, 2));
  }
}

main();
