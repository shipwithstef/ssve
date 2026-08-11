#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const OPS = ["create", "read", "update", "delete"];

function usage() {
  console.error("Usage: node scripts/audit-base44-entity-rls.mjs [--root <repo>] [--entities-dir <dir>] [--app-config <json>] [--out-md <file>] [--out-json <file>]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { root: process.cwd(), entitiesDir: null, appConfig: null, outMd: null, outJson: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") args.root = argv[++i];
    else if (token === "--entities-dir") args.entitiesDir = argv[++i];
    else if (token === "--app-config") args.appConfig = argv[++i];
    else if (token === "--out-md") args.outMd = argv[++i];
    else if (token === "--out-json") args.outJson = argv[++i];
    else usage();
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseMaybeJson(value) {
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function findEntitiesDir(root, explicit) {
  const candidates = explicit
    ? [explicit]
    : ["base44/entities", "entities", "src/entities"].map((rel) => path.join(root, rel));
  return candidates.map((p) => path.resolve(root, p)).find((p) => fs.existsSync(p) && fs.statSync(p).isDirectory());
}

function loadEntities(args) {
  const root = path.resolve(args.root);
  const entities = [];
  if (args.appConfig) {
    const cfg = readJson(path.resolve(root, args.appConfig));
    for (const [name, rawSchema] of Object.entries(cfg.entities || {})) {
      entities.push({ name, schema: parseMaybeJson(rawSchema), source: args.appConfig });
    }
  }
  const dir = findEntitiesDir(root, args.entitiesDir);
  if (dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const file = path.join(dir, entry.name);
      const name = path.basename(entry.name, ".json");
      const existing = entities.find((e) => e.name === name);
      const schema = readJson(file);
      if (existing) Object.assign(existing, { schema, source: path.relative(root, file) });
      else entities.push({ name, schema, source: path.relative(root, file) });
    }
  }
  return entities.sort((a, b) => a.name.localeCompare(b.name));
}

function walk(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if ([".git", "node_modules", ".worktrees"].includes(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function textFiles(root) {
  return walk(root).filter((file) => /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte)$/.test(file));
}

function fileText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function callerSignals(root, entityName) {
  const files = textFiles(root);
  let frontendCallers = 0;
  let backendCallers = 0;
  let serviceRoleCallers = 0;
  const direct = new RegExp(`\\bentities\\.${entityName}\\b`, "g");
  const service = new RegExp(`\\basServiceRole\\.entities\\.${entityName}\\b`, "g");
  for (const file of files) {
    const rel = path.relative(root, file).replaceAll(path.sep, "/");
    const text = fileText(file);
    const serviceCount = [...text.matchAll(service)].length;
    const directCount = Math.max(0, [...text.matchAll(direct)].length - serviceCount);
    if (directCount === 0 && serviceCount === 0) continue;
    if (rel.startsWith("base44/functions/") || rel.includes("/functions/")) backendCallers += directCount + serviceCount;
    else frontendCallers += directCount;
    serviceRoleCallers += serviceCount;
  }
  return {
    frontend_callers: frontendCallers,
    backend_callers: backendCallers,
    service_role_callers: serviceRoleCallers,
    service_role_only: backendCallers > 0 && serviceRoleCallers >= backendCallers && frontendCallers === 0,
  };
}

function hasAnyKey(obj, keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(obj || {}, key));
}

function sensitivityTier(name, properties = {}) {
  const haystack = `${name} ${Object.keys(properties).join(" ")}`.toLowerCase();
  if (/(payment|bank|subscription|transaction|invoice|auth|user)/.test(haystack)) return "T1";
  if (/(message|conversation|audit|checkin|notification|email|phone)/.test(haystack)) return "T2";
  if (/(loyalty|point|promo|referral|wallet|credit)/.test(haystack)) return "T3";
  if (/(hour|deal|item|slot|location|exception|break|shift)/.test(haystack)) return "T4";
  if (/(review|vote|follow|comment)/.test(haystack)) return "T5";
  if (/(analytics|usage|event|log|aggregate)/.test(haystack)) return "T6";
  return "T4";
}

function ruleHasOwner(rule) {
  const text = JSON.stringify(rule || {}).toLowerCase();
  return /owner_id|user_id|user_email|created_by|createdby|author_id/.test(text);
}

function missingOps(rls) {
  if (!rls || typeof rls !== "object") return OPS;
  return OPS.filter((op) => !Object.prototype.hasOwnProperty.call(rls, op));
}

function malformedAndRule(rule) {
  return !!rule && typeof rule === "object" && !Array.isArray(rule) && hasAnyKey(rule, ["owner_id", "user_id", "user_email"]) && Object.prototype.hasOwnProperty.call(rule, "$or");
}

function deleteMorePermissive(rls) {
  if (!rls || typeof rls !== "object") return false;
  const update = JSON.stringify(rls.update || {});
  const del = JSON.stringify(rls.delete || {});
  return del === "{}" && update !== "{}";
}

function derivedOwnership(schema) {
  const props = schema.properties || {};
  const keys = Object.keys(props);
  const hasDirectOwner = keys.some((key) => /^(owner_id|user_id|user_email|created_by|createdBy|author_id)$/.test(key));
  const derivedKeys = keys.filter((key) => /_id$/.test(key) && !/^(owner_id|user_id|author_id)$/.test(key));
  if (hasDirectOwner || derivedKeys.length === 0) return { derived: false, keys: [], pattern: "direct-owner-or-public" };
  return {
    derived: true,
    keys: derivedKeys,
    pattern: "choose per entity: denormalized owner_id, defense-in-depth secureOperation, or function gateway",
  };
}

function recommendation(row) {
  if (!row.has_rls) return "Add RLS and probe exploitability before deploy.";
  if (row.issues.includes("malformed_and_rule")) return "Rewrite owner/admin conditions under a top-level $or, then re-probe.";
  if (row.derived_ownership.derived && !row.rls_has_owner_rule) return "Record derived ownership decision: denormalized owner, defense-in-depth secureOperation, or function gateway.";
  if (row.missing_operations.length > 0) return `Define missing operations: ${row.missing_operations.join(", ")}.`;
  return "Verify with before/after non-privileged probe and keep regression test.";
}

function auditEntity(root, entity) {
  const schema = entity.schema || {};
  const rls = schema.rls;
  const issues = [];
  const missing = missingOps(rls);
  const malformed = OPS.some((op) => malformedAndRule(rls?.[op]));
  if (!rls || (typeof rls === "object" && Object.keys(rls).length === 0)) issues.push("missing_rls");
  if (malformed) issues.push("malformed_and_rule");
  if (missing.length > 0) issues.push("missing_operations");
  if (JSON.stringify(rls?.read || null) === "{}") issues.push("open_read_review");
  if (deleteMorePermissive(rls)) issues.push("delete_more_permissive_than_update");

  const derived = derivedOwnership(schema);
  if (derived.derived) issues.push("derived_ownership");

  const callers = callerSignals(root, entity.name);
  const row = {
    entity: entity.name,
    source: entity.source,
    tier: sensitivityTier(entity.name, schema.properties || {}),
    has_rls: !!rls && typeof rls === "object" && Object.keys(rls).length > 0,
    missing_operations: missing,
    rls_has_owner_rule: ruleHasOwner(rls),
    derived_ownership: derived,
    ...callers,
    issues,
  };
  row.recommended_action = recommendation(row);
  return row;
}

function priority(row) {
  if (!row.has_rls && ["T1", "T2"].includes(row.tier)) return "P0";
  if (!row.has_rls || row.issues.includes("malformed_and_rule")) return "P1";
  if (row.issues.length > 0) return "P2";
  return "P3";
}

function deploymentScore(row) {
  return [
    row.frontend_callers,
    row.service_role_only ? 0 : 1,
    row.issues.includes("missing_rls") || row.issues.includes("malformed_and_rule") ? 0 : 1,
    row.tier,
    row.entity,
  ];
}

function compareScore(a, b) {
  const as = deploymentScore(a);
  const bs = deploymentScore(b);
  for (let i = 0; i < as.length; i += 1) {
    if (as[i] < bs[i]) return -1;
    if (as[i] > bs[i]) return 1;
  }
  return 0;
}

function markdown(rows) {
  const ranked = [...rows].sort(compareScore);
  const lines = [
    "# Base44 Entity RLS Audit",
    "",
    "| Entity | Tier | Has RLS | Issues | Frontend callers | Service-role only | Recommended action | Priority |",
    "|---|---|---:|---|---:|---:|---|---|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.entity} | ${row.tier} | ${row.has_rls ? "yes" : "no"} | ${row.issues.join(", ") || "none"} | ${row.frontend_callers} | ${row.service_role_only ? "yes" : "no"} | ${row.recommended_action} | ${priority(row)} |`);
  }
  lines.push("", "## Deployment Order", "");
  lines.push("Ranked by frontend caller count, then service-role-only safety, then exploitable/missing-rule signal.");
  lines.push("");
  ranked.forEach((row, index) => {
    lines.push(`${index + 1}. ${row.entity} — callers=${row.frontend_callers}, service_role_only=${row.service_role_only}, priority=${priority(row)}`);
  });
  lines.push("", "## Derived Ownership Decisions", "");
  for (const row of rows.filter((r) => r.derived_ownership.derived)) {
    lines.push(`- ${row.entity}: ${row.derived_ownership.keys.join(", ")} -> ${row.derived_ownership.pattern}`);
  }
  return `${lines.join("\n")}\n`;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const entities = loadEntities(args);

if (entities.length === 0) {
  console.error("base44 entity RLS audit: FAIL - no entity schemas found");
  process.exit(1);
}

const rows = entities.map((entity) => auditEntity(root, entity));
const report = {
  generated_by: "audit-base44-entity-rls.mjs",
  entity_count: rows.length,
  rows,
  deployment_order: [...rows].sort(compareScore).map((row) => row.entity),
};

if (args.outJson) {
  const out = path.resolve(root, args.outJson);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
}

if (args.outMd) {
  const out = path.resolve(root, args.outMd);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, markdown(rows));
}

const issueCount = rows.reduce((sum, row) => sum + row.issues.length, 0);
console.log(`base44 entity RLS audit: PASS (${rows.length} entities, ${issueCount} issue(s))`);
if (issueCount > 0) {
  for (const row of rows.filter((r) => r.issues.length > 0)) {
    console.log(`  - ${row.entity}: ${row.issues.join(", ")}`);
  }
}
