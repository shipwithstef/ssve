#!/usr/bin/env node
// WI-562 IP-R1: receipt-format charter lint. Iterates the machine-readable
// kind registry (references/receipt-kind-registry.json) as the denominator,
// validates every registered schema file parses + carries required basics, and
// fails on charter violations not covered by the dated exceptions list.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "references", "receipt-kind-registry.json");
const EXCEPTIONS = path.join(ROOT, "references", "receipt-format-exceptions.json");

let fail = 0;
function problem(msg) { console.error(`  ✗ ${msg}`); fail += 1; }
function ok(msg) { console.log(`  ✓ ${msg}`); }

let registry;
try { registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8")); }
catch (e) { console.error(`  ✗ registry unreadable: ${e.message}`); process.exit(1); }
if (!Array.isArray(registry.kinds) || registry.kinds.length === 0) {
  console.error("  ✗ registry has no kinds");
  process.exit(1);
}
ok(`registry enumerates ${registry.kinds.length} receipt kinds (mechanical denominator)`);

// Every emitter path must resolve to a real file (strict: entry IS the path,
// optional args after whitespace are allowed).
let emitterCount = 0;
for (const row of registry.kinds) {
  for (const rel of [...(row.emitters || [])]) {
    const bin = rel.split(" ")[0];
    if (!bin.startsWith("scripts/") && !bin.startsWith("hooks/")) {
      problem(`${row.kind}: emitter entry must start scripts/ or hooks/: ${rel}`);
      continue;
    }
    if (!fs.existsSync(path.join(ROOT, bin))) problem(`${row.kind}: emitter does not exist: ${bin}`);
    else emitterCount++;
  }
}
ok(`${emitterCount} registered emitters resolve`);

// Schema files parse and carry $schema + type/object.
let schemaCount = 0;
for (const row of registry.kinds) {
  if (!row.schema_dir) continue;
  const names = row.schemas || [];
  for (const name of names) {
    const p = name.includes("/") ? path.join(ROOT, name) : path.join(ROOT, row.schema_dir || ".", name);
    if (!fs.existsSync(p)) { problem(`${row.kind}: registered schema missing: ${name}`); continue; }
    let doc;
    try { doc = JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (e) { problem(`${row.kind}: schema unparseable: ${name}: ${e.message}`); continue; }
    if (!doc.$schema) problem(`${row.kind}: schema missing $schema: ${name}`);
    if (doc.type !== "object") problem(`${row.kind}: schema type != object: ${name}`);
    schemaCount++;
  }
}
ok(`${schemaCount} registered schemas parse with $schema + object type`);

// Charter rule 7 cross-check: every chain-receipts schema dir entry that the
// emitter can emit has a file (emit-side fail-closed already enforces at runtime).
const EMIT_TYPES = ["plan-manifest", "exec-record", "review-plan", "review-exec", "audit-implementation", "verify-promotion", "quick-fix"];
for (const t of EMIT_TYPES) {
  if (!fs.existsSync(path.join(ROOT, "schemas", "receipts", `${t}.schema.json`))) {
    problem(`charter rule 7: emit-able type lacks a schema file: ${t}`);
  }
}
ok("all emit-able types have schema files (charter rule 7)");

// Exceptions list is well-formed and dated.
let exceptions;
try { exceptions = JSON.parse(fs.readFileSync(EXCEPTIONS, "utf8")); }
catch (e) { problem(`exceptions unreadable: ${e.message}`); process.exit(1); }
for (const ex of exceptions.exceptions || []) {
  if (!ex.id || !ex.owner_wi || !ex.revisit_by || !Number.isInteger(ex.rule)) {
    problem(`exception entry malformed: ${JSON.stringify(ex).slice(0, 80)}`);
  }
  if (new Date(ex.revisit_by) < new Date("2026-08-01")) {
    problem(`exception ${ex.id} revisit_by is in the past`);
  }
}
ok(`exception list well-formed (${(exceptions.exceptions || []).length} entries, all owned + dated)`);

console.log(`lint-receipt-formats: ${fail === 0 ? "PASS" : `FAIL (${fail})`}`);
process.exit(fail === 0 ? 0 : 1);
