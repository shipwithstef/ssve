#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REQUIRED_FRONTMATTER_FIELDS = [
  "topic",
  "target",
  "repo_mode",
  "authoring_mode",
  "status",
  "ambiguity_before",
  "ambiguity_after",
  "open_count",
  "blocking_count",
  "recommended_next_skill",
  "source_refs",
  "updated",
];

const REQUIRED_SECTIONS = [
  "## Summary",
  "## Gray Area Register",
  "## Evidence Notes",
  "## Decisions",
  "## Deferred",
  "## Blockers",
  "## Next Step",
];

const EXPECTED_COLUMNS = [
  "id",
  "category",
  "reversibility",
  "magnitude",
  "signal_score",
  "status",
  "downstream_phase",
  "decision_summary",
];

const ALLOWED_REPO_MODES = new Set(["bootstrap", "convert", "framework"]);
const ALLOWED_AUTHORING_MODES = new Set([
  "new-feature",
  "extend-feature",
  "bugfix-behavior",
  "contract-change",
  "framework-gap",
]);
const ALLOWED_ARTIFACT_STATUSES = new Set([
  "open",
  "proceed",
  "blocked",
  "rerouted",
  "not-needed",
]);
const ALLOWED_CATEGORIES = new Set([
  "scope",
  "ux",
  "contract-data",
  "operations",
  "sequencing-ownership",
]);
const ALLOWED_REVERSIBILITY = new Set(["two-way-door", "one-way-door"]);
const ALLOWED_MAGNITUDE = new Set(["low", "medium", "high"]);
const ALLOWED_ROW_STATUSES = new Set([
  "open",
  "decided",
  "deferred",
  "blocked",
  "rerouted",
]);

function usage() {
  console.error(
    "Usage: node scripts/discussion-artifact.mjs <validate|summary> --path <artifact>"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || (command !== "validate" && command !== "summary")) {
    usage();
  }

  const args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = rest[index + 1];
    if (value == null || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }

  if (!args.path) {
    throw new Error("Missing required flag --path");
  }

  return { command, path: path.resolve(args.path) };
}

