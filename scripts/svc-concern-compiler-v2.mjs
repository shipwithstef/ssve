#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const SEVERITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const MODES = new Set(["shadow", "enforce"]);
const SHA256 = /^[a-f0-9]{64}$/;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedHandlers(concern) {
  return {
    rules: [...new Set(concern?.handled_by?.required_rules ?? [])].sort(),
    skills: [...new Set(concern?.handled_by?.required_skills ?? [])].sort(),
    optional_skills: [...new Set(concern?.handled_by?.optional_skills ?? [])].sort()
  };
}

function validWaiver(waiver) {
  return waiver && nonEmpty(waiver.reason) && SHA256.test(waiver.authority_digest ?? "");
}

export function compileConcernObligations(registry, hits, options = {}) {
  const errors = [];
  const mode = options.mode ?? "shadow";
  if (!MODES.has(mode)) errors.push(`unknown mode ${mode}`);
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.concerns)) {
    return { valid: false, cutover_ready: false, errors: ["registry.concerns must be an array"] };
  }
  if (!Array.isArray(hits)) return { valid: false, cutover_ready: false, errors: ["hits must be an array"] };

  const byName = new Map();
  for (const [index, concern] of registry.concerns.entries()) {
    if (!nonEmpty(concern?.name)) errors.push(`concerns[${index}].name must be non-empty`);
    else if (byName.has(concern.name)) errors.push(`duplicate concern ${concern.name}`);
    else byName.set(concern.name, concern);
    if (!SEVERITIES.has(concern?.severity)) errors.push(`concerns[${index}] has invalid severity ${concern?.severity}`);
  }

  const obligations = [];
  const gaps = [];
  const waivers = options.waivers ?? {};
  for (const name of [...new Set(hits)].sort()) {
    const concern = byName.get(name);
    if (!concern) {
      gaps.push({ concern: name, code: "UNKNOWN_CONCERN", blocking: true });
      continue;
    }
    if (concern.status !== "active") {
      obligations.push({ concern: name, severity: concern.severity, disposition: "INACTIVE", actions: [] });
      continue;
    }
    const handlers = normalizedHandlers(concern);
    const hasRequiredHandler = handlers.rules.length + handlers.skills.length > 0;
    const waiver = waivers[name];
    const waived = validWaiver(waiver);
    const actions = [
      ...handlers.rules.map((id) => ({ type: "RULE", id })),
      ...handlers.skills.map((id) => ({ type: "SKILL", id }))
    ];
    if (concern.severity === "HIGH") actions.push({ type: "ACK", id: name });
    if (concern.severity === "MEDIUM") actions.push({ type: "ADVISORY", id: name });
    if (concern.severity === "LOW") actions.push({ type: "LOG", id: name });
    if (waived) actions.push({ type: "WAIVER", id: waiver.authority_digest, reason: waiver.reason });

    const handlerRequired = concern.severity === "CRITICAL" || concern.severity === "HIGH";
    if (handlerRequired && !hasRequiredHandler && !waived) {
      gaps.push({ concern: name, code: "MISSING_REQUIRED_HANDLER", severity: concern.severity, blocking: true });
    }
    obligations.push({
      concern: name,
      severity: concern.severity,
      disposition: waived ? "WAIVED" : concern.severity === "CRITICAL" ? "BLOCK_UNTIL_SATISFIED" :
        concern.severity === "HIGH" ? "REQUIRE_HANDLER_AND_ACK" :
          concern.severity === "MEDIUM" ? "ADVISORY" : "LOG",
      actions,
      optional_skills: handlers.optional_skills,
      source_file: concern.source_file ?? null,
      source_digest: concern.source_digest ?? null
    });
  }

  const cutoverReady = errors.length === 0 && gaps.length === 0;
  const valid = errors.length === 0 && (mode === "shadow" || cutoverReady);
  const result = {
    valid,
    cutover_ready: cutoverReady,
    mode,
    errors: [...new Set(errors)].sort(),
    obligations,
    gaps,
    summary: {
      hits: [...new Set(hits)].length,
      obligations: obligations.length,
      blocking_gaps: gaps.filter((gap) => gap.blocking).length,
      waived: obligations.filter((obligation) => obligation.disposition === "WAIVED").length
    }
  };
  result.compilation_digest = digest({
    registry_version: registry.schema_version ?? null,
    mode,
    obligations,
    gaps
  });
  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument ${token}`);
    const key = token.slice(2);
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(`missing value for ${token}`);
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.registry || !args.hits) throw new Error("usage: svc-concern-compiler-v2.mjs --registry <json> --hits <json> [--mode shadow|enforce] [--waivers <json>]");
    const result = compileConcernObligations(
      JSON.parse(fs.readFileSync(args.registry, "utf8")),
      JSON.parse(fs.readFileSync(args.hits, "utf8")),
      {
        mode: args.mode ?? "shadow",
        waivers: args.waivers ? JSON.parse(fs.readFileSync(args.waivers, "utf8")) : {}
      }
    );
    const stream = result.valid ? process.stdout : process.stderr;
    stream.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error.message] })}\n`);
    process.exitCode = 2;
  }
}
