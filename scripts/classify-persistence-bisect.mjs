#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/classify-persistence-bisect.mjs --records <records.json>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--records") args.records = argv[++i];
    else usage();
  }
  if (!args.records) usage();
  return args;
}

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  throw new Error("records payload must be an array or contain records/data/items array");
}

const args = parseArgs(process.argv.slice(2));
const file = path.resolve(args.records);
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
const records = recordsFromPayload(payload);

if (records.length === 0) {
  console.log("CLASS_A_NOT_PERSISTED");
  console.log("records.length=0; investigate write response, RLS, schema allowlist, secureOperation, validation, transaction, idempotency.");
  process.exit(10);
}

console.log("CLASS_B_PERSISTED_UI_SCOPE");
console.log(`records.length=${records.length}; investigate scope/filter mismatch, cache key alignment, query enabled state, current-context resolution, helper-app query parity.`);
process.exit(0);
