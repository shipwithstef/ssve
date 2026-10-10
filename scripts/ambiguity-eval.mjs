#!/usr/bin/env node
/**
 * ambiguity-eval.mjs — does teaching the field's words first cut the back-and-forth?
 *
 *   node scripts/ambiguity-eval.mjs run [--builder haiku] [--owner haiku] [--judge sonnet]
 *        [--reps 2] [--cases chess,quiz] [--out <results.json>]
 *   node scripts/ambiguity-eval.mjs summarize <results.json>
 *
 * Each case is a one-line request from someone outside the field, with the intent they
 * actually hold (hidden from the builder) and the claims a correct spec must meet
 * (test-framework/outcome-evals/ambiguity/corpus.json). A simulated owner answers only
 * from that intent, in plain words, and never volunteers what was not asked. Arms:
 *   direct  the builder asks what it needs, then writes the spec
 *   terms   the builder first names 10 expert terms and the one question to settle
 *           first (analyze-domain terms mode), then asks and writes the spec
 * A blind judge scores the final spec against the claims. Metrics: owner rounds, cost,
 * and the share of claims met. Terms-first is kept only if it meets as many claims in
 * fewer rounds or at lower cost (outcome-eval promotionDecision).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { claude } from "./lib/harness-transports.mjs";
import { compareSamples, pool } from "./outcome-eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = path.join(ROOT, "test-framework/outcome-evals/ambiguity/corpus.json");
export const ARMS = ["direct", "terms"];
const MAX_ROUNDS = 4;

const STEP_SCHEMA = {
  type: "object", additionalProperties: false, required: ["kind", "text"],
  properties: { kind: { enum: ["questions", "spec"] }, text: { type: "string" } },
};
const JUDGE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["met"],
  properties: { met: { type: "array", items: { type: "boolean" } } },
};

export function builderPrompt(arm, request, transcript) {
  const intro = arm === "terms"
    ? `Before planning, teach the person the words of this field. First reply (kind "questions"): name 10 terms an expert would use for what they are building; for each, one line on what it means and one on how it changes what they should ask for. Then name the one question to settle first and what it decides, and ask it. After that, keep asking only what you still need, then write the spec.`
    : `Ask what you need to know, then write the spec.`;
  return `You are planning software for someone who is not an expert in it. Request: "${request}"\n\n${intro}\n\nEach reply is either kind "questions" (what you ask the person now, in plain words) or kind "spec" (the final one-page spec: who uses it, what it does, what it leaves out). You may ask at most ${MAX_ROUNDS} times; ask only what changes what you build.\n\nConversation so far:\n${transcript || "(nothing yet)"}`;
}

export function ownerPrompt(intent, questions) {
  return `You are a person who asked for some software. What you actually want: "${intent}"\n\nYou are not an expert and do not know the technical words. Answer the questions below in plain, short sentences, only from what you want. Do not volunteer anything they did not ask about. If a question uses words you would not know, say so briefly and answer what you can.\n\nQuestions:\n${questions}`;
}

export function judgePrompt(c, spec) {
  return `Decide for each claim whether this spec clearly meets it. A claim the spec contradicts or leaves out is false.\n\nClaims:\n${c.claims.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nSpec:\n${spec}\n\nReply with met: one boolean per claim, in order.`;
}

async function oneRun(c, arm, opts, ask = claude.ask.bind(claude)) {
  let transcript = "", rounds = 0, cost = 0, spec = null;
  for (let turn = 0; turn <= MAX_ROUNDS; turn++) {
    const step = await ask({ prompt: builderPrompt(arm, c.request, transcript) + (rounds >= MAX_ROUNDS ? "\n\nYou have no questions left: write the spec now." : ""), schema: STEP_SCHEMA, model: opts.builder });
    if (step.error) return { case: c.id, arm, error: step.error };
    cost += step.cost_usd || 0;
    if (step.output.kind === "spec" || rounds >= MAX_ROUNDS) { spec = step.output.text; break; }
    const answer = await ask({ prompt: ownerPrompt(c.intent, step.output.text), model: opts.owner });
    if (answer.error) return { case: c.id, arm, error: answer.error };
    cost += answer.cost_usd || 0;
    rounds++;
    transcript += `\nYou asked:\n${step.output.text}\nThey answered:\n${answer.output}\n`;
  }
  const verdict = await ask({ prompt: judgePrompt(c, spec), schema: JUDGE_SCHEMA, model: opts.judge });
  if (verdict.error) return { case: c.id, arm, error: verdict.error };
  const met = verdict.output.met.slice(0, c.claims.length);
  return { case: c.id, arm, rounds, cost_usd: Math.round((cost + (verdict.cost_usd || 0)) * 10000) / 10000, claims_met: met.filter(Boolean).length, claims: c.claims.length, score: met.filter(Boolean).length / c.claims.length, spec };
}

export function summarize(rows) {
  const ok = rows.filter((r) => !r.error);
  const by = (arm, k) => ok.filter((r) => r.arm === arm).map((r) => r[k]);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const out = { n: Object.fromEntries(ARMS.map((a) => [a, by(a, "score").length])), errors: rows.length - ok.length };
  for (const k of ["score", "rounds", "cost_usd"]) {
    out[k] = Object.fromEntries(ARMS.map((a) => [a, mean(by(a, k))]));
    if (by("terms", k).length && by("direct", k).length) out[`${k}_terms_minus_direct`] = compareSamples(by("terms", k), by("direct", k));
  }
  return out;
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (argv[0] === "summarize") { process.stdout.write(JSON.stringify(summarize(JSON.parse(fs.readFileSync(argv[1], "utf8")).rows), null, 2) + "\n"); return 0; }
  if (argv[0] !== "run") { process.stderr.write("usage: ambiguity-eval.mjs run [...] | summarize <results.json>\n"); return 2; }
  const opts = { builder: opt("--builder", "haiku"), owner: opt("--owner", "haiku"), judge: opt("--judge", "sonnet") };
  const only = opt("--cases", null)?.split(",");
  const cases = JSON.parse(fs.readFileSync(CORPUS, "utf8")).cases.filter((c) => !only || only.includes(c.id));
  const reps = Number(opt("--reps", 2));
  const jobs = cases.flatMap((c) => ARMS.flatMap((arm) => Array.from({ length: reps }, (_, rep) => ({ c, arm, rep }))));
  const rows = await pool(jobs, Number(opt("--parallel", 4)), async ({ c, arm, rep }) => {
    const r = { ...(await oneRun(c, arm, opts)), rep };
    process.stderr.write(`${c.id}/${arm}#${rep}: ${r.error ? `error ${r.error}` : `${r.claims_met}/${r.claims} claims, ${r.rounds} rounds, $${r.cost_usd}`}\n`);
    return r;
  });
  const result = { created: new Date().toISOString(), opts, reps, rows, summary: summarize(rows) };
  const out = opt("--out", null);
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result.summary, null, 2) + "\n");
  return 0;
}

export { oneRun };
if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`ambiguity-eval: ${e.message}\n`); process.exit(2); });
