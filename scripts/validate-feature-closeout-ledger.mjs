#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REQUIRED_COLUMNS = [
  "AC ID",
  "Persona(s)",
  "Journey scenario(s)",
  "Validation tier",
  "Evidence path(s)",
  "Runtime result",
  "E2E result",
  "Final",
];

const PASS_RE = /\b(pass|passed|satisfied|verified)\b/i;
const NA_WITH_REASON_RE = /^n\/a\s*(?:[-:\u2014]\s*)?\S.+/i;
const FAIL_OR_BLOCK_RE = /\b(fail|failed|blocked|missing|untested|gap)\b/i;
const WI_RE = /\bWI-[A-Z0-9-]*\d+\b/i;
const VISUAL_RE = /\b(ui|visual|visible|render|screen|page|modal|dialog|button|image|photo|screenshot|viewport|mobile|desktop|layout|display|form|text|toast|empty state|saved state)\b/i;
const BEHAVIOR_RE = /\b(add|create|save|submit|generate|upload|download|delete|edit|update|select|click|tap|open|navigate|search|filter|sort|login|logout|approve|reject|send|receive|persist|store|load|sync)\b/i;
const PERSONA_TRACE_RE = /(?:\bP[0-9]+(?:[-_][A-Za-z0-9][A-Za-z0-9_-]*)?\b|docs\/specs\/personas\/(?:PERSONA_INDEX|[A-Za-z0-9._-]+)\.md|PERSONA_INDEX\.md)/i;

function usage() {
  console.error("Usage: node scripts/validate-feature-closeout-ledger.mjs --feature <feature.md> --ledger <FEATURE_VALIDATION_LEDGER.md>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) usage();
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) usage();
    args[key] = value;
    i += 1;
  }
  if (!args.feature || !args.ledger) usage();
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

function isSeparator(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizeHeader(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseMarkdownTables(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].trim().startsWith("|") || !lines[i + 1].trim().startsWith("|")) continue;
    const header = splitTableRow(lines[i]);
    const separator = splitTableRow(lines[i + 1]);
    if (!isSeparator(separator)) continue;
    const rows = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith("|")) {
      const cells = splitTableRow(lines[j]);
      if (cells.length === header.length) rows.push(cells);
      j += 1;
    }
    tables.push({ header, rows });
    i = j - 1;
  }
  return tables;
}

function extractAcceptanceCriteria(featureText) {
  const acs = [];
  for (const table of parseMarkdownTables(featureText)) {
    const header = table.header.map(normalizeHeader);
    const acIndex = header.indexOf("ac");
    const descriptionIndex = header.indexOf("description");
    if (acIndex === -1 || descriptionIndex === -1) continue;
    for (const row of table.rows) {
      const id = row[acIndex]?.trim();
      const description = row[descriptionIndex]?.trim() || "";
      if (!id || !/^[A-Z][A-Z0-9-]*-\d+[A-Z0-9-]*$/i.test(id)) continue;
      acs.push({ id, description });
    }
  }
  return acs;
}

function extractLedgerRows(ledgerText) {
  const required = REQUIRED_COLUMNS.map(normalizeHeader);
  for (const table of parseMarkdownTables(ledgerText)) {
    const header = table.header.map(normalizeHeader);
    if (!required.every((column) => header.includes(column))) continue;
    return table.rows.map((row) => {
      const entry = {};
      for (const column of REQUIRED_COLUMNS) {
        const idx = header.indexOf(normalizeHeader(column));
        entry[column] = row[idx] || "";
      }
      return entry;
    });
  }
  return null;
}

