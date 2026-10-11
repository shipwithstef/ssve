#!/usr/bin/env node
// Proves the E and P graders: for each task and component, a reference build must score at
// least 0.8 and a stub build (the unchanged repository) at most 0.4. A grader that fails
// this is wrong or unfair, and is fixed before any arm is scored with it.
//
//   node test-framework/outcome-evals/northstar/graders/check.mjs [--tasks a,b] [--components E,P] [--json]
//
// Reference = the task's repo/ + its ref/ overlay + northstar/ref-ep/<task>/ (grader-side
// additions: a README, tests or a fuller build where the shipped reference has none; refs
// are never shown to an arm). The stub is the prepared task directory untouched.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { NORTHSTAR, REPO_ROOT, TASKS } from "./lib-ep.mjs";
import { gradeComponents } from "./index.mjs";

export const REF_MIN = 0.8;
export const STUB_MAX = 0.4;
// What the matrix applies to each task among the components this module grades.
export const MATRIX_EP = {
  "yoga-studio": ["E", "P"], "ai-quest": ["E", "P"], "waitlist-feature": ["E", "P"],
  "bugfix-rootcause": ["E", "P"], "security-payments": ["E", "P"],
};

async function outcomeEval() { return import(pathToFileURL(path.join(REPO_ROOT, "scripts", "outcome-eval.mjs")).href); }

export async function buildDir(task, kind) {
  const { prepare } = await outcomeEval();
  const dir = prepare(task);
  if (kind === "stub") return dir;
  const ref = path.join(TASKS, task, "ref");
  if (fs.existsSync(ref)) fs.cpSync(ref, dir, { recursive: true });
  else if (fs.existsSync(path.join(TASKS, task, "ref.mjs"))) fs.copyFileSync(path.join(TASKS, task, "ref.mjs"), path.join(dir, "solution.mjs"));
  const extra = path.join(NORTHSTAR, "ref-ep", task);
  if (fs.existsSync(extra)) fs.cpSync(extra, dir, { recursive: true });
  return dir;
}

export function verdict(kind, score) {
  return kind === "ref" ? score >= REF_MIN : score <= STUB_MAX;
}

export async function checkTask(task, components) {
  const rows = [];
  for (const kind of ["ref", "stub"]) {
    const dir = await buildDir(task, kind);
    try {
      const r = await gradeComponents(dir, task, { components });
      for (const c of components) rows.push({ task, kind, component: c, score: r[c], ok: verdict(kind, r[c]), checks: r.details[c].checks, error: r.details[c].error });
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  return rows;
}

async function main(argv) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const tasks = (opt("--tasks") || Object.keys(MATRIX_EP).join(",")).split(",").filter(Boolean);
  const only = opt("--components")?.split(",");
  const all = [];
  for (const task of tasks) {
    const components = (MATRIX_EP[task] || []).filter((c) => !only || only.includes(c));
    if (!components.length) { process.stderr.write(`${task}: no E or P component in the matrix\n`); continue; }
    const rows = await checkTask(task, components);
    all.push(...rows);
    for (const r of rows) {
      process.stdout.write(`${r.ok ? "ok  " : "FAIL"} ${task} ${r.component} ${r.kind} ${r.score.toFixed(2)} (${r.kind === "ref" ? `need >= ${REF_MIN}` : `need <= ${STUB_MAX}`})${r.error ? ` ERROR ${r.error}` : ""}\n`);
      if (!r.ok || argv.includes("--verbose")) for (const c of r.checks) if (argv.includes("--verbose") || (r.kind === "ref" ? !c.pass : c.pass)) process.stdout.write(`       ${c.pass ? "pass" : "FAIL"} ${c.name}: ${c.detail}\n`);
    }
  }
  if (argv.includes("--json")) fs.writeFileSync(path.join(os.tmpdir(), "northstar-ep-check.json"), JSON.stringify(all, null, 2));
  const bad = all.filter((r) => !r.ok);
  process.stdout.write(bad.length ? `graders check: ${bad.length} problem(s)\n` : `graders check: ${all.length} cells sound\n`);
  return bad.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`${e.stack}\n`); process.exit(2); });
