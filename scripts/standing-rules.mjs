#!/usr/bin/env node
/**
 * Project standing rules: owner rules for everything we build, now and later.
 *
 * Durable store: .svc/standing-rules.md (regular file, never a symlink).
 * Add, list, and session preload all use the owning project root: the nearest
 * ancestor with a real .svc directory or a git work tree. A subdirectory is
 * not its own project. The home directory (~/.svc is user config) and the
 * temp root are never that project.
 * Session start loads print-for-session, a single block capped at 2 KB.
 * Nothing is appended to CLAUDE.md or AGENTS.md.
 */
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const STORE_NAME = "standing-rules.md";
export const LOCK_NAME = `.${STORE_NAME}.lock`;
export const MAX_BLOCK_BYTES = 2048;
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const FRESH_FLAGS = fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | NOFOLLOW;
const LOCK_FLAGS = fs.constants.O_CREAT | fs.constants.O_RDWR | NOFOLLOW;
const HEADER = "[STANDING RULES — owner rules for everything we build, now and later]";

// Temp roots are never a project. A polluted /tmp/.svc must not own a fixture,
// and the walk must not climb out of the temp root into "/".
const TEMP_ROOTS = (() => {
  const roots = new Set();
  for (const candidate of [os.tmpdir(), "/tmp", process.env.TMPDIR]) {
    if (!candidate) continue;
    try { roots.add(path.resolve(candidate)); } catch { /* unresolvable temp path */ }
    try { roots.add(fs.realpathSync(candidate)); } catch { /* unresolvable temp path */ }
  }
  return roots;
})();

function homeDirectory() {
  try { return fs.realpathSync(os.homedir()); }
  catch { return null; }
}

function stopsWalk(dir, home) {
  return TEMP_ROOTS.has(dir) || dir === home;
}

