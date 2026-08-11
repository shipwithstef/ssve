#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2); const command = argv[0];
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const fail = (message, details = []) => { console.log(JSON.stringify({ ok: false, error: message, details }, null, 2)); process.exit(1); };
const inside = (candidate, root) => candidate === root || candidate.startsWith(`${root}${path.sep}`);
const gitRoot = (repo) => {
  try { return fs.realpathSync(execFileSync("git", ["-C", repo, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()); }
  catch { return null; }
};
if (command !== "check") fail("use: check --apps <apps.json>");
const appsFile = path.resolve(opt("--apps") || ""); if (!opt("--apps") || !fs.existsSync(appsFile)) fail("apps registry not found");
let registry; try { registry = JSON.parse(fs.readFileSync(appsFile, "utf8")); } catch { fail("apps registry is invalid JSON"); }
if (registry.schema_version !== "1.0.0" || !Array.isArray(registry.apps)) fail("unsupported apps registry");
const groups = new Map(); const errors = [];
const ids = new Set(); const repoPaths = new Set();
if (JSON.stringify(registry.apps) !== JSON.stringify([...registry.apps].sort((a, b) => String(a.id).localeCompare(String(b.id))))) errors.push("apps must be sorted by id");
for (const app of registry.apps) {
  if (!app || typeof app !== "object" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(app.id || "")) { errors.push("app id is invalid"); continue; }
  if (ids.has(app.id)) errors.push(`${app.id}: duplicate app id`); else ids.add(app.id);
  if (typeof app.owner !== "string" || !app.owner.trim()) errors.push(`${app.id}: owner is required`);
  if (!["active", "paused", "retired"].includes(app.status)) errors.push(`${app.id}: invalid status`);
  let repo; try { repo = fs.realpathSync(app.repo_path); } catch { errors.push(`${app.id}: repository missing`); continue; }
  if (gitRoot(repo) !== repo) errors.push(`${app.id}: repository is not a Git root`);
  if (repoPaths.has(repo)) errors.push(`${app.id}: duplicate repository path`); else repoPaths.add(repo);
  if (!Array.isArray(app.contracts)) { errors.push(`${app.id}: contracts must be an array`); continue; }
  const contractNames = new Set();
  for (const contract of app.contracts) {
    if (!contract || typeof contract.name !== "string" || !contract.name.trim()) { errors.push(`${app.id}: contract name is required`); continue; }
    if (contractNames.has(contract.name)) { errors.push(`${app.id}/${contract.name}: duplicate contract name`); continue; }
    contractNames.add(contract.name);
    if (!contract.path || path.isAbsolute(contract.path)) { errors.push(`${app.id}/${contract.name}: path must be relative`); continue; }
    const candidate = path.resolve(repo, contract.path);
    try {
      const real = fs.realpathSync(candidate); if (!inside(real, repo) || !fs.statSync(real).isFile()) throw new Error();
      const hash = crypto.createHash("sha256").update(fs.readFileSync(real)).digest("hex");
      if (!groups.has(contract.name)) groups.set(contract.name, []);
      groups.get(contract.name).push({ app_id: app.id, path: contract.path, sha256: hash });
    } catch { errors.push(`${app.id}/${contract.name}: contract is missing, escaping, or not a regular file`); }
  }
}
const contracts = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, instances]) => ({ name, status: new Set(instances.map((i) => i.sha256)).size > 1 ? "drift" : "aligned", instances: instances.sort((a, b) => a.app_id.localeCompare(b.app_id)) }));
for (const contract of contracts) if (contract.status === "drift") errors.push(`${contract.name}: content drift across apps`);
if (errors.length) fail("cross-app contract check failed", errors);
console.log(JSON.stringify({ ok: true, contracts }, null, 2));
