#!/usr/bin/env node
/**
 * learning-eval.mjs — measure what a game teaches, not what the reader already knew.
 *
 *   node scripts/learning-eval.mjs --dir <build> [--quiz <quiz.json>] [--model haiku] [--seed 1]
 *
 * 1. Play: a seeded player finishes the game the way people do, with wrong moves along
 *    the way (the walkthrough with random detours), and the exact text the player saw is
 *    recorded: every screen and every response.
 * 2. Ask: a reader told to know nothing answers hidden applied questions about real
 *    AI-engineering situations (the task's quiz.json), using only that transcript, and
 *    must quote the game line each answer came from, or answer "not shown".
 * 3. Score: an answer counts only if it is right, its quote appears verbatim in the
 *    transcript, AND a judge agrees the quoted line alone would lead someone with no AI
 *    knowledge to that answer. The verbatim check stops invented quotes; the judge stops
 *    real but irrelevant ones (a bare action name, with the rest supplied from prior
 *    knowledge). The control reader gets an empty transcript; gain = game - control.
 *
 * Option order is shuffled per question with a fixed seed, so a reader that always picks
 * the same position cannot score.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { claude } from "./lib/harness-transports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_QUIZ = path.join(ROOT, "test-framework", "outcome-evals", "tasks", "ai-quest", "quiz.json");

const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const norm = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

// The text a player saw while finishing the game with occasional wrong moves.
export async function playTranscript(dir, { seed = 1, detour = 0.35 } = {}) {
  const { createQuest } = await import(pathToFileURL(path.join(dir, "game", "quest.mjs")).href);
  const walk = JSON.parse(fs.readFileSync(path.join(dir, "docs", "walkthrough.json"), "utf8"));
  const q = createQuest(), rand = rng(seed), lines = [q.screen()];
  for (const step of walk) {
    if (q.state().solved) break;
    if (rand() < detour) { const other = q.actions().filter((a) => a !== step && !/^go to /.test(a)); if (other.length && !q.state().dialogue) { const a = other[Math.floor(rand() * other.length)]; lines.push(`> ${a}`, q.act(a)); } }
    if (!q.actions().includes(step)) continue;
    lines.push(`> ${step}`, q.act(step), q.screen());
  }
  return { text: lines.filter(Boolean).join("\n"), solved: q.state().solved };
}

// Questions with options in a seeded order; the correct letter moves with its option.
export function shuffledQuiz(quiz, seed = 11) {
  const rand = rng(seed);
  return quiz.questions.map((q, i) => {
    const order = q.options.map((_, k) => k).sort(() => rand() - 0.5);
    return { id: i + 1, idea: q.idea, q: q.q, options: order.map((k) => q.options[k]), answer: "ABCD"[order.indexOf(q.answer)] };
  });
}

export function readerPrompt(transcript, questions) {
  return `You are a player who knows nothing about AI, computers or software. You just played a game; below is every line of text you saw in it. Answer the questions using ONLY what the game showed you, by analogy to what happened in the game. You must not use any other knowledge.

For each question give the letter you choose and copy, word for word, the single game line that taught you (at least six words, exactly as it appears in the transcript). If nothing in the game helps with a question, answer "not shown" with an empty quote.

=== GAME TRANSCRIPT ===
${transcript || "(you have not played anything)"}
=== END ===

Questions:
${questions.map((q) => `${q.id}. ${q.q}\n${q.options.map((o, k) => `   ${"ABCD"[k]}) ${o}`).join("\n")}`).join("\n")}`;
}

const SCHEMA = { type: "object", properties: { answers: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, choice: { type: "string" }, quote: { type: "string" } }, required: ["id", "choice", "quote"] } } }, required: ["answers"] };

// An answer scores only when it is right and its quote is really in the transcript.
export function score(questions, answers, transcript) {
  const t = norm(transcript);
  const rows = questions.map((q) => {
    const a = answers.find((x) => x.id === q.id) || { choice: "not shown", quote: "" };
    const quote = norm(a.quote || "");
    const grounded = quote.split(" ").length >= 6 && t.includes(quote);
    const correct = String(a.choice).trim().toUpperCase().startsWith(q.answer);
    return { id: q.id, idea: q.idea, correct, grounded, scored: correct && grounded, choice: a.choice };
  });
  const byIdea = {};
  for (const r of rows) (byIdea[r.idea] ??= []).push(r.scored);
  return { score: rows.filter((r) => r.scored).length / rows.length, correct_any: rows.filter((r) => r.correct).length / rows.length, ideas_taught: Object.values(byIdea).filter((xs) => xs.some(Boolean)).length, rows };
}

const JUDGE_SCHEMA = { type: "object", properties: { verdicts: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, supports: { type: "boolean" } }, required: ["id", "supports"] } } }, required: ["verdicts"] };

export function judgePrompt(items) {
  return `Each item below pairs a question about AI engineering with one line of text from a comedy adventure game. Imagine a player who knows nothing about AI and has only that line (and the situation it describes) to go on. Would that line, by analogy, lead them to the given answer? Answer supports=true only if the line itself carries the idea (a situation, consequence or joke that maps onto the answer). A line that merely names an object or action without showing why it matters does not support the answer.

${items.map((x) => `Item ${x.id}\nQuestion: ${x.q}\nAnswer: ${x.answer}\nGame line: "${x.quote}"`).join("\n\n")}`;
}

export async function learningEval(dir, { quizPath = DEFAULT_QUIZ, model = "haiku", judge = "sonnet", seed = 1, ask = claude.ask.bind(claude) } = {}) {
  const quiz = JSON.parse(fs.readFileSync(quizPath, "utf8"));
  const questions = shuffledQuiz(quiz);
  const play = await playTranscript(dir, { seed });
  const run = async (transcript) => {
    const r = await ask({ prompt: readerPrompt(transcript, questions), schema: SCHEMA, model });
    if (r.error) throw new Error(`reader failed: ${r.error}`);
    const scored = score(questions, r.output.answers, transcript);
    let cost = r.cost_usd ?? 0;
    const items = scored.rows.filter((x) => x.scored).map((x) => { const q = questions.find((y) => y.id === x.id); const a = r.output.answers.find((y) => y.id === x.id); return { id: x.id, q: q.q, answer: q.options["ABCD".indexOf(q.answer)], quote: a.quote }; });
    if (items.length) {
      const j = await ask({ prompt: judgePrompt(items), schema: JUDGE_SCHEMA, model: judge });
      if (j.error) throw new Error(`judge failed: ${j.error}`);
      cost += j.cost_usd ?? 0;
      const ok = new Set(j.output.verdicts.filter((v) => v.supports).map((v) => v.id));
      for (const row of scored.rows) { row.supported = row.scored && ok.has(row.id); row.scored = row.supported; }
      const byIdea = {};
      for (const row of scored.rows) (byIdea[row.idea] ??= []).push(row.scored);
      scored.score = scored.rows.filter((x) => x.scored).length / scored.rows.length;
      scored.ideas_taught = Object.values(byIdea).filter((xs) => xs.some(Boolean)).length;
    }
    return { ...scored, cost_usd: cost };
  };
  const game = await run(play.text), control = await run("");
  return { dir, model, judge, seed, solved_in_play: play.solved, transcript_chars: play.text.length, game, control, gain: +(game.score - control.score).toFixed(3), cost_usd: +(game.cost_usd + control.cost_usd).toFixed(4) };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (!arg("--dir")) { process.stderr.write("usage: learning-eval.mjs --dir <build> [--quiz <quiz.json>] [--model haiku] [--seed 1]\n"); process.exit(2); }
  learningEval(path.resolve(arg("--dir")), { quizPath: arg("--quiz", DEFAULT_QUIZ), model: arg("--model", "haiku"), seed: Number(arg("--seed", 1)) })
    .then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + "\n"); process.exit(0); }, (e) => { process.stderr.write(`learning-eval: ${e.message}\n`); process.exit(1); });
}
