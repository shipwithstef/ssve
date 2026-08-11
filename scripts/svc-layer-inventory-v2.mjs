#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/json-schema-validator.mjs";

const SCHEMA = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../schemas/canonical-layer-inventory-v2.schema.json", import.meta.url)), "utf8"));

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

function readCanonical(repoRoot, relative) {
  const absolute = path.join(repoRoot, relative);
  const bytes = fs.readFileSync(absolute);
  return { relative, bytes, json: JSON.parse(bytes), digest: digest(bytes) };
}

function benefit(value, fallback) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

export function loadCanonicalLayerDenominator(repoRoot = process.cwd()) {
  const skills = readCanonical(repoRoot, "skills-manifest.json");
  const stages = readCanonical(repoRoot, "references/stage-registry.json");
  const concerns = readCanonical(repoRoot, "concerns/REGISTRY.json");
  const gates = readCanonical(repoRoot, "references/canonical-gates.json");
  const hostDirectory = path.join(repoRoot, "provision", "hosts");
  const hostFiles = fs.readdirSync(hostDirectory).filter((name) => name.endsWith(".json")).sort();
  const hosts = hostFiles.map((name) => readCanonical(repoRoot, path.posix.join("provision/hosts", name)));
  const rows = [];

  for (const name of skills.json.includedSkills ?? []) {
    const meta = skills.json.skillMetadata?.[name] ?? {};
    rows.push({
      id: `skill:${name}`,
      kind: "SKILL",
      source_path: "skills-manifest.json",
      source_digest: skills.digest,
      unique_benefit: benefit(meta.description, `Runs the ${name} capability under its source contract.`),
      consumes: (meta.inputs ?? []).map(String),
      produces: (meta.outputs ?? []).map(String)
    });
  }

  for (const stage of stages.json.stages ?? []) {
    rows.push({
      id: `stage:${stage.key}`,
      kind: "STAGE",
      source_path: "references/stage-registry.json",
      source_digest: stages.digest,
      unique_benefit: `Owns ${stage.key} progression through ${stage.owner_skill ?? "the canonical stage adapter"}.`,
      consumes: (stage.lane_skills ?? []).map((item) => `skill:${item}`),
      produces: (stage.artifact_set_names ?? []).map((item) => `artifact-set:${item}`)
    });
  }

  for (const concern of concerns.json.concerns ?? []) {
    const handlers = concern.handled_by ?? {};
    rows.push({
      id: `concern:${concern.name}`,
      kind: "CONCERN",
      source_path: "concerns/REGISTRY.json",
      source_digest: concerns.digest,
      unique_benefit: `Detects and owns ${concern.severity} ${concern.domain} risk for ${concern.name}.`,
      consumes: (concern.fires_on ?? []).map((item) => `trigger:${item}`),
      produces: [...(handlers.required_rules ?? []), ...(handlers.required_skills ?? [])].map((item) => `obligation:${item}`)
    });
  }

  for (const entry of skills.json.ownersRegistry?.entries ?? []) {
    rows.push({
      id: `authority:owner:${entry.task_class}`,
      kind: "AUTHORITY",
      source_path: "skills-manifest.json",
      source_digest: skills.digest,
      unique_benefit: `Routes ${entry.task_class} authority to ${entry.owner_skill}.`,
      consumes: [`task-class:${entry.task_class}`],
      produces: [`skill:${entry.owner_skill}`]
    });
  }
  for (const gate of gates.json.gates ?? []) {
    rows.push({
      id: `authority:gate:${gate.id ?? gate.name}`,
      kind: "AUTHORITY",
      source_path: "references/canonical-gates.json",
      source_digest: gates.digest,
      unique_benefit: benefit(gate.purpose ?? gate.description, `Enforces canonical gate ${gate.id ?? gate.name}.`),
      consumes: [],
      produces: [`gate:${gate.id ?? gate.name}`]
    });
  }

  for (const host of hosts) {
    const manifest = host.json;
    rows.push({
      id: `host:${manifest.host}`,
      kind: "HOST",
      source_path: host.relative,
      source_digest: host.digest,
      unique_benefit: benefit(manifest.authority_capabilities?.reason, `Provides the declared ${manifest.name ?? manifest.host} capabilities without becoming workflow authority.`),
      consumes: Object.entries(manifest.capabilities ?? {}).filter(([, enabled]) => Boolean(enabled)).map(([name]) => `capability:${name}`),
      produces: [`authority:mutation:${manifest.authority_capabilities?.mutating_child_execution === true ? "contained-child" : "controller-only"}`]
    });
  }

  const ids = rows.map((row) => row.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error(`canonical registries contain duplicate layer ids: ${[...new Set(duplicates)].sort().join(",")}`);
  return {
    rows: rows.sort((left, right) => left.id.localeCompare(right.id)),
    source_digests: {
      skills: skills.digest,
      stages: stages.digest,
      concerns: concerns.digest,
      authorities: digest([skills.digest, gates.digest]),
      hosts: digest(hosts.map((host) => [host.relative, host.digest]))
    }
  };
}

export function compileCanonicalLayerInventory({ repoRoot = process.cwd(), decisions, generation = 1 }) {
  const errors = [];
  if (!Number.isInteger(generation) || generation < 1) errors.push("generation must be a positive integer");
  if (!decisions || typeof decisions !== "object" || Array.isArray(decisions)) errors.push("decisions must be an object keyed by canonical layer id");
  let denominator;
  try { denominator = loadCanonicalLayerDenominator(repoRoot); } catch (error) { return { valid: false, errors: [error.message] }; }
  const canonicalIds = new Set(denominator.rows.map((row) => row.id));
  const suppliedIds = Object.keys(decisions ?? {});
  for (const id of canonicalIds) {
    const decision = decisions?.[id];
    if (!decision || typeof decision.applicable !== "boolean" || !String(decision.reason ?? "").trim()) errors.push(`missing applicability decision for ${id}`);
  }
  for (const id of suppliedIds) if (!canonicalIds.has(id)) errors.push(`unknown caller-supplied layer ${id}`);
  if (errors.length) return { valid: false, errors: [...new Set(errors)].sort(), canonical_layer_count: canonicalIds.size };
  const layers = denominator.rows.map((row) => ({
    ...row,
    applicable: decisions[row.id].applicable,
    applicability_reason: String(decisions[row.id].reason).trim()
  }));
  const inventory = { schema_version: 2, generation, source_digests: denominator.source_digests, layers, inventory_digest: "" };
  inventory.inventory_digest = digest({ ...inventory, inventory_digest: undefined });
  const structural = validate(SCHEMA, inventory);
  return {
    valid: structural.valid,
    errors: structural.errors,
    inventory: structural.valid ? inventory : null,
    canonical_layer_count: layers.length,
    counts_by_kind: Object.fromEntries(["SKILL", "STAGE", "CONCERN", "AUTHORITY", "HOST"].map((kind) => [kind, layers.filter((row) => row.kind === kind).length]))
  };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--") || !argv[index + 1]) throw new Error(`invalid argument ${token}`);
    result[token.slice(2)] = argv[++index];
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.decisions) throw new Error("usage: svc-layer-inventory-v2.mjs --decisions <json> [--repo-root <path>] [--generation <n>]");
    const result = compileCanonicalLayerInventory({ repoRoot: args["repo-root"] ?? process.cwd(), decisions: JSON.parse(fs.readFileSync(args.decisions)), generation: args.generation ? Number(args.generation) : 1 });
    (result.valid ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }));
    process.exitCode = 2;
  }
}
