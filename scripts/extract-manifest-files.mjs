#!/usr/bin/env node
/**
 * Read Files Planned / Phase tables and emit sorted A|M|D TSV without mutation.
 * Usage: node scripts/extract-manifest-files.mjs <manifest.md>
 * Exit 0 = extracted; 1 = no planned rows or input failure; 2 = argument error.
 */
import fs from "node:fs";

const ACTION_MAP = { CREATE: "A", MODIFY: "M", DELETE: "D" };
const USAGE = "Usage: extract-manifest-files.mjs <manifest.md>";
const isPhase = (title) => /^Phase\s+\d+\b/i.test(title);
const isFilesPlanned = (title) => /^Files Planned\b/i.test(title);
const isExcluded = (title) => /^(Rollback|External State|Lane Compliance|Implementation Summary)\b/i.test(title);

/** Split a pipe table, preserving escaped pipes in filenames. */
function cells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/** A table belongs to Files Planned itself or to an unexcluded Phase heading. */
function plannedScope(headings) {
  if (!headings.length || headings.some(({ title }) => isExcluded(title))) return false;
  const planned = headings.findLastIndex(({ title }) => isFilesPlanned(title));
  if (planned >= 0) return headings.slice(planned + 1).every(({ title }) => isPhase(title));
  return isPhase(headings.at(-1).title);
}

/** Scope table state to real Markdown headings and ignore fenced examples. */
function extract(manifest) {
  const entries = new Set();
  const headings = [];
  let columns = null; let table = false; let fence = null;
  for (const line of manifest.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker) { fence = marker[1]; columns = null; table = false; continue; }
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/);
    if (heading) {
      const level = heading[1].length; const title = heading[2].trim();
      while (headings.length && headings.at(-1).level >= level) headings.pop();
      headings.push({ level, title });
      columns = null; table = false; continue;
    }
    if (!plannedScope(headings) || !/^\s*\|/.test(line)) { columns = null; table = false; continue; }
    const row = cells(line);
    const fileColumn = row.findIndex((cell) => cell.toLowerCase() === "file");
    const actionColumn = row.findIndex((cell) => cell.toLowerCase() === "action");
    if (fileColumn >= 0 && actionColumn >= 0) { columns = { file: fileColumn, action: actionColumn, count: row.length }; table = false; continue; }
    if (columns && !table) {
      if (row.length === columns.count && row.every((cell) => /^:?-{3,}:?$/.test(cell))) table = true;
      else columns = null;
      continue;
    }
    if (!table || !columns) continue;
    const file = row[columns.file]?.replace(/^`(.*)`$/, "$1").trim();
    const action = ACTION_MAP[row[columns.action]?.toUpperCase()];
    if (file && action) entries.add(`${action}\t${file}`);
  }
  return [...entries].sort();
}

if (process.argv.length !== 3) { console.error(USAGE); process.exitCode = 2; }
else if (["--help", "-h"].includes(process.argv[2])) console.log(USAGE);
else {
  try {
    const entries = extract(fs.readFileSync(process.argv[2], "utf8"));
    if (!entries.length) { console.error("No Files Planned tables parsed."); process.exitCode = 1; }
    else console.log(entries.join("\n"));
  } catch (error) { console.error(`extract-manifest-files: ${error.message}`); process.exitCode = 1; }
}
