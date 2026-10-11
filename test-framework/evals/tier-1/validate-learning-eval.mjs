#!/usr/bin/env node
/** Tier 1: the learning eval scores only what the game taught. An answer counts when it
 * is right, its quote is really in the transcript, and the judge agrees the line carries
 * the idea; option order is shuffled so a fixed-position guesser cannot score; the
 * seeded player finishes the reference game. Hermetic: the model is a fake. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playTranscript, shuffledQuiz, score, learningEval, readerPrompt } from "../../../scripts/learning-eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TASK = path.join(ROOT, "test-framework/outcome-evals/tasks/ai-quest");
const quiz = JSON.parse(fs.readFileSync(path.join(TASK, "quiz.json"), "utf8"));

test("options are shuffled so no answer position dominates", () => {
  const qs = shuffledQuiz(quiz);
  assert.equal(qs.length, 16);
  const counts = {}; for (const q of qs) counts[q.answer] = (counts[q.answer] || 0) + 1;
  assert.ok(Math.max(...Object.values(counts)) <= 7, `answer positions ${JSON.stringify(counts)}`);
  for (const q of qs) assert.equal(q.options["ABCD".indexOf(q.answer)], quiz.questions[q.id - 1].options[quiz.questions[q.id - 1].answer]);
});

test("the seeded player finishes the reference game and records what it saw", async () => {
  const p = await playTranscript(path.join(TASK, "ref"), { seed: 1 });
  assert.equal(p.solved, true);
  assert.match(p.text, /> use taster jar on recipe board/);
  assert.equal(p.text, (await playTranscript(path.join(TASK, "ref"), { seed: 1 })).text, "same seed, same transcript");
});

test("an answer scores only when right and quoted verbatim from the transcript", () => {
  const qs = shuffledQuiz(quiz).slice(0, 3);
  const t = "The strangers try the chowder and two of them wince at the salt.";
  const r = score(qs, [
    { id: 1, choice: qs[0].answer, quote: "The strangers try the chowder and two of them wince" },
    { id: 2, choice: qs[1].answer, quote: "an invented line that never appeared in the game" },
    { id: 3, choice: "ABCD".replace(qs[2].answer, "")[0], quote: "The strangers try the chowder and two of them wince" },
  ], t);
  assert.deepEqual(r.rows.map((x) => x.scored), [true, false, false]);
});

test("the judge removes real but irrelevant quotes; the empty-transcript control scores zero", async () => {
  const qs = shuffledQuiz(quiz);
  const calls = [];
  const ask = async ({ prompt, schema }) => {
    calls.push(prompt);
    if (schema.required[0] === "verdicts") return { output: { verdicts: [...prompt.matchAll(/Item (\d+)/g)].map((m) => ({ id: Number(m[1]), supports: m[1] === "1" })) }, cost_usd: 0 };
    const empty = prompt.includes("(you have not played anything)");
    const line = "You pick up the taster jar and look around the tavern.";
    return { output: { answers: qs.map((q) => ({ id: q.id, choice: empty ? "not shown" : q.answer, quote: empty ? "" : (q.id <= 2 ? "You pick up the taster jar." : line) })) }, cost_usd: 0 };
  };
  const r = await learningEval(path.join(TASK, "ref"), { ask });
  assert.equal(r.control.score, 0);
  assert.ok(r.game.rows.filter((x) => x.correct && x.grounded).length >= 2, "verbatim quotes from the real transcript are found");
  assert.equal(r.game.rows.filter((x) => x.scored).length, 1, "only the item the judge accepts scores");
  assert.ok(calls.some((p) => p.includes("knows nothing about AI")), "the judge is asked about a player with no AI knowledge");
  assert.match(readerPrompt("x", qs.slice(0, 1)), /ONLY what the game showed you/);
});
