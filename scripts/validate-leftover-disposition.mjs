#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const VALID_STATUSES = new Set([
  "committed",
  "gitignored",
  "deleted",
  "local-evidence",
  "deferred",
  "user-owned",
]);

function usage() {
  console.error("usage: node scripts/validate-leftover-disposition.mjs [--root <repo>] [--ledger <path>] [--json]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { root: process.cwd(), ledger: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") args.root = argv[++i];
    else if (token === "--ledger") args.ledger = argv[++i];
    else if (token === "--json") args.json = true;
    else usage();
  }
  return args;
}

function normalizePath(value) {
  return String(value || "")
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/^\.\//, "")
    .replace(/\\/g, "/");
}

function unquoteGitPath(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.slice(1, -1);
  }
}

function parseStatusLine(line) {
  if (!line || line.length < 4) return null;
  const code = line.slice(0, 2);
  let filePath = line.slice(3);
  if (filePath.includes(" -> ")) filePath = filePath.split(" -> ").pop();
  return {
    code,
    path: normalizePath(unquoteGitPath(filePath)),
    staged: code[0] !== " " && code[0] !== "?",
    untracked: code === "??",
    deleted: code.includes("D"),
  };
}

function gitStatus(root) {
  try {
    const output = execFileSync("git", ["-C", root, "status", "--porcelain=v1", "--untracked-files=all"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.split(/\r?\n/).filter(Boolean).map(parseStatusLine).filter(Boolean);
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exit(2);
  }
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

function parseMarkdownLedger(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].trim().startsWith("|") || !lines[i + 1].trim().startsWith("|")) continue;
    const header = splitTableRow(lines[i]).map((cell) => cell.toLowerCase().replace(/\s+/g, "_"));
    const separator = splitTableRow(lines[i + 1]);
    if (!isSeparator(separator)) continue;
    if (!["path", "status", "reason"].every((key) => header.includes(key))) continue;
    const entries = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith("|")) {
      const cells = splitTableRow(lines[j]);
      const entry = {};
      for (const key of ["path", "status", "reason", "follow_up"]) {
        const idx = header.indexOf(key);
        entry[key] = idx === -1 ? "" : cells[idx] || "";
      }
      entries.push(entry);
      j += 1;
    }
    return entries;
  }
  return null;
}

function loadLedger(ledgerPath) {
  const text = fs.readFileSync(ledgerPath, "utf8");
  if (/\.json$/i.test(ledgerPath)) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.entries)) throw new Error("JSON ledger must contain entries[]");
    return data.entries;
  }
  const entries = parseMarkdownLedger(text);
  if (!entries) throw new Error("Markdown ledger must contain a table with path/status/reason columns");
  return entries;
}

function validateEntry(entry, current) {
  const issues = [];
  const relPath = normalizePath(entry.path);
  const status = String(entry.status || "").trim();
  const reason = String(entry.reason || "").trim();
  const followUp = String(entry.follow_up || entry.followUp || "").trim();

  if (!relPath) issues.push("entry path is required");
  if (!VALID_STATUSES.has(status)) issues.push(`${relPath || "(blank)"}: invalid status '${status}'`);
  if (!reason) issues.push(`${relPath || "(blank)"}: reason is required`);
  if (status === "deferred" && !followUp) issues.push(`${relPath}: deferred status requires follow_up`);
  if (current && status === "gitignored") {
    issues.push(`${relPath}: status is gitignored but path still appears in git status; remove it from the index/delete it or commit/restore it before claiming gitignored`);
  }
  if (current && status === "committed" && !current.staged) {
    issues.push(`${relPath}: status is committed but path is not staged or committed`);
  }
  if (current && status === "deleted" && !current.deleted) {
    issues.push(`${relPath}: status is deleted but git status does not show deletion`);
  }
  return issues;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  const ledgerPath = args.ledger ? path.resolve(root, args.ledger) : null;
  const ledgerRel = ledgerPath && ledgerPath.startsWith(`${root}${path.sep}`)
    ? normalizePath(path.relative(root, ledgerPath))
    : null;
  const statusRows = gitStatus(root).filter((row) => row.path !== ledgerRel);
  const issues = [];

  if (statusRows.length === 0) {
    const result = { ok: true, dirty_count: 0, message: "worktree clean; leftover disposition ledger not required" };
    console.log(args.json ? JSON.stringify(result, null, 2) : "leftover disposition: PASS (clean worktree)");
    return;
  }

  if (!ledgerPath || !fs.existsSync(ledgerPath)) {
    issues.push(`dirty worktree has ${statusRows.length} path(s), but no leftover disposition ledger was provided`);
  }

  let entries = [];
  if (issues.length === 0) {
    try {
      entries = loadLedger(ledgerPath);
    } catch (error) {
      issues.push(error.message);
    }
  }

  const byPath = new Map();
  for (const entry of entries) {
    const relPath = normalizePath(entry.path);
    if (byPath.has(relPath)) issues.push(`${relPath}: duplicate ledger entry`);
    byPath.set(relPath, entry);
  }

  const currentByPath = new Map(statusRows.map((row) => [row.path, row]));
  for (const row of statusRows) {
    const entry = byPath.get(row.path);
    if (!entry) {
      issues.push(`${row.path}: missing leftover disposition entry`);
      continue;
    }
    issues.push(...validateEntry(entry, row));
  }

  for (const [relPath, entry] of byPath.entries()) {
    if (currentByPath.has(relPath)) continue;
    const status = String(entry.status || "").trim();
    if (!["committed", "gitignored", "deleted"].includes(status)) {
      issues.push(`${relPath}: ledger entry is not present in git status and must use committed, gitignored, or deleted`);
    }
    issues.push(...validateEntry(entry, null));
  }

  if (issues.length > 0) {
    const result = { ok: false, dirty_count: statusRows.length, issues };
    if (args.json) console.error(JSON.stringify(result, null, 2));
    else for (const issue of issues) console.error(`leftover disposition: ${issue}`);
    process.exit(1);
  }

  const result = { ok: true, dirty_count: statusRows.length, covered_paths: statusRows.map((row) => row.path) };
  console.log(args.json ? JSON.stringify(result, null, 2) : `leftover disposition: PASS (${statusRows.length} path(s) covered)`);
}

main();
