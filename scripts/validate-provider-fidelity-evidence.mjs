#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REQUIRED_FIELDS = [
  "provider_requested",
  "primary_provider",
  "provider_used",
  "primary_capability",
  "fallback_policy",
  "source_evidence_required",
  "fallback_used",
  "fallback_user_approved",
  "saved_state_verified",
  "final",
];

const SOURCE_FIELDS = ["text_source", "image_source", "video_source", "audio_source", "data_source", "source_path"];
const GENERIC_FALLBACK_SOURCE_RE = /\b(fallback|mock|placeholder|stub|fixture|sample|dummy|unknown|draft-only|included_provider|svg_uploaded|manual_upload)\b/i;
const DEFAULT_CONFIG_BASENAME = "provider-fidelity-fallback-signals.json";

function usage() {
  console.error("Usage: node scripts/validate-provider-fidelity-evidence.mjs --evidence <PROVIDER_FIDELITY.md> [--fallback-signals <json>]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token !== "--evidence" && token !== "--fallback-signals") usage();
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) usage();
    if (token === "--evidence") args.evidence = value;
    if (token === "--fallback-signals") args.fallbackSignals = value;
    i += 1;
  }
  if (!args.evidence) usage();
  return args;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseEvidence(text) {
  const fields = new Map();

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_ -]+):\s*(.+?)\s*$/);
    if (match) fields.set(normalizeKey(match[1]), clean(match[2]));
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].trim().startsWith("|") || !lines[i + 1].trim().startsWith("|")) continue;
    const header = splitTableRow(lines[i]).map(normalizeKey);
    if (!header.includes("field") || !header.includes("value")) continue;
    const fieldIndex = header.indexOf("field");
    const valueIndex = header.indexOf("value");
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith("|")) {
      const row = splitTableRow(lines[j]);
      if (row.length === header.length && row[fieldIndex]) {
        fields.set(normalizeKey(row[fieldIndex]), clean(row[valueIndex] || ""));
      }
      j += 1;
    }
  }

  return fields;
}

function normalizeKey(value) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/`/g, "");
}

function clean(value) {
  return value.trim().replace(/^`|`$/g, "");
}

function value(fields, key) {
  return fields.get(key) || "";
}

function isBlank(valueToCheck) {
  return !valueToCheck || /^[-\u2014]$/.test(valueToCheck) || /\b(todo|tbd|unknown)\b/i.test(valueToCheck);
}

function isTrueish(valueToCheck) {
  return /\b(true|yes|pass|passed|verified|satisfied)\b/i.test(valueToCheck);
}

function isFalseish(valueToCheck) {
  return /\b(false|no|fail|failed|blocked|partial|missing|untested)\b/i.test(valueToCheck);
}

function normalizeProvider(valueToNormalize) {
  return valueToNormalize
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function providersMatch(requested, used) {
  const a = normalizeProvider(requested);
  const b = normalizeProvider(used);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function sourceValue(fields, capability) {
  const preferred = `${capability}_source`;
  if (fields.has(preferred)) return value(fields, preferred);
  for (const field of SOURCE_FIELDS) {
    if (fields.has(field)) return value(fields, field);
  }
  return "";
}

function loadFallbackConfig(explicitPath, evidencePath) {
  const paths = [];
  if (explicitPath) paths.push(path.resolve(explicitPath));

  let current = path.dirname(evidencePath);
  while (true) {
    paths.push(path.join(current, ".svc", DEFAULT_CONFIG_BASENAME));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const configPath of paths) {
    if (!fs.existsSync(configPath)) continue;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (error) {
      throw new Error(`invalid fallback signals config ${configPath}: ${error.message}`);
    }
    const patterns = parsed.fallback_source_patterns || parsed.forbidden_fallback_source_patterns || [];
    if (!Array.isArray(patterns)) {
      throw new Error(`fallback_source_patterns must be an array in ${configPath}`);
    }
    return patterns.map((pattern) => new RegExp(pattern, "i"));
  }
  return [];
}

function indicatesFallback(source, providerUsed, projectFallbackPatterns) {
  const text = `${source} ${providerUsed}`;
  if (GENERIC_FALLBACK_SOURCE_RE.test(text)) return true;
  return projectFallbackPatterns.some((pattern) => pattern.test(text));
}

function validateEvidence(filePath, options = {}) {
  const issues = [];
  if (!fs.existsSync(filePath)) return [`evidence file not found: ${filePath}`];
  const text = fs.readFileSync(filePath, "utf8");
  const fields = parseEvidence(text);
  let projectFallbackPatterns = [];
  try {
    projectFallbackPatterns = loadFallbackConfig(options.fallbackSignals, filePath);
  } catch (error) {
    return [error.message];
  }

  for (const field of REQUIRED_FIELDS) {
    if (isBlank(value(fields, field))) issues.push(`missing or unresolved field: ${field}`);
  }

  const capability = normalizeKey(value(fields, "primary_capability") || "text");
  const source = sourceValue(fields, capability);
  const final = value(fields, "final");
  const fallbackUsed = isTrueish(value(fields, "fallback_used"));
  const fallbackApproved = isTrueish(value(fields, "fallback_user_approved"));
  const sourceRequired = isTrueish(value(fields, "source_evidence_required"));
  const savedStateVerified = isTrueish(value(fields, "saved_state_verified"));
  const fallbackPolicy = value(fields, "fallback_policy").toLowerCase();
  const requestedProvider = value(fields, "provider_requested") || value(fields, "primary_provider");
  const providerUsed = value(fields, "provider_used");

  if (!sourceRequired) issues.push("source_evidence_required must be true/pass");
  if (isBlank(source)) issues.push(`missing source evidence for capability '${capability}'`);
  if (!savedStateVerified) issues.push("saved_state_verified must be true/pass");
  if (isFalseish(final) || !isTrueish(final)) issues.push("final must be PASS/verified for provider fidelity evidence to satisfy closeout");

  if (fallbackUsed && !fallbackApproved) {
    issues.push("fallback_used is true but fallback_user_approved is not true");
  }
  if (fallbackPolicy.includes("forbidden") && fallbackUsed && !fallbackApproved) {
    issues.push("fallback policy forbids unapproved fallback");
  }
  if (!providersMatch(requestedProvider, providerUsed) && !fallbackApproved) {
    issues.push(`provider_used '${providerUsed}' does not match provider_requested '${requestedProvider}' without approved fallback`);
  }
  if (indicatesFallback(source, providerUsed, projectFallbackPatterns) && !fallbackApproved) {
    issues.push("source/provider evidence indicates fallback, mock, placeholder, or uploaded substitute without approval");
  }

  if (/\b(image|visual|video)\b/i.test(capability)) {
    if (!isTrueish(value(fields, "semantic_relevance_result"))) {
      issues.push("image/visual/video capability requires semantic_relevance_result PASS");
    }
    if (!isTrueish(value(fields, "visual_quality_result"))) {
      issues.push("image/visual/video capability requires visual_quality_result PASS");
    }
  }

  return issues;
}

const args = parseArgs(process.argv.slice(2));
const evidencePath = path.resolve(args.evidence);
const issues = validateEvidence(evidencePath, { fallbackSignals: args.fallbackSignals });

if (issues.length === 0) {
  console.log(`${path.relative(process.cwd(), evidencePath)}: PASS - provider fidelity evidence is valid`);
  process.exit(0);
}

console.error(`${path.relative(process.cwd(), evidencePath)}: FAIL - ${issues.length} issue(s)`);
for (const issue of issues) console.error(`  - ${issue}`);
process.exit(1);
