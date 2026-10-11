// Owner directives 2026-10-11 (after P1.1) sit at the top of §11 and
// override the games-repo step. No model. The §9 plan-hygiene checks
// (stale cancelled copy, privacy) run on the edited regions. Tier-1 has
// no docs/analysis linter and no separate stale-string script.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLAN = path.join(ROOT, "docs/analysis/2026-10-11-organism-plan.md");
const plan = fs.readFileSync(PLAN, "utf8");

const section11At = plan.indexOf("\n## 11. ");
const directivesAt = plan.indexOf("### Owner directives 2026-10-11 (after P1.1)");
const historyAt = plan.indexOf("Rev 3 (owner, f05c82f) is the base.");
const gamesAt = plan.indexOf("**Owner side requests:**");

function slice(from, to) {
  assert.ok(from >= 0 && to > from, `bad slice ${from}..${to}`);
  return plan.slice(from, to);
}

const directives = slice(directivesAt, historyAt);
const games = slice(gamesAt, plan.indexOf("- **Plan file.**"));

test("owner directives are the first block of §11 and history stays under them", () => {
  assert.ok(section11At >= 0);
  assert.ok(directivesAt > section11At);
  assert.ok(historyAt > directivesAt);
  const between = plan.slice(section11At, directivesAt).trim();
  assert.match(between, /^## 11\. Revision 4:/);
  assert.doesNotMatch(between, /Rev 3 \(owner/);
  assert.match(plan, /\*\*Factual corrections to rev 3:\*\*/);
  assert.match(plan, /1\. \*\*P1\.1 Frozen baseline \(Gate A\)\.\*\*/);
});

test("directive 1 voids P1.1 at dc358c08 as a finding, not Gate A", () => {
  assert.match(directives, /P1\.1 at `dc358c08` is void as a baseline/);
  assert.match(directives, /0 of 21 framework runs executed the framework journey/);
  assert.match(directives, /route-workflow loaded, then it was skipped/);
  assert.match(directives, /Receipts were 0/);
  assert.match(directives, /Record this as a finding/);
  assert.match(directives, /It is not Gate A/);
  assert.doesNotMatch(directives, /P1\.1 at `dc358c08` is Gate A/);
});

test("directive 2 counts only a journey hit, checked on transcripts and the repo", () => {
  assert.match(directives, /intended journey is hit/);
  assert.match(directives, /Journey specs and a conformance checker/);
  assert.match(directives, /transcripts and the final repo/);
  assert.match(directives, /does not conform is void/);
});

test("directive 3 orders make-it-work, then conformance, then solo versus framework", () => {
  assert.match(directives, /§5\.2 one scheduler as `svc-next`/);
  assert.match(directives, /route-workflow user entry at 60 lines or fewer/);
  assert.match(directives, /fresh-project bootstrap/);
  assert.match(directives, /completion guard/);
  assert.match(directives, /sandbox-capable reviews/);
  assert.match(directives, /mode `0700` home/);
  assert.match(directives, /seeded root commit and `origin\/main` for both arms/);
  assert.match(directives, /no visible per-job budget/);
  assert.match(directives, /100% conformance on every dev task with diagnostic runs/);
  assert.match(directives, /measure solo against that working framework/);
  assert.match(directives, /P1\.3 items b, c, d and f are built now/);
  assert.match(directives, /They are not later treatments/);
});

test("directive 4 records that R ≥ 2 is unreachable on dev and leaves the bar", () => {
  assert.match(directives, /R ≥ 2 is arithmetically unreachable on dev/);
  assert.match(directives, /measured solo means/);
  assert.match(directives, /about 1\.54/);
  assert.match(directives, /The bar stays as written, pending an owner decision/);
});

test("directive 5 and the games-repo step copy only K real-art builds", () => {
  for (const block of [directives, games]) {
    assert.match(block, /Copy only builds that pass the K real-art checks/);
    assert.match(block, /Never copy a primitive-shape build/);
    assert.match(block, /Do not archive old builds/);
    assert.doesNotMatch(block, /Copy every/);
    assert.doesNotMatch(block, /outcome-eval-artifacts/);
    assert.doesNotMatch(block, /primitive-shape builds under/);
  }
  assert.match(games, /passes the K real-art checks/);
  assert.match(games, /Hearthlight and Ardwyn are included only when they pass/);
  assert.doesNotMatch(games, /9 ai-quest builds and every/);
});

test("edited regions carry no machine path and no new account name", () => {
  for (const block of [directives, games]) {
    assert.doesNotMatch(block, /\/home\/|\/Users\/|\\\\|@[a-z0-9.-]+\.[a-z]{2,}/i);
    assert.doesNotMatch(block, /outcome-eval-artifacts|reserve-sealed|northstar-reserve|northstar-results/);
  }
  assert.match(games, /shipwithstef\/hearthlight/);
  assert.doesNotMatch(directives, /shipwithstef/);
});

test("stale-string check: the new order does not revive the cancelled copy-all or Program 1 swarm", () => {
  const edited = `${directives}\n${games}`;
  const cancelled = [
    /copy every kept game build/i,
    /every rpg-founder build/i,
    /Haiku swarm/,
    /X1 codemod/,
    /four-arm A\/B/,
    /svc-run launcher is built now/,
  ];
  for (const pattern of cancelled) assert.doesNotMatch(edited, pattern);
  assert.match(plan, /\*\*Program 1: no swarm\.\*\*/);
});
