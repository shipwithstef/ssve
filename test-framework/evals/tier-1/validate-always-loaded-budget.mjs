#!/usr/bin/env node
/** Tier 1 (framework-5.5 audit): per-turn context and rule-injection noise stay measured and bounded. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const script = path.join(root, "scripts/measure-always-loaded.mjs");
const baseline = JSON.parse(fs.readFileSync(path.join(root, ".svc/perf-baseline.json"), "utf8"));
const measure = (args = []) => {
  const r = spawnSync(process.execPath, [script, "--json", ...args], { cwd: root, encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const report = measure();

test("per-turn sections are measured from the real repo", () => {
  const t = report.per_turn;
  assert.equal(t.skill_descriptions.skills, JSON.parse(fs.readFileSync(path.join(root, "skills-manifest.json"), "utf8")).includedSkills.length);
  assert.ok(t.skill_descriptions.chars > 0 && t.agent_descriptions.chars > 0 && t.always_rules.chars > 0);
  assert.ok(t.always_rules.chars <= baseline.context_budget.always_on_rules_bytes_max, `always-on rules ${t.always_rules.chars}`);
  assert.equal(t.total_chars, t.skill_descriptions.chars + t.agent_descriptions.chars + t.always_rules.chars);
});

test("rule-injection corpus noise stays at or under the baseline", () => {
  const ri = report.per_session.rule_injection;
  assert.ok(ri.events >= 20);
  assert.ok(ri.irrelevant_injections <= baseline.rule_injection.corpus_irrelevant_max,
    `irrelevant deliveries ${ri.irrelevant_injections}: ${ri.rows.filter((r) => r.irrelevant.length).map((r) => r.id + "=" + r.irrelevant).join("; ")}`);
});

test("base44 rules stay out of non-Base44 repos and still reach Base44 repos", () => {
  const rows = Object.fromEntries(report.per_session.rule_injection.rows.map((r) => [r.id, r]));
  for (const r of Object.values(rows)) if (!r.id.startsWith("base44-")) assert.ok(!r.rules.some((x) => x.startsWith("rules/base44/")), r.id);
  assert.ok(rows["base44-edit-public-asset"].rules.includes("rules/base44/static-assets-public-dir.md"));
  assert.ok(rows["base44-bash-site-deploy"].rules.some((x) => x.startsWith("rules/base44/")));
});

test("injected rule text carries no YAML frontmatter", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-inj-fm-"));
  try {
    const repo = path.join(tmp, "r"); fs.mkdirSync(path.join(repo, ".svc"), { recursive: true });
    const home = path.join(tmp, "h"); fs.mkdirSync(home, { mode: 0o700 });
    const r = spawnSync(process.execPath, [path.join(root, "hooks/svc-rule-injector.mjs")], {
      input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "src/a.tsx", new_string: "x" }, session_id: "fm1", cwd: repo }),
      cwd: repo, encoding: "utf8", env: { PATH: process.env.PATH, HOME: home, SVC_HOST: "claude", TMPDIR: tmp } });
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /--- rules\/web\/\S+ ---\n# /);
    assert.doesNotMatch(ctx, /--- rules\/\S+ ---\n---\n/);
    assert.doesNotMatch(ctx, /source_sha:/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("repo_markers gate a signal rule on path existence or file substring", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-markers-"));
  try {
    const home = path.join(tmp, "h"); fs.mkdirSync(home, { mode: 0o700 });
    const rules = path.join(tmp, "rules"); fs.mkdirSync(path.join(rules, "rules"), { recursive: true });
    fs.writeFileSync(path.join(rules, "rules/m.md"), "MARKER RULE BODY\n");
    const manifest = path.join(tmp, "manifest.json");
    fs.writeFileSync(manifest, JSON.stringify({ rulesRegistry: { entries: [{ path: "rules/m.md", type: "correction", auto_inject: "signal",
      signals: { paths: ["public/"], repo_markers: ["acme.config", "package.json:@acme/sdk"] } }] } }));
    const inject = (repo, sid) => spawnSync(process.execPath, [path.join(root, "hooks/svc-rule-injector.mjs")], {
      input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "public/x.png", content: "x" }, session_id: sid, cwd: repo }),
      cwd: repo, encoding: "utf8", env: { PATH: process.env.PATH, HOME: home, SVC_HOST: "claude", TMPDIR: tmp,
        SVC_RULES_MANIFEST: manifest, SVC_RULES_ROOT: rules, SVC_CONCERNS_REGISTRY: path.join(tmp, "none.json") } }).stdout;
    const mk = (name, files) => { const d = path.join(tmp, name); fs.mkdirSync(path.join(d, ".svc"), { recursive: true });
      for (const [f, b] of Object.entries(files)) fs.writeFileSync(path.join(d, f), b); return d; };
    assert.equal(inject(mk("plain", { "package.json": "{\"dependencies\":{\"react\":\"1\"}}" }), "m1"), "");
    assert.match(inject(mk("bypath", { "acme.config": "" }), "m2"), /MARKER RULE BODY/);
    assert.match(inject(mk("bysub", { "package.json": "{\"dependencies\":{\"@acme/sdk\":\"1\"}}" }), "m3"), /MARKER RULE BODY/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("--compare reports per-section savings against an earlier report", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-cmp-"));
  try {
    const before = structuredClone(report);
    before.per_turn.skill_descriptions.chars += 1000; before.per_turn.total_chars += 1000;
    const file = path.join(tmp, "before.json"); fs.writeFileSync(file, JSON.stringify(before));
    const out = measure(["--no-injection", "--compare", file]);
    assert.equal(out.delta.skills.saved, 1000);
    assert.equal(out.delta.per_turn_total.saved, 1000);
    assert.equal(out.delta.injection.saved, null);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("bad arguments are usage errors", () => {
  for (const args of [["--root"], ["--bogus"]]) {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(r.status, 2); assert.equal(r.stdout, "");
  }
});
