#!/usr/bin/env node
/**
 * Load domain-specific BPS weight preset.
 * Reads references/knowledge/domains/DEFAULT-BPS-WEIGHTS.json
 * and emits the matching preset (or balanced default).
 *
 * Usage:
 *   node load-bps-weights.mjs --domain fintech
 *   node load-bps-weights.mjs --domain "developer tools"
 *   node load-bps-weights.mjs --list
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PRESETS_PATH = resolve('references/knowledge/domains/DEFAULT-BPS-WEIGHTS.json');

function normalizeDomain(input) {
  const lowered = input.toLowerCase().trim();
  const aliases = {
    'fintech': 'fintech',
    'financial': 'fintech',
    'finance': 'fintech',
    'banking': 'fintech',
    'healthcare': 'healthcare',
    'health': 'healthcare',
    'telemedicine': 'healthcare',
    'devtools': 'devtools',
    'developer tools': 'devtools',
    'dev tools': 'devtools',
    'saas': 'saas-b2b',
    'b2b saas': 'saas-b2b',
    'b2c saas': 'saas-b2c',
    'ecommerce': 'ecommerce',
    'e-commerce': 'ecommerce',
    'marketplace': 'marketplace',
    'ai': 'ai-ml',
    'ml': 'ai-ml',
    'ai/ml': 'ai-ml',
    'machine learning': 'ai-ml',
    'social': 'social',
    'social media': 'social',
    'consumer': 'saas-b2c',
  };
  return aliases[lowered] || 'balanced';
}

function loadPresets() {
  if (!existsSync(PRESETS_PATH)) {
    console.error(`Presets file not found: ${PRESETS_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(PRESETS_PATH, 'utf-8'));
  } catch (e) {
    console.error(`Failed to parse presets: ${e.message}`);
    process.exit(1);
  }
}

function listPresets(presets) {
  console.log('Available BPS weight presets:');
  console.log();
  for (const [key, val] of Object.entries(presets.presets || {})) {
    console.log(`  ${key.padEnd(12)} — ${val.description}`);
  }
  console.log();
  console.log(`Default: ${presets.default_preset}`);
}

function main() {
  const args = process.argv.slice(2);
  const domainFlag = args.indexOf('--domain');
  const listFlag = args.includes('--list');

  const presets = loadPresets();

  if (listFlag) {
    listPresets(presets);
    return;
  }

  let domain = 'balanced';
  if (domainFlag !== -1 && args[domainFlag + 1]) {
    domain = normalizeDomain(args[domainFlag + 1]);
  }

  const preset = presets.presets?.[domain];
  if (!preset) {
    console.error(`Unknown domain: ${domain}. Use --list to see presets.`);
    process.exit(1);
  }

  const output = {
    preset: domain,
    description: preset.description,
    weights: {
      frequency: preset.frequency,
      kano: preset.kano,
      moat: preset.moat,
      complexity: preset.complexity,
      convergence: preset.convergence,
    },
    notes: preset.notes || null,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
