#!/usr/bin/env node
/**
 * verify-claims.mjs — reproduce every quantitative claim in references/claims.json.
 *
 *   node scripts/verify-claims.mjs [--all] [--json] [--only id,id]
 *
 * Runs each claim's command from the repository root and checks its exit code or a
 * value in its JSON output against the stated bound. Exit 1 when any claim fails.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const pick = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function judge(claim, { status, stdout }) {
  if (claim.exit !== undefined && status !== claim.exit) return { ok: false, observed: `exit ${status}` };
  if (!claim.json) return { ok: true, observed: `exit ${status}` };
  let value;
  try { value = pick(JSON.parse(stdout), claim.json); } catch { return { ok: false, observed: "output is not JSON" }; }
  if (typeof value !== "number") return { ok: false, observed: `${claim.json} missing` };
  const ok = (claim.max === undefined || value <= claim.max) && (claim.min === undefined || value >= claim.min);
  return { ok, observed: value };
}

function main(argv) {
  const { claims } = JSON.parse(fs.readFileSync(path.join(ROOT, "references", "claims.json"), "utf8"));
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null;
  const results = [];
  for (const c of claims) {
    if (only ? !only.includes(c.id) : c.slow && !argv.includes("--all")) continue;
    const r = spawnSync(c.command[0] === "node" ? process.execPath : c.command[0], c.command.slice(1), { cwd: ROOT, encoding: "utf8", timeout: 900000, maxBuffer: 64 << 20 });
    results.push({ id: c.id, claim: c.claim, ...judge(c, r), bound: c.max !== undefined ? `<= ${c.max}` : c.min !== undefined ? `>= ${c.min}` : `exit ${c.exit}` });
  }
  if (argv.includes("--json")) process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  else for (const r of results) process.stdout.write(`${r.ok ? "ok  " : "FAIL"} ${r.id.padEnd(14)} observed ${r.observed} (${r.bound}) — ${r.claim}\n`);
  return results.every((r) => r.ok) ? 0 : 1;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
