#!/usr/bin/env node
/** Tier 1: a run exports as its build (no dependencies, no grader file) plus SCORES.md with
 * everything measured, under a stable private-repo name. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exportRun, repoName, scoresMarkdown } from "../../../scripts/export-run.mjs";

test("export copies the build, drops dependencies and the grader, and writes SCORES.md", () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "export-test-"));
  const art = path.join(t, "build");
  fs.mkdirSync(path.join(art, "node_modules", "x"), { recursive: true });
  fs.writeFileSync(path.join(art, "index.html"), "<p>hi</p>");
  fs.writeFileSync(path.join(art, "__hidden.test.mjs"), "secret");
  const row = { task: "ai-quest", arm: "bounded", rep: 0, model: "opus", artifact: art, hidden_pass: 9, hidden_total: 10, hidden_failures: ["IP gate: x"], judge_total: 2, judge_scores: { fun: 1, art: 1 }, probes: { size: { source_loc: 10 } } };
  fs.writeFileSync(path.join(t, "r.json"), JSON.stringify({ rows: [row] }));
  const out = path.join(t, "out");
  const r = exportRun({ results: path.join(t, "r.json"), index: 0, out, learning: { game: { score: 0.5, ideas_taught: 6 }, control: { score: 0 }, gain: 0.5 } });
  assert.match(r.repo, /^ssve-eval-ai-quest-bounded-1-\d{4}-\d{2}-\d{2}$/);
  assert.ok(fs.existsSync(path.join(out, "index.html")));
  assert.ok(!fs.existsSync(path.join(out, "node_modules")) && !fs.existsSync(path.join(out, "__hidden.test.mjs")));
  const md = fs.readFileSync(path.join(out, "SCORES.md"), "utf8");
  assert.match(md, /9\/10 passed\. Failed: IP gate/);
  assert.match(md, /ideas taught 6 of 8/);
  assert.equal(repoName({ task: "A b", arm: "x", rep: 2 }, "2026-01-02"), "ssve-eval-a-b-x-3-2026-01-02");
  assert.match(scoresMarkdown(row, { web: { design: { axe: { value: 0 } } } }), /\| design\.axe \| 0 \|/);
});
