#!/usr/bin/env node
/**
 * compile-skill-router-index.mjs — WI-FW-SKILLS-ROUTING-01 Wave 1.
 *
 * Deterministic compiler for the skill-routing index (plan §4.2).
 *
 * Canonical inputs:
 *   skills-manifest.json           includedSkills + rulesRegistry
 *   skills/<name>/SKILL.md         frontmatter description + content hash
 *   concerns/REGISTRY.json         concern bindings (fingerprint input)
 *   references/skill-routing-overrides.json  aliases/triggers/policies/risk
 *
 * Output: references/skill-routing-index.json — byte-stable for identical
 * inputs (no wall-clock fields; sorted keys and entries). Any duplicate name,
 * missing SKILL.md, invalid invocation policy/risk, unknown override target,
 * or unresolved required_rules identifier fails compilation with a named
 * reason and non-zero exit.
 *
 * Usage:
 *   node scripts/compile-skill-router-index.mjs [--root <dir>] [--check]
 *     --check  recompile in memory and byte-compare against the committed
 *              artifact instead of writing it; exit 1 on drift.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const POLICIES = new Set(["required", "implicit-allowed", "suggest-only", "explicit-only"]);
const RISKS = new Set(["low", "medium", "high", "critical"]);
const OUTPUT_REL = "references/skill-routing-index.json";

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function readIfExists(file) {
  return fs.readFileSync(file);
}

function parseArgs(argv) {
  const args = { root: process.cwd(), check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--root") { args.root = path.resolve(argv[++i]); }
    else if (a === "--check") { args.check = true; }
    else fail(`unknown argument: ${a}`);
  }
  return args;
}

function fail(message) {
  process.stderr.write(`compile-skill-router-index: ${message}\n`);
  process.exit(2);
}

/** Extract the description scalar from a SKILL.md YAML frontmatter block.
 * Handles plain scalars plus `>-` / `|` folded blocks. No full YAML parser:
 * frontmatter descriptions are single-field prose by house convention. */
export function extractDescription(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!m) fail("missing YAML frontmatter");
  const lines = m[1].split(/\r?\n/);
  let collecting = false;
  const parts = [];
  for (const line of lines) {
    if (!collecting && /^description:\s*(.*)$/.test(line)) {
      const inline = line.replace(/^description:\s*/, "");
      if (/^(>[+-]?|\|[+-]?)\s*$/.test(inline)) { collecting = true; continue; }
      return stripQuotes(inline).trim();
    }
    if (collecting) {
      if (/^\S/.test(line)) break; // next top-level key ends the block
      parts.push(line.trim());
    }
  }
  const joined = parts.join(" ").trim();
  if (!joined) fail("frontmatter has no usable description");
  return joined;
}

function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

