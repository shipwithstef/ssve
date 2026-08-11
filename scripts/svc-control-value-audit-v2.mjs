#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const ROW = /^\| (\d{2,}) \| (.*?) \| (.*?) \| (.*?) \|$/gm;
const SHA256 = /^[a-f0-9]{64}$/;
const PROOF_SIGNAL = /proof|prove|test|fixture|mutation|replay|reject|fail|compile|receipt|trace|shadow|compare|verif|validator|gate|reproduc|determin|evidence/i;

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function disposition(replacement) {
  if (/\*\*DELETE:/i.test(replacement)) return "DELETE";
  if (/\*\*STRENGTHEN:/i.test(replacement)) return "STRENGTHEN";
  if (/\*\*PRESERVE:/i.test(replacement)) return "PRESERVE";
  return "REPLACE";
}

export function auditControlValueLedger(markdown, options = {}) {
  const minimumControls = options.minimum_controls ?? 1;
  const errors = [];
  if (typeof markdown !== "string") return { valid: false, errors: ["markdown must be a string"] };
  if (!Number.isInteger(minimumControls) || minimumControls < 1) return { valid: false, errors: ["minimum_controls must be a positive integer"] };
  const sectionStart = markdown.indexOf("## Eighty root causes and preserved-control replacements");
  if (sectionStart === -1) return { valid: false, errors: ["control-value ledger section is missing"] };
  const nextSection = markdown.indexOf("\n## ", sectionStart + 4);
  const section = markdown.slice(sectionStart, nextSection === -1 ? undefined : nextSection);
  const rows = [];
  for (const match of section.matchAll(ROW)) {
    rows.push({
      id: Number(match[1]),
      id_text: match[1],
      original_benefit: match[2].trim(),
      root_cause: match[3].trim(),
      replacement: match[4].trim()
    });
  }
  if (rows.length < minimumControls) errors.push(`control ledger has ${rows.length} rows; minimum is ${minimumControls}`);
  const ids = new Set();
  for (const [index, row] of rows.entries()) {
    const expected = index + 1;
    if (row.id !== expected) errors.push(`control ledger is not contiguous: expected ${expected}, found ${row.id}`);
    if (ids.has(row.id)) errors.push(`duplicate control ${row.id_text}`);
    ids.add(row.id);
    if (row.original_benefit.length < 30) errors.push(`control ${row.id_text} does not preserve a concrete original benefit`);
    if (row.root_cause.length < 30) errors.push(`control ${row.id_text} has no concrete cost/root cause`);
    if (row.replacement.length < 30) errors.push(`control ${row.id_text} has no concrete replacement`);
    if (!PROOF_SIGNAL.test(row.replacement)) errors.push(`control ${row.id_text} replacement has no proof mechanism`);
    row.disposition = disposition(row.replacement);
    if (row.disposition === "DELETE") {
      if (!/DELETE:\s*ZERO_UNIQUE_BENEFIT/i.test(row.replacement)) errors.push(`control ${row.id_text} deletion lacks ZERO_UNIQUE_BENEFIT`);
      const authority = row.replacement.match(/owner-authority\s+sha256:([a-f0-9]{64})/i)?.[1];
      if (!SHA256.test(authority ?? "")) errors.push(`control ${row.id_text} deletion lacks owner-authority digest`);
      if (!/measured\s+ROI/i.test(row.replacement)) errors.push(`control ${row.id_text} deletion lacks measured ROI`);
      if (!/regression\s+corpus/i.test(row.replacement)) errors.push(`control ${row.id_text} deletion lacks regression corpus`);
    }
  }
  const normalizedErrors = [...new Set(errors)].sort();
  const entries = rows.map((row) => ({
    id: row.id_text,
    disposition: row.disposition,
    original_benefit_digest: digest(row.original_benefit),
    root_cause_digest: digest(row.root_cause),
    replacement_digest: digest(row.replacement)
  }));
  return {
    valid: normalizedErrors.length === 0,
    errors: normalizedErrors,
    entries,
    ledger_digest: normalizedErrors.length === 0 ? digest(JSON.stringify(entries)) : null,
    summary: {
      controls: rows.length,
      preserved: entries.filter((entry) => entry.disposition === "PRESERVE").length,
      strengthened: entries.filter((entry) => entry.disposition === "STRENGTHEN").length,
      replaced: entries.filter((entry) => entry.disposition === "REPLACE").length,
      deleted: entries.filter((entry) => entry.disposition === "DELETE").length,
      unproven_deletions: normalizedErrors.filter((error) => error.includes("deletion lacks")).length
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2);
    const proposalIndex = args.indexOf("--proposal");
    const minimumIndex = args.indexOf("--minimum-controls");
    if (proposalIndex === -1 || !args[proposalIndex + 1]) throw new Error("usage: svc-control-value-audit-v2.mjs --proposal <markdown> [--minimum-controls <n>]");
    const result = auditControlValueLedger(fs.readFileSync(args[proposalIndex + 1], "utf8"), {
      minimum_controls: minimumIndex === -1 ? 1 : Number(args[minimumIndex + 1])
    });
    (result.valid ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error.message] })}\n`);
    process.exitCode = 2;
  }
}