function hasRealSvc(dir) {
  try {
    const stat = fs.lstatSync(path.join(dir, ".svc"));
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function hasGitMarker(dir) {
  try {
    const stat = fs.lstatSync(path.join(dir, ".git"));
    return !stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile());
  } catch {
    return false;
  }
}

// Nearest ancestor that owns the project. An empty subdirectory must not hide
// rules stored in the ancestor's .svc/standing-rules.md.
export function resolveRoot(root) {
  const projectRoot = fs.realpathSync(path.resolve(root));
  if (!fs.statSync(projectRoot).isDirectory()) {
    throw Object.assign(new Error("project root must be a directory"), { code: "ROOT" });
  }
  const home = homeDirectory();
  let dir = projectRoot;
  for (;;) {
    if (!stopsWalk(dir, home) && (hasRealSvc(dir) || hasGitMarker(dir))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir || stopsWalk(dir, home)) break;
    dir = parent;
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

function ensureSvcDir(projectRoot) {
  const svcDir = path.join(projectRoot, ".svc");
  const inspect = () => {
    let svcStat;
    try { svcStat = fs.lstatSync(svcDir); }
    catch (error) {
      if (error.code === "ENOENT") return null;
      throw Object.assign(new Error("cannot inspect .svc"), { code: "REFUSE" });
    }
    if (!svcStat.isDirectory() || svcStat.isSymbolicLink()) {
      throw Object.assign(new Error(".svc must be a regular directory"), { code: "REFUSE" });
    }
    return svcStat;
  };
  if (!inspect()) {
    try { fs.mkdirSync(svcDir); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    if (!inspect()) {
      throw Object.assign(new Error(".svc must be a regular directory"), { code: "REFUSE" });
    }
  }
  return svcDir;
}

function refuseNonRegularStore(file) {
  let existing = null;
  try { existing = fs.lstatSync(file); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) {
    throw Object.assign(new Error("standing rules must be a regular file"), { code: "REFUSE" });
  }
}

function tempCandidates(dir) {
  return Array.from({ length: 16 }, () => path.join(
    dir,
    `.${STORE_NAME}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`,
  ));
}

// Exclusive create: O_EXCL|O_NOFOLLOW never follows a pre-existing symlink.
// `candidates` is the production name list unless a test supplies its own.
export function createFreshTemp(dir, body, candidates = tempCandidates(dir)) {
  const directory = path.resolve(dir);
  for (const tmp of candidates) {
    if (path.dirname(path.resolve(tmp)) !== directory) {
      throw Object.assign(new Error("temporary standing rules path escapes its directory"), { code: "REFUSE" });
    }
    let fd;
    try {
      fd = fs.openSync(tmp, FRESH_FLAGS, 0o644);
    } catch (error) {
      if (error.code === "EEXIST" || error.code === "ELOOP") continue;
      throw error;
    }
    let created;
    try {
      created = fs.fstatSync(fd);
      if (!created.isFile()) {
        throw Object.assign(new Error("temporary standing rules file is not a regular file"), { code: "REFUSE" });
      }
      fs.writeFileSync(fd, body, "utf8");
      fs.fsyncSync(fd);
      const linked = fs.lstatSync(tmp);
      if (
        linked.isSymbolicLink()
        || !linked.isFile()
        || linked.dev !== created.dev
        || linked.ino !== created.ino
      ) {
        throw Object.assign(new Error("temporary standing rules file changed before install"), { code: "REFUSE" });
      }
      return tmp;
    } catch (error) {
      try {
        const linked = fs.lstatSync(tmp);
        if (
          created
          && !linked.isSymbolicLink()
          && linked.isFile()
          && linked.dev === created.dev
          && linked.ino === created.ino
        ) {
          fs.unlinkSync(tmp);
        }
      } catch { /* temp cleanup is best-effort */ }
      throw error;
    } finally {
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }
  }
  throw Object.assign(new Error("could not create a fresh standing rules file"), { code: "REFUSE" });
}

function writeRules(projectRoot, rules) {
  const svcDir = ensureSvcDir(projectRoot);
  const file = storePath(projectRoot);
  refuseNonRegularStore(file);
  const tmp = createFreshTemp(svcDir, renderFile(rules));
  try {
    refuseNonRegularStore(file);
    const linked = fs.lstatSync(tmp);
    if (linked.isSymbolicLink() || !linked.isFile()) {
      throw Object.assign(new Error("temporary standing rules file is not a regular file"), { code: "REFUSE" });
    }
    fs.renameSync(tmp, file);
  } catch (error) {
    try {
      const linked = fs.lstatSync(tmp);
      if (!linked.isSymbolicLink() && linked.isFile()) fs.unlinkSync(tmp);
    } catch { /* temp cleanup is best-effort */ }
    throw error;
  }
}

function withStoreLock(projectRoot, fn) {
  const svcDir = ensureSvcDir(projectRoot);
  const lockPath = path.join(svcDir, LOCK_NAME);
  let fd;
  try {
    fd = fs.openSync(lockPath, LOCK_FLAGS, 0o600);
  } catch (error) {
    if (error.code === "ELOOP" || error.code === "EEXIST") {
      throw Object.assign(new Error("standing rules lock must be a regular file"), { code: "REFUSE" });
    }
    throw error;
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      throw Object.assign(new Error("standing rules lock must be a regular file"), { code: "REFUSE" });
    }
    // Same open-file description stays locked in this process after flock exits.
    const waited = spawnSync("flock", ["-x", "-w", "10", "3"], {
      stdio: ["ignore", "ignore", "pipe", fd],
      encoding: "utf8",
      timeout: 15000,
    });
    if (waited.error || waited.status !== 0) {
      const detail = (waited.stderr || waited.error?.message || `status ${waited.status}`).trim();
      throw Object.assign(new Error(`could not lock standing rules (${detail})`), { code: "REFUSE" });
    }
    return fn();
  } finally {
    try { fs.closeSync(fd); } catch { /* releasing the lock */ }
  }
}

export function addRule(root, text) {
  const projectRoot = resolveRoot(root);
  const rule = normalizeRule(text);
  if (!rule) throw Object.assign(new Error("standing rule text is empty"), { code: "EMPTY" });
  // Read, cap-check, and write share one lock so a second add cannot drop the first.
  return withStoreLock(projectRoot, () => {
    const existing = readRules(projectRoot);
    if (existing.includes(rule)) return { added: false, rule, rules: existing };
    const next = [...existing, rule];
    if (!blockCovers(next)) {
      throw Object.assign(new Error("standing rules block would exceed 2 KB"), { code: "CAP" });
    }
    writeRules(projectRoot, next);
    return { added: true, rule, rules: next };
  });
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
      const kind = result.added ? "recorded" : "duplicate";
      process.stdout.write(`${kind}: ${result.rule}\n`);
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
