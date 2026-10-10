#!/usr/bin/env node
/**
 * svc-repo.mjs — turn svc on or off for one repository without uninstalling it.
 *
 *   node scripts/svc-repo.mjs off    [--dir <repo>] [--shared] [--hard]
 *   node scripts/svc-repo.mjs on     [--dir <repo>] [--shared]
 *   node scripts/svc-repo.mjs status [--dir <repo>] [--json]
 *
 * off writes the repo's .claude/settings.local.json (or .claude/settings.json with
 * --shared, for the whole team):
 *   - skillOverrides: every svc skill -> "user-invocable-only" (no listing cost, /name
 *     still works) or "off" with --hard (hidden everywhere).
 *   - env.SVC_REPO_MODE = "off": svc-hook-boundary skips every svc hook in advisory
 *     mode. Enforce mode ignores it, so a repo file can never switch off enforcement.
 * on removes exactly those keys. Other settings are left untouched.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFF_VALUES = new Set(["user-invocable-only", "off"]);

export function svcSkillNames(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, "skills-manifest.json"), "utf8")).includedSkills;
}

function repoRoot(dir) {
  try { return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return path.resolve(dir); }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return {}; throw new Error(`${file} is not valid JSON: ${e.message}`); }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write through a symlinked settings file (dotfile managers) instead of replacing the link.
  try { file = fs.realpathSync(file); } catch { /* new file */ }
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

// Earlier values of svc skills' overrides are kept in env.SVC_REPO_SAVED so "on" restores them.
export function applyOff(settings, skills, { hard = false } = {}) {
  const out = structuredClone(settings);
  out.skillOverrides = { ...(out.skillOverrides || {}) };
  const saved = out.env?.SVC_REPO_SAVED ? JSON.parse(out.env.SVC_REPO_SAVED) : {};
  for (const s of skills) {
    if (out.skillOverrides[s] !== undefined && !(s in saved) && out.env?.SVC_REPO_MODE !== "off") saved[s] = out.skillOverrides[s];
    out.skillOverrides[s] = hard ? "off" : "user-invocable-only";
  }
  out.env = { ...(out.env || {}), SVC_REPO_MODE: "off" };
  if (Object.keys(saved).length) out.env.SVC_REPO_SAVED = JSON.stringify(saved);
  return out;
}

export function applyOn(settings, skills) {
  const out = structuredClone(settings);
  const saved = out.env?.SVC_REPO_SAVED ? JSON.parse(out.env.SVC_REPO_SAVED) : {};
  if (out.skillOverrides) {
    for (const s of skills) {
      if (!OFF_VALUES.has(out.skillOverrides[s])) continue;
      if (s in saved) out.skillOverrides[s] = saved[s];
      else delete out.skillOverrides[s];
    }
    if (!Object.keys(out.skillOverrides).length) delete out.skillOverrides;
  }
  if (out.env) {
    delete out.env.SVC_REPO_MODE;
    delete out.env.SVC_REPO_SAVED;
    if (!Object.keys(out.env).length) delete out.env;
  }
  return out;
}

export function describe(settings, skills) {
  const hidden = skills.filter((s) => OFF_VALUES.has(settings.skillOverrides?.[s])).length;
  return { hooks: settings.env?.SVC_REPO_MODE === "off" ? "off" : "on", skills_hidden: hidden, skills_total: skills.length };
}

function main(argv) {
  const cmd = argv[0];
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (name) => argv.includes(name);
  if (!["on", "off", "status"].includes(cmd)) {
    process.stderr.write("usage: svc-repo.mjs on|off|status [--dir <repo>] [--shared] [--hard] [--json]\n");
    return 2;
  }
  const root = repoRoot(opt("--dir") || process.cwd());
  const skills = svcSkillNames();
  const files = { local: path.join(root, ".claude", "settings.local.json"), shared: path.join(root, ".claude", "settings.json") };
  if (cmd === "status") {
    const report = { repo: root, local: describe(readJson(files.local), skills), shared: describe(readJson(files.shared), skills) };
    const effective = report.local.hooks === "off" || report.shared.hooks === "off" ? "off" : "on";
    if (has("--json")) process.stdout.write(JSON.stringify({ ...report, effective }, null, 2) + "\n");
    else process.stdout.write(`svc in ${root}: ${effective} (local: hooks ${report.local.hooks}, ${report.local.skills_hidden}/${report.local.skills_total} skills hidden; shared: hooks ${report.shared.hooks}, ${report.shared.skills_hidden} hidden)\n`);
    return 0;
  }
  const file = has("--shared") ? files.shared : files.local;
  const before = readJson(file);
  const after = cmd === "off" ? applyOff(before, skills, { hard: has("--hard") }) : applyOn(before, skills);
  writeJson(file, after);
  process.stdout.write(`svc ${cmd} for ${root} (${path.relative(root, file)}). Takes effect in the next session.\n`);
  if (cmd === "off") process.stdout.write(`/skill-name still works${has("--hard") ? " only after svc on" : ""}. Still loaded: the always-on rules in ~/.claude/rules and the svc agent descriptions (uninstall or disable those globally if you need zero svc context).\n`);
  const other = has("--shared") ? files.local : files.shared;
  if (cmd === "on" && describe(readJson(other), skills).hooks === "off") {
    process.stdout.write(`Note: ${path.relative(root, other)} still turns svc off; run "on${has("--shared") ? "" : " --shared"}" to clear it.\n`);
  }
  return 0;
}

// Main-module check that survives the symlinked install path (~/.claude/skills/...).
const isMain = (() => { try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) process.exit(main(process.argv.slice(2)));