function parseValue(raw) {
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner.length === 0) {
      return [];
    }
    return inner
      .split(",")
      .map((item) => item.trim())
      .map((item) => item.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"));
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }
  return value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    throw new Error("artifact must start with YAML frontmatter");
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error("artifact frontmatter is not terminated");
  }

  const rawFrontmatter = content.slice(4, end).trim();
  const body = content.slice(end + 5);
  const frontmatter = {};

  for (const line of rawFrontmatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`invalid frontmatter line: ${line}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    frontmatter[key] = parseValue(value);
  }

  return { frontmatter, body };
}

function getTableLines(body, heading) {
  const start = body.indexOf(heading);
  if (start === -1) {
    throw new Error(`missing section: ${heading}`);
  }
  const afterHeading = body.slice(start + heading.length);
  const lines = afterHeading
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, all) => !(index === 0 && line.trim() === ""));

  const table = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      break;
    }
    if (line.trim().startsWith("|")) {
      table.push(line.trim());
    }
  }

  if (table.length < 2) {
    throw new Error(`${heading} must contain a markdown table`);
  }

  return table;
}

function parseMarkdownRow(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseRegister(body) {
  const lines = getTableLines(body, "## Gray Area Register");
  const header = parseMarkdownRow(lines[0]);
  const expectedHeader = JSON.stringify(EXPECTED_COLUMNS);
  const actualHeader = JSON.stringify(header);
  if (actualHeader !== expectedHeader) {
    throw new Error(
      `Gray Area Register columns must be ${EXPECTED_COLUMNS.join(", ")}`
    );
  }

  const rows = [];
  for (const line of lines.slice(2)) {
    if (!line.includes("|")) {
      continue;
    }
    const cells = parseMarkdownRow(line);
    if (cells.length !== EXPECTED_COLUMNS.length) {
      throw new Error(`register row has ${cells.length} cells; expected 8`);
    }
    rows.push(Object.fromEntries(EXPECTED_COLUMNS.map((key, index) => [key, cells[index]])));
  }

  return rows;
}

function validateFrontmatter(frontmatter) {
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!(field in frontmatter)) {
      throw new Error(`missing frontmatter field: ${field}`);
    }
  }

  if (!ALLOWED_REPO_MODES.has(frontmatter.repo_mode)) {
    throw new Error(`invalid repo_mode: ${frontmatter.repo_mode}`);
  }
  if (!ALLOWED_AUTHORING_MODES.has(frontmatter.authoring_mode)) {
    throw new Error(`invalid authoring_mode: ${frontmatter.authoring_mode}`);
  }
  if (!ALLOWED_ARTIFACT_STATUSES.has(frontmatter.status)) {
    throw new Error(`invalid status: ${frontmatter.status}`);
  }
  for (const field of [
    "ambiguity_before",
    "ambiguity_after",
    "open_count",
    "blocking_count",
  ]) {
    if (!Number.isInteger(frontmatter[field])) {
      throw new Error(`${field} must be an integer`);
    }
  }
  if (!Array.isArray(frontmatter.source_refs)) {
    throw new Error("source_refs must be an array");
  }
}

function validateSections(body) {
  for (const heading of REQUIRED_SECTIONS) {
    if (!body.includes(heading)) {
      throw new Error(`missing section: ${heading}`);
    }
  }
}

function validateRegister(rows) {
  for (const row of rows) {
    if (!ALLOWED_CATEGORIES.has(row.category)) {
      throw new Error(`invalid category for ${row.id}: ${row.category}`);
    }
    if (!ALLOWED_REVERSIBILITY.has(row.reversibility)) {
      throw new Error(
        `invalid reversibility for ${row.id}: ${row.reversibility}`
      );
    }
    if (!ALLOWED_MAGNITUDE.has(row.magnitude)) {
      throw new Error(`invalid magnitude for ${row.id}: ${row.magnitude}`);
    }
    if (!/^-?\d+$/.test(row.signal_score)) {
      throw new Error(`signal_score must be an integer for ${row.id}`);
    }
    if (!ALLOWED_ROW_STATUSES.has(row.status)) {
      throw new Error(`invalid row status for ${row.id}: ${row.status}`);
    }
    if (!row.downstream_phase) {
      throw new Error(`downstream_phase missing for ${row.id}`);
    }
    if (!row.decision_summary) {
      throw new Error(`decision_summary missing for ${row.id}`);
    }
  }
}

function readArtifact(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(content);
  validateFrontmatter(frontmatter);
  validateSections(body);
  const rows = parseRegister(body);
  validateRegister(rows);
  return { frontmatter, rows };
}

function summarize(frontmatter, rows) {
  const counts = rows.reduce(
    (acc, row) => {
      acc[`${row.status}_count`] = (acc[`${row.status}_count`] ?? 0) + 1;
      return acc;
    },
    {
      open_count_actual: 0,
      decided_count: 0,
      deferred_count: 0,
      blocked_count_actual: 0,
      rerouted_count: 0,
    }
  );

  return {
    topic: frontmatter.topic,
    target: frontmatter.target,
    status: frontmatter.status,
    recommended_next_skill: frontmatter.recommended_next_skill,
    ambiguity_before: frontmatter.ambiguity_before,
    ambiguity_after: frontmatter.ambiguity_after,
    open_count: frontmatter.open_count,
    blocking_count: frontmatter.blocking_count,
    source_refs: frontmatter.source_refs,
    row_count: rows.length,
    open_count_actual: counts.open_count ?? 0,
    decided_count: counts.decided_count ?? 0,
    deferred_count: counts.deferred_count ?? 0,
    blocked_count_actual: counts.blocked_count ?? 0,
    rerouted_count: counts.rerouted_count ?? 0,
  };
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  usage();
}

try {
  const { frontmatter, rows } = readArtifact(parsed.path);
  if (parsed.command === "validate") {
    console.log(`valid ${parsed.path}`);
  } else {
    console.log(JSON.stringify(summarize(frontmatter, rows), null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
