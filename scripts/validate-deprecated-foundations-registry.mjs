#!/usr/bin/env node

import path from "node:path";
import { defaultRegistryPath, loadRegistry, validateRegistry } from "./lib/deprecated-foundations.mjs";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    registry: null,
    now: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = path.resolve(argv[++i]);
    else if (arg === "--registry") args.registry = path.resolve(args.root, argv[++i]);
    else if (arg === "--now") args.now = argv[++i];
    else if (arg === "-h" || arg === "--help") args.help = true;
  }
  return args;
}

function usage() {
  return [
    "Usage: node scripts/validate-deprecated-foundations-registry.mjs [--root <dir>] [--registry <file>] [--now <ISO-date>]",
    "",
    "Validates deprecated-foundations registry shape and freshness metadata."
  ].join("\n");
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const registryPath = args.registry || defaultRegistryPath(args.root);
let registry;
try {
  registry = loadRegistry(registryPath);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const errors = validateRegistry(registry, { registryPath, now: args.now });
if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`PASS: deprecated foundations registry fresh (${registryPath})`);
