#!/usr/bin/env node
// §2 conditional-stage activation (proposals/2026-08-02-one-lane-framework.md
// §2). Evaluates each non-essential stage's activation condition against a
// diff (or the staged tree), mechanically — glob/grep, not judgement — and
// emits {stage, condition, evaluated_against, result} per stage. Essential
// stages are always "active" and can never be conditioned by an override
// file (the chain that makes this the chain).
//
// Usage:
//   node scripts/stage-activation.mjs --diff <base>..<head> [--conditions <file>]
//   node scripts/stage-activation.mjs --staged [--conditions <file>]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// WI-521 Batch C (C1, closes WI-519/G4): the hardcoded 6-stage essential table
// this file used to carry was a SECOND copy of the same vocabulary now owned
// by references/stage-registry.json — exactly the drift class G4 named. The
// essential set is now DERIVED from the registry (`class: "essential"`
// entries, in registry order), never duplicated here. A missing/invalid
// registry is a hard exit 2 (no embedded fallback — same rule as
// scripts/audit-story-receipts.mjs, for the same reason).
const DEFAULT_REGISTRY_PATH = "references/stage-registry.json";

function loadStageRegistry(registryPath) {
  let raw;
  try {
    raw = readFileSync(registryPath, "utf8");
  } catch (error) {
    fail(`stage registry not found or unreadable: ${registryPath} — ${error.message}`, 2);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`stage registry is invalid JSON: ${registryPath} — ${error.message}`, 2);
  }
  if (!Array.isArray(parsed.stages) || parsed.stages.length === 0) {
    fail(`stage registry has no "stages" array: ${registryPath}`, 2);
  }
  // FIX 2 (review round): a registry that validates ONLY "stages is a non-empty
  // array" lets a malformed `class` value (wrong case, typo, missing) through
  // silently — the essential set derived from it below then goes empty and the
  // WI-519 essential fence disappears with it, exit 0. Lifted from Batch A's own
  // validator (scripts/audit-story-receipts.mjs loadRegistry), which already
  // enforces this, rather than writing a second copy of the same check.
  for (const s of parsed.stages) {
    if (!s || typeof s.key !== "string" || !s.key) {
      fail(`stage registry has an entry with no "key": ${registryPath}`, 2);
    }
    if (!["essential", "conditional", "situational"].includes(s.class)) {
      fail(`stage registry entry "${s.key}" has class "${s.class}" — must be essential|conditional|situational: ${registryPath}`, 2);
    }
  }
  return parsed;
}

// Quote-derived verbatim from proposals/2026-08-02-one-lane-framework.md §2
// "Conditions, deliberately mechanical:" table. The regex/glob PATTERNS below
// are this script's own mechanical encoding of that prose condition — not
// part of the proposal text itself.
const DEFAULT_CONDITIONS = {
  perf: {
    condition: "diff touches a query path, a loop over rows, or an index",
    patterns: ["\\bSELECT\\b", "CREATE\\s+INDEX", "\\.forEach\\(", "for\\s*\\([^)]*\\bof\\b"],
  },
  translations: {
    condition: "diff adds or changes a user-visible string",
    patterns: ["locales?/", "\\.po$", "\\.strings$", "\\bi18n\\b"],
  },
  "device-proof": {
    condition: "diff touches src/**, android/**, ios/** or a native permission",
    patterns: ["^src/", "^android/", "^ios/", "AndroidManifest\\.xml", "Info\\.plist"],
  },
  visuals: {
    condition: "diff touches a rendered component or a design token",
    patterns: ["\\.tsx?$", "\\.jsx$", "\\.vue$", "design-tokens?"],
  },
  pricing: {
    condition: "diff touches plans.generated.js, a fee path, or a priced surface",
    patterns: ["plans\\.generated\\.js", "\\bfee\\b", "pricing"],
  },
  marketing: {
    // approximated per §3g rule 1: no path/content glob is claimed here —
    // this checks for capability NAMES the marketing context asserts, and
    // the emitted record states its own denominator (capability_names_checked).
    condition: "diff touches a capability the marketing context claims",
    patterns: [],
    approximated: true,
  },
};

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { conditions: null, registry: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--diff") out.diff = argv[++i];
    else if (arg === "--staged") out.staged = true;
    else if (arg === "--conditions") out.conditions = argv[++i];
    else if (arg === "--registry") out.registry = argv[++i];
    else fail(`unknown argument: ${arg}`, 2);
  }
  if (!out.diff && !out.staged) fail("usage: --diff <base>..<head> | --staged [--conditions <file>] [--registry <path>]", 2);
  if (out.diff && out.staged) fail("--diff and --staged are mutually exclusive", 2);
  return out;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function changedFiles(args) {
  const gitArgs = args.staged ? ["diff", "--name-only", "--cached"] : ["diff", "--name-only", args.diff];
  return git(gitArgs).split("\n").filter(Boolean);
}

function diffText(args) {
  const gitArgs = args.staged ? ["diff", "--cached", "--unified=0"] : ["diff", args.diff, "--unified=0"];
  return git(gitArgs);
}

