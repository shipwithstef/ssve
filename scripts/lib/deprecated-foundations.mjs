import fs from "node:fs";
import path from "node:path";

const DEFAULT_EXTENSIONS = new Set([
  ".cjs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".svelte",
  ".swift",
  ".ts",
  ".tsx",
  ".vue"
]);

const DEFAULT_IGNORES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".worktrees",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  "vendor"
]);

export function defaultRegistryPath(root = process.cwd()) {
  return path.join(root, "references", "deprecated-foundations.json");
}

function requireString(value, field, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} must be a non-empty string`);
  }
}

function parseIsoDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function validateRegistry(registry, opts = {}) {
  const errors = [];
  const registryPath = opts.registryPath || "<registry>";
  const now = opts.now ? new Date(opts.now) : new Date();

  if (!registry || typeof registry !== "object") {
    return [`Invalid deprecated foundations registry: ${registryPath} is not an object`];
  }

  if (registry.schema !== 1) errors.push("schema must be 1");
  if (!Array.isArray(registry.foundations)) errors.push("foundations must be an array");

  const freshness = registry.freshness;
  if (!freshness || typeof freshness !== "object" || Array.isArray(freshness)) {
    errors.push("freshness must be an object");
  } else {
    const reviewed = parseIsoDateOnly(freshness.reviewed_at);
    if (!reviewed) errors.push("freshness.reviewed_at must be YYYY-MM-DD");
    if (!Number.isInteger(freshness.max_age_days) || freshness.max_age_days <= 0) {
      errors.push("freshness.max_age_days must be a positive integer");
    }
    requireString(freshness.owner_skill, "freshness.owner_skill", errors);
    requireString(freshness.stale_action, "freshness.stale_action", errors);
    requireString(freshness.first_hit_scan, "freshness.first_hit_scan", errors);
    requireString(freshness.promotion_ledger, "freshness.promotion_ledger", errors);
    requireString(freshness.policy, "freshness.policy", errors);

    if (reviewed && Number.isInteger(freshness.max_age_days) && Number.isFinite(now.getTime())) {
      const ageDays = Math.floor((now.getTime() - reviewed.getTime()) / (24 * 60 * 60 * 1000));
      if (ageDays > freshness.max_age_days) {
        errors.push(
          `freshness.reviewed_at is stale (${ageDays}d old, max ${freshness.max_age_days}d): ${freshness.stale_action || "refresh registry"}`
        );
      }
    }
  }

  if (Array.isArray(registry.foundations)) {
    registry.foundations.forEach((foundation, index) => {
      const prefix = `foundations[${index}]`;
      requireString(foundation?.id, `${prefix}.id`, errors);
      requireString(foundation?.title, `${prefix}.title`, errors);
      requireString(foundation?.kind, `${prefix}.kind`, errors);
      requireString(foundation?.sunset_status, `${prefix}.sunset_status`, errors);
      requireString(foundation?.successor, `${prefix}.successor`, errors);
      requireString(foundation?.decision_required, `${prefix}.decision_required`, errors);
      if (!Array.isArray(foundation?.match_patterns) || foundation.match_patterns.length === 0) {
        errors.push(`${prefix}.match_patterns must be a non-empty array`);
      }
      if (!Array.isArray(foundation?.evidence) || foundation.evidence.length === 0) {
        errors.push(`${prefix}.evidence must be a non-empty array`);
      }
    });
  }

  return errors;
}

export function loadRegistry(registryPath = defaultRegistryPath()) {
  const raw = fs.readFileSync(registryPath, "utf8");
  const parsed = JSON.parse(raw);
  const errors = validateRegistry(parsed, { registryPath });
  if (errors.length > 0) {
    throw new Error(`Invalid deprecated foundations registry: ${registryPath}\n${errors.map((e) => `- ${e}`).join("\n")}`);
  }
  return parsed;
}

function compilePattern(pattern, foundationId) {
  try {
    return new RegExp(pattern, "g");
  } catch (err) {
    throw new Error(`Invalid match_pattern for ${foundationId}: ${pattern}: ${err.message}`);
  }
}

export function scanText({ text, filePath = "<inline>", registry }) {
  const findings = [];
  const lines = String(text || "").split(/\r?\n/);

  for (const foundation of registry.foundations) {
    for (const pattern of foundation.match_patterns || []) {
      const re = compilePattern(pattern, foundation.id);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(line)) !== null) {
          findings.push({
            id: foundation.id,
            title: foundation.title,
            kind: foundation.kind,
            sunset_status: foundation.sunset_status,
            file: filePath,
            line: lineIndex + 1,
            match: match[0],
            successor: foundation.successor,
            decision_required: foundation.decision_required,
            migration_size_hint: foundation.migration_size_hint
          });
          if (match[0] === "") break;
        }
      }
    }
  }

  return findings;
}

function shouldIgnoreDir(name) {
  return DEFAULT_IGNORES.has(name);
}

function shouldScanFile(filePath) {
  return DEFAULT_EXTENSIONS.has(path.extname(filePath));
}

export function collectScanFiles(inputs, root = process.cwd()) {
  const out = [];
  const stack = inputs.length > 0 ? [...inputs] : [root];

  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const base = path.basename(current);
      if (shouldIgnoreDir(base)) continue;
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }

    if (stat.isFile() && shouldScanFile(current)) {
      out.push(current);
    }
  }

  return out.sort();
}

export function scanFiles({ files, root = process.cwd(), registry }) {
  const findings = [];
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const rel = path.isAbsolute(file) ? path.relative(root, file) : file;
    findings.push(...scanText({ text, filePath: rel, registry }));
  }
  return findings;
}

export function formatFindings(findings) {
  if (findings.length === 0) return "No deprecated foundations detected.";
  return findings
    .map((f) => {
      return [
        `${f.file}:${f.line} ${f.id}`,
        `  match: ${f.match}`,
        `  successor: ${f.successor}`,
        `  required: ${f.decision_required}`
      ].join("\n");
    })
    .join("\n\n");
}
