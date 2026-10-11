#!/usr/bin/env node
/** Tier 1: an eval run stops spending at its cap. Shares are equal over the jobs left,
 * parallel jobs in flight hold their share so they cannot overspend together, money a
 * job did not use goes to the jobs after it, a job below the floor is skipped, and with
 * no cap nothing is limited. Hermetic: no model is called. */
import test from "node:test";
import assert from "node:assert/strict";
import { Budget, JUDGE_SHARE } from "../../../scripts/outcome-eval.mjs";

test("equal shares, split between builder and judge", () => {
  const b = new Budget(40, 4);
  const c = b.claim();
  assert.equal(c.usd, 10);
  assert.equal(c.builder, +(10 * (1 - JUDGE_SHARE)).toFixed(2));
  assert.equal(c.judge, +(10 * JUDGE_SHARE).toFixed(2));
});

test("jobs in flight together never hold more than the cap", () => {
  const b = new Budget(40, 9);
  const live = [b.claim(), b.claim(), b.claim()];
  assert.ok(live.reduce((n, c) => n + c.usd, 0) <= 40 + 1e-9);
});

test("worst case: every job spends its whole share, the total stays within the cap", () => {
  const b = new Budget(40, 9); let spent = 0;
  for (let i = 0; i < 9; i++) { const c = b.claim(); if (!c) continue; spent += c.usd; b.settle(c, c.usd); }
  assert.ok(spent <= 40 + 1e-9, `spent ${spent}`);
});

test("unspent money goes to later jobs; a job below the floor is skipped", () => {
  const b = new Budget(10, 2);
  const first = b.claim(); b.settle(first, 1);        // used $1 of $5
  assert.equal(b.claim().usd, 9, "the last job gets everything not spent");
  const tight = new Budget(1, 3, 0.5);
  assert.equal(tight.claim(), null, "$0.33 is below the $0.50 floor: skipped, not run half-funded");
});

test("no cap: nothing is limited", () => {
  const b = new Budget(null, 3);
  assert.deepEqual(b.claim(), { usd: null });
});

test("the CLI cap is soft: a job that overspends is charged in full, later jobs shrink or are skipped", () => {
  const b = new Budget(10, 3);
  const c = b.claim();                      // share 3.33
  b.settle(c, 9);                           // overspent to $9
  const next = b.claim();                   // (10 - 9) / 2 = 0.5, at the floor
  assert.equal(next.usd, 0.5);
  b.settle(next, 0.6);                      // overspent again: $0.40 left < $0.50 floor
  assert.equal(b.claim(), null, "nothing left: the last job is skipped, not started");
});
