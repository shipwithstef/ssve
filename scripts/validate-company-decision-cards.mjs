#!/usr/bin/env node
/**
 * validate-company-decision-cards (WI-409): validate a fleet decisions JSONL file
 * against schemas/company-decision-card.schema.json. Dependency-free — implements the
 * small JSON-Schema subset the card schema uses (type, required, enum, pattern,
 * minimum/maximum, minLength, additionalProperties:false, items, properties).
 *
 * Usage: node scripts/validate-company-decision-cards.mjs --file <decisions-pending.jsonl>
 *                                                        [--schema <path>]
 * Exit 0 = all lines valid (or file empty); 1 = a line is invalid / file missing.
 * This validates RUNTIME data in a company repo, NOT framework files — it is a tool
 * for the fleet/owner, deliberately NOT a tier-1 validator.
 */
import { readFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const file = get("--file");
const schemaPath = get("--schema") || "schemas/company-decision-card.schema.json";

if (!file) { console.error("usage: --file <jsonl> [--schema <path>]"); process.exit(1); }
if (!existsSync(file)) { console.error(`✗ file not found: ${file}`); process.exit(1); }
if (!existsSync(schemaPath)) { console.error(`✗ schema not found: ${schemaPath}`); process.exit(1); }

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

function typeOf(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v === "object" ? "object" : typeof v; // number|string|boolean
}

// Returns array of error strings for value `v` against subschema `s` at json-path `p`.
function check(v, s, p) {
  const errs = [];
  if (s.type) {
    const t = typeOf(v);
    const ok = s.type === "number" ? t === "number" : t === s.type;
    if (!ok) { errs.push(`${p}: expected ${s.type}, got ${t}`); return errs; }
  }
  if (s.enum && !s.enum.includes(v)) errs.push(`${p}: '${v}' not in [${s.enum.join(", ")}]`);
  if (s.pattern && typeof v === "string" && !new RegExp(s.pattern).test(v)) errs.push(`${p}: '${v}' fails /${s.pattern}/`);
  if (s.minLength != null && typeof v === "string" && v.length < s.minLength) errs.push(`${p}: shorter than ${s.minLength}`);
  if (s.minimum != null && typeof v === "number" && v < s.minimum) errs.push(`${p}: < ${s.minimum}`);
  if (s.maximum != null && typeof v === "number" && v > s.maximum) errs.push(`${p}: > ${s.maximum}`);
  if (s.type === "object" && typeOf(v) === "object") {
    for (const req of s.required || []) if (!(req in v)) errs.push(`${p}: missing required '${req}'`);
    if (s.additionalProperties === false) {
      for (const k of Object.keys(v)) if (!(s.properties && k in s.properties)) errs.push(`${p}.${k}: unknown property`);
    }
    for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) errs.push(...check(v[k], sub, `${p}.${k}`));
  }
  if (s.type === "array" && Array.isArray(v) && s.items) v.forEach((it, i) => errs.push(...check(it, s.items, `${p}[${i}]`)));
  return errs;
}

const lines = readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
let bad = 0;
lines.forEach((line, i) => {
  let card;
  try { card = JSON.parse(line); }
  catch { console.error(`✗ line ${i + 1}: invalid JSON`); bad++; return; }
  const errs = check(card, schema, card.id || `line${i + 1}`);
  if (errs.length) { bad++; console.error(`✗ ${card.id || `line ${i + 1}`}:`); errs.forEach((e) => console.error(`    ${e}`)); }
});

if (lines.length === 0) { console.log(`✓ ${file}: no cards (ok)`); process.exit(0); }
if (bad) { console.error(`\n${bad}/${lines.length} card(s) invalid`); process.exit(1); }
console.log(`✓ ${file}: ${lines.length}/${lines.length} card(s) valid`);
process.exit(0);
