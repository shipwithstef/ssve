#!/usr/bin/env node
/**
 * mirror-ledger.mjs — the "mirror protocol": record whether each skill still beats the
 * bare model, per model and date, and turn that history into advice.
 *
 *   node scripts/mirror-ledger.mjs record <skill-ab-eval report.json> --model <model-id> [--harness <name@version>] [--ledger <file>]
 *   node scripts/mirror-ledger.mjs advise [--ledger <file>] [--json]
 *
 * Rows go to .svc/mirror-ledger.jsonl (append-only). advise reads the newest model's
 * rows per skill and proposes, most urgent first:
 *   review   the skill made the current model worse (regresses)
 *   caught-up the skill beat an older model but ties the current one: slim or retire it
 *             unless it owns a contract artifact other svc tooling reads
 *   slim     no gain on the current model in two or more runs
 *   keep     still earns its tokens on the current model
 * Skills in skills-manifest.json with no rows are listed as unmeasured blind spots.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { appendJsonlLine } from "./state-io.mjs";
import { readOutcomes } from "./route-model.mjs";
import { svcSkillNames } from "./svc-repo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LEDGER = path.join(ROOT, ".svc", "mirror-ledger.jsonl");

export function rowsFromReport(report, { model, harness = null, date = new Date().toISOString() }) {
  return (report.tasks || []).map((t) => ({
    date, skill: t.skill, task: t.task, model, harness, verdict: t.verdict,
    pass_delta: t.pass_delta, bare_pass: t.bare?.pass_rate ?? null, with_pass: t.with_skill?.pass_rate ?? null, token_delta: t.token_delta ?? null,
  }));
}

export function advise(rows, included = []) {
  const bySkill = new Map();
  for (const r of rows) (bySkill.get(r.skill) || bySkill.set(r.skill, []).get(r.skill)).push(r);
  const out = [];
  for (const [skill, rs] of bySkill) {
    rs.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const current = rs[rs.length - 1].model;
    const now = rs.filter((r) => r.model === current);
    const before = rs.filter((r) => r.model !== current);
    const last = now[now.length - 1];
    let action;
    let why;
    if (last.verdict === "regresses") { action = "review"; why = `makes ${current} worse (pass delta ${last.pass_delta})`; }
    else if (now.every((r) => r.verdict === "no-gain") && before.some((r) => r.verdict === "earns-keep")) {
      const old = before.filter((r) => r.verdict === "earns-keep").pop().model;
      action = "caught-up"; why = `earned its tokens on ${old}, ties on ${current}: slim or retire unless it owns a contract artifact`;
    } else if (now.length >= 2 && now.slice(-2).every((r) => r.verdict === "no-gain")) { action = "slim"; why = `no gain on ${current} in the last 2 runs`; }
    else if (last.verdict === "earns-keep") { action = "keep"; why = `beats bare ${current} by ${last.pass_delta}`; }
    else { action = "watch"; why = `one no-gain run on ${current}; run again before acting`; }
    out.push({ skill, model: current, action, why, runs_on_model: now.length, last_date: last.date });
  }
  const order = { review: 0, "caught-up": 1, slim: 2, watch: 3, keep: 4 };
  out.sort((a, b) => order[a.action] - order[b.action] || a.skill.localeCompare(b.skill));
  const unmeasured = included.filter((s) => !bySkill.has(s));
  return { proposals: out, unmeasured };
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const ledger = opt("--ledger") || DEFAULT_LEDGER;
  if (cmd === "record") {
    const file = rest[0];
    const model = opt("--model");
    if (!file || !model) { process.stderr.write("usage: mirror-ledger.mjs record <report.json> --model <id> [--harness name@version] [--ledger file]\n"); return 2; }
    const rows = rowsFromReport(JSON.parse(fs.readFileSync(file, "utf8")), { model, harness: opt("--harness") || null });
    if (!rows.length) { process.stderr.write("mirror-ledger: report has no tasks\n"); return 2; }
    for (const r of rows) appendJsonlLine(ledger, r);
    process.stdout.write(`recorded ${rows.length} rows to ${ledger}\n`);
    return 0;
  }
  if (cmd === "advise") {
    let included = [];
    try { included = svcSkillNames(); } catch { /* outside the framework repo */ }
    const result = advise(readOutcomes([ledger]), included);
    if (rest.includes("--json")) { process.stdout.write(JSON.stringify(result, null, 2) + "\n"); return 0; }
    if (!result.proposals.length) process.stdout.write("no mirror runs recorded yet: run scripts/skill-ab-eval.mjs, then mirror-ledger.mjs record\n");
    for (const p of result.proposals) process.stdout.write(`${p.action.padEnd(9)} ${p.skill.padEnd(24)} ${p.why}\n`);
    if (result.unmeasured.length) process.stdout.write(`unmeasured (${result.unmeasured.length}): ${result.unmeasured.slice(0, 12).join(", ")}${result.unmeasured.length > 12 ? ", …" : ""}\n`);
    return 0;
  }
  process.stderr.write("usage: mirror-ledger.mjs record <report.json> --model <id> | advise [--json]\n");
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