function extractClassification(ledgerText) {
  const inline = ledgerText.match(/^Final closeout classification:\s*`?([a-z-]+)`?/im);
  if (inline) return inline[1];
  const heading = ledgerText.match(/##\s+Final Closeout Classification\s+([\s\S]*?)(?:\n##\s+|$)/i);
  if (!heading) return null;
  const value = heading[1].match(/\b(framework-complete|runtime-accepted|corrective-closure-complete|blocked)\b/i);
  return value ? value[1].toLowerCase() : null;
}

function isBlankOrTodo(value) {
  return !value || /^[-\u2014]$/.test(value.trim()) || /\b(todo|tbd|unknown)\b/i.test(value);
}

function okOrNaWithReason(value) {
  return PASS_RE.test(value) || NA_WITH_REASON_RE.test(value);
}

function hasConcretePersonaTrace(value) {
  return PERSONA_TRACE_RE.test(value);
}

function evidenceTokens(value) {
  return value
    .split(/[,;\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function localEvidenceExists(root, evidenceValue) {
  const tokens = evidenceTokens(evidenceValue);
  if (tokens.length === 0) return false;
  for (const token of tokens) {
    if (NA_WITH_REASON_RE.test(token) || /^[a-z]+:/i.test(token) || /^https?:\/\//i.test(token)) continue;
    const cleaned = token.replace(/^`|`$/g, "");
    if (!fs.existsSync(path.resolve(root, cleaned))) return false;
  }
  return true;
}

function validate({ featurePath, ledgerPath }) {
  const root = process.cwd();
  const issues = [];
  if (!fs.existsSync(featurePath)) issues.push(`feature file not found: ${featurePath}`);
  if (!fs.existsSync(ledgerPath)) issues.push(`ledger file not found: ${ledgerPath}`);
  if (issues.length > 0) return issues;

  const featureText = fs.readFileSync(featurePath, "utf8");
  const ledgerText = fs.readFileSync(ledgerPath, "utf8");
  const acs = extractAcceptanceCriteria(featureText);
  if (acs.length === 0) issues.push("feature spec has no machine-readable AC table with columns AC and Description");

  const ledgerRows = extractLedgerRows(ledgerText);
  if (!ledgerRows) {
    issues.push(`ledger is missing required table columns: ${REQUIRED_COLUMNS.join(", ")}`);
    return issues;
  }

  const byAc = new Map();
  for (const row of ledgerRows) {
    const id = row["AC ID"];
    if (!id) {
      issues.push("ledger row is missing AC ID");
      continue;
    }
    if (!byAc.has(id)) byAc.set(id, []);
    byAc.get(id).push(row);
  }

  for (const ac of acs) {
    const rows = byAc.get(ac.id) || [];
    if (rows.length === 0) {
      issues.push(`AC ${ac.id} is missing from ledger`);
      continue;
    }
    if (rows.length > 1) issues.push(`AC ${ac.id} appears ${rows.length} times in ledger; expected exactly once`);
    const row = rows[0];
    const rowText = Object.values(row).join(" ");

    for (const column of REQUIRED_COLUMNS) {
      if (isBlankOrTodo(row[column])) issues.push(`AC ${ac.id} column '${column}' is blank or unresolved`);
    }
    const personaValue = row["Persona(s)"];
    if (!NA_WITH_REASON_RE.test(personaValue) && !hasConcretePersonaTrace(personaValue)) {
      issues.push(
        `AC ${ac.id} lacks concrete persona trace; cite a persona id/path ` +
          `(for example P2 or docs/specs/personas/P2.md) or give an N/A reason`
      );
    }
    if (!okOrNaWithReason(row["Journey scenario(s)"])) issues.push(`AC ${ac.id} lacks journey/scenario coverage or N/A reason`);
    if (!localEvidenceExists(root, row["Evidence path(s)"])) issues.push(`AC ${ac.id} evidence path is missing or does not exist`);
    if (VISUAL_RE.test(ac.description) && !/(screenshot|track-visuals|\.png|\.jpe?g|\.webp|\.gif)/i.test(row["Evidence path(s)"])) {
      issues.push(`AC ${ac.id} is visual/rendering-related but lacks screenshot or track-visuals evidence`);
    }
    if (BEHAVIOR_RE.test(ac.description) && !okOrNaWithReason(row["Runtime result"])) {
      issues.push(`AC ${ac.id} is behavioral but lacks passing runtime evidence or N/A reason`);
    }
    if (FAIL_OR_BLOCK_RE.test(rowText) && !WI_RE.test(rowText)) {
      issues.push(`AC ${ac.id} is failed/blocked/missing without a linked WI`);
    }
  }

  const knownAcIds = new Set(acs.map((ac) => ac.id));
  for (const row of ledgerRows) {
    if (row["AC ID"] && !knownAcIds.has(row["AC ID"])) {
      issues.push(`ledger contains AC ${row["AC ID"]} that is not present in feature spec`);
    }
  }

  const classification = extractClassification(ledgerText);
  if (!classification) {
    issues.push("ledger is missing Final closeout classification");
  } else {
    const rowsText = ledgerRows.map((row) => Object.values(row).join(" ")).join("\n");
    if (classification === "framework-complete" && FAIL_OR_BLOCK_RE.test(rowsText)) {
      issues.push("ledger classification is framework-complete while one or more AC rows are failed/blocked/missing");
    }
  }

  return issues;
}

const args = parseArgs(process.argv.slice(2));
const featurePath = path.resolve(args.feature);
const ledgerPath = path.resolve(args.ledger);
const issues = validate({ featurePath, ledgerPath });

if (issues.length === 0) {
  console.log(`${path.relative(process.cwd(), ledgerPath)}: PASS - feature validation ledger covers all ACs`);
  process.exit(0);
}

console.error(`${path.relative(process.cwd(), ledgerPath)}: FAIL - ${issues.length} issue(s)`);
for (const issue of issues) console.error(`  - ${issue}`);
process.exit(1);
