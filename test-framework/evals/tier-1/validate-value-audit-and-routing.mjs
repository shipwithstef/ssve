#!/usr/bin/env node
/** Tier 1: the value audit turns default-vs-with rates into states correctly, and the
 * routing eval reads skill descriptions and invocation flags the way Claude Code lists
 * them. Hermetic; no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import { decide, loadUnits, judgePrompt } from "../../../scripts/value-audit.mjs";
import { parseFrontmatter, summarize } from "../../../scripts/routing-eval.mjs";

const rows = (unit, model, arm, passes, total) => Array.from({ length: total }, (_, i) => ({ unit, model, arm, rep: i, pass: i < passes }));

test("value audit: caught-up, keep and weak states", () => {
  const d = decide([
    ...rows("u1", "haiku", "default", 5, 5), ...rows("u1", "haiku", "with", 5, 5),
    ...rows("u2", "sonnet", "default", 0, 5), ...rows("u2", "sonnet", "with", 5, 5),
    ...rows("u3", "haiku", "default", 2, 5), ...rows("u3", "haiku", "with", 3, 5),
  ]);
  assert.equal(d.u1.haiku.state, "caught-up", "the model already does it");
  assert.equal(d.u2.sonnet.state, "keep", "the unit changes behaviour, established");
  assert.equal(d.u3.haiku.state, "weak", "neither");
  assert.deepEqual(decide([{ unit: "x", model: "m", arm: "default", pass: null }]), {}, "ungraded rows are not evidence");
});

test("value audit: every unit has a source that exists, a scenario and a claim; the judge never sees the arm", () => {
  for (const u of loadUnits()) {
    assert.ok(u.id && u.source && u.scenario && u.claim, u.id);
    const p = judgePrompt(u, "an answer");
    assert.ok(p.includes(u.claim) && p.includes("an answer"));
    assert.ok(!/default|with the rule|arm/i.test(p.replace(u.scenario, "").replace(u.claim, "")), "no arm label in the judge prompt");
  }
});

test("routing eval: folded, plain and quoted descriptions; disable-model-invocation hides a skill", () => {
  assert.deepEqual(parseFrontmatter("---\nname: a\ndescription: >\n  Line one\n  line two.\nversion: 1\n---\nbody"), { description: "Line one line two.", disabled: false });
  assert.deepEqual(parseFrontmatter("---\nname: a\ndescription: \"Quoted text\"\n---\n"), { description: "Quoted text", disabled: false });
  assert.deepEqual(parseFrontmatter("---\ndisable-model-invocation: true\nname: a\ndescription: >-\n  Hidden.\n---\n"), { description: "Hidden.", disabled: true });
});

test("routing eval: accuracy per ref and model, and the comparison between two refs", () => {
  const r = (ref, correct) => ({ case: "c", ref, model: "haiku", correct, skill: correct ? "a" : "b" });
  const s = summarize([r("old", true), r("old", false), r("new", true), r("new", true)]);
  assert.equal(s["old|haiku"].accuracy, 0.5);
  assert.equal(s["new|haiku"].accuracy, 1);
  assert.deepEqual(s["old|haiku"].misses, ["c->b"]);
  assert.equal(s["new_vs_old|haiku"].diff, 0.5);
});