function loadCapabilityNames() {
  const capabilitiesPath = "references/knowledge/svc/CAPABILITIES.md";
  if (!existsSync(capabilitiesPath)) return [];
  const text = readFileSync(capabilitiesPath, "utf8");
  // Mechanical heading scan (## <Capability Name>) — the denominator IS len().
  return [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
}

function loadConditions(conditionsPath) {
  if (!conditionsPath) return DEFAULT_CONDITIONS;
  if (!existsSync(conditionsPath)) fail(`--conditions file not found: ${conditionsPath}`, 2);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(conditionsPath, "utf8"));
  } catch (error) {
    fail(`--conditions file is invalid JSON: ${error.message}`, 2);
  }
  const block = parsed.activation_conditions;
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    fail(`--conditions file must contain an "activation_conditions" object`, 2);
  }
  // Leading-underscore keys (_schema, _version, ...) are metadata, matching
  // this repo's existing skip-conditions.json convention — not a stage.
  const stages = Object.fromEntries(Object.entries(block).filter(([key]) => !key.startsWith("_")));
  for (const key of Object.keys(stages)) {
    if (ESSENTIAL_STAGES.includes(key)) {
      fail(`--conditions file conditions an essential stage (never allowed): ${key}`, 2);
    }
  }
  // FIX 3 (reviewer round): a registry entry that carries condition PROSE but
  // no patterns is a mechanized always-"na" in disguise — exactly the
  // pressure valve §2 exists to close. references/skip-conditions.json ships
  // condition text only (documentation shape); merge in this script's own
  // built-in patterns for any KNOWN stage name so that file remains usable
  // as --conditions input. A stage with neither its own patterns nor a known
  // default (custom, unrecognized name) is refused outright rather than
  // silently emitting `na` forever. "marketing" is exempt — its empty
  // patterns array is intentional (approximated via capability-name grep).
  const merged = {};
  for (const [key, def] of Object.entries(stages)) {
    const hasOwnPatterns = Array.isArray(def.patterns) && def.patterns.length > 0;
    if (hasOwnPatterns || key === "marketing") {
      merged[key] = def;
      continue;
    }
    const builtin = DEFAULT_CONDITIONS[key];
    if (builtin && Array.isArray(builtin.patterns) && builtin.patterns.length > 0) {
      merged[key] = { ...builtin, ...def, patterns: builtin.patterns };
      continue;
    }
    fail(`--conditions file entry "${key}" has no patterns and no built-in default to merge — an empty-pattern condition can only ever emit "na" (refused, not silently accepted)`, 2);
  }
  return merged;
}

function evaluateCondition(name, def, files, text) {
  if (name === "marketing") {
    const capabilityNames = loadCapabilityNames();
    const matched = capabilityNames.filter((cap) => text.includes(cap));
    return {
      stage: name,
      condition: def.condition,
      evaluated_against: { files: files.length, patterns: [], capability_names_checked: capabilityNames.length },
      result: matched.length > 0 ? "active" : "na",
    };
  }
  const patterns = def.patterns || [];
  const regexes = patterns.map((p) => new RegExp(p, "i"));
  const active = files.some((f) => regexes.some((re) => re.test(f))) || regexes.some((re) => re.test(text));
  return {
    stage: name,
    condition: def.condition,
    evaluated_against: { files: files.length, patterns },
    result: active ? "active" : "na",
  };
}

const args = parseArgs(process.argv.slice(2));
const REGISTRY_PATH_USED = args.registry || DEFAULT_REGISTRY_PATH;
const REGISTRY = loadStageRegistry(REGISTRY_PATH_USED);
// Registry order IS canonical order (references/stage-registry.json `_comment`) —
// filter preserves it, so essential-stage output order is unchanged from before.
const ESSENTIAL_STAGES = Object.freeze(
  REGISTRY.stages.filter((s) => s.class === "essential").map((s) => s.key)
);
// FIX 2 (review round): class-enum validation above closes the wrong-case/typo
// case, but a registry that is internally consistent yet genuinely has zero
// essential-class rows would still zero out the fence with no diagnostic — the
// WI-519 essential fence must be provably non-empty, not just well-typed.
if (ESSENTIAL_STAGES.length === 0) {
  fail(`stage registry has zero essential-class stages: ${REGISTRY_PATH_USED}`, 2);
}
// FIX 9 (review round, LOW): DEFAULT_CONDITIONS' keys still duplicate the
// registry's activation_condition set by hand instead of being derived from
// it — G4 half-closed, agreeing with the registry today only by coincidence.
// Assert the two sets match; drift becomes a loud exit 2, not a silent split.
const registryConditionableKeys = new Set(
  REGISTRY.stages.filter((s) => s.activation_condition != null).map((s) => s.activation_condition)
);
const defaultConditionKeys = new Set(Object.keys(DEFAULT_CONDITIONS));
const missingFromDefaults = [...registryConditionableKeys].filter((k) => !defaultConditionKeys.has(k));
const missingFromRegistry = [...defaultConditionKeys].filter((k) => !registryConditionableKeys.has(k));
if (missingFromDefaults.length || missingFromRegistry.length) {
  fail(
    `DEFAULT_CONDITIONS keys and the registry's activation_condition set disagree — ` +
    `missing from DEFAULT_CONDITIONS: [${missingFromDefaults.join(", ")}], ` +
    `missing from registry: [${missingFromRegistry.join(", ")}]`,
    2
  );
}
const files = changedFiles(args);
const text = diffText(args);
const conditions = loadConditions(args.conditions);

const output = [
  ...ESSENTIAL_STAGES.map((stage) => ({
    stage,
    condition: "essential — always active, never na",
    evaluated_against: { files: files.length, patterns: [] },
    result: "active",
  })),
  ...Object.entries(conditions).map(([name, def]) => evaluateCondition(name, def, files, text)),
];

console.log(JSON.stringify(output, null, 2));
