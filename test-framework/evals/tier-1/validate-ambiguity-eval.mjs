#!/usr/bin/env node
/** Tier 1: the ambiguity eval keeps the owner's intent away from the builder, counts
 * owner rounds, forces a spec when questions run out, and scores the spec only through
 * the judge's per-claim verdicts. Hermetic: the model is a stub. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { oneRun, builderPrompt, ownerPrompt, summarize } from "../../../scripts/ambiguity-eval.mjs";

const corpus = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../outcome-evals/ambiguity/corpus.json"), "utf8"));
const chess = corpus.cases.find((c) => c.id === "chess");

test("the corpus has a request, a hidden intent and claims for every case", () => {
  assert.ok(corpus.cases.length >= 6);
  for (const c of corpus.cases) assert.ok(c.request && c.intent && c.claims.length >= 3, c.id);
});

test("the builder never sees the intent; the terms arm asks for 10 terms and a first question", () => {
  for (const arm of ["direct", "terms"]) assert.ok(!builderPrompt(arm, chess.request, "").includes(chess.intent));
  assert.match(builderPrompt("terms", chess.request, ""), /10 terms/);
  assert.match(builderPrompt("terms", chess.request, ""), /question to settle first/);
  assert.ok(ownerPrompt(chess.intent, "Who plays?").includes(chess.intent));
});

test("rounds are counted, a spec is forced after the last round, and the judge decides the score", async () => {
  const seen = [];
  const ask = async ({ prompt, schema }) => {
    seen.push(prompt);
    if (schema?.required?.includes("met")) return { output: { met: [true, true, false, true] }, cost_usd: 0.001 };
    if (schema) return { output: prompt.includes("no questions left") ? { kind: "spec", text: "two players, one screen" } : { kind: "questions", text: "Who plays whom?" }, cost_usd: 0.001 };
    return { output: "My brother and me, same laptop.", cost_usd: 0.001 };
  };
  const r = await oneRun(chess, "direct", { builder: "b", owner: "o", judge: "j" }, ask);
  assert.equal(r.rounds, 4, "four owner rounds, then the spec is forced");
  assert.equal(r.claims_met, 3);
  assert.equal(r.score, 0.75);
  assert.ok(seen.some((p) => p.includes("no questions left")));
});

test("summary compares the arms on score, rounds and cost", () => {
  const rows = ["direct", "terms"].flatMap((arm) => [0, 1].map((rep) => ({ arm, rep, score: arm === "terms" ? 1 : 0.5, rounds: 2, cost_usd: 0.01 })));
  const s = summarize(rows);
  assert.equal(s.score.terms, 1);
  assert.equal(s.score.direct, 0.5);
  assert.ok(s.score_terms_minus_direct.diff > 0);
});
