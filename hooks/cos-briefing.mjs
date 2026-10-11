#!/usr/bin/env node

// Optional: a bundle without the counter simply does not count.
const { failOpen, failOpenAt } = await import("./lib/fail-open.mjs").catch(() => ({ failOpen() {}, failOpenAt() {} }));
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CACHE_TTL_MS = 30_000;
const MAX_OUTPUT_BYTES = 16 * 1024;
const hookDir = path.dirname(fileURLToPath(import.meta.url));
const companyStateCli = path.resolve(hookDir, "../scripts/company-state.mjs");
const outputFormat = process.argv.includes("--format") ? process.argv[process.argv.indexOf("--format") + 1] : "text";

function emit(text) {
  if (outputFormat === "gemini") process.stdout.write(`${JSON.stringify(text ? { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } } : {})}\n`);
  else if (text) process.stdout.write(text);
}

function readPayload() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid payload");
  return value;
}

function payloadCwd(payload) {
  const candidates = [payload.cwd, payload.working_directory, payload.workspace?.current_dir];
  const selected = candidates.find((value) => typeof value === "string" && value.length > 0);
  return path.resolve(selected || process.cwd());
}

function runCompanyState(args) {
  const result = spawnSync(process.execPath, [companyStateCli, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
  });
  if (result.status !== 0 || result.error) throw new Error("company-state command failed");
  return result.stdout;
}

function fingerprint(stateDir) {
  const hash = crypto.createHash("sha256");
  hash.update(stateDir);
  for (const name of ["SCHEMA_VERSION", "state.md", "open-items.jsonl", "decisions-pending.jsonl", "apps.json"]) {
    const file = path.join(stateDir, name);
    hash.update(`\0${name}\0`);
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw new Error("not a file");
      hash.update(`${stat.size}:${stat.mtimeMs}`);
    } catch {
      hash.update("missing");
    }
  }
  return hash.digest("hex");
}

function bounded(text) {
  const bytes = Buffer.from(text, "utf8");
  return bytes.length <= MAX_OUTPUT_BYTES ? text : bytes.subarray(0, MAX_OUTPUT_BYTES).toString("utf8");
}

function writeCacheAtomic(cachePath, value) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true, mode: 0o700 });
  const temp = `${cachePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: "wx" });
    fs.renameSync(temp, cachePath);
  } finally {
    try { fs.unlinkSync(temp); } catch {}
  }
}

// Cheap presence test before any process spawn: the briefing exists only where
// company-state.mjs could resolve a state dir (a linked company repo, or a
// company-state/ directory at the repository root or, outside a repository, in
// the cwd). Every other session pays one stat walk, not two spawns.
function companyStateMayExist(cwd) {
  let dir = cwd;
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      return fs.existsSync(path.join(dir, ".svc", "company-link.json")) || fs.existsSync(path.join(dir, "company-state"));
    }
    const parent = path.dirname(dir);
    if (parent === dir) return fs.existsSync(path.join(cwd, "company-state"));
    dir = parent;
  }
}

try {
  const payload = readPayload();
  const cwd = payloadCwd(payload);
  failOpenAt({ cwd });
  if (!companyStateMayExist(cwd)) { emit(""); process.exit(0); }
  const context = JSON.parse(runCompanyState(["resolve", "--repo", cwd, "--json"]));
  const stateDir = fs.realpathSync(context.stateDir);
  const inputFingerprint = fingerprint(stateDir);
  const cacheRoot = process.env.XDG_CACHE_HOME
    ? path.resolve(process.env.XDG_CACHE_HOME)
    : path.join(os.homedir(), ".cache");
  const cachePath = path.join(cacheRoot, "svc", "cos-briefing", `${crypto.createHash("sha256").update(stateDir).digest("hex")}.json`);
  const now = process.env.SVC_HOOK_TEST === "1" && process.env.SVC_NOW_MS !== undefined ? Number(process.env.SVC_NOW_MS) : Date.now();
  if (!Number.isInteger(now) || now < 0) throw new Error("invalid clock");

  let cached = null;
  try { cached = JSON.parse(fs.readFileSync(cachePath, "utf8")); } catch {}
  const age = cached ? now - cached.created_at_ms : -1;
  if (cached?.schema_version === 1 && cached.state_dir === stateDir &&
      cached.input_fingerprint === inputFingerprint && typeof cached.output === "string" &&
      age >= 0 && age < CACHE_TTL_MS) {
    emit(bounded(cached.output));
    process.exit(0);
  }

  const output = bounded(runCompanyState(["briefing", "--state-dir", stateDir]));
  writeCacheAtomic(cachePath, {
    schema_version: 1,
    state_dir: stateDir,
    input_fingerprint: inputFingerprint,
    created_at_ms: now,
    output,
  });
  emit(output);
} catch (error) {
  failOpen("cos-briefing", error);
  emit("");
  process.exit(0);
}
