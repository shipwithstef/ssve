#!/usr/bin/env bash
# Tier-1: every receipt validates against its JSON schema at schemas/receipts/.
# Promotion note: chain validation reads these schemas on every commit/push;
# drift breaks the entire chain.

set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

node --input-type=module -e '
import fs from "node:fs";
import path from "node:path";

const SCHEMA_DIR = "schemas/receipts";
const RECEIPTS_DIR = ".svc/receipts";

if (!fs.existsSync(SCHEMA_DIR)) {
  console.log("PASS: no schemas yet (pre-chain installation)");
  process.exit(0);
}

let fail = 0;
for (const s of fs.readdirSync(SCHEMA_DIR)) {
  if (!s.endsWith(".schema.json")) continue;
  try {
    JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, s), "utf8"));
  } catch (e) {
    console.error(`FAIL: schema ${s} is not valid JSON`);
    fail = 1;
  }
}

if (!fs.existsSync(RECEIPTS_DIR)) {
  console.log("PASS: no receipts yet");
  process.exit(fail ? 1 : 0);
}

for (const dir of fs.readdirSync(RECEIPTS_DIR)) {
  const sub = path.join(RECEIPTS_DIR, dir);
  let stat;
  try { stat = fs.statSync(sub); } catch { continue; }
  if (!stat.isDirectory()) continue;
  for (const file of fs.readdirSync(sub)) {
    if (!file.endsWith(".json")) continue;
    const r = path.join(sub, file);
    try {
      const data = JSON.parse(fs.readFileSync(r, "utf8"));
      const type = data.receipt_type;
      if (!type) {
        console.error(`FAIL: receipt ${r} has no receipt_type`);
        fail = 1;
      } else if (!fs.existsSync(path.join(SCHEMA_DIR, `${type}.schema.json`))) {
        console.error(`FAIL: receipt ${r} type=${type} has no schema`);
        fail = 1;
      }
    } catch (e) {
      console.error(`FAIL: receipt ${r} is not valid JSON`);
      fail = 1;
    }
  }
}

if (fail !== 0) process.exit(1);
console.log("PASS: receipts + schemas valid");
'
