#!/usr/bin/env node
/**
 * routing-eval.mjs — do the skill descriptions at a git ref route requests to the right skill?
 *
 *   node scripts/routing-eval.mjs run --refs origin/main,HEAD [--models haiku] [--reps 2]
 *                                     [--out <results.json>]
 *   node scripts/routing-eval.mjs listing <ref>     # print the listing a model would see
 *
 * For each ref, the listing is built the way Claude Code lists skills: every skill in that
 * ref's skills-manifest.json whose SKILL.md does not set disable-model-invocation, shown as
 * "name: description". A model in an isolated, tool-free session picks one skill (or none)
 * for each request in test-framework/outcome-evals/routing/corpus.json. A pick is correct
 * when it is in the case's accept list. Results compare refs with the seeded statistics
 * from outcome-eval.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { compareSamples } from "./outcome-eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = path.join(ROOT, "test-framework", "outcome-evals", "routing", "corpus.json");

const gitShow = (ref, file) => {
  const r = spawnSync("git", ["show", `${ref}:${file}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  return r.status === 0 ? r.stdout : null;
};

// The frontmatter description (plain, quoted or folded block) and the invocation flag.
export function parseFrontmatter(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text || "")?.[1] || "";
  const lines = fm.split("\n");
  let description = "";
  const i = lines.findIndex((l) => /^description:/.test(l));
  if (i >= 0) {
    const first = lines[i].replace(/^description:\s*/, "");
    if (/^[>|][-+]?\s*$/.test(first)) {
      const body = [];
      for (const l of lines.slice(i + 1)) { if (/^\S/.test(l)) break; body.push(l.trim()); }
      description = body.join(" ").trim();
    } else description = first.replace(/^["']|["']$/g, "").trim();
  }
  return { description, disabled: /^disable-model-invocation:\s*true\s*$/m.test(fm) };
}

export function listing(ref) {
  const manifest = JSON.parse(gitShow(ref, "skills-manifest.json"));
  const skills = [];
  for (const name of manifest.includedSkills) {
    const { description, disabled } = parseFrontmatter(gitShow(ref, `skills/${name}/SKILL.md`));
    if (!disabled) skills.push({ name, description });
  }
  return skills;
}

const SCHEMA = JSON.stringify({ type: "object", properties: { skill: { type: "string" } }, required: ["skill"] });

function pick(model, skills, request) {
  const prompt = [
    "These are the skills available in this session. Each line is the skill's name and its description.",
    skills.map((s) => `- ${s.name}: ${s.description}`).join("\n"),
    `The user's request:\n<request>\n${request}\n</request>`,
    "Which one skill should be invoked for this request? Answer with its exact name, or \"none\" if the request is a plain question or task that needs no skill.",
  ].join("\n\n");
  return new Promise((resolve) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "re-"));
    const child = spawn("claude", ["-p", "--model", model, "--tools", "", "--setting-sources", "", "--strict-mcp-config", "--no-session-persistence", "--output-format", "json", "--json-schema", SCHEMA], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.end(prompt);
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 180000);
    child.on("close", () => {
      clearTimeout(timer);
      fs.rmSync(dir, { recursive: true, force: true });
      let j = null; try { j = JSON.parse(out); } catch {}
      resolve(j?.structured_output?.skill ? { skill: String(j.structured_output.skill).trim().replace(/^\//, ""), cost_usd: j.total_cost_usd || 0 } : { error: j?.subtype || "no answer" });
    });
  });
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export function summarize(rows) {
  const out = {};
  const refs = [...new Set(rows.map((r) => r.ref))];
  for (const ref of refs) for (const model of [...new Set(rows.map((r) => r.model))]) {
    const xs = rows.filter((r) => r.ref === ref && r.model === model && !r.error);
    out[`${ref}|${model}`] = { accuracy: xs.length ? +(xs.filter((r) => r.correct).length / xs.length).toFixed(3) : null, n: xs.length, errors: rows.filter((r) => r.ref === ref && r.model === model && r.error).length, misses: xs.filter((r) => !r.correct).map((r) => `${r.case}->${r.skill}`) };
  }
  if (refs.length === 2) for (const model of [...new Set(rows.map((r) => r.model))]) {
    const v = (ref) => rows.filter((r) => r.ref === ref && r.model === model && !r.error).map((r) => (r.correct ? 1 : 0));
    out[`${refs[1]}_vs_${refs[0]}|${model}`] = compareSamples(v(refs[1]), v(refs[0]));
  }
  return out;
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (argv[0] === "listing") { for (const s of listing(argv[1] || "HEAD")) process.stdout.write(`- ${s.name}: ${s.description}\n`); return 0; }
  if (argv[0] !== "run") { process.stderr.write("usage: routing-eval.mjs run --refs a,b [--models haiku] [--reps 2] [--out f] | listing <ref>\n"); return 2; }
  const refs = opt("--refs", "origin/main,HEAD").split(","), models = opt("--models", "haiku").split(","), reps = Number(opt("--reps", 2));
  const { cases } = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  const listings = Object.fromEntries(refs.map((r) => [r, listing(r)]));
  for (const r of refs) process.stderr.write(`${r}: ${listings[r].length} model-invocable skills, ${listings[r].reduce((a, s) => a + s.name.length + s.description.length + 4, 0)} chars\n`);
  const jobs = [];
  for (const c of cases) for (const ref of refs) for (const model of models) for (let rep = 0; rep < reps; rep++) jobs.push({ c, ref, model, rep });
  const rows = await pool(jobs, Number(opt("--parallel", 8)), async ({ c, ref, model, rep }) => {
    const a = await pick(model, listings[ref], c.request);
    const row = { case: c.id, ref, model, rep, accept: c.accept };
    if (a.error) return { ...row, error: a.error };
    return { ...row, skill: a.skill, correct: c.accept.includes(a.skill), cost_usd: a.cost_usd };
  });
  const result = { ran_at: new Date().toISOString(), refs, models, reps, listing_sizes: Object.fromEntries(refs.map((r) => [r, listings[r].length])), summary: summarize(rows), rows };
  const out = opt("--out");
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result.summary, null, 2) + "\n");
  return 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
