#!/usr/bin/env node
/**
 * export-run.mjs — prepare one eval run's build for its own private repository.
 *
 *   node scripts/export-run.mjs --results <results.json> --index <n> --out <dir>
 *        [--web <web-probes.json>] [--learning <learning.json>]
 *
 * Copies the kept build (no node_modules, no grader file) and writes SCORES.md with
 * everything measured about it: hidden checks, the blind judge's claims, the quality
 * probes, and, when given, the web probes and the learning eval. Prints the suggested
 * repository name. Creating and pushing the repository is done by the caller.
 */
import fs from "node:fs";
import path from "node:path";
import { isMain } from "./lib/is-main.mjs";

const fmt = (v) => (v === null || v === undefined ? "n/a" : typeof v === "object" ? (v.value ?? "n/a") : String(v));

export function repoName(row, date = new Date().toISOString().slice(0, 10)) {
  return `ssve-eval-${row.task}-${row.arm}-${row.rep + 1}-${date}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export function scoresMarkdown(row, { web = null, learning = null } = {}) {
  const lines = [`# Scores: ${row.task}, ${row.arm} run ${row.rep + 1}`, "", `Built by ${row.model_id || row.model} on ${row.started_at || "?"}; ${row.turns ?? "?"} turns, $${(row.cost_usd ?? 0).toFixed(2)}, ${Math.round((row.wall_ms || 0) / 60000)} min.`, ""];
  lines.push("## Hidden checks", "", `${row.hidden_pass}/${row.hidden_total} passed.${row.hidden_failures?.length ? " Failed: " + row.hidden_failures.map((f) => f.split(":")[0]).join("; ") + "." : ""}`, "");
  if (row.judge_scores) {
    lines.push(`## Blind judge: ${row.judge_total} of ${Object.keys(row.judge_scores).length}`, "", "| claim | met |", "|---|---|", ...Object.entries(row.judge_scores).map(([k, v]) => `| ${k} | ${v ? "yes" : "no"} |`), "");
  }
  const p = row.probes || {};
  lines.push("## Code quality", "", `- Source lines ${p.size?.source_loc ?? "n/a"}, test lines ${p.size?.test_loc ?? "n/a"}, dependencies ${p.size?.dependencies ?? "n/a"}`, `- Mutation score of its own tests: ${p.mutation?.score ?? p.mutation?.reason ?? "n/a"}`, `- Commits ${p.history?.commits ?? "n/a"}, first after ${p.history?.first_commit_min ?? "n/a"} min`, "");
  if (web) {
    lines.push("## Design, performance and security (web probes)", "", "| metric | value |", "|---|---|");
    for (const area of ["design", "performance", "security"]) for (const [k, v] of Object.entries(web[area] || {})) lines.push(`| ${area}.${k} | ${fmt(v)} |`);
    lines.push("");
  }
  if (learning) {
    lines.push("## What a player learns (learning eval)", "", `Score ${learning.game.score.toFixed(2)} (ideas taught ${learning.game.ideas_taught} of 8), control ${learning.control.score.toFixed(2)}, gain ${learning.gain}.`, "");
  }
  return lines.join("\n");
}

export function exportRun({ results, index, out, web = null, learning = null }) {
  const row = JSON.parse(fs.readFileSync(results, "utf8")).rows[index];
  if (!row?.artifact || !fs.existsSync(row.artifact)) throw new Error(`row ${index} has no kept build`);
  fs.cpSync(row.artifact, out, { recursive: true, filter: (src) => !/node_modules|__hidden\.test\.mjs$/.test(src) });
  fs.writeFileSync(path.join(out, "SCORES.md"), scoresMarkdown(row, { web, learning }) + "\n");
  return { repo: repoName(row), out, row: { task: row.task, arm: row.arm, rep: row.rep } };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  if (!arg("--results") || arg("--index") === undefined || !arg("--out")) { process.stderr.write("usage: export-run.mjs --results <json> --index <n> --out <dir> [--web <json>] [--learning <json>]\n"); process.exit(2); }
  const load = (f) => (f ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
  try { process.stdout.write(JSON.stringify(exportRun({ results: arg("--results"), index: Number(arg("--index")), out: arg("--out"), web: load(arg("--web")), learning: load(arg("--learning")) })) + "\n"); }
  catch (e) { process.stderr.write(`export-run: ${e.message}\n`); process.exit(1); }
}