export function compile(root) {
  const manifestPath = path.join(root, "skills-manifest.json");
  const overridesPath = path.join(root, "references", "skill-routing-overrides.json");
  const registryPath = path.join(root, "concerns", "REGISTRY.json");

  const manifestBytes = readIfExists(manifestPath);
  const overridesBytes = readIfExists(overridesPath);
  const registryBytes = readIfExists(registryPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const overrides = JSON.parse(overridesBytes.toString("utf8"));
  JSON.parse(registryBytes.toString("utf8")); // fingerprint input only

  const included = manifest.includedSkills;
  if (!Array.isArray(included) || included.length === 0) fail("skills-manifest.json has no includedSkills array");

  // Duplicate-name detection at the source of truth.
  const seen = new Set();
  for (const name of included) {
    if (seen.has(name)) fail(`duplicate skill name in skills-manifest.json: ${name}`);
    seen.add(name);
  }

  const knownRules = new Set(
    (manifest.rulesRegistry?.entries || [])
      .map((e) => path.basename(e.path || "").replace(/\.md$/, ""))
      .filter(Boolean)
  );

  const knownSkills = new Set(included);
  const entries = Object.entries(overrides.entries || {});
  const overriddenNames = new Set();
  for (const [name, entry] of entries) {
    if (!knownSkills.has(name)) fail(`override targets unknown skill: ${name}`);
    if (overriddenNames.has(name)) fail(`duplicate override entry: ${name}`); // JSON.parse already dedups, belt-and-braces
    overriddenNames.add(name);
    if (entry.invocation_policy !== undefined && !POLICIES.has(entry.invocation_policy)) {
      fail(`${name}: invalid invocation_policy ${entry.invocation_policy}`);
    }
    if (entry.risk !== undefined && !RISKS.has(entry.risk)) {
      fail(`${name}: invalid risk ${entry.risk}`);
    }
    for (const rule of entry.required_rules || []) {
      if (!knownRules.has(rule)) fail(`${name}: required_rules references unresolvable rule id: ${rule}`);
    }
    for (const req of entry.requires || []) {
      if (!knownSkills.has(req)) fail(`${name}: requires unknown skill: ${req}`);
    }
  }

  const records = [];
  const aliasOwners = new Map();
  for (const name of [...included].sort()) {
    const rel = path.join("skills", name, "SKILL.md");
    const abs = path.join(root, rel);
    let raw;
    try {
      raw = fs.readFileSync(abs);
    } catch {
      fail(`included skill has no SKILL.md on disk: ${name}`);
    }
    let description;
    try {
      description = extractDescription(raw.toString("utf8"));
    } catch (e) {
      fail(`${name}: ${e.message}`);
    }
    const o = overrides.entries[name] || {};
    for (const alias of o.aliases || []) {
      const key = alias.trim().toLowerCase();
      if (!key) fail(`${name}: empty alias`);
      const owner = aliasOwners.get(key);
      if (owner && owner !== name) {
        fail(`alias collision: "${alias}" declared by both ${owner} and ${name}; explicit resolution would be ambiguous`);
      }
      aliasOwners.set(key, name);
    }
    records.push({
      skill: name,
      path: rel.split(path.sep).join("/"),
      content_hash: sha256(raw),
      description,
      aliases: o.aliases || [],
      positive_triggers: o.positive_triggers || [],
      negative_triggers: o.negative_triggers || [],
      domains: o.domains || [],
      actions: o.actions || [],
      objects: o.objects || [],
      repo_signals: o.repo_signals || [],
      lane_roles: o.lane_roles || [],
      invocation_policy: o.invocation_policy || "suggest-only",
      risk: o.risk || "low",
      requires: o.requires || [],
      required_rules: o.required_rules || [],
    });
  }

  return JSON.stringify(
    {
      schema_version: 1,
      compiled_from: {
        manifest_sha256: sha256(manifestBytes),
        overrides_sha256: sha256(overridesBytes),
        concern_registry_sha256: sha256(registryBytes),
      },
      skills: records,
    },
    null,
    2,
  ) + "\n";
}

/** Main entry: only when executed directly, not when imported as a library. */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const outAbs = path.join(args.root, OUTPUT_REL);

  if (args.check) {
    let committed;
    try {
      committed = fs.readFileSync(outAbs, "utf8");
    } catch {
      fail(`--check target missing: ${OUTPUT_REL} (run without --check to generate it)`);
    }
    const fresh = compile(args.root);
    if (fresh !== committed) {
      process.stderr.write("compile-skill-router-index: DRIFT detected between canonical inputs and committed index\n");
      process.stderr.write("  run: node scripts/compile-skill-router-index.mjs  then commit the regenerated artifact\n");
      process.exit(1);
    }
    process.stdout.write(`skill-routing-index: byte-stable (${committed.split("\n").length} lines)\n`);
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const tmp = `${outAbs}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, compile(args.root), { mode: 0o644 });
  fs.renameSync(tmp, outAbs);
  process.stdout.write(`compiled ${OUTPUT_REL}\n`);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
