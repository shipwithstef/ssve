#!/usr/bin/env node
/**
 * Auto-assign depth tiers to capabilities based on classification rules.
 * Reads a catalog file, applies depth rules, writes back with depth + parent fields.
 *
 * Usage:
 *   node assign-capability-depth.mjs --catalog docs/specs/capability-catalog.data.json
 *   node assign-capability-depth.mjs --catalog docs/specs/capability-catalog.data.json --dry-run
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { catalog: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--catalog') { opts.catalog = next; i++; }
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

function assignDepth(cap) {
  const freq = (cap.classification?.frequency || cap.frequency || '').toLowerCase();
  const kano = (cap.classification?.kano || cap.kano || '').toLowerCase();
  const deps = cap.dependencies || [];
  const conv = (cap.classification?.convergence_velocity || cap.convergence_velocity || '').toLowerCase();

  // L1: universal + must-be/one-dimensional + no dependencies
  if (freq === 'universal' && deps.length === 0 && (kano === 'must-be' || kano === 'one-dimensional')) {
    return 1;
  }

  // L2: common frequency OR depends on L1 capabilities
  if (freq === 'common') return 2;

  // L3: occasional/rare OR explosive convergence OR depends on L2
  if (freq === 'occasional' || freq === 'rare' || conv === 'explosive') return 3;

  // L4: everything else (edge cases, implementation patterns)
  return 4;
}

function findParent(cap, allCaps) {
  const deps = cap.dependencies || [];
  if (deps.length === 0) return null;
  // Return the first dependency that exists in the catalog
  for (const depId of deps) {
    const found = allCaps.find(c => (c.capability_id || c.id) === depId);
    if (found) return depId;
  }
  return null;
}

function main() {
  const opts = parseArgs();
  if (!opts.catalog) {
    console.error('Usage: node assign-capability-depth.mjs --catalog <path> [--dry-run]');
    process.exit(1);
  }

  const catalog = loadCatalog(opts.catalog);
  const allCaps = catalog.capabilities || [];
  const stats = { 1: 0, 2: 0, 3: 0, 4: 0, changed: 0 };

  for (const cap of allCaps) {
    const oldDepth = cap.depth;
    const newDepth = assignDepth(cap);
    cap.depth = newDepth;
    stats[newDepth]++;

    if (oldDepth !== undefined && oldDepth !== newDepth) {
      console.log(`  Changed: ${cap.name || cap.capability_id || cap.id}: depth ${oldDepth} → ${newDepth}`);
      stats.changed++;
    } else if (oldDepth === undefined) {
      console.log(`  Assigned: ${cap.name || cap.capability_id || cap.id}: depth ${newDepth}`);
      stats.changed++;
    }

    // Auto-assign parent if dependencies exist and no parent is set
    if (!cap.parent_capability_id && (cap.dependencies || []).length > 0) {
      const parent = findParent(cap, allCaps);
      if (parent) {
        cap.parent_capability_id = parent;
        console.log(`  Parent: ${cap.name || cap.capability_id || cap.id} → ${parent}`);
      }
    }
  }

  console.log(`\nDepth distribution: L1=${stats[1]}, L2=${stats[2]}, L3=${stats[3]}, L4=${stats[4]}`);
  console.log(`Total changed/assigned: ${stats.changed}`);

  if (!opts.dryRun) {
    writeFileSync(resolve(opts.catalog), JSON.stringify(catalog, null, 2));
    console.log(`Wrote updated catalog to ${opts.catalog}`);
  } else {
    console.log('(dry-run: no files written)');
  }
}

main();
