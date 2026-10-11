#!/usr/bin/env node
/**
 * Project standing rules: owner rules for everything we build, now and later.
 *
 * Durable store: .svc/standing-rules.md (regular file, never a symlink).
 * Session start loads print-for-session, a single block capped at 2 KB.
 * Nothing is appended to CLAUDE.md or AGENTS.md.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const STORE_NAME = "standing-rules.md";
export const MAX_BLOCK_BYTES = 2048;
const HEADER = "[STANDING RULES — owner rules for everything we build, now and later]";

function resolveRoot(root) {
  const projectRoot = fs.realpathSync(path.resolve(root));
  if (!fs.statSync(projectRoot).isDirectory()) {
    throw Object.assign(new Error("project root must be a directory"), { code: "ROOT" });
  }
  return projectRoot;
}

function storePath(projectRoot) {
  return path.join(projectRoot, ".svc", STORE_NAME);
}

export function normalizeRule(text) {
  if (typeof text !== "string") return "";
  return text.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
}

export function sessionBlock(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return "";
  const lines = [HEADER];
  for (const rule of rules) {
    const candidate = [...lines, `- ${rule}`];
    if (Buffer.byteLength(candidate.join("\n"), "utf8") > MAX_BLOCK_BYTES) break;
    lines.push(`- ${rule}`);
  }
  if (lines.length === 1) return "";
  return lines.join("\n");
}

function blockCovers(rules) {
  const lines = new Set(sessionBlock(rules).split("\n"));
  return rules.every((rule) => lines.has(`- ${rule}`));
}

function readRules(projectRoot) {
  const svcDir = path.join(projectRoot, ".svc");
  let svcStat;
  try { svcStat = fs.lstatSync(svcDir); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw Object.assign(new Error("cannot inspect .svc"), { code: "REFUSE" });
  }
  if (!svcStat.isDirectory() || svcStat.isSymbolicLink()) {
    throw Object.assign(new Error(".svc must be a regular directory"), { code: "REFUSE" });
  }

  const file = storePath(projectRoot);
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw Object.assign(new Error("cannot inspect standing rules"), { code: "REFUSE" });
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw Object.assign(new Error("standing rules must be a regular file"), { code: "REFUSE" });
  }

  const body = fs.readFileSync(file, "utf8");
  const rules = [];
  for (const line of body.split(/\r?\n/)) {
    const match = /^-\s+(.*)$/.exec(line);
    if (match && match[1].trim()) rules.push(match[1].trim());
  }
  return rules;
}

function renderFile(rules) {
  const lines = [
    "# Standing rules",
    "",
    "Owner rules for everything we build, now and later. Session start loads the capped block. Do not copy these rules into CLAUDE.md.",
    "",
    ...rules.map((rule) => `- ${rule}`),
    "",
  ];
  return lines.join("\n");
}

function writeRules(projectRoot, rules) {
  const svcDir = path.join(projectRoot, ".svc");
  let svcStat = null;
  try { svcStat = fs.lstatSync(svcDir); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (svcStat && (!svcStat.isDirectory() || svcStat.isSymbolicLink())) {
    throw Object.assign(new Error(".svc must be a regular directory"), { code: "REFUSE" });
  }
  if (!svcStat) fs.mkdirSync(svcDir, { recursive: false });

  const file = storePath(projectRoot);
  let existing = null;
  try { existing = fs.lstatSync(file); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) {
    throw Object.assign(new Error("standing rules must be a regular file"), { code: "REFUSE" });
  }

  const tmp = path.join(svcDir, `.${STORE_NAME}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, renderFile(rules), { encoding: "utf8", mode: 0o644, flag: "w" });
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch { /* temp cleanup is best-effort */ }
    throw error;
  }
}

export function addRule(root, text) {
  const projectRoot = resolveRoot(root);
  const rule = normalizeRule(text);
  if (!rule) throw Object.assign(new Error("standing rule text is empty"), { code: "EMPTY" });
  const existing = readRules(projectRoot);
  if (existing.includes(rule)) return { added: false, rules: existing };
  const next = [...existing, rule];
  if (!blockCovers(next)) {
    throw Object.assign(new Error("standing rules block would exceed 2 KB"), { code: "CAP" });
  }
  writeRules(projectRoot, next);
  return { added: true, rules: next };
}

export function listRules(root) {
  return readRules(resolveRoot(root));
}

export function printForSession(root) {
  try {
    return sessionBlock(readRules(resolveRoot(root)));
  } catch {
    return "";
  }
}

function usage() {
  return "Usage: node scripts/standing-rules.mjs <add --text TEXT | list | print-for-session> [--root DIR]\n";
}

function parseArgs(argv) {
  const parsed = { command: "", root: "", text: null };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") {
      parsed.root = argv[i + 1] ?? "";
      i += 1;
    } else if (token === "--text") {
      parsed.text = argv[i + 1] ?? "";
      i += 1;
    } else if (token.startsWith("--text=")) {
      parsed.text = token.slice("--text=".length);
    } else if (token === "--help" || token === "-h") {
      parsed.help = true;
    } else {
      positionals.push(token);
    }
  }
  parsed.command = positionals[0] ?? "";
  parsed.extra = positionals.length > 1;
  return parsed;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const root = args.root || process.cwd();
  if (args.extra || !["add", "list", "print-for-session"].includes(args.command)) {
    process.stderr.write(usage());
    return 2;
  }
  try {
    if (args.command === "add") {
      if (args.text == null) {
        process.stderr.write(usage());
        return 2;
      }
      const result = addRule(root, args.text);
      process.stdout.write(`recorded: ${result.rules.at(-1) ?? ""}\n`);
      return 0;
    }
    if (args.command === "list") {
      for (const rule of listRules(root)) process.stdout.write(`${rule}\n`);
      return 0;
    }
    const text = printForSession(root);
    if (text) process.stdout.write(`${text}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1]))
      === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  process.exitCode = main(process.argv.slice(2));
}
