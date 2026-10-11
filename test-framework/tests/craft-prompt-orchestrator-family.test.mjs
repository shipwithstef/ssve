// @organism-suite
/**
 * craft-prompt floor: the author (orchestrator) family is REQUIRED and comes from the host.
 * It is never defaulted, so a same-family review can never be certified as independent.
 * Hermetic: no model calls; the judge launcher is stubbed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHECK = path.join(ROOT, "scripts/blind-floor-check.mjs");
const ROUTE = path.join(ROOT, "scripts/prompt-floor-route.mjs");
const JUDGE = path.join(ROOT, "scripts/prompt-floor-judge.sh");
const SKILL = path.join(ROOT, "skills/craft-prompt/SKILL.md");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cp-family-"));
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
const sha = (s) => createHash("sha256").update(s).digest("hex");

function fixture(reviewerFamily) {
  const d = tmp();
  const B = { elements: [{ key: "req:a", content: "short" }] };
  const F = { elements: [{ key: "req:a", content: "long" }] };
  const V = { reviewer_host: "x", reviewer_family: reviewerFamily, certifications: [
    { key: "req:a", certified_strict_improvement: true, reviewer_family: reviewerFamily, for_content_sha: sha("ALTER\nshort\n=>\nlong") },
  ] };
  const w = (n, o) => { const p = path.join(d, n); fs.writeFileSync(p, JSON.stringify(o)); return p; };
  return { blind: w("B.json", B), merged: w("F.json", F), verdicts: w("V.json", V) };
}
const check = (fx, ...extra) => run(process.execPath, [CHECK, "--blind", fx.blind, "--merged", fx.merged, "--verdicts", fx.verdicts, ...extra]);

test("blind-floor-check: --orchestrator-family is required, never defaulted", () => {
  const fx = fixture("openai");
  const r = check(fx);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--orchestrator-family is required/);
  assert.equal(r.stdout, "", "no verdict is emitted without an author family");
});

test("blind-floor-check: an unrecognised family is rejected", () => {
  const r = check(fixture("openai"), "--orchestrator-family", "banana");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unrecognised/);
});

test("blind-floor-check: cross-family certification counts", () => {
  const r = check(fixture("openai"), "--orchestrator-family", "claude");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).floor_verdict, "pass");
});

test("blind-floor-check: author family == reviewer family is NOT certified independent", () => {
  for (const [orch, reviewer] of [["openai", "openai"], ["codex", "openai"], ["anthropic", "claude"], ["claude", "Anthropic"]]) {
    const r = check(fixture(reviewer), "--orchestrator-family", orch);
    assert.equal(r.status, 1, `${orch} vs ${reviewer}: ${r.stdout}`);
    const out = JSON.parse(r.stdout);
    assert.equal(out.floor_verdict, "fail");
    assert.deepEqual(out.element_ledger.altered, ["req:a"]);
    assert.deepEqual(out.same_family_rejected, ["req:a"]);
  }
});

test("blind-floor-check: a reviewer whose family cannot be derived is not provably independent", () => {
  const r = check(fixture("mystery"), "--orchestrator-family", "claude");
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).element_ledger.altered[0], "req:a");
});

test("prompt-floor-route: --orchestrator-family is required and echoed", () => {
  const root = tmp();
  const miss = run(process.execPath, [ROUTE, "--task", "infra", "--size", "M", "--root", root]);
  assert.equal(miss.status, 2);
  assert.match(miss.stderr, /--orchestrator-family is required/);
  const ok = run(process.execPath, [ROUTE, "--task", "infra", "--size", "M", "--root", root, "--orchestrator-family", "codex"]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).orchestrator_family, "openai");
  const bad = run(process.execPath, [ROUTE, "--task", "infra", "--size", "M", "--root", root, "--orchestrator-family", "banana"]);
  assert.equal(bad.status, 2);
});

function judgeSandbox(reviewerFamily) {
  const d = tmp();
  fs.mkdirSync(path.join(d, "scripts"));
  fs.copyFileSync(JUDGE, path.join(d, "scripts/prompt-floor-judge.sh"));
  const findings = path.join(d, "findings.json");
  fs.writeFileSync(findings, JSON.stringify({ reviewer: { host: "stub", family: reviewerFamily }, certifications: [{ key: "req:a", certified: true }] }));
  fs.writeFileSync(path.join(d, "scripts/run-external-review.mjs"),
    `process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(JSON.stringify({findings:${JSON.stringify(findings)},receipt:"stub"})));`);
  const w = (n, o) => { const p = path.join(d, n); fs.writeFileSync(p, JSON.stringify(o)); return p; };
  return {
    d,
    blind: w("B.json", { elements: [{ key: "req:a", content: "short" }] }),
    merged: w("F.json", { elements: [{ key: "req:a", content: "long" }] }),
    rows: w("rows.json", [{ key: "req:a", change: "ALTER" }]),
  };
}
const judge = (s, ...extra) => run("bash", [path.join(s.d, "scripts/prompt-floor-judge.sh"), "--blind", s.blind, "--merged", s.merged, "--rows", s.rows, ...extra],
  { env: { ...process.env, SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR: path.join(s.d, "art") } });

test("prompt-floor-judge: --orchestrator-family is required, never defaulted", () => {
  const r = judge(judgeSandbox("openai"));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--orchestrator-family is required/);
});

test("prompt-floor-judge: an unsupported orchestrator family is a hard failure", () => {
  const r = judge(judgeSandbox("openai"), "--orchestrator-family", "banana");
  assert.equal(r.status, 4);
});

test("prompt-floor-judge: cross-family reviewer certifies", () => {
  const r = judge(judgeSandbox("openai"), "--orchestrator-family", "anthropic");
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.reviewer_family, "openai");
  assert.equal(out.certifications[0].certified_strict_improvement, true);
});

test("prompt-floor-judge: a same-family reviewer is never certified independent", () => {
  for (const [orch, reviewer] of [["anthropic", "anthropic"], ["codex", "OpenAI"]]) {
    const r = judge(judgeSandbox(reviewer), "--orchestrator-family", orch);
    assert.equal(r.status, 4, `${orch} vs ${reviewer}`);
    assert.equal(r.stdout, "", "no certification JSON is emitted");
    assert.match(r.stderr, /same family/);
  }
});

test("craft-prompt SKILL.md passes --orchestrator-family at every floor call site", () => {
  const text = fs.readFileSync(SKILL, "utf8");
  const sites = text.split("\n").flatMap((l) => (l.match(/(?:node|bash) scripts\/(?:prompt-floor-route\.mjs|blind-floor-check\.mjs|prompt-floor-judge\.sh)[^`]*/g) || []));
  assert.ok(sites.length >= 4, `expected the route, check x2 and judge call sites, found ${sites.length}`);
  for (const s of sites) assert.match(s, /--orchestrator-family <host-family>/, s);
});
