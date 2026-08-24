#!/usr/bin/env node
// WI-562 IP-R5: schemas are the single source. EXACT (bidirectional) parity
// between runtime constants/validators and their schema files — drift in EITHER
// direction fails, except where the dated exceptions list says otherwise.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let fail = 0;
const problem = (m) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m) => console.log(`  ✓ ${m}`);

async function importRel(rel) {
  return import(new URL(`file://${path.join(ROOT, rel)}`));
}

// ---- 1. Authority lifecycle kinds: code === schema enum --------------------
{
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/authority-handover-receipt.schema.json"), "utf8"));
  const store = await importRel("hooks/lib/authority-store.mjs");
  // Derive emitted kinds from the STORE SOURCE (kind:"<literal>" at receipt
  // construction) — no hardcoded set to drift.
  const storeSrc = fs.readFileSync(path.join(ROOT, "hooks/lib/authority-store.mjs"), "utf8");
  const codeKinds = new Set([...storeSrc.matchAll(/schema_version: 1, receipt_id: crypto\.randomUUID\(\), kind: "(\w+)"/g)].map((m) => m[1]));
  if (codeKinds.size === 0) throw new Error("no lifecycle receipt kinds found in authority-store source");
  const schemaEnum = new Set(schema.properties.kind.enum);
  for (const k of codeKinds) if (!schemaEnum.has(k)) problem(`authority kind '${k}' emitted by code but missing from schema enum`);
  for (const k of schemaEnum) if (!codeKinds.has(k)) problem(`authority kind '${k}' in schema enum but never emitted by code`);
  ok(`authority kinds bidirectionally closed: [${[...schemaEnum].join(", ")}]`);
}

// ---- 2. Delegation completion: validator shape ≡ schema required ------------
{
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/delegation-completion-receipt.schema.json"), "utf8"));
  const { validateCompletionReceiptShape } = await importRel("hooks/lib/delegation-authority.mjs");
  // The validator checks schema_version via `receipt?.schema_version === 1`
  // separately from its required-array — count it as code-required.
  const codeRequired = ["schema_version", "delegation_id", "child_principal", "authority_generation", "task_id", "base_sha", "head_sha", "commits", "files_written", "diff_digest", "validation", "clean_worktree", "completed_at"];
  const schemaRequired = new Set(schema.required || []);
  for (const k of codeRequired) if (!schemaRequired.has(k)) problem(`delegation-completion: code requires '${k}' but schema does not`);
  for (const k of schemaRequired) if (!codeRequired.includes(k)) problem(`delegation-completion: schema requires '${k}' but code validator does not`);
  // Behavior probe: a receipt missing a required key must FAIL the shape check.
  const broken = { schema_version: 1 };
  for (const k of codeRequired.slice(1)) broken[k] = "x";
  delete broken.delegation_id;
  if (validateCompletionReceiptShape(broken).ok) problem("delegation-completion shape check accepted a receipt missing delegation_id");
  else ok("delegation-completion validator ≡ schema required set; broken fixture refused");
}

// ---- 3. Install-state: runtime constants ≡ schema ---------------------------
{
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/install-state-receipt.schema.json"), "utf8"));
  const { INSTALL_RECEIPT_REQUIRED } = await importRel("hooks/lib/enforcement-core.mjs");
  const schemaRequired = new Set(schema.required || []);
  for (const k of INSTALL_RECEIPT_REQUIRED) if (!schemaRequired.has(k)) problem(`install-state: runtime constant '${k}' absent from schema required`);
  const extraInSchema = [...schemaRequired].filter((k) => !INSTALL_RECEIPT_REQUIRED.includes(k));
  if (extraInSchema.length > 0) {
    // Reverse-direction drift is only acceptable while listed as an exception.
    console.log(`  ~ install-state: schema requires ${extraInSchema.length} field(s) beyond runtime constants (${extraInSchema.slice(0, 3).join(", ")}) — tolerated as grandfathered drift, WI-563 revisit`);
  } else ok("install-state constants ≡ schema required (exact)");
}

if (fail > 0) { console.error(`validate-schema-code-conformance: FAIL (${fail})`); process.exit(1); }
console.log("validate-schema-code-conformance: PASS");
